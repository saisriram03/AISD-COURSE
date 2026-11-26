export interface UniversityProfile {
  id: string;
  name: string;
  code: string;
  logo_url: string;
  university_type: string;
  established_year: number | null;
  accreditation: string;
  description: string;
  website: string;
  official_email: string;
  contact_number: string;
  alternate_number: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  tenant_status: 'ACTIVE' | 'SUSPENDED' | 'MAINTENANCE';
  default_timezone: string;
  default_working_days: string;
  default_semester_structure: 'ODD_EVEN' | 'TRIMESTER' | 'ANNUAL';
  governance_policies: string;
  scheduling_policies: string;
  created_at: string;
  updated_at?: string | null;
}

export interface CampusRecord {
  id: string;
  university_id: string;
  name: string;
  code: string;
  campus_type: 'MAIN_CAMPUS' | 'RESEARCH_CAMPUS' | 'SATELLITE_CAMPUS' | 'CITY_CENTER';
  address: string;
  city: string;
  state: string;
  contact_email: string;
  contact_number: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface TenantSettingRecord {
  id: string;
  university_id: string;
  enforce_department_isolation: boolean;
  allow_cross_dept_electives: boolean;
  allow_shared_rooms: boolean;
  require_super_admin_dept_approval: boolean;
  data_ownership_label: string;
  custom_domain: string;
  updated_at?: string | null;
}

export interface UniversityBundle {
  university: UniversityProfile;
  campuses: CampusRecord[];
  tenant_settings: TenantSettingRecord;
}

export interface DepartmentRich {
  id: string;
  university_id: string;
  campus_id: string | null;
  campus_name: string | null;
  name: string;
  code: string;
  description: string;
  hod_user_id: string | null;
  hod_name: string;
  contact_email: string;
  contact_number: string;
  status: 'ACTIVE' | 'INACTIVE';
  faculty_count: number;
  student_count: number;
  batch_count: number;
  room_count: number;
  course_count: number;
  admin_count: number;
  admin_names: string[];
  current_semester: string;
  timetable_status: 'PUBLISHED' | 'DRAFT' | 'CONFLICT' | 'NOT_GENERATED';
  timetable_version: number;
  scheduled_entries_count: number;
  created_at: string;
}

export interface DepartmentDetails {
  department: DepartmentRich;
  faculty: Array<{
    id: string;
    employee_code: string;
    name: string;
    email: string;
    designation: string;
    max_weekly_hours: number;
  }>;
  batches: Array<{
    id: string;
    name: string;
    academic_year: string;
    semester: number;
    section: string;
    student_strength: number;
  }>;
  admins: Array<{
    id: string;
    full_name: string;
    email: string;
    designation: string;
    is_active: boolean;
  }>;
  courses: Array<{
    id: string;
    code: string;
    name: string;
    semester: number;
    course_type: string;
    weekly_hours: number;
  }>;
  rooms: Array<{
    id: string;
    room_number: string;
    building: string;
    room_type: string;
    capacity: number;
  }>;
  timetable_summary: {
    status: string;
    active_version: number;
    scheduled_entries: number;
    versions: Array<{
      id: string;
      version_number: number;
      status: string;
      notes: string;
      published_at: string | null;
    }>;
  };
  activity_history: Array<{
    id: string;
    action: string;
    user_name: string;
    details: string;
    created_at: string;
  }>;
}

export interface DeptAdminRecord {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  department_id: string | null;
  department_name: string | null;
  department_code: string | null;
  designation: string;
  is_active: boolean;
  invite_status: 'ACCEPTED' | 'PENDING';
  invite_sent_at: string | null;
  last_login_at: string | null;
  avatar_initials: string;
  created_at: string;
  setup_link_preview?: string | null;
}

export interface DeptAdminDetail {
  admin: DeptAdminRecord;
  recent_actions: Array<{
    id: string;
    action: string;
    module: string;
    details: string;
    created_at: string;
  }>;
}

export interface AcademicYearRecord {
  id: string;
  university_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: 'ACTIVE' | 'UPCOMING' | 'ARCHIVED';
  description: string;
  created_at: string;
}

export interface SemesterRecord {
  id: string;
  university_id: string;
  academic_year_id: string;
  name: string;
  semester_number: number;
  term_type: 'ODD' | 'EVEN' | 'SUMMER';
  start_date: string;
  end_date: string;
  registration_start: string;
  registration_end: string;
  exam_start: string;
  exam_end: string;
  status: 'ACTIVE' | 'UPCOMING' | 'COMPLETED';
  created_at: string;
}

export interface HolidayRecord {
  id: string;
  university_id: string;
  academic_year_id: string;
  name: string;
  date: string;
  holiday_type: 'PUBLIC' | 'ACADEMIC' | 'INSTITUTIONAL' | 'RESTRICTED';
  description: string;
  applicable_departments: string;
  created_at: string;
}

export interface ExaminationPeriodRecord {
  id: string;
  university_id: string;
  academic_year_id: string;
  semester_id: string | null;
  name: string;
  exam_type: 'INTERNAL_ASSESSMENT' | 'END_SEMESTER' | 'PRACTICAL' | 'SPECIAL_ACADEMIC';
  start_date: string;
  end_date: string;
  lock_timetable_edits: boolean;
  description: string;
  created_at: string;
}

export interface WorkingDayConfigRecord {
  id: string;
  university_id: string;
  name: string;
  working_days: string;
  opening_time: string;
  first_period_time: string;
  period_duration_minutes: number;
  morning_periods: number;
  lunch_start_time: string;
  lunch_duration_minutes: number;
  afternoon_periods: number;
  closing_time: string;
  non_teaching_periods: string;
  is_default: boolean;
  updated_at?: string | null;
}

export interface PlatformSettingsRecord {
  id: string;
  university_id: string;
  platform_name: string;
  default_timezone: string;
  date_format: string;
  time_format: '12H' | '24H';
  default_language: string;
  default_theme: 'dark' | 'light';
  maintenance_mode: boolean;
  solver_default_time_limit_sec: number;
  solver_max_time_limit_sec: number;
  solver_max_alternatives: number;
  solver_max_concurrent_jobs: number;
  solver_allow_dept_override: boolean;
  solver_weights_json: string;
  notify_in_app: boolean;
  notify_email: boolean;
  notify_timetable_published: boolean;
  notify_timetable_changed: boolean;
  notify_faculty_absence: boolean;
  notify_swap_requests: boolean;
  notify_leave_approvals: boolean;
  min_password_length: number;
  require_special_chars: boolean;
  max_login_attempts: number;
  lockout_duration_minutes: number;
  session_expiration_minutes: number;
  access_token_expire_minutes: number;
  data_retention_days: number;
  last_backup_at: string | null;
  last_backup_status: string;
  updated_at?: string | null;
}

export interface AuditLogRecord {
  id: string;
  university_id: string | null;
  user_id: string | null;
  user_name: string;
  user_role: string;
  action: string;
  module: string;
  entity_type: string;
  entity_id: string;
  ip_address: string;
  result: string;
  details: string;
  created_at: string;
}

export interface SuperAdminDashboardData {
  university: UniversityProfile;
  kpis: {
    total_departments: number;
    total_department_admins: number;
    total_faculty: number;
    total_students: number;
    active_academic_years: number;
    published_timetables: number;
  };
  departments: DepartmentRich[];
  scheduling_health: {
    published: number;
    draft: number;
    conflicts: number;
    not_generated: number;
    departments_without_admin: number;
  };
  charts: {
    department_distribution: Array<{
      code: string;
      name: string;
      faculty: number;
      students: number;
      rooms: number;
      courses: number;
      scheduled_entries: number;
    }>;
    timetable_status_summary: Array<{
      label: string;
      count: number;
    }>;
  };
  recent_activities: AuditLogRecord[];
  current_academic_year: AcademicYearRecord | null;
  active_semesters: SemesterRecord[];
}
