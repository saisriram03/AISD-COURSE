import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          data-cursor="text"
          aria-invalid={error ? 'true' : 'false'}
          className={cn(
            'h-10 w-full rounded-xl border bg-[var(--bg-surface)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--accent-cyan)] focus:outline-none',
            error ? 'border-[var(--accent-coral)]' : 'border-[var(--border-subtle)]',
            className,
          )}
          {...props}
        />
        {error && (
          <p role="alert" className="text-xs text-[var(--accent-coral)]">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
