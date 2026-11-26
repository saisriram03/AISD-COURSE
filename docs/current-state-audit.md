# SMARTSCHED Current-State Audit

## Summary

SMARTSCHED has a working React/FastAPI foundation, role-aware navigation, authentication, seeded SQLite data, database-backed administration, and a versioned timetable editor. A dynamic calendar and exact-time manual scheduling slice is implemented. Several department-admin routes are still capability-description shells, and the timetable workflow is not yet connected to a generation solver.

## Department-admin module status

| Module | Current state | Evidence / limitation |
| --- | --- | --- |
| Department overview | Implemented UI | `DeptAdminHomePage` links to modules but its module cards are static; it lacks the requested DB-backed KPI/activity/health data. |
| Timetable grid/editor | Dynamic manual editing implemented | Supports exact start/end intervals, custom-time rows, weekday applicability, interval conflict validation and versioned writes. Legacy period-index compatibility remains. |
| Faculty | CRUD vertical slice implemented | Department-scoped search/filter/pagination, profile edits, qualifications, eligible course mapping, working weekdays, arbitrary-time preferred/unavailable intervals, workload limits and profile deactivation. Course/room/batch routes remain placeholders. |
| Academic calendar / slots | Dynamic department configuration implemented | Per-weekday operating windows, period/break builder, explicit save and published-session impact protection. |
| Constraints | Configuration center implemented, optimization pending | Department-scoped hard-rule status and editable soft-priority weights are persisted and audited. Manual validation checks faculty workdays, inactive status, unavailable intervals and configured course eligibility. Soft priorities await the CP-SAT solver. |
| Solver | Placeholder route | No solver package or OR-Tools dependency is present in `backend/requirements.txt`. |
| Conflict diagnosis | Placeholder route | Manual validation reports conflicts on edits; no diagnosis workflow or infeasibility explanation engine. |
| Absence rescheduling | Placeholder route | No rescheduling UI/service identified. |
| Faculty swaps | Placeholder route | No swap workflow identified. |
| Analytics | Placeholder route | Some university/department aggregate APIs exist, but no scheduling analytics page. |
| Digital Twin | Placeholder route | No isolated simulation service/model identified. |

Faculty and student portals have database-backed published timetable views; availability, leave, swap, room lookup and free-period routes are still placeholders.

## Backend and data model

- FastAPI mounts auth, admin, super-admin, timetable, calendar, constraints, faculty and notification routers under `/api/v1`.
- SQLAlchemy models cover users/roles, university/department governance, faculty profiles/availability/course eligibility, courses, rooms, batches, time slots, department operating days/periods/soft priorities, timetable entries/versions, notifications and audit records.
- Startup creates tables, applies additive column migrations and seeds demo data. The configured local database is SQLite; PostgreSQL support is not a configured production deployment.
- Timetable write endpoints validate department ownership, room capacity, practical-room compatibility, breaks, weekly faculty-hour limits, faculty availability/eligibility and interval overlaps. Timetable versions preserve published history.
- Some user scoping depends on `_resolve_department_id`; security tests exist and should be retained as APIs expand.

## Dynamic-time blockers found

- `TimetableEntry` supports actual start/end times while retaining a legacy slot index and duration for backward compatibility.
- Course session duration remains a legacy period count; normalized required-session and assignment entities do not exist yet.
- Legacy rows still resolve through `TimeSlot`; newly edited sessions use exact minutes for overlap checks.
- Seeded CSE slots end at 16:00. This is seed data rather than a universal operating-hours field.
- Super-admin working-day configuration uses a fixed count of morning/afternoon periods and a single lunch time; it is not a per-day operating-hours/period definition system.
- There is no OR-Tools CP-SAT model to audit or adapt yet.

## Architecture and implementation sequence

1. **Phase 1 — Audit and backend foundation:** establish a normalized, department-scoped schedule configuration model; preserve existing SQLite data with additive migrations; define validated interval schemas and API boundaries. Keep existing authentication and version history.
2. **Phase 2 — Department dashboard:** replace static cards with actual department statistics, activity and scheduling-health responses.
3. **Phases 3–5 — Master data:** department-scoped CRUD for faculty, courses/assignments, rooms/labs and batches, including qualification and capacity validation.
4. **Phase 6 — Dynamic calendar:** implemented as a vertical slice; expand special dates and schedule versioning.
5. **Phases 7–9 — Constraints, grid and solver:** exact-time manual editor and first constraint center implemented; complete missing hard rules, normalized requirements, CP-SAT with dynamic intervals, and independent validation.
6. **Phases 10–14 — Operations:** explainable conflict diagnosis, minimal-change rescheduling, swaps, database-backed analytics and isolated simulation.
7. **Phases 15–17 — Portals and release:** propagate published intervals to faculty/student views, notifications/reports, security/integration coverage and final polish.

