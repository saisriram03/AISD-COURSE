import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Clock, Printer, RefreshCw } from 'lucide-react';
import { fetchFacultyTimetable, fetchTimetableMetadata } from '@/services/timetableApi';
import { TimetableGrid } from '@/features/timetable/TimetableGrid';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function FacultyTimetablePage() {
  const metadataQuery = useQuery({
    queryKey: ['timetable-metadata'],
    queryFn: fetchTimetableMetadata,
  });

  const scheduleQuery = useQuery({
    queryKey: ['faculty-timetable'],
    queryFn: fetchFacultyTimetable,
    refetchInterval: 10_000,
  });

  if (metadataQuery.isLoading || scheduleQuery.isLoading) {
    return <div className="h-96 w-full animate-pulse rounded-2xl bg-[var(--bg-elevated)]" />;
  }

  if (metadataQuery.isError || scheduleQuery.isError || !metadataQuery.data || !scheduleQuery.data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-[var(--accent-coral)]">
          Could not load your faculty timetable from the backend.
        </p>
        <Button className="mt-3" size="sm" onClick={() => void scheduleQuery.refetch()}>
          Retry
        </Button>
      </Card>
    );
  }

  const { entries, version, entity_label } = scheduleQuery.data;
  const weeklyHours = entries.reduce((sum, item) => sum + item.duration_periods, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge variant="mint">
              <CalendarClock className="h-3 w-3" />
              {version ? `Live Published · v${version.version_number}` : 'Unpublished'}
            </Badge>
            <Badge variant="cyan">
              <Clock className="h-3 w-3" />
              {weeklyHours} hrs/week assigned
            </Badge>
          </div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {entity_label ?? 'My Weekly Timetable'}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Automatically synchronized with every published update from your Department Admin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void scheduleQuery.refetch()}
          >
            <RefreshCw className="h-4 w-4" />
            Sync Now
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <TimetableGrid
        slots={metadataQuery.data.time_slots}
        entries={entries}
        editable={false}
        viewContext="faculty"
      />
    </div>
  );
}
