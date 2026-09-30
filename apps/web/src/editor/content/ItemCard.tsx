import { ChevronDown, Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { IconButton } from '../../components/ui/IconButton';
import { Menu } from '../../components/ui/Menu';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import { DragHandle } from '../fields/SortableList';
import { VisibilityToggle } from '../fields/Fields';

/** Aufklappbarer Eintrag (z. B. eine Arbeitsstelle) mit Griff, Sichtbarkeit und Aktionen. */
export function ItemCard({
  title,
  subtitle,
  open,
  onToggle,
  visible,
  onToggleVisible,
  onDuplicate,
  onDelete,
  children,
  highlight,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  visible: boolean;
  onToggleVisible?: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  children: ReactNode;
  highlight?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlight]);
  return (
    <div ref={ref} className={cn('rounded-xl border bg-card transition-shadow', open && 'shadow-sm', !visible && 'opacity-70', highlight && 'ring-2 ring-primary/40')}>
      <div className="flex items-center gap-1 px-1.5 py-1.5">
        <DragHandle />
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted/60">
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-sm font-medium', !title && 'text-muted-foreground')}>{title || t('editor.item.new')}</span>
            {subtitle ? <span className="block truncate text-xs text-muted-foreground">{subtitle}</span> : null}
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        {onToggleVisible ? <VisibilityToggle visible={visible} onToggle={onToggleVisible} labelShow={t('editor.item.show')} labelHide={t('editor.item.hide')} /> : null}
        <Menu
          trigger={
            <IconButton label={t('common.more')} size="sm" tooltip={false}>
              <MoreHorizontal />
            </IconButton>
          }
          items={[
            ...(onDuplicate ? [{ label: t('common.duplicate'), icon: <Copy />, onSelect: onDuplicate }] : []),
            { label: t('editor.item.delete'), icon: <Trash2 />, destructive: true, onSelect: onDelete },
          ]}
        />
      </div>
      {open ? <div className="space-y-3 border-t px-3.5 pb-4 pt-3.5 animate-fade-in">{children}</div> : null}
    </div>
  );
}
