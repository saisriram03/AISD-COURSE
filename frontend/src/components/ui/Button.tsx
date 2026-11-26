import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-cyan)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--accent-violet)] text-white shadow-[var(--glow-violet)] hover:brightness-110 active:scale-[0.98]',
        cyan: 'bg-[var(--accent-cyan)] text-[#05060a] font-semibold shadow-[var(--glow-cyan)] hover:brightness-110 active:scale-[0.98]',
        secondary:
          'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-glass-hover)]',
        outline:
          'border border-[var(--border-strong)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
        ghost:
          'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
        danger:
          'bg-[var(--accent-coral-soft)] text-[var(--accent-coral)] border border-[var(--accent-coral)]/30 hover:bg-[var(--accent-coral)] hover:text-white',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        data-cursor={variant === 'danger' ? 'danger' : 'button'}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
