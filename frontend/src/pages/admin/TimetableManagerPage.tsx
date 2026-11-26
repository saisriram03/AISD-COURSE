import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  CheckCircle2,
  FlaskConical,
  GraduationCap,
  MapPin,
  Plus,
  Printer,
  RefreshCw,
  Send,
  Users,
} from 'lucide-react';
import {
  createTimetableEntry,
  deleteTimetableEntry,
  fetchTimetableEntries,
  fetchTimetableMetadata,
  publishDraftTimetable,
  updateTimetableEntry,
} from '@/services/timetableApi';
import type {
  ConflictDetail,
  DayOfWeek,
  TimetableEntryItem,
  TimetableEntryPayload,
} from '@/types/timetable';
import { TimetableGrid } from '@/features/timetable/TimetableGrid';
import { EntryEditorDialog } from '@/features/timetable/EntryEditorDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type ViewMode = 'batch' | 'faculty' | 'room' | 'lab';

export function TimetableManagerPage() {
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>('batch');
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [publishImmediately, setPublishImmediately] = useState<boolean>(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntryItem | null>(null);
  const [defaultDay, setDefaultDay] = useState<DayOfWeek>('MON');
  const [defaultPeriod, setDefaultPeriod] = useState<number>(1);
  const [conflicts, setConflicts] = useState<ConflictDetail[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const metadataQuery = useQuery({
    queryKey: ['timetable-metadata'],
    queryFn: fetchTimetableMetadata,
  });

  const metadata = metadataQuery.data;

  // Pick default entity when viewMode or metadata changes
  useEffect(() => {
    if (!metadata) return;
    if (viewMode === 'batch') {
      if (!metadata.batches.some((b) => b.id === selectedEntityId)) {
        setSelectedEntityId(metadata.batches[0]?.id ?? '');
      }
    } else if (viewMode === 'faculty') {
      if (!metadata.faculty.some((f) => f.id === selectedEntityId)) {
        setSelectedEntityId(metadata.faculty[0]?.id ?? '');
      }
    } else if (viewMode === 'room') {
      const classrooms = metadata.rooms.filter((r) => r.room_type === 'CLASSROOM');
      if (!classrooms.some((r) => r.id === selectedEntityId)) {
        setSelectedEntityId(classrooms[0]?.id ?? '');
      }
    } else if (viewMode === 'lab') {
      const labs = metadata.rooms.filter((r) => r.room_type === 'LAB');
      if (!labs.some((r) => r.id === selectedEntityId)) {
        setSelectedEntityId(labs[0]?.id ?? '');
      }
    }
  }, [metadata, viewMode, selectedEntityId]);

  const queryParams = useMemo(() => {
    const mode = publishImmediately ? ('published' as const) : ('draft' as const);
    if (!selectedEntityId) return { mode };
    if (viewMode === 'batch') return { mode, batch_id: selectedEntityId };
    if (viewMode === 'faculty') return { mode, faculty_id: selectedEntityId };
    return { mode, room_id: selectedEntityId };
  }, [publishImmediately, selectedEntityId, viewMode]);

  const entriesQuery = useQuery({
    queryKey: ['timetable-entries', queryParams],
    queryFn: () => fetchTimetableEntries(queryParams),
    enabled: Boolean(metadata && selectedEntityId),
  });

  const entityOptions = useMemo(() => {
    if (!metadata) return [];
    if (viewMode === 'batch') {
      return metadata.batches.map((b) => ({ id: b.id, label: b.name }));
    }
    if (viewMode === 'faculty') {
      return metadata.faculty.map((f) => ({ id: f.id, label: f.name }));
    }
    if (viewMode === 'room') {
      return metadata.rooms
        .filter((r) => r.room_type === 'CLASSROOM')
        .map((r) => ({ id: r.id, label: `${r.room_number} (${r.building})` }));
    }
    return metadata.rooms
      .filter((r) => r.room_type === 'LAB')
      .map((r) => ({ id: r.id, label: `${r.room_number} (${r.building})` }));
  }, [metadata, viewMode]);

  const invalidateAllTimetables = async () => {
    await queryClient.invalidateQueries({ queryKey: ['timetable-metadata'] });
    await queryClient.invalidateQueries({ queryKey: ['timetable-entries'] });
    await queryClient.invalidateQueries({ queryKey: ['faculty-timetable'] });
    await queryClient.invalidateQueries({ queryKey: ['student-timetable'] });
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handleOpenAdd = (day: DayOfWeek = 'MON', periodIndex = 1) => {
    setEditingEntry(null);
    setDefaultDay(day);
    setDefaultPeriod(periodIndex);
    setConflicts([]);
    setDialogOpen(true);
  };

  const handleOpenEdit = (entry: TimetableEntryItem) => {
    setEditingEntry(entry);
    setConflicts([]);
    setDialogOpen(true);
  };

  const handleSave = async (payload: TimetableEntryPayload, existingId?: string) => {
    setIsSaving(true);
    setConflicts([]);
    try {
      if (existingId) {
        await updateTimetableEntry(existingId, payload);
        setStatusBanner(
          payload.publish_immediately
            ? 'Session updated & synced live to Faculty and Student timetables.'
            : 'Session updated in Draft.',
        );
      } else {
        await createTimetableEntry(payload);
        setStatusBanner(
          payload.publish_immediately
            ? 'New session added & synced live to Faculty and Student timetables.'
            : 'New session added to Draft.',
        );
      }
      await invalidateAllTimetables();
      setDialogOpen(false);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const detail = err.response.data?.detail as
          | { conflicts?: ConflictDetail[]; message?: string }
          | undefined;
        setConflicts(
          detail?.conflicts ?? [
            { code: 'CONFLICT', message: detail?.message ?? 'Hard constraint violation.' },
          ],
        );
      } else {
        setConflicts([
          {
            code: 'SAVE_ERROR',
            message: 'Failed to save entry. Verify backend server connection.',
          },
        ]);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    setIsSaving(true);
    setConflicts([]);
    try {
      await deleteTimetableEntry(entryId, publishImmediately);
      setStatusBanner(
        publishImmediately
          ? 'Session removed & synced live to Faculty and Student timetables.'
          : 'Session removed from Draft.',
      );
      await invalidateAllTimetables();
      setDialogOpen(false);
    } catch {
      setConflicts([{ code: 'DELETE_ERROR', message: 'Failed to delete session.' }]);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishDraft = async () => {
    const published = await publishDraftTimetable();
    setPublishImmediately(true);
    setStatusBanner(
      `Published timetable v${published.version_number} to all Faculty and Students.`,
    );
    await invalidateAllTimetables();
  };

  if (metadataQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-12 w-72 animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
        <div className="h-96 w-full animate-pulse rounded-2xl bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  if (metadataQuery.isError || !metadata) {
    return (
      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold text-[var(--accent-coral)]">
          Backend Connection Required
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Unable to load timetable metadata from the FastAPI backend. Start the backend server on
          port 8000 and click retry.
        </p>
        <Button className="mt-4" onClick={() => void metadataQuery.refetch()}>
          <RefreshCw className="h-4 w-4" />
          Retry Connection
        </Button>
      </Card>
    );
  }

  const version = entriesQuery.data?.version;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge variant={version?.status === 'PUBLISHED' ? 'mint' : 'amber'}>
              {version ? `${version.status} · v${version.version_number}` : 'No Version'}
            </Badge>
            <Badge variant="violet">{metadata.department_name}</Badge>
          </div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            Interactive Timetable Editor
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Click any empty cell to schedule a class, or click any existing block to modify or
            remove it. Every change is validated by backend hard constraints.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
          {!publishImmediately && (
            <Button variant="cyan" size="sm" onClick={() => void handlePublishDraft()}>
              <Send className="h-4 w-4" />
              Publish Draft
            </Button>
          )}
          <Button size="sm" onClick={() => handleOpenAdd('MON', 1)}>
            <Plus className="h-4 w-4" />
            Add Class
          </Button>
        </div>
      </div>

      {statusBanner && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--accent-mint)]/30 bg-[var(--accent-mint-soft)] px-4 py-2.5 text-xs font-medium text-[var(--accent-mint)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-xs underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Controls Bar */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'batch', label: 'Batch-wise', icon: GraduationCap },
              { id: 'faculty', label: 'Faculty-wise', icon: Users },
              { id: 'room', label: 'Room-wise', icon: MapPin },
              { id: 'lab', label: 'Lab-wise', icon: FlaskConical },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = viewMode === tab.id;
            return (
              <Button
                key={tab.id}
                type="button"
                size="sm"
                variant={active ? 'primary' : 'ghost'}
                onClick={() => setViewMode(tab.id)}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Select entity to view"
            value={selectedEntityId}
            onChange={(e) => setSelectedEntityId(e.target.value)}
            className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
          >
            {entityOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={publishImmediately}
              onChange={(e) => setPublishImmediately(e.target.checked)}
              className="accent-[var(--accent-violet)]"
            />
            <span>Auto-publish edits live</span>
          </label>
        </div>
      </Card>

      <TimetableGrid
        slots={metadata.time_slots}
        entries={entriesQuery.data?.entries ?? []}
        editable
        viewContext={viewMode}
        onEmptySlotClick={handleOpenAdd}
        onEntryClick={handleOpenEdit}
      />

      <EntryEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        metadata={metadata}
        initialEntry={editingEntry}
        defaultDay={defaultDay}
        defaultPeriod={defaultPeriod}
        defaultBatchId={viewMode === 'batch' ? selectedEntityId : undefined}
        publishImmediately={publishImmediately}
        conflicts={conflicts}
        isSaving={isSaving}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
