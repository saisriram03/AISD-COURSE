from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


SOFT_CONSTRAINTS = {
    "faculty_preferences": "Honor faculty preferred teaching times",
    "student_gaps": "Minimize gaps in student batch days",
    "workload_balance": "Balance weekly teaching load across faculty",
    "consecutive_classes": "Avoid excessive consecutive teaching",
    "weekday_distribution": "Spread sessions across working weekdays",
    "room_utilization": "Improve classroom utilization",
    "lab_utilization": "Improve laboratory utilization",
    "late_day_preference": "Prefer earlier sessions when other choices are equal",
    "schedule_stability": "Minimize changes from the current timetable",
    "undesirable_patterns": "Avoid undesirable timetable patterns",
}


class HardConstraintStatus(BaseModel):
    key: str
    label: str
    status: Literal["ENFORCED", "PARTIAL", "NOT_IMPLEMENTED"]
    explanation: str


class SoftConstraintSetting(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    key: str
    label: str
    enabled: bool
    weight: int = Field(ge=0, le=100)


class SoftConstraintSettingIn(BaseModel):
    key: str
    enabled: bool
    weight: int = Field(ge=0, le=100)


class ConstraintConfigurationIn(BaseModel):
    soft_constraints: list[SoftConstraintSettingIn]

    @model_validator(mode="after")
    def validate_constraint_set(self):
        keys = [setting.key for setting in self.soft_constraints]
        if len(keys) != len(set(keys)):
            raise ValueError("Soft constraint keys must be unique.")
        if set(keys) != set(SOFT_CONSTRAINTS):
            raise ValueError("Provide exactly the supported soft constraints.")
        return self


class ConstraintConfigurationOut(BaseModel):
    department_id: str
    hard_constraints: list[HardConstraintStatus]
    soft_constraints: list[SoftConstraintSetting]
