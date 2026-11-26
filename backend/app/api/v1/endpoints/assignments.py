from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
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
    Faculty,
    FacultyCourseEligibility,
    User,
)
from app.schemas.courses import CourseAssignmentIn, CourseAssignmentOut, CourseAssignmentPage, CourseAssignmentUpdate

router = APIRouter(prefix="/assignments", tags=["Course Assignments"])


def _validate_assignment(db: Session, department_id: str, payload: CourseAssignmentIn) -> tuple[Course, Faculty, Batch, str]:
    course = db.get(Course, payload.course_id)
    faculty = db.get(Faculty, payload.faculty_id)
    batch = db.get(Batch, payload.batch_id)
    if not course or course.department_id != department_id or not course.is_active:
        raise HTTPException(status_code=422, detail="Select an active course in this department.")
    if not faculty or faculty.department_id != department_id or not faculty.is_active:
        raise HTTPException(status_code=422, detail="Select an active faculty member in this department.")
    if not batch or batch.department_id != department_id:
        raise HTTPException(status_code=422, detail="Select a student batch in this department.")
    if course.semester != batch.semester:
        raise HTTPException(status_code=422, detail="Course and batch semesters must match.")

    eligible_batches = db.scalars(select(CourseBatchEligibility.batch_id).where(
        CourseBatchEligibility.course_id == course.id,
    )).all()
    if eligible_batches and batch.id not in eligible_batches:
        raise HTTPException(status_code=422, detail="This batch is not eligible for the selected course.")
    eligible_courses = db.scalars(select(FacultyCourseEligibility.course_id).where(
        FacultyCourseEligibility.faculty_id == faculty.id,
    )).all()
    if eligible_courses and course.id not in eligible_courses:
        raise HTTPException(status_code=422, detail="This faculty member is not eligible for the selected course.")
    if course.required_qualification and course.required_qualification.casefold() not in faculty.qualifications.casefold():
        raise HTTPException(status_code=422, detail="Faculty qualifications do not match this course's requirement.")

    course_room_type = course.required_room_type
    if course.course_type == "PRACTICAL":
        course_room_type = "LAB"
    requested_room_type = payload.required_room_type
    if course_room_type != "ANY" and requested_room_type not in ("ANY", course_room_type):
        raise HTTPException(status_code=422, detail="Assignment room type conflicts with the course room requirement.")
    resolved_room_type = course_room_type if requested_room_type == "ANY" else requested_room_type
    return course, faculty, batch, resolved_room_type


def _assignment_out(db: Session, assignment: CourseAssignment) -> CourseAssignmentOut:
    course = db.get(Course, assignment.course_id)
    faculty = db.get(Faculty, assignment.faculty_id)
    batch = db.get(Batch, assignment.batch_id)
    return CourseAssignmentOut(
        id=assignment.id,
        course_id=assignment.course_id,
        course_code=course.code if course else "",
        course_name=course.name if course else "",
        faculty_id=assignment.faculty_id,
        faculty_name=faculty.name if faculty else "",
        batch_id=assignment.batch_id,
        batch_name=batch.name if batch else "",
        weekly_session_count=assignment.weekly_session_count,
        duration_minutes=assignment.duration_minutes,
        required_room_type=assignment.required_room_type,
        status=assignment.status,
    )


def _audit(db: Session, user: User, action: str, assignment: CourseAssignment) -> None:
    db.add(AuditLog(
        user_id=user.id,
        user_name=user.full_name,
        user_role=user.role,
        action=action,
        module="ASSIGNMENTS",
        entity_type="CourseAssignment",
        entity_id=assignment.id,
        details=f"course={assignment.course_id}, faculty={assignment.faculty_id}, batch={assignment.batch_id}",
    ))


