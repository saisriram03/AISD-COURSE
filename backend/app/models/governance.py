import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Campus(Base):
    __tablename__ = "campuses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    university_id: Mapped[str] = mapped_column(ForeignKey("universities.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    campus_type: Mapped[str] = mapped_column(String(48), nullable=False, default="MAIN_CAMPUS")
    address: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    city: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    state: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    contact_email: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    contact_number: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    contact_details: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="ACTIVE", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    __table_args__ = (UniqueConstraint("university_id", "code", name="uq_campus_univ_code"),)


class TenantSetting(Base):
    __tablename__ = "tenant_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    university_id: Mapped[str] = mapped_column(ForeignKey("universities.id"), unique=True, nullable=False, index=True)
    enforce_department_isolation: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allow_cross_dept_electives: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    allow_shared_rooms: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    require_super_admin_dept_approval: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    data_ownership_label: Mapped[str] = mapped_column(String(200), nullable=False, default="University Owned & Isolated")
    custom_domain: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class AcademicYear(Base):
    __tablename__ = "academic_years"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    university_id: Mapped[str] = mapped_column(ForeignKey("universities.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. 2026-2027
    start_date: Mapped[str] = mapped_column(String(16), nullable=False)  # YYYY-MM-DD
    end_date: Mapped[str] = mapped_column(String(16), nullable=False)  # YYYY-MM-DD
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="UPCOMING", index=True)  # ACTIVE | UPCOMING | ARCHIVED
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    __table_args__ = (UniqueConstraint("university_id", "name", name="uq_acad_year_univ_name"),)


class Semester(Base):
    __tablename__ = "semesters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    university_id: Mapped[str] = mapped_column(ForeignKey("universities.id"), nullable=False, index=True)
    academic_year_id: Mapped[str] = mapped_column(ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    semester_number: Mapped[int] = mapped_column(Integer, nullable=False)
    term_type: Mapped[str] = mapped_column(String(16), nullable=False, default="ODD")  # ODD | EVEN | SUMMER
    start_date: Mapped[str] = mapped_column(String(16), nullable=False)
    end_date: Mapped[str] = mapped_column(String(16), nullable=False)
    registration_start: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    registration_end: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    exam_start: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    exam_end: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="UPCOMING", index=True)  # ACTIVE | UPCOMING | COMPLETED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Holiday(Base):
    __tablename__ = "holidays"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    university_id: Mapped[str] = mapped_column(ForeignKey("universities.id"), nullable=False, index=True)
    academic_year_id: Mapped[str] = mapped_column(ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    date: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    holiday_type: Mapped[str] = mapped_column(String(32), nullable=False, default="PUBLIC")  # PUBLIC | ACADEMIC | INSTITUTIONAL | RESTRICTED
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    applicable_departments: Mapped[str] = mapped_column(Text, nullable=False, default="ALL")  # ALL or comma-separated dept IDs
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class ExaminationPeriod(Base):
    __tablename__ = "examination_periods"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    university_id: Mapped[str] = mapped_column(ForeignKey("universities.id"), nullable=False, index=True)
    academic_year_id: Mapped[str] = mapped_column(ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False, index=True)
    semester_id: Mapped[str | None] = mapped_column(ForeignKey("semesters.id", ondelete="SET NULL"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    exam_type: Mapped[str] = mapped_column(String(32), nullable=False, default="END_SEMESTER")  # INTERNAL_ASSESSMENT | END_SEMESTER | PRACTICAL | SPECIAL_ACADEMIC
    start_date: Mapped[str] = mapped_column(String(16), nullable=False)
    end_date: Mapped[str] = mapped_column(String(16), nullable=False)
    lock_timetable_edits: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class WorkingDayConfiguration(Base):
    __tablename__ = "working_day_configurations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    university_id: Mapped[str] = mapped_column(ForeignKey("universities.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, default="Standard Academic Schedule")
    working_days: Mapped[str] = mapped_column(String(120), nullable=False, default="MON,TUE,WED,THU,FRI,SAT")
    opening_time: Mapped[str] = mapped_column(String(16), nullable=False, default="08:45")
    first_period_time: Mapped[str] = mapped_column(String(16), nullable=False, default="09:00")
    period_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=55)
    morning_periods: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    lunch_start_time: Mapped[str] = mapped_column(String(16), nullable=False, default="12:40")
    lunch_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    afternoon_periods: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    closing_time: Mapped[str] = mapped_column(String(16), nullable=False, default="16:30")
    non_teaching_periods: Mapped[str] = mapped_column(String(200), nullable=False, default="Library Hour,Mentoring")
    is_default: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    university_id: Mapped[str] = mapped_column(ForeignKey("universities.id"), unique=True, nullable=False, index=True)
    # Tab A: General
    platform_name: Mapped[str] = mapped_column(String(120), nullable=False, default="SMARTSCHED")
    default_timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Kolkata")
    date_format: Mapped[str] = mapped_column(String(32), nullable=False, default="DD/MM/YYYY")
    time_format: Mapped[str] = mapped_column(String(16), nullable=False, default="12H")
    default_language: Mapped[str] = mapped_column(String(32), nullable=False, default="en-IN")
    default_theme: Mapped[str] = mapped_column(String(16), nullable=False, default="dark")
    maintenance_mode: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Tab B: Solver
    solver_default_time_limit_sec: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    solver_max_time_limit_sec: Mapped[int] = mapped_column(Integer, nullable=False, default=180)
    solver_max_alternatives: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    solver_max_concurrent_jobs: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    solver_allow_dept_override: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    solver_weights_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default='{"faculty_preference":80,"gap_minimization":70,"room_utilization":65,"compact_schedule":75}',
    )
    # Tab C: Notifications
    notify_in_app: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_email: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_timetable_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_timetable_changed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_faculty_absence: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_swap_requests: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_leave_approvals: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Tab D: Security
    min_password_length: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    require_special_chars: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    max_login_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    lockout_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    session_expiration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=480)
    access_token_expire_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    # Tab E: Data Management
    data_retention_days: Mapped[int] = mapped_column(Integer, nullable=False, default=365)
    last_backup_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_backup_status: Mapped[str] = mapped_column(String(32), nullable=False, default="NOT_RUN")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
