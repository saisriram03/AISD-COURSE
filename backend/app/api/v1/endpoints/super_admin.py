import json
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.api.deps import require_super_admin
from app.core.security import hash_password
from app.db.base import get_db
from app.models.governance import (
    AcademicYear,
    Campus,
    ExaminationPeriod,
    Holiday,
    PlatformSetting,
    Semester,
    TenantSetting,
    WorkingDayConfiguration,
)
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
)
from app.schemas.governance import (
    AcademicYearCreate,
    AcademicYearOut,
    AcademicYearStatusUpdate,
    AcademicYearUpdate,
    AuditLogRichOut,
    CampusCreate,
    CampusOut,
    CampusStatusUpdate,
    CampusUpdate,
    DepartmentDetailOut,
    DepartmentManageCreate,
    DepartmentManageUpdate,
    DepartmentRichOut,
    DepartmentStatusUpdate,
    DeptAdminCreate,
    DeptAdminDetailOut,
    DeptAdminOut,
    DeptAdminStatusUpdate,
    DeptAdminUpdate,
    ExaminationPeriodCreate,
    ExaminationPeriodOut,
    ExaminationPeriodUpdate,
    HolidayCreate,
    HolidayOut,
    HolidayUpdate,
    PlatformSettingOut,
    PlatformSettingUpdate,
    SemesterCreate,
    SemesterOut,
    SemesterUpdate,
    SuperAdminDashboardOut,
    TenantSettingOut,
    TenantSettingUpdate,
    UniversityOut,
    UniversityProfileBundleOut,
    UniversityUpdate,
    WorkingDayConfigOut,
    WorkingDayConfigUpdate,
)

router = APIRouter(tags=["Super Admin Governance"])

UPLOAD_LOGO_DIR = Path(__file__).resolve().parents[4] / "uploads" / "logos"
ALLOWED_LOGO_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".svg"}
MAX_LOGO_BYTES = 2 * 1024 * 1024  # 2 MB


