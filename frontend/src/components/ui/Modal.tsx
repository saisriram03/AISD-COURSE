import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidthClass = 'max-w-xl',
}: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[94vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-lg)] focus:outline-none',
            maxWidthClass,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <DialogPrimitive.Title className="font-display text-lg font-bold text-[var(--text-primary)]">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-xs text-[var(--text-secondary)]">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="Close dialog"
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'danger',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description} maxWidthClass="max-w-md">
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </Button>
        <Button type="button" variant={variant} onClick={onConfirm} disabled={loading}>
          {loading ? 'Processing...' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
