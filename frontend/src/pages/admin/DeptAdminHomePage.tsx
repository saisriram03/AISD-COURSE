import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  CalendarClock,
  Cpu,
  GitBranch,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { staggerContainer, staggerItem } from '@/lib/motion';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

const DEPT_MODULES = [
  {
    title: 'Timetable Grid & Editor',
    description: 'Enter, edit, or delete classes anytime with instant sync to Faculty & Students.',
    path: '/admin/timetable',
    icon: CalendarClock,
    badge: 'Live Ready',
  },
  {
    title: 'Master Data',
    description: 'Faculty, courses, assignments, classrooms, labs, and student batches.',
    path: '/admin/faculty',
    icon: Users,
    badge: 'Phase 4',
  },
  {
    title: 'Constraint Engine',
    description: 'Configure hard constraints and tune soft optimization weights.',
    path: '/admin/constraints',
    icon: ShieldCheck,
    badge: 'Phase 5',
  },
  {
    title: 'CP-SAT Solve Theater',
    description: 'Launch OR-Tools optimization and monitor live objective improvements.',
    path: '/admin/solver',
    icon: Cpu,
    badge: 'Phase 7–8',
  },
  {
    title: 'Conflict Diagnosis',
    description: 'Inspect proven conflicting subsets and resolution alternatives.',
    path: '/admin/conflicts',
    icon: AlertTriangle,
    badge: 'Phase 9',
  },
  {
    title: 'Minimal-Change Rescheduling',
    description: 'Handle sudden absences with minimal schedule disruption.',
    path: '/admin/rescheduling',
    icon: RefreshCw,
    badge: 'Phase 10',
  },
  {
    title: 'Faculty Swaps',
    description: 'Review and approve validated faculty swap requests.',
    path: '/admin/swaps',
    icon: ArrowLeftRight,
    badge: 'Phase 10',
  },
  {
    title: 'Analytics Dashboard',
    description: 'Room utilization, workload balance, and stability metrics from PostgreSQL.',
    path: '/admin/analytics',
    icon: BarChart3,
    badge: 'Phase 12',
  },
  {
    title: 'Campus Digital Twin',
    description: 'Simulate room closures, new batches, and intake growth in isolation.',
    path: '/admin/simulator',
    icon: GitBranch,
    badge: 'Phase 13',
  },
];

export function DeptAdminHomePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="cyan" className="mb-2">
            Department Admin Portal
          </Badge>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {user?.departmentName ?? 'Department Scheduling Command'}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Manage department resources, constraints, CP-SAT optimization, and live timetables.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/admin/timetable">
            <CalendarClock className="h-4 w-4" />
            Enter / Edit Timetable
          </Link>
        </Button>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {DEPT_MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <motion.div key={mod.path} variants={staggerItem}>
              <Link to={mod.path} className="block h-full">
                <Card className="h-full hover:border-[var(--accent-cyan)]/50">
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between">
                      <Icon className="h-5 w-5 text-[var(--accent-cyan)]" />
                      <Badge variant={mod.badge === 'Live Ready' ? 'mint' : 'neutral'}>
                        {mod.badge}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">{mod.title}</CardTitle>
                    <CardDescription>{mod.description}</CardDescription>
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
