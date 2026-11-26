from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.governance import (
    AcademicYear,
    Campus,
    ExaminationPeriod,
    Holiday,
    PlatformSetting,
    Semester,
    TenantSetting,
    WorkingDayConfiguration,
)
from app.models.scheduling import (
    AuditLog,
    Batch,
    Course,
    Department,
    Faculty,
    Notification,
    Room,
    TimeSlot,
    TimetableEntry,
    TimetableVersion,
    University,
    User,
)


def seed_database(db: Session) -> None:
    """Populate realistic Indian university demo data if the database is empty."""
    existing_univ = db.scalar(select(University).limit(1))
    if existing_univ:
        seed_governance_data(db, existing_univ)
        return

    univ = University(
        id="univ-bharat-tech",
        name="Bharat Institute of Technology & Sciences",
        code="BITS-IN",
    )
    db.add(univ)

    dept_cse = Department(
        id="dept-cse",
        university_id=univ.id,
        name="Computer Science & Engineering",
        code="CSE",
    )
    dept_ece = Department(
        id="dept-ece",
        university_id=univ.id,
        name="Electronics & Communication Engineering",
        code="ECE",
    )
    db.add_all([dept_cse, dept_ece])

    # Faculty (CSE)
    f_rohan = Faculty(
        id="fac-rohan",
        department_id=dept_cse.id,
        employee_code="CSE-101",
        name="Dr. Rohan Kulkarni",
        email="rohan.kulkarni@bharattech.edu.in",
        designation="Associate Professor",
        qualifications="Ph.D. Distributed Systems, Operating Systems",
        max_weekly_hours=18,
    )
    f_priya = Faculty(
        id="fac-priya",
        department_id=dept_cse.id,
        employee_code="CSE-102",
        name="Dr. Priya Nair",
        email="priya.nair@bharattech.edu.in",
        designation="Professor",
        qualifications="Ph.D. Database Internals, Data Mining",
        max_weekly_hours=16,
    )
    f_siddharth = Faculty(
        id="fac-siddharth",
        department_id=dept_cse.id,
        employee_code="CSE-103",
        name="Prof. Siddharth Verma",
        email="siddharth.verma@bharattech.edu.in",
        designation="Assistant Professor",
        qualifications="M.Tech Computer Networks, Cloud Security",
        max_weekly_hours=18,
    )
    f_kavita = Faculty(
        id="fac-kavita",
        department_id=dept_cse.id,
        employee_code="CSE-104",
        name="Dr. Kavita Rao",
        email="kavita.rao@bharattech.edu.in",
        designation="Associate Professor",
        qualifications="Ph.D. Machine Learning, Deep Neural Networks",
        max_weekly_hours=16,
    )
    f_arjun = Faculty(
        id="fac-arjun",
        department_id=dept_cse.id,
        employee_code="CSE-105",
        name="Prof. Arjun Mehta",
        email="arjun.mehta@bharattech.edu.in",
        designation="Assistant Professor",
        qualifications="M.Tech Compiler Design, Theory of Computation",
        max_weekly_hours=18,
    )
    db.add_all([f_rohan, f_priya, f_siddharth, f_kavita, f_arjun])

    # Batches (CSE Sem 5)
    b_sec_a = Batch(
        id="batch-cse-5a",
        department_id=dept_cse.id,
        name="B.Tech CSE · Sem 5 · Sec A",
        academic_year="2026-27",
        semester=5,
        section="A",
        student_strength=58,
    )
    b_sec_b = Batch(
        id="batch-cse-5b",
        department_id=dept_cse.id,
        name="B.Tech CSE · Sem 5 · Sec B",
        academic_year="2026-27",
        semester=5,
        section="B",
        student_strength=56,
    )
    db.add_all([b_sec_a, b_sec_b])

    # Courses (CSE Sem 5)
    c_os = Course(
        id="course-cs501",
        department_id=dept_cse.id,
        code="CS501",
        name="Operating Systems",
        semester=5,
        course_type="THEORY",
        weekly_hours=3,
        session_duration=1,
        color_token="#7c5cff",
    )
    c_dbms = Course(
        id="course-cs502",
        department_id=dept_cse.id,
        code="CS502",
        name="Database Management Systems",
        semester=5,
        course_type="THEORY",
        weekly_hours=3,
        session_duration=1,
        color_token="#22e4ff",
    )
    c_cn = Course(
        id="course-cs503",
        department_id=dept_cse.id,
        code="CS503",
        name="Computer Networks",
        semester=5,
        course_type="THEORY",
        weekly_hours=3,
        session_duration=1,
        color_token="#3dffb0",
    )
    c_ml = Course(
        id="course-cs504",
        department_id=dept_cse.id,
        code="CS504",
        name="Machine Learning",
        semester=5,
        course_type="THEORY",
        weekly_hours=3,
        session_duration=1,
        color_token="#ffb547",
    )
    c_os_lab = Course(
        id="course-cs505l",
        department_id=dept_cse.id,
        code="CS505L",
        name="Operating Systems & Networks Lab",
        semester=5,
        course_type="PRACTICAL",
        weekly_hours=2,
        session_duration=2,
        color_token="#a855f7",
    )
    c_ml_lab = Course(
        id="course-cs506l",
        department_id=dept_cse.id,
        code="CS506L",
        name="AI & Data Engineering Lab",
        semester=5,
        course_type="PRACTICAL",
        weekly_hours=2,
        session_duration=2,
        color_token="#38bdf8",
    )
    db.add_all([c_os, c_dbms, c_cn, c_ml, c_os_lab, c_ml_lab])

    # Rooms & Laboratories
    r_lh101 = Room(
        id="room-lh101",
        department_id=dept_cse.id,
        room_number="LH-101",
        building="Academic Block A",
        room_type="CLASSROOM",
        capacity=70,
        features="Smart Board, Projector, AC",
    )
    r_lh102 = Room(
        id="room-lh102",
        department_id=dept_cse.id,
        room_number="LH-102",
        building="Academic Block A",
        room_type="CLASSROOM",
        capacity=65,
        features="Projector, Acoustic Panels",
    )
    r_cr204 = Room(
        id="room-cr204",
        department_id=dept_cse.id,
        room_number="CR-204",
        building="Academic Block B",
        room_type="CLASSROOM",
        capacity=60,
        features="Whiteboard, Dual Display",
    )
    r_lab_sys = Room(
        id="room-lab-cs1",
        department_id=dept_cse.id,
        room_number="LAB-CS1",
        building="Computing Center",
        room_type="LAB",
        capacity=64,
        features="64 Linux Workstations, Cisco Switch Rack",
    )
    r_lab_ai = Room(
        id="room-lab-ai",
        department_id=dept_cse.id,
        room_number="LAB-AI",
        building="Computing Center",
        room_type="LAB",
        capacity=60,
        features="GPU Workstations, CUDA Cluster Access",
    )
    db.add_all([r_lh101, r_lh102, r_cr204, r_lab_sys, r_lab_ai])

    # Daily Period Grid (including Break & Lunch protection)
    slots = [
        TimeSlot(id="slot-p1", department_id=dept_cse.id, period_index=1, label="P1", start_time="09:00", end_time="10:00", is_break=False),
        TimeSlot(id="slot-p2", department_id=dept_cse.id, period_index=2, label="P2", start_time="10:00", end_time="11:00", is_break=False),
        TimeSlot(id="slot-b1", department_id=dept_cse.id, period_index=3, label="Break", start_time="11:00", end_time="11:15", is_break=True),
        TimeSlot(id="slot-p3", department_id=dept_cse.id, period_index=4, label="P3", start_time="11:15", end_time="12:15", is_break=False),
        TimeSlot(id="slot-p4", department_id=dept_cse.id, period_index=5, label="P4", start_time="12:15", end_time="13:15", is_break=False),
        TimeSlot(id="slot-lunch", department_id=dept_cse.id, period_index=6, label="Lunch", start_time="13:15", end_time="14:00", is_break=True),
        TimeSlot(id="slot-p5", department_id=dept_cse.id, period_index=7, label="P5", start_time="14:00", end_time="15:00", is_break=False),
        TimeSlot(id="slot-p6", department_id=dept_cse.id, period_index=8, label="P6", start_time="15:00", end_time="16:00", is_break=False),
    ]
    db.add_all(slots)

    # Users (Password for all demo accounts: SmartSched@2026)
    demo_hash = hash_password("SmartSched@2026")
    u_super = User(
        id="demo-super-admin-01",
        email="registrar@bharattech.edu.in",
        full_name="Dr. Arvind Deshmukh",
        password_hash=demo_hash,
        role="SUPER_ADMIN",
        university_id=univ.id,
        department_id=None,
        avatar_initials="AD",
    )
    u_admin = User(
        id="demo-dept-admin-01",
        email="hod.cse@bharattech.edu.in",
        full_name="Prof. Meenakshi Iyer",
        password_hash=demo_hash,
        role="DEPT_ADMIN",
        university_id=univ.id,
        department_id=dept_cse.id,
        avatar_initials="MI",
    )
    u_faculty = User(
        id="demo-faculty-01",
        email="rohan.kulkarni@bharattech.edu.in",
        full_name="Dr. Rohan Kulkarni",
        password_hash=demo_hash,
        role="FACULTY",
        university_id=univ.id,
        department_id=dept_cse.id,
        faculty_id=f_rohan.id,
        avatar_initials="RK",
    )
    u_student = User(
        id="demo-student-01",
        email="ananya.sharma.24@bharattech.edu.in",
        full_name="Ananya Sharma",
        password_hash=demo_hash,
        role="STUDENT",
        university_id=univ.id,
        department_id=dept_cse.id,
        batch_id=b_sec_a.id,
        avatar_initials="AS",
    )
    db.add_all([u_super, u_admin, u_faculty, u_student])

    # Initial Published Timetable Version v1
    v1 = TimetableVersion(
        id="tt-version-1",
        department_id=dept_cse.id,
        version_number=1,
        status="PUBLISHED",
        notes="Initial Sem 5 CSE timetable (Demo Seed v1)",
        created_by_user_id=u_admin.id,
        published_at=datetime.now(timezone.utc),
    )
    db.add(v1)

    initial_entries = [
        TimetableEntry(
            id="entry-seed-1",
            version_id=v1.id,
            department_id=dept_cse.id,
            day_of_week="MON",
            period_index=1,
            duration_periods=1,
            course_id=c_os.id,
            faculty_id=f_rohan.id,
            room_id=r_lh101.id,
            batch_id=b_sec_a.id,
            session_type="THEORY",
            notes="Process scheduling & threads",
        ),
        TimetableEntry(
            id="entry-seed-2",
            version_id=v1.id,
            department_id=dept_cse.id,
            day_of_week="MON",
            period_index=2,
            duration_periods=1,
            course_id=c_dbms.id,
            faculty_id=f_priya.id,
            room_id=r_lh101.id,
            batch_id=b_sec_a.id,
            session_type="THEORY",
        ),
        TimetableEntry(
            id="entry-seed-3",
            version_id=v1.id,
            department_id=dept_cse.id,
            day_of_week="TUE",
            period_index=4,
            duration_periods=1,
            course_id=c_cn.id,
            faculty_id=f_siddharth.id,
            room_id=r_lh102.id,
            batch_id=b_sec_a.id,
            session_type="THEORY",
        ),
        TimetableEntry(
            id="entry-seed-4",
            version_id=v1.id,
            department_id=dept_cse.id,
            day_of_week="WED",
            period_index=7,
            duration_periods=2,
            course_id=c_os_lab.id,
            faculty_id=f_rohan.id,
            room_id=r_lab_sys.id,
            batch_id=b_sec_a.id,
            session_type="PRACTICAL",
            notes="Consecutive 2-period practical session",
        ),
        TimetableEntry(
            id="entry-seed-5",
            version_id=v1.id,
            department_id=dept_cse.id,
            day_of_week="THU",
            period_index=1,
            duration_periods=1,
            course_id=c_ml.id,
            faculty_id=f_kavita.id,
            room_id=r_cr204.id,
            batch_id=b_sec_a.id,
            session_type="THEORY",
        ),
        TimetableEntry(
            id="entry-seed-6",
            version_id=v1.id,
            department_id=dept_cse.id,
            day_of_week="FRI",
            period_index=2,
            duration_periods=1,
            course_id=c_os.id,
            faculty_id=f_rohan.id,
            room_id=r_lh102.id,
            batch_id=b_sec_b.id,
            session_type="THEORY",
        ),
    ]
    db.add_all(initial_entries)

    db.add(
        Notification(
            department_id=dept_cse.id,
            target_role="ALL",
            title="Published Timetable v1 Active",
            message="CSE Sem 5 timetable v1 is live. Any updates saved by the Department Admin sync automatically.",
            category="TIMETABLE_UPDATE",
        )
    )
    db.commit()
    seed_governance_data(db, univ)


