import { forwardRef, useEffect, useImperativeHandle, useRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const base =
  'w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/70 ' +
  'transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:opacity-60 ' +
  'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive/20';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(base, 'h-10', className)} {...rest} />;
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoGrow?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, autoGrow = true, ...rest }, ref) {
  const inner = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement);
  useEffect(() => {
    const el = inner.current;
    if (!autoGrow || !el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 600)}px`;
  }, [rest.value, autoGrow]);
  return <textarea ref={inner} className={cn(base, 'min-h-[84px] resize-y py-2 leading-relaxed', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(base, 'h-10 cursor-pointer pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

export function Checkbox({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn('h-4 w-4 cursor-pointer rounded border-input accent-[var(--primary)]', className)} {...rest} />;
}
