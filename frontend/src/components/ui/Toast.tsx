import { create } from 'zustand';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(title: string, type: ToastType = 'success', description?: string) {
  useToastStore.getState().push({ title, type, description });
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed right-4 bottom-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          className={cn(
            'flex items-start gap-3 rounded-xl border bg-[var(--bg-surface)] p-3.5 shadow-[var(--shadow-lg)] backdrop-blur-md',
            item.type === 'success' && 'border-[var(--accent-mint)]/40',
            item.type === 'error' && 'border-[var(--accent-coral)]/40',
            item.type === 'info' && 'border-[var(--accent-cyan)]/40',
          )}
        >
          {item.type === 'success' && (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-mint)]" />
          )}
          {item.type === 'error' && (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-coral)]" />
          )}
          {item.type === 'info' && (
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-cyan)]" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
            {item.description && (
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{item.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="Dismiss notification"
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
