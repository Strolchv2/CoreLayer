import { useId, type ReactElement, type ReactNode, cloneElement } from 'react';
import { cn } from '../../lib/cn';

interface FormFieldProps {
  label: ReactNode;
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string; 'aria-required'?: boolean }>;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  action?: ReactNode;
}

/** Beschriftetes Formularfeld mit Fehlermeldung, Hinweis und Pflichtfeld-Markierung. */
export function FormField({ label, children, error, hint, required, className, action }: FormFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-foreground/90">
          {label}
          {required ? (
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {action}
      </div>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
