from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.base import get_db
from app.models.scheduling import (
    AuditLog,
    Batch,
    Course,
    Department,
    DepartmentOperatingDay,
    Faculty,
    Notification,
    Room,
    SchedulePeriod,
    TimeSlot,
    TimetableEntry,
    TimetableVersion,
    User,
)
from app.schemas.scheduling import (
    BatchOut,
    CourseOut,
    FacultyOut,
    RoomOut,
    TimeSlotOut,
    TimetableEntryCreate,
    TimetableEntryOut,
    TimetableEntryUpdate,
    TimetableMetadataOut,
    TimetableResponseOut,
    TimetableVersionOut,
)
from app.services.timetable_validator import validate_timetable_entry

router = APIRouter(prefix="/timetable", tags=["Timetable"])


def _payload_period_index(period_index: int | None, start_time: str | None) -> int:
    if start_time is not None:
        hour, minute = (int(part) for part in start_time.split(":"))
        return hour * 60 + minute + 1
    if period_index is not None:
        return period_index
    raise HTTPException(status_code=422, detail="A slot index or explicit start time is required.")


def _resolve_department_id(current_user: User, department_id: str | None) -> str:
    if current_user.role == "SUPER_ADMIN":
        return department_id or "dept-cse"
    if current_user.department_id:
        if department_id and department_id != current_user.department_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to access another department's resources.",
            )
        return current_user.department_id
    if department_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access another department's resources.",
        )
    return "dept-cse"


def _get_latest_published_version(db: Session, department_id: str) -> TimetableVersion | None:
    return db.scalar(
        select(TimetableVersion)
        .where(
            TimetableVersion.department_id == department_id,
            TimetableVersion.status == "PUBLISHED",
        )
        .order_by(desc(TimetableVersion.version_number))
        .limit(1)
    )


def _get_or_create_editable_version(
    db: Session,
    department_id: str,
    user_id: str,
    publish_immediately: bool,
    change_note: str,
) -> TimetableVersion:
    published = _get_latest_published_version(db, department_id)
    draft = db.scalar(
        select(TimetableVersion)
        .where(
            TimetableVersion.department_id == department_id,
            TimetableVersion.status == "DRAFT",
        )
        .order_by(desc(TimetableVersion.version_number))
        .limit(1)
    )

    if publish_immediately:
        # Clone active entries into a new immutable published version so history is preserved
        source_version = draft or published
        max_ver = db.scalar(
            select(TimetableVersion.version_number)
            .where(TimetableVersion.department_id == department_id)
            .order_by(desc(TimetableVersion.version_number))
            .limit(1)
        ) or 0

        if published:
            published.status = "ARCHIVED"
        if draft:
            draft.status = "ARCHIVED"

        new_version = TimetableVersion(
            department_id=department_id,
            version_number=max_ver + 1,
            status="PUBLISHED",
            notes=change_note,
            created_by_user_id=user_id,
            published_at=datetime.now(timezone.utc),
        )
        db.add(new_version)
        db.flush()

        if source_version:
            existing_entries = db.scalars(
                select(TimetableEntry).where(TimetableEntry.version_id == source_version.id)
            ).all()
            for item in existing_entries:
                db.add(
                    TimetableEntry(
                        version_id=new_version.id,
                        department_id=item.department_id,
                        day_of_week=item.day_of_week,
                        period_index=item.period_index,
                        duration_periods=item.duration_periods,
                        start_time=item.start_time,
                        end_time=item.end_time,
                        course_id=item.course_id,
                        faculty_id=item.faculty_id,
                        room_id=item.room_id,
                        batch_id=item.batch_id,
                        session_type=item.session_type,
                        notes=item.notes,
                    )
                )
            db.flush()
        return new_version

    if draft:
        return draft

    max_ver = db.scalar(
        select(TimetableVersion.version_number)
        .where(TimetableVersion.department_id == department_id)
        .order_by(desc(TimetableVersion.version_number))
        .limit(1)
    ) or 0
    new_draft = TimetableVersion(
        department_id=department_id,
        version_number=max_ver + 1,
        status="DRAFT",
        notes=change_note,
        created_by_user_id=user_id,
    )
    db.add(new_draft)
    db.flush()

    if published:
        for item in db.scalars(
            select(TimetableEntry).where(TimetableEntry.version_id == published.id)
        ).all():
            db.add(
                TimetableEntry(
                    version_id=new_draft.id,
                    department_id=item.department_id,
                    day_of_week=item.day_of_week,
                    period_index=item.period_index,
                    duration_periods=item.duration_periods,
                    start_time=item.start_time,
                    end_time=item.end_time,
                    course_id=item.course_id,
                    faculty_id=item.faculty_id,
                    room_id=item.room_id,
                    batch_id=item.batch_id,
                    session_type=item.session_type,
                    notes=item.notes,
                )
            )
        db.flush()
    return new_draft


