import { apiClient } from '@/services/apiClient';
import type {
  NotificationItem,
  TimetableEntryItem,
  TimetableEntryPayload,
  TimetableMetadata,
  TimetableResponse,
  TimetableVersionItem,
} from '@/types/timetable';

export async function fetchTimetableMetadata(): Promise<TimetableMetadata> {
  const { data } = await apiClient.get<TimetableMetadata>('/timetable/metadata');
  return data;
}

export async function fetchTimetableEntries(params?: {
  batch_id?: string;
  faculty_id?: string;
  room_id?: string;
  mode?: 'published' | 'draft';
}): Promise<TimetableResponse> {
  const { data } = await apiClient.get<TimetableResponse>('/timetable/entries', { params });
  return data;
}

export async function fetchFacultyTimetable(): Promise<TimetableResponse> {
  const { data } = await apiClient.get<TimetableResponse>('/timetable/faculty-view');
  return data;
}

export async function fetchStudentTimetable(): Promise<TimetableResponse> {
  const { data } = await apiClient.get<TimetableResponse>('/timetable/student-view');
  return data;
}

export async function createTimetableEntry(
  payload: TimetableEntryPayload,
): Promise<TimetableEntryItem> {
  const { data } = await apiClient.post<TimetableEntryItem>('/timetable/entries', payload);
  return data;
}

export async function updateTimetableEntry(
  entryId: string,
  payload: TimetableEntryPayload,
): Promise<TimetableEntryItem> {
  const { data } = await apiClient.put<TimetableEntryItem>(
    `/timetable/entries/${entryId}`,
    payload,
  );
  return data;
}

export async function deleteTimetableEntry(
  entryId: string,
  publishImmediately = true,
): Promise<{ status: string; version_number: number }> {
  const { data } = await apiClient.delete<{ status: string; version_number: number }>(
    `/timetable/entries/${entryId}`,
    { params: { publish_immediately: publishImmediately } },
  );
  return data;
}

export async function publishDraftTimetable(): Promise<TimetableVersionItem> {
  const { data } = await apiClient.post<TimetableVersionItem>('/timetable/publish');
  return data;
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const { data } = await apiClient.get<NotificationItem[]>('/notifications');
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.post(`/notifications/${id}/read`);
}
