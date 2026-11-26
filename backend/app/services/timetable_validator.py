from dataclasses import dataclass
import json

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.scheduling import (
    Batch,
    Course,
    CourseAssignment,
    CourseBatchEligibility,
    DepartmentOperatingDay,
    Faculty,
    FacultyAvailability,
    FacultyCourseEligibility,
    Room,
    SchedulePeriod,
    TimeSlot,
    TimetableEntry,
)


@dataclass
class ValidationIssue:
    code: str
    message: str


def _minutes(value: str) -> int:
    hour, minute = (int(part) for part in value[:5].split(":"))
    return hour * 60 + minute


def _format_interval(start: int, end: int) -> str:
    return f"{start // 60:02}:{start % 60:02}–{end // 60:02}:{end % 60:02}"


def _legacy_interval(
    slot_by_idx: dict[int, TimeSlot], period_index: int, duration_periods: int
) -> tuple[int, int] | None:
    slots = [slot_by_idx.get(index) for index in range(period_index, period_index + duration_periods)]
    if not slots or any(slot is None for slot in slots):
        return None
    return _minutes(slots[0].start_time), _minutes(slots[-1].end_time)  # type: ignore[union-attr]


def _entry_interval(
    entry: TimetableEntry, slot_by_idx: dict[int, TimeSlot]
) -> tuple[int, int] | None:
    if entry.start_time and entry.end_time:
        return _minutes(entry.start_time), _minutes(entry.end_time)
    return _legacy_interval(slot_by_idx, entry.period_index, entry.duration_periods)