def _serialize_entries(
    db: Session, entries: list[TimetableEntry], version_number: int
) -> list[TimetableEntryOut]:
    course_map = {c.id: c for c in db.scalars(select(Course)).all()}
    faculty_map = {f.id: f for f in db.scalars(select(Faculty)).all()}
    room_map = {r.id: r for r in db.scalars(select(Room)).all()}
    batch_map = {b.id: b for b in db.scalars(select(Batch)).all()}
    department_ids = {entry.department_id for entry in entries}
    legacy_slots = db.scalars(select(TimeSlot).where(TimeSlot.department_id.in_(department_ids))).all() if department_ids else []
    slot_by_department_index = {(slot.department_id, slot.period_index): slot for slot in legacy_slots}
    configured_departments = set(db.scalars(select(DepartmentOperatingDay.department_id).where(
        DepartmentOperatingDay.department_id.in_(department_ids)
    )).all()) if department_ids else set()

    result: list[TimetableEntryOut] = []
    for entry in entries:
        course = course_map.get(entry.course_id)
        fac = faculty_map.get(entry.faculty_id)
        room = room_map.get(entry.room_id)
        batch = batch_map.get(entry.batch_id)
        if not (course and fac and room and batch):
            continue
        start_time, end_time = entry.start_time, entry.end_time
        if not start_time or not end_time:
            first = slot_by_department_index.get((entry.department_id, entry.period_index))
            last = slot_by_department_index.get((entry.department_id, entry.period_index + entry.duration_periods - 1))
            start_time = first.start_time[:5] if first else "00:00"
            end_time = last.end_time[:5] if last else start_time
        output_period_index = entry.period_index
        if entry.department_id in configured_departments:
            hour, minute = (int(part) for part in start_time.split(":"))
            output_period_index = hour * 60 + minute + 1
        result.append(
            TimetableEntryOut(
                id=entry.id,
                version_id=entry.version_id,
                version_number=version_number,
                day_of_week=entry.day_of_week,
                period_index=output_period_index,
                duration_periods=entry.duration_periods,
                start_time=start_time,
                end_time=end_time,
                course_id=course.id,
                course_code=course.code,
                course_name=course.name,
                course_color=course.color_token,
                faculty_id=fac.id,
                faculty_name=fac.name,
                room_id=room.id,
                room_number=room.room_number,
                room_building=room.building,
                room_type=room.room_type,
                batch_id=batch.id,
                batch_name=batch.name,
                session_type=entry.session_type,
                notes=entry.notes,
                updated_at=entry.updated_at,
            )
        )
    return result


