import {
  getTemplateMeta,
  normalizeDesign,
  type CoverLetterContent,
  type CoverLetterDTO,
  type CoverLetterRenderData,
  type DocumentDTO,
  type ResumeDTO,
  type TemplateKey,
} from '@cv-studio/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, PenLine, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { TemplatePicker } from '../components/cv/TemplatePicker';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { IconButton } from '../components/ui/IconButton';
import { Input, Select } from '../components/ui/Input';
import { PageSpinner } from '../components/ui/Spinner';
import { Switch } from '../components/ui/Switch';
import { AiAssist } from '../editor/fields/AiAssist';
import { DateField, FieldGrid, TextAreaField, TextField } from '../editor/fields/Fields';
import { EDITOR_ICONS, EditorLayout } from '../editor/EditorLayout';
import { PreviewPanel } from '../editor/panels/PreviewPanel';
import { SaveBadge } from '../editor/SaveIndicator';
import type { SaveState } from '../editor/store';
import { useI18n } from '../i18n';
import { api, ApiError, saveBlob } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { qk, useResumes } from '../lib/queries';
import { CoverLetterDocument } from '../render/CoverLetterDocument';

type Letter = Omit<CoverLetterDTO, 'id' | 'version' | 'createdAt' | 'updatedAt'>;

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card/80 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function LetterForm({ letter, setLetter }: { letter: Letter; setLetter: (fn: (l: Letter) => Letter) => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: resumes } = useResumes('all');
  const signatureInput = useRef<HTMLInputElement>(null);
  const c = letter.content;
  const setContent = (patch: Partial<CoverLetterContent>) => setLetter((l) => ({ ...l, content: { ...l.content, ...patch } }));
  const setSender = (patch: Partial<CoverLetterContent['sender']>) => setContent({ sender: { ...c.sender, ...patch } });
  const setRecipient = (patch: Partial<CoverLetterContent['recipient']>) => setContent({ recipient: { ...c.recipient, ...patch } });

  const uploadSignature = async (file: File) => {
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('category', 'photo');
      form.append('title', 'Unterschrift');
      const res = await api.upload<{ document: DocumentDTO }>('/api/documents', form);
      setContent({ signatureDocumentId: res.document.id });
      await qc.invalidateQueries({ queryKey: qk.documents });
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  return (
    <div className="space-y-3">
      <Box title={t('letters.settings')}>
        <TextField label={t('letters.titleLabel')} value={letter.title} onChange={(v) => setLetter((l) => ({ ...l, title: v.slice(0, 150) }))} required />
        <FieldGrid>
          <FormField label={t('common.language')}>
            <Select value={letter.language} onChange={(e) => setLetter((l) => ({ ...l, language: e.target.value as 'de' | 'en' }))}>
              <option value="de">{t('common.german')}</option>
              <option value="en">{t('common.english')}</option>
            </Select>
          </FormField>
          <FormField label={t('letters.linkResume')}>
            <Select value={letter.resumeId ?? ''} onChange={(e) => setLetter((l) => ({ ...l, resumeId: e.target.value || null, useResumeDesign: Boolean(e.target.value) && l.useResumeDesign }))}>
              <option value="">{t('letters.noResume')}</option>
              {resumes?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
          </FormField>
        </FieldGrid>
        <label className="flex items-center justify-between gap-3 text-sm">
          {t('letters.useResumeDesign')}
          <Switch checked={letter.useResumeDesign} disabled={!letter.resumeId} onCheckedChange={(v) => setLetter((l) => ({ ...l, useResumeDesign: v }))} label={t('letters.useResumeDesign')} />
        </label>
      </Box>

      <Box title={t('letters.sender')}>
        <TextField label={t('field.name')} value={c.sender.name} onChange={(v) => setSender({ name: v })} maxLength={200} />
        <TextField label={t('field.street')} value={c.sender.street} onChange={(v) => setSender({ street: v })} maxLength={200} />
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <TextField label={t('field.postalCode')} value={c.sender.postalCode} onChange={(v) => setSender({ postalCode: v })} maxLength={20} />
          <TextField label={t('field.city')} value={c.sender.city} onChange={(v) => setSender({ city: v })} maxLength={200} />
        </div>
        <FieldGrid>
          <TextField label={t('field.phone')} value={c.sender.phone} onChange={(v) => setSender({ phone: v })} maxLength={40} />
          <TextField label={t('field.email')} value={c.sender.email} onChange={(v) => setSender({ email: v })} maxLength={254} />
        </FieldGrid>
      </Box>

      <Box title={t('letters.recipient')}>
        <TextField label={t('letters.company')} value={c.recipient.company} onChange={(v) => setRecipient({ company: v })} maxLength={200} />
        <FieldGrid>
          <TextField label={t('letters.contactPerson')} value={c.recipient.contactPerson} onChange={(v) => setRecipient({ contactPerson: v })} maxLength={200} />
          <TextField label={t('letters.department')} value={c.recipient.department} onChange={(v) => setRecipient({ department: v })} maxLength={200} />
        </FieldGrid>
        <TextField label={t('field.street')} value={c.recipient.street} onChange={(v) => setRecipient({ street: v })} maxLength={200} />
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <TextField label={t('field.postalCode')} value={c.recipient.postalCode} onChange={(v) => setRecipient({ postalCode: v })} maxLength={20} />
          <TextField label={t('field.city')} value={c.recipient.city} onChange={(v) => setRecipient({ city: v })} maxLength={200} />
        </div>
      </Box>

      <Box title={t('letters.content')}>
        <FieldGrid>
          <TextField label={t('letters.place')} value={c.place} onChange={(v) => setContent({ place: v })} maxLength={200} />
          <div>
            <DateField label={t('letters.date')} value={c.date} onChange={(v) => setContent({ date: v })} format="DD.MM.YYYY" />
            <p className="mt-1 text-xs text-muted-foreground">{t('letters.dateHint')}</p>
          </div>
        </FieldGrid>
        <TextField label={t('letters.subject')} value={c.subject} onChange={(v) => setContent({ subject: v })} maxLength={300} />
        <TextField label={t('letters.salutation')} value={c.salutation} onChange={(v) => setContent({ salutation: v })} maxLength={200} />
        <TextAreaField
          label={t('letters.body')}
          value={c.body}
          onChange={(v) => setContent({ body: v })}
          hint={t('letters.bodyHint')}
          rows={12}
          maxLength={10000}
          action={<AiAssist text={c.body} onApply={(v) => setContent({ body: v })} context="cover_letter" language={letter.language} />}
        />
        <FieldGrid>
          <TextField label={t('letters.closing')} value={c.closing} onChange={(v) => setContent({ closing: v })} maxLength={200} />
          <TextField label={t('letters.signatureName')} value={c.signatureName} onChange={(v) => setContent({ signatureName: v })} maxLength={200} />
        </FieldGrid>
        <div className="space-y-1.5">
          <span className="text-[13px] font-medium">{t('letters.signatureImage')}</span>
          <div className="flex items-center gap-3">
            {c.signatureDocumentId ? (
              <>
                <img src={`/api/documents/${c.signatureDocumentId}/file`} alt="" className="h-12 max-w-[10rem] rounded border bg-white object-contain p-1" />
                <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setContent({ signatureDocumentId: null })}>
                  {t('common.remove')}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" icon={<PenLine className="h-4 w-4" />} onClick={() => signatureInput.current?.click()}>
                {t('letters.signatureUpload')}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('letters.signatureHint')}</p>
          <input ref={signatureInput} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && void uploadSignature(e.target.files[0])} />
        </div>
      </Box>
    </div>
  );
}

function DesignSide({ letter, setLetter }: { letter: Letter; setLetter: (fn: (l: Letter) => Letter) => void }) {
  const { t } = useI18n();
  if (letter.useResumeDesign) return <p className="text-sm text-muted-foreground">{t('letters.useResumeDesign')} ✓</p>;
  return (
    <div className="space-y-4">
      <TemplatePicker
        value={letter.templateKey}
        onChange={(key: TemplateKey) => setLetter((l) => ({ ...l, templateKey: key, design: { ...getTemplateMeta(key).defaultDesign } }))}
        columns="grid-cols-3"
        compact
      />
      <FormField label={t('design.primaryColor')}>
        <Input type="color" value={letter.design.primaryColor} onChange={(e) => setLetter((l) => ({ ...l, design: { ...l.design, primaryColor: e.target.value } }))} className="h-10 w-20 p-1" />
      </FormField>
    </div>
  );
}

export default function CoverLetterEditorPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.coverLetter(id),
    queryFn: () => api.get<{ coverLetter: CoverLetterDTO }>(`/api/cover-letters/${id}`).then((r) => r.coverLetter),
    staleTime: Infinity,
    gcTime: 0,
  });
  const [letter, setLetterState] = useState<Letter | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [tab, setTab] = useState('content');
  const version = useRef(1);
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const timer = useRef<number | null>(null);
  const latest = useRef<Letter | null>(null);

  useEffect(() => {
    if (!query.data) return;
    const { id: _i, version: v, createdAt: _c, updatedAt: _u, ...rest } = query.data;
    version.current = v;
    setLetterState(rest);
    latest.current = rest;
  }, [query.data]);

  const save = useCallback(async () => {
    const current = latest.current;
    if (!current || revision.current === savedRevision.current) return;
    const rev = revision.current;
    setSaveState('saving');
    try {
      const res = await api.put<{ version: number }>(`/api/cover-letters/${id}`, { ...current, version: version.current });
      version.current = res.version;
      savedRevision.current = rev;
      setSaveState(revision.current === rev ? 'saved' : 'dirty');
    } catch (err) {
      setSaveState(err instanceof ApiError && err.code === 'version_conflict' ? 'conflict' : 'error');
    }
  }, [id]);

  const setLetter = useCallback(
    (fn: (l: Letter) => Letter) => {
      setLetterState((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        latest.current = next;
        return next;
      });
      revision.current += 1;
      setSaveState('dirty');
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void save(), 1000);
    },
    [save],
  );

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (revision.current !== savedRevision.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const resumeQuery = useQuery({
    queryKey: ['coverLetterResume', letter?.resumeId],
    queryFn: () => api.get<{ resume: ResumeDTO }>(`/api/resumes/${letter!.resumeId}`).then((r) => r.resume),
    enabled: Boolean(letter?.resumeId),
    staleTime: 60_000,
  });

  const renderData = useMemo<CoverLetterRenderData | null>(() => {
    if (!letter) return null;
    const resume = letter.resumeId ? resumeQuery.data : undefined;
    const useResume = letter.useResumeDesign && resume;
    return {
      content: letter.content,
      design: useResume ? normalizeDesign(resume.design, getTemplateMeta(resume.templateKey).defaultDesign) : letter.design,
      templateKey: useResume ? resume.templateKey : letter.templateKey,
      language: letter.language,
      dateFormat: letter.dateFormat,
      signatureUrl: letter.content.signatureDocumentId ? `/api/documents/${letter.content.signatureDocumentId}/file` : null,
      personal: resume?.content.personal ?? null,
    };
  }, [letter, resumeQuery.data]);

  const exportPdf = async () => {
    const tid = toast.loading(t('export.generating'));
    try {
      await save();
      const { blob, fileName } = await api.download('POST', `/api/cover-letters/${id}/export/pdf`);
      saveBlob(blob, fileName);
      toast.success(t('export.done'), { id: tid });
    } catch (err) {
      toast.error(errorMessage(err, t, 'errors.pdf_export_failed'), { id: tid });
    }
  };

  if (query.isLoading) return <PageSpinner />;
  if (query.error || !letter || !renderData) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground">{t('errors.not_found')}</p>
        <Link to="/anschreiben">
          <Button variant="outline">{t('editor.back')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <EditorLayout
      header={
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card/80 px-3">
          <IconButton
            label={t('editor.back')}
            onClick={async () => {
              await save();
              await qc.invalidateQueries({ queryKey: qk.coverLetters });
              navigate('/anschreiben');
            }}
          >
            <ArrowLeft />
          </IconButton>
          <span className="min-w-0 truncate text-sm font-semibold">{letter.title}</span>
          <SaveBadge state={saveState} onRetry={() => void save()} />
          <div className="ml-auto">
            <Button size="sm" icon={<Download className="h-4 w-4" />} onClick={exportPdf}>
              <span className="hidden sm:inline">{t('editor.exportPdf')}</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </div>
        </header>
      }
      content={<LetterForm letter={letter} setLetter={setLetter} />}
      preview={<PreviewPanel data={renderData} render={(data, wrap, onLayout) => <CoverLetterDocument data={data} onLayout={onLayout} pageWrapper={(p, i) => wrap(p, i)} />} />}
      side={[{ key: 'design', label: 'editor.tab.design', icon: EDITOR_ICONS.design, content: <DesignSide letter={letter} setLetter={setLetter} /> }]}
      mobileTab={tab}
      onMobileTabChange={setTab}
    />
  );
}
