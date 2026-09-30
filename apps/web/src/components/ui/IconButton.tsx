import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Tooltip } from './Tooltip';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  size?: 'sm' | 'md';
  active?: boolean;
  tooltip?: boolean;
}

/** Icon-Schaltfläche mit zugänglichem Namen und Tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, size = 'md', active, tooltip = true, className, type = 'button', ...rest },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40',
        size === 'sm' ? 'h-7 w-7 [&>svg]:h-4 [&>svg]:w-4' : 'h-9 w-9 [&>svg]:h-[18px] [&>svg]:w-[18px]',
        active && 'bg-accent text-accent-foreground',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
});