@router.get("", response_model=CourseAssignmentPage)
def list_assignments(
    q: str | None = Query(default=None, max_length=100),
    assignment_status: str | None = Query(default=None, alias="status", pattern="^(ACTIVE|INACTIVE)$"),
    course_id: str | None = Query(default=None),
    faculty_id: str | None = Query(default=None),
    batch_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    department_id: str | None = Query(default=None),
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> CourseAssignmentPage:
    dept_id = _department_id(current_user, department_id, db)
    query = select(CourseAssignment).where(CourseAssignment.department_id == dept_id)
    count_query = select(func.count(CourseAssignment.id)).where(CourseAssignment.department_id == dept_id)
    if assignment_status:
        query = query.where(CourseAssignment.status == assignment_status)
        count_query = count_query.where(CourseAssignment.status == assignment_status)
    if course_id:
        query = query.where(CourseAssignment.course_id == course_id)
        count_query = count_query.where(CourseAssignment.course_id == course_id)
    if faculty_id:
        query = query.where(CourseAssignment.faculty_id == faculty_id)
        count_query = count_query.where(CourseAssignment.faculty_id == faculty_id)
    if batch_id:
        query = query.where(CourseAssignment.batch_id == batch_id)
        count_query = count_query.where(CourseAssignment.batch_id == batch_id)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        ids = select(Course.id).where(Course.department_id == dept_id, Course.name.ilike(pattern) | Course.code.ilike(pattern))
        faculty_ids = select(Faculty.id).where(Faculty.department_id == dept_id, Faculty.name.ilike(pattern))
        batch_ids = select(Batch.id).where(Batch.department_id == dept_id, Batch.name.ilike(pattern))
        search = (CourseAssignment.course_id.in_(ids) | CourseAssignment.faculty_id.in_(faculty_ids) | CourseAssignment.batch_id.in_(batch_ids))
        query = query.where(search)
        count_query = count_query.where(search)
    total = db.scalar(count_query) or 0
    rows = db.scalars(query.order_by(CourseAssignment.created_at.desc()).limit(limit).offset(offset)).all()
    return CourseAssignmentPage(items=[_assignment_out(db, row) for row in rows], total=total, limit=limit, offset=offset)


@router.post("", response_model=CourseAssignmentOut, status_code=status.HTTP_201_CREATED)
def create_assignment(
    payload: CourseAssignmentIn,
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> CourseAssignmentOut:
    dept_id = _department_id(current_user, None, db)
    _course, _faculty, _batch, room_type = _validate_assignment(db, dept_id, payload)
    assignment = CourseAssignment(department_id=dept_id)
    db.add(assignment)
    assignment.course_id = payload.course_id
    assignment.faculty_id = payload.faculty_id
    assignment.batch_id = payload.batch_id
    assignment.weekly_session_count = payload.weekly_session_count
    assignment.duration_minutes = payload.duration_minutes
    assignment.required_room_type = room_type
    assignment.status = payload.status
    try:
        db.flush()
        _audit(db, current_user, "COURSE_ASSIGNMENT_CREATED", assignment)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This course, faculty and batch assignment already exists.") from exc
    db.refresh(assignment)
    return _assignment_out(db, assignment)


@router.put("/{assignment_id}", response_model=CourseAssignmentOut)
def update_assignment(
    assignment_id: str,
    payload: CourseAssignmentUpdate,
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> CourseAssignmentOut:
    dept_id = _department_id(current_user, None, db)
    assignment = db.get(CourseAssignment, assignment_id)
    if not assignment or assignment.department_id != dept_id:
        raise HTTPException(status_code=404, detail="Course assignment not found.")
    _course, _faculty, _batch, room_type = _validate_assignment(db, dept_id, payload)
    assignment.course_id = payload.course_id
    assignment.faculty_id = payload.faculty_id
    assignment.batch_id = payload.batch_id
    assignment.weekly_session_count = payload.weekly_session_count
    assignment.duration_minutes = payload.duration_minutes
    assignment.required_room_type = room_type
    assignment.status = payload.status
    try:
        _audit(db, current_user, "COURSE_ASSIGNMENT_UPDATED", assignment)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This course, faculty and batch assignment already exists.") from exc
    db.refresh(assignment)
    return _assignment_out(db, assignment)


@router.delete("/{assignment_id}", response_model=CourseAssignmentOut)
def deactivate_assignment(
    assignment_id: str,
    current_user: User = Depends(require_roles("DEPT_ADMIN", "SUPER_ADMIN")),
    db: Session = Depends(get_db),
) -> CourseAssignmentOut:
    dept_id = _department_id(current_user, None, db)
    assignment = db.get(CourseAssignment, assignment_id)
    if not assignment or assignment.department_id != dept_id:
        raise HTTPException(status_code=404, detail="Course assignment not found.")
    assignment.status = "INACTIVE"
    _audit(db, current_user, "COURSE_ASSIGNMENT_DEACTIVATED", assignment)
    db.commit()
    db.refresh(assignment)
    return _assignment_out(db, assignment)