def validate_timetable_entry(
    db: Session,
    *,
    department_id: str,
    version_id: str,
    day_of_week: str,
    period_index: int,
    duration_periods: int,
    course_id: str,
    faculty_id: str,
    room_id: str,
    batch_id: str,
    session_type: str,
    start_time: str | None = None,
    end_time: str | None = None,
    exclude_entry_id: str | None = None,
) -> list[ValidationIssue]:
    """Validate hard resource constraints using actual minutes where supplied."""
    issues: list[ValidationIssue] = []
    course = db.get(Course, course_id)
    faculty = db.get(Faculty, faculty_id)
    room = db.get(Room, room_id)
    batch = db.get(Batch, batch_id)

    if not course or course.department_id != department_id:
        issues.append(ValidationIssue("COURSE_NOT_FOUND", "Selected course does not exist in this department."))
    if not faculty or faculty.department_id != department_id:
        issues.append(ValidationIssue("FACULTY_NOT_FOUND", "Selected faculty member does not exist in this department."))
    elif not faculty.is_active:
        issues.append(ValidationIssue("FACULTY_INACTIVE", f"{faculty.name} is inactive and cannot be assigned to a session."))
    elif day_of_week not in faculty.working_days.split(","):
        issues.append(ValidationIssue("FACULTY_NON_WORKING_DAY", f"{faculty.name} is not available to teach on {day_of_week}."))
    if not room or room.department_id != department_id:
        issues.append(ValidationIssue("ROOM_NOT_FOUND", "Selected room or laboratory does not exist in this department."))
    if not batch or batch.department_id != department_id:
        issues.append(ValidationIssue("BATCH_NOT_FOUND", "Selected student batch does not exist in this department."))
    if issues:
        return issues
    assert course and faculty and room and batch

    if course.course_type != session_type:
        issues.append(ValidationIssue("SESSION_TYPE_MISMATCH", f"Session type must match {course.code}'s configured {course.course_type.lower()} type."))
    if course.required_qualification and course.required_qualification.casefold() not in faculty.qualifications.casefold():
        issues.append(ValidationIssue("FACULTY_QUALIFICATION", f"{faculty.name} does not match {course.code}'s required qualification: {course.required_qualification}."))
    if course.required_room_type != "ANY" and room.room_type != course.required_room_type:
        issues.append(ValidationIssue("ROOM_TYPE_MISMATCH", f"{course.code} requires a {course.required_room_type.lower()}, not {room.room_type.lower()}."))
    required_equipment = []
    if course.required_equipment:
        try:
            parsed_equipment = json.loads(course.required_equipment)
            required_equipment = parsed_equipment if isinstance(parsed_equipment, list) else []
        except json.JSONDecodeError:
            required_equipment = [item.strip() for item in course.required_equipment.split(",") if item.strip()]
    missing_equipment = [item for item in required_equipment if str(item).casefold() not in room.features.casefold()]
    if missing_equipment:
        issues.append(ValidationIssue("ROOM_EQUIPMENT", f"{room.room_number} is missing required equipment: {', '.join(missing_equipment)}."))

    eligible_batches = db.scalars(select(CourseBatchEligibility.batch_id).where(
        CourseBatchEligibility.course_id == course_id,
    )).all()
    if eligible_batches and batch_id not in eligible_batches:
        issues.append(ValidationIssue("BATCH_NOT_ELIGIBLE", f"{batch.name} is not eligible for {course.code}."))

    eligible_courses = db.scalars(select(FacultyCourseEligibility.course_id).where(
        FacultyCourseEligibility.faculty_id == faculty_id,
    )).all()
    if eligible_courses and course_id not in eligible_courses:
        issues.append(ValidationIssue(
            "FACULTY_NOT_ELIGIBLE",
            f"{faculty.name} is not marked eligible to teach {course.code}.",
        ))
    active_assignments = db.scalars(select(CourseAssignment).where(
        CourseAssignment.department_id == department_id,
        CourseAssignment.course_id == course_id,
        CourseAssignment.status == "ACTIVE",
    )).all()
    matched_assignment = next((item for item in active_assignments
                              if item.faculty_id == faculty_id and item.batch_id == batch_id), None)
    if active_assignments and not matched_assignment:
        issues.append(ValidationIssue(
            "COURSE_ASSIGNMENT_REQUIRED",
            f"{course.code} has active teaching assignments; {faculty.name} and {batch.name} are not an assigned pair.",
        ))

    legacy_slots = db.scalars(
        select(TimeSlot).where(TimeSlot.department_id == department_id).order_by(TimeSlot.period_index)
    ).all()
    slot_by_idx = {slot.period_index: slot for slot in legacy_slots}
    if start_time and end_time:
        requested = (_minutes(start_time), _minutes(end_time))
        operating_day = db.scalar(select(DepartmentOperatingDay).where(
            DepartmentOperatingDay.department_id == department_id,
            DepartmentOperatingDay.day_of_week == day_of_week,
        ))
        if operating_day:
            if not operating_day.is_open:
                issues.append(ValidationIssue("DAY_CLOSED", f"{day_of_week} is closed for scheduling."))
            elif requested[0] < _minutes(operating_day.opening_time) or requested[1] > _minutes(operating_day.closing_time):
                issues.append(ValidationIssue(
                    "OUTSIDE_OPERATING_HOURS",
                    f"Requested {_format_interval(*requested)} falls outside {day_of_week} operating hours ({operating_day.opening_time}–{operating_day.closing_time}).",
                ))
            blocked = db.scalars(select(SchedulePeriod).where(
                SchedulePeriod.department_id == department_id,
                SchedulePeriod.day_of_week == day_of_week,
                or_(
                    SchedulePeriod.enabled.is_(False),
                    SchedulePeriod.period_type.in_(("BREAK", "LUNCH", "NON_TEACHING")),
                ),
            )).all()
        elif legacy_slots:
            first, last = legacy_slots[0], legacy_slots[-1]
            if requested[0] < _minutes(first.start_time) or requested[1] > _minutes(last.end_time):
                issues.append(ValidationIssue(
                    "OUTSIDE_OPERATING_HOURS",
                    f"Requested {_format_interval(*requested)} falls outside the legacy configured grid ({first.start_time}–{last.end_time}). Configure department hours before scheduling beyond it.",
                ))
            blocked = []
        else:
            issues.append(ValidationIssue(
                "OPERATING_HOURS_UNCONFIGURED",
                f"No operating hours are configured for {day_of_week}. Configure the department calendar before scheduling sessions.",
            ))
            blocked = []
        for interval in blocked:
            if requested[0] < _minutes(interval.end_time) and _minutes(interval.start_time) < requested[1]:
                issues.append(ValidationIssue(
                    "BREAK_OVERLAP",
                    f"Requested {_format_interval(*requested)} overlaps '{interval.name}' ({interval.start_time}–{interval.end_time}).",
                ))
        # Legacy break protection remains active until the department saves a new schedule.
        if not operating_day:
            for slot in legacy_slots:
                if slot.is_break and requested[0] < _minutes(slot.end_time) and _minutes(slot.start_time) < requested[1]:
                    issues.append(ValidationIssue(
                        "BREAK_OVERLAP",
                        f"Requested {_format_interval(*requested)} overlaps '{slot.label}' ({slot.start_time}–{slot.end_time}).",
                    ))
    else:
        requested = _legacy_interval(slot_by_idx, period_index, duration_periods)
        if requested is None:
            issues.append(ValidationIssue(
                "INVALID_PERIOD", f"Period range starting at {period_index} is outside the configured department grid."
            ))
            return issues
        for index in range(period_index, period_index + duration_periods):
            slot = slot_by_idx.get(index)
            if slot and slot.is_break:
                issues.append(ValidationIssue(
                    "BREAK_OVERLAP", f"Cannot schedule during '{slot.label}' ({slot.start_time}–{slot.end_time})."
                ))

    if matched_assignment and requested[1] - requested[0] != matched_assignment.duration_minutes:
        issues.append(ValidationIssue(
            "ASSIGNMENT_DURATION_MISMATCH",
            f"{course.code} is assigned a {matched_assignment.duration_minutes}-minute session; this entry is {requested[1] - requested[0]} minutes.",
        ))
    if matched_assignment and matched_assignment.required_room_type != "ANY" and room.room_type != matched_assignment.required_room_type:
        issues.append(ValidationIssue(
            "ASSIGNMENT_ROOM_TYPE",
            f"This assignment requires a {matched_assignment.required_room_type.lower()}.",
        ))

    unavailable = db.scalars(select(FacultyAvailability).where(
        FacultyAvailability.faculty_id == faculty_id,
        FacultyAvailability.day_of_week == day_of_week,
        FacultyAvailability.availability_type == "UNAVAILABLE",
    )).all()
    for window in unavailable:
        if requested[0] < _minutes(window.end_time) and _minutes(window.start_time) < requested[1]:
            label = f" ({window.label})" if window.label else ""
            issues.append(ValidationIssue(
                "FACULTY_UNAVAILABLE",
                f"{faculty.name} is marked unavailable on {day_of_week} during {window.start_time}–{window.end_time}{label}.",
            ))

    if room.capacity < batch.student_strength:
        issues.append(ValidationIssue(
            "INSUFFICIENT_CAPACITY",
            f"Room {room.room_number} capacity ({room.capacity}) is smaller than {batch.name} strength ({batch.student_strength}).",
        ))
    if (session_type == "PRACTICAL" or course.course_type == "PRACTICAL") and room.room_type != "LAB":
        issues.append(ValidationIssue(
            "LAB_REQUIRED",
            f"{course.code} ({course.name}) is a practical session and requires a Laboratory room, but {room.room_number} is a {room.room_type}.",
        ))

    same_day_entries = db.scalars(select(TimetableEntry).where(
        TimetableEntry.version_id == version_id,
        TimetableEntry.day_of_week == day_of_week,
    )).all()
    for existing in same_day_entries:
        if exclude_entry_id and existing.id == exclude_entry_id:
            continue
        existing_interval = _entry_interval(existing, slot_by_idx)
        if not existing_interval or requested[0] >= existing_interval[1] or existing_interval[0] >= requested[1]:
            continue
        overlap = (max(requested[0], existing_interval[0]), min(requested[1], existing_interval[1]))
        overlap_label = _format_interval(*overlap)
        existing_course = db.get(Course, existing.course_id)
        code = existing_course.code if existing_course else existing.course_id
        if existing.faculty_id == faculty_id:
            issues.append(ValidationIssue("FACULTY_CLASH", f"Faculty double-booking: {faculty.name} is already teaching {code} on {day_of_week} during {overlap_label}."))
        if existing.room_id == room_id:
            issues.append(ValidationIssue("ROOM_CLASH", f"Room double-booking: {room.room_number} is already occupied by {code} on {day_of_week} during {overlap_label}."))
        if existing.batch_id == batch_id:
            issues.append(ValidationIssue("BATCH_CLASH", f"Batch double-booking: {batch.name} already has {code} on {day_of_week} during {overlap_label}."))

    weekly_entries = db.scalars(select(TimetableEntry).where(
        TimetableEntry.version_id == version_id,
        TimetableEntry.faculty_id == faculty_id,
    )).all()
    weekly_minutes = (requested[1] - requested[0]) + sum(
        interval[1] - interval[0]
        for entry in weekly_entries
        if not (exclude_entry_id and entry.id == exclude_entry_id)
        if (interval := _entry_interval(entry, slot_by_idx)) is not None
    )
    if weekly_minutes > faculty.max_weekly_hours * 60:
        issues.append(ValidationIssue(
            "FACULTY_WEEKLY_HOURS",
            f"{faculty.name} would be scheduled for {weekly_minutes / 60:g} hours this week, above the configured {faculty.max_weekly_hours}-hour limit.",
        ))
    return issues
