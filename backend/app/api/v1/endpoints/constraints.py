import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.api.v1.endpoints.calendar import _department_id
from app.db.base import get_db
from app.models.scheduling import AuditLog, DepartmentSoftConstraint, User
from app.schemas.constraints import (
    ConstraintConfigurationIn,
    ConstraintConfigurationOut,
    HardConstraintStatus,
    SOFT_CONSTRAINTS,
    SoftConstraintSetting,
)

router = APIRouter(prefix="/constraints", tags=["Scheduling Constraints"])
DEFAULT_WEIGHT = 50

HARD_STATUS = [
    HardConstraintStatus(key="faculty_clash", label="Faculty cannot teach overlapping sessions", status="ENFORCED", explanation="Manual timetable writes reject overlapping sessions for the same faculty member."),
    HardConstraintStatus(key="room_clash", label="A room cannot host overlapping sessions", status="ENFORCED", explanation="Manual timetable writes reject overlapping room bookings."),
    HardConstraintStatus(key="batch_clash", label="A batch cannot attend overlapping sessions", status="ENFORCED", explanation="Manual timetable writes reject overlapping sessions for the same batch."),
    HardConstraintStatus(key="room_capacity", label="Room capacity must fit batch strength", status="ENFORCED", explanation="The selected room must fit the batch's configured student strength."),
    HardConstraintStatus(key="lab_compatibility", label="Practical sessions require a laboratory", status="ENFORCED", explanation="Practical sessions cannot be placed in a standard classroom."),
    HardConstraintStatus(key="faculty_weekly_hours", label="Faculty weekly teaching-hour limit", status="ENFORCED", explanation="Manual edits are rejected when a faculty member would exceed their configured weekly limit."),
    HardConstraintStatus(key="operating_hours", label="Sessions fit configured operating hours", status="ENFORCED", explanation="Exact intervals are validated against the selected weekday's opening window."),
    HardConstraintStatus(key="breaks", label="Breaks and blocked periods remain unavailable", status="ENFORCED", explanation="Sessions overlapping breaks, lunch, or disabled periods are rejected."),
    HardConstraintStatus(key="faculty_qualification", label="Faculty eligibility matches selected courses", status="PARTIAL", explanation="Explicit faculty-to-course eligibility is checked. Qualification requirements on course records are not yet modeled."),
    HardConstraintStatus(key="faculty_availability", label="Faculty availability windows", status="ENFORCED", explanation="Faculty working weekdays and explicitly unavailable intervals are checked before a timetable edit is saved."),
    HardConstraintStatus(key="room_availability", label="Room availability windows", status="NOT_IMPLEMENTED", explanation="Per-room availability rules are not yet modeled."),
    HardConstraintStatus(key="holidays", label="Academic holidays block teaching", status="NOT_IMPLEMENTED", explanation="Holiday data is not yet integrated with timetable validation."),
    HardConstraintStatus(key="required_sessions", label="Required sessions are all scheduled", status="NOT_IMPLEMENTED", explanation="Course assignments and required-session records are not yet connected to a solver."),
]


def _settings(db: Session, department_id: str) -> list[SoftConstraintSetting]:
    rows = db.scalars(select(DepartmentSoftConstraint).where(
        DepartmentSoftConstraint.department_id == department_id
    )).all()
    by_key = {row.key: row for row in rows}
    return [
        SoftConstraintSetting(
            key=key,
            label=label,
            enabled=by_key[key].enabled if key in by_key else True,
            weight=by_key[key].weight if key in by_key else DEFAULT_WEIGHT,
        )
        for key, label in SOFT_CONSTRAINTS.items()
    ]


@router.get("", response_model=ConstraintConfigurationOut)
def get_constraints(
    department_id: str | None = Query(default=None),
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> ConstraintConfigurationOut:
    dept_id = _department_id(current_user, department_id, db)
    return ConstraintConfigurationOut(
        department_id=dept_id,
        hard_constraints=HARD_STATUS,
        soft_constraints=_settings(db, dept_id),
    )


@router.put("", response_model=ConstraintConfigurationOut)
def save_constraints(
    payload: ConstraintConfigurationIn,
    department_id: str | None = Query(default=None),
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> ConstraintConfigurationOut:
    dept_id = _department_id(current_user, department_id, db)
    db.execute(delete(DepartmentSoftConstraint).where(DepartmentSoftConstraint.department_id == dept_id))
    rows = [DepartmentSoftConstraint(department_id=dept_id, **item.model_dump()) for item in payload.soft_constraints]
    db.add_all(rows)
    db.add(AuditLog(
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=current_user.role,
        action="SCHEDULING_CONSTRAINTS_UPDATED",
        module="SCHEDULING",
        entity_type="DepartmentConstraints",
        entity_id=dept_id,
        details=json.dumps({"soft_constraints": len(rows)}),
    ))
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not save scheduling preferences.") from exc
    return ConstraintConfigurationOut(
        department_id=dept_id,
        hard_constraints=HARD_STATUS,
        soft_constraints=_settings(db, dept_id),
    )
