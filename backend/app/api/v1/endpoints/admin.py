import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    require_department_access,
    require_department_admin,
    require_super_admin,
)
from app.core.security import hash_password
from app.db.base import get_db
from app.models.scheduling import (
    AuditLog,
    Batch,
    Course,
    Department,
    Faculty,
    Room,
    Student,
    TimetableEntry,
    TimetableVersion,
    University,
    User,
    UserRoleAssignment,
)
from app.schemas.scheduling import (
    AdminUserCreate,
    AuditLogOut,
    DepartmentCreate,
    DepartmentOut,
    DeptAnalyticsOut,
    UniversityAnalyticsOut,
    UserOut,
    UserStatusUpdate,
)

router = APIRouter(prefix="/admin", tags=["Role & Administration Management"])


def _serialize_user(db: Session, user: User) -> UserOut:
    univ = db.get(University, user.university_id)
    dept = db.get(Department, user.department_id) if user.department_id else None
    batch = db.get(Batch, user.batch_id) if user.batch_id else None

    return UserOut(
        id=user.id,
        email=user.email,
        fullName=user.full_name,
        role=user.role,  # type: ignore[arg-type]
        universityId=user.university_id,
        universityName=univ.name if univ else "Bharat Institute of Technology & Sciences",
        departmentId=user.department_id,
        departmentName=dept.name if dept else None,
        facultyId=user.faculty_id,
        batchId=user.batch_id,
        batchLabel=batch.name if batch else None,
        isActive=user.is_active,
        avatarInitials=user.avatar_initials,
    )


def _log_audit(
    db: Session,
    user_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: dict,
) -> None:
    audit = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=json.dumps(details),
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)
    db.commit()


# ==========================================
# 1. SUPER ADMIN ENDPOINTS
# ==========================================


