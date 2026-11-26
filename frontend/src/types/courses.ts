import type { SessionType } from '@/types/timetable';

export type RoomRequirement = 'ANY' | 'CLASSROOM' | 'LAB';
export type AssignmentStatus = 'ACTIVE' | 'INACTIVE';

export type CourseItem = {
  id: string;
  code: string;
  name: string;
  semester: number;
  course_type: SessionType;
  weekly_hours: number;
  session_duration_minutes: number;
  required_qualification: string;
  required_room_type: RoomRequirement;
  required_equipment: string[];
  eligible_batch_ids: string[];
  color_token: string;
  is_active: boolean;
};

export type CoursePayload = Omit<CourseItem, 'id'>;
export type CoursePageResult = { items: CourseItem[]; total: number; limit: number; offset: number };

export type CourseAssignment = {
  id: string;
  course_id: string;
  course_code: string;
  course_name: string;
  faculty_id: string;
  faculty_name: string;
  batch_id: string;
  batch_name: string;
  weekly_session_count: number;
  duration_minutes: number;
  required_room_type: RoomRequirement;
  status: AssignmentStatus;
};

export type CourseAssignmentPayload = Pick<CourseAssignment,
  'course_id' | 'faculty_id' | 'batch_id' | 'weekly_session_count' | 'duration_minutes' | 'required_room_type' | 'status'>;
export type AssignmentPageResult = { items: CourseAssignment[]; total: number; limit: number; offset: number };
