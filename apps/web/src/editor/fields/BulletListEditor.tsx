import { createId } from '@cv-studio/shared';
import { Plus, X } from 'lucide-react';
import { useRef, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { useT } from '../../i18n';
import { DragHandle, SortableList } from './SortableList';

const BULLET_PREFIX = /^\s*[-•*▪◦●–·]\s*/;

/**
 * Aufzählungspunkte bearbeiten: Enter erzeugt einen neuen Punkt, Rücktaste im leeren Feld entfernt ihn,
 * mehrzeiliges Einfügen erzeugt mehrere Punkte. Reihenfolge per Drag & Drop.
 */
export function BulletListEditor({
  label,
  items,
  onChange,
  max = 30,
  action,
}: {
  label: ReactNode;
  items: string[];
  onChange: (items: string[]) => void;
  max?: number;
  action?: ReactNode;
}) {
  const t = useT();
  const ids = useRef<string[]>([]);
  while (ids.current.length < items.length) ids.current.push(createId());
  if (ids.current.length > items.length) ids.current.length = items.length;
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const rows = items.map((text, i) => ({ id: ids.current[i]!, text }));

  const focus = (index: number) => requestAnimationFrame(() => inputs.current[index]?.focus());

  const insertAfter = (index: number, values: string[]) => {
    const next = [...items];
    next.splice(index + 1, 0, ...values);
    ids.current.splice(index + 1, 0, ...values.map(() => createId()));
    onChange(next.slice(0, max));
    focus(Math.min(index + values.length, max - 1));
  };

  const remove = (index: number) => {
    ids.current.splice(index, 1);
    onChange(items.filter((_, i) => i !== index));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (items.length < max) insertAfter(index, ['']);
    } else if (e.key === 'Backspace' && items[index] === '' && items.length > 0) {
      e.preventDefault();
      remove(index);
      focus(Math.max(0, index - 1));
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>, index: number) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n')) return;
    e.preventDefault();
    const lines = text.split(/\r?\n/).map((l) => l.replace(BULLET_PREFIX, '').trim()).filter(Boolean);
    const next = [...items];
    const [first, ...rest] = lines;
    next[index] = (next[index] ? `${next[index]} ` : '') + (first ?? '');
    ids.current.splice(index + 1, 0, ...rest.map(() => createId()));
    next.splice(index + 1, 0, ...rest);
    onChange(next.slice(0, max));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-foreground/90">{label}</span>
        {action}
      </div>
      <SortableList
        items={rows}
        onMove={(from, to) => {
          const next = [...items];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved ?? '');
          const [movedId] = ids.current.splice(from, 1);
          ids.current.splice(to, 0, movedId ?? createId());
          onChange(next);
        }}
        className="flex flex-col gap-1.5"
      >
        {(row, index) => (
          <div className="flex items-center gap-1">
            <DragHandle />
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
            <input
              ref={(el) => {
                inputs.current[index] = el;
              }}
              value={row.text}
              onChange={(e) => onChange(items.map((v, i) => (i === index ? e.target.value : v)))}
              onKeyDown={(e) => onKeyDown(e, index)}
              onPaste={(e) => onPaste(e, index)}
              placeholder={t('editor.bullets.placeholder')}
              maxLength={600}
              aria-label={`${typeof label === 'string' ? label : ''} ${index + 1}`}
              className="h-9 min-w-0 flex-1 rounded-md border border-transparent bg-muted/50 px-2.5 text-sm transition-colors hover:border-input focus:border-ring focus:bg-card focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
            <IconButton label={t('common.remove')} size="sm" onClick={() => remove(index)} tooltip={false}>
              <X />
            </IconButton>
          </div>
        )}
      </SortableList>
      {items.length < max ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-primary"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            ids.current.push(createId());
            onChange([...items, '']);
            focus(items.length);
          }}
        >
          {t('editor.bullets.add')}
        </Button>
      ) : null}
    </div>
  );
}
