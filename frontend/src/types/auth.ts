export type UserRole = 'SUPER_ADMIN' | 'DEPT_ADMIN' | 'FACULTY' | 'STUDENT';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  universityId: string;
  universityName: string;
  departmentId: string | null;
  departmentName: string | null;
  batchLabel?: string | null;
  isActive: boolean;
  avatarInitials: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ApiErrorPayload {
  detail?: string;
  message?: string;
  code?: string;
}

export const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  SUPER_ADMIN: '/super-admin',
  DEPT_ADMIN: '/admin',
  FACULTY: '/faculty',
  STUDENT: '/student',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  DEPT_ADMIN: 'Department Admin',
  FACULTY: 'Faculty',
  STUDENT: 'Student',
};
