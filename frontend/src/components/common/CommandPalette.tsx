import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Command, Moon, Search, Sun } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';
import { getNavItemsForRole } from '@/lib/navigation';
import type { CommandItem } from '@/types/navigation';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const commands = useMemo<CommandItem[]>(() => {
    const navCommands: CommandItem[] = user
      ? getNavItemsForRole(user.role).map((item) => ({
          id: `nav-${item.id}`,
          label: item.label,
          description: `${item.group} · ${item.path}`,
          category: 'Navigation',
          action: () => {
            navigate(item.path);
            onOpenChange(false);
          },
        }))
      : [
          {
            id: 'nav-home',
            label: 'Home',
            description: 'Return to SMARTSCHED landing page',
            category: 'Navigation',
            action: () => {
              navigate('/');
              onOpenChange(false);
            },
          },
          {
            id: 'nav-login',
            label: 'Sign In',
            description: 'Open authentication portal',
            category: 'Navigation',
            action: () => {
              navigate('/login');
              onOpenChange(false);
            },
          },
        ];

    const sharedCommands: CommandItem[] = user
      ? [
          {
            id: 'nav-profile',
            label: 'Profile & Preferences',
            description: 'Manage user account details',
            category: 'Navigation',
            action: () => {
              navigate('/profile');
              onOpenChange(false);
            },
          },
          {
            id: 'nav-notifications',
            label: 'Notification Center',
            description: 'View schedule alerts and system notices',
            category: 'Navigation',
            action: () => {
              navigate('/notifications');
              onOpenChange(false);
            },
          },
        ]
      : [];

    const themeCommand: CommandItem = {
      id: 'theme-toggle',
      label: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`,
      description: 'Toggle color mode across the interface',
      category: 'Theme',
      action: () => {
        toggleTheme();
        onOpenChange(false);
      },
    };

    return [...navCommands, ...sharedCommands, themeCommand];
  }, [navigate, onOpenChange, theme, toggleTheme, user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q),
    );
  }, [commands, query]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setQuery('');
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          aria-label="Global Command Palette"
          className="glass-panel-elevated fixed top-[16%] left-1/2 z-50 w-[92vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl shadow-2xl focus:outline-none"
        >
          <Dialog.Title className="sr-only">Command Palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search pages, tools, and theme preferences.
          </Dialog.Description>
          <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5">
            <Search className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Jump to module, timetable view, or action..."
              className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
            <kbd className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
              ESC
            </kbd>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                No matching destinations or actions found.
              </div>
            ) : (
              <ul className="space-y-1">
                {filtered.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={item.action}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-glass-hover)]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--accent-cyan)]">
                          {item.category === 'Theme' ? (
                            theme === 'dark' ? (
                              <Sun className="h-3.5 w-3.5" />
                            ) : (
                              <Moon className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <Command className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-[var(--text-primary)]">
                            {item.label}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">{item.description}</div>
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
