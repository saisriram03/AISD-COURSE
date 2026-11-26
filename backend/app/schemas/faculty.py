import re
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.scheduling import DayOfWeek


class FacultyAvailabilityIn(BaseModel):
    day_of_week: DayOfWeek
    start_time: str
    end_time: str
    availability_type: Literal["PREFERRED", "UNAVAILABLE"] = "UNAVAILABLE"
    label: str = Field(default="", max_length=100)

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_clock_time(cls, value: str) -> str:
        if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
            raise ValueError("Time must use 24-hour HH:MM format.")
        return value

    @model_validator(mode="after")
    def validate_interval(self):
        if self.start_time >= self.end_time:
            raise ValueError("Availability end time must be later than start time.")
        return self


class FacultyCreate(BaseModel):
    employee_code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    phone_number: str = Field(default="", max_length=32)
    designation: str = Field(default="Assistant Professor", max_length=100)
    qualifications: str = Field(default="", max_length=2000)
    eligible_course_ids: list[str] = Field(default_factory=list)
    max_weekly_hours: int = Field(default=18, ge=1, le=80)
    working_days: list[DayOfWeek] = Field(default_factory=lambda: ["MON", "TUE", "WED", "THU", "FRI", "SAT"])
    availability: list[FacultyAvailabilityIn] = Field(default_factory=list)

    @field_validator("employee_code")
    @classmethod
    def clean_code(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("working_days")
    @classmethod
    def unique_working_days(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("Working days must be unique.")
        return value

    @field_validator("eligible_course_ids")
    @classmethod
    def unique_eligible_courses(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("Eligible courses must be unique.")
        return value

    @model_validator(mode="after")
    def availability_windows_do_not_overlap(self):
        intervals = sorted(
            self.availability,
            key=lambda item: (item.day_of_week, item.availability_type, item.start_time),
        )
        for previous, current in zip(intervals, intervals[1:]):
            if (previous.day_of_week == current.day_of_week
                    and previous.availability_type == current.availability_type
                    and previous.end_time > current.start_time):
                raise ValueError("Availability intervals of the same type cannot overlap on a weekday.")
        return self


class FacultyUpdate(FacultyCreate):
    is_active: bool = True


class FacultyOut(BaseModel):
    id: str
    employee_code: str
    name: str
    email: EmailStr
    phone_number: str
    designation: str
    qualifications: str
    eligible_course_ids: list[str]
    max_weekly_hours: int
    working_days: list[str]
    availability: list[FacultyAvailabilityIn]
    is_active: bool


class FacultyPage(BaseModel):
    items: list[FacultyOut]
    total: int
    limit: int
    offset: int
