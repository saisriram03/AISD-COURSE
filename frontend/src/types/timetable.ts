export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type SessionType = 'THEORY' | 'PRACTICAL' | 'TUTORIAL';

export const DAYS_OF_WEEK: Array<{ key: DayOfWeek; label: string }> = [
  { key: 'MON', label: 'Monday' },
  { key: 'TUE', label: 'Tuesday' },
  { key: 'WED', label: 'Wednesday' },
  { key: 'THU', label: 'Thursday' },
  { key: 'FRI', label: 'Friday' },
  { key: 'SAT', label: 'Saturday' },
  { key: 'SUN', label: 'Sunday' },
];

export interface FacultyItem {
  id: string;
  employee_code: string;
  name: string;
  email: string;
  designation: string;
  qualifications: string;
  max_weekly_hours: number;
}

export interface CourseItem {
  id: string;
  code: string;
  name: string;
  semester: number;
  course_type: string;
  weekly_hours: number;
  session_duration: number;
  color_token: string;
}

export interface RoomItem {
  id: string;
  room_number: string;
  building: string;
  room_type: string;
  capacity: number;
  features: string;
}

export interface BatchItem {
  id: string;
  name: string;
  academic_year: string;
  semester: number;
  section: string;
  student_strength: number;
}

export interface TimeSlotItem {
  id: string;
  period_index: number;
  label: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  applicable_days?: DayOfWeek[];
  blocked_days?: DayOfWeek[];
}

export interface TimetableVersionItem {
  id: string;
  version_number: number;
  status: string;
  notes: string;
  created_at: string;
  published_at: string | null;
}

export interface TimetableMetadata {
  department_id: string;
  department_name: string;
  faculty: FacultyItem[];
  courses: CourseItem[];
  rooms: RoomItem[];
  batches: BatchItem[];
  time_slots: TimeSlotItem[];
  active_version: TimetableVersionItem | null;
  versions: TimetableVersionItem[];
}

export interface TimetableEntryItem {
  id: string;
  version_id: string;
  version_number: number;
  day_of_week: DayOfWeek;
  period_index: number;
  duration_periods: number;
  start_time: string;
  end_time: string;
  course_id: string;
  course_code: string;
  course_name: string;
  course_color: string;
  faculty_id: string;
  faculty_name: string;
  room_id: string;
  room_number: string;
  room_building: string;
  room_type: string;
  batch_id: string;
  batch_name: string;
  session_type: SessionType;
  notes: string;
  updated_at: string;
}

export interface TimetableResponse {
  version: TimetableVersionItem | null;
  entries: TimetableEntryItem[];
  total_entries: number;
  entity_label: string | null;
}

export interface TimetableEntryPayload {
  day_of_week: DayOfWeek;
  period_index?: number;
  duration_periods: number;
  start_time: string;
  end_time: string;
  course_id: string;
  faculty_id: string;
  room_id: string;
  batch_id: string;
  session_type: SessionType;
  notes: string;
  publish_immediately: boolean;
}

export interface ConflictDetail {
  code: string;
  message: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: string;
  is_read: boolean;
  created_at: string;
}
