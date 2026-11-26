import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Cpu,
  Database,
  Download,
  FileText,
  Lock,
  Save,
  Settings,
} from 'lucide-react';
import { superAdminApi } from '@/services/superAdminApi';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import type { PlatformSettingsRecord } from '@/types/superAdmin';

type SettingsTab = 'general' | 'solver' | 'notifications' | 'security' | 'data' | 'audit';

export function PlatformSettingsPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as SettingsTab) || 'general';
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  // Audit Filters
  const [auditModule, setAuditModule] = useState('');
  const [auditRole, setAuditRole] = useState('');
  const [auditResult, setAuditResult] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['super-admin', 'platform-settings'],
    queryFn: superAdminApi.getPlatformSettings,
  });

  const { data: dataHealth } = useQuery({
    queryKey: ['super-admin', 'data-health'],
    queryFn: superAdminApi.getDataHealth,
    enabled: tab === 'data',
  });

  const { data: auditLogs = [], isLoading: auditLoading } = useQuery({
    queryKey: ['super-admin', 'audit-logs', auditModule, auditRole, auditResult, auditSearch],
    queryFn: () =>
      superAdminApi.listAuditLogs({
        module: auditModule || undefined,
        user_role: auditRole || undefined,
        result: auditResult || undefined,
        search: auditSearch || undefined,
      }),
    enabled: tab === 'audit',
  });

  const [form, setForm] = useState<Omit<
    PlatformSettingsRecord,
    'id' | 'university_id' | 'last_backup_at' | 'last_backup_status' | 'updated_at'
  > | null>(null);

  useEffect(() => {
    if (settings) {
      const {
        id: _id,
        university_id: _uid,
        last_backup_at: _lb,
        last_backup_status: _lbs,
        updated_at: _u,
        ...rest
      } = settings;
      setForm(rest);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form) throw new Error('Form not initialized');
      return superAdminApi.updatePlatformSettings(form);
    },
    onSuccess: () => {
      toast('Platform Settings Saved', 'success', 'Global configuration updated and audited.');
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? 'Failed to save settings', 'error'),
  });

  const handleExport = async () => {
    try {
      const payload = await superAdminApi.exportConfig();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartsched-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Configuration Exported', 'success');
    } catch {
      toast('Export Failed', 'error');
    }
  };

  const switchTab = (next: SettingsTab) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
  };

  if (isLoading || !form) return <PageSkeleton />;

  const weights = (() => {
    try {
      return JSON.parse(form.solver_weights_json) as Record<string, number>;
    } catch {
      return { faculty_preference: 80, gap_minimization: 70, room_utilization: 65, compact_schedule: 75 };
    }
  })();

  const updateWeight = (key: string, val: number) => {
    const next = { ...weights, [key]: val };
    setForm({ ...form, solver_weights_json: JSON.stringify(next) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="violet" className="mb-2">
            Global Configuration Center
          </Badge>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Platform Settings</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Configure global defaults, CP-SAT solver limits, notifications, security rules, and audit trails.
          </p>
        </div>
        {tab !== 'audit' && tab !== 'data' && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4" /> {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5">
        {(
          [
            ['general', 'General', Settings],
            ['solver', 'Solver Config', Cpu],
            ['notifications', 'Notifications', Bell],
            ['security', 'Security', Lock],
            ['data', 'Data Management', Database],
            ['audit', 'Audit Logs', FileText],
          ] as Array<[SettingsTab, string, typeof Settings]>
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => switchTab(id)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${
              tab === id
                ? 'bg-[var(--accent-violet-soft)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* TAB A: GENERAL */}
      {tab === 'general' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General Platform Settings</CardTitle>
            <CardDescription>Default locale, formatting, theme, and maintenance controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Platform Name"
                value={form.platform_name}
                onChange={(e) => setForm({ ...form, platform_name: e.target.value })}
              />
              <Input
                label="Default Timezone"
                value={form.default_timezone}
                onChange={(e) => setForm({ ...form, default_timezone: e.target.value })}
              />
              <Input
                label="Date Format"
                value={form.date_format}
                onChange={(e) => setForm({ ...form, date_format: e.target.value })}
              />
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase">
                  Time Format
                </label>
                <select
                  value={form.time_format}
                  onChange={(e) => setForm({ ...form, time_format: e.target.value as '12H' | '24H' })}
                  className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm"
                >
                  <option value="12H">12-Hour (AM/PM)</option>
                  <option value="24H">24-Hour</option>
                </select>
              </div>
              <Input
                label="Default Language"
                value={form.default_language}
                onChange={(e) => setForm({ ...form, default_language: e.target.value })}
              />
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase">
                  Default Theme
                </label>
                <select
                  value={form.default_theme}
                  onChange={(e) => setForm({ ...form, default_theme: e.target.value as 'dark' | 'light' })}
                  className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm"
                >
                  <option value="dark">Dark (Void Command)</option>
                  <option value="light">Light (High Contrast)</option>
                </select>
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">System Maintenance Mode</div>
                <div className="text-xs text-[var(--text-muted)]">
                  Temporarily pauses non-Super-Admin scheduling mutations during planned maintenance.
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.maintenance_mode}
                onChange={(e) => setForm({ ...form, maintenance_mode: e.target.checked })}
                className="h-4 w-4 accent-[var(--accent-coral)]"
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* TAB B: SOLVER CONFIG */}
      {tab === 'solver' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Google OR-Tools CP-SAT Global Defaults</CardTitle>
            <CardDescription>
              Default optimization limits. Department-specific overrides remain preserved unless policy restricts them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Default Time Limit (sec)"
                type="number"
                value={form.solver_default_time_limit_sec}
                onChange={(e) => setForm({ ...form, solver_default_time_limit_sec: Number(e.target.value) })}
              />
              <Input
                label="Max Time Limit (sec)"
                type="number"
                value={form.solver_max_time_limit_sec}
                onChange={(e) => setForm({ ...form, solver_max_time_limit_sec: Number(e.target.value) })}
              />
              <Input
                label="Max Alternative Timetables"
                type="number"
                value={form.solver_max_alternatives}
                onChange={(e) => setForm({ ...form, solver_max_alternatives: Number(e.target.value) })}
              />
              <Input
                label="Max Concurrent Solver Jobs"
                type="number"
                value={form.solver_max_concurrent_jobs}
                onChange={(e) => setForm({ ...form, solver_max_concurrent_jobs: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                Default Soft Optimization Weights (0–100)
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(weights).map(([k, val]) => (
                  <div key={k} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className="font-mono font-bold text-[var(--accent-cyan)]">{val}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={val}
                      onChange={(e) => updateWeight(k, Number(e.target.value))}
                      className="w-full accent-[var(--accent-violet)]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <div>
                <div className="text-sm font-medium">Allow Department-Specific Weight Overrides</div>
                <div className="text-xs text-[var(--text-muted)]">
                  Department Admins can fine-tune soft weights within their department without altering global defaults.
                </div>
              </div>
              <input
                type="checkbox"
                checked={form.solver_allow_dept_override}
                onChange={(e) => setForm({ ...form, solver_allow_dept_override: e.target.checked })}
                className="h-4 w-4 accent-[var(--accent-violet)]"
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* TAB C: NOTIFICATIONS */}
      {tab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notification Channels & Triggers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(
              [
                ['notify_in_app', 'In-App Notifications', 'Deliver live alerts inside SMARTSCHED notification center.'],
                ['notify_email', 'Email Notifications', 'Dispatch institutional email alerts for critical updates.'],
                ['notify_timetable_published', 'Timetable Published Alerts', 'Notify faculty and students when a version is published.'],
                ['notify_timetable_changed', 'Timetable Change Alerts', 'Broadcast live updates when sessions are edited or moved.'],
                ['notify_faculty_absence', 'Faculty Absence Alerts', 'Alert Department Admins when emergency leave is reported.'],
                ['notify_swap_requests', 'Swap Request Notifications', 'Notify peers and admins on class swap proposals.'],
                ['notify_leave_approvals', 'Leave Approval Notifications', 'Notify faculty when leave requests are approved or declined.'],
              ] as Array<[keyof typeof form, string, string]>
            ).map(([key, title, desc]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5"
              >
                <div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="text-xs text-[var(--text-muted)]">{desc}</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(form[key])}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  className="h-4 w-4 accent-[var(--accent-violet)]"
                />
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {/* TAB D: SECURITY */}
      {tab === 'security' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security & Authentication Policies</CardTitle>
            <CardDescription>Argon2 password hashing & JWT expiration governance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Minimum Password Length"
                type="number"
                min={6}
                max={32}
                value={form.min_password_length}
                onChange={(e) => setForm({ ...form, min_password_length: Number(e.target.value) })}
              />
              <Input
                label="Max Login Attempts"
                type="number"
                value={form.max_login_attempts}
                onChange={(e) => setForm({ ...form, max_login_attempts: Number(e.target.value) })}
              />
              <Input
                label="Lockout Duration (min)"
                type="number"
                value={form.lockout_duration_minutes}
                onChange={(e) => setForm({ ...form, lockout_duration_minutes: Number(e.target.value) })}
              />
              <Input
                label="Session Expiration (min)"
                type="number"
                value={form.session_expiration_minutes}
                onChange={(e) => setForm({ ...form, session_expiration_minutes: Number(e.target.value) })}
              />
              <Input
                label="Access Token TTL (min)"
                type="number"
                value={form.access_token_expire_minutes}
                onChange={(e) => setForm({ ...form, access_token_expire_minutes: Number(e.target.value) })}
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <div>
                <div className="text-sm font-medium">Require Special Characters in Passwords</div>
                <div className="text-xs text-[var(--text-muted)]">Enforces strong complexity on password setup and reset.</div>
              </div>
              <input
                type="checkbox"
                checked={form.require_special_chars}
                onChange={(e) => setForm({ ...form, require_special_chars: e.target.checked })}
                className="h-4 w-4 accent-[var(--accent-violet)]"
              />
            </label>
          </CardContent>
        </Card>
      )}

      {/* TAB E: DATA MANAGEMENT */}
      {tab === 'data' && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Database Health & Configuration Backup</CardTitle>
                <CardDescription>Live database metrics (credentials and secrets are never exposed)</CardDescription>
              </div>
              <Button size="sm" variant="secondary" onClick={handleExport}>
                <Download className="h-4 w-4" /> Export Configuration JSON
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {dataHealth ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                    <div className="text-xs text-[var(--text-muted)]">Database Engine</div>
                    <div className="mt-1 font-mono text-lg font-bold uppercase">{dataHealth.database_engine}</div>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                    <div className="text-xs text-[var(--text-muted)]">Health Status</div>
                    <Badge variant="mint" className="mt-1">{dataHealth.status}</Badge>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                    <div className="text-xs text-[var(--text-muted)]">Database Size</div>
                    <div className="mt-1 font-mono text-lg font-bold">
                      {(dataHealth.storage_bytes / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                    <div className="text-xs text-[var(--text-muted)]">Last Backup Status</div>
                    <div className="mt-1 font-mono text-sm font-semibold">{dataHealth.last_backup_status}</div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  {Object.entries(dataHealth.record_counts).map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-xs">
                      <span className="capitalize text-[var(--text-muted)]">{k.replace(/_/g, ' ')}</span>
                      <div className="mt-1 font-mono text-base font-bold">{v}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-6 text-sm text-[var(--text-muted)]">Loading database health...</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB F: AUDIT LOGS */}
      {tab === 'audit' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <CardTitle className="text-base">Institutional Audit Logs</CardTitle>
                <CardDescription>Immutable backend-generated governance trail</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search user, action, details..."
                  className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs"
                />
                <select
                  value={auditModule}
                  onChange={(e) => setAuditModule(e.target.value)}
                  className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs"
                >
                  <option value="">All Modules</option>
                  <option value="UNIVERSITY_PROFILE">University Profile</option>
                  <option value="DEPARTMENTS">Departments</option>
                  <option value="DEPARTMENT_ADMINS">Department Admins</option>
                  <option value="ACADEMIC_CALENDAR">Academic Calendar</option>
                  <option value="PLATFORM_SETTINGS">Platform Settings</option>
                </select>
                <select
                  value={auditRole}
                  onChange={(e) => setAuditRole(e.target.value)}
                  className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs"
                >
                  <option value="">All Roles</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="DEPT_ADMIN">Department Admin</option>
                </select>
                <select
                  value={auditResult}
                  onChange={(e) => setAuditResult(e.target.value)}
                  className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs"
                >
                  <option value="">All Results</option>
                  <option value="SUCCESS">Success</option>
                  <option value="FAILURE">Failure</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">Loading audit logs...</p>
            ) : auditLogs.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">No audit logs match the selected filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] font-mono text-[11px] text-[var(--text-muted)] uppercase">
                      <th className="py-2.5 pr-3">Timestamp</th>
                      <th className="py-2.5 pr-3">User / Role</th>
                      <th className="py-2.5 pr-3">Module</th>
                      <th className="py-2.5 pr-3">Action</th>
                      <th className="py-2.5 pr-3">Record</th>
                      <th className="py-2.5 pr-3">IP</th>
                      <th className="py-2.5 pr-3">Result</th>
                      <th className="py-2.5">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[var(--bg-elevated)]/40">
                        <td className="py-2.5 pr-3 font-mono whitespace-nowrap text-[var(--text-muted)]">
                          {new Date(log.created_at).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium text-[var(--text-primary)]">{log.user_name}</div>
                          <div className="font-mono text-[10px] text-[var(--text-muted)]">{log.user_role}</div>
                        </td>
                        <td className="py-2.5 pr-3 font-mono">{log.module}</td>
                        <td className="py-2.5 pr-3">
                          <Badge variant="violet">{log.action}</Badge>
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-[var(--text-secondary)]">
                          {log.entity_type} · {log.entity_id.slice(0, 14)}
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-[var(--text-muted)]">{log.ip_address}</td>
                        <td className="py-2.5 pr-3">
                          <Badge variant={log.result === 'SUCCESS' ? 'mint' : 'coral'}>{log.result}</Badge>
                        </td>
                        <td className="max-w-xs truncate py-2.5 font-mono text-[11px] text-[var(--text-secondary)]" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
