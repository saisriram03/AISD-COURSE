import { apiClient } from '@/services/apiClient';
import type { DepartmentSchedule, DepartmentSchedulePayload } from '@/types/calendar';

export async function fetchDepartmentSchedule(): Promise<DepartmentSchedule> {
  const { data } = await apiClient.get<DepartmentSchedule>('/calendar/schedule');
  return data;
}

export async function saveDepartmentSchedule(
  schedule: DepartmentSchedulePayload,
): Promise<DepartmentSchedule> {
  const { data } = await apiClient.put<DepartmentSchedule>('/calendar/schedule', schedule);
  return data;
}
