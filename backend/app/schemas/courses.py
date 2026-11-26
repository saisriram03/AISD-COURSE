from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.scheduling import SessionType

CourseRoomType = Literal["ANY", "CLASSROOM", "LAB"]


class CourseCreate(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=2, max_length=200)
    semester: int = Field(ge=1, le=20)
    course_type: SessionType = "THEORY"
    weekly_hours: int = Field(ge=1, le=168)
    session_duration_minutes: int = Field(default=60, ge=1, le=1440)
    required_qualification: str = Field(default="", max_length=160)
    required_room_type: CourseRoomType = "ANY"
    required_equipment: list[str] = Field(default_factory=list)
    eligible_batch_ids: list[str] = Field(default_factory=list)
    color_token: str = Field(default="#7c5cff", max_length=32)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("required_equipment")
    @classmethod
    def normalize_equipment(cls, values: list[str]) -> list[str]:
        normalized = [value.strip() for value in values if value.strip()]
        if len(normalized) != len({value.casefold() for value in normalized}):
            raise ValueError("Required equipment must not contain duplicates.")
        return normalized

    @field_validator("eligible_batch_ids")
    @classmethod
    def unique_batches(cls, values: list[str]) -> list[str]:
        if len(values) != len(set(values)):
            raise ValueError("Eligible batches must be unique.")
        return values

    @model_validator(mode="after")
    def practical_requires_lab(self):
        if self.course_type == "PRACTICAL" and self.required_room_type == "CLASSROOM":
            raise ValueError("A practical course cannot require a standard classroom.")
        return self


class CourseUpdate(CourseCreate):
    is_active: bool = True


class CourseOut(BaseModel):
    id: str
    code: str
    name: str
    semester: int
    course_type: str
    weekly_hours: int
    session_duration_minutes: int
    required_qualification: str
    required_room_type: str
    required_equipment: list[str]
    eligible_batch_ids: list[str]
    color_token: str
    is_active: bool


class CoursePage(BaseModel):
    items: list[CourseOut]
    total: int
    limit: int
    offset: int


AssignmentStatus = Literal["ACTIVE", "INACTIVE"]


class CourseAssignmentIn(BaseModel):
    course_id: str
    faculty_id: str
    batch_id: str
    weekly_session_count: int = Field(ge=1)
    duration_minutes: int = Field(ge=1, le=1440)
    required_room_type: CourseRoomType = "ANY"
    status: AssignmentStatus = "ACTIVE"


class CourseAssignmentUpdate(CourseAssignmentIn):
    pass


class CourseAssignmentOut(BaseModel):
    id: str
    course_id: str
    course_code: str
    course_name: str
    faculty_id: str
    faculty_name: str
    batch_id: str
    batch_name: str
    weekly_session_count: int
    duration_minutes: int
    required_room_type: str
    status: str


class CourseAssignmentPage(BaseModel):
    items: list[CourseAssignmentOut]
    total: int
    limit: int
    offset: int
