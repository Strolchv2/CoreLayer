import {
  CAREER_FIELDS,
  createDemoContent,
  createEmptyContent,
  createItem,
  createId,
  type CareerField,
  type ImportResultDTO,
  type ResumeContent,
  type ResumeDTO,
  type TemplateKey,
} from '@cv-studio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle2, FileInput, FilePlus2, PartyPopper, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthProvider';
import { ImportUpload } from '../components/cv/ImportUpload';
import { TemplatePicker } from '../components/cv/TemplatePicker';
import { Logo } from '../components/layout/Logo';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Checkbox } from '../components/ui/Input';
import { DateField, FieldGrid, TextAreaField, TextField } from '../editor/fields/Fields';
import { useI18n, type MessageKey } from '../i18n';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { errorMessage } from '../lib/errors';

type Method = 'scratch' | 'template' | 'import';

const RECOMMENDED: Record<CareerField, TemplateKey> = {
  trades: 'classic',
  it: 'technical',
  engineering: 'technical',
  business: 'professional',
  healthcare: 'classic',
  sales: 'modern',
  management: 'executive',
  education: 'elegant',
  other: 'modern',
};

const SKILL_GROUPS: Record<CareerField, { de: string[]; en: string[] }> = {
  trades: { de: ['Fachkenntnisse', 'Werkzeuge & Maschinen'], en: ['Technical skills', 'Tools & machines'] },
  it: { de: ['Programmiersprachen', 'Frameworks & Tools'], en: ['Programming languages', 'Frameworks & tools'] },
  engineering: { de: ['Fachkenntnisse', 'Software'], en: ['Technical skills', 'Software'] },
  business: { de: ['Fachkenntnisse', 'IT-Kenntnisse'], en: ['Professional skills', 'IT skills'] },
  healthcare: { de: ['Fachkenntnisse', 'Zusatzqualifikationen'], en: ['Clinical skills', 'Additional qualifications'] },
  sales: { de: ['Vertrieb & Marketing', 'Software'], en: ['Sales & marketing', 'Software'] },
  management: { de: ['Führungskompetenzen', 'Methoden'], en: ['Leadership', 'Methods'] },
  education: { de: ['Fachkenntnisse', 'Methoden'], en: ['Subject knowledge', 'Methods'] },
  other: { de: ['Kenntnisse'], en: ['Skills'] },
};

const TOTAL = 6;

function Choice({ active, icon, title, text, onClick }: { active: boolean; icon: ReactNode; title: string; text?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('flex items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-all', active ? 'border-primary ring-2 ring-primary/25' : 'hover:border-primary/40')}
    >
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5', active ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground')}>{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        {text ? <span className="mt-0.5 block text-sm text-muted-foreground">{text}</span> : null}
      </span>
    </button>
  );
}

