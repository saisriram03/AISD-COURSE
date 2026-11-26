import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Cpu,
  GitBranch,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/motion';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

const CORE_PILLARS = [
  {
    icon: Cpu,
    title: 'OR-Tools CP-SAT Engine',
    description:
      'Constraint programming solver separating 12 mandatory hard rules from weighted soft preferences.',
    cursor: 'solving',
    accent: 'text-[var(--accent-violet)]',
  },
  {
    icon: ShieldCheck,
    title: 'Explainable Conflict Diagnosis',
    description:
      'Surfaces exact conflicting sessions, resource bottlenecks, and actionable resolution paths.',
    cursor: 'danger',
    accent: 'text-[var(--accent-coral)]',
  },
  {
    icon: RefreshCw,
    title: 'Minimal-Change Rescheduling',
    description:
      'Adapts published timetables to sudden absences while maximizing schedule stability.',
    cursor: 'success',
    accent: 'text-[var(--accent-mint)]',
  },
  {
    icon: GitBranch,
    title: 'Campus Digital Twin',
    description:
      'Run isolated what-if simulations for new batches, lab closures, or intake growth safely.',
    cursor: 'grid-cell',
    accent: 'text-[var(--accent-cyan)]',
  },
] as const;

export function LandingShellPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-40" />

      <section className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div variants={fadeInUp} className="mb-5 flex justify-center">
            <Badge variant="violet">
              <Sparkles className="h-3 w-3" />
              Phase 1 Foundation · Living Timetable Design System
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="font-display text-4xl font-bold tracking-tight sm:text-6xl"
          >
            Timetables That{' '}
            <span className="bg-gradient-to-r from-[var(--accent-violet)] via-[var(--accent-cyan)] to-[var(--accent-mint)] bg-clip-text text-transparent">
              Think.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="mt-5 text-base text-[var(--text-secondary)] sm:text-lg"
          >
            One Campus. Zero Clashes. Smarter Scheduling. An intelligent academic scheduling
            ecosystem powered by Google OR-Tools CP-SAT, explainable conflict resolution, and
            minimal-disruption adaptation.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Button asChild size="lg">
              <Link to="/login">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <a href="#architecture">Explore Features</a>
            </Button>
          </motion.div>
        </motion.div>

        {/* Architecture Pillar Cards */}
        <motion.div
          id="architecture"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {CORE_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <motion.div key={pillar.title} variants={staggerItem}>
                <Card
                  data-cursor={pillar.cursor}
                  data-cursor-label={pillar.cursor}
                  className="h-full hover:border-[var(--border-strong)]"
                >
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                      <Icon className={`h-5 w-5 ${pillar.accent}`} />
                    </div>
                    <CardTitle className="text-base">{pillar.title}</CardTitle>
                    <CardDescription>{pillar.description}</CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Role Portals Preview */}
        <div id="portals" className="mt-16">
          <Card className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[var(--accent-cyan)]" />
                <span className="font-mono text-xs text-[var(--accent-cyan)] uppercase">
                  Four Role-Enforced Portals
                </span>
              </div>
              <h2 className="font-display text-xl font-semibold">
                Super Admin · Department Admin · Faculty · Student
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Phase 2 will introduce the full cinematic chaos-to-order visualization, GSAP scroll
                storytelling, and interactive solver demos. Sign in or use Development Demo Mode to
                inspect all role layouts now.
              </p>
            </div>
            <Button asChild variant="cyan" className="shrink-0">
              <Link to="/login">Open Auth Portal</Link>
            </Button>
          </Card>
        </div>
      </section>
    </div>
  );
}
