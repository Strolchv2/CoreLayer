import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { forwardRef, type ReactNode } from 'react';
import { IconButton } from '../../components/ui/IconButton';
import { Badge } from '../../components/ui/misc';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import { VisibilityToggle } from '../fields/Fields';
import { DragHandle } from '../fields/SortableList';

/** Kopf eines Abschnitts mit Griff, Titel, Sichtbarkeit, Optionen und Aufklappen. */
export const SectionCard = forwardRef<
  HTMLDivElement,
  {
    title: string;
    count?: number;
    icon?: ReactNode;
    open: boolean;
    onToggle: () => void;
    visible?: boolean;
    onToggleVisible?: () => void;
    options?: ReactNode;
    sortable?: boolean;
    children: ReactNode;
  }
>(function SectionCard({ title, count, icon, open, onToggle, visible = true, onToggleVisible, options, sortable = true, children }, ref) {
  const t = useT();
  return (
    <section ref={ref} className={cn('rounded-2xl border bg-card/80', !visible && 'bg-muted/30')}>
      <div className="flex items-center gap-1 px-2 py-2">
        {sortable ? <DragHandle /> : <span className="w-1" />}
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-muted/60">
          {icon ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
          <span className={cn('min-w-0 flex-1 truncate text-sm font-semibold', !visible && 'text-muted-foreground')}>{title}</span>
          {!visible ? <Badge>{t('editor.section.hiddenBadge')}</Badge> : count !== undefined && count > 0 ? <Badge>{count}</Badge> : null}
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        {options ? (
          <Popover.Root>
            <Popover.Trigger asChild>
              <IconButton label={t('editor.section.options')} size="sm">
                <SlidersHorizontal />
              </IconButton>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" sideOffset={6} className="z-50 w-72 rounded-xl border bg-card p-4 shadow-xl data-[state=open]:animate-fade-in">
                <div className="space-y-3">{options}</div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : null}
        {onToggleVisible ? <VisibilityToggle visible={visible} onToggle={onToggleVisible} labelShow={t('editor.section.show')} labelHide={t('editor.section.hide')} /> : null}
      </div>
      {open ? <div className="space-y-3 px-3 pb-3.5 pt-1 animate-fade-in">{children}</div> : null}
    </section>
  );
});
