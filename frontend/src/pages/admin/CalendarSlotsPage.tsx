import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CalendarClock, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { fetchDepartmentSchedule, saveDepartmentSchedule } from '@/services/calendarApi';
import type {
  CalendarDay,
  DepartmentSchedulePayload,
  PeriodType,
  SchedulePeriod,
} from '@/types/calendar';

const DAYS: CalendarDay[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_NAMES: Record<CalendarDay, string> = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday',
  FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};
const TYPES: { value: PeriodType; label: string }[] = [
  { value: 'TEACHING', label: 'Teaching' },
  { value: 'BREAK', label: 'Break' },
  { value: 'LUNCH', label: 'Lunch' },
  { value: 'NON_TEACHING', label: 'Non teaching' },
];

function toMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(value: number): string {
  const safe = Math.max(0, Math.min(1439, value));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function CalendarSlotsPage() {
  const queryClient = useQueryClient();
  const scheduleQuery = useQuery({ queryKey: ['department-schedule'], queryFn: fetchDepartmentSchedule });
  const [draft, setDraft] = useState<DepartmentSchedulePayload | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDay>('MON');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (scheduleQuery.data) {
      setDraft({
        operating_days: scheduleQuery.data.operating_days.map(({ id: _id, ...day }) => day),
        periods: scheduleQuery.data.periods.map(({ id: _id, ...period }) => period),
      });
    }
  }, [scheduleQuery.data]);

  const saveMutation = useMutation({
    mutationFn: saveDepartmentSchedule,
    onSuccess: (saved) => {
      setDraft({
        operating_days: saved.operating_days.map(({ id: _id, ...day }) => day),
        periods: saved.periods.map(({ id: _id, ...period }) => period),
      });
      queryClient.setQueryData(['department-schedule'], saved);
      queryClient.invalidateQueries({ queryKey: ['timetable-metadata'] });
      setMessage('Operating hours and periods saved.');
    },
    onError: (error: { response?: { data?: { detail?: string | { message?: string } } } }) => {
      const detail = error.response?.data?.detail;
      setMessage(typeof detail === 'string' ? detail : detail?.message ?? 'Could not save this schedule. Check the intervals for overlaps.');
    },
  });

  const day = draft?.operating_days.find((item) => item.day_of_week === selectedDay);
  const periods = useMemo(
    () => (draft?.periods ?? []).filter((period) => period.day_of_week === selectedDay)
      .sort((a, b) => a.sort_order - b.sort_order),
    [draft, selectedDay],
  );
  const isDirty = Boolean(draft && scheduleQuery.data && JSON.stringify({
    operating_days: scheduleQuery.data.operating_days.map(({ id: _id, ...item }) => item),
    periods: scheduleQuery.data.periods.map(({ id: _id, ...item }) => item),
  }) !== JSON.stringify(draft));

  function updateDay(changes: Partial<NonNullable<typeof day>>) {
    if (!draft) return;
    setMessage(null);
    setDraft({
      ...draft,
      operating_days: draft.operating_days.map((item) =>
        item.day_of_week === selectedDay ? { ...item, ...changes } : item,
      ),
    });
  }

  function updatePeriod(index: number, changes: Partial<SchedulePeriod>) {
    if (!draft) return;
    setMessage(null);
    setDraft({
      ...draft,
      periods: draft.periods.map((item) =>
        item.day_of_week === selectedDay && item.sort_order === index ? { ...item, ...changes } : item,
      ),
    });
  }

  function movePeriod(index: number, offset: -1 | 1) {
    if (!draft) return;
    const list = [...periods];
    const target = index + offset;
    if (target < 0 || target >= list.length) return;
    const sourcePeriod = list[index];
    const targetPeriod = list[target];
    if (!sourcePeriod || !targetPeriod) return;
    [list[index], list[target]] = [targetPeriod, sourcePeriod];
    const moved = new Map(list.map((item, order) => [item, order]));
    setDraft({
      ...draft,
      periods: draft.periods.map((item) =>
        item.day_of_week === selectedDay ? { ...item, sort_order: moved.get(item) ?? item.sort_order } : item,
      ),
    });
  }

  function addPeriod() {
    if (!draft || !day?.is_open) return;
    const length = 45;
    const opening = toMinutes(day.opening_time);
    const closing = toMinutes(day.closing_time);
    const blocks = periods.filter((item) => item.enabled).map((item) => [toMinutes(item.start_time), toMinutes(item.end_time)] as const);
    let start = opening;
    while (start + length <= closing && blocks.some(([from, to]) => start < to && start + length > from)) start += 15;
    const fits = start + length <= closing;
    const item: SchedulePeriod = {
      day_of_week: selectedDay,
      name: 'New period',
      start_time: toTime(fits ? start : opening),
      end_time: toTime(fits ? start + length : Math.min(closing, opening + length)),
      period_type: 'TEACHING',
      enabled: fits,
      sort_order: periods.length ? Math.max(...periods.map((period) => period.sort_order)) + 1 : 0,
    };
    setDraft({ ...draft, periods: [...draft.periods, item] });
    setMessage(fits ? null : 'No free 45 minute interval fits today. Extend operating hours or move an existing period.');
  }

  function removePeriod(order: number) {
    if (!draft) return;
    const remaining = periods.filter((item) => item.sort_order !== order)
      .map((item, index) => ({ ...item, sort_order: index }));
    setDraft({
      ...draft,
      periods: [...draft.periods.filter((item) => item.day_of_week !== selectedDay), ...remaining],
    });
  }

  if (scheduleQuery.isLoading) return <div className="p-8 text-sm text-[var(--text-secondary)]">Loading department calendar…</div>;
  if (scheduleQuery.isError || !draft || !day) return <div role="alert" className="p-8 text-sm text-[var(--accent-coral)]">Could not load the department schedule. Retry the page after checking the API connection.</div>;

  const windowMinutes = Math.max(1, toMinutes(day.closing_time) - toMinutes(day.opening_time));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent-cyan)]">
            <CalendarClock className="h-4 w-4" /> Academic Calendar
          </div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Dynamic Operating Hours & Period Builder</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
            Set a separate daily window and configure teaching periods, breaks, lunch, and extended sessions.
            Changes remain a draft until you save them.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { scheduleQuery.refetch(); setMessage(null); }} disabled={!isDirty}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button onClick={() => { setMessage(null); saveMutation.mutate(draft); }} disabled={!isDirty || saveMutation.isPending}>
            <Save className="h-4 w-4" /> {saveMutation.isPending ? 'Saving…' : 'Save Configuration'}
          </Button>
        </div>
      </header>

      {message && <div role="status" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-secondary)]">{message}</div>}

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardTitle>Week schedule</CardTitle>
          <CardDescription className="mt-1">Choose a day to edit its hours and periods.</CardDescription>
          <div className="mt-4 space-y-1">
            {DAYS.map((key) => {
              const item = draft.operating_days.find((value) => value.day_of_week === key);
              return (
                <button key={key} type="button" onClick={() => { setSelectedDay(key); setMessage(null); }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${selectedDay === key ? 'bg-[var(--accent-violet)]/15 text-[var(--text-primary)] ring-1 ring-[var(--accent-violet)]/40' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'}`}>
                  <span>{DAY_NAMES[key]}</span><span className="text-xs">{item?.is_open ? `${item.opening_time}–${item.closing_time}` : 'Closed'}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><CardTitle>{DAY_NAMES[selectedDay]} operating window</CardTitle><CardDescription className="mt-1">The closing time is configurable; late periods are supported.</CardDescription></div>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input type="checkbox" checked={day.is_open} onChange={(event) => updateDay({ is_open: event.target.checked })} /> Open for scheduling
              </label>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input label="Opening time" type="time" value={day.opening_time} disabled={!day.is_open} onChange={(event) => updateDay({ opening_time: event.target.value })} />
              <Input label="Closing time" type="time" value={day.closing_time} disabled={!day.is_open} onChange={(event) => updateDay({ closing_time: event.target.value })} />
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><CardTitle>Periods & breaks</CardTitle><CardDescription className="mt-1">Intervals use actual clock times and can have custom durations.</CardDescription></div>
              <Button size="sm" variant="secondary" onClick={addPeriod} disabled={!day.is_open}><Plus className="h-4 w-4" /> Add period</Button>
            </div>

            {periods.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-[var(--border-subtle)] p-6 text-center text-sm text-[var(--text-muted)]">No periods configured for {DAY_NAMES[selectedDay]}.</div> : (
              <div className="mt-5 space-y-3">
                {periods.map((period, index) => (
                  <div key={`${period.day_of_week}-${period.sort_order}`} className="grid gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 md:grid-cols-[minmax(120px,1fr)_minmax(130px,1fr)_minmax(130px,1fr)_minmax(150px,0.8fr)_auto] md:items-end">
                    <Input label="Name" value={period.name} onChange={(event) => updatePeriod(period.sort_order, { name: event.target.value })} />
                    <Input label="Start" type="time" value={period.start_time} onChange={(event) => updatePeriod(period.sort_order, { start_time: event.target.value })} />
                    <Input label="End" type="time" value={period.end_time} onChange={(event) => updatePeriod(period.sort_order, { end_time: event.target.value })} />
                    <label className="space-y-1.5 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Type
                      <select value={period.period_type} onChange={(event) => updatePeriod(period.sort_order, { period_type: event.target.value as PeriodType })} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm normal-case text-[var(--text-primary)]">
                        {TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </label>
                    <div className="flex items-center justify-end gap-1">
                      <label title="Include this interval in scheduling" className="mr-1 flex items-center gap-1 text-xs text-[var(--text-secondary)]"><input type="checkbox" checked={period.enabled} onChange={(event) => updatePeriod(period.sort_order, { enabled: event.target.checked })} /> Enabled</label>
                      <Button size="icon" variant="ghost" aria-label="Move period up" onClick={() => movePeriod(index, -1)} disabled={index === 0}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Move period down" onClick={() => movePeriod(index, 1)} disabled={index === periods.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="icon" variant="danger" aria-label="Delete period" onClick={() => removePeriod(period.sort_order)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>Live day preview</CardTitle>
            <CardDescription className="mt-1">Preview of enabled intervals for {DAY_NAMES[selectedDay]}.</CardDescription>
            {!day.is_open ? <p className="mt-5 text-sm text-[var(--text-muted)]">This day is closed.</p> : (
              <div className="mt-5">
                <div className="mb-2 flex justify-between font-mono text-xs text-[var(--text-muted)]"><span>{day.opening_time}</span><span>{day.closing_time}</span></div>
                <div className="relative h-14 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  {periods.filter((period) => period.enabled).map((period) => {
                    const left = ((toMinutes(period.start_time) - toMinutes(day.opening_time)) / windowMinutes) * 100;
                    const width = ((toMinutes(period.end_time) - toMinutes(period.start_time)) / windowMinutes) * 100;
                    const color = period.period_type === 'TEACHING' ? 'bg-[var(--accent-violet)]/70' : 'bg-[var(--accent-cyan)]/35';
                    return <div key={`preview-${period.sort_order}`} title={`${period.name}: ${period.start_time}–${period.end_time}`} className={`absolute top-1 bottom-1 overflow-hidden rounded-md border border-white/10 px-1.5 py-2 text-[10px] text-white ${color}`} style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(1, width)}%` }}>{period.name}</div>;
                  })}
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)]">Violet: teaching · Cyan: breaks and non-teaching intervals</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
