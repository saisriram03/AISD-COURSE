import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Edit3,
  Globe,
  Mail,
  MapPin,
  Phone,
  Plus,
  Save,
  Shield,
  Upload,
} from 'lucide-react';
import { superAdminApi } from '@/services/superAdminApi';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import type { CampusRecord, TenantSettingRecord, UniversityProfile } from '@/types/superAdmin';

const WORKING_DAY_OPTIONS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export function UniversityProfilePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'university-bundle'],
    queryFn: superAdminApi.getUniversityBundle,
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<UniversityProfile>>({});
  const [tenantForm, setTenantForm] = useState<Omit<TenantSettingRecord, 'id' | 'university_id' | 'updated_at'> | null>(
    null,
  );

  const [campusModalOpen, setCampusModalOpen] = useState(false);
  const [editingCampus, setEditingCampus] = useState<CampusRecord | null>(null);
  const [viewingCampus, setViewingCampus] = useState<CampusRecord | null>(null);
  const [confirmCampus, setConfirmCampus] = useState<CampusRecord | null>(null);
  const [campusSearch, setCampusSearch] = useState('');
  const [campusForm, setCampusForm] = useState<Omit<CampusRecord, 'id' | 'university_id' | 'created_at'>>({
    name: '',
    code: '',
    campus_type: 'MAIN_CAMPUS',
    address: '',
    city: '',
    state: '',
    contact_email: '',
    contact_number: '',
    status: 'ACTIVE',
  });

  useEffect(() => {
    if (data?.university) {
      setForm(data.university);
    }
    if (data?.tenant_settings) {
      const { id: _id, university_id: _uid, updated_at: _u, ...rest } = data.tenant_settings;
      setTenantForm(rest);
    }
  }, [data]);

  const updateUnivMutation = useMutation({
    mutationFn: () => superAdminApi.updateUniversity(form),
    onSuccess: () => {
      toast('University Profile Updated', 'success', 'Institutional metadata and policies saved.');
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? 'Failed to update university', 'error'),
  });

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => superAdminApi.uploadUniversityLogo(file),
    onSuccess: () => {
      toast('University Logo Updated', 'success', 'Logo uploaded and persisted.');
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? 'Failed to upload logo', 'error'),
  });

  const updateTenantMutation = useMutation({
    mutationFn: () => {
      if (!tenantForm) throw new Error('Missing tenant form');
      return superAdminApi.updateTenantSettings(tenantForm);
    },
    onSuccess: () => {
      toast('Tenant Isolation Settings Saved', 'success');
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: () => toast('Failed to save tenant settings', 'error'),
  });

  const saveCampusMutation = useMutation({
    mutationFn: () =>
      editingCampus
        ? superAdminApi.updateCampus(editingCampus.id, campusForm)
        : superAdminApi.createCampus(campusForm),
    onSuccess: () => {
      toast(editingCampus ? 'Campus Updated' : 'Campus Created', 'success');
      setCampusModalOpen(false);
      setEditingCampus(null);
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? 'Failed to save campus', 'error'),
  });

  const toggleCampusMutation = useMutation({
    mutationFn: (campus: CampusRecord) =>
      superAdminApi.toggleCampusStatus(campus.id, campus.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'),
    onSuccess: () => {
      toast('Campus Status Updated', 'success');
      setConfirmCampus(null);
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: () => toast('Failed to update campus status', 'error'),
  });

  if (isLoading || !data) return <PageSkeleton />;

  const { university, campuses } = data;
  const selectedDays = (form.default_working_days ?? '').split(',').filter(Boolean);

  const toggleWorkingDay = (day: string) => {
    if (!editing) return;
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    setForm((prev) => ({ ...prev, default_working_days: next.join(',') }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('File too large', 'error', 'Logo must be 2 MB or smaller.');
      return;
    }
    uploadLogoMutation.mutate(file);
  };

  const openAddCampus = () => {
    setEditingCampus(null);
    setCampusForm({
      name: '',
      code: '',
      campus_type: 'MAIN_CAMPUS',
      address: '',
      city: '',
      state: '',
      contact_email: '',
      contact_number: '',
      status: 'ACTIVE',
    });
    setCampusModalOpen(true);
  };

  const openEditCampus = (c: CampusRecord) => {
    setEditingCampus(c);
    setCampusForm({
      name: c.name,
      code: c.code,
      campus_type: c.campus_type,
      address: c.address,
      city: c.city,
      state: c.state,
      contact_email: c.contact_email,
      contact_number: c.contact_number,
      status: c.status,
    });
    setCampusModalOpen(true);
  };

  const filteredCampuses = campuses.filter((c) => {
    const q = campusSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.city.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="violet" className="mb-2">
            Institution & Tenant Governance
          </Badge>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">University Profile</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Manage institutional identity, multi-campus registry, tenant isolation, and governance policies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setForm(university);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={() => updateUnivMutation.mutate()} disabled={updateUnivMutation.isPending}>
                <Save className="h-4 w-4" />
                {updateUnivMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)}>
              <Edit3 className="h-4 w-4" /> Edit Profile
            </Button>
          )}
        </div>
      </div>

      {/* Institutional Identity & Logo */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Institutional Identity</CardTitle>
            <CardDescription>Logo & tenant verification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 text-center">
              {university.logo_url ? (
                <img
                  src={university.logo_url}
                  alt={university.name}
                  className="mb-3 h-20 w-20 rounded-2xl object-cover shadow-md"
                />
              ) : (
                <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--accent-violet-soft)] text-[var(--accent-violet)]">
                  <Building2 className="h-9 w-9" />
                </div>
              )}
              <div className="text-sm font-semibold">{university.name}</div>
              <div className="font-mono text-xs text-[var(--accent-cyan)]">{university.code}</div>

              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-medium hover:bg-[var(--bg-glass-hover)]">
                <Upload className="h-3.5 w-3.5" />
                {uploadLogoMutation.isPending ? 'Uploading...' : 'Upload Logo (PNG/SVG/JPG)'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoChange}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Tenant ID</span>
                <span className="font-mono text-[var(--text-primary)]">{university.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Tenant Status</span>
                <Badge variant={university.tenant_status === 'ACTIVE' ? 'mint' : 'amber'}>
                  {university.tenant_status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Created</span>
                <span className="font-mono text-[var(--text-secondary)]">
                  {new Date(university.created_at).toLocaleDateString('en-IN')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Basic University & Contact Information */}
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle className="text-base">Basic & Contact Information</CardTitle>
            <CardDescription>Official university profile stored in database</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="University Name"
                value={form.name ?? ''}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                label="University Code"
                value={form.code ?? ''}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <Input
                label="University Type"
                value={form.university_type ?? ''}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, university_type: e.target.value })}
              />
              <Input
                label="Established Year"
                type="number"
                value={form.established_year ?? ''}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, established_year: Number(e.target.value) || null })}
              />
              <Input
                label="Accreditation"
                value={form.accreditation ?? ''}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, accreditation: e.target.value })}
              />
              <Input
                label="Website"
                value={form.website ?? ''}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
              <Input
                label="Official Email"
                type="email"
                value={form.official_email ?? ''}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, official_email: e.target.value })}
              />
              <Input
                label="Contact Number"
                value={form.contact_number ?? ''}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
              />
              <Input
                label="Alternate Number"
                value={form.alternate_number ?? ''}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, alternate_number: e.target.value })}
              />
              <Input
                label="Address"
                value={form.address ?? ''}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
              <Input
                label="City"
                value={form.city ?? ''}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
              <Input
                label="State"
                value={form.state ?? ''}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
              <Input
                label="Country"
                value={form.country ?? ''}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
              <Input
                label="Postal Code"
                value={form.postal_code ?? ''}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                Institution Description
              </label>
              <textarea
                rows={3}
                disabled={!editing}
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent-cyan)] focus:outline-none disabled:opacity-70"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Institutional Policies & Tenant Management */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-[var(--accent-cyan)]" /> Institutional Academic Policies
            </CardTitle>
            <CardDescription>Default working days, timezone, and semester structure</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Default Timezone"
                value={form.default_timezone ?? 'Asia/Kolkata'}
                disabled={!editing}
                onChange={(e) => setForm({ ...form, default_timezone: e.target.value })}
              />
              <div>
                <label className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                  Semester Structure
                </label>
                <select
                  disabled={!editing}
                  value={form.default_semester_structure ?? 'ODD_EVEN'}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      default_semester_structure: e.target.value as UniversityProfile['default_semester_structure'],
                    })
                  }
                  className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] disabled:opacity-70"
                >
                  <option value="ODD_EVEN">Odd / Even Semesters</option>
                  <option value="TRIMESTER">Trimester System</option>
                  <option value="ANNUAL">Annual System</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                Default Working Days
              </label>
              <div className="flex flex-wrap gap-2">
                {WORKING_DAY_OPTIONS.map((day) => {
                  const active = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={!editing}
                      onClick={() => toggleWorkingDay(day)}
                      className={`rounded-xl border px-3 py-1.5 font-mono text-xs transition-colors ${
                        active
                          ? 'border-[var(--accent-violet)] bg-[var(--accent-violet-soft)] text-[var(--text-primary)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                Governance Policies
              </label>
              <textarea
                rows={2}
                disabled={!editing}
                value={form.governance_policies ?? ''}
                onChange={(e) => setForm({ ...form, governance_policies: e.target.value })}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-primary)] disabled:opacity-70"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                Institutional Scheduling Policies
              </label>
              <textarea
                rows={2}
                disabled={!editing}
                value={form.scheduling_policies ?? ''}
                onChange={(e) => setForm({ ...form, scheduling_policies: e.target.value })}
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-primary)] disabled:opacity-70"
              />
            </div>
          </CardContent>
        </Card>

        {tenantForm && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-[var(--accent-mint)]" /> Tenant Isolation & Governance
              </CardTitle>
              <CardDescription>Backend-enforced tenant and department boundary rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Data Ownership Label"
                value={tenantForm.data_ownership_label}
                onChange={(e) => setTenantForm({ ...tenantForm, data_ownership_label: e.target.value })}
              />
              <Input
                label="Custom Institutional Domain"
                value={tenantForm.custom_domain}
                onChange={(e) => setTenantForm({ ...tenantForm, custom_domain: e.target.value })}
              />
              <div className="space-y-2.5">
                {[
                  {
                    key: 'enforce_department_isolation' as const,
                    label: 'Enforce Strict Department Isolation',
                    desc: 'Department Admins, Faculty & Students are strictly isolated to their own department.',
                  },
                  {
                    key: 'allow_cross_dept_electives' as const,
                    label: 'Allow Cross-Department Electives',
                    desc: 'Permit elective course mapping across departments when explicitly approved.',
                  },
                  {
                    key: 'allow_shared_rooms' as const,
                    label: 'Allow Shared Lecture Halls',
                    desc: 'Enable centrally pooled auditoriums across departments.',
                  },
                  {
                    key: 'require_super_admin_dept_approval' as const,
                    label: 'Require Super Admin Approval for New Units',
                    desc: 'Only Super Admin can create or deactivate departments.',
                  },
                ].map((toggle) => (
                  <label
                    key={toggle.key}
                    className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">{toggle.label}</div>
                      <div className="text-xs text-[var(--text-muted)]">{toggle.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={tenantForm[toggle.key]}
                      onChange={(e) => setTenantForm({ ...tenantForm, [toggle.key]: e.target.checked })}
                      className="mt-1 h-4 w-4 accent-[var(--accent-violet)]"
                    />
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => updateTenantMutation.mutate()}
                  disabled={updateTenantMutation.isPending}
                >
                  <Save className="h-3.5 w-3.5" />
                  {updateTenantMutation.isPending ? 'Saving...' : 'Save Tenant Controls'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Campus Management */}
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="text-base">Campus Management</CardTitle>
              <CardDescription>Manage university campuses and regional centers</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={campusSearch}
                onChange={(e) => setCampusSearch(e.target.value)}
                placeholder="Search campuses..."
                className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)]"
              />
              <Button size="sm" onClick={openAddCampus}>
                <Plus className="h-4 w-4" /> Add Campus
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCampuses.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">No campuses match your search.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredCampuses.map((campus) => (
                <div
                  key={campus.id}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-display text-base font-semibold text-[var(--text-primary)]">
                          {campus.name}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 font-mono text-xs text-[var(--accent-cyan)]">
                          <span>{campus.code}</span>
                          <span>·</span>
                          <span className="text-[var(--text-muted)]">{campus.campus_type.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <Badge variant={campus.status === 'ACTIVE' ? 'mint' : 'neutral'}>{campus.status}</Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        {campus.address}, {campus.city}, {campus.state}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-[var(--text-muted)]" /> {campus.contact_email || '—'}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-[var(--text-muted)]" /> {campus.contact_number || '—'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3">
                    <Button size="sm" variant="ghost" onClick={() => setViewingCampus(campus)}>
                      View
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openEditCampus(campus)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmCampus(campus)}>
                      {campus.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Campus Modal */}
      <Modal
        open={campusModalOpen}
        onOpenChange={setCampusModalOpen}
        title={editingCampus ? 'Edit Campus' : 'Add New Campus'}
        description="Configure campus code, location, and contact details."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveCampusMutation.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Campus Name"
              required
              value={campusForm.name}
              onChange={(e) => setCampusForm({ ...campusForm, name: e.target.value })}
            />
            <Input
              label="Campus Code"
              required
              value={campusForm.code}
              onChange={(e) => setCampusForm({ ...campusForm, code: e.target.value })}
            />
            <div>
              <label className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                Campus Type
              </label>
              <select
                value={campusForm.campus_type}
                onChange={(e) =>
                  setCampusForm({ ...campusForm, campus_type: e.target.value as CampusRecord['campus_type'] })
                }
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
              >
                <option value="MAIN_CAMPUS">Main Campus</option>
                <option value="RESEARCH_CAMPUS">Research Campus</option>
                <option value="SATELLITE_CAMPUS">Satellite Campus</option>
                <option value="CITY_CENTER">City Center</option>
              </select>
            </div>
            <Input
              label="City"
              value={campusForm.city}
              onChange={(e) => setCampusForm({ ...campusForm, city: e.target.value })}
            />
            <Input
              label="State"
              value={campusForm.state}
              onChange={(e) => setCampusForm({ ...campusForm, state: e.target.value })}
            />
            <Input
              label="Contact Email"
              type="email"
              value={campusForm.contact_email}
              onChange={(e) => setCampusForm({ ...campusForm, contact_email: e.target.value })}
            />
            <Input
              label="Contact Number"
              value={campusForm.contact_number}
              onChange={(e) => setCampusForm({ ...campusForm, contact_number: e.target.value })}
            />
          </div>
          <Input
            label="Address"
            value={campusForm.address}
            onChange={(e) => setCampusForm({ ...campusForm, address: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCampusModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveCampusMutation.isPending}>
              {saveCampusMutation.isPending ? 'Saving...' : editingCampus ? 'Update Campus' : 'Create Campus'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Campus Modal */}
      <Modal
        open={Boolean(viewingCampus)}
        onOpenChange={(open) => !open && setViewingCampus(null)}
        title={viewingCampus?.name ?? 'Campus Details'}
        description={`Code: ${viewingCampus?.code ?? ''}`}
      >
        {viewingCampus && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
              <span className="text-[var(--text-muted)]">Type</span>
              <span>{viewingCampus.campus_type.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
              <span className="text-[var(--text-muted)]">Status</span>
              <Badge variant={viewingCampus.status === 'ACTIVE' ? 'mint' : 'neutral'}>{viewingCampus.status}</Badge>
            </div>
            <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
              <span className="text-[var(--text-muted)]">Address</span>
              <span className="text-right">{viewingCampus.address}, {viewingCampus.city}, {viewingCampus.state}</span>
            </div>
            <div className="flex justify-between border-b border-[var(--border-subtle)] pb-2">
              <span className="text-[var(--text-muted)]">Email</span>
              <span>{viewingCampus.contact_email || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Phone</span>
              <span>{viewingCampus.contact_number || '—'}</span>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmCampus)}
        onOpenChange={(open) => !open && setConfirmCampus(null)}
        title={confirmCampus?.status === 'ACTIVE' ? 'Deactivate Campus?' : 'Activate Campus?'}
        description={`Change status of ${confirmCampus?.name} (${confirmCampus?.code})?`}
        confirmLabel={confirmCampus?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        variant={confirmCampus?.status === 'ACTIVE' ? 'danger' : 'primary'}
        loading={toggleCampusMutation.isPending}
        onConfirm={() => confirmCampus && toggleCampusMutation.mutate(confirmCampus)}
      />
    </div>
  );
}
