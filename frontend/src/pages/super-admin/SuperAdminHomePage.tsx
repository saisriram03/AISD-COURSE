import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  GraduationCap,
  Layers,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { superAdminApi } from '@/services/superAdminApi';
import { useAuthStore } from '@/store/useAuthStore';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import type { DepartmentRich } from '@/types/superAdmin';

export function SuperAdminHomePage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDept, setConfirmDept] = useState<DepartmentRich | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['super-admin', 'dashboard', statusFilter],
    queryFn: () => superAdminApi.getDashboard(statusFilter ? { status_filter: statusFilter } : undefined),
  });

  const toggleDeptMutation = useMutation({
    mutationFn: (dept: DepartmentRich) =>
      superAdminApi.updateDepartmentStatus(dept.id, dept.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'),
    onSuccess: (updated) => {
      toast(
        `Department ${updated.status === 'ACTIVE' ? 'Activated' : 'Deactivated'}`,
        'success',
        `${updated.name} (${updated.code}) is now ${updated.status.toLowerCase()}.`,
      );
      setConfirmDept(null);
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: () => toast('Failed to update department status', 'error'),
  });

  const filteredDepartments = useMemo(() => {
    const list = data?.departments ?? [];
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.hod_name.toLowerCase().includes(q),
    );
  }, [data?.departments, searchTerm]);

  if (isLoading) return <PageSkeleton />;

  if (isError || !data) {
    return (
      <Card className="border-[var(--accent-coral)]/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[var(--accent-coral)]">
            <AlertTriangle className="h-5 w-5" /> Unable to load University Overview
          </CardTitle>
          <CardDescription>
            Ensure the FastAPI backend is running and your Super Admin session is active.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} variant="secondary">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { university, kpis, scheduling_health, charts, recent_activities, current_academic_year } = data;
  const maxChartVal = Math.max(
    1,
    ...charts.department_distribution.map((d) => Math.max(d.students, d.faculty * 10, 1)),
  );

  const kpiCards = [
    {
      label: 'Total Departments',
      value: kpis.total_departments,
      desc: 'Academic units across campuses',
      icon: Layers,
      accent: 'violet' as const,
      path: '/super-admin/departments',
    },
    {
      label: 'Department Admins',
      value: kpis.total_department_admins,
      desc: 'Provisioned scheduling coordinators',
      icon: UserCheck,
      accent: 'cyan' as const,
      path: '/super-admin/admins',
    },
    {
      label: 'Total Faculty',
      value: kpis.total_faculty,
      desc: 'Teaching staff across departments',
      icon: Users,
      accent: 'mint' as const,
      path: '/super-admin/departments',
    },
    {
      label: 'Total Students',
      value: kpis.total_students,
      desc: 'Enrolled batch strength',
      icon: GraduationCap,
      accent: 'amber' as const,
      path: '/super-admin/departments',
    },
    {
      label: 'Active Academic Years',
      value: kpis.active_academic_years,
      desc: current_academic_year ? `Current: ${current_academic_year.name}` : 'Configure academic year',
      icon: Calendar,
      accent: 'cyan' as const,
      path: '/super-admin/academic-terms',
    },
    {
      label: 'Published Timetables',
      value: kpis.published_timetables,
      desc: 'Live department schedules',
      icon: CheckCircle2,
      accent: 'mint' as const,
      path: '/super-admin/departments',
    },
  ];

  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* A. Command Center Header */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="violet">
                <Sparkles className="h-3 w-3" /> University Command Center
              </Badge>
              <Badge variant={university.tenant_status === 'ACTIVE' ? 'mint' : 'amber'}>
                {university.tenant_status}
              </Badge>
              {current_academic_year && (
                <Badge variant="cyan">AY {current_academic_year.name}</Badge>
              )}
              <span className="font-mono text-xs text-[var(--text-muted)]">{todayFormatted}</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {university.name}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Welcome back, <span className="font-medium text-[var(--text-primary)]">{user?.fullName}</span>.
              Monitor university-wide scheduling health, governance compliance, and departmental operations.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button size="sm" onClick={() => navigate('/super-admin/departments?action=create')}>
              <Plus className="h-4 w-4" /> Add Department
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/super-admin/admins?action=create')}>
              <UserCheck className="h-4 w-4" /> Add Dept Admin
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/super-admin/academic-terms')}>
              <Calendar className="h-4 w-4" /> Academic Calendar
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/super-admin/settings?tab=audit')}>
              <Activity className="h-4 w-4" /> Audit Logs
            </Button>
          </div>
        </div>
      </div>

      {/* B. University KPI Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <motion.div key={kpi.label} variants={staggerItem}>
              <button
                type="button"
                onClick={() => navigate(kpi.path)}
                className="glass-panel group flex h-full w-full flex-col justify-between rounded-2xl p-4 text-left transition-all hover:border-[var(--accent-violet)]/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-elevated)] text-[var(--accent-cyan)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--text-primary)]" />
                </div>
                <div className="mt-3">
                  <div className="font-mono text-2xl font-bold text-[var(--text-primary)]">
                    {kpi.value.toLocaleString('en-IN')}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-[var(--text-primary)]">{kpi.label}</div>
                  <div className="mt-1 text-[11px] text-[var(--text-muted)]">{kpi.desc}</div>
                </div>
              </button>
            </motion.div>
          );
        })}
      </motion.div>

      {/* D. Scheduling Health & F. Analytics */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-[var(--accent-mint)]" /> Department Scheduling Health
            </CardTitle>
            <CardDescription>Live timetable publication status across all departments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                label: 'Published Timetables',
                count: scheduling_health.published,
                badge: 'mint' as const,
                desc: 'Active & visible to faculty and students',
              },
              {
                label: 'Draft Timetables',
                count: scheduling_health.draft,
                badge: 'cyan' as const,
                desc: 'Generated or edited, awaiting publish',
              },
              {
                label: 'Unresolved Conflicts',
                count: scheduling_health.conflicts,
                badge: 'coral' as const,
                desc: 'Requires Department Admin resolution',
              },
              {
                label: 'Not Yet Generated',
                count: scheduling_health.not_generated,
                badge: 'amber' as const,
                desc: 'Pending initial timetable generation',
              },
              {
                label: 'Departments Without Admin',
                count: scheduling_health.departments_without_admin,
                badge: scheduling_health.departments_without_admin > 0 ? ('coral' as const) : ('neutral' as const),
                desc: 'Assign a Department Admin to enable scheduling',
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 px-3.5 py-2.5"
              >
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{row.label}</div>
                  <div className="text-xs text-[var(--text-muted)]">{row.desc}</div>
                </div>
                <Badge variant={row.badge} className="px-3 py-1 text-xs">
                  {row.count}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-[var(--accent-violet)]" /> Faculty & Student Distribution
            </CardTitle>
            <CardDescription>Live database breakdown by department</CardDescription>
          </CardHeader>
          <CardContent>
            {charts.department_distribution.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--text-muted)]">
                No department records found.
              </p>
            ) : (
              <div className="space-y-4">
                {charts.department_distribution.map((item) => {
                  const stuPct = Math.min(100, Math.round((item.students / maxChartVal) * 100));
                  const facPct = Math.min(100, Math.round(((item.faculty * 10) / maxChartVal) * 100));
                  return (
                    <div key={item.code} className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[var(--text-primary)]">
                          <span className="font-mono text-[var(--accent-cyan)]">{item.code}</span> · {item.name}
                        </span>
                        <span className="font-mono text-[var(--text-secondary)]">
                          {item.faculty} Faculty · {item.students} Students · {item.rooms} Rooms
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-elevated)]" title={`Students: ${item.students}`}>
                          <div
                            className="h-full rounded-full bg-[var(--accent-violet)] transition-all duration-500"
                            style={{ width: `${Math.max(stuPct, item.students > 0 ? 6 : 0)}%` }}
                          />
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-elevated)]" title={`Faculty: ${item.faculty}`}>
                          <div
                            className="h-full rounded-full bg-[var(--accent-cyan)] transition-all duration-500"
                            style={{ width: `${Math.max(facPct, item.faculty > 0 ? 6 : 0)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-4 pt-2 text-[11px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent-violet)]" /> Students
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent-cyan)]" /> Faculty (scaled 10x)
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* C. Department Overview Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="text-base">Department Overview</CardTitle>
              <CardDescription>Click any department to inspect faculty, batches, admins, and timetable status</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter departments..."
                aria-label="Filter departments"
                className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:outline-none"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
                className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] focus:border-[var(--accent-cyan)] focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] font-mono text-[11px] text-[var(--text-muted)] uppercase">
                  <th className="py-2.5 pr-4">Department</th>
                  <th className="py-2.5 pr-4">HOD</th>
                  <th className="py-2.5 pr-4">Faculty</th>
                  <th className="py-2.5 pr-4">Students</th>
                  <th className="py-2.5 pr-4">Semester</th>
                  <th className="py-2.5 pr-4">Timetable</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredDepartments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-[var(--bg-elevated)]/40">
                    <td className="py-3 pr-4">
                      <Link
                        to={`/super-admin/departments/${dept.id}`}
                        className="font-medium text-[var(--text-primary)] hover:text-[var(--accent-cyan)]"
                      >
                        {dept.name}
                      </Link>
                      <div className="font-mono text-[11px] text-[var(--text-muted)]">{dept.code}</div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-[var(--text-secondary)]">
                      {dept.hod_name || 'Unassigned'}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">{dept.faculty_count}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{dept.student_count}</td>
                    <td className="py-3 pr-4 text-xs text-[var(--text-secondary)]">{dept.current_semester}</td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant={
                          dept.timetable_status === 'PUBLISHED'
                            ? 'mint'
                            : dept.timetable_status === 'DRAFT'
                              ? 'cyan'
                              : dept.timetable_status === 'CONFLICT'
                                ? 'coral'
                                : 'amber'
                        }
                      >
                        {dept.timetable_status === 'PUBLISHED'
                          ? `PUBLISHED v${dept.timetable_version}`
                          : dept.timetable_status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={dept.status === 'ACTIVE' ? 'mint' : 'neutral'}>{dept.status}</Badge>
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/super-admin/departments/${dept.id}`)}
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setConfirmDept(dept)}
                        >
                          {dept.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* E. Recent Administrative Activities */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-[var(--accent-cyan)]" /> Recent Administrative Activities
              </CardTitle>
              <CardDescription>Live audit log feed across university governance modules</CardDescription>
            </div>
            <Link to="/super-admin/settings?tab=audit">
              <Button size="sm" variant="ghost">
                View Full Audit Log <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recent_activities.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">No audit events recorded yet.</p>
          ) : (
            <div className="space-y-2.5">
              {recent_activities.slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="violet">{log.action}</Badge>
                      <span className="text-xs font-medium text-[var(--text-primary)]">{log.user_name}</span>
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">
                        {log.entity_type} · {log.entity_id}
                      </span>
                    </div>
                    <p className="truncate font-mono text-[11px] text-[var(--text-secondary)]">{log.details}</p>
                  </div>
                  <div className="shrink-0 font-mono text-[11px] text-[var(--text-muted)]">
                    {new Date(log.created_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmDept)}
        onOpenChange={(open) => !open && setConfirmDept(null)}
        title={confirmDept?.status === 'ACTIVE' ? 'Deactivate Department?' : 'Reactivate Department?'}
        description={
          confirmDept?.status === 'ACTIVE'
            ? `Deactivating ${confirmDept.name} preserves all academic records while marking it inactive.`
            : `Reactivating ${confirmDept?.name} will restore it to active university governance.`
        }
        confirmLabel={confirmDept?.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
        variant={confirmDept?.status === 'ACTIVE' ? 'danger' : 'primary'}
        loading={toggleDeptMutation.isPending}
        onConfirm={() => confirmDept && toggleDeptMutation.mutate(confirmDept)}
      />
    </div>
  );
}
