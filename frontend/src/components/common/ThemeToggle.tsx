import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/store/useThemeStore';
import { Button } from '@/components/ui/Button';

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4 text-[var(--accent-amber)]" /> : <Moon className="h-4 w-4 text-[var(--accent-violet)]" />}
    </Button>
  );
}
