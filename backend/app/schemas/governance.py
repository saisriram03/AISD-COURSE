from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class CampusCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    code: str = Field(min_length=2, max_length=32)
    campus_type: Literal["MAIN_CAMPUS", "RESEARCH_CAMPUS", "SATELLITE_CAMPUS", "CITY_CENTER"] = "MAIN_CAMPUS"
    address: str = Field(default="", max_length=300)
    city: str = Field(default="", max_length=100)
    state: str = Field(default="", max_length=100)
    contact_email: str = Field(default="", max_length=200)
    contact_number: str = Field(default="", max_length=32)
    status: Literal["ACTIVE", "INACTIVE"] = "ACTIVE"


class CampusUpdate(CampusCreate):
    pass


class CampusStatusUpdate(BaseModel):
    status: Literal["ACTIVE", "INACTIVE"]


class CampusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    university_id: str
    name: str
    code: str
    campus_type: str
    address: str
    city: str
    state: str
    contact_email: str
    contact_number: str
    status: str
    created_at: datetime
    updated_at: datetime | None = None


class TenantSettingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    university_id: str
    enforce_department_isolation: bool
    allow_cross_dept_electives: bool
    allow_shared_rooms: bool
    require_super_admin_dept_approval: bool
    data_ownership_label: str
    custom_domain: str
    updated_at: datetime | None = None


class TenantSettingUpdate(BaseModel):
    enforce_department_isolation: bool
    allow_cross_dept_electives: bool
    allow_shared_rooms: bool
    require_super_admin_dept_approval: bool
    data_ownership_label: str = Field(min_length=2, max_length=200)
    custom_domain: str = Field(default="", max_length=200)


class UniversityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    code: str
    logo_url: str | None = ""
    university_type: str | None = ""
    established_year: int | None = None
    accreditation: str | None = ""
    description: str | None = ""
    website: str | None = ""
    official_email: str | None = ""
    contact_number: str | None = ""
    alternate_number: str | None = ""
    address: str | None = ""
    city: str | None = ""
    state: str | None = ""
    country: str | None = "India"
    postal_code: str | None = ""
    tenant_status: str | None = "ACTIVE"
    default_timezone: str | None = "Asia/Kolkata"
    default_working_days: str | None = "MON,TUE,WED,THU,FRI,SAT"
    default_semester_structure: str | None = "ODD_EVEN"
    governance_policies: str | None = ""
    scheduling_policies: str | None = ""
    created_at: datetime
    updated_at: datetime | None = None


class UniversityUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    code: str = Field(min_length=2, max_length=32)
    university_type: str = Field(min_length=2, max_length=64)
    established_year: int | None = Field(default=None, ge=1800, le=2100)
    accreditation: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=2000)
    website: str = Field(default="", max_length=255)
    official_email: EmailStr | Literal[""] = ""
    contact_number: str = Field(default="", max_length=32)
    alternate_number: str = Field(default="", max_length=32)
    address: str = Field(default="", max_length=300)
    city: str = Field(default="", max_length=100)
    state: str = Field(default="", max_length=100)
    country: str = Field(default="India", max_length=100)
    postal_code: str = Field(default="", max_length=24)
    tenant_status: Literal["ACTIVE", "SUSPENDED", "MAINTENANCE"] = "ACTIVE"
    default_timezone: str = Field(default="Asia/Kolkata", max_length=64)
    default_working_days: str = Field(default="MON,TUE,WED,THU,FRI,SAT", max_length=120)
    default_semester_structure: Literal["ODD_EVEN", "TRIMESTER", "ANNUAL"] = "ODD_EVEN"
    governance_policies: str = Field(default="", max_length=2000)
    scheduling_policies: str = Field(default="", max_length=2000)


class UniversityProfileBundleOut(BaseModel):
    university: UniversityOut
    campuses: list[CampusOut]
    tenant_settings: TenantSettingOut


# Departments
class DepartmentManageCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    code: str = Field(min_length=2, max_length=32)
    description: str = Field(default="", max_length=1000)
    campus_id: str | None = None
    hod_user_id: str | None = None
    hod_name: str = Field(default="", max_length=160)
    contact_email: EmailStr | Literal[""] = ""
    contact_number: str = Field(default="", max_length=32)
    status: Literal["ACTIVE", "INACTIVE"] = "ACTIVE"


class DepartmentManageUpdate(DepartmentManageCreate):
    pass


class DepartmentStatusUpdate(BaseModel):
    status: Literal["ACTIVE", "INACTIVE"]


