import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Edit3,
  Eye,
  Mail,
  Plus,
  Send,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import { superAdminApi } from '@/services/superAdminApi';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import type { DeptAdminRecord } from '@/types/superAdmin';

export function DepartmentAdminsPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(searchParams.get('action') === 'create');
  const [editingAdmin, setEditingAdmin] = useState<DeptAdminRecord | null>(null);
  const [viewingAdminId, setViewingAdminId] = useState<string | null>(null);
  const [confirmAdmin, setConfirmAdmin] = useState<DeptAdminRecord | null>(null);
  const [invitePreview, setInvitePreview] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    department_id: '',
    designation: 'Department Timetable Administrator',
    is_active: true,
  });

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['super-admin', 'department-admins'],
    queryFn: () => superAdminApi.listDepartmentAdmins(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['super-admin', 'departments'],
    queryFn: () => superAdminApi.listDepartments(),
  });

  const { data: adminDetail } = useQuery({
    queryKey: ['super-admin', 'department-admin-detail', viewingAdminId],
    queryFn: () => superAdminApi.getDepartmentAdminDetail(viewingAdminId!),
    enabled: Boolean(viewingAdminId),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editingAdmin
        ? superAdminApi.updateDepartmentAdmin(editingAdmin.id, {
            full_name: form.full_name,
            phone_number: form.phone_number,
            department_id: form.department_id,
            designation: form.designation,
            is_active: form.is_active,
          })
        : superAdminApi.createDepartmentAdmin(form),
    onSuccess: (saved) => {
      toast(
        editingAdmin ? 'Administrator Updated' : 'Invitation Sent',
        'success',
        editingAdmin
          ? `${saved.full_name} updated.`
          : `Secure setup invitation generated for ${saved.email}.`,
      );
      if (saved.setup_link_preview) {
        setInvitePreview(saved.setup_link_preview);
      }
      setModalOpen(false);
      setEditingAdmin(null);
      if (searchParams.has('action')) {
        searchParams.delete('action');
        setSearchParams(searchParams, { replace: true });
      }
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? 'Failed to save administrator', 'error'),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (admin: DeptAdminRecord) =>
      superAdminApi.updateDepartmentAdminStatus(admin.id, !admin.is_active),
    onSuccess: (updated) => {
      toast(
        updated.is_active ? 'Account Activated' : 'Account Deactivated',
        'success',
        `${updated.full_name} is now ${updated.is_active ? 'active' : 'inactive'}.`,
      );
      setConfirmAdmin(null);
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: () => toast('Failed to update administrator status', 'error'),
  });

  const resendInviteMutation = useMutation({
    mutationFn: (adminId: string) => superAdminApi.resendAdminInvite(adminId),
    onSuccess: (updated) => {
      toast('Invitation Resent', 'success', `New secure setup link generated for ${updated.email}.`);
      if (updated.setup_link_preview) setInvitePreview(updated.setup_link_preview);
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: () => toast('Failed to resend invitation', 'error'),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return admins.filter((a) => {
      if (deptFilter && a.department_id !== deptFilter) return false;
      if (statusFilter === 'ACTIVE' && !a.is_active) return false;
      if (statusFilter === 'INACTIVE' && a.is_active) return false;
      if (statusFilter === 'PENDING' && a.invite_status !== 'PENDING') return false;
      if (
        q &&
        !a.full_name.toLowerCase().includes(q) &&
        !a.email.toLowerCase().includes(q) &&
        !(a.department_name ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [admins, search, deptFilter, statusFilter]);

  const activeCount = admins.filter((a) => a.is_active).length;
  const inactiveCount = admins.length - activeCount;
  const pendingCount = admins.filter((a) => a.invite_status === 'PENDING').length;
  const deptsWithoutAdmins = departments.filter((d) => d.admin_count === 0).length;

  const openCreate = () => {
    setEditingAdmin(null);
    setForm({
      full_name: '',
      email: '',
      phone_number: '',
      department_id: departments[0]?.id ?? '',
      designation: 'Department Timetable Administrator',
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (a: DeptAdminRecord) => {
    setEditingAdmin(a);
    setForm({
      full_name: a.full_name,
      email: a.email,
      phone_number: a.phone_number,
      department_id: a.department_id ?? '',
      designation: a.designation,
      is_active: a.is_active,
    });
    setModalOpen(true);
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="violet" className="mb-2">
            Super Admin Exclusive · RBAC
          </Badge>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Department Administrators</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Provision, assign, activate, and audit department-level timetable administrators.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Provision Dept Admin
        </Button>
      </div>

      {invitePreview && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan-soft)] px-4 py-3 text-xs">
          <div>
            <span className="font-semibold text-[var(--text-primary)]">Secure Password Setup Link Generated: </span>
            <code className="font-mono text-[var(--accent-cyan)]">{invitePreview}</code>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setInvitePreview(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Total Administrators', val: admins.length, icon: UserCheck },
          { label: 'Active Accounts', val: activeCount, icon: ShieldCheck },
          { label: 'Inactive Accounts', val: inactiveCount, icon: UserX },
          { label: 'Pending Invitations', val: pendingCount, icon: Mail },
          { label: 'Depts Without Admin', val: deptsWithoutAdmins, icon: ShieldCheck },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">{k.label}</span>
                <Icon className="h-4 w-4 text-[var(--accent-cyan)]" />
              </div>
              <div className="mt-2 font-mono text-2xl font-bold">{k.val}</div>
            </Card>
          );
        })}
      </div>

      {/* Directory Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <CardTitle className="text-base">Administrator Directory</CardTitle>
              <CardDescription>Passwords are never exposed in plaintext; accounts use secure invite links</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email..."
                className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)]"
              />
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)]"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.name}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)]"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="PENDING">Pending Invite</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">No department administrators match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] font-mono text-[11px] text-[var(--text-muted)] uppercase">
                    <th className="py-2.5 pr-4">Administrator</th>
                    <th className="py-2.5 pr-4">Contact</th>
                    <th className="py-2.5 pr-4">Department</th>
                    <th className="py-2.5 pr-4">Designation</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Last Login</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filtered.map((admin) => (
                    <tr key={admin.id} className="hover:bg-[var(--bg-elevated)]/40">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-violet-soft)] font-mono text-xs font-bold text-[var(--accent-violet)]">
                            {admin.avatar_initials}
                          </div>
                          <div>
                            <div className="font-medium text-[var(--text-primary)]">{admin.full_name}</div>
                            <div className="font-mono text-[11px] text-[var(--text-muted)]">
                              Joined {new Date(admin.created_at).toLocaleDateString('en-IN')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        <div>{admin.email}</div>
                        <div className="font-mono text-[11px] text-[var(--text-muted)]">{admin.phone_number || '—'}</div>
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        {admin.department_code ? (
                          <Badge variant="cyan">{admin.department_code}</Badge>
                        ) : (
                          <span className="text-[var(--text-muted)]">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-[var(--text-secondary)]">{admin.designation}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-col gap-1">
                          <Badge variant={admin.is_active ? 'mint' : 'neutral'}>
                            {admin.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </Badge>
                          {admin.invite_status === 'PENDING' && <Badge variant="amber">INVITE PENDING</Badge>}
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-[var(--text-muted)]">
                        {admin.last_login_at
                          ? new Date(admin.last_login_at).toLocaleDateString('en-IN')
                          : 'Never'}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setViewingAdminId(admin.id)} title="View profile & activity">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(admin)} title="Edit / Reassign">
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => resendInviteMutation.mutate(admin.id)}
                            title="Resend invitation"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setConfirmAdmin(admin)}>
                            {admin.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provision / Edit Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingAdmin ? 'Edit Department Administrator' : 'Provision Department Administrator'}
        description={
          editingAdmin
            ? 'Update profile, designation, or reassign department.'
            : 'Generates a secure invitation token for password setup. Plaintext passwords are never stored or shown.'
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full Name"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
            <Input
              label="Official Email"
              type="email"
              required
              disabled={Boolean(editingAdmin)}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Phone Number"
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              placeholder="+91 98450 00000"
            />
            <div>
              <label className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                Assigned Department
              </label>
              <select
                required
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Input
            label="Designation"
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
          />
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 accent-[var(--accent-violet)]"
            />
            Account Active Immediately
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? 'Saving...'
                : editingAdmin
                  ? 'Save Changes'
                  : 'Send Secure Invite'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Admin Detail Modal */}
      <Modal
        open={Boolean(viewingAdminId)}
        onOpenChange={(open) => !open && setViewingAdminId(null)}
        title={adminDetail?.admin.full_name ?? 'Administrator Profile'}
        description={adminDetail?.admin.email}
      >
        {adminDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-xs">
              <div>
                <div className="text-[var(--text-muted)]">Department</div>
                <div className="mt-0.5 font-medium">{adminDetail.admin.department_name ?? 'Unassigned'}</div>
              </div>
              <div>
                <div className="text-[var(--text-muted)]">Status</div>
                <Badge variant={adminDetail.admin.is_active ? 'mint' : 'neutral'} className="mt-0.5">
                  {adminDetail.admin.is_active ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
              </div>
              <div>
                <div className="text-[var(--text-muted)]">Designation</div>
                <div className="mt-0.5">{adminDetail.admin.designation}</div>
              </div>
              <div>
                <div className="text-[var(--text-muted)]">Invite Status</div>
                <div className="mt-0.5">{adminDetail.admin.invite_status}</div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                Recent Activity History
              </h4>
              {adminDetail.recent_actions.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No recent audit actions recorded.</p>
              ) : (
                <div className="space-y-2">
                  {adminDetail.recent_actions.map((act) => (
                    <div key={act.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-xs">
                      <div className="flex justify-between">
                        <Badge variant="violet">{act.action}</Badge>
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          {new Date(act.created_at).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-[var(--text-secondary)]">{act.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmAdmin)}
        onOpenChange={(open) => !open && setConfirmAdmin(null)}
        title={confirmAdmin?.is_active ? 'Deactivate Administrator?' : 'Activate Administrator?'}
        description={
          confirmAdmin?.is_active
            ? `${confirmAdmin.full_name} will immediately lose access to their Department Admin portal.`
            : `Restore Department Admin access for ${confirmAdmin?.full_name}?`
        }
        confirmLabel={confirmAdmin?.is_active ? 'Deactivate' : 'Activate'}
        variant={confirmAdmin?.is_active ? 'danger' : 'primary'}
        loading={toggleStatusMutation.isPending}
        onConfirm={() => confirmAdmin && toggleStatusMutation.mutate(confirmAdmin)}
      />
    </div>
  );
}
