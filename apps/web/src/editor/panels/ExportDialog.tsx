import { buildExportFileName, type DocumentCategory, type DocumentDTO } from '@cv-studio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Files, FolderArchive } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Checkbox, Select } from '../../components/ui/Input';
import { useT, type MessageKey } from '../../i18n';
import { api, saveBlob } from '../../lib/api';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/errors';
import { useCoverLetters, useDocuments } from '../../lib/queries';

const GROUPS: { key: 'schoolReports' | 'certificates' | 'attachments'; categories: DocumentCategory[] }[] = [
  { key: 'schoolReports', categories: ['school_report', 'employment_reference'] },
  { key: 'certificates', categories: ['certificate'] },
  { key: 'attachments', categories: ['drivers_license', 'other'] },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumeId: string;
  preselectedDocumentIds: string[];
  fullName: { first: string; last: string };
  language: 'de' | 'en';
  beforeExport: () => Promise<void>;
}

/** Exportoptionen: Lebenslauf, Anschreiben, Zeugnisse, Zertifikate, Anlagen – zusammengeführt oder als ZIP. */
export function ExportDialog({ open, onOpenChange, resumeId, preselectedDocumentIds, fullName, language, beforeExport }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const { data: documents } = useDocuments();
  const { data: letters } = useCoverLetters();
  const [includeResume, setIncludeResume] = useState(true);
  const [letterId, setLetterId] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(new Set(preselectedDocumentIds));
  const [mode, setMode] = useState<'merged' | 'zip'>('merged');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(preselectedDocumentIds));
    const linked = letters?.find((l) => l.resumeId === resumeId);
    setLetterId(linked?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const grouped = useMemo(
    () => GROUPS.map((g) => ({ ...g, docs: (documents ?? []).filter((d) => g.categories.includes(d.category)) })),
    [documents],
  );

  const toggleDoc = (d: DocumentDTO) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(d.id)) next.delete(d.id);
      else next.add(d.id);
      return next;
    });

  const download = async (label: string, run: () => Promise<{ blob: Blob; fileName: string }>) => {
    setBusy(label);
    const id = toast.loading(t('export.generating'));
    try {
      await beforeExport();
      const { blob, fileName } = await run();
      saveBlob(blob, fileName);
      toast.success(t('export.done'), { id });
      await qc.invalidateQueries({ queryKey: ['dashboard'] });
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t, 'errors.pdf_export_failed'), { id });
    } finally {
      setBusy(null);
    }
  };

  const exportResumeOnly = () => download('resume', () => api.download('POST', `/api/resumes/${resumeId}/export/pdf`));
  const exportPackage = (all = false) => {
    const documentIds = all ? grouped.flatMap((g) => g.docs.map((d) => d.id)) : [...selected];
    const coverLetterId = all ? letterId || letters?.[0]?.id || null : letterId || null;
    return download(all ? 'all' : 'package', () =>
      api.download('POST', `/api/resumes/${resumeId}/export/package`, {
        includeResume: all ? true : includeResume,
        coverLetterId,
        documentIds,
        mode: all ? 'merged' : mode,
      }),
    );
  };

  const mergedName = buildExportFileName([language === 'en' ? 'Application' : 'Bewerbung', fullName.first, fullName.last], 'pdf');
  const nothing = !includeResume && !letterId && selected.size === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('export.title')}
      description={t('export.subtitle')}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => exportPackage(false)} loading={busy === 'package'} disabled={nothing || Boolean(busy)}>
            {t('export.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" icon={<FileText className="h-4 w-4" />} onClick={exportResumeOnly} loading={busy === 'resume'} disabled={Boolean(busy)}>
            {t('export.onlyResume')}
          </Button>
          <Button variant="outline" icon={<Files className="h-4 w-4" />} onClick={() => exportPackage(true)} loading={busy === 'all'} disabled={Boolean(busy)}>
            {t('export.fullApplication')}
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <Checkbox checked={includeResume} onChange={(e) => setIncludeResume(e.target.checked)} />
            {t('export.resume')}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2.5 text-sm font-medium sm:w-40">
              <Checkbox checked={Boolean(letterId)} onChange={(e) => setLetterId(e.target.checked ? letters?.[0]?.id ?? '' : '')} disabled={!letters?.length} />
              {t('export.coverLetter')}
            </label>
            <Select value={letterId} onChange={(e) => setLetterId(e.target.value)} className="h-9 sm:flex-1" aria-label={t('export.coverLetter')}>
              <option value="">{t('export.noCoverLetter')}</option>
              {letters?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </Select>
          </div>
          {grouped.map((g) => (
            <fieldset key={g.key} className="border-t pt-3">
              <legend className="sr-only">{t(`export.${g.key}` as MessageKey)}</legend>
              <label className="flex items-center gap-2.5 text-sm font-medium">
                <Checkbox
                  checked={g.docs.length > 0 && g.docs.every((d) => selected.has(d.id))}
                  disabled={g.docs.length === 0}
                  onChange={(e) =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      g.docs.forEach((d) => (e.target.checked ? next.add(d.id) : next.delete(d.id)));
                      return next;
                    })
                  }
                />
                {t(`export.${g.key}` as MessageKey)}
              </label>
              {g.docs.length ? (
                <ul className="mt-2 space-y-1 pl-6">
                  {g.docs.map((d) => (
                    <li key={d.id}>
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Checkbox checked={selected.has(d.id)} onChange={() => toggleDoc(d)} />
                        <span className="truncate text-foreground">{d.title}</span>
                        {d.pageCount ? <span className="text-xs">({t('export.pages', { n: d.pageCount })})</span> : null}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 pl-6 text-xs text-muted-foreground">
                  {t('export.noDocuments')}{' '}
                  <Link to="/dokumente" className="text-primary hover:underline">
                    {t('export.uploadDocuments')}
                  </Link>
                </p>
              )}
            </fieldset>
          ))}
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium">{t('export.mode')}</span>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {(['merged', 'zip'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={cn('flex items-start gap-3 rounded-xl border p-3 text-left transition-all', mode === m ? 'border-primary ring-2 ring-primary/25' : 'hover:border-primary/40')}
              >
                {m === 'merged' ? <FileText className="mt-0.5 h-4 w-4 text-primary" /> : <FolderArchive className="mt-0.5 h-4 w-4 text-primary" />}
                <span>
                  <span className="block text-sm font-medium">{t(`export.mode.${m}`)}</span>
                  <span className="block text-xs text-muted-foreground">{m === 'merged' ? t('export.mode.merged.text', { name: mergedName }) : t('export.mode.zip.text')}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
