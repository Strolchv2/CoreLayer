import { X } from 'lucide-react';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useT } from '../../i18n';

/** Schlagwörter (z. B. Technologien) als Chips; Enter oder Komma fügt hinzu. */
export function TagsInput({ label, values, onChange, max = 30 }: { label: ReactNode; values: string[]; onChange: (values: string[]) => void; max?: number }) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p.slice(0, 100));
    onChange(next.slice(0, max));
    setDraft('');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-foreground/90">{label}</span>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-2 py-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
        {values.map((v, i) => (
          <span key={`${v}-${i}`} className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            {v}
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} aria-label={`${t('common.remove')}: ${v}`} className="rounded hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={values.length ? '' : t('editor.tags.placeholder')}
          className="h-7 min-w-[8rem] flex-1 bg-transparent text-sm outline-none"
          aria-label={typeof label === 'string' ? label : undefined}
        />
      </div>
    </div>
  );
}
