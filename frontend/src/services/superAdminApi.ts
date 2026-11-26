import { apiClient } from '@/services/apiClient';
import type {
  AcademicYearRecord,
  AuditLogRecord,
  CampusRecord,
  DepartmentDetails,
  DepartmentRich,
  DeptAdminDetail,
  DeptAdminRecord,
  ExaminationPeriodRecord,
  HolidayRecord,
  PlatformSettingsRecord,
  SemesterRecord,
  SuperAdminDashboardData,
  TenantSettingRecord,
  UniversityBundle,
  UniversityProfile,
  WorkingDayConfigRecord,
} from '@/types/superAdmin';

export const superAdminApi = {
  // Dashboard
  getDashboard: async (params?: { campus_id?: string; status_filter?: string }) => {
    const { data } = await apiClient.get<SuperAdminDashboardData>('/super-admin/dashboard', { params });
    return data;
  },

  // University Profile & Campuses
  getUniversityBundle: async () => {
    const { data } = await apiClient.get<UniversityBundle>('/university');
    return data;
  },
  updateUniversity: async (payload: Partial<UniversityProfile>) => {
    const { data } = await apiClient.put<UniversityProfile>('/university', payload);
    return data;
  },
  uploadUniversityLogo: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await apiClient.post<UniversityProfile>('/university/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  updateTenantSettings: async (payload: Omit<TenantSettingRecord, 'id' | 'university_id' | 'updated_at'>) => {
    const { data } = await apiClient.put<TenantSettingRecord>('/university/tenant-settings', payload);
    return data;
  },
  createCampus: async (payload: Omit<CampusRecord, 'id' | 'university_id' | 'created_at'>) => {
    const { data } = await apiClient.post<CampusRecord>('/university/campuses', payload);
    return data;
  },
  updateCampus: async (id: string, payload: Omit<CampusRecord, 'id' | 'university_id' | 'created_at'>) => {
    const { data } = await apiClient.put<CampusRecord>(`/university/campuses/${id}`, payload);
    return data;
  },
  toggleCampusStatus: async (id: string, status: 'ACTIVE' | 'INACTIVE') => {
    const { data } = await apiClient.patch<CampusRecord>(`/university/campuses/${id}/status`, { status });
    return data;
  },

  // Departments
  listDepartments: async (params?: { search?: string; status_filter?: string; campus_id?: string }) => {
    const { data } = await apiClient.get<DepartmentRich[]>('/departments', { params });
    return data;
  },
  createDepartment: async (payload: {
    name: string;
    code: string;
    description: string;
    campus_id: string | null;
    hod_name: string;
    contact_email: string;
    contact_number: string;
    status: 'ACTIVE' | 'INACTIVE';
  }) => {
    const { data } = await apiClient.post<DepartmentRich>('/departments', payload);
    return data;
  },
  updateDepartment: async (
    id: string,
    payload: {
      name: string;
      code: string;
      description: string;
      campus_id: string | null;
      hod_name: string;
      contact_email: string;
      contact_number: string;
      status: 'ACTIVE' | 'INACTIVE';
    },
  ) => {
    const { data } = await apiClient.put<DepartmentRich>(`/departments/${id}`, payload);
    return data;
  },
  updateDepartmentStatus: async (id: string, status: 'ACTIVE' | 'INACTIVE') => {
    const { data } = await apiClient.patch<DepartmentRich>(`/departments/${id}/status`, { status });
    return data;
  },
  getDepartmentDetails: async (id: string) => {
    const { data } = await apiClient.get<DepartmentDetails>(`/departments/${id}/details`);
    return data;
  },

  // Department Admins
  listDepartmentAdmins: async (params?: { search?: string; department_id?: string; status_filter?: string }) => {
    const { data } = await apiClient.get<DeptAdminRecord[]>('/department-admins', { params });
    return data;
  },
  createDepartmentAdmin: async (payload: {
    full_name: string;
    email: string;
    phone_number: string;
    department_id: string;
    designation: string;
    is_active: boolean;
  }) => {
    const { data } = await apiClient.post<DeptAdminRecord>('/department-admins', payload);
    return data;
  },
  updateDepartmentAdmin: async (
    id: string,
    payload: {
      full_name: string;
      phone_number: string;
      department_id: string;
      designation: string;
      is_active: boolean;
    },
  ) => {
    const { data } = await apiClient.put<DeptAdminRecord>(`/department-admins/${id}`, payload);
    return data;
  },
  updateDepartmentAdminStatus: async (id: string, is_active: boolean) => {
    const { data } = await apiClient.patch<DeptAdminRecord>(`/department-admins/${id}/status`, { is_active });
    return data;
  },
  resendAdminInvite: async (id: string) => {
    const { data } = await apiClient.post<DeptAdminRecord>(`/department-admins/${id}/resend-invite`);
    return data;
  },
  getDepartmentAdminDetail: async (id: string) => {
    const { data } = await apiClient.get<DeptAdminDetail>(`/department-admins/${id}`);
    return data;
  },

  // Academic Years & Terms
  listAcademicYears: async () => {
    const { data } = await apiClient.get<AcademicYearRecord[]>('/academic-years');
    return data;
  },
  createAcademicYear: async (payload: Omit<AcademicYearRecord, 'id' | 'university_id' | 'created_at'>) => {
    const { data } = await apiClient.post<AcademicYearRecord>('/academic-years', payload);
    return data;
  },
  updateAcademicYear: async (id: string, payload: Omit<AcademicYearRecord, 'id' | 'university_id' | 'created_at'>) => {
    const { data } = await apiClient.put<AcademicYearRecord>(`/academic-years/${id}`, payload);
    return data;
  },
  updateAcademicYearStatus: async (id: string, status: 'ACTIVE' | 'UPCOMING' | 'ARCHIVED') => {
    const { data } = await apiClient.patch<AcademicYearRecord>(`/academic-years/${id}/status`, { status });
    return data;
  },

  listSemesters: async (academic_year_id?: string) => {
    const { data } = await apiClient.get<SemesterRecord[]>('/semesters', { params: { academic_year_id } });
    return data;
  },
  createSemester: async (payload: Omit<SemesterRecord, 'id' | 'university_id' | 'created_at'>) => {
    const { data } = await apiClient.post<SemesterRecord>('/semesters', payload);
    return data;
  },
  updateSemester: async (id: string, payload: Omit<SemesterRecord, 'id' | 'university_id' | 'created_at'>) => {
    const { data } = await apiClient.put<SemesterRecord>(`/semesters/${id}`, payload);
    return data;
  },

  listHolidays: async (params?: { academic_year_id?: string; holiday_type?: string }) => {
    const { data } = await apiClient.get<HolidayRecord[]>('/holidays', { params });
    return data;
  },
  createHoliday: async (payload: Omit<HolidayRecord, 'id' | 'university_id' | 'created_at'>) => {
    const { data } = await apiClient.post<HolidayRecord>('/holidays', payload);
    return data;
  },
  updateHoliday: async (id: string, payload: Omit<HolidayRecord, 'id' | 'university_id' | 'created_at'>) => {
    const { data } = await apiClient.put<HolidayRecord>(`/holidays/${id}`, payload);
    return data;
  },
  deleteHoliday: async (id: string) => {
    await apiClient.delete(`/holidays/${id}`);
  },

  listExaminationPeriods: async (academic_year_id?: string) => {
    const { data } = await apiClient.get<ExaminationPeriodRecord[]>('/examination-periods', {
      params: { academic_year_id },
    });
    return data;
  },
  createExaminationPeriod: async (
    payload: Omit<ExaminationPeriodRecord, 'id' | 'university_id' | 'created_at'>,
  ) => {
    const { data } = await apiClient.post<ExaminationPeriodRecord>('/examination-periods', payload);
    return data;
  },
  updateExaminationPeriod: async (
    id: string,
    payload: Omit<ExaminationPeriodRecord, 'id' | 'university_id' | 'created_at'>,
  ) => {
    const { data } = await apiClient.put<ExaminationPeriodRecord>(`/examination-periods/${id}`, payload);
    return data;
  },
  deleteExaminationPeriod: async (id: string) => {
    await apiClient.delete(`/examination-periods/${id}`);
  },

  listWorkingDayConfigs: async () => {
    const { data } = await apiClient.get<WorkingDayConfigRecord[]>('/working-day-configs');
    return data;
  },
  upsertWorkingDayConfig: async (payload: Partial<WorkingDayConfigRecord>) => {
    const { data } = await apiClient.put<WorkingDayConfigRecord>('/working-day-configs', payload);
    return data;
  },

  // Platform Settings & Audit Logs
  getPlatformSettings: async () => {
    const { data } = await apiClient.get<PlatformSettingsRecord>('/platform-settings');
    return data;
  },
  updatePlatformSettings: async (
    payload: Omit<PlatformSettingsRecord, 'id' | 'university_id' | 'last_backup_at' | 'last_backup_status' | 'updated_at'>,
  ) => {
    const { data } = await apiClient.put<PlatformSettingsRecord>('/platform-settings', payload);
    return data;
  },
  getDataHealth: async () => {
    const { data } = await apiClient.get<{
      database_engine: string;
      status: string;
      storage_bytes: number;
      last_backup_at: string | null;
      last_backup_status: string;
      record_counts: Record<string, number>;
    }>('/platform-settings/data-health');
    return data;
  },
  exportConfig: async () => {
    const { data } = await apiClient.post<Record<string, unknown>>('/platform-settings/export');
    return data;
  },
  listAuditLogs: async (params?: {
    module?: string;
    user_role?: string;
    action?: string;
    result?: string;
    search?: string;
    limit?: number;
  }) => {
    const { data } = await apiClient.get<AuditLogRecord[]>('/audit-logs', { params });
    return data;
  },
};