def seed_governance_data(db: Session, univ: University) -> None:
    """Idempotently populate Super Admin governance data (campuses, departments, admins, calendar, settings, audit logs)."""
    # 1. Enrich university profile if blank
    if not univ.official_email:
        univ.university_type = "Private Autonomous University"
        univ.established_year = 1998
        univ.accreditation = "NAAC A+ · NBA Tier-1 · UGC Recognized"
        univ.description = (
            "Premier engineering and sciences institution delivering AI-assisted academic "
            "scheduling, outcome-based education, and multi-campus governance across India."
        )
        univ.website = "https://www.bharattech.edu.in"
        univ.official_email = "registrar@bharattech.edu.in"
        univ.contact_number = "+91 80 2672 4800"
        univ.alternate_number = "+91 80 2672 4801"
        univ.address = "Outer Ring Road, Vidyanagar, Banashankari Stage III"
        univ.city = "Bengaluru"
        univ.state = "Karnataka"
        univ.country = "India"
        univ.postal_code = "560085"
        univ.tenant_status = "ACTIVE"
        univ.default_timezone = "Asia/Kolkata"
        univ.default_working_days = "MON,TUE,WED,THU,FRI,SAT"
        univ.default_semester_structure = "ODD_EVEN"
        univ.governance_policies = "Strict department-level data isolation; Super Admin approval required for new academic units."
        univ.scheduling_policies = "Max 6 teaching periods per day; mandatory 50-minute lunch break; 2-hour lab blocks."

    # 2. Campuses
    if not db.scalar(select(Campus).where(Campus.university_id == univ.id).limit(1)):
        c_main = Campus(
            id="campus-blr-main",
            university_id=univ.id,
            name="Bengaluru Main Campus",
            code="BLR-MAIN",
            campus_type="MAIN_CAMPUS",
            address="Outer Ring Road, Vidyanagar",
            city="Bengaluru",
            state="Karnataka",
            contact_email="campus.main@bharattech.edu.in",
            contact_number="+91 80 2672 4800",
            status="ACTIVE",
        )
        c_tech = Campus(
            id="campus-ecity",
            university_id=univ.id,
            name="Electronic City Research Campus",
            code="BLR-ECITY",
            campus_type="RESEARCH_CAMPUS",
            address="Hosur Road, Phase II, Electronic City",
            city="Bengaluru",
            state="Karnataka",
            contact_email="campus.ecity@bharattech.edu.in",
            contact_number="+91 80 2852 1190",
            status="ACTIVE",
        )
        db.add_all([c_main, c_tech])
        db.flush()

    # 3. Ensure 5 realistic Indian university departments exist
    dept_specs = [
        ("dept-cse", "Computer Science & Engineering", "CSE", "campus-blr-main", "Prof. Meenakshi Iyer", "hod.cse@bharattech.edu.in", "+91 80 2672 4811", "Core computing, systems, and software engineering programs."),
        ("dept-ise", "Information Science & Engineering", "ISE", "campus-blr-main", "Dr. Karthik Hegde", "hod.ise@bharattech.edu.in", "+91 80 2672 4812", "Enterprise information systems, cloud architecture, and data engineering."),
        ("dept-ece", "Electronics & Communication Engineering", "ECE", "campus-blr-main", "Dr. Nandini Subramanian", "hod.ece@bharattech.edu.in", "+91 80 2672 4813", "VLSI, embedded systems, signal processing, and RF communications."),
        ("dept-mech", "Mechanical Engineering", "MECH", "campus-blr-main", "Dr. Raghavendra Joshi", "hod.mech@bharattech.edu.in", "+91 80 2672 4814", "Thermal engineering, robotics, CAD/CAM, and smart manufacturing."),
        ("dept-aiml", "Artificial Intelligence & Machine Learning", "AIML", "campus-ecity", "Dr. Sneha Deshpande", "hod.aiml@bharattech.edu.in", "+91 80 2852 1195", "Deep learning, NLP, computer vision, and autonomous systems."),
    ]
    for d_id, d_name, d_code, c_id, hod_name, email, phone, desc in dept_specs:
        existing_d = db.scalar(select(Department).where(Department.university_id == univ.id, Department.code == d_code))
        if not existing_d:
            db.add(
                Department(
                    id=d_id,
                    university_id=univ.id,
                    campus_id=c_id,
                    name=d_name,
                    code=d_code,
                    description=desc,
                    hod_name=hod_name,
                    contact_email=email,
                    contact_number=phone,
                    status="ACTIVE",
                )
            )
        else:
            if not existing_d.campus_id:
                existing_d.campus_id = c_id
            if not existing_d.hod_name:
                existing_d.hod_name = hod_name
            if not existing_d.contact_email:
                existing_d.contact_email = email
            if not existing_d.contact_number:
                existing_d.contact_number = phone
            if not existing_d.description:
                existing_d.description = desc
    db.flush()

    # 4. Seed additional Department Admins if only 1 exists
    dept_admin_specs = [
        ("user-dept-ise", "hod.ise@bharattech.edu.in", "Dr. Karthik Hegde", "dept-ise", "Professor & HOD (ISE)", "+91 98450 22102", "KH"),
        ("user-dept-ece", "hod.ece@bharattech.edu.in", "Dr. Nandini Subramanian", "dept-ece", "Professor & HOD (ECE)", "+91 98450 22103", "NS"),
        ("user-dept-aiml", "hod.aiml@bharattech.edu.in", "Dr. Sneha Deshpande", "dept-aiml", "Associate Professor & HOD (AIML)", "+91 98450 22104", "SD"),
    ]
    for u_id, email, full_name, dept_id, desig, phone, initials in dept_admin_specs:
        if not db.scalar(select(User).where(User.email == email)):
            db.add(
                User(
                    id=u_id,
                    email=email,
                    full_name=full_name,
                    password_hash=hash_password("SmartSched@2026"),
                    role="DEPT_ADMIN",
                    university_id=univ.id,
                    department_id=dept_id,
                    is_active=True,
                    avatar_initials=initials,
                    phone_number=phone,
                    designation=desig,
                    invite_status="ACCEPTED",
                    last_login_at=datetime.now(timezone.utc),
                )
            )

    # Ensure existing seeded users have designation/phone populated
    sa_user = db.scalar(select(User).where(User.email == "registrar@bharattech.edu.in"))
    if sa_user and not sa_user.designation:
        sa_user.designation = "University Registrar & Super Admin"
        sa_user.phone_number = "+91 98450 11001"
        sa_user.last_login_at = datetime.now(timezone.utc)
    cse_admin = db.scalar(select(User).where(User.email == "hod.cse@bharattech.edu.in"))
    if cse_admin and not cse_admin.designation:
        cse_admin.designation = "Professor & HOD (CSE)"
        cse_admin.phone_number = "+91 98450 22101"
        cse_admin.last_login_at = datetime.now(timezone.utc)

    # 5. Tenant Settings & Platform Settings
    if not db.scalar(select(TenantSetting).where(TenantSetting.university_id == univ.id)):
        db.add(
            TenantSetting(
                university_id=univ.id,
                enforce_department_isolation=True,
                allow_cross_dept_electives=False,
                allow_shared_rooms=True,
                require_super_admin_dept_approval=True,
                data_ownership_label="Bharat Institute of Technology & Sciences (Isolated Tenant)",
                custom_domain="schedule.bharattech.edu.in",
            )
        )

    if not db.scalar(select(PlatformSetting).where(PlatformSetting.university_id == univ.id)):
        db.add(PlatformSetting(university_id=univ.id))

    # 6. Academic Years, Semesters, Holidays, Exam Periods, Working Day Config
    if not db.scalar(select(AcademicYear).where(AcademicYear.university_id == univ.id).limit(1)):
        ay_26_27 = AcademicYear(
            id="ay-2026-2027",
            university_id=univ.id,
            name="2026-2027",
            start_date="2026-08-01",
            end_date="2027-06-15",
            status="ACTIVE",
            description="Current active academic year for Odd (2026) and Even (2027) semesters.",
        )
        ay_27_28 = AcademicYear(
            id="ay-2027-2028",
            university_id=univ.id,
            name="2027-2028",
            start_date="2027-08-02",
            end_date="2028-06-15",
            status="UPCOMING",
            description="Upcoming academic year planned for intake expansion.",
        )
        db.add_all([ay_26_27, ay_27_28])
        db.flush()

        sem_odd = Semester(
            id="sem-2026-odd",
            university_id=univ.id,
            academic_year_id=ay_26_27.id,
            name="Odd Semester (Sem 1, 3, 5, 7)",
            semester_number=5,
            term_type="ODD",
            start_date="2026-08-10",
            end_date="2026-12-20",
            registration_start="2026-08-01",
            registration_end="2026-08-09",
            exam_start="2026-12-01",
            exam_end="2026-12-18",
            status="ACTIVE",
        )
        sem_even = Semester(
            id="sem-2027-even",
            university_id=univ.id,
            academic_year_id=ay_26_27.id,
            name="Even Semester (Sem 2, 4, 6, 8)",
            semester_number=6,
            term_type="EVEN",
            start_date="2027-01-18",
            end_date="2027-05-28",
            registration_start="2027-01-05",
            registration_end="2027-01-16",
            exam_start="2027-05-10",
            exam_end="2027-05-26",
            status="UPCOMING",
        )
        db.add_all([sem_odd, sem_even])
        db.flush()

        holidays = [
            Holiday(
                id="hol-indep",
                university_id=univ.id,
                academic_year_id=ay_26_27.id,
                name="Independence Day",
                date="2026-08-15",
                holiday_type="PUBLIC",
                description="National gazetted holiday.",
                applicable_departments="ALL",
            ),
            Holiday(
                id="hol-gandhi",
                university_id=univ.id,
                academic_year_id=ay_26_27.id,
                name="Gandhi Jayanti",
                date="2026-10-02",
                holiday_type="PUBLIC",
                description="National gazetted holiday.",
                applicable_departments="ALL",
            ),
            Holiday(
                id="hol-diwali",
                university_id=univ.id,
                academic_year_id=ay_26_27.id,
                name="Deepavali Break",
                date="2026-11-08",
                holiday_type="INSTITUTIONAL",
                description="Institutional festival holiday.",
                applicable_departments="ALL",
            ),
            Holiday(
                id="hol-republic",
                university_id=univ.id,
                academic_year_id=ay_26_27.id,
                name="Republic Day",
                date="2027-01-26",
                holiday_type="PUBLIC",
                description="National gazetted holiday.",
                applicable_departments="ALL",
            ),
        ]
        db.add_all(holidays)

        exams = [
            ExaminationPeriod(
                id="exam-ia1",
                university_id=univ.id,
                academic_year_id=ay_26_27.id,
                semester_id=sem_odd.id,
                name="Internal Assessment I",
                exam_type="INTERNAL_ASSESSMENT",
                start_date="2026-09-21",
                end_date="2026-09-25",
                lock_timetable_edits=False,
                description="First continuous internal evaluation window.",
            ),
            ExaminationPeriod(
                id="exam-endsem-odd",
                university_id=univ.id,
                academic_year_id=ay_26_27.id,
                semester_id=sem_odd.id,
                name="Odd Semester End-Term Examinations",
                exam_type="END_SEMESTER",
                start_date="2026-12-01",
                end_date="2026-12-18",
                lock_timetable_edits=True,
                description="University theory & practical semester examinations.",
            ),
        ]
        db.add_all(exams)

    if not db.scalar(select(WorkingDayConfiguration).where(WorkingDayConfiguration.university_id == univ.id).limit(1)):
        db.add(
            WorkingDayConfiguration(
                id="wdc-standard",
                university_id=univ.id,
                name="Standard Engineering Shift (Mon–Sat)",
                working_days="MON,TUE,WED,THU,FRI,SAT",
                opening_time="08:45",
                first_period_time="09:00",
                period_duration_minutes=55,
                morning_periods=4,
                lunch_start_time="12:40",
                lunch_duration_minutes=50,
                afternoon_periods=3,
                closing_time="16:30",
                non_teaching_periods="Library Hour,Mentoring & Proctor Meet",
                is_default=True,
            )
        )

    # 7. Seed initial Audit Logs if none exist
    if not db.scalar(select(AuditLog).limit(1)):
        db.add_all(
            [
                AuditLog(
                    university_id=univ.id,
                    user_id=sa_user.id if sa_user else None,
                    user_name="Dr. Arvind Deshmukh",
                    user_role="SUPER_ADMIN",
                    action="ACTIVATE_ACADEMIC_YEAR",
                    module="ACADEMIC_CALENDAR",
                    entity_type="AcademicYear",
                    entity_id="ay-2026-2027",
                    ip_address="127.0.0.1",
                    result="SUCCESS",
                    details='{"name": "2026-2027", "status": "ACTIVE", "mode": "development_seed"}',
                ),
                AuditLog(
                    university_id=univ.id,
                    user_id=sa_user.id if sa_user else None,
                    user_name="Dr. Arvind Deshmukh",
                    user_role="SUPER_ADMIN",
                    action="ASSIGN_DEPT_ADMIN",
                    module="DEPARTMENT_ADMINS",
                    entity_type="User",
                    entity_id="user-dept-cse",
                    ip_address="127.0.0.1",
                    result="SUCCESS",
                    details='{"department": "CSE", "admin": "Prof. Meenakshi Iyer", "mode": "development_seed"}',
                ),
                AuditLog(
                    university_id=univ.id,
                    user_id=cse_admin.id if cse_admin else None,
                    user_name="Prof. Meenakshi Iyer",
                    user_role="DEPT_ADMIN",
                    action="PUBLISH_TIMETABLE",
                    module="TIMETABLE",
                    entity_type="TimetableVersion",
                    entity_id="ver-cse-1",
                    ip_address="127.0.0.1",
                    result="SUCCESS",
                    details='{"department": "CSE", "version": 1, "entries": 6}',
                ),
            ]
        )

    db.commit()
