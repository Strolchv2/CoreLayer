import { AlertCircle, Check, CloudOff, Loader2 } from 'lucide-react';
import { useT } from '../i18n';
import { cn } from '../lib/cn';
import { useEditor } from './EditorContext';
import type { SaveState } from './store';

/** Sichtbarer Speicherstatus: „Gespeichert“, „Speichert…“, „Nicht gespeichert“. */
export function SaveIndicator({ onRetry }: { onRetry: () => void }) {
  const state = useEditor((s) => s.saveState);
  return <SaveBadge state={state} onRetry={onRetry} />;
}

export function SaveBadge({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const t = useT();
  const map = {
    saved: { icon: <Check className="h-3.5 w-3.5" />, label: t('editor.save.saved'), cls: 'text-success' },
    saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: t('editor.save.saving'), cls: 'text-muted-foreground' },
    dirty: { icon: <span className="h-2 w-2 rounded-full bg-warning" />, label: t('editor.save.dirty'), cls: 'text-muted-foreground' },
    error: { icon: <CloudOff className="h-3.5 w-3.5" />, label: t('editor.save.error'), cls: 'text-destructive' },
    conflict: { icon: <AlertCircle className="h-3.5 w-3.5" />, label: t('editor.save.conflict'), cls: 'text-destructive' },
  }[state];
  return (
    <div className="flex items-center gap-2" aria-live="polite" data-testid="save-state" data-state={state}>
      <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium', map.cls)} title={state === 'error' ? t('editor.save.errorText') : undefined}>
        {map.icon}
        <span className="hidden sm:inline">{map.label}</span>
      </span>
      {state === 'error' ? (
        <button type="button" onClick={onRetry} className="text-xs font-medium text-primary hover:underline">
          {t('editor.save.retry')}
        </button>
      ) : null}
    </div>
  );
}
