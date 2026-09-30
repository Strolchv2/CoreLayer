import { Link } from 'react-router';
import { cn } from '../../lib/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path d="M10 8h9l4 4v11a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" fill="var(--primary-foreground)" />
      <path d="M19 8v4h4" fill="var(--accent)" />
      <rect x="12" y="15" width="8" height="1.6" rx=".8" fill="var(--primary)" />
      <rect x="12" y="18.2" width="6" height="1.6" rx=".8" fill="var(--primary)" opacity=".55" />
    </svg>
  );
}

export function Logo({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5 font-semibold tracking-tight', className)}>
      <LogoMark />
      <span className="text-[17px]">CV Studio</span>
    </Link>
  );
}
