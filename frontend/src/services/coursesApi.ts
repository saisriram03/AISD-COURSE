import { apiClient } from '@/services/apiClient';
import type { CourseItem, CoursePageResult, CoursePayload } from '@/types/courses';

export async function fetchCourses(params: { q?: string; active?: boolean; semester?: number; limit?: number; offset?: number }): Promise<CoursePageResult> {
  const { data } = await apiClient.get<CoursePageResult>('/courses', { params });
  return data;
}

export async function createCourse(payload: CoursePayload): Promise<CourseItem> {
  const { data } = await apiClient.post<CourseItem>('/courses', payload);
  return data;
}

export async function updateCourse(id: string, payload: CoursePayload): Promise<CourseItem> {
  const { data } = await apiClient.put<CourseItem>(`/courses/${id}`, payload);
  return data;
}

export async function deactivateCourse(id: string): Promise<CourseItem> {
  const { data } = await apiClient.delete<CourseItem>(`/courses/${id}`);
  return data;
}
