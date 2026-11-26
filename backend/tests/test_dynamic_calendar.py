import pytest
from pydantic import ValidationError

from app.schemas.calendar import DepartmentScheduleIn


def configuration():
    return {
        "operating_days": [
            {
                "day_of_week": day,
                "is_open": day != "SUN",
                "opening_time": "07:00",
                "closing_time": "21:00",
            }
            for day in ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")
        ],
        "periods": [
            {
                "day_of_week": "MON",
                "name": "Evening lab",
                "start_time": "19:00",
                "end_time": "21:00",
                "period_type": "TEACHING",
                "enabled": True,
                "sort_order": 1,
            },
            {
                "day_of_week": "MON",
                "name": "Dinner break",
                "start_time": "18:30",
                "end_time": "19:00",
                "period_type": "BREAK",
                "enabled": True,
                "sort_order": 0,
            },
        ],
    }


def test_dynamic_calendar_accepts_evening_and_variable_duration_periods():
    schedule = DepartmentScheduleIn.model_validate(configuration())
    assert next(day for day in schedule.operating_days if day.day_of_week == "MON").closing_time == "21:00"
    assert next(period for period in schedule.periods if period.name == "Evening lab").start_time == "19:00"


@pytest.mark.parametrize(
    "change",
    [
        lambda data: data["periods"][0].update(start_time="21:00"),
        lambda data: data["periods"][0].update(start_time="18:45"),
        lambda data: data["operating_days"][0].update(closing_time="06:59"),
        lambda data: data["operating_days"].pop(),
        lambda data: data["periods"][0].update(start_time="25:00"),
    ],
)
def test_dynamic_calendar_rejects_invalid_configuration(change):
    data = configuration()
    change(data)
    with pytest.raises(ValidationError):
        DepartmentScheduleIn.model_validate(data)


def test_schedule_endpoint_persists_configuration_and_audit_log(tmp_path):
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session

    from app.api.v1.endpoints.calendar import get_department_schedule, save_department_schedule
    from app.db.base import Base
    from app.db.seed import seed_database
    from app.models.scheduling import AuditLog, User

    engine = create_engine(f"sqlite:///{tmp_path / 'calendar-api.db'}")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        seed_database(db)
        admin = db.scalar(select(User).where(User.role == "DEPT_ADMIN", User.department_id == "dept-cse"))
        assert admin is not None
        payload = DepartmentScheduleIn.model_validate(configuration())
        saved = save_department_schedule(payload, None, admin, db)
        loaded = get_department_schedule(None, admin, db)
        assert loaded == saved
        assert any(period.name == "Evening lab" and period.start_time == "19:00" for period in loaded.periods)
        audit = db.scalar(select(AuditLog).where(AuditLog.action == "DEPARTMENT_SCHEDULE_UPDATED"))
        assert audit is not None and audit.entity_id == "dept-cse"
    engine.dispose()


def test_closed_weekday_cannot_have_enabled_period():
    data = configuration()
    data["operating_days"][0]["is_open"] = False
    with pytest.raises(ValidationError):
        DepartmentScheduleIn.model_validate(data)


