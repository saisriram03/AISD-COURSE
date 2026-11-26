import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class University(Base):
    __tablename__ = "universities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    logo_url: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    university_type: Mapped[str] = mapped_column(String(64), nullable=False, default="Private Autonomous University")
    established_year: Mapped[int | None] = mapped_column(Integer, nullable=True, default=1998)
    accreditation: Mapped[str] = mapped_column(String(200), nullable=False, default="NAAC A+ · NBA Accredited")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    website: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    official_email: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    contact_number: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    alternate_number: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    address: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    city: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    state: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    country: Mapped[str] = mapped_column(String(100), nullable=False, default="India")
    postal_code: Mapped[str] = mapped_column(String(24), nullable=False, default="")
    tenant_status: Mapped[str] = mapped_column(String(24), nullable=False, default="ACTIVE")
    default_timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Kolkata")
    default_working_days: Mapped[str] = mapped_column(String(120), nullable=False, default="MON,TUE,WED,THU,FRI,SAT")
    default_semester_structure: Mapped[str] = mapped_column(String(64), nullable=False, default="ODD_EVEN")
    governance_policies: Mapped[str] = mapped_column(Text, nullable=False, default="")
    scheduling_policies: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    university_id: Mapped[str] = mapped_column(ForeignKey("universities.id"), nullable=False, index=True)
    campus_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    hod_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    hod_name: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    contact_email: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    contact_number: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="ACTIVE", index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    __table_args__ = (UniqueConstraint("university_id", "code", name="uq_dept_univ_code"),)


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    access_level: Mapped[str] = mapped_column(String(64), nullable=False, default="")


class UserRoleAssignment(Base):
    __tablename__ = "user_roles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)


