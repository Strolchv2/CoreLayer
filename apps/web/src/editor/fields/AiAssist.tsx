import type { AiAction, AiSuggestionDTO, Locale } from '@cv-studio/shared';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Menu } from '../../components/ui/Menu';
import { Spinner } from '../../components/ui/Spinner';
import { useT, type MessageKey } from '../../i18n';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useAiStatus } from '../../lib/queries';

type AiContext = 'summary' | 'experience' | 'bullets' | 'cover_letter' | 'generic';

const ACTIONS: AiAction[] = ['improve', 'professional', 'shorten', 'from_bullets', 'spellcheck'];

/**
 * KI-Assistent für Textfelder. Der Vorschlag wird immer zuerst angezeigt
 * und nur nach ausdrücklicher Bestätigung übernommen.
 */
export function AiAssist({ text, onApply, context, language }: { text: string; onApply: (text: string) => void; context: AiContext; language: Locale }) {
  const t = useT();
  const { data: enabled } = useAiStatus();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiSuggestionDTO | null>(null);

  if (!enabled) return null;

  const run = async (action: AiAction) => {
    if (text.trim().length < 3) {
      toast.info(t('editor.ai.tooShort'));
      return;
    }
    setOpen(true);
    setLoading(true);
    setResult(null);
    try {
      setResult(await api.post<AiSuggestionDTO>('/api/ai/rewrite', { text, action, context, language }));
    } catch (err) {
      setOpen(false);
      toast.error(errorMessage(err, t, 'errors.ai_unavailable'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Menu
        trigger={
          <button type="button" className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent">
            <Sparkles className="h-3.5 w-3.5" />
            {t('editor.ai.button')}
          </button>
        }
        items={ACTIONS.map((a) => ({ label: t(`editor.ai.${a}` as MessageKey), onSelect: () => void run(a) }))}
      />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('editor.ai.title')}
        description={t('editor.ai.note')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('editor.ai.reject')}
            </Button>
            <Button
              disabled={!result}
              onClick={() => {
                if (!result) return;
                onApply(result.suggestion);
                setOpen(false);
                toast.success(t('editor.ai.accepted'));
              }}
            >
              {t('editor.ai.accept')}
            </Button>
          </>
        }
      >
        {loading ? (
          <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <Spinner /> {t('editor.ai.working')}
          </div>
        ) : result ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('editor.ai.original')}</div>
              <div className="whitespace-pre-line rounded-lg border bg-muted/40 p-3 text-sm">{result.original}</div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary">{t('editor.ai.suggestion')}</div>
              <div className="whitespace-pre-line rounded-lg border border-primary/30 bg-accent/40 p-3 text-sm">{result.suggestion}</div>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
