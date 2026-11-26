import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyThemeToDocument(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
        applyThemeToDocument(next);
        set({ theme: next });
      },
    }),
    {
      name: 'smartsched-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeToDocument(state.theme);
        }
      },
    },
  ),
);
