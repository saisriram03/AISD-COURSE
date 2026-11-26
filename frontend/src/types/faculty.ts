import type { DayOfWeek } from '@/types/timetable';

export type FacultyAvailability = {
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  availability_type: 'PREFERRED' | 'UNAVAILABLE';
  label: string;
};

export type FacultyItem = {
  id: string;
  employee_code: string;
  name: string;
  email: string;
  phone_number: string;
  designation: string;
  qualifications: string;
  eligible_course_ids: string[];
  max_weekly_hours: number;
  working_days: DayOfWeek[];
  availability: FacultyAvailability[];
  is_active: boolean;
};

export type FacultyPayload = Omit<FacultyItem, 'id'>;

export type FacultyPageResult = {
  items: FacultyItem[];
  total: number;
  limit: number;
  offset: number;
};
