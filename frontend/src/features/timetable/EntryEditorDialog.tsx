import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import {
  DAYS_OF_WEEK,
  type ConflictDetail,
  type DayOfWeek,
  type SessionType,
  type TimetableEntryItem,
  type TimetableEntryPayload,
  type TimetableMetadata,
} from '@/types/timetable';
import { Button } from '@/components/ui/Button';

interface EntryEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: TimetableMetadata;
  initialEntry: TimetableEntryItem | null;
  defaultDay: DayOfWeek;
  defaultPeriod: number;
  defaultBatchId?: string;
  publishImmediately: boolean;
  conflicts: ConflictDetail[];
  isSaving: boolean;
  onSave: (payload: TimetableEntryPayload, existingId?: string) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
}

export function EntryEditorDialog({
  open,
  onOpenChange,
  metadata,
  initialEntry,
  defaultDay,
  defaultPeriod,
  defaultBatchId,
  publishImmediately,
  conflicts,
  isSaving,
  onSave,
  onDelete,
}: EntryEditorDialogProps) {
  const teachingSlots = metadata.time_slots.filter((s) => !s.is_break);
  const slotsForDay = (day: DayOfWeek) => teachingSlots.filter(
    (slot) => (!slot.applicable_days?.length || slot.applicable_days.includes(day))
      && !slot.blocked_days?.includes(day),
  );

  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(defaultDay);
  const [periodIndex, setPeriodIndex] = useState<number | null>(defaultPeriod);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationPeriods, setDurationPeriods] = useState<number>(1);
  const [courseId, setCourseId] = useState<string>('');
  const [facultyId, setFacultyId] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');
  const [batchId, setBatchId] = useState<string>('');
  const [sessionType, setSessionType] = useState<SessionType>('THEORY');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    if (initialEntry) {
      setDayOfWeek(initialEntry.day_of_week);
      const matchingSlot = slotsForDay(initialEntry.day_of_week).find((slot) => slot.period_index === initialEntry.period_index);
      setPeriodIndex(matchingSlot ? initialEntry.period_index : null);
      setStartTime(initialEntry.start_time);
      setEndTime(initialEntry.end_time);
      setDurationPeriods(initialEntry.duration_periods);
      setCourseId(initialEntry.course_id);
      setFacultyId(initialEntry.faculty_id);
      setRoomId(initialEntry.room_id);
      setBatchId(initialEntry.batch_id);
      setSessionType(initialEntry.session_type);
      setNotes(initialEntry.notes);
    } else {
      const firstCourse = metadata.courses[0];
      setDayOfWeek(defaultDay);
      const daySlots = slotsForDay(defaultDay);
      const selectedSlot = daySlots.find((slot) => slot.period_index === defaultPeriod) ?? daySlots[0];
      const customStart = defaultPeriod > 0 && defaultPeriod <= 1440 ? defaultPeriod - 1 : null;
      const customStartTime = customStart === null ? '' : `${String(Math.floor(customStart / 60)).padStart(2, '0')}:${String(customStart % 60).padStart(2, '0')}`;
      const isCustomDefault = !teachingSlots.some((slot) => slot.period_index === defaultPeriod) && customStart !== null;
      setPeriodIndex(isCustomDefault ? null : selectedSlot?.period_index ?? null);
      setStartTime(isCustomDefault ? customStartTime : selectedSlot?.start_time ?? '');
      const selectedSlotPosition = selectedSlot ? daySlots.findIndex((slot) => slot.id === selectedSlot.id) : -1;
      const defaultEndSlot = selectedSlotPosition >= 0
        ? daySlots[selectedSlotPosition + (firstCourse?.session_duration ?? 1) - 1]
        : undefined;
      const customEnd = customStart === null ? null : Math.min(1439, customStart + 45);
      const customEndTime = customEnd === null ? '' : `${String(Math.floor(customEnd / 60)).padStart(2, '0')}:${String(customEnd % 60).padStart(2, '0')}`;
      setEndTime(isCustomDefault ? customEndTime : defaultEndSlot?.end_time ?? selectedSlot?.end_time ?? '');
      setDurationPeriods(firstCourse?.session_duration ?? 1);
      setCourseId(firstCourse?.id ?? '');
      setFacultyId(metadata.faculty[0]?.id ?? '');
      setRoomId(metadata.rooms[0]?.id ?? '');
      setBatchId(defaultBatchId ?? metadata.batches[0]?.id ?? '');
      setSessionType((firstCourse?.course_type as SessionType) ?? 'THEORY');
      setNotes('');
    }
  }, [open, initialEntry, defaultDay, defaultPeriod, defaultBatchId, metadata]);

  const handleCourseChange = (nextCourseId: string) => {
    setCourseId(nextCourseId);
    const course = metadata.courses.find((c) => c.id === nextCourseId);
    if (course) {
      setSessionType(course.course_type as SessionType);
      setDurationPeriods(course.session_duration);
      if (course.course_type === 'PRACTICAL') {
        const firstLab = metadata.rooms.find((r) => r.room_type === 'LAB');
        if (firstLab) setRoomId(firstLab.id);
      }
    }
  };

  const handlePeriodChange = (value: string) => {
    if (value === 'custom') {
      setPeriodIndex(null);
      return;
    }
    const nextIndex = Number(value);
    const daySlots = slotsForDay(dayOfWeek);
    const slot = daySlots.find((item) => item.period_index === nextIndex);
    if (!slot) return;
    setPeriodIndex(nextIndex);
    setStartTime(slot.start_time);
    const startPosition = daySlots.findIndex((item) => item.id === slot.id);
    const lastSlot = daySlots[startPosition + durationPeriods - 1];
    setEndTime(lastSlot?.end_time ?? slot.end_time);
  };

  const handleDurationChange = (value: number) => {
    setDurationPeriods(value);
    if (periodIndex === null) return;
    const daySlots = slotsForDay(dayOfWeek);
    const startPosition = daySlots.findIndex((item) => item.period_index === periodIndex);
    const lastSlot = daySlots[startPosition + value - 1];
    if (lastSlot) setEndTime(lastSlot.end_time);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(
      {
        day_of_week: dayOfWeek,
        ...(periodIndex === null ? {} : { period_index: periodIndex }),
        duration_periods: durationPeriods,
        start_time: startTime,
        end_time: endTime,
        course_id: courseId,
        faculty_id: facultyId,
        room_id: roomId,
        batch_id: batchId,
        session_type: sessionType,
        notes,
        publish_immediately: publishImmediately,
      },
      initialEntry?.id,
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm" />
        <Dialog.Content className="glass-panel-elevated fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[94vw] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl p-6 shadow-2xl focus:outline-none">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <Dialog.Title className="font-display text-xl font-bold">
                {initialEntry ? 'Edit Timetable Session' : 'Add Timetable Session'}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-[var(--text-secondary)]">
                {publishImmediately
                  ? 'Changes are validated by the backend and published immediately to Faculty and Student portals.'
                  : 'Changes will be staged in Draft until you publish.'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)]"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {conflicts.length > 0 && (
            <div
              role="alert"
              className="mb-4 space-y-1.5 rounded-xl border border-[var(--accent-coral)]/40 bg-[var(--accent-coral-soft)] p-3.5 text-xs text-[var(--accent-coral)]"
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Hard Constraint Violation — Cannot Save</span>
              </div>
              <ul className="list-disc space-y-1 pl-5">
                {conflicts.map((c, idx) => (
                  <li key={`${c.code}-${idx}`}>{c.message}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)] uppercase">
                  Day
                </label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
                  className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)] uppercase">
                  Start Period
                </label>
                <select
                  value={periodIndex ?? 'custom'}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
                >
                  <option value="custom">Custom time interval</option>
                  {slotsForDay(dayOfWeek).map((slot) => (
                    <option key={slot.id} value={slot.period_index}>
                      {slot.label} ({slot.start_time}–{slot.end_time})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)] uppercase">
                  Duration (Periods)
                </label>
                <select
                  value={durationPeriods}
                  onChange={(e) => handleDurationChange(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
                >
                  <option value={1}>1 Hour (1 period)</option>
                  <option value={2}>2 Hours (2 consecutive)</option>
                  <option value={3}>3 Hours (3 consecutive)</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)] uppercase">Exact Start Time</label>
                <input required type="time" value={startTime} onChange={(e) => { setStartTime(e.target.value); setPeriodIndex(null); }}
                  className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)] uppercase">Exact End Time</label>
                <input required type="time" value={endTime} onChange={(e) => { setEndTime(e.target.value); setPeriodIndex(null); }}
                  className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)] uppercase">
                  Course
                </label>
                <select
                  value={courseId}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
                >
                  {metadata.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)] uppercase">
                  Session Type
                </label>
                <select
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value as SessionType)}
                  className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
                >
                  <option value="THEORY">THEORY</option>
                  <option value="PRACTICAL">PRACTICAL (Lab Required)</option>
                  <option value="TUTORIAL">TUTORIAL</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)] uppercase">
                  Faculty
                </label>
                <select
                  value={facultyId}
                  onChange={(e) => setFacultyId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
                >
                  {metadata.faculty.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)] uppercase">
                  Student Batch
                </label>
                <select
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
                >
                  {metadata.batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.student_strength} students)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)] uppercase">
                Classroom / Laboratory
              </label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
              >
                {metadata.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} · {r.room_type} · Cap {r.capacity} ({r.building})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)] uppercase">
                Session Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Topic, special lab instructions, or reschedule note"
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
              {initialEntry ? (
                <Button
                  type="button"
                  variant="danger"
                  disabled={isSaving}
                  onClick={() => void onDelete(initialEntry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Class
                </Button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2.5">
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button type="submit" disabled={isSaving}>
                  {isSaving
                    ? 'Validating & Saving...'
                    : publishImmediately
                      ? 'Save & Sync Live'
                      : 'Save to Draft'}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
