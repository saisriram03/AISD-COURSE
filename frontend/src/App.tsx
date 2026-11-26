import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SmartCursor } from '@/components/cursor/SmartCursor';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { ModuleShellPage } from '@/components/common/ModuleShellPage';
import { ToastViewport } from '@/components/ui/Toast';
import { PublicLayout } from '@/layouts/PublicLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import '@/store/useThemeStore';

const LandingShellPage = lazy(() =>
  import('@/pages/public/LandingShellPage').then((m) => ({ default: m.LandingShellPage })),
);
const LoginPage = lazy(() =>
  import('@/pages/public/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('@/pages/public/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);
const UnauthorizedPage = lazy(() =>
  import('@/pages/public/UnauthorizedPage').then((m) => ({ default: m.UnauthorizedPage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/public/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const SuperAdminHomePage = lazy(() =>
  import('@/pages/super-admin/SuperAdminHomePage').then((m) => ({
    default: m.SuperAdminHomePage,
  })),
);
const UniversityProfilePage = lazy(() =>
  import('@/pages/super-admin/UniversityProfilePage').then((m) => ({
    default: m.UniversityProfilePage,
  })),
);
const DepartmentsPage = lazy(() =>
  import('@/pages/super-admin/DepartmentsPage').then((m) => ({
    default: m.DepartmentsPage,
  })),
);
const DepartmentDetailPage = lazy(() =>
  import('@/pages/super-admin/DepartmentDetailPage').then((m) => ({
    default: m.DepartmentDetailPage,
  })),
);
const DepartmentAdminsPage = lazy(() =>
  import('@/pages/super-admin/DepartmentAdminsPage').then((m) => ({
    default: m.DepartmentAdminsPage,
  })),
);
const AcademicTermsPage = lazy(() =>
  import('@/pages/super-admin/AcademicTermsPage').then((m) => ({
    default: m.AcademicTermsPage,
  })),
);
const PlatformSettingsPage = lazy(() =>
  import('@/pages/super-admin/PlatformSettingsPage').then((m) => ({
    default: m.PlatformSettingsPage,
  })),
);
const DeptAdminHomePage = lazy(() =>
  import('@/pages/admin/DeptAdminHomePage').then((m) => ({ default: m.DeptAdminHomePage })),
);
const TimetableManagerPage = lazy(() =>
  import('@/pages/admin/TimetableManagerPage').then((m) => ({ default: m.TimetableManagerPage })),
);
const CalendarSlotsPage = lazy(() =>
  import('@/pages/admin/CalendarSlotsPage').then((m) => ({ default: m.CalendarSlotsPage })),
);
const ConstraintEnginePage = lazy(() =>
  import('@/pages/admin/ConstraintEnginePage').then((m) => ({ default: m.ConstraintEnginePage })),
);
const FacultyManagementPage = lazy(() =>
  import('@/pages/admin/FacultyManagementPage').then((m) => ({ default: m.FacultyManagementPage })),
);
const CourseManagementPage = lazy(() =>
  import('@/pages/admin/CourseManagementPage').then((m) => ({ default: m.CourseManagementPage })),
);
const FacultyHomePage = lazy(() =>
  import('@/pages/faculty/FacultyHomePage').then((m) => ({ default: m.FacultyHomePage })),
);
const FacultyTimetablePage = lazy(() =>
  import('@/pages/faculty/FacultyTimetablePage').then((m) => ({ default: m.FacultyTimetablePage })),
);
const StudentHomePage = lazy(() =>
  import('@/pages/student/StudentHomePage').then((m) => ({ default: m.StudentHomePage })),
);
const StudentTimetablePage = lazy(() =>
  import('@/pages/student/StudentTimetablePage').then((m) => ({ default: m.StudentTimetablePage })),
);
const ProfilePage = lazy(() =>
  import('@/pages/shared/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const NotificationsPage = lazy(() =>
  import('@/pages/shared/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-violet)] border-t-transparent" />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <SmartCursor />
          <ToastViewport />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public Routes */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<LandingShellPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
              </Route>

              {/* Shared Authenticated Routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
              </Route>

              {/* Super Admin Routes */}
              <Route
                path="/super-admin"
                element={
                  <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<SuperAdminHomePage />} />
                <Route path="university" element={<UniversityProfilePage />} />
                <Route path="departments" element={<DepartmentsPage />} />
                <Route path="departments/:departmentId" element={<DepartmentDetailPage />} />
                <Route path="admins" element={<DepartmentAdminsPage />} />
                <Route path="academic-terms" element={<AcademicTermsPage />} />
                <Route path="settings" element={<PlatformSettingsPage />} />
              </Route>

              {/* Department Admin Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['DEPT_ADMIN']}>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DeptAdminHomePage />} />
                <Route path="timetable" element={<TimetableManagerPage />} />
                <Route
                  path="solver"
                  element={
                    <ModuleShellPage
                      title="CP-SAT Solve Theater"
                      description="Full-screen optimization interface powered by Google OR-Tools."
                      phase={7}
                      backPath="/admin"
                      capabilities={[
                        'Real-time SSE/WebSocket solver events',
                        'OPTIMAL vs FEASIBLE status accuracy',
                        'Multiple feasible timetable alternatives',
                        'Independent hard-constraint verifier',
                      ]}
                    />
                  }
                />
                <Route path="constraints" element={<ConstraintEnginePage />} />
                <Route
                  path="conflicts"
                  element={
                    <ModuleShellPage
                      title="Explainable Conflict Diagnosis"
                      description="Pinpoint conflicting constraints, sessions, and resource bottlenecks."
                      phase={9}
                      backPath="/admin"
                      capabilities={[
                        'CP-SAT assumption literal conflict subsets',
                        'Human-readable bottleneck explanations',
                        'Proven conflicts vs heuristic suggestions',
                        'Impact preview for proposed resolutions',
                      ]}
                    />
                  }
                />
                <Route
                  path="rescheduling"
                  element={
                    <ModuleShellPage
                      title="Minimal-Change Rescheduling"
                      description="Adapt published timetables to faculty absence or room closures with minimal disruption."
                      phase={10}
                      backPath="/admin"
                      capabilities={[
                        'Record faculty or room unavailability',
                        'Minimize modified sessions via CP-SAT',
                        'Original vs proposed side-by-side diff',
                        'Versioned approval & notifications',
                      ]}
                    />
                  }
                />
                <Route
                  path="swaps"
                  element={
                    <ModuleShellPage
                      title="Faculty Swap Approvals"
                      description="Validate and approve faculty-initiated schedule swap proposals."
                      phase={10}
                      backPath="/admin"
                      capabilities={[
                        'Qualification & availability checks',
                        'Batch & room clash verification',
                        'Approve or reject with reason',
                        'Automatic version history snapshot',
                      ]}
                    />
                  }
                />
                <Route
                  path="simulator"
                  element={
                    <ModuleShellPage
                      title="University Digital Twin & What-If Simulator"
                      description="Test intake increases, lab maintenance, or new courses in an isolated sandbox."
                      phase={13}
                      backPath="/admin"
                      capabilities={[
                        'Clone scheduling snapshot safely',
                        'Simulate faculty absence or new sections',
                        'Compare simulated vs published impact',
                        'Discard or promote scenario for approval',
                      ]}
                    />
                  }
                />
                <Route
                  path="analytics"
                  element={
                    <ModuleShellPage
                      title="Scheduling Analytics Dashboard"
                      description="Live database metrics for room utilization, faculty load, and stability."
                      phase={12}
                      backPath="/admin"
                      capabilities={[
                        'Classroom & laboratory utilization heatmaps',
                        'Faculty workload balance distribution',
                        'Student free-period histograms',
                        'Timetable stability over versions',
                      ]}
                    />
                  }
                />
                <Route path="faculty" element={<FacultyManagementPage />} />
                <Route path="courses" element={<CourseManagementPage />} />
                <Route
                  path="rooms"
                  element={
                    <ModuleShellPage
                      title="Classrooms & Laboratories"
                      description="Manage room capacities, equipment, supported labs, and availability."
                      phase={4}
                      backPath="/admin"
                      capabilities={[
                        'Classroom & laboratory registries',
                        'Capacity & equipment matching',
                        'Building & wing metadata',
                        'Room unavailability windows',
                      ]}
                    />
                  }
                />
                <Route
                  path="batches"
                  element={
                    <ModuleShellPage
                      title="Student Batches"
                      description="Manage sections, student strengths, semesters, and assigned courses."
                      phase={4}
                      backPath="/admin"
                      capabilities={[
                        'Year, semester & section management',
                        'Student strength capacity checks',
                        'Batch course enrollment mapping',
                        'Bulk CSV/Excel import',
                      ]}
                    />
                  }
                />
                <Route path="calendar" element={<CalendarSlotsPage />} />
              </Route>

              {/* Faculty Routes */}
              <Route
                path="/faculty"
                element={
                  <ProtectedRoute allowedRoles={['FACULTY']}>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<FacultyHomePage />} />
                <Route path="timetable" element={<FacultyTimetablePage />} />
                <Route
                  path="availability"
                  element={
                    <ModuleShellPage
                      title="Availability Preferences"
                      description="Manage preferred teaching windows and unavailable slots."
                      phase={11}
                      backPath="/faculty"
                      capabilities={[
                        'Mark preferred morning/afternoon slots',
                        'Block unavailable time windows',
                        'Sync with solver soft constraints',
                        'Real-time conflict warnings',
                      ]}
                    />
                  }
                />
                <Route
                  path="leaves"
                  element={
                    <ModuleShellPage
                      title="Leave & Unexpected Absence"
                      description="Submit leave requests or report urgent unavailability."
                      phase={11}
                      backPath="/faculty"
                      capabilities={[
                        'Planned leave submission',
                        'Emergency absence reporting',
                        'Triggers admin rescheduling workflow',
                        'Status tracking & notifications',
                      ]}
                    />
                  }
                />
                <Route
                  path="swaps"
                  element={
                    <ModuleShellPage
                      title="Swap Proposals"
                      description="Request class swaps and accept or reject incoming swap offers."
                      phase={10}
                      backPath="/faculty"
                      capabilities={[
                        'Select class & replacement faculty',
                        'Instant hard-constraint pre-validation',
                        'Accept or decline peer proposals',
                        'Admin approval status feed',
                      ]}
                    />
                  }
                />
              </Route>

              {/* Student Routes */}
              <Route
                path="/student"
                element={
                  <ProtectedRoute allowedRoles={['STUDENT']}>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<StudentHomePage />} />
                <Route path="timetable" element={<StudentTimetablePage />} />
                <Route
                  path="rooms"
                  element={
                    <ModuleShellPage
                      title="Classrooms & Laboratories"
                      description="Locate assigned classrooms, laboratories, and building details."
                      phase={11}
                      backPath="/student"
                      capabilities={[
                        'Room numbers & buildings',
                        'Lab session locations',
                        'Capacity & equipment overview',
                        'Schedule change alerts',
                      ]}
                    />
                  }
                />
                <Route
                  path="free-periods"
                  element={
                    <ModuleShellPage
                      title="Free Periods"
                      description="View open periods between classes across the academic week."
                      phase={11}
                      backPath="/student"
                      capabilities={[
                        'Daily free slot breakdown',
                        'Weekly gap summary',
                        'Break & lunch indicators',
                        'Read-only official sync',
                      ]}
                    />
                  }
                />
              </Route>

              {/* Catch-all 404 */}
              <Route element={<PublicLayout />}>
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  );
}

export default App;
