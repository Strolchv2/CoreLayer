import { runAtsCheck, runQualityCheck, type CheckItem, type CheckReport } from '@cv-studio/shared';
import { AlertTriangle, CheckCircle2, ChevronRight, Info } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Textarea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/misc';
import { useI18n, type MessageKey } from '../../i18n';
import { cn } from '../../lib/cn';
import { useEditor, useEditorStore } from '../EditorContext';

function StatusIcon({ status }: { status: CheckItem['status'] }) {
  if (status === 'ok') return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="OK" />;
  if (status === 'warning') return <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-label="Warnung" />;
  return <Info className="h-4 w-4 shrink-0 text-primary" aria-label="Hinweis" />;
}

function ReportList({ report, onJump }: { report: CheckReport; onJump: (item: CheckItem) => void }) {
  const { t } = useI18n();
  return (
    <ul className="space-y-1.5">
      {report.items.map((item) => {
        const jumpable = Boolean(item.section);
        return (
          <li key={item.id}>
            <button
              type="button"
              disabled={!jumpable}
              onClick={() => onJump(item)}
              className={cn('flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors', jumpable && 'hover:bg-muted', item.status === 'warning' && 'bg-warning/6')}
              title={jumpable ? t('check.goTo') : undefined}
            >
              <span className="mt-0.5">
                <StatusIcon status={item.status} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-snug">{item.title}</span>
                {item.suggestion ? <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.suggestion}</span> : null}
              </span>
              {jumpable ? <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Qualitäts- und ATS-Check – läuft live im Browser mit derselben Logik wie auf dem Server. */
export function CheckPanel({ onJump }: { onJump?: () => void }) {
  const { t, locale } = useI18n();
  const doc = useDeferredValue(useEditor((s) => s.doc));
  const setFocus = useEditorStore().getState().setFocus;
  const [jobAd, setJobAd] = useState('');
  const deferredJobAd = useDeferredValue(jobAd);

  const quality = useMemo(() => runQualityCheck(doc.content, locale), [doc.content, locale]);
  const ats = useMemo(
    () => runAtsCheck({ content: doc.content, templateKey: doc.templateKey, design: doc.design, language: doc.language, dateFormat: doc.dateFormat, jobDescription: deferredJobAd }, locale),
    [doc.content, doc.templateKey, doc.design, doc.language, doc.dateFormat, deferredJobAd, locale],
  );

  const jump = (item: CheckItem) => {
    if (!item.section) return;
    setFocus({ section: item.section, itemId: item.itemId });
    onJump?.();
  };

  const ratingTone = ats.rating === 'good' ? 'success' : ats.rating === 'fair' ? 'warning' : 'danger';

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-semibold">{t('check.quality')}</h3>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{t('check.summary', { ok: quality.counts.ok, warning: quality.counts.warning, info: quality.counts.info })}</p>
        {quality.counts.warning === 0 ? <p className="mb-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{t('check.allGood')}</p> : null}
        <ReportList report={quality} onJump={jump} />
      </section>

      <section className="border-t pt-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{t('check.ats')}</h3>
          <Badge tone={ratingTone}>{t(`check.rating.${ats.rating}` as MessageKey)}</Badge>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">{t('check.ratingNote')}</p>
        <label className="mb-3 block">
          <span className="mb-1.5 block text-[13px] font-medium">{t('check.jobAd')}</span>
          <Textarea value={jobAd} onChange={(e) => setJobAd(e.target.value)} placeholder={t('check.jobAdPlaceholder')} rows={3} maxLength={20000} />
        </label>
        {ats.keywords && ats.keywords.keywords.length ? (
          <div className="mb-3 space-y-2 rounded-xl border p-3">
            <div>
              <span className="text-xs font-semibold text-success">{t('check.keywordsFound')}</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {ats.keywords.found.map((k) => (
                  <Badge key={k} tone="success">
                    {k}
                  </Badge>
                ))}
              </div>
            </div>
            {ats.keywords.missing.length ? (
              <div>
                <span className="text-xs font-semibold text-warning">{t('check.keywordsMissing')}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ats.keywords.missing.map((k) => (
                    <Badge key={k} tone="warning">
                      {k}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <ReportList report={ats} onJump={jump} />
      </section>
    </div>
  );
}
