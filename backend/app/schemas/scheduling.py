import re
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

DayOfWeek = Literal["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
UserRole = Literal["SUPER_ADMIN", "DEPT_ADMIN", "FACULTY", "STUDENT"]
SessionType = Literal["THEORY", "PRACTICAL", "TUTORIAL"]


class UserOut(BaseModel):
    id: str
    email: EmailStr
    fullName: str
    role: UserRole
    universityId: str
    universityName: str
    departmentId: str | None = None
    departmentName: str | None = None
    facultyId: str | None = None
    batchId: str | None = None
    batchLabel: str | None = None
    isActive: bool
    avatarInitials: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Literal["DEPT_ADMIN", "FACULTY", "STUDENT"] = "DEPT_ADMIN"


class DemoLoginRequest(BaseModel):
    role: UserRole


class RefreshRequest(BaseModel):
    refresh_token: str


class LoginResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str
    expires_in: int


class FacultyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    employee_code: str
    name: str
    email: str
    designation: str
    qualifications: str
    max_weekly_hours: int


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    code: str
    name: str
    semester: int
    course_type: str
    weekly_hours: int
    session_duration: int
    color_token: str


class RoomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    room_number: str
    building: str
    room_type: str
    capacity: int
    features: str


class BatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    academic_year: str
    semester: int
    section: str
    student_strength: int


class TimeSlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    period_index: int
    label: str
    start_time: str
    end_time: str
    is_break: bool
    applicable_days: list[str] = Field(default_factory=list)
    blocked_days: list[str] = Field(default_factory=list)


class TimetableVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    version_number: int
    status: str
    notes: str
    created_at: datetime
    published_at: datetime | None = None


class TimetableMetadataOut(BaseModel):
    department_id: str
    department_name: str
    faculty: list[FacultyOut]
    courses: list[CourseOut]
    rooms: list[RoomOut]
    batches: list[BatchOut]
    time_slots: list[TimeSlotOut]
    active_version: TimetableVersionOut | None = None
    versions: list[TimetableVersionOut] = []


class TimetableEntryCreate(BaseModel):
    day_of_week: DayOfWeek
    period_index: int | None = Field(default=None, ge=1)
    duration_periods: int = Field(default=1, ge=1)
    start_time: str | None = None
    end_time: str | None = None
    course_id: str
    faculty_id: str
    room_id: str
    batch_id: str
    session_type: SessionType = "THEORY"
    notes: str = Field(default="", max_length=300)
    publish_immediately: bool = True

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_optional_clock_time(cls, value: str | None) -> str | None:
        if value is not None and not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
            raise ValueError("Time must use 24-hour HH:MM format.")
        return value

    @model_validator(mode="after")
    def validate_interval_pair(self):
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError("Provide both start_time and end_time, or neither.")
        if self.start_time is not None and self.start_time >= self.end_time:
            raise ValueError("end_time must be later than start_time.")
        if self.start_time is None and self.period_index is None:
            raise ValueError("Provide a period_index for a legacy slot or an explicit time interval.")
        return self


class TimetableEntryUpdate(BaseModel):
    day_of_week: DayOfWeek
    period_index: int | None = Field(default=None, ge=1)
    duration_periods: int = Field(default=1, ge=1)
    start_time: str | None = None
    end_time: str | None = None
    course_id: str
    faculty_id: str
    room_id: str
    batch_id: str
    session_type: SessionType = "THEORY"
    notes: str = Field(default="", max_length=300)
    publish_immediately: bool = True

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_optional_clock_time(cls, value: str | None) -> str | None:
        if value is not None and not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
            raise ValueError("Time must use 24-hour HH:MM format.")
        return value

    @model_validator(mode="after")
    def validate_interval_pair(self):
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError("Provide both start_time and end_time, or neither.")
        if self.start_time is not None and self.start_time >= self.end_time:
            raise ValueError("end_time must be later than start_time.")
        if self.start_time is None and self.period_index is None:
            raise ValueError("Provide a period_index for a legacy slot or an explicit time interval.")
        return self


class TimetableEntryOut(BaseModel):
    id: str
    version_id: str
    version_number: int
    day_of_week: str
    period_index: int
    duration_periods: int
    start_time: str
    end_time: str
    course_id: str
    course_code: str
    course_name: str
    course_color: str
    faculty_id: str
    faculty_name: str
    room_id: str
    room_number: str
    room_building: str
    room_type: str
    batch_id: str
    batch_name: str
    session_type: str
    notes: str
    updated_at: datetime


class TimetableResponseOut(BaseModel):
    version: TimetableVersionOut | None
    entries: list[TimetableEntryOut]
    total_entries: int
    entity_label: str | None = None


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    message: str
    category: str
    is_read: bool
    created_at: datetime


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    code: str = Field(min_length=2, max_length=32)


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    code: str
    created_at: datetime


class AdminUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole
    department_id: str | None = None
    batch_id: str | None = None


class UserStatusUpdate(BaseModel):
    is_active: bool


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str | None
    action: str
    entity_type: str
    entity_id: str
    details: str
    created_at: datetime


class UniversityAnalyticsOut(BaseModel):
    total_departments: int
    total_faculty: int
    total_students: int
    total_rooms: int
    total_published_timetables: int
    active_users: int


class DeptAnalyticsOut(BaseModel):
    department_id: str
    department_name: str
    total_faculty: int
    total_courses: int
    total_batches: int
    total_rooms: int
    timetable_version: int
    total_classes_scheduled: int
    unresolved_conflicts: int

