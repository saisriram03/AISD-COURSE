import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CalendarDays, CircleOff, Pencil, Plus, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { createAssignment, deactivateAssignment, fetchAssignments, updateAssignment } from '@/services/assignmentsApi';
import { createCourse, deactivateCourse, fetchCourses, updateCourse } from '@/services/coursesApi';
import { fetchTimetableMetadata } from '@/services/timetableApi';
import type { AssignmentStatus, CourseAssignment, CourseAssignmentPayload, CourseItem, CoursePayload, RoomRequirement } from '@/types/courses';
import type { SessionType } from '@/types/timetable';

type WorkspaceTab = 'courses' | 'assignments';
const EMPTY_COURSE: CoursePayload = {
  code: '', name: '', semester: 1, course_type: 'THEORY', weekly_hours: 3,
  session_duration_minutes: 60, required_qualification: '', required_room_type: 'ANY',
  required_equipment: [], eligible_batch_ids: [], color_token: '#7c5cff', is_active: true,
};
const EMPTY_ASSIGNMENT: CourseAssignmentPayload = {
  course_id: '', faculty_id: '', batch_id: '', weekly_session_count: 1,
  duration_minutes: 60, required_room_type: 'ANY', status: 'ACTIVE',
};

function apiError(error: unknown): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return 'Could not save the scheduling record. Check the values and try again.';
}

function roomLabel(room: RoomRequirement) {
  return room === 'ANY' ? 'Any room' : room === 'LAB' ? 'Laboratory' : 'Classroom';
}

