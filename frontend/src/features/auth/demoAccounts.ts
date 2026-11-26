import type { User, UserRole } from '@/types/auth';

/**
 * Development-only sample accounts for exploring all four role portals before
 * backend auth (Phase 3) is connected or during local UI testing.
 * Strictly disabled in production builds unless VITE_ENABLE_DEMO_MODE === 'true'.
 */
export const IS_DEMO_MODE_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE !== 'false';

export interface DemoAccountDescriptor {
  role: UserRole;
  label: string;
  description: string;
  user: User;
}

export const DEMO_ACCOUNTS: DemoAccountDescriptor[] = [
  {
    role: 'SUPER_ADMIN',
    label: 'Super Admin',
    description: 'University-wide governance, departments, academic years & global settings',
    user: {
      id: 'demo-super-admin-01',
      email: 'registrar@bharattech.edu.in',
      fullName: 'Dr. Arvind Deshmukh',
      role: 'SUPER_ADMIN',
      universityId: 'univ-bharat-tech',
      universityName: 'Bharat Institute of Technology & Sciences',
      departmentId: null,
      departmentName: null,
      isActive: true,
      avatarInitials: 'AD',
    },
  },
  {
    role: 'DEPT_ADMIN',
    label: 'Department Admin',
    description: 'Master data, constraint engine, CP-SAT solver, swaps & Digital Twin',
    user: {
      id: 'demo-dept-admin-01',
      email: 'hod.cse@bharattech.edu.in',
      fullName: 'Prof. Meenakshi Iyer',
      role: 'DEPT_ADMIN',
      universityId: 'univ-bharat-tech',
      universityName: 'Bharat Institute of Technology & Sciences',
      departmentId: 'dept-cse',
      departmentName: 'Computer Science & Engineering',
      isActive: true,
      avatarInitials: 'MI',
    },
  },
  {
    role: 'FACULTY',
    label: 'Faculty',
    description: 'Personal schedule, availability, leave reports & faculty swap requests',
    user: {
      id: 'demo-faculty-01',
      email: 'rohan.kulkarni@bharattech.edu.in',
      fullName: 'Dr. Rohan Kulkarni',
      role: 'FACULTY',
      universityId: 'univ-bharat-tech',
      universityName: 'Bharat Institute of Technology & Sciences',
      departmentId: 'dept-cse',
      departmentName: 'Computer Science & Engineering',
      isActive: true,
      avatarInitials: 'RK',
    },
  },
  {
    role: 'STUDENT',
    label: 'Student',
    description: 'Read-only batch timetable, next class, free periods & PDF export',
    user: {
      id: 'demo-student-01',
      email: 'ananya.sharma.24@bharattech.edu.in',
      fullName: 'Ananya Sharma',
      role: 'STUDENT',
      universityId: 'univ-bharat-tech',
      universityName: 'Bharat Institute of Technology & Sciences',
      departmentId: 'dept-cse',
      departmentName: 'Computer Science & Engineering',
      batchLabel: 'B.Tech CSE · Sem 5 · Sec A',
      isActive: true,
      avatarInitials: 'AS',
    },
  },
];
