import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.api.v1.endpoints.calendar import _department_id
from app.db.base import get_db
from app.models.scheduling import (
    AuditLog,
    Batch,
    Course,
    CourseAssignment,
    CourseBatchEligibility,
    User,
)
from app.schemas.courses import CourseCreate, CourseOut, CoursePage, CourseUpdate

router = APIRouter(prefix="/courses", tags=["Courses"])


def _equipment(value: str) -> list[str]:
    if not value:
        return []
    try:
        data = json.loads(value)
        if isinstance(data, list):
            return [str(item) for item in data]
    except json.JSONDecodeError:
        pass
    return [item.strip() for item in value.split(",") if item.strip()]


def _course_out(db: Session, course: Course) -> CourseOut:
    batch_ids = db.scalars(select(CourseBatchEligibility.batch_id).where(
        CourseBatchEligibility.course_id == course.id
    )).all()
    return CourseOut(
        id=course.id,
        code=course.code,
        name=course.name,
        semester=course.semester,
        course_type=course.course_type,
        weekly_hours=course.weekly_hours,
        session_duration_minutes=course.session_duration_minutes or course.session_duration * 60,
        required_qualification=course.required_qualification,
        required_room_type=course.required_room_type,
        required_equipment=_equipment(course.required_equipment),
        eligible_batch_ids=list(batch_ids),
        color_token=course.color_token,
        is_active=course.is_active,
    )


def _validate_batch_ids(db: Session, department_id: str, batch_ids: list[str]) -> None:
    if not batch_ids:
        return
    found = set(db.scalars(select(Batch.id).where(
        Batch.department_id == department_id,
        Batch.id.in_(batch_ids),
    )).all())
    if found != set(batch_ids):
        raise HTTPException(status_code=422, detail="Eligible batches must belong to this department.")


def _write_audit(db: Session, user: User, action: str, course: Course) -> None:
    db.add(AuditLog(
        user_id=user.id,
        user_name=user.full_name,
        user_role=user.role,
        action=action,
        module="COURSES",
        entity_type="Course",
        entity_id=course.id,
        details=f"{course.code}: {course.name}",
    ))


def _apply(db: Session, dept_id: str, course: Course, payload: CourseCreate | CourseUpdate) -> None:
    course.code = payload.code
    course.name = payload.name.strip()
    course.semester = payload.semester
    course.course_type = payload.course_type
    course.weekly_hours = payload.weekly_hours
    course.session_duration_minutes = payload.session_duration_minutes
    course.session_duration = max(1, round(payload.session_duration_minutes / 60))
    course.required_qualification = payload.required_qualification.strip()
    course.required_room_type = payload.required_room_type
    course.required_equipment = json.dumps(payload.required_equipment)
    course.color_token = payload.color_token
    if isinstance(payload, CourseUpdate):
        course.is_active = payload.is_active
    db.flush()
    _validate_batch_ids(db, dept_id, payload.eligible_batch_ids)
    active_assignments = db.scalars(select(CourseAssignment).where(
        CourseAssignment.course_id == course.id,
        CourseAssignment.status == "ACTIVE",
    )).all()
    if payload.eligible_batch_ids:
        invalid = [item.batch_id for item in active_assignments if item.batch_id not in payload.eligible_batch_ids]
        if invalid:
            raise HTTPException(status_code=409, detail="Course eligibility cannot exclude batches with active assignments.")
    db.query(CourseBatchEligibility).filter(CourseBatchEligibility.course_id == course.id).delete(synchronize_session=False)
    db.add_all([
        CourseBatchEligibility(course_id=course.id, batch_id=batch_id)
        for batch_id in payload.eligible_batch_ids
    ])


@router.get("", response_model=CoursePage)
def list_courses(
    q: str | None = Query(default=None, max_length=100),
    active: bool | None = Query(default=None),
    semester: int | None = Query(default=None, ge=1, le=20),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    department_id: str | None = Query(default=None),
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> CoursePage:
    dept_id = _department_id(current_user, department_id, db)
    query = select(Course).where(Course.department_id == dept_id)
    count_query = select(func.count(Course.id)).where(Course.department_id == dept_id)
    if active is not None:
        query = query.where(Course.is_active.is_(active))
        count_query = count_query.where(Course.is_active.is_(active))
    if semester is not None:
        query = query.where(Course.semester == semester)
        count_query = count_query.where(Course.semester == semester)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        search_filter = or_(Course.code.ilike(pattern), Course.name.ilike(pattern))
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    total = db.scalar(count_query) or 0
    rows = db.scalars(query.order_by(Course.semester, Course.code).limit(limit).offset(offset)).all()
    return CoursePage(items=[_course_out(db, row) for row in rows], total=total, limit=limit, offset=offset)


@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> CourseOut:
    dept_id = _department_id(current_user, None, db)
    course = Course(department_id=dept_id)
    db.add(course)
    try:
        _apply(db, dept_id, course, payload)
        _write_audit(db, current_user, "COURSE_CREATED", course)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A course with this code already exists in the department.") from exc
    db.refresh(course)
    return _course_out(db, course)


@router.put("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: str,
    payload: CourseUpdate,
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> CourseOut:
    dept_id = _department_id(current_user, None, db)
    course = db.get(Course, course_id)
    if not course or course.department_id != dept_id:
        raise HTTPException(status_code=404, detail="Course not found.")
    try:
        _apply(db, dept_id, course, payload)
        _write_audit(db, current_user, "COURSE_UPDATED", course)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A course with this code already exists in the department.") from exc
    db.refresh(course)
    return _course_out(db, course)


@router.delete("/{course_id}", response_model=CourseOut)
def deactivate_course(
    course_id: str,
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> CourseOut:
    dept_id = _department_id(current_user, None, db)
    course = db.get(Course, course_id)
    if not course or course.department_id != dept_id:
        raise HTTPException(status_code=404, detail="Course not found.")
    course.is_active = False
    _write_audit(db, current_user, "COURSE_DEACTIVATED", course)
    db.commit()
    db.refresh(course)
    return _course_out(db, course)