class DepartmentRichOut(BaseModel):
    id: str
    university_id: str
    campus_id: str | None = None
    campus_name: str | None = None
    name: str
    code: str
    description: str
    hod_user_id: str | None = None
    hod_name: str
    contact_email: str
    contact_number: str
    status: str
    faculty_count: int = 0
    student_count: int = 0
    batch_count: int = 0
    room_count: int = 0
    course_count: int = 0
    admin_count: int = 0
    admin_names: list[str] = []
    current_semester: str = "Sem 5 (Odd)"
    timetable_status: str = "NOT_GENERATED"  # PUBLISHED | DRAFT | CONFLICT | NOT_GENERATED
    timetable_version: int = 0
    scheduled_entries_count: int = 0
    created_at: datetime
    updated_at: datetime | None = None


class DepartmentDetailOut(BaseModel):
    department: DepartmentRichOut
    faculty: list[dict]
    batches: list[dict]
    admins: list[dict]
    courses: list[dict]
    rooms: list[dict]
    timetable_summary: dict
    activity_history: list[dict]


# Department Admins
class DeptAdminCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    phone_number: str = Field(default="", max_length=32)
    department_id: str
    designation: str = Field(default="Department Timetable Administrator", max_length=100)
    is_active: bool = True


class DeptAdminUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    phone_number: str = Field(default="", max_length=32)
    department_id: str
    designation: str = Field(default="Department Timetable Administrator", max_length=100)
    is_active: bool = True


class DeptAdminStatusUpdate(BaseModel):
    is_active: bool


class DeptAdminOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    phone_number: str
    department_id: str | None = None
    department_name: str | None = None
    department_code: str | None = None
    designation: str
    is_active: bool
    invite_status: str
    invite_sent_at: datetime | None = None
    last_login_at: datetime | None = None
    avatar_initials: str
    created_at: datetime
    setup_link_preview: str | None = None


class DeptAdminDetailOut(BaseModel):
    admin: DeptAdminOut
    recent_actions: list[dict]


# Academic Years & Terms
class AcademicYearCreate(BaseModel):
    name: str = Field(min_length=4, max_length=64)
    start_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    status: Literal["ACTIVE", "UPCOMING", "ARCHIVED"] = "UPCOMING"
    description: str = Field(default="", max_length=1000)

    @field_validator("end_date")
    @classmethod
    def validate_dates(cls, v: str, info):
        start = info.data.get("start_date")
        if start and v <= start:
            raise ValueError("End date must be after start date.")
        return v


class AcademicYearUpdate(AcademicYearCreate):
    pass


class AcademicYearStatusUpdate(BaseModel):
    status: Literal["ACTIVE", "UPCOMING", "ARCHIVED"]


class AcademicYearOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    university_id: str
    name: str
    start_date: str
    end_date: str
    status: str
    description: str
    created_at: datetime


class SemesterCreate(BaseModel):
    academic_year_id: str
    name: str = Field(min_length=2, max_length=120)
    semester_number: int = Field(ge=1, le=12)
    term_type: Literal["ODD", "EVEN", "SUMMER"] = "ODD"
    start_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    registration_start: str = Field(default="", max_length=16)
    registration_end: str = Field(default="", max_length=16)
    exam_start: str = Field(default="", max_length=16)
    exam_end: str = Field(default="", max_length=16)
    status: Literal["ACTIVE", "UPCOMING", "COMPLETED"] = "UPCOMING"

    @field_validator("end_date")
    @classmethod
    def validate_dates(cls, v: str, info):
        start = info.data.get("start_date")
        if start and v <= start:
            raise ValueError("Semester end date must be after start date.")
        return v


class SemesterUpdate(SemesterCreate):
    pass


class SemesterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    university_id: str
    academic_year_id: str
    name: str
    semester_number: int
    term_type: str
    start_date: str
    end_date: str
    registration_start: str
    registration_end: str
    exam_start: str
    exam_end: str
    status: str
    created_at: datetime


class HolidayCreate(BaseModel):
    academic_year_id: str
    name: str = Field(min_length=2, max_length=160)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    holiday_type: Literal["PUBLIC", "ACADEMIC", "INSTITUTIONAL", "RESTRICTED"] = "PUBLIC"
    description: str = Field(default="", max_length=500)
    applicable_departments: str = Field(default="ALL", max_length=500)


class HolidayUpdate(HolidayCreate):
    pass


class HolidayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    university_id: str
    academic_year_id: str
    name: str
    date: str
    holiday_type: str
    description: str
    applicable_departments: str
    created_at: datetime