export function CourseManagementPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<WorkspaceTab>('courses');
  const [search, setSearch] = useState('');
  const [courseStatus, setCourseStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [assignmentStatus, setAssignmentStatus] = useState<'ACTIVE' | 'INACTIVE' | 'all'>('ACTIVE');
  const [offset, setOffset] = useState(0);
  const [courseOpen, setCourseOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);
  const [courseForm, setCourseForm] = useState<CoursePayload>(EMPTY_COURSE);
  const [equipmentText, setEquipmentText] = useState('');
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<CourseAssignment | null>(null);
  const [assignmentForm, setAssignmentForm] = useState<CourseAssignmentPayload>(EMPTY_ASSIGNMENT);
  const [error, setError] = useState<string | null>(null);
  const [deactivateCourseTarget, setDeactivateCourseTarget] = useState<CourseItem | null>(null);
  const [deactivateAssignmentTarget, setDeactivateAssignmentTarget] = useState<CourseAssignment | null>(null);

  const coursesQuery = useQuery({
    queryKey: ['course-management', search, courseStatus, offset],
    queryFn: () => fetchCourses({ q: search || undefined, active: courseStatus === 'all' ? undefined : courseStatus === 'active', limit: 25, offset }),
  });
  const assignmentsQuery = useQuery({
    queryKey: ['course-assignments', search, assignmentStatus, offset],
    queryFn: () => fetchAssignments({ q: search || undefined, status: assignmentStatus === 'all' ? undefined : assignmentStatus, limit: 25, offset }),
  });
  const metadataQuery = useQuery({ queryKey: ['timetable-metadata'], queryFn: fetchTimetableMetadata });
  const courseDefinitionsQuery = useQuery({
    queryKey: ['course-definitions-active'],
    queryFn: () => fetchCourses({ active: true, limit: 100 }),
  });

  useEffect(() => {
    if (editingCourse) {
      const { id: _id, ...editable } = editingCourse;
      setCourseForm(editable);
      setEquipmentText(editable.required_equipment.join(', '));
    } else {
      setCourseForm(EMPTY_COURSE);
      setEquipmentText('');
    }
    setError(null);
  }, [editingCourse, courseOpen]);
  useEffect(() => {
    if (editingAssignment) {
      setAssignmentForm({
        course_id: editingAssignment.course_id,
        faculty_id: editingAssignment.faculty_id,
        batch_id: editingAssignment.batch_id,
        weekly_session_count: editingAssignment.weekly_session_count,
        duration_minutes: editingAssignment.duration_minutes,
        required_room_type: editingAssignment.required_room_type,
        status: editingAssignment.status,
      });
    } else {
      const firstCourse = courseDefinitionsQuery.data?.items[0];
      const firstFaculty = metadataQuery.data?.faculty[0];
      const firstBatch = metadataQuery.data?.batches[0];
      setAssignmentForm({
        ...EMPTY_ASSIGNMENT,
        course_id: firstCourse?.id ?? '',
        faculty_id: firstFaculty?.id ?? '',
        batch_id: firstBatch?.id ?? '',
        duration_minutes: firstCourse?.session_duration_minutes || 60,
      });
    }
    setError(null);
  }, [editingAssignment, assignmentOpen, metadataQuery.data, courseDefinitionsQuery.data]);

  const refreshSchedulingData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['course-management'] }),
      queryClient.invalidateQueries({ queryKey: ['course-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['timetable-metadata'] }),
    ]);
  };

  const saveCourse = useMutation({
    mutationFn: () => {
      const payload = { ...courseForm, required_equipment: equipmentText.split(',').map((item) => item.trim()).filter(Boolean) };
      return editingCourse ? updateCourse(editingCourse.id, payload) : createCourse(payload);
    },
    onSuccess: async () => { await refreshSchedulingData(); setCourseOpen(false); setEditingCourse(null); },
    onError: (saveError) => setError(apiError(saveError)),
  });
  const saveAssignment = useMutation({
    mutationFn: () => editingAssignment ? updateAssignment(editingAssignment.id, assignmentForm) : createAssignment(assignmentForm),
    onSuccess: async () => { await refreshSchedulingData(); setAssignmentOpen(false); setEditingAssignment(null); },
    onError: (saveError) => setError(apiError(saveError)),
  });
  const removeCourse = useMutation({
    mutationFn: (id: string) => deactivateCourse(id),
    onSuccess: async () => { await refreshSchedulingData(); setDeactivateCourseTarget(null); },
    onError: (saveError) => setError(apiError(saveError)),
  });
  const removeAssignment = useMutation({
    mutationFn: (id: string) => deactivateAssignment(id),
    onSuccess: async () => { await refreshSchedulingData(); setDeactivateAssignmentTarget(null); },
  });

  const courses = coursesQuery.data?.items ?? [];
  const assignments = assignmentsQuery.data?.items ?? [];
  const metadata = metadataQuery.data;
  const formCourses = courseDefinitionsQuery.data?.items ?? [];
  const formFaculty = metadata?.faculty ?? [];
  const formBatches = metadata?.batches ?? [];
  const count = tab === 'courses' ? coursesQuery.data?.total ?? 0 : assignmentsQuery.data?.total ?? 0;
  const pageItems = tab === 'courses' ? courses : assignments;

  function openNewCourse() {
    setEditingCourse(null);
    setCourseForm(EMPTY_COURSE);
    setCourseOpen(true);
  }
  function openNewAssignment() {
    setEditingAssignment(null);
    setAssignmentForm(EMPTY_ASSIGNMENT);
    setAssignmentOpen(true);
  }
  function submitCourse(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(null); saveCourse.mutate(); }
  function submitAssignment(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(null); saveAssignment.mutate(); }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-cyan)]">Department master data</p><h1 className="font-display text-3xl font-bold text-[var(--text-primary)]">Courses & Assignments</h1><p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">Keep course definitions separate from faculty and batch teaching requirements. Assignments become the required-session input for timetable generation.</p></div>
        <Button onClick={tab === 'courses' ? openNewCourse : openNewAssignment}><Plus size={16} /> {tab === 'courses' ? 'Add course' : 'Add assignment'}</Button>
      </header>

      <div className="flex gap-2 border-b border-[var(--border-subtle)] pb-2">
        {(['courses', 'assignments'] as const).map((value) => <button key={value} onClick={() => { setTab(value); setOffset(0); setSearch(''); }} className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${tab === value ? 'bg-[var(--accent-violet)]/15 text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'}`}>{value === 'courses' ? 'Course catalog' : 'Faculty & batch assignments'}</button>)}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-4"><div className="rounded-xl bg-violet-400/10 p-3 text-violet-300"><BookOpen size={18} /></div><div><p className="text-xs text-[var(--text-secondary)]">{tab === 'courses' ? 'Matching courses' : 'Matching assignments'}</p><p className="font-mono text-xl font-semibold text-[var(--text-primary)]">{count}</p></div></Card>
        <Card className="flex items-center gap-4"><div className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300"><Users size={18} /></div><div><p className="text-xs text-[var(--text-secondary)]">Eligible faculty</p><p className="font-mono text-xl font-semibold text-[var(--text-primary)]">{formFaculty.length}</p></div></Card>
        <Card className="flex items-center gap-4"><div className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300"><CalendarDays size={18} /></div><div><p className="text-xs text-[var(--text-secondary)]">Student batches</p><p className="font-mono text-xl font-semibold text-[var(--text-primary)]">{formBatches.length}</p></div></Card>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input aria-label="Search courses and assignments" value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} placeholder={tab === 'courses' ? 'Search course code or name' : 'Search course, faculty or batch'} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-cyan)] focus:outline-none" /></label>
          <select aria-label="Filter record status" value={tab === 'courses' ? courseStatus : assignmentStatus} onChange={(event) => { tab === 'courses' ? setCourseStatus(event.target.value as typeof courseStatus) : setAssignmentStatus(event.target.value as typeof assignmentStatus); setOffset(0); }} className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]">{tab === 'courses' ? <><option value="active">Active courses</option><option value="inactive">Inactive courses</option><option value="all">All courses</option></> : <><option value="ACTIVE">Active assignments</option><option value="INACTIVE">Inactive assignments</option><option value="all">All assignments</option></>}</select>
        </div>
        {(coursesQuery.isError || assignmentsQuery.isError || metadataQuery.isError || courseDefinitionsQuery.isError) && <p role="alert" className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">Could not load course or assignment data. Refresh to retry.</p>}
        {(tab === 'courses' ? coursesQuery.isLoading : assignmentsQuery.isLoading) ? <div className="h-48 animate-pulse rounded-xl bg-[var(--bg-elevated)]" /> : pageItems.length === 0 ? <div className="py-12 text-center"><BookOpen size={28} className="mx-auto mb-3 text-[var(--text-muted)]" /><CardTitle>{tab === 'courses' ? 'No courses found' : 'No assignments found'}</CardTitle><CardDescription className="mt-1">Add a record or adjust the filter.</CardDescription></div> : <>
          {tab === 'courses' ? <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-[var(--text-muted)]"><tr className="border-b border-[var(--border-subtle)]"><th className="px-3 py-3 font-medium">Course</th><th className="px-3 py-3 font-medium">Type / Semester</th><th className="px-3 py-3 font-medium">Weekly hours</th><th className="px-3 py-3 font-medium">Duration</th><th className="px-3 py-3 font-medium">Room / equipment</th><th className="px-3 py-3" /></tr></thead><tbody>{courses.map((course) => <tr key={course.id} className="border-b border-[var(--border-subtle)]/70 last:border-0"><td className="px-3 py-4"><p className="font-medium text-[var(--text-primary)]">{course.code} · {course.name}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{course.required_qualification || 'No qualification requirement'} · {course.eligible_batch_ids.length ? `${course.eligible_batch_ids.length} eligible batches` : 'All semester batches'}</p></td><td className="px-3 py-4"><Badge variant={course.course_type === 'PRACTICAL' ? 'violet' : 'cyan'}>{course.course_type}</Badge><p className="mt-1 text-xs text-[var(--text-secondary)]">Semester {course.semester}</p></td><td className="px-3 py-4 font-mono text-[var(--text-primary)]">{course.weekly_hours} h</td><td className="px-3 py-4 font-mono text-[var(--text-primary)]">{course.session_duration_minutes} min</td><td className="px-3 py-4 text-xs text-[var(--text-secondary)]">{roomLabel(course.required_room_type)}<p className="mt-1 text-[var(--text-muted)]">{course.required_equipment.join(', ') || 'No special equipment'}</p></td><td className="px-3 py-4"><div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => { setEditingCourse(course); setCourseOpen(true); }}><Pencil size={14} /> Edit</Button>{course.is_active && <Button size="sm" variant="ghost" aria-label={`Deactivate ${course.code}`} onClick={() => setDeactivateCourseTarget(course)}><CircleOff size={14} /></Button>}</div></td></tr>)}</tbody></table></div> : <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-[var(--text-muted)]"><tr className="border-b border-[var(--border-subtle)]"><th className="px-3 py-3 font-medium">Course & batch</th><th className="px-3 py-3 font-medium">Faculty</th><th className="px-3 py-3 font-medium">Weekly sessions</th><th className="px-3 py-3 font-medium">Session duration</th><th className="px-3 py-3 font-medium">Room</th><th className="px-3 py-3" /></tr></thead><tbody>{assignments.map((assignment) => <tr key={assignment.id} className="border-b border-[var(--border-subtle)]/70 last:border-0"><td className="px-3 py-4"><p className="font-medium text-[var(--text-primary)]">{assignment.course_code} · {assignment.course_name}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{assignment.batch_name}</p></td><td className="px-3 py-4 text-[var(--text-primary)]">{assignment.faculty_name}</td><td className="px-3 py-4 font-mono text-[var(--text-primary)]">{assignment.weekly_session_count}</td><td className="px-3 py-4 font-mono text-[var(--text-primary)]">{assignment.duration_minutes} min</td><td className="px-3 py-4"><Badge variant="neutral">{roomLabel(assignment.required_room_type)}</Badge></td><td className="px-3 py-4"><div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => { setEditingAssignment(assignment); setAssignmentOpen(true); }}><Pencil size={14} /> Edit</Button>{assignment.status === 'ACTIVE' && <Button size="sm" variant="ghost" aria-label={`Deactivate ${assignment.course_code} assignment`} onClick={() => setDeactivateAssignmentTarget(assignment)}><CircleOff size={14} /></Button>}</div></td></tr>)}</tbody></table></div>}
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]"><span>Showing {Math.min(offset + 1, count)}–{Math.min(offset + pageItems.length, count)} of {count}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</Button><Button size="sm" variant="secondary" disabled={offset + pageItems.length >= count} onClick={() => setOffset(offset + 25)}>Next</Button></div></div>
        </>}
      </Card>

      <Modal open={courseOpen} onOpenChange={(open) => { setCourseOpen(open); if (!open) setEditingCourse(null); }} title={editingCourse ? 'Edit course definition' : 'Add course definition'} description="Academic course properties are independent of faculty and batch assignments." maxWidthClass="max-w-3xl">
        <form onSubmit={(event) => { event.preventDefault(); setError(null); saveCourse.mutate(); }} className="space-y-5">
          {error && <p role="alert" className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2"><Input label="Course code" required value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })} /><Input label="Course name" required value={courseForm.name} onChange={(event) => setCourseForm({ ...courseForm, name: event.target.value })} /><label className="space-y-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Semester<input aria-label="Course semester" type="number" min={1} max={20} value={courseForm.semester} onChange={(event) => setCourseForm({ ...courseForm, semester: Number(event.target.value) })} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]" /></label><label className="space-y-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Course type<select aria-label="Course type" value={courseForm.course_type} onChange={(event) => setCourseForm({ ...courseForm, course_type: event.target.value as SessionType, required_room_type: event.target.value === 'PRACTICAL' ? 'LAB' : courseForm.required_room_type })} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"><option value="THEORY">Theory</option><option value="PRACTICAL">Practical</option><option value="TUTORIAL">Tutorial</option></select></label><Input label="Weekly required hours" type="number" min={1} max={168} value={courseForm.weekly_hours} onChange={(event) => setCourseForm({ ...courseForm, weekly_hours: Number(event.target.value) })} /><Input label="Default session duration (minutes)" type="number" min={1} max={1440} value={courseForm.session_duration_minutes} onChange={(event) => setCourseForm({ ...courseForm, session_duration_minutes: Number(event.target.value) })} /><Input label="Required faculty qualification" placeholder="Machine Learning, Networks, PhD CS" value={courseForm.required_qualification} onChange={(event) => setCourseForm({ ...courseForm, required_qualification: event.target.value })} /><label className="space-y-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Required room type<select aria-label="Required room type" value={courseForm.required_room_type} onChange={(event) => setCourseForm({ ...courseForm, required_room_type: event.target.value as RoomRequirement })} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"><option value="ANY">Any room</option><option value="CLASSROOM">Classroom</option><option value="LAB">Laboratory</option></select></label></div>
          <Input label="Required equipment (comma separated)" placeholder="Projector, Linux workstations" value={equipmentText} onChange={(event) => setEquipmentText(event.target.value)} />
          <div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Eligible student batches</p>{formBatches.length === 0 ? <p className="text-xs text-[var(--text-muted)]">No batches are configured yet. An empty selection allows any batch in this semester.</p> : <div className="grid max-h-32 gap-2 overflow-y-auto rounded-xl border border-[var(--border-subtle)] p-3 sm:grid-cols-2">{formBatches.map((batch) => <label key={batch.id} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><input type="checkbox" checked={courseForm.eligible_batch_ids.includes(batch.id)} onChange={(event) => setCourseForm({ ...courseForm, eligible_batch_ids: event.target.checked ? [...courseForm.eligible_batch_ids, batch.id] : courseForm.eligible_batch_ids.filter((id) => id !== batch.id) })} className="accent-violet-500" />{batch.name}</label>)}</div>}</div>
          {editingCourse && <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><input type="checkbox" checked={courseForm.is_active} onChange={(event) => setCourseForm({ ...courseForm, is_active: event.target.checked })} className="accent-violet-500" /> Course active</label>}
          <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4"><Button type="button" variant="secondary" onClick={() => setCourseOpen(false)}>Cancel</Button><Button type="submit" disabled={saveCourse.isPending}>{saveCourse.isPending ? 'Saving…' : editingCourse ? 'Save changes' : 'Create course'}</Button></div>
        </form>
      </Modal>

      <Modal open={assignmentOpen} onOpenChange={(open) => { setAssignmentOpen(open); if (!open) setEditingAssignment(null); }} title={editingAssignment ? 'Edit teaching assignment' : 'Create teaching assignment'} description="Each record describes one faculty and batch pairing. Add another record to support shared or additional teaching assignments." maxWidthClass="max-w-2xl">
        <form onSubmit={(event) => { event.preventDefault(); setError(null); saveAssignment.mutate(); }} className="space-y-5">
          {error && <p role="alert" className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Course<select required aria-label="Assignment course" value={assignmentForm.course_id} onChange={(event) => { const selected = formCourses.find((course) => course.id === event.target.value); setAssignmentForm({ ...assignmentForm, course_id: event.target.value, duration_minutes: selected?.session_duration_minutes || 60 }); }} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"><option value="">Select course</option>{formCourses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}</select></label><label className="space-y-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Faculty<select required aria-label="Assignment faculty" value={assignmentForm.faculty_id} onChange={(event) => setAssignmentForm({ ...assignmentForm, faculty_id: event.target.value })} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"><option value="">Select faculty</option>{formFaculty.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}</select></label><label className="space-y-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Student batch<select required aria-label="Assignment batch" value={assignmentForm.batch_id} onChange={(event) => setAssignmentForm({ ...assignmentForm, batch_id: event.target.value })} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"><option value="">Select batch</option>{formBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></label><Input label="Required sessions each week" type="number" min={1} required value={assignmentForm.weekly_session_count} onChange={(event) => setAssignmentForm({ ...assignmentForm, weekly_session_count: Number(event.target.value) })} /><Input label="Session duration (minutes)" type="number" min={1} max={1440} required value={assignmentForm.duration_minutes} onChange={(event) => setAssignmentForm({ ...assignmentForm, duration_minutes: Number(event.target.value) })} /><label className="space-y-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Required room type<select aria-label="Assignment room type" value={assignmentForm.required_room_type} onChange={(event) => setAssignmentForm({ ...assignmentForm, required_room_type: event.target.value as RoomRequirement })} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"><option value="ANY">Use course requirement</option><option value="CLASSROOM">Classroom</option><option value="LAB">Laboratory</option></select></label><label className="space-y-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Assignment status<select aria-label="Assignment status" value={assignmentForm.status} onChange={(event) => setAssignmentForm({ ...assignmentForm, status: event.target.value as AssignmentStatus })} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div>
          <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4"><Button type="button" variant="secondary" onClick={() => setAssignmentOpen(false)}>Cancel</Button><Button type="submit" disabled={saveAssignment.isPending || !formCourses.length || !formFaculty.length || !formBatches.length}>{saveAssignment.isPending ? 'Saving…' : editingAssignment ? 'Save changes' : 'Create assignment'}</Button></div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(deactivateCourseTarget)} onOpenChange={(open) => !open && setDeactivateCourseTarget(null)} title="Deactivate course?" description={`${deactivateCourseTarget?.code ?? 'This course'} will be removed from new assignment choices. Existing timetable history is retained.`} confirmLabel="Deactivate" loading={removeCourse.isPending} onConfirm={() => deactivateCourseTarget && removeCourse.mutate(deactivateCourseTarget.id)} />
      <ConfirmDialog open={Boolean(deactivateAssignmentTarget)} onOpenChange={(open) => !open && setDeactivateAssignmentTarget(null)} title="Deactivate assignment?" description="This assignment will no longer define a required teaching pair for timetable edits." confirmLabel="Deactivate" loading={removeAssignment.isPending} onConfirm={() => deactivateAssignmentTarget && removeAssignment.mutate(deactivateAssignmentTarget.id)} />
    </div>
  );
}

