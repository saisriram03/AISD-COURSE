import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

DayOfWeek = Literal["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
PeriodType = Literal["TEACHING", "BREAK", "LUNCH", "NON_TEACHING"]
_TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def _validate_time(value: str) -> str:
    if not _TIME_RE.fullmatch(value):
        raise ValueError("Time must use 24-hour HH:MM format.")
    return value


class OperatingDayIn(BaseModel):
    day_of_week: DayOfWeek
    is_open: bool
    opening_time: str
    closing_time: str

    @field_validator("opening_time", "closing_time")
    @classmethod
    def valid_time(cls, value: str) -> str:
        return _validate_time(value)

    @model_validator(mode="after")
    def valid_window(self):
        if self.is_open and self.opening_time >= self.closing_time:
            raise ValueError("Closing time must be later than opening time for an open day.")
        return self


class SchedulePeriodIn(BaseModel):
    day_of_week: DayOfWeek
    name: str = Field(min_length=1, max_length=80)
    start_time: str
    end_time: str
    period_type: PeriodType = "TEACHING"
    enabled: bool = True
    sort_order: int = Field(ge=0)

    @field_validator("start_time", "end_time")
    @classmethod
    def valid_time(cls, value: str) -> str:
        return _validate_time(value)

    @model_validator(mode="after")
    def valid_interval(self):
        if self.start_time >= self.end_time:
            raise ValueError("Period end time must be later than its start time.")
        return self


class DepartmentScheduleIn(BaseModel):
    operating_days: list[OperatingDayIn] = Field(min_length=7, max_length=7)
    periods: list[SchedulePeriodIn] = Field(max_length=300)

    @model_validator(mode="after")
    def validate_configuration(self):
        days = {day.day_of_week: day for day in self.operating_days}
        if len(days) != 7:
            raise ValueError("Provide exactly one operating-hours row for every weekday.")
        by_day: dict[str, list[SchedulePeriodIn]] = {}
        for period in self.periods:
            day = days[period.day_of_week]
            if period.enabled and not day.is_open:
                raise ValueError(f"{period.day_of_week} is closed but has an enabled period.")
            if period.enabled and not (day.opening_time <= period.start_time and period.end_time <= day.closing_time):
                raise ValueError(f"{period.day_of_week} period '{period.name}' falls outside operating hours.")
            by_day.setdefault(period.day_of_week, []).append(period)
        for day, periods in by_day.items():
            orders = [period.sort_order for period in periods]
            if len(orders) != len(set(orders)):
                raise ValueError(f"Period order values must be unique on {day}.")
            ordered = sorted((p for p in periods if p.enabled), key=lambda p: p.start_time)
            for previous, current in zip(ordered, ordered[1:]):
                if current.start_time < previous.end_time:
                    raise ValueError(f"Enabled intervals '{previous.name}' and '{current.name}' overlap on {day}.")
        return self


class OperatingDayOut(OperatingDayIn):
    id: str


class SchedulePeriodOut(SchedulePeriodIn):
    id: str


class DepartmentScheduleOut(BaseModel):
    department_id: str
    operating_days: list[OperatingDayOut]
    periods: list[SchedulePeriodOut]