def _record_audit(
    db: Session,
    current_user: User,
    action: str,
    module: str,
    entity_type: str,
    entity_id: str,
    details: dict,
    request: Request | None = None,
    result: str = "SUCCESS",
) -> None:
    ip = request.client.host if request and request.client else "127.0.0.1"
    log = AuditLog(
        university_id=current_user.university_id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=current_user.role,
        action=action,
        module=module,
        entity_type=entity_type,
        entity_id=entity_id,
        ip_address=ip,
        result=result,
        details=json.dumps(details),
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()


def _build_rich_department(db: Session, dept: Department, active_sem_label: str) -> DepartmentRichOut:
    campus = db.get(Campus, dept.campus_id) if dept.campus_id else None
    fac_count = db.scalar(select(func.count(Faculty.id)).where(Faculty.department_id == dept.id)) or 0
    stu_count = db.scalar(select(func.count(Student.id)).where(Student.department_id == dept.id)) or 0
    batch_strength_sum = db.scalar(
        select(func.coalesce(func.sum(Batch.student_strength), 0)).where(Batch.department_id == dept.id)
    ) or 0
    effective_students = max(stu_count, int(batch_strength_sum))
    batch_count = db.scalar(select(func.count(Batch.id)).where(Batch.department_id == dept.id)) or 0
    room_count = db.scalar(select(func.count(Room.id)).where(Room.department_id == dept.id)) or 0
    course_count = db.scalar(select(func.count(Course.id)).where(Course.department_id == dept.id)) or 0

    admins = db.scalars(
        select(User).where(
            User.department_id == dept.id,
            User.role == "DEPT_ADMIN",
        )
    ).all()

    latest_pub = db.scalar(
        select(TimetableVersion)
        .where(TimetableVersion.department_id == dept.id, TimetableVersion.status == "PUBLISHED")
        .order_by(desc(TimetableVersion.version_number))
        .limit(1)
    )
    latest_draft = db.scalar(
        select(TimetableVersion)
        .where(TimetableVersion.department_id == dept.id, TimetableVersion.status == "DRAFT")
        .order_by(desc(TimetableVersion.version_number))
        .limit(1)
    )

    tt_status = "NOT_GENERATED"
    tt_version = 0
    entries_count = 0
    if latest_pub:
        tt_status = "PUBLISHED"
        tt_version = latest_pub.version_number
        entries_count = db.scalar(
            select(func.count(TimetableEntry.id)).where(TimetableEntry.version_id == latest_pub.id)
        ) or 0
    elif latest_draft:
        tt_status = "DRAFT"
        tt_version = latest_draft.version_number
        entries_count = db.scalar(
            select(func.count(TimetableEntry.id)).where(TimetableEntry.version_id == latest_draft.id)
        ) or 0

    return DepartmentRichOut(
        id=dept.id,
        university_id=dept.university_id,
        campus_id=dept.campus_id,
        campus_name=campus.name if campus else None,
        name=dept.name,
        code=dept.code,
        description=dept.description,
        hod_user_id=dept.hod_user_id,
        hod_name=dept.hod_name,
        contact_email=dept.contact_email,
        contact_number=dept.contact_number,
        status=dept.status,
        faculty_count=fac_count,
        student_count=effective_students,
        batch_count=batch_count,
        room_count=room_count,
        course_count=course_count,
        admin_count=len(admins),
        admin_names=[a.full_name for a in admins],
        current_semester=active_sem_label,
        timetable_status=tt_status,
        timetable_version=tt_version,
        scheduled_entries_count=entries_count,
        created_at=dept.created_at,
        updated_at=dept.updated_at,
    )


def _serialize_dept_admin(db: Session, admin: User, include_setup_link: bool = False) -> DeptAdminOut:
    dept = db.get(Department, admin.department_id) if admin.department_id else None
    setup_link = None
    if include_setup_link and admin.invite_token:
        setup_link = f"/forgot-password?invite={admin.invite_token}"
    return DeptAdminOut(
        id=admin.id,
        full_name=admin.full_name,
        email=admin.email,
        phone_number=admin.phone_number,
        department_id=admin.department_id,
        department_name=dept.name if dept else None,
        department_code=dept.code if dept else None,
        designation=admin.designation or "Department Timetable Administrator",
        is_active=admin.is_active,
        invite_status=admin.invite_status,
        invite_sent_at=admin.invite_sent_at,
        last_login_at=admin.last_login_at,
        avatar_initials=admin.avatar_initials,
        created_at=admin.created_at,
        setup_link_preview=setup_link,
    )


# ==========================================
# MODULE 1: UNIVERSITY OVERVIEW DASHBOARD
# ==========================================


@router.get("/super-admin/dashboard", response_model=SuperAdminDashboardOut)
def get_super_admin_dashboard(
    campus_id: str | None = Query(None),
    status_filter: str | None = Query(None),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> SuperAdminDashboardOut:
    univ = db.get(University, current_user.university_id)
    if not univ:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University not found.")

    active_ay = db.scalar(
        select(AcademicYear)
        .where(AcademicYear.university_id == univ.id, AcademicYear.status == "ACTIVE")
        .limit(1)
    )
    active_sems = db.scalars(
        select(Semester)
        .where(Semester.university_id == univ.id, Semester.status == "ACTIVE")
        .order_by(Semester.semester_number)
    ).all()
    active_sem_label = active_sems[0].name if active_sems else "No Active Semester"

    dept_stmt = select(Department).where(Department.university_id == univ.id)
    if campus_id:
        dept_stmt = dept_stmt.where(Department.campus_id == campus_id)
    if status_filter:
        dept_stmt = dept_stmt.where(Department.status == status_filter)
    depts = db.scalars(dept_stmt.order_by(Department.name)).all()

    rich_depts = [_build_rich_department(db, d, active_sem_label) for d in depts]

    all_depts = db.scalars(select(Department).where(Department.university_id == univ.id)).all()
    all_dept_ids = [d.id for d in all_depts]

    total_depts = len(all_depts)
    total_dept_admins = db.scalar(
        select(func.count(User.id)).where(User.university_id == univ.id, User.role == "DEPT_ADMIN")
    ) or 0
    total_faculty = (
        db.scalar(select(func.count(Faculty.id)).where(Faculty.department_id.in_(all_dept_ids))) or 0
        if all_dept_ids
        else 0
    )
    total_stu_records = (
        db.scalar(select(func.count(Student.id)).where(Student.department_id.in_(all_dept_ids))) or 0
        if all_dept_ids
        else 0
    )
    total_batch_strength = (
        db.scalar(
            select(func.coalesce(func.sum(Batch.student_strength), 0)).where(Batch.department_id.in_(all_dept_ids))
        )
        or 0
        if all_dept_ids
        else 0
    )
    total_students = max(total_stu_records, int(total_batch_strength))
    active_academic_years = db.scalar(
        select(func.count(AcademicYear.id)).where(
            AcademicYear.university_id == univ.id, AcademicYear.status == "ACTIVE"
        )
    ) or 0
    published_timetables = (
        db.scalar(
            select(func.count(TimetableVersion.id)).where(
                TimetableVersion.department_id.in_(all_dept_ids),
                TimetableVersion.status == "PUBLISHED",
            )
        )
        or 0
        if all_dept_ids
        else 0
    )

    published_count = sum(1 for d in rich_depts if d.timetable_status == "PUBLISHED")
    draft_count = sum(1 for d in rich_depts if d.timetable_status == "DRAFT")
    conflict_count = sum(1 for d in rich_depts if d.timetable_status == "CONFLICT")
    not_generated_count = sum(1 for d in rich_depts if d.timetable_status == "NOT_GENERATED")
    depts_without_admin = sum(1 for d in rich_depts if d.admin_count == 0)

    recent_logs = db.scalars(
        select(AuditLog)
        .where((AuditLog.university_id == univ.id) | (AuditLog.university_id.is_(None)))
        .order_by(desc(AuditLog.created_at))
        .limit(12)
    ).all()

    return SuperAdminDashboardOut(
        university=UniversityOut.model_validate(univ),
        kpis={
            "total_departments": total_depts,
            "total_department_admins": total_dept_admins,
            "total_faculty": total_faculty,
            "total_students": total_students,
            "active_academic_years": active_academic_years,
            "published_timetables": published_timetables,
        },
        departments=rich_depts,
        scheduling_health={
            "published": published_count,
            "draft": draft_count,
            "conflicts": conflict_count,
            "not_generated": not_generated_count,
            "departments_without_admin": depts_without_admin,
        },
        charts={
            "department_distribution": [
                {
                    "code": d.code,
                    "name": d.name,
                    "faculty": d.faculty_count,
                    "students": d.student_count,
                    "rooms": d.room_count,
                    "courses": d.course_count,
                    "scheduled_entries": d.scheduled_entries_count,
                }
                for d in rich_depts
            ],
            "timetable_status_summary": [
                {"label": "Published", "count": published_count},
                {"label": "Draft", "count": draft_count},
                {"label": "Conflicts", "count": conflict_count},
                {"label": "Not Generated", "count": not_generated_count},
            ],
        },
        recent_activities=[AuditLogRichOut.model_validate(l) for l in recent_logs],
        current_academic_year=AcademicYearOut.model_validate(active_ay) if active_ay else None,
        active_semesters=[SemesterOut.model_validate(s) for s in active_sems],
    )


# ==========================================
# MODULE 2: UNIVERSITY PROFILE & CAMPUSES
# ==========================================


@router.get("/university", response_model=UniversityProfileBundleOut)
def get_university_profile(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> UniversityProfileBundleOut:
    univ = db.get(University, current_user.university_id)
    if not univ:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University not found.")
    campuses = db.scalars(
        select(Campus).where(Campus.university_id == univ.id).order_by(Campus.name)
    ).all()
    tenant = db.scalar(select(TenantSetting).where(TenantSetting.university_id == univ.id))
    if not tenant:
        tenant = TenantSetting(university_id=univ.id)
        db.add(tenant)
        db.commit()
        db.refresh(tenant)

    return UniversityProfileBundleOut(
        university=UniversityOut.model_validate(univ),
        campuses=[CampusOut.model_validate(c) for c in campuses],
        tenant_settings=TenantSettingOut.model_validate(tenant),
    )


@router.put("/university", response_model=UniversityOut)
def update_university_profile(
    payload: UniversityUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> UniversityOut:
    univ = db.get(University, current_user.university_id)
    if not univ:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University not found.")

    previous_name = univ.name
    for field, value in payload.model_dump().items():
        if field == "code":
            value = value.upper().strip()
        setattr(univ, field, value)
    univ.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(univ)

    _record_audit(
        db,
        current_user,
        action="UPDATE_UNIVERSITY_PROFILE",
        module="UNIVERSITY_PROFILE",
        entity_type="University",
        entity_id=univ.id,
        details={"previous_name": previous_name, "new_name": univ.name, "code": univ.code},
        request=request,
    )
    return UniversityOut.model_validate(univ)


@router.post("/university/logo", response_model=UniversityOut)
async def upload_university_logo(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> UniversityOut:
    univ = db.get(University, current_user.university_id)
    if not univ:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="University not found.")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_LOGO_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image type. Allowed: PNG, JPG, JPEG, WEBP, SVG.",
        )

    content = await file.read()
    if len(content) > MAX_LOGO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo file exceeds 2 MB limit.",
        )

    UPLOAD_LOGO_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = f"{univ.id}_{secrets.token_hex(6)}{ext}"
    dest = UPLOAD_LOGO_DIR / safe_name
    dest.write_bytes(content)

    univ.logo_url = f"/api/v1/university/logo/{safe_name}"
    univ.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(univ)

    _record_audit(
        db,
        current_user,
        action="UPLOAD_UNIVERSITY_LOGO",
        module="UNIVERSITY_PROFILE",
        entity_type="University",
        entity_id=univ.id,
        details={"filename": safe_name, "bytes": len(content)},
        request=request,
    )
    return UniversityOut.model_validate(univ)


@router.get("/university/logo/{filename}")
def get_university_logo(filename: str):
    safe_name = Path(filename).name
    target = UPLOAD_LOGO_DIR / safe_name
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Logo not found.")
    return FileResponse(target)


@router.put("/university/tenant-settings", response_model=TenantSettingOut)
def update_tenant_settings(
    payload: TenantSettingUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> TenantSettingOut:
    tenant = db.scalar(select(TenantSetting).where(TenantSetting.university_id == current_user.university_id))
    if not tenant:
        tenant = TenantSetting(university_id=current_user.university_id)
        db.add(tenant)

    for field, value in payload.model_dump().items():
        setattr(tenant, field, value)
    tenant.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(tenant)

    _record_audit(
        db,
        current_user,
        action="UPDATE_TENANT_SETTINGS",
        module="UNIVERSITY_PROFILE",
        entity_type="TenantSetting",
        entity_id=tenant.id,
        details=payload.model_dump(),
        request=request,
    )
    return TenantSettingOut.model_validate(tenant)


@router.get("/university/campuses", response_model=list[CampusOut])
def list_campuses(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[CampusOut]:
    campuses = db.scalars(
        select(Campus).where(Campus.university_id == current_user.university_id).order_by(Campus.name)
    ).all()
    return [CampusOut.model_validate(c) for c in campuses]


@router.post("/university/campuses", response_model=CampusOut, status_code=status.HTTP_201_CREATED)
def create_campus(
    payload: CampusCreate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> CampusOut:
    code = payload.code.upper().strip()
    existing = db.scalar(
        select(Campus).where(Campus.university_id == current_user.university_id, Campus.code == code)
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Campus code '{code}' already exists.")

    campus = Campus(
        university_id=current_user.university_id,
        is_active=(payload.status == "ACTIVE"),
        **{**payload.model_dump(), "code": code},
    )
    db.add(campus)
    db.commit()
    db.refresh(campus)

    _record_audit(
        db,
        current_user,
        action="CREATE_CAMPUS",
        module="UNIVERSITY_PROFILE",
        entity_type="Campus",
        entity_id=campus.id,
        details={"name": campus.name, "code": campus.code},
        request=request,
    )
    return CampusOut.model_validate(campus)


@router.put("/university/campuses/{campus_id}", response_model=CampusOut)
def update_campus(
    campus_id: str,
    payload: CampusUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> CampusOut:
    campus = db.get(Campus, campus_id)
    if not campus or campus.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campus not found.")

    code = payload.code.upper().strip()
    conflict = db.scalar(
        select(Campus).where(
            Campus.university_id == current_user.university_id,
            Campus.code == code,
            Campus.id != campus_id,
        )
    )
    if conflict:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Campus code '{code}' already exists.")

    for field, value in payload.model_dump().items():
        setattr(campus, field, code if field == "code" else value)
    campus.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(campus)

    _record_audit(
        db,
        current_user,
        action="UPDATE_CAMPUS",
        module="UNIVERSITY_PROFILE",
        entity_type="Campus",
        entity_id=campus.id,
        details={"name": campus.name, "code": campus.code, "status": campus.status},
        request=request,
    )
    return CampusOut.model_validate(campus)


@router.patch("/university/campuses/{campus_id}/status", response_model=CampusOut)
def toggle_campus_status(
    campus_id: str,
    payload: CampusStatusUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> CampusOut:
    campus = db.get(Campus, campus_id)
    if not campus or campus.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campus not found.")
    campus.status = payload.status
    campus.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(campus)

    _record_audit(
        db,
        current_user,
        action="UPDATE_CAMPUS_STATUS",
        module="UNIVERSITY_PROFILE",
        entity_type="Campus",
        entity_id=campus.id,
        details={"status": campus.status},
        request=request,
    )
    return CampusOut.model_validate(campus)


# ==========================================
# MODULE 3: DEPARTMENT MANAGEMENT
# ==========================================


@router.get("/departments", response_model=list[DepartmentRichOut])
def list_departments_rich(
    search: str | None = Query(None),
    status_filter: str | None = Query(None),
    campus_id: str | None = Query(None),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[DepartmentRichOut]:
    active_sem = db.scalar(
        select(Semester)
        .where(Semester.university_id == current_user.university_id, Semester.status == "ACTIVE")
        .limit(1)
    )
    active_sem_label = active_sem.name if active_sem else "Odd Semester"

    stmt = select(Department).where(Department.university_id == current_user.university_id)
    if status_filter:
        stmt = stmt.where(Department.status == status_filter)
    if campus_id:
        stmt = stmt.where(Department.campus_id == campus_id)
    if search:
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            Department.name.ilike(q) | Department.code.ilike(q) | Department.hod_name.ilike(q)
        )

    depts = db.scalars(stmt.order_by(Department.name)).all()
    return [_build_rich_department(db, d, active_sem_label) for d in depts]


@router.post("/departments", response_model=DepartmentRichOut, status_code=status.HTTP_201_CREATED)
def create_department_rich(
    payload: DepartmentManageCreate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> DepartmentRichOut:
    code = payload.code.upper().strip()
    existing = db.scalar(
        select(Department).where(
            Department.university_id == current_user.university_id,
            Department.code == code,
        )
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Department code '{code}' already exists.")

    if payload.campus_id:
        campus = db.get(Campus, payload.campus_id)
        if not campus or campus.university_id != current_user.university_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid campus selected.")

    dept = Department(
        university_id=current_user.university_id,
        campus_id=payload.campus_id or None,
        name=payload.name.strip(),
        code=code,
        description=payload.description.strip(),
        hod_user_id=payload.hod_user_id or None,
        hod_name=payload.hod_name.strip(),
        contact_email=payload.contact_email.strip() if payload.contact_email else "",
        contact_number=payload.contact_number.strip(),
        status=payload.status,
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)

    _record_audit(
        db,
        current_user,
        action="CREATE_DEPARTMENT",
        module="DEPARTMENTS",
        entity_type="Department",
        entity_id=dept.id,
        details={"name": dept.name, "code": dept.code, "hod": dept.hod_name},
        request=request,
    )
    return _build_rich_department(db, dept, "Odd Semester")


@router.get("/departments/{department_id}", response_model=DepartmentRichOut)
def get_department_rich(
    department_id: str,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> DepartmentRichOut:
    dept = db.get(Department, department_id)
    if not dept or dept.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found.")
    return _build_rich_department(db, dept, "Odd Semester")


@router.get("/departments/{department_id}/details", response_model=DepartmentDetailOut)
def get_department_full_details(
    department_id: str,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> DepartmentDetailOut:
    dept = db.get(Department, department_id)
    if not dept or dept.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found.")

    active_sem = db.scalar(
        select(Semester)
        .where(Semester.university_id == current_user.university_id, Semester.status == "ACTIVE")
        .limit(1)
    )
    rich = _build_rich_department(db, dept, active_sem.name if active_sem else "Odd Semester")

    faculty = db.scalars(select(Faculty).where(Faculty.department_id == dept.id).order_by(Faculty.name)).all()
    batches = db.scalars(select(Batch).where(Batch.department_id == dept.id).order_by(Batch.name)).all()
    admins = db.scalars(
        select(User).where(User.department_id == dept.id, User.role == "DEPT_ADMIN").order_by(User.full_name)
    ).all()
    courses = db.scalars(select(Course).where(Course.department_id == dept.id).order_by(Course.code)).all()
    rooms = db.scalars(select(Room).where(Room.department_id == dept.id).order_by(Room.room_number)).all()
    versions = db.scalars(
        select(TimetableVersion)
        .where(TimetableVersion.department_id == dept.id)
        .order_by(desc(TimetableVersion.version_number))
    ).all()
    logs = db.scalars(
        select(AuditLog)
        .where(AuditLog.entity_id == dept.id)
        .order_by(desc(AuditLog.created_at))
        .limit(20)
    ).all()

    return DepartmentDetailOut(
        department=rich,
        faculty=[
            {
                "id": f.id,
                "employee_code": f.employee_code,
                "name": f.name,
                "email": f.email,
                "designation": f.designation,
                "max_weekly_hours": f.max_weekly_hours,
            }
            for f in faculty
        ],
        batches=[
            {
                "id": b.id,
                "name": b.name,
                "academic_year": b.academic_year,
                "semester": b.semester,
                "section": b.section,
                "student_strength": b.student_strength,
            }
            for b in batches
        ],
        admins=[
            {
                "id": a.id,
                "full_name": a.full_name,
                "email": a.email,
                "designation": a.designation,
                "is_active": a.is_active,
            }
            for a in admins
        ],
        courses=[
            {
                "id": c.id,
                "code": c.code,
                "name": c.name,
                "semester": c.semester,
                "course_type": c.course_type,
                "weekly_hours": c.weekly_hours,
            }
            for c in courses
        ],
        rooms=[
            {
                "id": r.id,
                "room_number": r.room_number,
                "building": r.building,
                "room_type": r.room_type,
                "capacity": r.capacity,
            }
            for r in rooms
        ],
        timetable_summary={
            "status": rich.timetable_status,
            "active_version": rich.timetable_version,
            "scheduled_entries": rich.scheduled_entries_count,
            "versions": [
                {
                    "id": v.id,
                    "version_number": v.version_number,
                    "status": v.status,
                    "notes": v.notes,
                    "published_at": v.published_at.isoformat() if v.published_at else None,
                }
                for v in versions
            ],
        },
        activity_history=[
            {
                "id": l.id,
                "action": l.action,
                "user_name": l.user_name,
                "details": l.details,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ],
    )


@router.put("/departments/{department_id}", response_model=DepartmentRichOut)
def update_department_rich(
    department_id: str,
    payload: DepartmentManageUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> DepartmentRichOut:
    dept = db.get(Department, department_id)
    if not dept or dept.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found.")

    code = payload.code.upper().strip()
    conflict = db.scalar(
        select(Department).where(
            Department.university_id == current_user.university_id,
            Department.code == code,
            Department.id != department_id,
        )
    )
    if conflict:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Department code '{code}' already exists.")

    dept.name = payload.name.strip()
    dept.code = code
    dept.description = payload.description.strip()
    dept.campus_id = payload.campus_id or None
    dept.hod_user_id = payload.hod_user_id or None
    dept.hod_name = payload.hod_name.strip()
    dept.contact_email = payload.contact_email.strip() if payload.contact_email else ""
    dept.contact_number = payload.contact_number.strip()
    dept.status = payload.status
    dept.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(dept)

    _record_audit(
        db,
        current_user,
        action="UPDATE_DEPARTMENT",
        module="DEPARTMENTS",
        entity_type="Department",
        entity_id=dept.id,
        details={"name": dept.name, "code": dept.code, "status": dept.status},
        request=request,
    )
    return _build_rich_department(db, dept, "Odd Semester")


@router.patch("/departments/{department_id}/status", response_model=DepartmentRichOut)
def update_department_status(
    department_id: str,
    payload: DepartmentStatusUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> DepartmentRichOut:
    dept = db.get(Department, department_id)
    if not dept or dept.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found.")
    dept.status = payload.status
    dept.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(dept)

    _record_audit(
        db,
        current_user,
        action="DEACTIVATE_DEPARTMENT" if payload.status == "INACTIVE" else "REACTIVATE_DEPARTMENT",
        module="DEPARTMENTS",
        entity_type="Department",
        entity_id=dept.id,
        details={"code": dept.code, "status": dept.status},
        request=request,
    )
    return _build_rich_department(db, dept, "Odd Semester")


# ==========================================
# MODULE 4: DEPARTMENT ADMIN MANAGEMENT
# ==========================================


@router.get("/department-admins", response_model=list[DeptAdminOut])
def list_department_admins(
    search: str | None = Query(None),
    department_id: str | None = Query(None),
    status_filter: str | None = Query(None),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[DeptAdminOut]:
    stmt = select(User).where(
        User.university_id == current_user.university_id,
        User.role == "DEPT_ADMIN",
    )
    if department_id:
        stmt = stmt.where(User.department_id == department_id)
    if status_filter == "ACTIVE":
        stmt = stmt.where(User.is_active.is_(True))
    elif status_filter == "INACTIVE":
        stmt = stmt.where(User.is_active.is_(False))
    elif status_filter == "PENDING":
        stmt = stmt.where(User.invite_status == "PENDING")

    if search:
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            User.full_name.ilike(q) | User.email.ilike(q) | User.designation.ilike(q)
        )

    admins = db.scalars(stmt.order_by(desc(User.created_at))).all()
    return [_serialize_dept_admin(db, a) for a in admins]


@router.post("/department-admins", response_model=DeptAdminOut, status_code=status.HTTP_201_CREATED)
def create_department_admin(
    payload: DeptAdminCreate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> DeptAdminOut:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    dept = db.get(Department, payload.department_id)
    if not dept or dept.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department selected.")

    parts = [p for p in payload.full_name.strip().split() if p]
    initials = ((parts[0][0] if parts else "D") + (parts[-1][0] if len(parts) > 1 else "A")).upper()
    invite_token = secrets.token_urlsafe(24)
    temp_secret = secrets.token_urlsafe(32)  # Never exposed in plaintext

    admin = User(
        email=payload.email,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(temp_secret),
        role="DEPT_ADMIN",
        university_id=current_user.university_id,
        department_id=dept.id,
        is_active=payload.is_active,
        avatar_initials=initials,
        phone_number=payload.phone_number.strip(),
        designation=payload.designation.strip(),
        invite_status="PENDING",
        invite_token=invite_token,
        invite_sent_at=datetime.now(timezone.utc),
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    _record_audit(
        db,
        current_user,
        action="CREATE_DEPT_ADMIN",
        module="DEPARTMENT_ADMINS",
        entity_type="User",
        entity_id=admin.id,
        details={"email": admin.email, "department": dept.code, "invite_status": "PENDING"},
        request=request,
    )
    return _serialize_dept_admin(db, admin, include_setup_link=True)


@router.get("/department-admins/{admin_id}", response_model=DeptAdminDetailOut)
def get_department_admin_detail(
    admin_id: str,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> DeptAdminDetailOut:
    admin = db.get(User, admin_id)
    if not admin or admin.university_id != current_user.university_id or admin.role != "DEPT_ADMIN":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department Admin not found.")

    logs = db.scalars(
        select(AuditLog)
        .where((AuditLog.user_id == admin.id) | (AuditLog.entity_id == admin.id))
        .order_by(desc(AuditLog.created_at))
        .limit(15)
    ).all()

    return DeptAdminDetailOut(
        admin=_serialize_dept_admin(db, admin),
        recent_actions=[
            {
                "id": l.id,
                "action": l.action,
                "module": l.module,
                "details": l.details,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ],
    )


@router.put("/department-admins/{admin_id}", response_model=DeptAdminOut)
def update_department_admin(
    admin_id: str,
    payload: DeptAdminUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> DeptAdminOut:
    admin = db.get(User, admin_id)
    if not admin or admin.university_id != current_user.university_id or admin.role != "DEPT_ADMIN":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department Admin not found.")

    dept = db.get(Department, payload.department_id)
    if not dept or dept.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid department selected.")

    prev_dept = admin.department_id
    admin.full_name = payload.full_name.strip()
    admin.phone_number = payload.phone_number.strip()
    admin.department_id = dept.id
    admin.designation = payload.designation.strip()
    admin.is_active = payload.is_active
    admin.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(admin)

    _record_audit(
        db,
        current_user,
        action="UPDATE_DEPT_ADMIN",
        module="DEPARTMENT_ADMINS",
        entity_type="User",
        entity_id=admin.id,
        details={"previous_dept": prev_dept, "new_dept": dept.id, "is_active": admin.is_active},
        request=request,
    )
    return _serialize_dept_admin(db, admin)


@router.patch("/department-admins/{admin_id}/status", response_model=DeptAdminOut)
def update_department_admin_status(
    admin_id: str,
    payload: DeptAdminStatusUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> DeptAdminOut:
    admin = db.get(User, admin_id)
    if not admin or admin.university_id != current_user.university_id or admin.role != "DEPT_ADMIN":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department Admin not found.")

    admin.is_active = payload.is_active
    admin.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(admin)

    _record_audit(
        db,
        current_user,
        action="ACTIVATE_DEPT_ADMIN" if payload.is_active else "DEACTIVATE_DEPT_ADMIN",
        module="DEPARTMENT_ADMINS",
        entity_type="User",
        entity_id=admin.id,
        details={"email": admin.email, "is_active": admin.is_active},
        request=request,
    )
    return _serialize_dept_admin(db, admin)


@router.post("/department-admins/{admin_id}/resend-invite", response_model=DeptAdminOut)
def resend_dept_admin_invite(
    admin_id: str,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> DeptAdminOut:
    admin = db.get(User, admin_id)
    if not admin or admin.university_id != current_user.university_id or admin.role != "DEPT_ADMIN":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department Admin not found.")

    admin.invite_token = secrets.token_urlsafe(24)
    admin.invite_status = "PENDING"
    admin.invite_sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(admin)

    _record_audit(
        db,
        current_user,
        action="RESEND_ADMIN_INVITE",
        module="DEPARTMENT_ADMINS",
        entity_type="User",
        entity_id=admin.id,
        details={"email": admin.email},
        request=request,
    )
    return _serialize_dept_admin(db, admin, include_setup_link=True)


# ==========================================
# MODULE 5: ACADEMIC YEARS, SEMESTERS, HOLIDAYS, EXAMS, WORKING DAYS
# ==========================================


@router.get("/academic-years", response_model=list[AcademicYearOut])
def list_academic_years(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[AcademicYearOut]:
    years = db.scalars(
        select(AcademicYear)
        .where(AcademicYear.university_id == current_user.university_id)
        .order_by(desc(AcademicYear.start_date))
    ).all()
    return [AcademicYearOut.model_validate(y) for y in years]


def _check_ay_overlap(db: Session, university_id: str, start_date: str, end_date: str, exclude_id: str | None = None):
    others = db.scalars(select(AcademicYear).where(AcademicYear.university_id == university_id)).all()
    for o in others:
        if exclude_id and o.id == exclude_id:
            continue
        if not (end_date < o.start_date or start_date > o.end_date):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Date range overlaps with existing academic year '{o.name}' ({o.start_date} to {o.end_date}).",
            )


@router.post("/academic-years", response_model=AcademicYearOut, status_code=status.HTTP_201_CREATED)
def create_academic_year(
    payload: AcademicYearCreate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> AcademicYearOut:
    _check_ay_overlap(db, current_user.university_id, payload.start_date, payload.end_date)
    if payload.status == "ACTIVE":
        for ay in db.scalars(
            select(AcademicYear).where(
                AcademicYear.university_id == current_user.university_id,
                AcademicYear.status == "ACTIVE",
            )
        ).all():
            ay.status = "ARCHIVED"

    ay = AcademicYear(university_id=current_user.university_id, **payload.model_dump())
    db.add(ay)
    db.commit()
    db.refresh(ay)

    _record_audit(
        db,
        current_user,
        action="CREATE_ACADEMIC_YEAR",
        module="ACADEMIC_CALENDAR",
        entity_type="AcademicYear",
        entity_id=ay.id,
        details={"name": ay.name, "status": ay.status},
        request=request,
    )
    return AcademicYearOut.model_validate(ay)


@router.put("/academic-years/{ay_id}", response_model=AcademicYearOut)
def update_academic_year(
    ay_id: str,
    payload: AcademicYearUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> AcademicYearOut:
    ay = db.get(AcademicYear, ay_id)
    if not ay or ay.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Academic year not found.")
    _check_ay_overlap(db, current_user.university_id, payload.start_date, payload.end_date, exclude_id=ay_id)

    if payload.status == "ACTIVE":
        for other in db.scalars(
            select(AcademicYear).where(
                AcademicYear.university_id == current_user.university_id,
                AcademicYear.status == "ACTIVE",
                AcademicYear.id != ay_id,
            )
        ).all():
            other.status = "ARCHIVED"

    for k, v in payload.model_dump().items():
        setattr(ay, k, v)
    ay.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ay)

    _record_audit(
        db,
        current_user,
        action="UPDATE_ACADEMIC_YEAR",
        module="ACADEMIC_CALENDAR",
        entity_type="AcademicYear",
        entity_id=ay.id,
        details={"name": ay.name, "status": ay.status},
        request=request,
    )
    return AcademicYearOut.model_validate(ay)


@router.patch("/academic-years/{ay_id}/status", response_model=AcademicYearOut)
def update_academic_year_status(
    ay_id: str,
    payload: AcademicYearStatusUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> AcademicYearOut:
    ay = db.get(AcademicYear, ay_id)
    if not ay or ay.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Academic year not found.")

    if payload.status == "ACTIVE":
        for other in db.scalars(
            select(AcademicYear).where(
                AcademicYear.university_id == current_user.university_id,
                AcademicYear.status == "ACTIVE",
                AcademicYear.id != ay_id,
            )
        ).all():
            other.status = "ARCHIVED"

    ay.status = payload.status
    ay.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ay)

    _record_audit(
        db,
        current_user,
        action="CHANGE_ACADEMIC_YEAR_STATUS",
        module="ACADEMIC_CALENDAR",
        entity_type="AcademicYear",
        entity_id=ay.id,
        details={"name": ay.name, "status": ay.status},
        request=request,
    )
    return AcademicYearOut.model_validate(ay)


@router.get("/semesters", response_model=list[SemesterOut])
def list_semesters(
    academic_year_id: str | None = Query(None),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[SemesterOut]:
    stmt = select(Semester).where(Semester.university_id == current_user.university_id)
    if academic_year_id:
        stmt = stmt.where(Semester.academic_year_id == academic_year_id)
    sems = db.scalars(stmt.order_by(Semester.start_date)).all()
    return [SemesterOut.model_validate(s) for s in sems]


@router.post("/semesters", response_model=SemesterOut, status_code=status.HTTP_201_CREATED)
def create_semester(
    payload: SemesterCreate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> SemesterOut:
    ay = db.get(AcademicYear, payload.academic_year_id)
    if not ay or ay.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid academic year.")

    sem = Semester(university_id=current_user.university_id, **payload.model_dump())
    db.add(sem)
    db.commit()
    db.refresh(sem)

    _record_audit(
        db,
        current_user,
        action="CREATE_SEMESTER",
        module="ACADEMIC_CALENDAR",
        entity_type="Semester",
        entity_id=sem.id,
        details={"name": sem.name, "term_type": sem.term_type},
        request=request,
    )
    return SemesterOut.model_validate(sem)


@router.put("/semesters/{sem_id}", response_model=SemesterOut)
def update_semester(
    sem_id: str,
    payload: SemesterUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> SemesterOut:
    sem = db.get(Semester, sem_id)
    if not sem or sem.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found.")
    for k, v in payload.model_dump().items():
        setattr(sem, k, v)
    sem.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sem)

    _record_audit(
        db,
        current_user,
        action="UPDATE_SEMESTER",
        module="ACADEMIC_CALENDAR",
        entity_type="Semester",
        entity_id=sem.id,
        details={"name": sem.name, "status": sem.status},
        request=request,
    )
    return SemesterOut.model_validate(sem)


@router.get("/holidays", response_model=list[HolidayOut])
def list_holidays(
    academic_year_id: str | None = Query(None),
    holiday_type: str | None = Query(None),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[HolidayOut]:
    stmt = select(Holiday).where(Holiday.university_id == current_user.university_id)
    if academic_year_id:
        stmt = stmt.where(Holiday.academic_year_id == academic_year_id)
    if holiday_type:
        stmt = stmt.where(Holiday.holiday_type == holiday_type)
    items = db.scalars(stmt.order_by(Holiday.date)).all()
    return [HolidayOut.model_validate(h) for h in items]


@router.post("/holidays", response_model=HolidayOut, status_code=status.HTTP_201_CREATED)
def create_holiday(
    payload: HolidayCreate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> HolidayOut:
    ay = db.get(AcademicYear, payload.academic_year_id)
    if not ay or ay.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid academic year.")

    hol = Holiday(university_id=current_user.university_id, **payload.model_dump())
    db.add(hol)
    db.commit()
    db.refresh(hol)

    _record_audit(
        db,
        current_user,
        action="CREATE_HOLIDAY",
        module="ACADEMIC_CALENDAR",
        entity_type="Holiday",
        entity_id=hol.id,
        details={"name": hol.name, "date": hol.date},
        request=request,
    )
    return HolidayOut.model_validate(hol)


@router.put("/holidays/{holiday_id}", response_model=HolidayOut)
def update_holiday(
    holiday_id: str,
    payload: HolidayUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> HolidayOut:
    hol = db.get(Holiday, holiday_id)
    if not hol or hol.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holiday not found.")
    for k, v in payload.model_dump().items():
        setattr(hol, k, v)
    hol.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(hol)
    _record_audit(
        db,
        current_user,
        action="UPDATE_HOLIDAY",
        module="ACADEMIC_CALENDAR",
        entity_type="Holiday",
        entity_id=hol.id,
        details={"name": hol.name, "date": hol.date},
        request=request,
    )
    return HolidayOut.model_validate(hol)


@router.delete("/holidays/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_holiday(
    holiday_id: str,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> None:
    hol = db.get(Holiday, holiday_id)
    if not hol or hol.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holiday not found.")
    name, date_str = hol.name, hol.date
    db.delete(hol)
    db.commit()
    _record_audit(
        db,
        current_user,
        action="DELETE_HOLIDAY",
        module="ACADEMIC_CALENDAR",
        entity_type="Holiday",
        entity_id=holiday_id,
        details={"name": name, "date": date_str},
        request=request,
    )


@router.get("/examination-periods", response_model=list[ExaminationPeriodOut])
def list_examination_periods(
    academic_year_id: str | None = Query(None),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[ExaminationPeriodOut]:
    stmt = select(ExaminationPeriod).where(ExaminationPeriod.university_id == current_user.university_id)
    if academic_year_id:
        stmt = stmt.where(ExaminationPeriod.academic_year_id == academic_year_id)
    items = db.scalars(stmt.order_by(ExaminationPeriod.start_date)).all()
    return [ExaminationPeriodOut.model_validate(e) for e in items]


@router.post("/examination-periods", response_model=ExaminationPeriodOut, status_code=status.HTTP_201_CREATED)
def create_examination_period(
    payload: ExaminationPeriodCreate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> ExaminationPeriodOut:
    ay = db.get(AcademicYear, payload.academic_year_id)
    if not ay or ay.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid academic year.")

    exam = ExaminationPeriod(university_id=current_user.university_id, **payload.model_dump())
    db.add(exam)
    db.commit()
    db.refresh(exam)
    _record_audit(
        db,
        current_user,
        action="CREATE_EXAM_PERIOD",
        module="ACADEMIC_CALENDAR",
        entity_type="ExaminationPeriod",
        entity_id=exam.id,
        details={"name": exam.name, "start_date": exam.start_date, "end_date": exam.end_date},
        request=request,
    )
    return ExaminationPeriodOut.model_validate(exam)


@router.put("/examination-periods/{exam_id}", response_model=ExaminationPeriodOut)
def update_examination_period(
    exam_id: str,
    payload: ExaminationPeriodUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> ExaminationPeriodOut:
    exam = db.get(ExaminationPeriod, exam_id)
    if not exam or exam.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Examination period not found.")
    for k, v in payload.model_dump().items():
        setattr(exam, k, v)
    exam.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(exam)
    _record_audit(
        db,
        current_user,
        action="UPDATE_EXAM_PERIOD",
        module="ACADEMIC_CALENDAR",
        entity_type="ExaminationPeriod",
        entity_id=exam.id,
        details={"name": exam.name},
        request=request,
    )
    return ExaminationPeriodOut.model_validate(exam)


@router.delete("/examination-periods/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_examination_period(
    exam_id: str,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> None:
    exam = db.get(ExaminationPeriod, exam_id)
    if not exam or exam.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Examination period not found.")
    name = exam.name
    db.delete(exam)
    db.commit()
    _record_audit(
        db,
        current_user,
        action="DELETE_EXAM_PERIOD",
        module="ACADEMIC_CALENDAR",
        entity_type="ExaminationPeriod",
        entity_id=exam_id,
        details={"name": name},
        request=request,
    )


@router.get("/working-day-configs", response_model=list[WorkingDayConfigOut])
def list_working_day_configs(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[WorkingDayConfigOut]:
    configs = db.scalars(
        select(WorkingDayConfiguration).where(
            WorkingDayConfiguration.university_id == current_user.university_id
        )
    ).all()
    return [WorkingDayConfigOut.model_validate(c) for c in configs]


@router.put("/working-day-configs", response_model=WorkingDayConfigOut)
def upsert_working_day_config(
    payload: WorkingDayConfigUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> WorkingDayConfigOut:
    cfg = db.get(WorkingDayConfiguration, payload.id) if payload.id else None
    if cfg and cfg.university_id != current_user.university_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized.")
    if not cfg:
        cfg = WorkingDayConfiguration(university_id=current_user.university_id)
        db.add(cfg)

    for k, v in payload.model_dump(exclude={"id"}).items():
        setattr(cfg, k, v)
    cfg.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(cfg)

    _record_audit(
        db,
        current_user,
        action="UPDATE_WORKING_DAY_CONFIG",
        module="ACADEMIC_CALENDAR",
        entity_type="WorkingDayConfiguration",
        entity_id=cfg.id,
        details={"name": cfg.name, "working_days": cfg.working_days},
        request=request,
    )
    return WorkingDayConfigOut.model_validate(cfg)


# ==========================================
# MODULE 6: PLATFORM SETTINGS & AUDIT LOGS
# ==========================================


@router.get("/platform-settings", response_model=PlatformSettingOut)
def get_platform_settings(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> PlatformSettingOut:
    settings_row = db.scalar(
        select(PlatformSetting).where(PlatformSetting.university_id == current_user.university_id)
    )
    if not settings_row:
        settings_row = PlatformSetting(university_id=current_user.university_id)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    elif not settings_row.solver_weights_json:
        settings_row.solver_weights_json = '{"faculty_preference":80,"gap_minimization":70,"room_utilization":65,"compact_schedule":75}'
        db.commit()
        db.refresh(settings_row)
    return PlatformSettingOut.model_validate(settings_row)


@router.put("/platform-settings", response_model=PlatformSettingOut)
def update_platform_settings(
    payload: PlatformSettingUpdate,
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> PlatformSettingOut:
    if payload.solver_default_time_limit_sec > payload.solver_max_time_limit_sec:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Default solver time limit cannot exceed maximum solver time limit.",
        )

    settings_row = db.scalar(
        select(PlatformSetting).where(PlatformSetting.university_id == current_user.university_id)
    )
    if not settings_row:
        settings_row = PlatformSetting(university_id=current_user.university_id)
        db.add(settings_row)

    for k, v in payload.model_dump().items():
        setattr(settings_row, k, v)
    settings_row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(settings_row)

    _record_audit(
        db,
        current_user,
        action="UPDATE_PLATFORM_SETTINGS",
        module="PLATFORM_SETTINGS",
        entity_type="PlatformSetting",
        entity_id=settings_row.id,
        details={"maintenance_mode": settings_row.maintenance_mode, "solver_max_sec": settings_row.solver_max_time_limit_sec},
        request=request,
    )
    return PlatformSettingOut.model_validate(settings_row)


@router.get("/platform-settings/data-health")
def get_data_health(
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> dict:
    db_file = Path(__file__).resolve().parents[4] / "smartsched.db"
    size_bytes = db_file.stat().st_size if db_file.exists() else 0
    settings_row = db.scalar(
        select(PlatformSetting).where(PlatformSetting.university_id == current_user.university_id)
    )
    return {
        "database_engine": db.bind.dialect.name if db.bind else "sqlite",
        "status": "HEALTHY",
        "storage_bytes": size_bytes,
        "last_backup_at": settings_row.last_backup_at.isoformat() if settings_row and settings_row.last_backup_at else None,
        "last_backup_status": settings_row.last_backup_status if settings_row else "NOT_RUN",
        "record_counts": {
            "departments": db.scalar(select(func.count(Department.id)).where(Department.university_id == current_user.university_id)) or 0,
            "users": db.scalar(select(func.count(User.id)).where(User.university_id == current_user.university_id)) or 0,
            "academic_years": db.scalar(select(func.count(AcademicYear.id)).where(AcademicYear.university_id == current_user.university_id)) or 0,
            "audit_logs": db.scalar(select(func.count(AuditLog.id))) or 0,
        },
    }


@router.post("/platform-settings/export")
def export_platform_configuration(
    request: Request,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> dict:
    settings_row = db.scalar(
        select(PlatformSetting).where(PlatformSetting.university_id == current_user.university_id)
    )
    tenant_row = db.scalar(
        select(TenantSetting).where(TenantSetting.university_id == current_user.university_id)
    )
    _record_audit(
        db,
        current_user,
        action="EXPORT_CONFIGURATION",
        module="PLATFORM_SETTINGS",
        entity_type="PlatformSetting",
        entity_id=settings_row.id if settings_row else "default",
        details={"exported_at": datetime.now(timezone.utc).isoformat()},
        request=request,
    )
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "platform_settings": PlatformSettingOut.model_validate(settings_row).model_dump() if settings_row else {},
        "tenant_settings": TenantSettingOut.model_validate(tenant_row).model_dump() if tenant_row else {},
    }


@router.get("/audit-logs", response_model=list[AuditLogRichOut])
def query_audit_logs(
    module: str | None = Query(None),
    user_role: str | None = Query(None),
    action: str | None = Query(None),
    result: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
) -> list[AuditLogRichOut]:
    stmt = select(AuditLog).where(
        (AuditLog.university_id == current_user.university_id) | (AuditLog.university_id.is_(None))
    )
    if module:
        stmt = stmt.where(AuditLog.module == module)
    if user_role:
        stmt = stmt.where(AuditLog.user_role == user_role)
    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"%{action.strip()}%"))
    if result:
        stmt = stmt.where(AuditLog.result == result)
    if search:
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            AuditLog.user_name.ilike(q)
            | AuditLog.action.ilike(q)
            | AuditLog.entity_id.ilike(q)
            | AuditLog.details.ilike(q)
        )

    logs = db.scalars(stmt.order_by(desc(AuditLog.created_at)).limit(limit)).all()
    return [AuditLogRichOut.model_validate(l) for l in logs]
