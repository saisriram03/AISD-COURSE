import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-tight',
  {
    variants: {
      variant: {
        violet:
          'border-[var(--accent-violet)]/30 bg-[var(--accent-violet-soft)] text-[var(--accent-violet)]',
        cyan: 'border-[var(--accent-cyan)]/30 bg-[var(--accent-cyan-soft)] text-[var(--accent-cyan)]',
        mint: 'border-[var(--accent-mint)]/30 bg-[var(--accent-mint-soft)] text-[var(--accent-mint)]',
        amber:
          'border-[var(--accent-amber)]/30 bg-[var(--accent-amber-soft)] text-[var(--accent-amber)]',
        coral:
          'border-[var(--accent-coral)]/30 bg-[var(--accent-coral-soft)] text-[var(--accent-coral)]',
        neutral:
          'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