@router.get("/analytics", response_model=UniversityAnalyticsOut)
def get_university_analytics(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> UniversityAnalyticsOut:
    total_depts = db.scalar(
        select(func.count(Department.id)).where(Department.university_id == current_user.university_id)
    ) or 0
    total_fac = db.scalar(select(func.count(Faculty.id))) or 0
    total_stu = db.scalar(select(func.count(Student.id))) or 0
    total_rooms = db.scalar(select(func.count(Room.id))) or 0
    total_versions = db.scalar(
        select(func.count(TimetableVersion.id)).where(TimetableVersion.status == "PUBLISHED")
    ) or 0
    active_users = db.scalar(
        select(func.count(User.id)).where(
            User.university_id == current_user.university_id,
            User.is_active.is_(True),
        )
    ) or 0

    return UniversityAnalyticsOut(
        total_departments=total_depts,
        total_faculty=total_fac,
        total_students=total_stu,
        total_rooms=total_rooms,
        total_published_timetables=total_versions,
        active_users=active_users,
    )


@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[DepartmentOut]:
    departments = db.scalars(
        select(Department)
        .where(Department.university_id == current_user.university_id)
        .order_by(Department.name)
    ).all()
    return [DepartmentOut.model_validate(d) for d in departments]


@router.post("/departments", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> DepartmentOut:
    existing = db.scalar(
        select(Department).where(
            Department.university_id == current_user.university_id,
            Department.code == payload.code.upper().strip(),
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Department with code '{payload.code}' already exists.",
        )

    dept = Department(
        university_id=current_user.university_id,
        name=payload.name.strip(),
        code=payload.code.upper().strip(),
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)

    _log_audit(
        db,
        user_id=current_user.id,
        action="CREATE_DEPARTMENT",
        entity_type="Department",
        entity_id=dept.id,
        details={"name": dept.name, "code": dept.code},
    )

    return DepartmentOut.model_validate(dept)


@router.get("/users", response_model=list[UserOut])
def list_users(
    role: str | None = Query(None, description="Filter by role: SUPER_ADMIN, DEPT_ADMIN, FACULTY, STUDENT"),
    department_id: str | None = Query(None, description="Filter by department"),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    stmt = select(User).where(User.university_id == current_user.university_id)
    if role:
        stmt = stmt.where(User.role == role)
    if department_id:
        stmt = stmt.where(User.department_id == department_id)

    stmt = stmt.order_by(desc(User.created_at))
    users = db.scalars(stmt).all()
    return [_serialize_user(db, u) for u in users]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user_as_super_admin(
    payload: AdminUserCreate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    """Super Admin provisions a new account (e.g., Department Admin, Faculty, Student) and assigns scope."""
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )

    if payload.department_id:
        dept = db.get(Department, payload.department_id)
        if not dept or dept.university_id != current_user.university_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid department assigned.",
            )

    parts = [p for p in payload.full_name.strip().split() if p]
    initials = ((parts[0][0] if parts else "U") + (parts[-1][0] if len(parts) > 1 else "S")).upper()

    user = User(
        email=payload.email,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        university_id=current_user.university_id,
        department_id=payload.department_id,
        batch_id=payload.batch_id,
        is_active=True,
        avatar_initials=initials,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _log_audit(
        db,
        user_id=current_user.id,
        action="PROVISION_USER",
        entity_type="User",
        entity_id=user.id,
        details={"email": user.email, "role": user.role, "department_id": user.department_id},
    )

    return _serialize_user(db, user)


@router.patch("/users/{user_id}/status", response_model=UserOut)
def update_user_status(
    user_id: str,
    payload: UserStatusUpdate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own Super Admin account.",
        )

    target_user.is_active = payload.is_active
    db.commit()
    db.refresh(target_user)

    _log_audit(
        db,
        user_id=current_user.id,
        action="CHANGE_USER_STATUS",
        entity_type="User",
        entity_id=target_user.id,
        details={"is_active": target_user.is_active},
    )

    return _serialize_user(db, target_user)


@router.get("/audit-logs", response_model=list[AuditLogOut])
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[AuditLogOut]:
    logs = db.scalars(select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit)).all()
    return [AuditLogOut.model_validate(l) for l in logs]


# ==========================================
# 2. DEPARTMENT ADMIN ENDPOINTS
# ==========================================


@router.get("/dept/analytics", response_model=DeptAnalyticsOut)
def get_department_analytics(
    current_user: User = Depends(require_department_admin),
    db: Session = Depends(get_db),
) -> DeptAnalyticsOut:
    dept_id = current_user.department_id
    if not dept_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Department Admin is not assigned to a department.",
        )
    dept = db.get(Department, dept_id)
    dept_name = dept.name if dept else "Assigned Department"

    fac_count = db.scalar(select(func.count(Faculty.id)).where(Faculty.department_id == dept_id)) or 0
    course_count = db.scalar(select(func.count(Course.id)).where(Course.department_id == dept_id)) or 0
    batch_count = db.scalar(select(func.count(Batch.id)).where(Batch.department_id == dept_id)) or 0
    room_count = db.scalar(select(func.count(Room.id)).where(Room.department_id == dept_id)) or 0

    latest_ver = db.scalar(
        select(TimetableVersion)
        .where(TimetableVersion.department_id == dept_id, TimetableVersion.status == "PUBLISHED")
        .order_by(desc(TimetableVersion.version_number))
        .limit(1)
    )

    entries_count = 0
    if latest_ver:
        entries_count = db.scalar(
            select(func.count(TimetableEntry.id)).where(TimetableEntry.version_id == latest_ver.id)
        ) or 0

    return DeptAnalyticsOut(
        department_id=dept_id,
        department_name=dept_name,
        total_faculty=fac_count,
        total_courses=course_count,
        total_batches=batch_count,
        total_rooms=room_count,
        timetable_version=latest_ver.version_number if latest_ver else 0,
        total_classes_scheduled=entries_count,
        unresolved_conflicts=0,
    )


@router.post("/dept/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_department_user(
    payload: AdminUserCreate,
    current_user: User = Depends(require_department_admin),
    db: Session = Depends(get_db),
) -> UserOut:
    """Department Admin can create ONLY faculty or student accounts in their own department."""
    if payload.role not in ("FACULTY", "STUDENT"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Department Admin cannot create administrator accounts.",
        )

    dept_id = current_user.department_id
    if not dept_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Department Admin is not linked to any department.",
        )

    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )

    parts = [p for p in payload.full_name.strip().split() if p]
    initials = ((parts[0][0] if parts else "U") + (parts[-1][0] if len(parts) > 1 else "S")).upper()

    user = User(
        email=payload.email,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        university_id=current_user.university_id,
        department_id=dept_id,
        batch_id=payload.batch_id,
        is_active=True,
        avatar_initials=initials,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _log_audit(
        db,
        user_id=current_user.id,
        action="DEPT_PROVISION_USER",
        entity_type="User",
        entity_id=user.id,
        details={"email": user.email, "role": user.role, "department_id": dept_id},
    )

    return _serialize_user(db, user)
