import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.base import Base, SessionLocal, engine
from app.db.migrations import ensure_schema_columns
from app.db.seed import seed_database


@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    ensure_schema_columns(engine)
    db = SessionLocal()
    seed_database(db)
    db.close()
    with TestClient(app) as c:
        yield c


def _get_demo_token(client: TestClient, role: str) -> str:
    res = client.post("/api/v1/auth/demo-login", json={"role": role})
    assert res.status_code == 200, f"Failed demo-login for {role}: {res.text}"
    return res.json()["access_token"]


def test_demo_login_all_four_roles(client: TestClient):
    for role in ["SUPER_ADMIN", "DEPT_ADMIN", "FACULTY", "STUDENT"]:
        token = _get_demo_token(client, role)
        assert token and len(token) > 20


def test_invalid_jwt_rejected(client: TestClient):
    res = client.get(
        "/api/v1/admin/analytics",
        headers={"Authorization": "Bearer invalid.token.payload"},
    )
    assert res.status_code == 401


def test_super_admin_can_create_departments(client: TestClient):
    token = _get_demo_token(client, "SUPER_ADMIN")
    res = client.post(
        "/api/v1/admin/departments",
        json={"name": "Mechanical Engineering", "code": "MECH"},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Either 201 or 409 if already exists
    assert res.status_code in (201, 409)


def test_super_admin_can_provision_dept_admin(client: TestClient):
    token = _get_demo_token(client, "SUPER_ADMIN")
    res = client.post(
        "/api/v1/admin/users",
        json={
            "email": "new.hod.mech@bharattech.edu.in",
            "full_name": "Prof. R. Sharma",
            "password": "Password@2026",
            "role": "DEPT_ADMIN",
            "department_id": "dept-cse",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code in (201, 409)


def test_dept_admin_cannot_create_super_admin(client: TestClient):
    token = _get_demo_token(client, "DEPT_ADMIN")
    res = client.post(
        "/api/v1/admin/dept/users",
        json={
            "email": "attacker@bharattech.edu.in",
            "full_name": "Hacker",
            "password": "Password@2026",
            "role": "SUPER_ADMIN",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_dept_admin_can_create_faculty_in_own_dept(client: TestClient):
    token = _get_demo_token(client, "DEPT_ADMIN")
    res = client.post(
        "/api/v1/admin/dept/users",
        json={
            "email": "faculty.new@bharattech.edu.in",
            "full_name": "Dr. Naveen Kumar",
            "password": "Password@2026",
            "role": "FACULTY",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code in (201, 409)


def test_dept_admin_cannot_access_super_admin_analytics(client: TestClient):
    token = _get_demo_token(client, "DEPT_ADMIN")
    res = client.get(
        "/api/v1/admin/analytics",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_faculty_cannot_publish_timetable(client: TestClient):
    token = _get_demo_token(client, "FACULTY")
    res = client.post(
        "/api/v1/timetable/publish",
        json={"notes": "Illegal publish by faculty"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_student_read_only_timetable_access(client: TestClient):
    token = _get_demo_token(client, "STUDENT")
    # Reading student timetable works
    res = client.get(
        "/api/v1/timetable/entries",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200

    # Student trying to modify timetable entries is rejected
    res = client.post(
        "/api/v1/timetable/entries",
        json={
            "course_id": "course-cs501",
            "faculty_id": "fac-rohan",
            "room_id": "room-lh101",
            "batch_id": "batch-cse-5a",
            "day_of_week": "MON",
            "period_index": 1,
            "session_type": "THEORY",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_cross_department_isolation(client: TestClient):
    # Faculty from CSE trying to access ECE department timetable
    token = _get_demo_token(client, "FACULTY")
    res = client.get(
        "/api/v1/timetable/entries?department_id=dept-ece",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403
