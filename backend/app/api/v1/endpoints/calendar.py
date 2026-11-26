from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
import json

from app.api.deps import get_current_user, require_department_access, require_roles
from app.db.base import get_db
from app.models.scheduling import (
    AuditLog,
    DepartmentOperatingDay,
    SchedulePeriod,
    TimeSlot,
    TimetableEntry,
    TimetableVersion,
    User,
)
from app.schemas.calendar import (
    DepartmentScheduleIn,
    DepartmentScheduleOut,
    OperatingDayOut,
    SchedulePeriodOut,
)

router = APIRouter(prefix="/calendar", tags=["Academic Calendar"])
DAYS = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")


def _minutes(value: str) -> int:
    hours, minutes = (int(part) for part in value[:5].split(":"))
    return hours * 60 + minutes


def _published_schedule_impact(db: Session, department_id: str, payload: DepartmentScheduleIn) -> list[dict[str, str]]:
    days = {day.day_of_week: day for day in payload.operating_days}
    blocked = {
        day: [period for period in payload.periods if period.day_of_week == day and (not period.enabled or period.period_type != "TEACHING")]
        for day in DAYS
    }
    slots = db.scalars(select(TimeSlot).where(TimeSlot.department_id == department_id)).all()
    slot_by_index = {slot.period_index: slot for slot in slots}
    entries = db.scalars(
        select(TimetableEntry)
        .join(TimetableVersion, TimetableVersion.id == TimetableEntry.version_id)
        .where(TimetableEntry.department_id == department_id, TimetableVersion.status == "PUBLISHED")
    ).all()
    impacted: list[dict[str, str]] = []
    for entry in entries:
        start, end = entry.start_time, entry.end_time
        if not start or not end:
            first = slot_by_index.get(entry.period_index)
            last = slot_by_index.get(entry.period_index + entry.duration_periods - 1)
            if not first or not last:
                continue
            start, end = first.start_time[:5], last.end_time[:5]
        interval_start, interval_end = _minutes(start), _minutes(end)
        day = days[entry.day_of_week]
        reason = ""
        if not day.is_open:
            reason = "day would be closed"
        elif interval_start < _minutes(day.opening_time) or interval_end > _minutes(day.closing_time):
            reason = "outside the proposed operating window"
        else:
            for period in blocked[entry.day_of_week]:
                if interval_start < _minutes(period.end_time) and _minutes(period.start_time) < interval_end:
                    reason = f"overlaps {period.period_type.lower()} '{period.name}'"
                    break
        if reason:
            impacted.append({
                "entry_id": entry.id,
                "day_of_week": entry.day_of_week,
                "interval": f"{start}–{end}",
                "reason": reason,
            })
    return impacted


def _department_id(user: User, requested: str | None, db: Session) -> str:
    if user.role == "SUPER_ADMIN":
        if not requested:
            raise HTTPException(status_code=422, detail="department_id is required for a Super Admin.")
        require_department_access(requested, user, db)
        return requested
    if not user.department_id:
        raise HTTPException(status_code=403, detail="Your account is not assigned to a department.")
    if requested and requested != user.department_id:
        raise HTTPException(status_code=403, detail="You cannot access another department's schedule.")
    return user.department_id


def _legacy_default(db: Session, department_id: str) -> DepartmentScheduleOut:
    """Expose legacy slots as a read-only initial configuration until an admin saves the new model."""
    slots = db.scalars(
        select(TimeSlot).where(TimeSlot.department_id == department_id).order_by(TimeSlot.period_index)
    ).all()
    if slots:
        opening, closing = slots[0].start_time[:5], slots[-1].end_time[:5]
    else:
        opening = closing = "00:00"
    is_open = bool(slots)
    operating_days = [
        OperatingDayOut(
            id=f"legacy-{day}", day_of_week=day, is_open=is_open and day != "SUN",
            opening_time=opening, closing_time=closing,
        )
        for day in DAYS
    ]
    periods = [
        SchedulePeriodOut(
            id=f"legacy-{day}-{slot.id}", day_of_week=day, name=slot.label,
            start_time=slot.start_time[:5], end_time=slot.end_time[:5],
            period_type=("LUNCH" if "lunch" in slot.label.lower() else "BREAK") if slot.is_break else "TEACHING", enabled=True,
            sort_order=slot.period_index,
        )
        for day in DAYS if day != "SUN" and slots
        for slot in slots
    ]
    return DepartmentScheduleOut(department_id=department_id, operating_days=operating_days, periods=periods)


@router.get("/schedule", response_model=DepartmentScheduleOut)
def get_department_schedule(
    department_id: str | None = Query(default=None),
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> DepartmentScheduleOut:
    dept_id = _department_id(current_user, department_id, db)
    days = db.scalars(
        select(DepartmentOperatingDay).where(DepartmentOperatingDay.department_id == dept_id)
    ).all()
    periods = db.scalars(
        select(SchedulePeriod).where(SchedulePeriod.department_id == dept_id)
        .order_by(SchedulePeriod.day_of_week, SchedulePeriod.sort_order)
    ).all()
    if not days:
        return _legacy_default(db, dept_id)
    day_by_name = {day.day_of_week: day for day in days}
    ordered_days = [day_by_name[d] for d in DAYS if d in day_by_name]
    return DepartmentScheduleOut(
        department_id=dept_id,
        operating_days=[OperatingDayOut.model_validate(row, from_attributes=True) for row in ordered_days],
        periods=[SchedulePeriodOut.model_validate(row, from_attributes=True) for row in periods],
    )


@router.put("/schedule", response_model=DepartmentScheduleOut)
def save_department_schedule(
    payload: DepartmentScheduleIn,
    department_id: str | None = Query(default=None),
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> DepartmentScheduleOut:
    dept_id = _department_id(current_user, department_id, db)
    impacted = _published_schedule_impact(db, dept_id, payload)
    if impacted:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "This change would invalidate published classes. Move or remove the affected sessions before saving the new hours or breaks.",
                "affected_sessions": impacted,
            },
        )
    db.execute(delete(SchedulePeriod).where(SchedulePeriod.department_id == dept_id))
    db.execute(delete(DepartmentOperatingDay).where(DepartmentOperatingDay.department_id == dept_id))
    day_rows = [
        DepartmentOperatingDay(department_id=dept_id, **day.model_dump()) for day in payload.operating_days
    ]
    period_rows = [SchedulePeriod(department_id=dept_id, **period.model_dump()) for period in payload.periods]
    db.add_all(day_rows + period_rows)
    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=current_user.role,
        action="DEPARTMENT_SCHEDULE_UPDATED",
        module="SCHEDULING",
        entity_type="DepartmentSchedule",
        entity_id=dept_id,
        details=json.dumps({"operating_days": len(day_rows), "periods": len(period_rows)}),
    ))
    db.commit()
    for row in day_rows + period_rows:
        db.refresh(row)
    return DepartmentScheduleOut(
        department_id=dept_id,
        operating_days=[OperatingDayOut.model_validate(row, from_attributes=True) for row in day_rows],
        periods=[SchedulePeriodOut.model_validate(row, from_attributes=True) for row in sorted(period_rows, key=lambda p: (p.day_of_week, p.sort_order))],
    )
