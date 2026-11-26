import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.api.v1.endpoints.faculty import (
    create_faculty,
    deactivate_faculty,
    list_faculty,
    update_faculty,
)
from app.db.base import Base
from app.db.seed import seed_database
from app.models.scheduling import AuditLog, TimetableVersion, User
from app.schemas.faculty import FacultyCreate, FacultyUpdate
from app.services.timetable_validator import validate_timetable_entry


def faculty_payload(**changes):
    values = {
        "employee_code": " cse-900 ",
        "name": "Dr. Test Faculty",
        "email": "test.faculty@bharattech.edu.in",
        "phone_number": "+91 9876543210",
        "designation": "Assistant Professor",
        "qualifications": "PhD Computer Science",
        "eligible_course_ids": ["course-cs501"],
        "max_weekly_hours": 12,
        "working_days": ["MON", "WED", "FRI"],
        "availability": [{
            "day_of_week": "MON", "start_time": "13:00", "end_time": "14:00",
            "availability_type": "UNAVAILABLE", "label": "Research meeting",
        }],
    }
    values.update(changes)
    return values


@pytest.fixture
def department_db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'faculty-crud.db'}")
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        seed_database(db)
        admin = db.scalar(select(User).where(User.role == "DEPT_ADMIN", User.department_id == "dept-cse"))
        assert admin
        yield db, admin
    engine.dispose()


def test_faculty_crud_search_and_audit(department_db):
    db, admin = department_db
    created = create_faculty(FacultyCreate.model_validate(faculty_payload()), admin, db)
    assert created.employee_code == "CSE-900"
    assert created.working_days == ["MON", "WED", "FRI"]
    assert created.eligible_course_ids == ["course-cs501"]
    assert created.availability[0].label == "Research meeting"

    page = list_faculty("Test Faculty", True, 25, 0, None, admin, db)
    assert page.total == 1 and page.items[0].id == created.id

    changed = FacultyUpdate.model_validate(faculty_payload(
        name="Dr. Updated Faculty", is_active=False, availability=[], max_weekly_hours=10,
    ))
    updated = update_faculty(created.id, changed, admin, db)
    assert updated.name == "Dr. Updated Faculty" and not updated.is_active
    audit_actions = db.scalars(select(AuditLog.action).where(AuditLog.entity_id == created.id)).all()
    assert "FACULTY_CREATED" in audit_actions and "FACULTY_UPDATED" in audit_actions

    active_page = list_faculty(None, True, 25, 0, None, admin, db)
    inactive_page = list_faculty(None, False, 25, 0, None, admin, db)
    assert all(item.id != created.id for item in active_page.items)
    assert any(item.id == created.id for item in inactive_page.items)

    reactivated = deactivate_faculty(created.id, admin, db)
    assert not reactivated.is_active
    assert "FACULTY_DEACTIVATED" in db.scalars(select(AuditLog.action).where(AuditLog.entity_id == created.id)).all()


def test_faculty_eligibility_and_unavailable_intervals_are_hard_rules(department_db):
    db, admin = department_db
    faculty = create_faculty(FacultyCreate.model_validate(faculty_payload()), admin, db)
    version = db.scalar(select(TimetableVersion).where(TimetableVersion.department_id == "dept-cse"))
    assert version
    common = dict(
        department_id="dept-cse", version_id=version.id, day_of_week="MON",
        period_index=1, duration_periods=1, faculty_id=faculty.id,
        room_id="room-lh101", batch_id="batch-cse-5a", session_type="THEORY",
    )

    availability_issues = validate_timetable_entry(
        db, **common, course_id="course-cs501", start_time="13:00", end_time="14:00",
    )
    assert any(issue.code == "FACULTY_UNAVAILABLE" for issue in availability_issues)

    eligibility_issues = validate_timetable_entry(
        db, **common, course_id="course-cs502", start_time="10:00", end_time="11:00",
    )
    assert any(issue.code == "FACULTY_NOT_ELIGIBLE" for issue in eligibility_issues)


def test_faculty_course_eligibility_cannot_cross_department(department_db):
    db, admin = department_db
    with pytest.raises(HTTPException) as error:
        create_faculty(FacultyCreate.model_validate(faculty_payload(eligible_course_ids=["course-other"])), admin, db)
    assert error.value.status_code == 422


def test_faculty_email_duplicate_is_rejected_within_department(department_db):
    db, admin = department_db
    create_faculty(FacultyCreate.model_validate(faculty_payload()), admin, db)
    with pytest.raises(HTTPException) as error:
        create_faculty(FacultyCreate.model_validate(faculty_payload(employee_code="CSE-901")), admin, db)
    assert error.value.status_code == 409


def test_faculty_search_rejects_cross_department_scope(department_db):
    db, admin = department_db
    with pytest.raises(HTTPException) as error:
        list_faculty(None, None, 25, 0, "dept-another", admin, db)
    assert error.value.status_code == 403
