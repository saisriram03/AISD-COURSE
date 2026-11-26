import { apiClient } from '@/services/apiClient';
import type { FacultyItem, FacultyPageResult, FacultyPayload } from '@/types/faculty';

export async function fetchFaculty(params: { q?: string; active?: boolean; limit?: number; offset?: number }): Promise<FacultyPageResult> {
  const { data } = await apiClient.get<FacultyPageResult>('/faculty', { params });
  return data;
}

export async function createFaculty(payload: FacultyPayload): Promise<FacultyItem> {
  const { data } = await apiClient.post<FacultyItem>('/faculty', payload);
  return data;
}

export async function updateFaculty(id: string, payload: FacultyPayload): Promise<FacultyItem> {
  const { data } = await apiClient.put<FacultyItem>(`/faculty/${id}`, payload);
  return data;
}

export async function deactivateFaculty(id: string): Promise<FacultyItem> {
  const { data } = await apiClient.delete<FacultyItem>(`/faculty/${id}`);
  return data;
}
