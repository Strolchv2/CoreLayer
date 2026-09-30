import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', className }: DialogProps) {
  const t = useT();
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <RadixDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-2xl border bg-card text-card-foreground shadow-2xl data-[state=open]:animate-slide-up focus:outline-none',
            SIZES[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="min-w-0">
              <RadixDialog.Title className="text-base font-semibold">{title}</RadixDialog.Title>
              {description ? <RadixDialog.Description className="mt-1 text-sm text-muted-foreground">{description}</RadixDialog.Description> : <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>}
            </div>
            <RadixDialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t('common.close')}>
              <X className="h-5 w-5" />
            </RadixDialog.Close>
          </div>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
