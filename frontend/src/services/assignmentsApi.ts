import { apiClient } from '@/services/apiClient';
import type { AssignmentPageResult, CourseAssignment, CourseAssignmentPayload } from '@/types/courses';

export async function fetchAssignments(params: { q?: string; status?: 'ACTIVE' | 'INACTIVE'; limit?: number; offset?: number }): Promise<AssignmentPageResult> {
  const { data } = await apiClient.get<AssignmentPageResult>('/assignments', { params });
  return data;
}

export async function createAssignment(payload: CourseAssignmentPayload): Promise<CourseAssignment> {
  const { data } = await apiClient.post<CourseAssignment>('/assignments', payload);
  return data;
}

export async function updateAssignment(id: string, payload: CourseAssignmentPayload): Promise<CourseAssignment> {
  const { data } = await apiClient.put<CourseAssignment>(`/assignments/${id}`, payload);
  return data;
}

export async function deactivateAssignment(id: string): Promise<CourseAssignment> {
  const { data } = await apiClient.delete<CourseAssignment>(`/assignments/${id}`);
  return data;
}
