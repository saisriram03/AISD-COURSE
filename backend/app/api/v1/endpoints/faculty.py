from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.api.v1.endpoints.calendar import _department_id
from app.db.base import get_db
from app.models.scheduling import (
    AuditLog,
    Course,
    Faculty,
    FacultyAvailability,
    FacultyCourseEligibility,
    User,
)
from app.schemas.faculty import FacultyAvailabilityIn, FacultyCreate, FacultyOut, FacultyPage, FacultyUpdate

router = APIRouter(prefix="/faculty", tags=["Faculty Management"])


def _faculty_out(db: Session, faculty: Faculty) -> FacultyOut:
    eligibility = db.scalars(select(FacultyCourseEligibility.course_id).where(
        FacultyCourseEligibility.faculty_id == faculty.id
    )).all()
    availability = db.scalars(select(FacultyAvailability).where(
        FacultyAvailability.faculty_id == faculty.id
    ).order_by(FacultyAvailability.day_of_week, FacultyAvailability.start_time)).all()
    return FacultyOut(
        id=faculty.id,
        employee_code=faculty.employee_code,
        name=faculty.name,
        email=faculty.email,
        phone_number=faculty.phone_number,
        designation=faculty.designation,
        qualifications=faculty.qualifications,
        eligible_course_ids=list(eligibility),
        max_weekly_hours=faculty.max_weekly_hours,
        working_days=[day for day in faculty.working_days.split(",") if day],
        availability=[FacultyAvailabilityIn.model_validate(row, from_attributes=True) for row in availability],
        is_active=faculty.is_active,
    )


def _validate_courses(db: Session, department_id: str, course_ids: list[str]) -> None:
    if not course_ids:
        return
    found = set(db.scalars(select(Course.id).where(
        Course.department_id == department_id,
        Course.id.in_(course_ids),
    )).all())
    if found != set(course_ids):
        raise HTTPException(status_code=422, detail="Eligible courses must belong to this department.")


def _validate_unique_profile(
    db: Session,
    department_id: str,
    payload: FacultyCreate | FacultyUpdate,
    exclude_id: str | None = None,
) -> None:
    match = db.scalar(select(Faculty.id).where(or_(
        Faculty.employee_code == payload.employee_code,
        and_(Faculty.department_id == department_id, func.lower(Faculty.email) == str(payload.email).lower()),
    )))
    if match and match != exclude_id:
        raise HTTPException(status_code=409, detail="Employee code or faculty email is already in use.")


def _replace_availability(db: Session, faculty_id: str, availability: list[FacultyAvailabilityIn]) -> None:
    db.query(FacultyAvailability).filter(FacultyAvailability.faculty_id == faculty_id).delete(synchronize_session=False)
    db.add_all([
        FacultyAvailability(faculty_id=faculty_id, **item.model_dump())
        for item in availability
    ])


def _write_audit(db: Session, user: User, action: str, faculty: Faculty) -> None:
    db.add(AuditLog(
        user_id=user.id,
        user_name=user.full_name,
        user_role=user.role,
        action=action,
        module="FACULTY",
        entity_type="Faculty",
        entity_id=faculty.id,
        details=f"{faculty.employee_code}: {faculty.name}",
    ))


def _apply_payload(db: Session, department_id: str, faculty: Faculty, payload: FacultyCreate | FacultyUpdate) -> None:
    faculty.employee_code = payload.employee_code
    faculty.name = payload.name.strip()
    faculty.email = str(payload.email)
    faculty.phone_number = payload.phone_number.strip()
    faculty.designation = payload.designation.strip()
    faculty.qualifications = payload.qualifications.strip()
    faculty.max_weekly_hours = payload.max_weekly_hours
    faculty.working_days = ",".join(payload.working_days)
    if isinstance(payload, FacultyUpdate):
        faculty.is_active = payload.is_active
    _validate_courses(db, department_id, payload.eligible_course_ids)
    db.flush()
    db.query(FacultyCourseEligibility).filter(FacultyCourseEligibility.faculty_id == faculty.id).delete(synchronize_session=False)
    db.add_all([
        FacultyCourseEligibility(faculty_id=faculty.id, course_id=course_id)
        for course_id in payload.eligible_course_ids
    ])
    _replace_availability(db, faculty.id, payload.availability)


@router.get("", response_model=FacultyPage)
def list_faculty(
    q: str | None = Query(default=None, max_length=100),
    active: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    department_id: str | None = Query(default=None),
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> FacultyPage:
    dept_id = _department_id(current_user, department_id, db)
    query = select(Faculty).where(Faculty.department_id == dept_id)
    count_query = select(func.count(Faculty.id)).where(Faculty.department_id == dept_id)
    if active is not None:
        query = query.where(Faculty.is_active.is_(active))
        count_query = count_query.where(Faculty.is_active.is_(active))
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        search_filter = or_(Faculty.name.ilike(pattern), Faculty.employee_code.ilike(pattern), Faculty.email.ilike(pattern))
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    total = db.scalar(count_query) or 0
    rows = db.scalars(query.order_by(Faculty.name).limit(limit).offset(offset)).all()
    return FacultyPage(items=[_faculty_out(db, row) for row in rows], total=total, limit=limit, offset=offset)


@router.post("", response_model=FacultyOut, status_code=status.HTTP_201_CREATED)
def create_faculty(
    payload: FacultyCreate,
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> FacultyOut:
    dept_id = _department_id(current_user, None, db)
    _validate_unique_profile(db, dept_id, payload)
    faculty = Faculty(department_id=dept_id)
    db.add(faculty)
    try:
        _apply_payload(db, dept_id, faculty, payload)
        _write_audit(db, current_user, "FACULTY_CREATED", faculty)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Employee code or faculty profile already exists.") from exc
    db.refresh(faculty)
    return _faculty_out(db, faculty)


@router.put("/{faculty_id}", response_model=FacultyOut)
def update_faculty(
    faculty_id: str,
    payload: FacultyUpdate,
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> FacultyOut:
    dept_id = _department_id(current_user, None, db)
    faculty = db.get(Faculty, faculty_id)
    if not faculty or faculty.department_id != dept_id:
        raise HTTPException(status_code=404, detail="Faculty member not found.")
    _validate_unique_profile(db, dept_id, payload, exclude_id=faculty.id)
    try:
        _apply_payload(db, dept_id, faculty, payload)
        _write_audit(db, current_user, "FACULTY_UPDATED", faculty)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Employee code or faculty profile already exists.") from exc
    db.refresh(faculty)
    return _faculty_out(db, faculty)


@router.delete("/{faculty_id}", response_model=FacultyOut)
def deactivate_faculty(
    faculty_id: str,
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> FacultyOut:
    dept_id = _department_id(current_user, None, db)
    faculty = db.get(Faculty, faculty_id)
    if not faculty or faculty.department_id != dept_id:
        raise HTTPException(status_code=404, detail="Faculty member not found.")
    faculty.is_active = False
    _write_audit(db, current_user, "FACULTY_DEACTIVATED", faculty)
    db.commit()
    db.refresh(faculty)
    return _faculty_out(db, faculty)
