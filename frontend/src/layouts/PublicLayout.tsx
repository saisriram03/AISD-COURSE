import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { CommandPalette } from '@/components/common/CommandPalette';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { ROLE_HOME_ROUTES } from '@/types/auth';

export function PublicLayout() {
  const [commandOpen, setCommandOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-[var(--accent-violet)] focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-glass)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-violet)] text-white shadow-[var(--glow-violet)]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <span className="font-display text-lg font-bold tracking-tight">SMARTSCHED</span>
              <span className="hidden font-mono text-[10px] text-[var(--accent-cyan)] sm:block">
                ONE CAMPUS · ZERO CLASHES
              </span>
            </div>
          </Link>

          <nav aria-label="Public navigation" className="hidden items-center gap-6 text-sm text-[var(--text-secondary)] md:flex">
            <a href="#architecture" className="hover:text-[var(--text-primary)]">
              Engine
            </a>
            <a href="#portals" className="hover:text-[var(--text-primary)]">
              Portals
            </a>
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <Search className="h-3 w-3" />
              <span>Ctrl+K</span>
            </button>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            {isAuthenticated && user ? (
              <Button asChild size="sm">
                <Link to={ROLE_HOME_ROUTES[user.role]}>Open Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Login</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/login">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-[var(--text-muted)] sm:flex-row sm:px-6 lg:px-8">
          <div className="font-mono">
            SMARTSCHED · Intelligent University Timetable & Resource Scheduling Platform
          </div>
          <div>One Campus. Zero Clashes. Smarter Scheduling.</div>
        </div>
      </footer>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
