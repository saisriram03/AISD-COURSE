import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CalendarDays,
  Clock,
  Edit3,
  FileCheck2,
  List,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { superAdminApi } from '@/services/superAdminApi';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import type {
  AcademicYearRecord,
  ExaminationPeriodRecord,
  HolidayRecord,
  SemesterRecord,
  WorkingDayConfigRecord,
} from '@/types/superAdmin';

type SectionTab = 'years' | 'semesters' | 'holidays' | 'exams' | 'working-days';
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export function AcademicTermsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<SectionTab>('years');
  const [holidayView, setHolidayView] = useState<'list' | 'calendar'>('list');
  const [holidaySearch, setHolidaySearch] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Queries
  const { data: years = [], isLoading } = useQuery({
    queryKey: ['super-admin', 'academic-years'],
    queryFn: superAdminApi.listAcademicYears,
  });
  const { data: semesters = [] } = useQuery({
    queryKey: ['super-admin', 'semesters'],
    queryFn: () => superAdminApi.listSemesters(),
  });
  const { data: holidays = [] } = useQuery({
    queryKey: ['super-admin', 'holidays'],
    queryFn: () => superAdminApi.listHolidays(),
  });
  const { data: exams = [] } = useQuery({
    queryKey: ['super-admin', 'exams'],
    queryFn: () => superAdminApi.listExaminationPeriods(),
  });
  const { data: workingConfigs = [] } = useQuery({
    queryKey: ['super-admin', 'working-configs'],
    queryFn: superAdminApi.listWorkingDayConfigs,
  });

  // Modals & Forms
  const [ayModal, setAyModal] = useState(false);
  const [editingAy, setEditingAy] = useState<AcademicYearRecord | null>(null);
  const [ayForm, setAyForm] = useState({
    name: '',
    start_date: '2027-08-01',
    end_date: '2028-06-15',
    status: 'UPCOMING' as AcademicYearRecord['status'],
    description: '',
  });

  const [semModal, setSemModal] = useState(false);
  const [editingSem, setEditingSem] = useState<SemesterRecord | null>(null);
  const [semForm, setSemForm] = useState({
    academic_year_id: '',
    name: '',
    semester_number: 5,
    term_type: 'ODD' as SemesterRecord['term_type'],
    start_date: '2026-08-10',
    end_date: '2026-12-20',
    registration_start: '',
    registration_end: '',
    exam_start: '',
    exam_end: '',
    status: 'UPCOMING' as SemesterRecord['status'],
  });

  const [holModal, setHolModal] = useState(false);
  const [editingHol, setEditingHol] = useState<HolidayRecord | null>(null);
  const [deleteHol, setDeleteHol] = useState<HolidayRecord | null>(null);
  const [holForm, setHolForm] = useState({
    academic_year_id: '',
    name: '',
    date: '2026-10-02',
    holiday_type: 'PUBLIC' as HolidayRecord['holiday_type'],
    description: '',
    applicable_departments: 'ALL',
  });

  const [examModal, setExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState<ExaminationPeriodRecord | null>(null);
  const [deleteExam, setDeleteExam] = useState<ExaminationPeriodRecord | null>(null);
  const [examForm, setExamForm] = useState({
    academic_year_id: '',
    semester_id: '' as string | null,
    name: '',
    exam_type: 'END_SEMESTER' as ExaminationPeriodRecord['exam_type'],
    start_date: '2026-12-01',
    end_date: '2026-12-18',
    lock_timetable_edits: true,
    description: '',
  });

  const [wdForm, setWdForm] = useState<Partial<WorkingDayConfigRecord>>({
    name: 'Standard Engineering Shift (Mon–Sat)',
    working_days: 'MON,TUE,WED,THU,FRI,SAT',
    opening_time: '08:45',
    first_period_time: '09:00',
    period_duration_minutes: 55,
    morning_periods: 4,
    lunch_start_time: '12:40',
    lunch_duration_minutes: 50,
    afternoon_periods: 3,
    closing_time: '16:30',
    non_teaching_periods: 'Library Hour,Mentoring',
    is_default: true,
  });

  useEffect(() => {
    if (workingConfigs[0]) {
      setWdForm(workingConfigs[0]);
    }
  }, [workingConfigs]);

  // Mutations
  const saveAyMutation = useMutation({
    mutationFn: () =>
      editingAy ? superAdminApi.updateAcademicYear(editingAy.id, ayForm) : superAdminApi.createAcademicYear(ayForm),
    onSuccess: () => {
      toast(editingAy ? 'Academic Year Updated' : 'Academic Year Created', 'success');
      setAyModal(false);
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? 'Failed to save academic year', 'error'),
  });

  const statusAyMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AcademicYearRecord['status'] }) =>
      superAdminApi.updateAcademicYearStatus(id, status),
    onSuccess: () => {
      toast('Academic Year Status Updated', 'success');
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
  });

  const saveSemMutation = useMutation({
    mutationFn: () =>
      editingSem ? superAdminApi.updateSemester(editingSem.id, semForm) : superAdminApi.createSemester(semForm),
    onSuccess: () => {
      toast(editingSem ? 'Semester Updated' : 'Semester Created', 'success');
      setSemModal(false);
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? 'Failed to save semester', 'error'),
  });

  const saveHolMutation = useMutation({
    mutationFn: () =>
      editingHol ? superAdminApi.updateHoliday(editingHol.id, holForm) : superAdminApi.createHoliday(holForm),
    onSuccess: () => {
      toast(editingHol ? 'Holiday Updated' : 'Holiday Added', 'success');
      setHolModal(false);
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? 'Failed to save holiday', 'error'),
  });

  const deleteHolMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.deleteHoliday(id),
    onSuccess: () => {
      toast('Holiday Removed', 'success');
      setDeleteHol(null);
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
  });

  const saveExamMutation = useMutation({
    mutationFn: () => {
      const payload = { ...examForm, semester_id: examForm.semester_id || null };
      return editingExam
        ? superAdminApi.updateExaminationPeriod(editingExam.id, payload)
        : superAdminApi.createExaminationPeriod(payload);
    },
    onSuccess: () => {
      toast(editingExam ? 'Examination Window Updated' : 'Examination Window Created', 'success');
      setExamModal(false);
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? 'Failed to save exam period', 'error'),
  });

  const deleteExamMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.deleteExaminationPeriod(id),
    onSuccess: () => {
      toast('Examination Period Deleted', 'success');
      setDeleteExam(null);
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
  });

  const saveWdMutation = useMutation({
    mutationFn: () => superAdminApi.upsertWorkingDayConfig(wdForm),
    onSuccess: () => {
      toast('Working Day & Period Grid Saved', 'success');
      qc.invalidateQueries({ queryKey: ['super-admin'] });
    },
    onError: (err: any) => toast(err?.response?.data?.detail ?? 'Failed to save configuration', 'error'),
  });

  const currentAy = years.find((y) => y.status === 'ACTIVE');
  const upcomingAyCount = years.filter((y) => y.status === 'UPCOMING').length;
  const activeSemCount = semesters.filter((s) => s.status === 'ACTIVE').length;
  const completedSemCount = semesters.filter((s) => s.status === 'COMPLETED').length;

  const filteredHolidays = useMemo(() => {
    const q = holidaySearch.toLowerCase();
    return holidays.filter(
      (h) => !q || h.name.toLowerCase().includes(q) || h.holiday_type.toLowerCase().includes(q),
    );
  }, [holidays, holidaySearch]);

  // Calendar grid helper
  const calendarDays = useMemo(() => {
    const [yr, mo] = calendarMonth.split('-').map(Number);
    if (!yr || !mo) return [];
    const firstDay = new Date(yr, mo - 1, 1);
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const startPad = (firstDay.getDay() + 6) % 7; // Monday = 0
    const cells: Array<{ dateStr: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startPad; i++) cells.push({ dateStr: null, dayNum: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        dateStr: `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
      });
    }
    return cells;
  }, [calendarMonth]);

  if (isLoading) return <PageSkeleton />;

  const selectedWorkingDays = (wdForm.working_days ?? '').split(',').filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="violet" className="mb-2">
            Academic Calendar Governance
          </Badge>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Academic Years & Terms</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Manage academic years, odd/even semesters, university holidays, examination locks, and period grids.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {[
          { label: 'Current Academic Year', val: currentAy?.name ?? 'None', icon: Calendar },
          { label: 'Upcoming Years', val: upcomingAyCount, icon: CalendarDays },
          { label: 'Active Semesters', val: activeSemCount, icon: FileCheck2 },
          { label: 'Completed Semesters', val: completedSemCount, icon: FileCheck2 },
          { label: 'Total Holidays', val: holidays.length, icon: Calendar },
          { label: 'Exam Windows', val: exams.length, icon: Clock },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-muted)]">{k.label}</span>
                <Icon className="h-4 w-4 text-[var(--accent-cyan)]" />
              </div>
              <div className="mt-2 font-mono text-xl font-bold">{k.val}</div>
            </Card>
          );
        })}
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5">
        {(
          [
            ['years', 'Academic Years'],
            ['semesters', 'Semesters'],
            ['holidays', 'Holidays & Calendar'],
            ['exams', 'Examinations'],
            ['working-days', 'Working Days & Periods'],
          ] as Array<[SectionTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
              tab === id
                ? 'bg-[var(--accent-violet-soft)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: ACADEMIC YEARS */}
      {tab === 'years' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Academic Years</CardTitle>
                <CardDescription>Overlapping date ranges are automatically prevented by backend validation</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingAy(null);
                  setAyForm({
                    name: '2028-2029',
                    start_date: '2028-08-01',
                    end_date: '2029-06-15',
                    status: 'UPCOMING',
                    description: '',
                  });
                  setAyModal(true);
                }}
              >
                <Plus className="h-4 w-4" /> Create Academic Year
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {years.map((ay) => (
              <div
                key={ay.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-bold">{ay.name}</span>
                    <Badge
                      variant={
                        ay.status === 'ACTIVE' ? 'mint' : ay.status === 'UPCOMING' ? 'cyan' : 'neutral'
                      }
                    >
                      {ay.status}
                    </Badge>
                  </div>
                  <div className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                    {ay.start_date} → {ay.end_date}
                  </div>
                  {ay.description && <p className="mt-1 text-xs text-[var(--text-muted)]">{ay.description}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingAy(ay);
                      setAyForm({
                        name: ay.name,
                        start_date: ay.start_date,
                        end_date: ay.end_date,
                        status: ay.status,
                        description: ay.description,
                      });
                      setAyModal(true);
                    }}
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Edit
                  </Button>
                  {ay.status !== 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => statusAyMutation.mutate({ id: ay.id, status: 'ACTIVE' })}
                    >
                      Activate
                    </Button>
                  )}
                  {ay.status !== 'ARCHIVED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => statusAyMutation.mutate({ id: ay.id, status: 'ARCHIVED' })}
                    >
                      Archive
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: SEMESTERS */}
      {tab === 'semesters' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Semesters & Terms</CardTitle>
                <CardDescription>Odd/Even semester boundaries, registration windows, and exam periods</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingSem(null);
                  setSemForm({
                    academic_year_id: currentAy?.id ?? years[0]?.id ?? '',
                    name: '',
                    semester_number: 5,
                    term_type: 'ODD',
                    start_date: '2026-08-10',
                    end_date: '2026-12-20',
                    registration_start: '',
                    registration_end: '',
                    exam_start: '',
                    exam_end: '',
                    status: 'UPCOMING',
                  });
                  setSemModal(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add Semester
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {semesters.map((s) => (
              <div
                key={s.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{s.name}</span>
                    <Badge variant="violet">{s.term_type}</Badge>
                    <Badge variant={s.status === 'ACTIVE' ? 'mint' : s.status === 'UPCOMING' ? 'cyan' : 'neutral'}>
                      {s.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-4 font-mono text-xs text-[var(--text-secondary)]">
                    <span>Term: {s.start_date} → {s.end_date}</span>
                    {s.exam_start && <span>Exams: {s.exam_start} → {s.exam_end}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditingSem(s);
                    setSemForm({
                      academic_year_id: s.academic_year_id,
                      name: s.name,
                      semester_number: s.semester_number,
                      term_type: s.term_type,
                      start_date: s.start_date,
                      end_date: s.end_date,
                      registration_start: s.registration_start,
                      registration_end: s.registration_end,
                      exam_start: s.exam_start,
                      exam_end: s.exam_end,
                      status: s.status,
                    });
                    setSemModal(true);
                  }}
                >
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: HOLIDAYS & CALENDAR */}
      {tab === 'holidays' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <CardTitle className="text-base">University Holiday Calendar</CardTitle>
                <CardDescription>Toggle between list and monthly calendar visualization</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={holidaySearch}
                  onChange={(e) => setHolidaySearch(e.target.value)}
                  placeholder="Search holidays..."
                  className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs"
                />
                <Button
                  size="sm"
                  variant={holidayView === 'list' ? 'primary' : 'secondary'}
                  onClick={() => setHolidayView('list')}
                >
                  <List className="h-3.5 w-3.5" /> List
                </Button>
                <Button
                  size="sm"
                  variant={holidayView === 'calendar' ? 'primary' : 'secondary'}
                  onClick={() => setHolidayView('calendar')}
                >
                  <Calendar className="h-3.5 w-3.5" /> Calendar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingHol(null);
                    setHolForm({
                      academic_year_id: currentAy?.id ?? years[0]?.id ?? '',
                      name: '',
                      date: '2026-10-02',
                      holiday_type: 'PUBLIC',
                      description: '',
                      applicable_departments: 'ALL',
                    });
                    setHolModal(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Add Holiday
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {holidayView === 'list' ? (
              <div className="space-y-2.5">
                {filteredHolidays.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[var(--accent-cyan)]">{h.date}</span>
                        <span className="font-medium">{h.name}</span>
                        <Badge variant="amber">{h.holiday_type}</Badge>
                      </div>
                      {h.description && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{h.description}</p>}
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingHol(h);
                          setHolForm({
                            academic_year_id: h.academic_year_id,
                            name: h.name,
                            date: h.date,
                            holiday_type: h.holiday_type,
                            description: h.description,
                            applicable_departments: h.applicable_departments,
                          });
                          setHolModal(true);
                        }}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteHol(h)}>
                        <Trash2 className="h-3.5 w-3.5 text-[var(--accent-coral)]" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <input
                    type="month"
                    value={calendarMonth}
                    onChange={(e) => setCalendarMonth(e.target.value)}
                    className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 font-mono text-xs"
                  />
                  <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-amber)]" /> Holiday
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-coral)]" /> Exam Window
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center font-mono text-[11px] text-[var(--text-muted)]">
                  {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
                    <div key={d} className="py-1">{d}</div>
                  ))}
                  {calendarDays.map((cell, idx) => {
                    if (!cell.dateStr) return <div key={`pad-${idx}`} className="h-20 rounded-xl bg-transparent" />;
                    const dayHolidays = holidays.filter((h) => h.date === cell.dateStr);
                    const dayExams = exams.filter(
                      (ex) => cell.dateStr! >= ex.start_date && cell.dateStr! <= ex.end_date,
                    );
                    return (
                      <div
                        key={cell.dateStr}
                        className="flex h-20 flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-left"
                      >
                        <span className="font-mono text-xs text-[var(--text-secondary)]">{cell.dayNum}</span>
                        <div className="space-y-0.5 overflow-hidden">
                          {dayHolidays.map((h) => (
                            <div key={h.id} className="truncate rounded bg-[var(--accent-amber-soft)] px-1 text-[10px] text-[var(--accent-amber)]">
                              {h.name}
                            </div>
                          ))}
                          {dayExams.map((ex) => (
                            <div key={ex.id} className="truncate rounded bg-[var(--accent-coral-soft)] px-1 text-[10px] text-[var(--accent-coral)]">
                              {ex.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: EXAMINATIONS */}
      {tab === 'exams' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Examination Periods</CardTitle>
                <CardDescription>Define internal assessments, end-semester dates, and timetable edit locks</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingExam(null);
                  setExamForm({
                    academic_year_id: currentAy?.id ?? years[0]?.id ?? '',
                    semester_id: semesters[0]?.id ?? null,
                    name: '',
                    exam_type: 'END_SEMESTER',
                    start_date: '2026-12-01',
                    end_date: '2026-12-18',
                    lock_timetable_edits: true,
                    description: '',
                  });
                  setExamModal(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add Exam Period
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {exams.map((ex) => (
              <div
                key={ex.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{ex.name}</span>
                    <Badge variant="violet">{ex.exam_type.replace('_', ' ')}</Badge>
                    {ex.lock_timetable_edits && <Badge variant="coral">Timetable Locked</Badge>}
                  </div>
                  <div className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                    {ex.start_date} → {ex.end_date}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingExam(ex);
                      setExamForm({
                        academic_year_id: ex.academic_year_id,
                        semester_id: ex.semester_id,
                        name: ex.name,
                        exam_type: ex.exam_type,
                        start_date: ex.start_date,
                        end_date: ex.end_date,
                        lock_timetable_edits: ex.lock_timetable_edits,
                        description: ex.description,
                      });
                      setExamModal(true);
                    }}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteExam(ex)}>
                    <Trash2 className="h-3.5 w-3.5 text-[var(--accent-coral)]" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* TAB 5: WORKING DAY & PERIOD CONFIG */}
      {tab === 'working-days' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Working Day & Period Grid Configuration</CardTitle>
            <CardDescription>University-wide bell schedule, lunch break, and teaching periods</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Schedule Profile Name"
                value={wdForm.name ?? ''}
                onChange={(e) => setWdForm({ ...wdForm, name: e.target.value })}
              />
              <Input
                label="College Opening Time"
                type="time"
                value={wdForm.opening_time ?? '08:45'}
                onChange={(e) => setWdForm({ ...wdForm, opening_time: e.target.value })}
              />
              <Input
                label="First Period Start"
                type="time"
                value={wdForm.first_period_time ?? '09:00'}
                onChange={(e) => setWdForm({ ...wdForm, first_period_time: e.target.value })}
              />
              <Input
                label="Period Duration (min)"
                type="number"
                value={wdForm.period_duration_minutes ?? 55}
                onChange={(e) => setWdForm({ ...wdForm, period_duration_minutes: Number(e.target.value) })}
              />
              <Input
                label="Morning Periods"
                type="number"
                value={wdForm.morning_periods ?? 4}
                onChange={(e) => setWdForm({ ...wdForm, morning_periods: Number(e.target.value) })}
              />
              <Input
                label="Lunch Start Time"
                type="time"
                value={wdForm.lunch_start_time ?? '12:40'}
                onChange={(e) => setWdForm({ ...wdForm, lunch_start_time: e.target.value })}
              />
              <Input
                label="Lunch Duration (min)"
                type="number"
                value={wdForm.lunch_duration_minutes ?? 50}
                onChange={(e) => setWdForm({ ...wdForm, lunch_duration_minutes: Number(e.target.value) })}
              />
              <Input
                label="Afternoon Periods"
                type="number"
                value={wdForm.afternoon_periods ?? 3}
                onChange={(e) => setWdForm({ ...wdForm, afternoon_periods: Number(e.target.value) })}
              />
              <Input
                label="College Closing Time"
                type="time"
                value={wdForm.closing_time ?? '16:30'}
                onChange={(e) => setWdForm({ ...wdForm, closing_time: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                Working Weekdays
              </label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const active = selectedWorkingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? selectedWorkingDays.filter((d) => d !== day)
                          : [...selectedWorkingDays, day];
                        setWdForm({ ...wdForm, working_days: next.join(',') });
                      }}
                      className={`rounded-xl border px-3.5 py-1.5 font-mono text-xs ${
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

            <Input
              label="Non-Teaching Periods (comma-separated)"
              value={wdForm.non_teaching_periods ?? ''}
              onChange={(e) => setWdForm({ ...wdForm, non_teaching_periods: e.target.value })}
            />

            <div className="flex justify-end">
              <Button onClick={() => saveWdMutation.mutate()} disabled={saveWdMutation.isPending}>
                <Save className="h-4 w-4" /> {saveWdMutation.isPending ? 'Saving...' : 'Save Period Configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Academic Year Modal */}
      <Modal
        open={ayModal}
        onOpenChange={setAyModal}
        title={editingAy ? 'Edit Academic Year' : 'Create Academic Year'}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveAyMutation.mutate();
          }}
        >
          <Input label="Academic Year Name" required value={ayForm.name} onChange={(e) => setAyForm({ ...ayForm, name: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Start Date" type="date" required value={ayForm.start_date} onChange={(e) => setAyForm({ ...ayForm, start_date: e.target.value })} />
            <Input label="End Date" type="date" required value={ayForm.end_date} onChange={(e) => setAyForm({ ...ayForm, end_date: e.target.value })} />
          </div>
          <Input label="Description" value={ayForm.description} onChange={(e) => setAyForm({ ...ayForm, description: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAyModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saveAyMutation.isPending}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Semester Modal */}
      <Modal open={semModal} onOpenChange={setSemModal} title={editingSem ? 'Edit Semester' : 'Add Semester'}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveSemMutation.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Semester Name" required value={semForm.name} onChange={(e) => setSemForm({ ...semForm, name: e.target.value })} />
            <Input label="Semester Number" type="number" min={1} max={12} required value={semForm.semester_number} onChange={(e) => setSemForm({ ...semForm, semester_number: Number(e.target.value) })} />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase">Term Type</label>
              <select value={semForm.term_type} onChange={(e) => setSemForm({ ...semForm, term_type: e.target.value as SemesterRecord['term_type'] })} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm">
                <option value="ODD">Odd Semester</option>
                <option value="EVEN">Even Semester</option>
                <option value="SUMMER">Summer Term</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase">Status</label>
              <select value={semForm.status} onChange={(e) => setSemForm({ ...semForm, status: e.target.value as SemesterRecord['status'] })} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm">
                <option value="ACTIVE">Active</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <Input label="Start Date" type="date" required value={semForm.start_date} onChange={(e) => setSemForm({ ...semForm, start_date: e.target.value })} />
            <Input label="End Date" type="date" required value={semForm.end_date} onChange={(e) => setSemForm({ ...semForm, end_date: e.target.value })} />
            <Input label="Exam Start" type="date" value={semForm.exam_start} onChange={(e) => setSemForm({ ...semForm, exam_start: e.target.value })} />
            <Input label="Exam End" type="date" value={semForm.exam_end} onChange={(e) => setSemForm({ ...semForm, exam_end: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSemModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saveSemMutation.isPending}>Save Semester</Button>
          </div>
        </form>
      </Modal>

      {/* Holiday Modal */}
      <Modal open={holModal} onOpenChange={setHolModal} title={editingHol ? 'Edit Holiday' : 'Add Holiday'}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveHolMutation.mutate();
          }}
        >
          <Input label="Holiday Name" required value={holForm.name} onChange={(e) => setHolForm({ ...holForm, name: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Date" type="date" required value={holForm.date} onChange={(e) => setHolForm({ ...holForm, date: e.target.value })} />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase">Type</label>
              <select value={holForm.holiday_type} onChange={(e) => setHolForm({ ...holForm, holiday_type: e.target.value as HolidayRecord['holiday_type'] })} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm">
                <option value="PUBLIC">Public</option>
                <option value="INSTITUTIONAL">Institutional</option>
                <option value="ACADEMIC">Academic</option>
                <option value="RESTRICTED">Restricted</option>
              </select>
            </div>
          </div>
          <Input label="Description" value={holForm.description} onChange={(e) => setHolForm({ ...holForm, description: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setHolModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saveHolMutation.isPending}>Save Holiday</Button>
          </div>
        </form>
      </Modal>

      {/* Exam Modal */}
      <Modal open={examModal} onOpenChange={setExamModal} title={editingExam ? 'Edit Exam Period' : 'Add Exam Period'}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveExamMutation.mutate();
          }}
        >
          <Input label="Examination Name" required value={examForm.name} onChange={(e) => setExamForm({ ...examForm, name: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)] uppercase">Exam Type</label>
              <select value={examForm.exam_type} onChange={(e) => setExamForm({ ...examForm, exam_type: e.target.value as ExaminationPeriodRecord['exam_type'] })} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm">
                <option value="INTERNAL_ASSESSMENT">Internal Assessment</option>
                <option value="END_SEMESTER">End Semester</option>
                <option value="PRACTICAL">Practical</option>
                <option value="SPECIAL_ACADEMIC">Special Academic Day</option>
              </select>
            </div>
            <Input label="Start Date" type="date" required value={examForm.start_date} onChange={(e) => setExamForm({ ...examForm, start_date: e.target.value })} />
            <Input label="End Date" type="date" required value={examForm.end_date} onChange={(e) => setExamForm({ ...examForm, end_date: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input type="checkbox" checked={examForm.lock_timetable_edits} onChange={(e) => setExamForm({ ...examForm, lock_timetable_edits: e.target.checked })} className="h-4 w-4 accent-[var(--accent-violet)]" />
            Lock department timetable edits during this examination window
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setExamModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saveExamMutation.isPending}>Save Exam Period</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteHol)}
        onOpenChange={(open) => !open && setDeleteHol(null)}
        title="Delete Holiday?"
        description={`Remove "${deleteHol?.name}" (${deleteHol?.date}) from the university calendar?`}
        confirmLabel="Delete"
        loading={deleteHolMutation.isPending}
        onConfirm={() => deleteHol && deleteHolMutation.mutate(deleteHol.id)}
      />

      <ConfirmDialog
        open={Boolean(deleteExam)}
        onOpenChange={(open) => !open && setDeleteExam(null)}
        title="Delete Examination Period?"
        description={`Remove "${deleteExam?.name}"?`}
        confirmLabel="Delete"
        loading={deleteExamMutation.isPending}
        onConfirm={() => deleteExam && deleteExamMutation.mutate(deleteExam.id)}
      />
    </div>
  );
}
