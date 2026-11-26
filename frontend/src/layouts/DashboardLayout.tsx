import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Search,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '@/store/useAuthStore';
import { getNavItemsForRole } from '@/lib/navigation';
import { ROLE_LABELS } from '@/types/auth';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { CommandPalette } from '@/components/common/CommandPalette';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { NavItem } from '@/types/navigation';

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isDemoSession = useAuthStore((s) => s.isDemoSession);
  const logout = useAuthStore((s) => s.logout);

  const navItems = useMemo(
    () => (user ? getNavItemsForRole(user.role) : []),
    [user],
  );

  const groupedNav = useMemo(() => {
    const groups = new Map<string, NavItem[]>();
    navItems.forEach((item) => {
      const existing = groups.get(item.group) ?? [];
      existing.push(item);
      groups.set(item.group, existing);
    });
    return Array.from(groups.entries());
  }, [navItems]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  const isMobileFirstPortal = user.role === 'FACULTY' || user.role === 'STUDENT';

  return (
    <div className="flex min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-[var(--accent-violet)] focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <aside
        aria-label="Primary Navigation"
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-200 lg:flex',
          collapsed ? 'w-20' : 'w-68',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-[var(--border-subtle)] px-4">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-violet)] text-white shadow-[var(--glow-violet)]">
              <Sparkles className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <span className="font-display text-base font-bold tracking-tight">
                  SMARTSCHED
                </span>
                <span className="block font-mono text-[10px] text-[var(--accent-cyan)]">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groupedNav.map(([group, items]) => (
            <div key={group}>
              {!collapsed && (
                <div className="mb-1.5 px-3 font-mono text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                  {group}
                </div>
              )}
              <ul className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <NavLink
                        to={item.path}
                        end={item.path.split('/').length <= 2}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-[var(--accent-violet-soft)] text-[var(--accent-violet)]'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
                          )
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--border-subtle)] p-3">
          {!collapsed && (
            <div className="mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
              <div className="truncate text-xs font-semibold text-[var(--text-primary)]">
                {user.fullName}
              </div>
              <div className="truncate text-[11px] text-[var(--text-muted)]">
                {user.departmentName ?? user.universityName}
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            className={cn('w-full justify-start text-[var(--accent-coral)]', collapsed && 'justify-center px-0')}
            onClick={handleLogout}
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="fixed inset-y-0 left-0 flex w-72 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-violet)] text-white">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="font-display text-base font-bold">SMARTSCHED</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-5 overflow-y-auto">
                {groupedNav.map(([group, items]) => (
                  <div key={group}>
                    <div className="mb-1.5 px-2 font-mono text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                      {group}
                    </div>
                    <ul className="space-y-1">
                      {items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.id}>
                            <NavLink
                              to={item.path}
                              end={item.path.split('/').length <= 2}
                              onClick={() => setMobileMenuOpen(false)}
                              className={({ isActive }) =>
                                cn(
                                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                                  isActive
                                    ? 'bg-[var(--accent-violet-soft)] text-[var(--accent-violet)]'
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]',
                                )
                              }
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span>{item.label}</span>
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>
              <Button variant="danger" className="mt-4 w-full" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {isDemoSession && (
          <div className="flex items-center justify-center gap-2 border-b border-[var(--accent-amber)]/30 bg-[var(--accent-amber-soft)] px-4 py-1.5 text-xs font-medium text-[var(--accent-amber)]">
            <span>Development Demo Mode Active — Viewing as {ROLE_LABELS[user.role]}</span>
            <Link to="/login" className="underline hover:opacity-80">
              Switch Role
            </Link>
          </div>
        )}

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-glass)] px-4 backdrop-blur-md lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-xl border border-[var(--border-subtle)] p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="flex h-9 items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] sm:w-64"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search modules or actions...</span>
              <span className="sm:hidden">Search</span>
              <kbd className="ml-auto hidden rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] sm:inline">
                Ctrl+K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="cyan" className="hidden md:inline-flex">
              {user.departmentName ?? user.universityName}
            </Badge>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/profile')}
              className="gap-2"
            >
              <UserIcon className="h-3.5 w-3.5 text-[var(--accent-violet)]" />
              <span className="hidden sm:inline">{user.avatarInitials}</span>
            </Button>
          </div>
        </header>

        <main
          id="main-content"
          className={cn(
            'flex-1 p-4 sm:p-6 lg:p-8',
            isMobileFirstPortal && 'pb-24 lg:pb-8',
          )}
        >
          <Outlet />
        </main>

        {/* Mobile-first Bottom Navigation Bar for Faculty & Student */}
        {isMobileFirstPortal && (
          <nav
            aria-label="Mobile quick navigation"
            className="fixed right-0 bottom-0 left-0 z-30 flex items-center justify-around border-t border-[var(--border-subtle)] bg-[var(--bg-glass)] px-2 py-2 backdrop-blur-md lg:hidden"
          >
            {navItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.path.split('/').length <= 2}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium',
                      isActive
                        ? 'text-[var(--accent-cyan)]'
                        : 'text-[var(--text-muted)]',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="max-w-16 truncate">{item.label.split(' ')[0]}</span>
                </NavLink>
              );
            })}
          </nav>
        )}
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