## Initial files to touch

- Backend foundation: `backend/app/models/scheduling.py`, `backend/app/schemas/scheduling.py`, `backend/app/db/migrations.py`, `backend/app/api/v1/endpoints/timetable.py`, plus a new schedule-configuration endpoint/service and corresponding tests.
- Dynamic-time UI: `frontend/src/features/timetable/*`, `frontend/src/pages/admin/TimetableManagerPage.tsx`, `frontend/src/App.tsx`, and a new Calendar & Slots feature page/API client.
- Subsequent modules: existing `backend/app/api/v1/endpoints/admin.py`, new feature-specific service/schemas/endpoints as needed, `frontend/src/pages/admin/*`, `frontend/src/services/*`, and route entries in `frontend/src/App.tsx`.

## Work started after audit

- Added department-scoped `DepartmentOperatingDay` and `SchedulePeriod` persistence models. Weekday windows support any valid same-day `HH:MM` range; periods distinguish teaching, breaks, lunch and non-teaching blocks.
- Added `GET`/`PUT /api/v1/calendar/schedule`. Department admins are locked to their own department; Super Admin requests must identify a department in their university. Writes replace the full configuration transactionally and record an audit event.
- The save endpoint checks active published sessions against proposed hours, closed days and blocked intervals; it rejects changes that would invalidate classes and returns the affected session IDs and reasons.
- When a department has not saved the new schedule yet, GET adapts its legacy `TimeSlot` grid into a read-only initial configuration so the first visit does not discard existing settings.
- Replaced the Calendar & Slots placeholder route with an editable weekday schedule page, custom period/break rows, reordering, a live day preview, reset and explicit save.
- Timetable entries now accept and return actual `start_time`/`end_time`; interval validation enforces operating windows and breaks and detects faculty/room/batch overlaps by minutes. Existing entries still resolve from their legacy slots. The editor exposes exact start/end inputs and the timetable view displays actual times, including custom-time rows.
- Timetable metadata now emits configured periods with day applicability and blocked intervals, so the grid/editor can use different schedules by weekday.
- Added schema/service coverage for extended hours, invalid or overlapping intervals, closed days, malformed times, missing weekday rows, published-schedule impact checks, interval break checks and schedule persistence/audit logging.
- Replaced the Constraint Engine placeholder with a database-backed department settings page and `/api/v1/constraints` GET/PUT API. Hard rules cannot be switched off; the API reports enforced versus unimplemented checks. Ten soft-priority settings support enable/disable and 0–100 weights, with department isolation and an audit entry.
- Added weekly faculty teaching-hour enforcement to manual timetable validation. It sums actual minutes (or resolved legacy slot intervals) in the editable timetable version and rejects a write that exceeds the faculty member's configured maximum.
- Added department-scoped faculty CRUD at `/api/v1/faculty` and a real admin page. Profiles include qualifications, course eligibility, workdays, weekly limits, preferred/unavailable intervals, and active state. Lists support search, active filtering and pagination; updates/deactivation write audit records. Course eligibility is checked against the department and enforced on future manual scheduling. Unavailable windows, working days and inactive status also block manual assignments.
- Added tests for faculty CRUD/search/audit, duplicate profiles, department course scoping, availability/eligibility validation, weekly workload limits and constraint-preference persistence. Current verification: 16 targeted backend tests pass; Python compilation and frontend TypeScript lint/production build pass. OpenAPI registers `/api/v1/faculty` list/write routes. Local browser smoke testing could not connect to the temporary server ports in this environment.

This is an initial vertical slice, not the completed scheduling system. The legacy period index remains as a compatibility/sort field, and course/required-session duration still needs a normalized minute-based model. There is no CP-SAT solver yet. Course assignments, room/lab and batch CRUD remain outstanding. Next in sequence: remaining master-data management and assignment modeling, then dynamic CP-SAT integration.