class ExaminationPeriodCreate(BaseModel):
    academic_year_id: str
    semester_id: str | None = None
    name: str = Field(min_length=2, max_length=160)
    exam_type: Literal["INTERNAL_ASSESSMENT", "END_SEMESTER", "PRACTICAL", "SPECIAL_ACADEMIC"] = "END_SEMESTER"
    start_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    lock_timetable_edits: bool = True
    description: str = Field(default="", max_length=500)

    @field_validator("end_date")
    @classmethod
    def validate_dates(cls, v: str, info):
        start = info.data.get("start_date")
        if start and v < start:
            raise ValueError("End date must be on or after start date.")
        return v


class ExaminationPeriodUpdate(ExaminationPeriodCreate):
    pass


class ExaminationPeriodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    university_id: str
    academic_year_id: str
    semester_id: str | None = None
    name: str
    exam_type: str
    start_date: str
    end_date: str
    lock_timetable_edits: bool
    description: str
    created_at: datetime


class WorkingDayConfigUpdate(BaseModel):
    id: str | None = None
    name: str = Field(min_length=2, max_length=120)
    working_days: str = Field(min_length=3, max_length=120)
    opening_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    first_period_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    period_duration_minutes: int = Field(ge=30, le=120)
    morning_periods: int = Field(ge=1, le=8)
    lunch_start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    lunch_duration_minutes: int = Field(ge=15, le=120)
    afternoon_periods: int = Field(ge=0, le=8)
    closing_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    non_teaching_periods: str = Field(default="", max_length=200)
    is_default: bool = True


class WorkingDayConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    university_id: str
    name: str
    working_days: str
    opening_time: str
    first_period_time: str
    period_duration_minutes: int
    morning_periods: int
    lunch_start_time: str
    lunch_duration_minutes: int
    afternoon_periods: int
    closing_time: str
    non_teaching_periods: str
    is_default: bool
    updated_at: datetime | None = None


# Platform Settings & Audit Logs
class PlatformSettingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    university_id: str
    platform_name: str
    default_timezone: str
    date_format: str
    time_format: str
    default_language: str
    default_theme: str
    maintenance_mode: bool
    solver_default_time_limit_sec: int
    solver_max_time_limit_sec: int
    solver_max_alternatives: int
    solver_max_concurrent_jobs: int
    solver_allow_dept_override: bool
    solver_weights_json: str
    notify_in_app: bool
    notify_email: bool
    notify_timetable_published: bool
    notify_timetable_changed: bool
    notify_faculty_absence: bool
    notify_swap_requests: bool
    notify_leave_approvals: bool
    min_password_length: int
    require_special_chars: bool
    max_login_attempts: int
    lockout_duration_minutes: int
    session_expiration_minutes: int
    access_token_expire_minutes: int
    data_retention_days: int
    last_backup_at: datetime | None = None
    last_backup_status: str
    updated_at: datetime | None = None


class PlatformSettingUpdate(BaseModel):
    platform_name: str = Field(min_length=2, max_length=120)
    default_timezone: str = Field(min_length=2, max_length=64)
    date_format: str = Field(min_length=4, max_length=32)
    time_format: Literal["12H", "24H"]
    default_language: str = Field(min_length=2, max_length=32)
    default_theme: Literal["dark", "light"]
    maintenance_mode: bool
    solver_default_time_limit_sec: int = Field(ge=5, le=600)
    solver_max_time_limit_sec: int = Field(ge=10, le=1800)
    solver_max_alternatives: int = Field(ge=1, le=10)
    solver_max_concurrent_jobs: int = Field(ge=1, le=16)
    solver_allow_dept_override: bool
    solver_weights_json: str = Field(min_length=2, max_length=2000)
    notify_in_app: bool
    notify_email: bool
    notify_timetable_published: bool
    notify_timetable_changed: bool
    notify_faculty_absence: bool
    notify_swap_requests: bool
    notify_leave_approvals: bool
    min_password_length: int = Field(ge=6, le=32)
    require_special_chars: bool
    max_login_attempts: int = Field(ge=3, le=20)
    lockout_duration_minutes: int = Field(ge=1, le=1440)
    session_expiration_minutes: int = Field(ge=15, le=10080)
    access_token_expire_minutes: int = Field(ge=5, le=1440)
    data_retention_days: int = Field(ge=30, le=3650)


class AuditLogRichOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    university_id: str | None = None
    user_id: str | None = None
    user_name: str
    user_role: str
    action: str
    module: str
    entity_type: str
    entity_id: str
    ip_address: str
    result: str
    details: str
    created_at: datetime


class SuperAdminDashboardOut(BaseModel):
    university: UniversityOut
    kpis: dict
    departments: list[DepartmentRichOut]
    scheduling_health: dict
    charts: dict
    recent_activities: list[AuditLogRichOut]
    current_academic_year: AcademicYearOut | None = None
    active_semesters: list[SemesterOut]
