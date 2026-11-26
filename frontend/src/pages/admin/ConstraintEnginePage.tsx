import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LockKeyhole, RotateCcw, Save, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { fetchConstraints, saveConstraints } from '@/services/constraintsApi';
import type { SoftConstraintSetting } from '@/types/constraints';

const DEFAULTS: SoftConstraintSetting[] = ([
  ['faculty_preferences', 'Honor faculty preferred teaching times'],
  ['student_gaps', 'Minimize gaps in student batch days'],
  ['workload_balance', 'Balance weekly teaching load across faculty'],
  ['consecutive_classes', 'Avoid excessive consecutive teaching'],
  ['weekday_distribution', 'Spread sessions across working weekdays'],
  ['room_utilization', 'Improve classroom utilization'],
  ['lab_utilization', 'Improve laboratory utilization'],
  ['late_day_preference', 'Prefer earlier sessions when other choices are equal'],
  ['schedule_stability', 'Minimize changes from the current timetable'],
  ['undesirable_patterns', 'Avoid undesirable timetable patterns'],
 ] as const).map(([key, label]) => ({ key, label, enabled: true, weight: 50 }));

const statusStyle = {
  ENFORCED: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
  PARTIAL: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
  NOT_IMPLEMENTED: 'text-slate-300 bg-slate-400/10 border-slate-400/20',
};

export function ConstraintEnginePage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['constraint-configuration'], queryFn: fetchConstraints });
  const [draft, setDraft] = useState<SoftConstraintSetting[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (query.data) setDraft(query.data.soft_constraints);
  }, [query.data]);

  const save = useMutation({
    mutationFn: saveConstraints,
    onSuccess: (data) => {
      queryClient.setQueryData(['constraint-configuration'], data);
      setDraft(data.soft_constraints);
      setMessage('Scheduling preferences saved.');
    },
    onError: () => setMessage('Could not save scheduling preferences. Try again.'),
  });

  function update(key: string, changes: Partial<SoftConstraintSetting>) {
    setDraft((current) => current.map((setting) => setting.key === key ? { ...setting, ...changes } : setting));
    setMessage(null);
  }

  const dirty = Boolean(query.data && JSON.stringify(draft) !== JSON.stringify(query.data.soft_constraints));
  const hard = query.data?.hard_constraints ?? [];
  const implemented = hard.filter((rule) => rule.status === 'ENFORCED').length;

  return (
    <div className="mx-auto max-w-7xl space-y-7 pb-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-cyan)]">Scheduling policy</p>
          <h1 className="font-display text-3xl font-bold text-[var(--text-primary)]">Constraint Engine</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">Review the rules currently enforced during manual timetable edits and configure optimization priorities.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setDraft(DEFAULTS); setMessage(null); }} disabled={!query.data}>
            <RotateCcw size={16} /> Restore defaults
          </Button>
          <Button onClick={() => save.mutate({ soft_constraints: draft })} disabled={!dirty || save.isPending}>
            <Save size={16} /> {save.isPending ? 'Saving…' : 'Save preferences'}
          </Button>
        </div>
      </header>

      {message && <p role="status" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-secondary)]">{message}</p>}
      {query.isError && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">Could not load constraint configuration. Refresh to retry.</p>}

      {query.isLoading ? <div className="h-64 animate-pulse rounded-2xl bg-[var(--bg-elevated)]" /> : query.data && <>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div><h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">Hard constraints</h2><p className="text-sm text-[var(--text-secondary)]">Hard rules are never user-disableable or traded for a better score.</p></div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">{implemented}/{hard.length} enforced</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {hard.map((rule) => <Card key={rule.key} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-sm">{rule.label}</CardTitle>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusStyle[rule.status]}`}>{rule.status.replace('_', ' ')}</span>
              </div>
              <CardDescription className="mt-2 text-xs leading-relaxed">{rule.explanation}</CardDescription>
            </Card>)}
          </div>
        </section>

        <section>
          <div className="mb-3"><h2 className="font-display text-xl font-semibold text-[var(--text-primary)]">Soft optimization priorities</h2><p className="text-sm text-[var(--text-secondary)]">Set a priority from 0 to 100. A disabled preference is omitted from the objective.</p></div>
          <Card className="divide-y divide-[var(--border-subtle)] p-0">
            {draft.map((setting) => <div key={setting.key} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_180px] sm:items-center">
              <div className="flex items-start gap-3"><SlidersHorizontal size={16} className="mt-0.5 shrink-0 text-[var(--accent-cyan)]" /><div><p className="text-sm font-medium text-[var(--text-primary)]">{setting.label}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{setting.enabled ? 'Included when the optimization engine consumes this preference.' : 'Excluded from the optimization objective.'}</p></div></div>
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><input type="checkbox" checked={setting.enabled} onChange={(event) => update(setting.key, { enabled: event.target.checked })} className="accent-violet-500" /> Enabled</label>
              <label className="flex items-center gap-3 text-xs text-[var(--text-secondary)]"><input type="range" min="0" max="100" step="5" value={setting.weight} disabled={!setting.enabled} onChange={(event) => update(setting.key, { weight: Number(event.target.value) })} className="w-full accent-violet-500" /><span className="w-7 text-right font-mono text-[var(--text-primary)]">{setting.weight}</span></label>
            </div>)}
          </Card>
        </section>
        <Card className="flex items-start gap-3 border-amber-400/20 bg-amber-400/5">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-300" />
          <div><p className="text-sm font-medium text-amber-100">Solver integration is still pending</p><p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">Preferences are saved per department and audited. The CP-SAT solver is not implemented yet, so these weights do not currently alter generated schedules. Hard-rule status above reflects the actual manual validator.</p></div>
          <LockKeyhole size={16} className="ml-auto mt-0.5 shrink-0 text-[var(--text-secondary)]" />
        </Card>
      </>}
    </div>
  );
}