class Student(Base):
    __tablename__ = "students"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    batch_id: Mapped[str] = mapped_column(ForeignKey("batches.id"), nullable=False, index=True)
    roll_number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    university_id: Mapped[str] = mapped_column(ForeignKey("universities.id"), nullable=False, index=True)
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    faculty_id: Mapped[str | None] = mapped_column(ForeignKey("faculty.id"), nullable=True, index=True)
    batch_id: Mapped[str | None] = mapped_column(ForeignKey("batches.id"), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    avatar_initials: Mapped[str] = mapped_column(String(8), nullable=False, default="US")
    phone_number: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    designation: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    invite_status: Mapped[str] = mapped_column(String(24), nullable=False, default="ACCEPTED")  # ACCEPTED | PENDING
    invite_token: Mapped[str | None] = mapped_column(String(128), nullable=True)
    invite_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Faculty(Base):
    __tablename__ = "faculty"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    employee_code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(200), nullable=False)
    designation: Mapped[str] = mapped_column(String(100), nullable=False, default="Assistant Professor")
    qualifications: Mapped[str] = mapped_column(Text, nullable=False, default="")
    max_weekly_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=18)
    phone_number: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    working_days: Mapped[str] = mapped_column(String(32), nullable=False, default="MON,TUE,WED,THU,FRI,SAT")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class FacultyAvailability(Base):
    """Faculty preference or unavailable weekly time interval, stored in local 24-hour time."""

    __tablename__ = "faculty_availability"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    faculty_id: Mapped[str] = mapped_column(ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week: Mapped[str] = mapped_column(String(3), nullable=False)
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    availability_type: Mapped[str] = mapped_column(String(16), nullable=False, default="UNAVAILABLE")
    label: Mapped[str] = mapped_column(String(100), nullable=False, default="")


class FacultyCourseEligibility(Base):
    __tablename__ = "faculty_course_eligibility"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    faculty_id: Mapped[str] = mapped_column(ForeignKey("faculty.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)

    __table_args__ = (UniqueConstraint("faculty_id", "course_id", name="uq_faculty_course_eligibility"),)


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    course_type: Mapped[str] = mapped_column(String(24), nullable=False, default="THEORY")  # THEORY | PRACTICAL | TUTORIAL
    weekly_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    session_duration: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    session_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    required_qualification: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    required_room_type: Mapped[str] = mapped_column(String(24), nullable=False, default="ANY")
    required_equipment: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    color_token: Mapped[str] = mapped_column(String(32), nullable=False, default="#7c5cff")

    __table_args__ = (UniqueConstraint("department_id", "code", name="uq_course_dept_code"),)


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    room_number: Mapped[str] = mapped_column(String(32), nullable=False)
    building: Mapped[str] = mapped_column(String(120), nullable=False)
    room_type: Mapped[str] = mapped_column(String(24), nullable=False, default="CLASSROOM")  # CLASSROOM | LAB
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    features: Mapped[str] = mapped_column(Text, nullable=False, default="")

    __table_args__ = (UniqueConstraint("department_id", "room_number", name="uq_room_dept_num"),)


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    academic_year: Mapped[str] = mapped_column(String(32), nullable=False, default="2026-27")
    semester: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    section: Mapped[str] = mapped_column(String(16), nullable=False, default="A")
    student_strength: Mapped[int] = mapped_column(Integer, nullable=False, default=58)


class CourseBatchEligibility(Base):
    __tablename__ = "course_batch_eligibility"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_id: Mapped[str] = mapped_column(ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True)

    __table_args__ = (UniqueConstraint("course_id", "batch_id", name="uq_course_batch_eligibility"),)


class CourseAssignment(Base):
    """A course/faculty/batch teaching requirement used by manual validation and the solver."""

    __tablename__ = "course_assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    faculty_id: Mapped[str] = mapped_column(ForeignKey("faculty.id"), nullable=False, index=True)
    batch_id: Mapped[str] = mapped_column(ForeignKey("batches.id"), nullable=False, index=True)
    weekly_session_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    required_room_type: Mapped[str] = mapped_column(String(24), nullable=False, default="ANY")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ACTIVE", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    __table_args__ = (UniqueConstraint("course_id", "faculty_id", "batch_id", name="uq_course_assignment_resources"),)


class TimeSlot(Base):
    __tablename__ = "time_slots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    period_index: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(32), nullable=False)
    start_time: Mapped[str] = mapped_column(String(16), nullable=False)
    end_time: Mapped[str] = mapped_column(String(16), nullable=False)
    is_break: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (UniqueConstraint("department_id", "period_index", name="uq_slot_dept_idx"),)


class DepartmentOperatingDay(Base):
    """Department-specific opening window for one weekday (24-hour HH:MM values)."""

    __tablename__ = "department_operating_days"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week: Mapped[str] = mapped_column(String(3), nullable=False)
    is_open: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    opening_time: Mapped[str] = mapped_column(String(5), nullable=False, default="09:00")
    closing_time: Mapped[str] = mapped_column(String(5), nullable=False, default="17:00")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    __table_args__ = (UniqueConstraint("department_id", "day_of_week", name="uq_operating_day_dept_day"),)


class SchedulePeriod(Base):
    """A day-specific teaching, break, or non-teaching interval."""

    __tablename__ = "schedule_periods"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week: Mapped[str] = mapped_column(String(3), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    period_type: Mapped[str] = mapped_column(String(20), nullable=False, default="TEACHING")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    __table_args__ = (UniqueConstraint("department_id", "day_of_week", "sort_order", name="uq_schedule_period_dept_day_order"),)


class DepartmentSoftConstraint(Base):
    """Department-configured objective weights consumed by scheduling optimization."""

    __tablename__ = "department_soft_constraints"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id", ondelete="CASCADE"), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(64), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    weight: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    __table_args__ = (UniqueConstraint("department_id", "key", name="uq_soft_constraint_dept_key"),)


class TimetableVersion(Base):
    __tablename__ = "timetable_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="PUBLISHED")  # DRAFT | PUBLISHED | ARCHIVED
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="Initial published timetable")
    created_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    entries: Mapped[list["TimetableEntry"]] = relationship(
        back_populates="version", cascade="all, delete-orphan"
    )


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    version_id: Mapped[str] = mapped_column(ForeignKey("timetable_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    day_of_week: Mapped[str] = mapped_column(String(16), nullable=False, index=True)  # MON..SAT
    period_index: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    duration_periods: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Nullable while older timetable rows are lazily interpreted from their legacy slot indices.
    start_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    end_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), nullable=False, index=True)
    faculty_id: Mapped[str] = mapped_column(ForeignKey("faculty.id"), nullable=False, index=True)
    room_id: Mapped[str] = mapped_column(ForeignKey("rooms.id"), nullable=False, index=True)
    batch_id: Mapped[str] = mapped_column(ForeignKey("batches.id"), nullable=False, index=True)
    session_type: Mapped[str] = mapped_column(String(24), nullable=False, default="THEORY")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    version: Mapped["TimetableVersion"] = relationship(back_populates="entries")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    target_role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="TIMETABLE_UPDATE")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    university_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    user_name: Mapped[str] = mapped_column(String(160), nullable=False, default="System")
    user_role: Mapped[str] = mapped_column(String(32), nullable=False, default="SYSTEM")
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    module: Mapped[str] = mapped_column(String(64), nullable=False, default="GOVERNANCE", index=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    ip_address: Mapped[str] = mapped_column(String(64), nullable=False, default="127.0.0.1")
    result: Mapped[str] = mapped_column(String(24), nullable=False, default="SUCCESS")
    details: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
