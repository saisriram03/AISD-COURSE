import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Layers } from 'lucide-react';
import { fadeInUp } from '@/lib/motion';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

interface ModuleShellPageProps {
  title: string;
  description: string;
  phase: number;
  capabilities: string[];
  backPath: string;
}

export function ModuleShellPage({
  title,
  description,
  phase,
  capabilities,
  backPath,
}: ModuleShellPageProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-4xl space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="violet">Phase {phase} Module</Badge>
            <Badge variant="neutral">Phase 1 Foundation Ready</Badge>
          </div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link to={backPath}>
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Layers className="h-5 w-5 text-[var(--accent-cyan)]" />
            <CardTitle>Module Architecture & Planned Capabilities</CardTitle>
          </div>
          <CardDescription>
            This route is registered with role-based access control and layout navigation. Real
            PostgreSQL persistence and backend API integration will be wired in Phase {phase}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {capabilities.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm text-[var(--text-secondary)]"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-cyan)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </motion.div>
  );
}