@router.get("/metadata", response_model=TimetableMetadataOut)
def get_timetable_metadata(
    department_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TimetableMetadataOut:
    dept_id = _resolve_department_id(current_user, department_id)
    dept = db.get(Department, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    faculty = db.scalars(select(Faculty).where(
        Faculty.department_id == dept_id,
        Faculty.is_active.is_(True),
    ).order_by(Faculty.name)).all()
    courses = db.scalars(select(Course).where(Course.department_id == dept_id).order_by(Course.code)).all()
    rooms = db.scalars(select(Room).where(Room.department_id == dept_id).order_by(Room.room_number)).all()
    batches = db.scalars(select(Batch).where(Batch.department_id == dept_id).order_by(Batch.name)).all()
    slots = db.scalars(select(TimeSlot).where(TimeSlot.department_id == dept_id).order_by(TimeSlot.period_index)).all()
    configured_days = db.scalars(select(DepartmentOperatingDay).where(
        DepartmentOperatingDay.department_id == dept_id
    )).all()
    if configured_days:
        configured_periods = db.scalars(select(SchedulePeriod).where(
            SchedulePeriod.department_id == dept_id
        ).order_by(SchedulePeriod.sort_order)).all()
        by_start: dict[str, dict[str, object]] = {}
        for period in configured_periods:
            item = by_start.setdefault(period.start_time, {
                "id": f"schedule-{period.start_time.replace(':', '')}",
                "period_index": int(period.start_time[:2]) * 60 + int(period.start_time[3:5]) + 1,
                "label": period.name,
                "start_time": period.start_time,
                "end_time": period.end_time,
                "is_break": False,
                "applicable_days": [],
                "blocked_days": [],
            })
            if period.end_time > str(item["end_time"]):
                item["end_time"] = period.end_time
            if str(item["label"]) != period.name:
                item["label"] = "Schedule interval"
            item["applicable_days"].append(period.day_of_week)  # type: ignore[union-attr]
            if not period.enabled or period.period_type != "TEACHING":
                item["blocked_days"].append(period.day_of_week)  # type: ignore[union-attr]
        slots_out = [TimeSlotOut(**item) for item in sorted(by_start.values(), key=lambda value: str(value["start_time"]))]
    else:
        slots_out = [TimeSlotOut.model_validate(s) for s in slots]
    versions = db.scalars(
        select(TimetableVersion)
        .where(TimetableVersion.department_id == dept_id)
        .order_by(desc(TimetableVersion.version_number))
        .limit(10)
    ).all()
    active_version = _get_latest_published_version(db, dept_id)

    return TimetableMetadataOut(
        department_id=dept.id,
        department_name=dept.name,
        faculty=[FacultyOut.model_validate(f) for f in faculty],
        courses=[CourseOut.model_validate(c) for c in courses],
        rooms=[RoomOut.model_validate(r) for r in rooms],
        batches=[BatchOut.model_validate(b) for b in batches],
        time_slots=slots_out,
        active_version=TimetableVersionOut.model_validate(active_version) if active_version else None,
        versions=[TimetableVersionOut.model_validate(v) for v in versions],
    )


@router.get("/entries", response_model=TimetableResponseOut)
def list_timetable_entries(
    department_id: str | None = None,
    batch_id: str | None = None,
    faculty_id: str | None = None,
    room_id: str | None = None,
    mode: str = Query(default="published", pattern="^(published|draft)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TimetableResponseOut:
    dept_id = _resolve_department_id(current_user, department_id)
    if mode == "draft" and current_user.role in ("DEPT_ADMIN", "SUPER_ADMIN"):
        version = db.scalar(
            select(TimetableVersion)
            .where(TimetableVersion.department_id == dept_id, TimetableVersion.status == "DRAFT")
            .order_by(desc(TimetableVersion.version_number))
            .limit(1)
        ) or _get_latest_published_version(db, dept_id)
    else:
        version = _get_latest_published_version(db, dept_id)

    if not version:
        return TimetableResponseOut(version=None, entries=[], total_entries=0)

    stmt = select(TimetableEntry).where(TimetableEntry.version_id == version.id)
    if batch_id:
        stmt = stmt.where(TimetableEntry.batch_id == batch_id)
    if faculty_id:
        stmt = stmt.where(TimetableEntry.faculty_id == faculty_id)
    if room_id:
        stmt = stmt.where(TimetableEntry.room_id == room_id)

    entries = db.scalars(stmt.order_by(TimetableEntry.day_of_week, TimetableEntry.period_index)).all()
    serialized = _serialize_entries(db, list(entries), version.version_number)
    return TimetableResponseOut(
        version=TimetableVersionOut.model_validate(version),
        entries=serialized,
        total_entries=len(serialized),
    )


@router.get("/faculty-view", response_model=TimetableResponseOut)
def get_my_faculty_timetable(
    faculty_id: str | None = None,
    current_user: User = Depends(require_roles("FACULTY", "DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> TimetableResponseOut:
    dept_id = _resolve_department_id(current_user, None)
    target_faculty_id = current_user.faculty_id if current_user.role == "FACULTY" else faculty_id
    if not target_faculty_id:
        raise HTTPException(status_code=400, detail="Faculty profile is not linked to this account.")

    faculty = db.get(Faculty, target_faculty_id)
    version = _get_latest_published_version(db, dept_id)
    if not version:
        return TimetableResponseOut(
            version=None,
            entries=[],
            total_entries=0,
            entity_label=faculty.name if faculty else None,
        )

    entries = db.scalars(
        select(TimetableEntry)
        .where(
            TimetableEntry.version_id == version.id,
            TimetableEntry.faculty_id == target_faculty_id,
        )
        .order_by(TimetableEntry.day_of_week, TimetableEntry.period_index)
    ).all()
    serialized = _serialize_entries(db, list(entries), version.version_number)
    return TimetableResponseOut(
        version=TimetableVersionOut.model_validate(version),
        entries=serialized,
        total_entries=len(serialized),
        entity_label=faculty.name if faculty else None,
    )


@router.get("/student-view", response_model=TimetableResponseOut)
def get_my_student_timetable(
    batch_id: str | None = None,
    current_user: User = Depends(require_roles("STUDENT", "DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> TimetableResponseOut:
    dept_id = _resolve_department_id(current_user, None)
    target_batch_id = current_user.batch_id if current_user.role == "STUDENT" else batch_id
    if not target_batch_id:
        raise HTTPException(status_code=400, detail="Student batch is not linked to this account.")

    batch = db.get(Batch, target_batch_id)
    version = _get_latest_published_version(db, dept_id)
    if not version:
        return TimetableResponseOut(
            version=None,
            entries=[],
            total_entries=0,
            entity_label=batch.name if batch else None,
        )

    entries = db.scalars(
        select(TimetableEntry)
        .where(
            TimetableEntry.version_id == version.id,
            TimetableEntry.batch_id == target_batch_id,
        )
        .order_by(TimetableEntry.day_of_week, TimetableEntry.period_index)
    ).all()
    serialized = _serialize_entries(db, list(entries), version.version_number)
    return TimetableResponseOut(
        version=TimetableVersionOut.model_validate(version),
        entries=serialized,
        total_entries=len(serialized),
        entity_label=batch.name if batch else None,
    )


@router.post("/entries", response_model=TimetableEntryOut, status_code=status.HTTP_201_CREATED)
def create_timetable_entry(
    payload: TimetableEntryCreate,
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> TimetableEntryOut:
    dept_id = _resolve_department_id(current_user, None)
    period_index = _payload_period_index(payload.period_index, payload.start_time)

    target_version = _get_or_create_editable_version(
        db,
        department_id=dept_id,
        user_id=current_user.id,
        publish_immediately=payload.publish_immediately,
        change_note=f"Added {payload.day_of_week} {payload.start_time or f'P{period_index}'} session",
    )

    issues = validate_timetable_entry(
        db,
        department_id=dept_id,
        version_id=target_version.id,
        day_of_week=payload.day_of_week,
        period_index=period_index,
        duration_periods=1 if payload.start_time and payload.end_time else payload.duration_periods,
        course_id=payload.course_id,
        faculty_id=payload.faculty_id,
        room_id=payload.room_id,
        batch_id=payload.batch_id,
        session_type=payload.session_type,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    if issues:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Hard constraint violation prevented saving this session.",
                "conflicts": [{"code": i.code, "message": i.message} for i in issues],
            },
        )

    new_entry = TimetableEntry(
        version_id=target_version.id,
        department_id=dept_id,
        day_of_week=payload.day_of_week,
        period_index=period_index,
        duration_periods=1 if payload.start_time and payload.end_time else payload.duration_periods,
        start_time=payload.start_time,
        end_time=payload.end_time,
        course_id=payload.course_id,
        faculty_id=payload.faculty_id,
        room_id=payload.room_id,
        batch_id=payload.batch_id,
        session_type=payload.session_type,
        notes=payload.notes,
    )
    db.add(new_entry)
    db.flush()

    course = db.get(Course, payload.course_id)
    batch = db.get(Batch, payload.batch_id)
    faculty = db.get(Faculty, payload.faculty_id)
    if payload.publish_immediately and course and batch and faculty:
        db.add(
            Notification(
                department_id=dept_id,
                target_role="ALL",
                title=f"Timetable Updated (v{target_version.version_number})",
                message=(
                    f"Added {course.code} ({course.name}) with {faculty.name} for {batch.name} "
                    f"on {payload.day_of_week} P{payload.period_index}."
                ),
                category="TIMETABLE_UPDATE",
            )
        )

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="TIMETABLE_ENTRY_CREATED",
            entity_type="TimetableEntry",
            entity_id=new_entry.id,
            details=f"Version v{target_version.version_number} {payload.day_of_week} P{payload.period_index}",
        )
    )
    db.commit()
    db.refresh(new_entry)
    return _serialize_entries(db, [new_entry], target_version.version_number)[0]


@router.put("/entries/{entry_id}", response_model=TimetableEntryOut)
def update_timetable_entry(
    entry_id: str,
    payload: TimetableEntryUpdate,
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> TimetableEntryOut:
    dept_id = _resolve_department_id(current_user, None)
    period_index = _payload_period_index(payload.period_index, payload.start_time)
    existing = db.get(TimetableEntry, entry_id)
    if not existing or existing.department_id != dept_id:
        raise HTTPException(status_code=404, detail="Timetable entry not found.")

    # Fingerprint to locate the cloned entry if we create a new published version
    orig_day = existing.day_of_week
    orig_period = existing.period_index
    orig_course = existing.course_id
    orig_faculty = existing.faculty_id
    orig_batch = existing.batch_id

    target_version = _get_or_create_editable_version(
        db,
        department_id=dept_id,
        user_id=current_user.id,
        publish_immediately=payload.publish_immediately,
        change_note=f"Updated {payload.day_of_week} {payload.start_time or f'P{period_index}'} session",
    )

    if existing.version_id == target_version.id:
        target_entry = existing
    else:
        target_entry = db.scalar(
            select(TimetableEntry).where(
                TimetableEntry.version_id == target_version.id,
                TimetableEntry.day_of_week == orig_day,
                TimetableEntry.period_index == orig_period,
                TimetableEntry.course_id == orig_course,
                TimetableEntry.faculty_id == orig_faculty,
                TimetableEntry.batch_id == orig_batch,
            )
        )
        if not target_entry:
            db.rollback()
            raise HTTPException(status_code=404, detail="Corresponding entry in active version not found.")

    issues = validate_timetable_entry(
        db,
        department_id=dept_id,
        version_id=target_version.id,
        day_of_week=payload.day_of_week,
        period_index=period_index,
        duration_periods=1 if payload.start_time and payload.end_time else payload.duration_periods,
        course_id=payload.course_id,
        faculty_id=payload.faculty_id,
        room_id=payload.room_id,
        batch_id=payload.batch_id,
        session_type=payload.session_type,
        start_time=payload.start_time,
        end_time=payload.end_time,
        exclude_entry_id=target_entry.id,
    )
    if issues:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Hard constraint violation prevented updating this session.",
                "conflicts": [{"code": i.code, "message": i.message} for i in issues],
            },
        )

    target_entry.day_of_week = payload.day_of_week
    target_entry.period_index = period_index
    target_entry.duration_periods = 1 if payload.start_time and payload.end_time else payload.duration_periods
    target_entry.start_time = payload.start_time
    target_entry.end_time = payload.end_time
    target_entry.course_id = payload.course_id
    target_entry.faculty_id = payload.faculty_id
    target_entry.room_id = payload.room_id
    target_entry.batch_id = payload.batch_id
    target_entry.session_type = payload.session_type
    target_entry.notes = payload.notes
    db.flush()

    course = db.get(Course, payload.course_id)
    batch = db.get(Batch, payload.batch_id)
    faculty = db.get(Faculty, payload.faculty_id)
    room = db.get(Room, payload.room_id)
    if payload.publish_immediately and course and batch and faculty and room:
        db.add(
            Notification(
                department_id=dept_id,
                target_role="ALL",
                title=f"Schedule Modified (v{target_version.version_number})",
                message=(
                    f"{course.code} for {batch.name} is now scheduled on {payload.day_of_week} "
                    f"P{payload.period_index} in {room.room_number} with {faculty.name}."
                ),
                category="TIMETABLE_UPDATE",
            )
        )

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="TIMETABLE_ENTRY_UPDATED",
            entity_type="TimetableEntry",
            entity_id=target_entry.id,
            details=f"Version v{target_version.version_number} {payload.day_of_week} P{payload.period_index}",
        )
    )
    db.commit()
    db.refresh(target_entry)
    return _serialize_entries(db, [target_entry], target_version.version_number)[0]


@router.delete("/entries/{entry_id}")
def delete_timetable_entry(
    entry_id: str,
    publish_immediately: bool = True,
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> dict[str, str | int]:
    dept_id = _resolve_department_id(current_user, None)
    existing = db.get(TimetableEntry, entry_id)
    if not existing or existing.department_id != dept_id:
        raise HTTPException(status_code=404, detail="Timetable entry not found.")

    orig_day = existing.day_of_week
    orig_period = existing.period_index
    orig_course = existing.course_id
    orig_faculty = existing.faculty_id
    orig_batch = existing.batch_id

    target_version = _get_or_create_editable_version(
        db,
        department_id=dept_id,
        user_id=current_user.id,
        publish_immediately=publish_immediately,
        change_note=f"Removed {orig_day} P{orig_period} session",
    )

    if existing.version_id == target_version.id:
        target_entry = existing
    else:
        target_entry = db.scalar(
            select(TimetableEntry).where(
                TimetableEntry.version_id == target_version.id,
                TimetableEntry.day_of_week == orig_day,
                TimetableEntry.period_index == orig_period,
                TimetableEntry.course_id == orig_course,
                TimetableEntry.faculty_id == orig_faculty,
                TimetableEntry.batch_id == orig_batch,
            )
        )

    course = db.get(Course, orig_course)
    batch = db.get(Batch, orig_batch)
    if target_entry:
        db.delete(target_entry)

    if publish_immediately and course and batch:
        db.add(
            Notification(
                department_id=dept_id,
                target_role="ALL",
                title=f"Class Removed (v{target_version.version_number})",
                message=f"Removed {course.code} for {batch.name} from {orig_day} P{orig_period}.",
                category="TIMETABLE_UPDATE",
            )
        )

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="TIMETABLE_ENTRY_DELETED",
            entity_type="TimetableEntry",
            entity_id=entry_id,
            details=f"Version v{target_version.version_number} {orig_day} P{orig_period}",
        )
    )
    db.commit()
    return {"status": "deleted", "version_number": target_version.version_number}


@router.post("/publish", response_model=TimetableVersionOut)
def publish_draft_timetable(
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> TimetableVersionOut:
    dept_id = _resolve_department_id(current_user, None)
    draft = db.scalar(
        select(TimetableVersion)
        .where(TimetableVersion.department_id == dept_id, TimetableVersion.status == "DRAFT")
        .order_by(desc(TimetableVersion.version_number))
        .limit(1)
    )
    if not draft:
        published = _get_latest_published_version(db, dept_id)
        if not published:
            raise HTTPException(status_code=404, detail="No timetable version available to publish.")
        return TimetableVersionOut.model_validate(published)

    prev_published = _get_latest_published_version(db, dept_id)
    if prev_published:
        prev_published.status = "ARCHIVED"

    draft.status = "PUBLISHED"
    draft.published_at = datetime.now(timezone.utc)
    db.add(
        Notification(
            department_id=dept_id,
            target_role="ALL",
            title=f"Timetable v{draft.version_number} Published",
            message="Department Admin published an updated official timetable.",
            category="TIMETABLE_UPDATE",
        )
    )
    db.commit()
    db.refresh(draft)
    return TimetableVersionOut.model_validate(draft)
