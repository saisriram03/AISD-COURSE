import { Clock, Coffee, MapPin, Plus, Users } from 'lucide-react';
import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  type TimeSlotItem,
  type TimetableEntryItem,
} from '@/types/timetable';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface TimetableGridProps {
  slots: TimeSlotItem[];
  entries: TimetableEntryItem[];
  editable?: boolean;
  viewContext?: 'batch' | 'faculty' | 'room' | 'lab' | 'student';
  onEmptySlotClick?: (day: DayOfWeek, periodIndex: number) => void;
  onEntryClick?: (entry: TimetableEntryItem) => void;
}

export function TimetableGrid({
  slots,
  entries,
  editable = false,
  viewContext = 'batch',
  onEmptySlotClick,
  onEntryClick,
}: TimetableGridProps) {
  const gridSlots = [...slots];
  const legacyStarts = new Set(slots.filter((slot) => !slot.is_break).map((slot) => `${slot.period_index}-${slot.start_time}`));
  const customEntries = entries.filter((entry) => !legacyStarts.has(`${entry.period_index}-${entry.start_time}`));
  const customRows = new Map<string, TimeSlotItem>();
  for (const entry of customEntries) {
    const identity = `${entry.period_index}-${entry.start_time}`;
    const existing = customRows.get(identity);
    if (existing) {
      if (entry.end_time > existing.end_time) existing.end_time = entry.end_time;
    } else {
      customRows.set(identity, {
        id: `custom-${identity}`,
        period_index: entry.period_index,
        label: 'Custom interval',
        start_time: entry.start_time,
        end_time: entry.end_time,
        is_break: false,
      });
    }
  }
  gridSlots.push(...customRows.values());
  gridSlots.sort((a, b) => a.start_time.localeCompare(b.start_time) || a.period_index - b.period_index);

  // Build lookup of cell -> entry and cells covered by multi-period spans
  const entryStartMap = new Map<string, TimetableEntryItem[]>();
  const coveredCells = new Set<string>();

  for (const entry of entries) {
    const startKey = `${entry.day_of_week}-${entry.period_index}`;
    const list = entryStartMap.get(startKey) ?? [];
    list.push(entry);
    entryStartMap.set(startKey, list);

    for (let offset = 1; offset < entry.duration_periods; offset += 1) {
      coveredCells.add(`${entry.day_of_week}-${entry.period_index + offset}`);
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <th className="w-32 px-3 py-3 font-mono text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Period
            </th>
            {DAYS_OF_WEEK.map((day) => (
              <th
                key={day.key}
                className="border-l border-[var(--border-subtle)] px-3 py-3 font-display text-sm font-semibold text-[var(--text-primary)]"
              >
                <span>{day.label}</span>
                <span className="ml-1.5 font-mono text-[10px] font-normal text-[var(--text-muted)]">
                  {day.key}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {gridSlots.map((slot) => {
            if (slot.is_break && !slot.applicable_days?.length) {
              return (
                <tr
                  key={slot.id}
                  className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60"
                >
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-xs font-semibold text-[var(--accent-amber)]">
                      {slot.label}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)]">
                      {slot.start_time}–{slot.end_time}
                    </div>
                  </td>
                  <td
                    colSpan={DAYS_OF_WEEK.length}
                    className="border-l border-[var(--border-subtle)] px-4 py-2 text-center"
                  >
                    <div className="inline-flex items-center gap-2 font-mono text-xs text-[var(--text-muted)]">
                      <Coffee className="h-3.5 w-3.5 text-[var(--accent-amber)]" />
                      <span>
                        {slot.label} Period ({slot.start_time} – {slot.end_time}) · Protected from
                        scheduling
                      </span>
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <tr
                key={slot.id}
                className="border-b border-[var(--border-subtle)] last:border-b-0"
              >
                <td className="px-3 py-3 align-top">
                  <div className="font-mono text-xs font-semibold text-[var(--accent-cyan)]">
                    {slot.label}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-[var(--text-muted)]">
                    <Clock className="h-2.5 w-2.5" />
                    <span>
                      {slot.start_time}–{slot.end_time}
                    </span>
                  </div>
                </td>

                {DAYS_OF_WEEK.map((day) => {
                  const key = `${day.key}-${slot.period_index}`;
                  if (coveredCells.has(key)) {
                    return null;
                  }

                  const appliesToday = !slot.applicable_days?.length || slot.applicable_days.includes(day.key);
                  const blockedToday = slot.is_break || Boolean(slot.blocked_days?.includes(day.key));
                  if (!appliesToday || blockedToday) {
                    return (
                      <td key={key} className="h-24 border-l border-[var(--border-subtle)] p-1.5 align-top">
                        {appliesToday && blockedToday && (
                          <div className="flex h-full min-h-[5.25rem] items-center justify-center gap-1 rounded-xl bg-[var(--accent-amber)]/5 text-[10px] text-[var(--text-muted)]">
                            <Coffee className="h-3 w-3 text-[var(--accent-amber)]" /> {slot.label}
                          </div>
                        )}
                      </td>
                    );
                  }

                  const cellEntries = entryStartMap.get(key) ?? [];
                  const maxSpan =
                    cellEntries.length > 0
                      ? Math.max(...cellEntries.map((e) => e.duration_periods))
                      : 1;

                  if (cellEntries.length === 0) {
                    return (
                      <td
                        key={key}
                        className="h-24 border-l border-[var(--border-subtle)] p-1.5 align-top"
                      >
                        {editable ? (
                          <button
                            type="button"
                            data-cursor="grid-cell"
                            data-cursor-label="Add Class"
                            onClick={() => onEmptySlotClick?.(day.key, slot.period_index)}
                            className="group flex h-full min-h-[5.25rem] w-full flex-col items-center justify-center rounded-xl border border-dashed border-transparent text-xs text-[var(--text-muted)] transition-all hover:border-[var(--accent-violet)]/50 hover:bg-[var(--accent-violet-soft)]/50 hover:text-[var(--accent-violet)]"
                          >
                            <Plus className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                            <span className="mt-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              Add
                            </span>
                          </button>
                        ) : (
                          <div className="flex h-full min-h-[5.25rem] items-center justify-center rounded-xl text-[11px] text-[var(--text-muted)]/40">
                            —
                          </div>
                        )}
                      </td>
                    );
                  }

                  return (
                    <td
                      key={key}
                      rowSpan={maxSpan}
                      className="border-l border-[var(--border-subtle)] p-1.5 align-top"
                    >
                      <div className="flex h-full flex-col gap-1.5">
                        {cellEntries.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            data-cursor={editable ? 'button' : 'grid-cell'}
                            onClick={() => onEntryClick?.(entry)}
                            className={cn(
                              'w-full rounded-xl border p-2.5 text-left transition-all',
                              editable
                                ? 'cursor-pointer hover:brightness-110'
                                : 'cursor-default',
                            )}
                            style={{
                              borderColor: `${entry.course_color}55`,
                              backgroundColor: `${entry.course_color}18`,
                              minHeight: `${Math.max(84, ((Number(entry.end_time.slice(0, 2)) * 60 + Number(entry.end_time.slice(3, 5))) - (Number(entry.start_time.slice(0, 2)) * 60 + Number(entry.start_time.slice(3, 5))) ) * 1.68, entry.duration_periods > 1 ? 168 : 84)}px`,
                            }}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <span
                                className="font-mono text-[11px] font-bold"
                                style={{ color: entry.course_color }}
                              >
                                {entry.course_code}
                              </span>
                              <Badge
                                variant={
                                  entry.session_type === 'PRACTICAL' ? 'cyan' : 'neutral'
                                }
                                className="px-1.5 py-0 text-[9px]"
                              >
                                {entry.session_type === 'PRACTICAL'
                                  ? `LAB · ${entry.duration_periods}h`
                                  : entry.session_type}
                              </Badge>
                            </div>

                            <div className="mt-1 line-clamp-2 text-xs font-semibold text-[var(--text-primary)]">
                              {entry.course_name}
                            </div>

                            <div className="mt-1 font-mono text-[10px] text-[var(--accent-cyan)]">
                              {entry.start_time}–{entry.end_time}
                            </div>

                            <div className="mt-2 space-y-0.5 text-[11px] text-[var(--text-secondary)]">
                              {viewContext !== 'faculty' && (
                                <div className="truncate">{entry.faculty_name}</div>
                              )}
                              {viewContext !== 'room' && viewContext !== 'lab' && (
                                <div className="flex items-center gap-1 truncate font-mono text-[10px] text-[var(--text-muted)]">
                                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                                  <span>{entry.room_number}</span>
                                </div>
                              )}
                              {(viewContext === 'faculty' ||
                                viewContext === 'room' ||
                                viewContext === 'lab') && (
                                <div className="flex items-center gap-1 truncate text-[10px] text-[var(--text-muted)]">
                                  <Users className="h-2.5 w-2.5 shrink-0" />
                                  <span>{entry.batch_name}</span>
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
