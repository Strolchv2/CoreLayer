import { TEMPLATE_LIST, type TemplateKey } from '@cv-studio/shared';
import { Check } from 'lucide-react';
import { useActiveTemplates } from '../../pages/TemplatesPage';
import { useI18n } from '../../i18n';
import { cn } from '../../lib/cn';
import { TemplateThumbnail } from './TemplateThumbnail';

/** Auswahl einer Vorlage mit echter Miniaturvorschau. */
export function TemplatePicker({
  value,
  onChange,
  columns = 'grid-cols-2 sm:grid-cols-3',
  compact = false,
}: {
  value: TemplateKey;
  onChange: (key: TemplateKey) => void;
  columns?: string;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const { data: active } = useActiveTemplates();
  const activeKeys = active ? new Set(active.map((a) => a.key)) : null;
  const list = TEMPLATE_LIST.filter((tpl) => !activeKeys || activeKeys.has(tpl.key) || tpl.key === value);
  return (
    <div className={cn('grid gap-3', columns)} role="radiogroup" aria-label={t('new.template')}>
      {list.map((tpl) => {
        const selected = tpl.key === value;
        return (
          <button
            key={tpl.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(tpl.key)}
            className={cn(
              'group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all',
              selected ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/40',
            )}
          >
            <div className={cn('bg-preview', compact ? 'p-2' : 'p-3')}>
              <div className="overflow-hidden rounded-sm shadow-sm">
                <TemplateThumbnail templateKey={tpl.key} locale={locale} />
              </div>
            </div>
            <div className={cn('flex items-center justify-between gap-1', compact ? 'px-2 py-1.5' : 'px-3 py-2')}>
              <span className={cn('truncate font-medium', compact ? 'text-xs' : 'text-sm')}>{tpl.name[locale]}</span>
              {selected ? (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              ) : tpl.atsFriendly && !compact ? (
                <span className="text-[11px] text-success">ATS</span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