def test_manual_session_accepts_configured_evening_time_and_checks_breaks(tmp_path):
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session

    from app.db.base import Base
    from app.db.seed import seed_database
    from app.models.scheduling import (
        DepartmentOperatingDay,
        Faculty,
        SchedulePeriod,
        TimetableVersion,
    )
    from app.services.timetable_validator import validate_timetable_entry
    from app.api.v1.endpoints.calendar import _published_schedule_impact

    engine = create_engine(f"sqlite:///{tmp_path / 'interval-test.db'}")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        seed_database(db)
        version = db.scalar(select(TimetableVersion).where(TimetableVersion.department_id == "dept-cse"))
        assert version is not None
        compressed_hours = DepartmentScheduleIn.model_validate({
            "operating_days": [
                {"day_of_week": day, "is_open": True, "opening_time": "17:00", "closing_time": "21:00"}
                for day in ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")
            ],
            "periods": [],
        })
        assert _published_schedule_impact(db, "dept-cse", compressed_hours)
        db.add(DepartmentOperatingDay(
            department_id="dept-cse", day_of_week="SUN", is_open=True,
            opening_time="07:00", closing_time="21:00",
        ))
        db.add(SchedulePeriod(
            department_id="dept-cse", day_of_week="SUN", name="Evening break",
            start_time="18:00", end_time="18:30", period_type="BREAK", enabled=True, sort_order=1,
        ))
        db.add(SchedulePeriod(
            department_id="dept-cse", day_of_week="SUN", name="Disabled period",
            start_time="17:00", end_time="17:30", period_type="TEACHING", enabled=False, sort_order=0,
        ))
        sunday_faculty = db.get(Faculty, "fac-rohan")
        assert sunday_faculty is not None
        sunday_faculty.working_days = "MON,TUE,WED,THU,FRI,SAT,SUN"
        db.commit()
        base = dict(
            department_id="dept-cse", version_id=version.id, day_of_week="SUN",
            period_index=1, duration_periods=1, course_id="course-cs501",
            faculty_id="fac-rohan", room_id="room-lh101", batch_id="batch-cse-5a",
            session_type="THEORY",
        )
        valid = validate_timetable_entry(db, **base, start_time="19:00", end_time="20:30")
        assert not valid
        break_overlap = validate_timetable_entry(db, **base, start_time="17:45", end_time="18:15")
        assert any(issue.code == "BREAK_OVERLAP" for issue in break_overlap)
        disabled_overlap = validate_timetable_entry(db, **base, start_time="17:15", end_time="17:45")
        assert any("Disabled period" in issue.message for issue in disabled_overlap)
        outside = validate_timetable_entry(db, **base, start_time="20:30", end_time="21:30")
        assert any(issue.code == "OUTSIDE_OPERATING_HOURS" for issue in outside)

        missing_day = validate_timetable_entry(
            db,
            **{**base, "day_of_week": "TUE"},
            start_time="19:00", end_time="20:00",
        )
        assert not any(issue.code == "OPERATING_HOURS_UNCONFIGURED" for issue in missing_day)
    engine.dispose()


def test_manual_session_enforces_faculty_weekly_hour_limit(tmp_path):
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session

    from app.db.base import Base
    from app.db.seed import seed_database
    from app.models.scheduling import Faculty, TimetableVersion
    from app.services.timetable_validator import validate_timetable_entry

    engine = create_engine(f"sqlite:///{tmp_path / 'weekly-limit.db'}")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        seed_database(db)
        faculty = db.get(Faculty, "fac-rohan")
        version = db.scalar(select(TimetableVersion).where(TimetableVersion.department_id == "dept-cse"))
        assert faculty and version
        faculty.max_weekly_hours = 0
        db.commit()
        issues = validate_timetable_entry(
            db,
            department_id="dept-cse", version_id=version.id, day_of_week="MON",
            period_index=1, duration_periods=1, course_id="course-cs501",
            faculty_id=faculty.id, room_id="room-lh101", batch_id="batch-cse-5a",
            session_type="THEORY", start_time="09:00", end_time="10:00",
        )
        assert any(issue.code == "FACULTY_WEEKLY_HOURS" for issue in issues)
    engine.dispose()


def test_constraint_preferences_persist_department_scoped_and_audited(tmp_path):
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session

    from app.api.v1.endpoints.constraints import get_constraints, save_constraints
    from app.db.base import Base
    from app.db.seed import seed_database
    from app.models.scheduling import AuditLog, User
    from app.schemas.constraints import ConstraintConfigurationIn, SOFT_CONSTRAINTS

    engine = create_engine(f"sqlite:///{tmp_path / 'constraints-api.db'}")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        seed_database(db)
        admin = db.scalar(select(User).where(User.role == "DEPT_ADMIN", User.department_id == "dept-cse"))
        assert admin
        defaults = get_constraints(None, admin, db)
        assert len(defaults.hard_constraints) >= 10
        assert all(item.weight == 50 and item.enabled for item in defaults.soft_constraints)
        payload = ConstraintConfigurationIn.model_validate({
            "soft_constraints": [
                {"key": key, "enabled": key != "student_gaps", "weight": 80 if key == "workload_balance" else 35}
                for key in SOFT_CONSTRAINTS
            ],
        })
        saved = save_constraints(payload, None, admin, db)
        loaded = get_constraints(None, admin, db)
        assert saved == loaded
        by_key = {item.key: item for item in loaded.soft_constraints}
        assert by_key["workload_balance"].weight == 80
        assert not by_key["student_gaps"].enabled
        assert db.scalar(select(AuditLog).where(AuditLog.action == "SCHEDULING_CONSTRAINTS_UPDATED"))
    engine.dispose()
