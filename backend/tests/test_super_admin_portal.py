import pytest
from fastapi.testclient import TestClient

from app.db.base import Base, SessionLocal, engine
from app.db.migrations import ensure_schema_columns
from app.db.seed import seed_database
from app.main import app


@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    ensure_schema_columns(engine)
    db = SessionLocal()
    seed_database(db)
    db.close()
    with TestClient(app) as c:
        yield c


def _token(client: TestClient, role: str) -> str:
    res = client.post("/api/v1/auth/demo-login", json={"role": role})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_super_admin_dashboard_returns_live_metrics(client: TestClient):
    tok = _token(client, "SUPER_ADMIN")
    res = client.get("/api/v1/super-admin/dashboard", headers={"Authorization": f"Bearer {tok}"})
    assert res.status_code == 200
    body = res.json()
    assert body["university"]["code"] == "BITS-IN"
    assert body["kpis"]["total_departments"] >= 5
    assert body["kpis"]["total_department_admins"] >= 1
    assert len(body["departments"]) >= 5
    assert "scheduling_health" in body


def test_dept_admin_blocked_from_super_admin_portal_apis(client: TestClient):
    tok = _token(client, "DEPT_ADMIN")
    for path in [
        "/api/v1/super-admin/dashboard",
        "/api/v1/university",
        "/api/v1/departments",
        "/api/v1/department-admins",
        "/api/v1/academic-years",
        "/api/v1/platform-settings",
        "/api/v1/audit-logs",
    ]:
        res = client.get(path, headers={"Authorization": f"Bearer {tok}"})
        assert res.status_code == 403, f"Expected 403 on {path}, got {res.status_code}"


def test_university_profile_and_campus_crud(client: TestClient):
    tok = _token(client, "SUPER_ADMIN")
    headers = {"Authorization": f"Bearer {tok}"}

    bundle = client.get("/api/v1/university", headers=headers)
    assert bundle.status_code == 200
    univ = bundle.json()["university"]

    # Update university
    upd = client.put(
        "/api/v1/university",
        headers=headers,
        json={
            "name": univ["name"],
            "code": univ["code"],
            "university_type": "Private Autonomous University",
            "established_year": 1998,
            "accreditation": "NAAC A++ · NBA Tier-1",
            "description": univ["description"] or "Updated description",
            "website": "https://www.bharattech.edu.in",
            "official_email": "registrar@bharattech.edu.in",
            "contact_number": "+91 80 2672 4800",
            "alternate_number": "+91 80 2672 4801",
            "address": univ["address"] or "Outer Ring Road",
            "city": "Bengaluru",
            "state": "Karnataka",
            "country": "India",
            "postal_code": "560085",
            "tenant_status": "ACTIVE",
            "default_timezone": "Asia/Kolkata",
            "default_working_days": "MON,TUE,WED,THU,FRI,SAT",
            "default_semester_structure": "ODD_EVEN",
            "governance_policies": univ["governance_policies"],
            "scheduling_policies": univ["scheduling_policies"],
        },
    )
    assert upd.status_code == 200
    assert upd.json()["accreditation"] == "NAAC A++ · NBA Tier-1"

    # Campus create
    c_res = client.post(
        "/api/v1/university/campuses",
        headers=headers,
        json={
            "name": "Hubballi Innovation Campus",
            "code": "HBL-TEST",
            "campus_type": "SATELLITE_CAMPUS",
            "address": "Vidyanagar",
            "city": "Hubballi",
            "state": "Karnataka",
            "contact_email": "hbl@bharattech.edu.in",
            "contact_number": "+91 836 237 1100",
            "status": "ACTIVE",
        },
    )
    assert c_res.status_code in (201, 409)


def test_department_crud_details_and_safe_deactivation(client: TestClient):
    tok = _token(client, "SUPER_ADMIN")
    headers = {"Authorization": f"Bearer {tok}"}

    campuses = client.get("/api/v1/university/campuses", headers=headers).json()
    campus_id = campuses[0]["id"] if campuses else None

    res = client.post(
        "/api/v1/departments",
        headers=headers,
        json={
            "name": "Civil & Infrastructure Engineering",
            "code": "CIVIL-T1",
            "description": "Structural and smart-city engineering.",
            "campus_id": campus_id,
            "hod_name": "Dr. Suresh Patil",
            "contact_email": "hod.civil@bharattech.edu.in",
            "contact_number": "+91 80 2672 4899",
            "status": "ACTIVE",
        },
    )
    assert res.status_code in (201, 409)
    if res.status_code == 201:
        dept_id = res.json()["id"]
    else:
        depts = client.get("/api/v1/departments?search=CIVIL-T1", headers=headers).json()
        dept_id = depts[0]["id"]

    details = client.get(f"/api/v1/departments/{dept_id}/details", headers=headers)
    assert details.status_code == 200
    assert "timetable_summary" in details.json()

    deact = client.patch(
        f"/api/v1/departments/{dept_id}/status",
        headers=headers,
        json={"status": "INACTIVE"},
    )
    assert deact.status_code == 200
    assert deact.json()["status"] == "INACTIVE"


def test_department_admin_invite_and_status(client: TestClient):
    tok = _token(client, "SUPER_ADMIN")
    headers = {"Authorization": f"Bearer {tok}"}

    res = client.post(
        "/api/v1/department-admins",
        headers=headers,
        json={
            "full_name": "Prof. Deepa Krishnan",
            "email": "deepa.krishnan.test@bharattech.edu.in",
            "phone_number": "+91 98450 88990",
            "department_id": "dept-cse",
            "designation": "Associate Timetable Coordinator",
            "is_active": True,
        },
    )
    assert res.status_code in (201, 409)
    if res.status_code == 201:
        body = res.json()
        assert body["invite_status"] == "PENDING"
        assert body["setup_link_preview"] is not None
        assert "password" not in body


def test_academic_calendar_and_platform_settings_and_audit(client: TestClient):
    tok = _token(client, "SUPER_ADMIN")
    headers = {"Authorization": f"Bearer {tok}"}

    # Overlap check
    overlap = client.post(
        "/api/v1/academic-years",
        headers=headers,
        json={
            "name": "2026-2027-DUP",
            "start_date": "2026-09-01",
            "end_date": "2027-05-01",
            "status": "UPCOMING",
            "description": "Should fail overlap",
        },
    )
    assert overlap.status_code == 409

    # Platform settings read & update
    ps = client.get("/api/v1/platform-settings", headers=headers)
    assert ps.status_code == 200
    ps_data = ps.json()
    for extra in ("id", "university_id", "last_backup_at", "last_backup_status", "updated_at"):
        ps_data.pop(extra, None)
    ps_data["solver_default_time_limit_sec"] = 45
    ps_data["solver_max_time_limit_sec"] = max(ps_data.get("solver_max_time_limit_sec", 180), 180)
    ps_data["time_format"] = "12H"
    ps_data["default_theme"] = "dark"
    upd = client.put("/api/v1/platform-settings", headers=headers, json=ps_data)
    assert upd.status_code == 200, upd.text
    assert upd.json()["solver_default_time_limit_sec"] == 45

    # Audit logs generated
    logs = client.get("/api/v1/audit-logs?module=PLATFORM_SETTINGS", headers=headers)
    assert logs.status_code == 200
    assert len(logs.json()) >= 1
