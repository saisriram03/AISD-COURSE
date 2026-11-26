import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base, get_db
from app.db.seed import seed_database
from app.main import app


@pytest.fixture()
def client(tmp_path):
    db_file = tmp_path / "test_smartsched.db"
    test_engine = create_engine(
        f"sqlite:///{db_file}", connect_args={"check_same_thread": False}, future=True
    )
    TestingSessionLocal = sessionmaker(
        bind=test_engine, autoflush=False, autocommit=False, expire_on_commit=False
    )
    Base.metadata.create_all(bind=test_engine)

    seed_db = TestingSessionLocal()
    try:
        seed_database(seed_db)
    finally:
        seed_db.close()

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    test_engine.dispose()


def _demo_token(client: TestClient, role: str) -> str:
    res = client.post("/api/v1/auth/demo-login", json={"role": role})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def test_admin_edit_syncs_to_faculty_and_student(client: TestClient):
    admin_token = _demo_token(client, "DEPT_ADMIN")
    faculty_token = _demo_token(client, "FACULTY")
    student_token = _demo_token(client, "STUDENT")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    faculty_headers = {"Authorization": f"Bearer {faculty_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # Admin creates a new class for Dr. Rohan Kulkarni & B.Tech CSE Sem 5 Sec A on FRI P5
    create_res = client.post(
        "/api/v1/timetable/entries",
        headers=admin_headers,
        json={
            "day_of_week": "FRI",
            "period_index": 5,
            "duration_periods": 1,
            "course_id": "course-cs501",
            "faculty_id": "fac-rohan",
            "room_id": "room-lh101",
            "batch_id": "batch-cse-5a",
            "session_type": "THEORY",
            "notes": "Extra OS tutorial",
            "publish_immediately": True,
        },
    )
    assert create_res.status_code == 201, create_res.text
    created = create_res.json()

    # Faculty timetable immediately reflects the new entry
    fac_res = client.get("/api/v1/timetable/faculty-view", headers=faculty_headers)
    assert fac_res.status_code == 200
    assert any(
        e["day_of_week"] == "FRI" and e["period_index"] == 5 and e["course_code"] == "CS501"
        for e in fac_res.json()["entries"]
    )

    # Student timetable immediately reflects the new entry
    stu_res = client.get("/api/v1/timetable/student-view", headers=student_headers)
    assert stu_res.status_code == 200
    assert any(
        e["day_of_week"] == "FRI" and e["period_index"] == 5 and e["course_code"] == "CS501"
        for e in stu_res.json()["entries"]
    )

    # Admin moves that class from FRI P5 to SAT P1
    update_res = client.put(
        f"/api/v1/timetable/entries/{created['id']}",
        headers=admin_headers,
        json={
            "day_of_week": "SAT",
            "period_index": 1,
            "duration_periods": 1,
            "course_id": "course-cs501",
            "faculty_id": "fac-rohan",
            "room_id": "room-lh102",
            "batch_id": "batch-cse-5a",
            "session_type": "THEORY",
            "notes": "Moved to Saturday morning",
            "publish_immediately": True,
        },
    )
    assert update_res.status_code == 200, update_res.text

    fac_after = client.get("/api/v1/timetable/faculty-view", headers=faculty_headers).json()
    stu_after = client.get("/api/v1/timetable/student-view", headers=student_headers).json()

    assert any(
        e["day_of_week"] == "SAT" and e["period_index"] == 1 and e["room_number"] == "LH-102"
        for e in fac_after["entries"]
    )
    assert any(
        e["day_of_week"] == "SAT" and e["period_index"] == 1 and e["room_number"] == "LH-102"
        for e in stu_after["entries"]
    )


def test_hard_constraint_rejects_faculty_and_break_clash(client: TestClient):
    admin_token = _demo_token(client, "DEPT_ADMIN")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Break overlap (period 3 is Break)
    break_res = client.post(
        "/api/v1/timetable/entries",
        headers=headers,
        json={
            "day_of_week": "MON",
            "period_index": 3,
            "duration_periods": 1,
            "course_id": "course-cs501",
            "faculty_id": "fac-rohan",
            "room_id": "room-lh101",
            "batch_id": "batch-cse-5a",
            "session_type": "THEORY",
            "publish_immediately": True,
        },
    )
    assert break_res.status_code == 409

    # Faculty clash (Dr. Rohan already teaches MON P1 in LH-101 to Sec A)
    clash_res = client.post(
        "/api/v1/timetable/entries",
        headers=headers,
        json={
            "day_of_week": "MON",
            "period_index": 1,
            "duration_periods": 1,
            "course_id": "course-cs502",
            "faculty_id": "fac-rohan",
            "room_id": "room-lh102",
            "batch_id": "batch-cse-5b",
            "session_type": "THEORY",
            "publish_immediately": True,
        },
    )
    assert clash_res.status_code == 409
    assert any(c["code"] == "FACULTY_CLASH" for c in clash_res.json()["detail"]["conflicts"])


def test_student_cannot_modify_timetable(client: TestClient):
    student_token = _demo_token(client, "STUDENT")
    res = client.post(
        "/api/v1/timetable/entries",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "day_of_week": "SAT",
            "period_index": 2,
            "duration_periods": 1,
            "course_id": "course-cs501",
            "faculty_id": "fac-rohan",
            "room_id": "room-lh101",
            "batch_id": "batch-cse-5a",
            "session_type": "THEORY",
            "publish_immediately": True,
        },
    )
    assert res.status_code == 403
