import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpDown,
  Building2,
  Edit3,
  Eye,
  GraduationCap,
  Layers,
  Plus,
  Users,
} from 'lucide-react';
import { superAdminApi } from '@/services/superAdminApi';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import type { DepartmentRich } from '@/types/superAdmin';

const PAGE_SIZE = 8;

export function DepartmentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [campusFilter, setCampusFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'faculty_count' | 'student_count'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(searchParams.get('action') === 'create');
  const [editingDept, setEditingDept] = useState<DepartmentRich | null>(null);
  const [confirmDept, setConfirmDept] = useState<DepartmentRich | null>(null);

  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    campus_id: '',
    hod_name: '',
    contact_email: '',
    contact_number: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['super-admin', 'departments'],
    queryFn: () => superAdminApi.listDepartments(),
  });

  const { data: univBundle } = useQuery({
    queryKey: ['super-admin', 'university-bundle'],
    queryFn: superAdminApi.getUniversityBundle,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        campus_id: form.campus_id || null,
      };
      return editingDept
        ? superAdminApi.updateDepartment(editingDept.id, payload)
        : superAdminApi.createDepartment(payload);
    },
    onSuccess: (saved) => {
      toast(
        editingDept ? 'Department Updated' : 'Department Created',
        'success',
        `${saved.name} (${saved.code}) saved.`,
      );
      setModalOpen(false);
      setEditingDept(null);
      if (searchParams.has('action')) {
        searchParams.delete('action');
        setSearchParams(searchParams, { replace: true });
      }
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? 'Failed to save department', 'error'),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (dept: DepartmentRich) =>
      superAdminApi.updateDepartmentStatus(dept.id, dept.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'),
    onSuccess: (updated) => {
      toast(
        `Department ${updated.status === 'ACTIVE' ? 'Reactivated' : 'Deactivated'}`,
        'success',
        `${updated.name} is now ${updated.status.toLowerCase()}.`,
      );
      setConfirmDept(null);
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: () => toast('Failed to change department status', 'error'),
  });

  const campuses = univBundle?.campuses ?? [];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = departments.filter((d) => {
      if (statusFilter && d.status !== statusFilter) return false;
      if (campusFilter && d.campus_id !== campusFilter) return false;
      if (
        q &&
        !d.name.toLowerCase().includes(q) &&
        !d.code.toLowerCase().includes(q) &&
        !d.hod_name.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
    return list;
  }, [departments, search, statusFilter, campusFilter, sortBy, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalActive = departments.filter((d) => d.status === 'ACTIVE').length;
  const totalInactive = departments.length - totalActive;
  const totalFaculty = departments.reduce((acc, d) => acc + d.faculty_count, 0);
  const totalStudents = departments.reduce((acc, d) => acc + d.student_count, 0);

  const openCreate = () => {
    setEditingDept(null);
    setForm({
      name: '',
      code: '',
      description: '',
      campus_id: campuses[0]?.id ?? '',
      hod_name: '',
      contact_email: '',
      contact_number: '',
      status: 'ACTIVE',
    });
    setModalOpen(true);
  };

  const openEdit = (dept: DepartmentRich) => {
    setEditingDept(dept);
    setForm({
      name: dept.name,
      code: dept.code,
      description: dept.description,
      campus_id: dept.campus_id ?? '',
      hod_name: dept.hod_name,
      contact_email: dept.contact_email,
      contact_number: dept.contact_number,
      status: dept.status,
    });
    setModalOpen(true);
  };

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortAsc(!sortAsc);
    else {
      setSortBy(col);
      setSortAsc(true);
    }
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="violet" className="mb-2">
            Academic Unit Governance
          </Badge>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Departments Management</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Create, configure, and isolate academic departments across university campuses.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Department
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Total Departments', val: departments.length, icon: Layers, color: 'text-[var(--accent-violet)]' },
          { label: 'Active Departments', val: totalActive, icon: Building2, color: 'text-[var(--accent-mint)]' },
          { label: 'Inactive', val: totalInactive, icon: Building2, color: 'text-[var(--accent-amber)]' },
          { label: 'Total Faculty', val: totalFaculty, icon: Users, color: 'text-[var(--accent-cyan)]' },
          { label: 'Total Students', val: totalStudents, icon: GraduationCap, color: 'text-[var(--accent-violet)]' },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">{k.label}</span>
                <Icon className={`h-4 w-4 ${k.color}`} />
              </div>
              <div className="mt-2 font-mono text-2xl font-bold">{k.val.toLocaleString('en-IN')}</div>
            </Card>
          );
        })}
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <CardTitle className="text-base">Department Directory</CardTitle>
              <CardDescription>Click a department name to open its 7-tab governance details</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, code, HOD..."
                className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)]"
              />
              <select
                value={campusFilter}
                onChange={(e) => {
                  setCampusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)]"
              >
                <option value="">All Campuses</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)]"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {paginated.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--text-muted)]">
              No departments found matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] font-mono text-[11px] text-[var(--text-muted)] uppercase">
                    <th className="py-2.5 pr-4">
                      <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]">
                        Department <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="py-2.5 pr-4">
                      <button type="button" onClick={() => toggleSort('code')} className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]">
                        Code <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="py-2.5 pr-4">HOD</th>
                    <th className="py-2.5 pr-4">Campus</th>
                    <th className="py-2.5 pr-4">
                      <button type="button" onClick={() => toggleSort('faculty_count')} className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]">
                        Faculty <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="py-2.5 pr-4">
                      <button type="button" onClick={() => toggleSort('student_count')} className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]">
                        Students <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="py-2.5 pr-4">Dept Admin</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {paginated.map((dept) => (
                    <tr key={dept.id} className="hover:bg-[var(--bg-elevated)]/40">
                      <td className="py-3 pr-4">
                        <Link
                          to={`/super-admin/departments/${dept.id}`}
                          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent-cyan)]"
                        >
                          {dept.name}
                        </Link>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          Created {new Date(dept.created_at).toLocaleDateString('en-IN')}
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-[var(--accent-cyan)]">{dept.code}</td>
                      <td className="py-3 pr-4 text-xs text-[var(--text-secondary)]">{dept.hod_name || '—'}</td>
                      <td className="py-3 pr-4 text-xs text-[var(--text-secondary)]">{dept.campus_name || 'Main Campus'}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{dept.faculty_count}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{dept.student_count}</td>
                      <td className="py-3 pr-4 text-xs text-[var(--text-secondary)]">
                        {dept.admin_names.length > 0 ? dept.admin_names.join(', ') : <span className="text-[var(--accent-amber)]">Unassigned</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={dept.status === 'ACTIVE' ? 'mint' : 'neutral'}>{dept.status}</Badge>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/super-admin/departments/${dept.id}`)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(dept)}>
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setConfirmDept(dept)}>
                            {dept.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-muted)]">
              <span>
                Page {page} of {totalPages} ({filtered.length} departments)
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingDept ? `Edit Department · ${editingDept.code}` : 'Create New Department'}
        description="Department codes must be unique within the university."
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
              label="Department Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Data Science & Engineering"
            />
            <Input
              label="Department Code"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="e.g. DSE"
            />
            <div>
              <label className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                Campus
              </label>
              <select
                value={form.campus_id}
                onChange={(e) => setForm({ ...form, campus_id: e.target.value })}
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
              >
                <option value="">Select Campus</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Head of Department (HOD)"
              value={form.hod_name}
              onChange={(e) => setForm({ ...form, hod_name: e.target.value })}
              placeholder="e.g. Dr. Ramesh Kulkarni"
            />
            <Input
              label="Contact Email"
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              placeholder="hod.dse@bharattech.edu.in"
            />
            <Input
              label="Contact Number"
              value={form.contact_number}
              onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
              placeholder="+91 80 2672 4820"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
              Description
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editingDept ? 'Save Changes' : 'Create Department'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDept)}
        onOpenChange={(open) => !open && setConfirmDept(null)}
        title={confirmDept?.status === 'ACTIVE' ? 'Deactivate Department?' : 'Reactivate Department?'}
        description={
          confirmDept?.status === 'ACTIVE'
            ? `Deactivating ${confirmDept.name} safely preserves all faculty, batches, and timetable history.`
            : `Reactivating ${confirmDept?.name} restores full scheduling access.`
        }
        confirmLabel={confirmDept?.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
        variant={confirmDept?.status === 'ACTIVE' ? 'danger' : 'primary'}
        loading={toggleStatusMutation.isPending}
        onConfirm={() => confirmDept && toggleStatusMutation.mutate(confirmDept)}
      />
    </div>
  );
}
