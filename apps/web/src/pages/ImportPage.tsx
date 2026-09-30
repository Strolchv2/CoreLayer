import { getCvLabels, getTemplateMeta, type ImportResultDTO, type ResumeDTO, type TemplateKey } from '@cv-studio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthProvider';
import { ImportUpload } from '../components/cv/ImportUpload';
import { ScaledPage } from '../components/cv/ScaledPage';
import { TemplatePicker } from '../components/cv/TemplatePicker';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Badge, Card, PageHeader } from '../components/ui/misc';
import { FieldGrid, TextField } from '../editor/fields/Fields';
import { useI18n, type MessageKey } from '../i18n';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { ResumeDocument } from '../render/ResumeDocument';

/** Erstellt einen Lebenslauf aus einem Importergebnis (auch vom Onboarding genutzt). */
export async function createResumeFromImport(result: ImportResultDTO, opts: { title: string; templateKey: TemplateKey; language: 'de' | 'en'; dateFormat?: string }): Promise<ResumeDTO> {
  const res = await api.post<{ resume: ResumeDTO }>('/api/resumes', {
    title: opts.title,
    language: result.meta?.language ?? opts.language,
    templateKey: opts.templateKey,
    dateFormat: result.meta?.dateFormat ?? opts.dateFormat,
    source: { type: 'content', content: result.content },
  });
  if (result.meta?.design) {
    // JSON-Sicherung: Design vollständig wiederherstellen
    const r = res.resume;
    await api.put(`/api/resumes/${r.id}`, {
      title: r.title,
      language: r.language,
      templateKey: r.templateKey,
      design: result.meta.design,
      dateFormat: r.dateFormat,
      content: r.content,
      attachmentIds: [],
      version: r.version,
    });
  }
  return res.resume;
}

export default function ImportPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [result, setResult] = useState<ImportResultDTO | null>(null);
  const [title, setTitle] = useState('');
  const [templateKey, setTemplateKey] = useState<TemplateKey>('modern');
  const [busy, setBusy] = useState(false);
  const labels = getCvLabels(locale);

  const preview = useMemo(
    () =>
      result
        ? { content: result.content, design: result.meta?.design ?? undefined, templateKey: result.meta?.templateKey ?? templateKey, language: result.meta?.language ?? locale, dateFormat: result.meta?.dateFormat ?? user?.defaultDateFormat ?? 'MM/YYYY', photoUrl: null }
        : null,
    [result, templateKey, locale, user?.defaultDateFormat],
  );

  const setPersonal = (key: 'firstName' | 'lastName' | 'jobTitle' | 'email' | 'phone' | 'city') => (value: string) =>
    setResult((r) => (r ? { ...r, content: { ...r.content, personal: { ...r.content.personal, [key]: value } } } : r));

  const create = async () => {
    if (!result) return;
    setBusy(true);
    try {
      const resume = await createResumeFromImport(result, { title: title.trim() || t('new.defaultTitle'), templateKey: result.meta?.templateKey ?? templateKey, language: locale, dateFormat: user?.defaultDateFormat });
      await qc.invalidateQueries({ queryKey: ['resumes'] });
      toast.success(t('import.created'));
      navigate(`/editor/${resume.id}?import=1`);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const c = result?.content;
  return (
    <AppShell wide>
      <PageHeader title={t('import.title')} description={t('import.subtitle')} />
      {!result || !c || !preview ? (
        <ImportUpload
          onResult={(r, name) => {
            setResult(r);
            setTitle(r.meta?.title ?? t('import.fromSource', { name: name.replace(/\.[a-z0-9]+$/i, '') }).slice(0, 150));
          }}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="space-y-5">
            <Card className="space-y-4 p-5">
              <div>
                <h2 className="font-semibold">{t('import.review')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{result.sourceType === 'json' ? t('import.backupDetected') : t('import.reviewText')}</p>
              </div>
              {result.sourceType !== 'json' ? (
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('import.detected')}</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.detected.sections.length ? (
                      result.detected.sections.map((s) => (
                        <Badge key={s} tone="success">
                          <CheckCircle2 className="h-3 w-3" /> {labels.sections[s as keyof typeof labels.sections] ?? s}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">{t('import.noneDetected')}</span>
                    )}
                  </div>
                  {result.detected.warnings.map((w) => (
                    <p key={w} className="mt-2 flex items-center gap-2 text-sm text-warning">
                      <AlertTriangle className="h-4 w-4" /> {t(`import.warning.${w}` as MessageKey)}
                    </p>
                  ))}
                </div>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {t('import.counts', { experience: c.experience.length, education: c.education.length, skills: c.skills.reduce((n, g) => n + g.items.length, 0), languages: c.languages.length })}
              </p>
            </Card>
            <Card className="space-y-3 p-5">
              <h2 className="font-semibold">{t('import.personal')}</h2>
              <FieldGrid>
                <TextField label={t('field.firstName')} value={c.personal.firstName} onChange={setPersonal('firstName')} />
                <TextField label={t('field.lastName')} value={c.personal.lastName} onChange={setPersonal('lastName')} />
              </FieldGrid>
              <TextField label={t('field.jobTitle')} value={c.personal.jobTitle} onChange={setPersonal('jobTitle')} />
              <FieldGrid>
                <TextField label={t('field.email')} value={c.personal.email} onChange={setPersonal('email')} />
                <TextField label={t('field.phone')} value={c.personal.phone} onChange={setPersonal('phone')} />
              </FieldGrid>
              <TextField label={t('field.city')} value={c.personal.city} onChange={setPersonal('city')} />
            </Card>
            <Card className="space-y-3 p-5">
              <TextField label={t('new.titleLabel')} value={title} onChange={setTitle} maxLength={150} />
              {!result.meta ? (
                <>
                  <span className="block text-sm font-medium">{t('new.template')}</span>
                  <TemplatePicker value={templateKey} onChange={setTemplateKey} columns="grid-cols-3" compact />
                </>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={create} loading={busy}>
                  {t('import.create')}
                </Button>
                <Button variant="ghost" onClick={() => setResult(null)}>
                  {t('import.another')}
                </Button>
              </div>
            </Card>
          </div>
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="overflow-hidden rounded-lg shadow-[var(--shadow-page)]">
              <ScaledPage>
                <ResumeDocument
                  data={{ ...preview, design: preview.design ?? getTemplateMeta(preview.templateKey).defaultDesign }}
                  pageWrapper={(page, i) => (i === 0 ? page : null)}
                />
              </ScaledPage>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
