import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CircleOff, Clock3, Pencil, Plus, Search, UserRound, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { createFaculty, deactivateFaculty, fetchFaculty, updateFaculty } from '@/services/facultyApi';
import { fetchTimetableMetadata } from '@/services/timetableApi';
import type { FacultyAvailability, FacultyItem, FacultyPayload } from '@/types/faculty';
import type { DayOfWeek } from '@/types/timetable';

const DAYS: Array<{ id: DayOfWeek; name: string }> = [
  { id: 'MON', name: 'Mon' }, { id: 'TUE', name: 'Tue' }, { id: 'WED', name: 'Wed' },
  { id: 'THU', name: 'Thu' }, { id: 'FRI', name: 'Fri' }, { id: 'SAT', name: 'Sat' }, { id: 'SUN', name: 'Sun' },
];
const EMPTY_FORM: FacultyPayload = {
  employee_code: '', name: '', email: '', phone_number: '', designation: 'Assistant Professor',
  qualifications: '', eligible_course_ids: [], max_weekly_hours: 18,
  working_days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], availability: [], is_active: true,
};

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    const detail = response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return 'Could not save faculty information. Check the values and try again.';
}

export function FacultyManagementPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<FacultyItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState<FacultyItem | null>(null);
  const [form, setForm] = useState<FacultyPayload>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [newAvailability, setNewAvailability] = useState<FacultyAvailability>({
    day_of_week: 'MON', start_time: '09:00', end_time: '10:00', availability_type: 'UNAVAILABLE', label: '',
  });

  const facultyQuery = useQuery({
    queryKey: ['faculty-management', search, activeFilter, offset],
    queryFn: () => fetchFaculty({ q: search || undefined, active: activeFilter === 'all' ? undefined : activeFilter === 'active', limit: 25, offset }),
  });
  const metadataQuery = useQuery({ queryKey: ['timetable-metadata'], queryFn: fetchTimetableMetadata });

  useEffect(() => {
    if (editing) {
      const { id: _id, ...editable } = editing;
      setForm(editable);
    } else setForm(EMPTY_FORM);
    setError(null);
  }, [editing, formOpen]);

  const saveMutation = useMutation({
    mutationFn: () => editing ? updateFaculty(editing.id, form) : createFaculty(form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['faculty-management'] });
      await queryClient.invalidateQueries({ queryKey: ['timetable-metadata'] });
      setFormOpen(false);
      setEditing(null);
    },
    onError: (saveError) => setError(errorMessage(saveError)),
  });
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateFaculty(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['faculty-management'] });
      await queryClient.invalidateQueries({ queryKey: ['timetable-metadata'] });
      setPendingDeactivate(null);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(item: FacultyItem) {
    setEditing(item);
    setFormOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    saveMutation.mutate();
  }

  function toggleWorkingDay(day: DayOfWeek) {
    setForm((current) => ({
      ...current,
      working_days: current.working_days.includes(day)
        ? current.working_days.filter((item) => item !== day)
        : DAYS.map((item) => item.id).filter((item) => current.working_days.includes(item) || item === day),
    }));
  }

  function addAvailability() {
    setForm((current) => ({ ...current, availability: [...current.availability, newAvailability] }));
  }

  const total = facultyQuery.data?.total ?? 0;
  const items = facultyQuery.data?.items ?? [];
  const courses = metadataQuery.data?.courses ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-cyan)]">Department master data</p>
          <h1 className="font-display text-3xl font-bold text-[var(--text-primary)]">Faculty</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">Manage faculty qualifications, workload limits, course eligibility and day-specific availability windows.</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Add faculty</Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-4"><div className="rounded-xl bg-violet-400/10 p-3 text-violet-300"><Users size={18} /></div><div><p className="text-xs text-[var(--text-secondary)]">{activeFilter === 'active' ? 'Active faculty' : 'Matching faculty'}</p><p className="font-mono text-xl font-semibold text-[var(--text-primary)]">{facultyQuery.isLoading ? '—' : total}</p></div></Card>
        <Card className="flex items-center gap-4"><div className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300"><BookOpen size={18} /></div><div><p className="text-xs text-[var(--text-secondary)]">Department courses</p><p className="font-mono text-xl font-semibold text-[var(--text-primary)]">{metadataQuery.data?.courses.length ?? '—'}</p></div></Card>
        <Card className="flex items-center gap-4"><div className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300"><Clock3 size={18} /></div><div><p className="text-xs text-[var(--text-secondary)]">Workload limit</p><p className="text-sm font-medium text-[var(--text-primary)]">Enforced during timetable edits</p></div></Card>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input aria-label="Search faculty" value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} placeholder="Search name, employee code, or email" className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:outline-none" /></label>
          <select aria-label="Filter faculty status" value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value as typeof activeFilter); setOffset(0); }} className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All faculty</option></select>
        </div>

        {facultyQuery.isError && <p role="alert" className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">Could not load faculty. Refresh to retry.</p>}
        {facultyQuery.isLoading ? <div className="h-48 animate-pulse rounded-xl bg-[var(--bg-elevated)]" /> : items.length === 0 ? <div className="py-12 text-center"><UserRound size={28} className="mx-auto mb-3 text-[var(--text-muted)]" /><CardTitle>No faculty found</CardTitle><CardDescription className="mt-1">Add a faculty profile or adjust your search.</CardDescription></div> : <>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-[var(--text-muted)]"><tr className="border-b border-[var(--border-subtle)]"><th className="px-3 py-3 font-medium">Faculty</th><th className="px-3 py-3 font-medium">Qualification</th><th className="px-3 py-3 font-medium">Weekly limit</th><th className="px-3 py-3 font-medium">Working days</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3" /></tr></thead><tbody>
            {items.map((person) => <tr key={person.id} className="border-b border-[var(--border-subtle)]/70 last:border-0"><td className="px-3 py-4"><p className="font-medium text-[var(--text-primary)]">{person.name}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{person.employee_code} · {person.email}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{person.designation}</p></td><td className="max-w-[220px] px-3 py-4"><p className="truncate text-[var(--text-secondary)]">{person.qualifications || 'Not provided'}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{person.eligible_course_ids.length} eligible courses</p></td><td className="px-3 py-4 font-mono text-[var(--text-primary)]">{person.max_weekly_hours} h</td><td className="px-3 py-4 text-xs text-[var(--text-secondary)]">{person.working_days.map((day) => DAYS.find((item) => item.id === day)?.name).filter(Boolean).join(', ') || 'None'}</td><td className="px-3 py-4"><Badge variant={person.is_active ? 'mint' : 'neutral'}>{person.is_active ? 'Active' : 'Inactive'}</Badge></td><td className="px-3 py-4"><div className="flex justify-end gap-2"><Button aria-label={`Edit ${person.name}`} variant="secondary" size="sm" onClick={() => openEdit(person)}><Pencil size={14} /> Edit</Button>{person.is_active && <Button aria-label={`Deactivate ${person.name}`} variant="ghost" size="sm" onClick={() => setPendingDeactivate(person)}><CircleOff size={14} /></Button>}</div></td></tr>)}
          </tbody></table></div>
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]"><span>Showing {Math.min(offset + 1, total)}–{Math.min(offset + items.length, total)} of {total}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button><Button size="sm" variant="secondary" disabled={offset + items.length >= total} onClick={() => setOffset(offset + 25)}>Next</Button></div></div>
        </>}
      </Card>

      <Modal open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null); }} title={editing ? 'Edit faculty profile' : 'Add faculty'} description="Profile, workload and availability are saved to the department database." maxWidthClass="max-w-3xl">
        <form onSubmit={submit} className="space-y-5">
          {error && <p role="alert" className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Employee code" required value={form.employee_code} onChange={(event) => setForm({ ...form, employee_code: event.target.value })} />
            <Input label="Full name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <Input label="Email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <Input label="Phone" type="tel" value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} />
            <Input label="Designation" value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} />
            <Input label="Maximum weekly teaching hours" type="number" min={1} max={80} required value={form.max_weekly_hours} onChange={(event) => setForm({ ...form, max_weekly_hours: Number(event.target.value) })} />
          </div>
          <Input label="Qualifications" placeholder="PhD Computer Science, MTech AI" value={form.qualifications} onChange={(event) => setForm({ ...form, qualifications: event.target.value })} />
          <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Working days</p><div className="flex flex-wrap gap-2">{DAYS.map((day) => <label key={day.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]"><input type="checkbox" checked={form.working_days.includes(day.id)} onChange={() => toggleWorkingDay(day.id)} className="accent-violet-500" />{day.name}</label>)}</div></div>
          <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Eligible courses</p>{courses.length === 0 ? <p className="text-xs text-[var(--text-muted)]">Add courses before assigning eligibility.</p> : <div className="grid max-h-36 gap-2 overflow-y-auto rounded-xl border border-[var(--border-subtle)] p-3 sm:grid-cols-2">{courses.map((course) => <label key={course.id} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><input type="checkbox" checked={form.eligible_course_ids.includes(course.id)} onChange={(event) => setForm({ ...form, eligible_course_ids: event.target.checked ? [...form.eligible_course_ids, course.id] : form.eligible_course_ids.filter((id) => id !== course.id) })} className="accent-violet-500" />{course.code} · {course.name}</label>)}</div>}</div>
          <div className="space-y-3"><div><p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Availability intervals</p><p className="mt-1 text-xs text-[var(--text-muted)]">Unavailable windows block manual scheduling. Preferred windows are stored for solver integration.</p></div><div className="grid gap-2 sm:grid-cols-[100px_120px_120px_150px_minmax(0,1fr)_auto] sm:items-end"><label className="space-y-1.5 text-xs text-[var(--text-secondary)]">Day<select aria-label="Availability day" value={newAvailability.day_of_week} onChange={(event) => setNewAvailability({ ...newAvailability, day_of_week: event.target.value as DayOfWeek })} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-primary)]">{DAYS.map((day) => <option key={day.id} value={day.id}>{day.name}</option>)}</select></label><Input label="From" type="time" value={newAvailability.start_time} onChange={(event) => setNewAvailability({ ...newAvailability, start_time: event.target.value })} /><Input label="To" type="time" value={newAvailability.end_time} onChange={(event) => setNewAvailability({ ...newAvailability, end_time: event.target.value })} /><label className="space-y-1.5 text-xs text-[var(--text-secondary)]">Rule<select aria-label="Availability type" value={newAvailability.availability_type} onChange={(event) => setNewAvailability({ ...newAvailability, availability_type: event.target.value as FacultyAvailability['availability_type'] })} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-primary)]"><option value="UNAVAILABLE">Unavailable</option><option value="PREFERRED">Preferred</option></select></label><Input label="Label (optional)" value={newAvailability.label} onChange={(event) => setNewAvailability({ ...newAvailability, label: event.target.value })} /><Button type="button" variant="secondary" onClick={addAvailability}><Plus size={14} /> Add</Button></div>
            {form.availability.length > 0 && <ul className="space-y-2">{form.availability.map((window, index) => <li key={`${window.day_of_week}-${window.start_time}-${index}`} className="flex items-center justify-between rounded-lg bg-[var(--bg-elevated)] px-3 py-2 text-xs"><span className="text-[var(--text-primary)]">{DAYS.find((day) => day.id === window.day_of_week)?.name} · {window.start_time}–{window.end_time} · {window.availability_type.toLowerCase()}{window.label ? ` · ${window.label}` : ''}</span><button type="button" onClick={() => setForm({ ...form, availability: form.availability.filter((_, itemIndex) => itemIndex !== index) })} className="text-rose-300">Remove</button></li>)}</ul>}
          </div>
          {editing && <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="accent-violet-500" /> Faculty profile active</label>}
          <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4"><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create faculty'}</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(pendingDeactivate)} onOpenChange={(open) => !open && setPendingDeactivate(null)} title="Deactivate faculty?" description={`${pendingDeactivate?.name ?? 'This faculty member'} will remain in historical timetables but cannot be assigned to new sessions.`} confirmLabel="Deactivate" loading={deactivateMutation.isPending} onConfirm={() => pendingDeactivate && deactivateMutation.mutate(pendingDeactivate.id)} />
    </div>
  );
}
