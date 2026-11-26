import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarClock, Clock, FlaskConical, MapPin, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { fetchStudentTimetable } from '@/services/timetableApi';
import { DAYS_OF_WEEK, type DayOfWeek } from '@/types/timetable';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

const STUDENT_CARDS = [
  {
    title: 'Official Batch Timetable',
    description: 'Read-only view of your batch’s published classes, faculty, and PDF export.',
    path: '/student/timetable',
    icon: CalendarClock,
    badge: 'Live Sync',
  },
  {
    title: 'Classrooms & Laboratories',
    description: 'Check assigned room numbers, building wings, and lab equipment notes.',
    path: '/student/rooms',
    icon: FlaskConical,
    badge: 'Phase 11',
  },
  {
    title: 'Free Periods',
    description: 'Inspect open gaps between scheduled lectures across the week.',
    path: '/student/free-periods',
    icon: Sparkles,
    badge: 'Phase 11',
  },
];

function getTodayDayKey(): DayOfWeek {
  const map: DayOfWeek[] = ['MON', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return map[new Date().getDay()] ?? 'MON';
}

export function StudentHomePage() {
  const user = useAuthStore((s) => s.user);
  const scheduleQuery = useQuery({
    queryKey: ['student-timetable'],
    queryFn: fetchStudentTimetable,
    refetchInterval: 10_000,
  });

  const entries = scheduleQuery.data?.entries ?? [];
  const todayKey = getTodayDayKey();
  const todayLabel = DAYS_OF_WEEK.find((d) => d.key === todayKey)?.label ?? todayKey;
  const todaysClasses = entries
    .filter((e) => e.day_of_week === todayKey)
    .sort((a, b) => a.period_index - b.period_index);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="cyan" className="mb-2">
            Student Portal · Read-Only
          </Badge>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {scheduleQuery.data?.entity_label ?? user?.batchLabel ?? 'Student Batch Schedule'}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Signed in as {user?.fullName}.{' '}
            {scheduleQuery.data?.version
              ? `Showing Official Timetable v${scheduleQuery.data.version.version_number} (${entries.length} weekly sessions).`
              : 'Synced with official department schedule.'}
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/student/timetable">
            <CalendarClock className="h-4 w-4" />
            View Weekly Timetable
          </Link>
        </Button>
      </div>

      {/* Live Today's Classes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Classes for {todayLabel}</CardTitle>
            <Badge variant="mint">{todaysClasses.length} Today</Badge>
          </div>
          <CardDescription>
            Automatically reflects every published change made by your Department Admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scheduleQuery.isLoading ? (
            <div className="h-16 animate-pulse rounded-xl bg-[var(--bg-surface)]" />
          ) : todaysClasses.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No classes scheduled on {todayLabel}. Open your full weekly timetable to view all
              classes.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {todaysClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-mono text-xs font-bold"
                      style={{ color: cls.course_color }}
                    >
                      {cls.course_code}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[11px] text-[var(--text-muted)]">
                      <Clock className="h-3 w-3" />P{cls.period_index}
                      {cls.duration_periods > 1 ? `–P${cls.period_index + cls.duration_periods - 1}` : ''}
                    </span>
                  </div>
                  <div className="mt-1 font-medium text-[var(--text-primary)]">{cls.course_name}</div>
                  <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>{cls.faculty_name}</span>
                    <span className="flex items-center gap-1 font-mono">
                      <MapPin className="h-3 w-3" />
                      {cls.room_number}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid gap-4 sm:grid-cols-3"
      >
        {STUDENT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.path} variants={staggerItem}>
              <Link to={card.path} className="block h-full">
                <Card className="h-full hover:border-[var(--accent-cyan)]/50">
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between">
                      <Icon className="h-5 w-5 text-[var(--accent-cyan)]" />
                      <Badge variant={card.badge === 'Live Sync' ? 'mint' : 'neutral'}>
                        {card.badge}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">{card.title}</CardTitle>
                    <CardDescription>{card.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