export default function OnboardingPage() {
  const { t, locale } = useI18n();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState<Method>('scratch');
  const [career, setCareer] = useState<CareerField | null>(null);
  const [content, setContent] = useState<ResumeContent>(() => {
    const c = createEmptyContent();
    c.personal.email = user?.email ?? '';
    return c;
  });
  const [templateKey, setTemplateKey] = useState<TemplateKey>('modern');
  const [imported, setImported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<ResumeDTO | null>(null);
  const fmt = user?.defaultDateFormat ?? 'MM/YYYY';

  const finishOnboarding = async () => {
    const res = await api.patch<{ user: NonNullable<typeof user> }>('/api/account/settings', { onboardingCompleted: true });
    setUser(res.user);
  };

  const skip = async () => {
    await finishOnboarding().catch(() => undefined);
    navigate('/dashboard');
  };

  const chooseMethod = (m: Method) => {
    setMethod(m);
    if (m === 'template') {
      const demo = createDemoContent(locale);
      setContent(demo);
    } else if (m === 'scratch' && !imported) {
      const c = createEmptyContent();
      c.personal.email = user?.email ?? '';
      setContent(c);
    }
  };

  const chooseCareer = (field: CareerField) => {
    setCareer(field);
    setTemplateKey(RECOMMENDED[field]);
    if (method !== 'template' && content.skills.length === 0) {
      setContent((c) => ({ ...c, skills: SKILL_GROUPS[field][locale].map((name) => ({ id: createId(), visible: true, name, items: [] })) }));
    }
  };

  const setPersonal = (key: keyof ResumeContent['personal']) => (value: string) => setContent((c) => ({ ...c, personal: { ...c.personal, [key]: value } }));

  const updateList = <K extends 'experience' | 'education'>(key: K, id: string, patch: Partial<ResumeContent[K][number]>) =>
    setContent((c) => ({ ...c, [key]: (c[key] as { id: string }[]).map((i) => (i.id === id ? { ...i, ...patch } : i)) }));

  const create = async () => {
    setBusy(true);
    try {
      const title = content.personal.jobTitle.trim() ? `${locale === 'en' ? 'CV' : 'Lebenslauf'} ${content.personal.jobTitle.trim()}`.slice(0, 150) : t('new.defaultTitle');
      const cleaned: ResumeContent = {
        ...content,
        experience: content.experience.filter((e) => e.jobTitle.trim() || e.employer.trim()),
        education: content.education.filter((e) => e.institution.trim() || e.degree.trim()),
      };
      const res = await api.post<{ resume: ResumeDTO }>('/api/resumes', {
        title,
        language: locale,
        templateKey,
        dateFormat: fmt,
        source: { type: 'content', content: cleaned },
      });
      await finishOnboarding();
      await qc.invalidateQueries({ queryKey: ['resumes'] });
      setCreated(res.resume);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const onImport = (result: ImportResultDTO) => {
    const c = result.content;
    if (!c.personal.email) c.personal.email = user?.email ?? '';
    setContent(c);
    setImported(true);
    if (result.meta?.templateKey) setTemplateKey(result.meta.templateKey);
    setStep(2);
  };

  if (created) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-success/12 text-success">
          <PartyPopper className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{t('onboarding.done.title')}</h1>
        <p className="mt-3 max-w-md text-muted-foreground">{t('onboarding.done.text')}</p>
        <Button size="lg" className="mt-8" onClick={() => navigate(`/editor/${created.id}${imported ? '?import=1' : ''}`)}>
          {t('onboarding.done.cta')} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const canNext = step !== 2 || career !== null;
  const titleKey = `onboarding.${step}.title` as MessageKey;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between border-b px-4 sm:px-8">
        <Logo to="/dashboard" />
        <button onClick={skip} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          {t('onboarding.skip')}
        </button>
      </header>
      <div className="h-1 bg-muted">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(step / TOTAL) * 100}%` }} />
      </div>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm font-medium text-primary">{t('onboarding.step', { n: step, total: TOTAL })}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{t(titleKey)}</h1>
        {step >= 2 && step <= 6 ? <p className="mt-2 text-muted-foreground">{t(`onboarding.${step}.text` as MessageKey)}</p> : null}

        <div className="mt-8">
          {step === 1 ? (
            <div className="space-y-3">
              <Choice active={method === 'scratch'} icon={<FilePlus2 />} title={t('onboarding.1.scratch')} text={t('onboarding.1.scratch.text')} onClick={() => chooseMethod('scratch')} />
              <Choice active={method === 'template'} icon={<Sparkles />} title={t('onboarding.1.template')} text={t('onboarding.1.template.text')} onClick={() => chooseMethod('template')} />
              <Choice active={method === 'import'} icon={<FileInput />} title={t('onboarding.1.import')} text={t('onboarding.1.import.text')} onClick={() => chooseMethod('import')} />
              {method === 'import' ? (
                <div className="pt-3">
                  <p className="mb-3 text-sm text-muted-foreground">{t('onboarding.importHint')}</p>
                  <ImportUpload onResult={onImport} />
                </div>
              ) : null}
            </div>
          ) : step === 2 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {CAREER_FIELDS.map((f) => (
                <Choice key={f} active={career === f} icon={<CheckCircle2 />} title={t(`career.${f}` as MessageKey)} onClick={() => chooseCareer(f)} />
              ))}
            </div>
          ) : step === 3 ? (
            <div className="space-y-4">
              <FieldGrid>
                <TextField label={t('field.firstName')} value={content.personal.firstName} onChange={setPersonal('firstName')} required autoFocus />
                <TextField label={t('field.lastName')} value={content.personal.lastName} onChange={setPersonal('lastName')} required />
              </FieldGrid>
              <TextField label={t('field.jobTitle')} value={content.personal.jobTitle} onChange={setPersonal('jobTitle')} />
              <FieldGrid>
                <TextField label={t('field.email')} type="email" value={content.personal.email} onChange={setPersonal('email')} />
                <TextField label={t('field.phone')} type="tel" value={content.personal.phone} onChange={setPersonal('phone')} />
              </FieldGrid>
              <FieldGrid>
                <TextField label={t('field.postalCode')} value={content.personal.postalCode} onChange={setPersonal('postalCode')} />
                <TextField label={t('field.city')} value={content.personal.city} onChange={setPersonal('city')} />
              </FieldGrid>
            </div>
          ) : step === 4 ? (
            <div className="space-y-4">
              {content.experience.map((e, i) => (
                <div key={e.id} className="space-y-3 rounded-2xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">#{i + 1}</span>
                    <IconButton label={t('common.remove')} size="sm" onClick={() => setContent((c) => ({ ...c, experience: c.experience.filter((x) => x.id !== e.id) }))}>
                      <Trash2 />
                    </IconButton>
                  </div>
                  <FieldGrid>
                    <TextField label={t('field.position')} value={e.jobTitle} onChange={(v) => updateList('experience', e.id, { jobTitle: v })} />
                    <TextField label={t('field.employer')} value={e.employer} onChange={(v) => updateList('experience', e.id, { employer: v })} />
                  </FieldGrid>
                  <FieldGrid cols={3}>
                    <TextField label={t('field.location')} value={e.location} onChange={(v) => updateList('experience', e.id, { location: v })} />
                    <DateField label={t('field.start')} value={e.startDate} onChange={(v) => updateList('experience', e.id, { startDate: v })} format={fmt} />
                    <DateField label={t('field.end')} value={e.endDate} onChange={(v) => updateList('experience', e.id, { endDate: v })} format={fmt} disabled={e.current} />
                  </FieldGrid>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={e.current} onChange={(ev) => updateList('experience', e.id, { current: ev.target.checked, endDate: ev.target.checked ? '' : e.endDate })} />
                    {t('field.current')}
                  </label>
                  <TextAreaField label={t('field.description')} value={e.description} onChange={(v) => updateList('experience', e.id, { description: v })} rows={3} />
                </div>
              ))}
              <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setContent((c) => ({ ...c, experience: [...c.experience, createItem('experience')] }))}>
                {content.experience.length ? t('onboarding.addAnother') : t('editor.item.add', { section: t('field.position') })}
              </Button>
            </div>
          ) : step === 5 ? (
            <div className="space-y-4">
              {content.education.map((e, i) => (
                <div key={e.id} className="space-y-3 rounded-2xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">#{i + 1}</span>
                    <IconButton label={t('common.remove')} size="sm" onClick={() => setContent((c) => ({ ...c, education: c.education.filter((x) => x.id !== e.id) }))}>
                      <Trash2 />
                    </IconButton>
                  </div>
                  <TextField label={t('field.institution')} value={e.institution} onChange={(v) => updateList('education', e.id, { institution: v })} />
                  <FieldGrid>
                    <TextField label={t('field.degree')} value={e.degree} onChange={(v) => updateList('education', e.id, { degree: v })} />
                    <TextField label={t('field.fieldOfStudy')} value={e.fieldOfStudy} onChange={(v) => updateList('education', e.id, { fieldOfStudy: v })} />
                  </FieldGrid>
                  <FieldGrid>
                    <DateField label={t('field.start')} value={e.startDate} onChange={(v) => updateList('education', e.id, { startDate: v })} format={fmt} />
                    <DateField label={t('field.end')} value={e.endDate} onChange={(v) => updateList('education', e.id, { endDate: v })} format={fmt} />
                  </FieldGrid>
                </div>
              ))}
              <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setContent((c) => ({ ...c, education: [...c.education, createItem('education')] }))}>
                {t('editor.item.add', { section: t('field.degree') })}
              </Button>
            </div>
          ) : (
            <TemplatePicker value={templateKey} onChange={setTemplateKey} />
          )}
        </div>

        <div className="mt-10 flex items-center justify-between gap-3 border-t pt-6">
          {step > 1 ? (
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setStep((s) => s - 1)}>
              {t('common.back')}
            </Button>
          ) : (
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => void finishOnboarding().catch(() => undefined)}>
              {t('onboarding.skip')}
            </Link>
          )}
          {step < TOTAL ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext || (step === 1 && method === 'import' && !imported)}
            >
              {t('common.next')} <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={create} loading={busy}>
              {t('common.finish')}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
