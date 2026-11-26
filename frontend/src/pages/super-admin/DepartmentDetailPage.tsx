import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CalendarClock,
  GraduationCap,
  Layers,
  UserCheck,
  Users,
} from 'lucide-react';
import { superAdminApi } from '@/services/superAdminApi';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Layers },
  { id: 'faculty', label: 'Faculty', icon: Users },
  { id: 'students', label: 'Students & Batches', icon: GraduationCap },
  { id: 'admins', label: 'Department Admins', icon: UserCheck },
  { id: 'academics', label: 'Academic Info', icon: BookOpen },
  { id: 'timetable', label: 'Timetable Status', icon: CalendarClock },
  { id: 'activity', label: 'Activity History', icon: Activity },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function DepartmentDetailPage() {
  const { departmentId } = useParams<{ departmentId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['super-admin', 'department-details', departmentId],
    queryFn: () => superAdminApi.getDepartmentDetails(departmentId!),
    enabled: Boolean(departmentId),
  });

  if (isLoading) return <PageSkeleton />;
  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Department Not Found</CardTitle>
          <CardDescription>The requested department could not be loaded.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={() => navigate('/super-admin/departments')}>
            <ArrowLeft className="h-4 w-4" /> Back to Departments
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { department, faculty, batches, admins, courses, rooms, timetable_summary, activity_history } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate('/super-admin/departments')} className="mb-1 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Back to Departments
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="cyan">{department.code}</Badge>
            <Badge variant={department.status === 'ACTIVE' ? 'mint' : 'neutral'}>{department.status}</Badge>
          </div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{department.name}</h1>
          <p className="text-sm text-[var(--text-secondary)]">{department.description || 'Academic Department'}</p>
        </div>
      </div>

      {/* 7-Tab Bar */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
                active
                  ? 'bg-[var(--accent-violet-soft)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Department Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                <span className="text-[var(--text-muted)]">Head of Department</span>
                <span className="font-medium">{department.hod_name || 'Unassigned'}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                <span className="text-[var(--text-muted)]">Campus</span>
                <span>{department.campus_name || 'Main Campus'}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                <span className="text-[var(--text-muted)]">Contact Email</span>
                <span>{department.contact_email || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
                <span className="text-[var(--text-muted)]">Contact Number</span>
                <span>{department.contact_number || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Active Semester</span>
                <span>{department.current_semester}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resource Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {[
                { label: 'Faculty Members', val: department.faculty_count },
                { label: 'Enrolled Students', val: department.student_count },
                { label: 'Student Batches', val: department.batch_count },
                { label: 'Courses', val: department.course_count },
                { label: 'Rooms & Labs', val: department.room_count },
                { label: 'Scheduled Sessions', val: department.scheduled_entries_count },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <div className="font-mono text-xl font-bold">{item.val}</div>
                  <div className="text-xs text-[var(--text-muted)]">{item.label}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'faculty' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Faculty Members ({faculty.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {faculty.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">No faculty records in this department yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] font-mono text-[11px] text-[var(--text-muted)] uppercase">
                      <th className="py-2 pr-4">Code</th>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Designation</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2">Max Weekly Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {faculty.map((f) => (
                      <tr key={f.id}>
                        <td className="py-2.5 pr-4 font-mono text-xs text-[var(--accent-cyan)]">{f.employee_code}</td>
                        <td className="py-2.5 pr-4 font-medium">{f.name}</td>
                        <td className="py-2.5 pr-4 text-xs text-[var(--text-secondary)]">{f.designation}</td>
                        <td className="py-2.5 pr-4 text-xs text-[var(--text-secondary)]">{f.email}</td>
                        <td className="py-2.5 font-mono text-xs">{f.max_weekly_hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'students' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student Batches ({batches.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {batches.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">No student batches registered yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {batches.map((b) => (
                  <div key={b.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                    <div className="font-semibold">{b.name}</div>
                    <div className="mt-1 flex items-center gap-3 font-mono text-xs text-[var(--text-secondary)]">
                      <span>AY {b.academic_year}</span>
                      <span>· Sem {b.semester}</span>
                      <span>· Sec {b.section}</span>
                      <Badge variant="cyan">{b.student_strength} Students</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'admins' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Assigned Department Admins ({admins.length})</CardTitle>
              <Button size="sm" variant="secondary" onClick={() => navigate('/super-admin/admins')}>
                Manage Admins
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {admins.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">No Department Admins assigned yet.</p>
            ) : (
              <div className="space-y-2.5">
                {admins.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
                    <div>
                      <div className="font-medium">{a.full_name}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{a.email} · {a.designation}</div>
                    </div>
                    <Badge variant={a.is_active ? 'mint' : 'neutral'}>{a.is_active ? 'ACTIVE' : 'INACTIVE'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'academics' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Courses ({courses.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {courses.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--text-muted)]">No courses configured.</p>
              ) : (
                courses.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm">
                    <div>
                      <span className="font-mono text-xs text-[var(--accent-cyan)]">{c.code}</span> · {c.name}
                    </div>
                    <Badge variant="neutral">{c.course_type} · {c.weekly_hours}h</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Classrooms & Labs ({rooms.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rooms.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--text-muted)]">No rooms assigned.</p>
              ) : (
                rooms.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm">
                    <div>
                      <span className="font-mono font-semibold">{r.room_number}</span> · {r.building}
                    </div>
                    <Badge variant={r.room_type === 'LAB' ? 'violet' : 'neutral'}>
                      {r.room_type} · Cap {r.capacity}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'timetable' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timetable Publication & Version History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <div>
                <div className="text-xs text-[var(--text-muted)]">Current Status</div>
                <Badge variant={timetable_summary.status === 'PUBLISHED' ? 'mint' : 'amber'} className="mt-1">
                  {timetable_summary.status}
                </Badge>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">Active Version</div>
                <div className="font-mono text-lg font-bold">v{timetable_summary.active_version}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-muted)]">Scheduled Entries</div>
                <div className="font-mono text-lg font-bold">{timetable_summary.scheduled_entries}</div>
              </div>
            </div>
            {timetable_summary.versions.length > 0 && (
              <div className="space-y-2">
                {timetable_summary.versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-xs">
                    <div>
                      <span className="font-mono font-bold">Version {v.version_number}</span> · {v.notes}
                    </div>
                    <Badge variant={v.status === 'PUBLISHED' ? 'mint' : 'neutral'}>{v.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'activity' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Department Activity History</CardTitle>
          </CardHeader>
          <CardContent>
            {activity_history.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">No department-specific audit events yet.</p>
            ) : (
              <div className="space-y-2">
                {activity_history.map((act) => (
                  <div key={act.id} className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-xs">
                    <div>
                      <Badge variant="violet" className="mr-2">{act.action}</Badge>
                      <span className="font-medium">{act.user_name}</span>
                      <span className="ml-2 font-mono text-[var(--text-muted)]">{act.details}</span>
                    </div>
                    <span className="font-mono text-[var(--text-muted)]">
                      {new Date(act.created_at).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
