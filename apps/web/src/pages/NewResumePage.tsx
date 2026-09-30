import { TEMPLATE_KEYS, type Locale, type ResumeDTO, type TemplateKey } from '@cv-studio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { FileInput, FilePlus2, Sparkles, UserSquare2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthProvider';
import { TemplatePicker } from '../components/cv/TemplatePicker';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Input, Select } from '../components/ui/Input';
import { Card, PageHeader } from '../components/ui/misc';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { errorMessage } from '../lib/errors';
import { useProfiles } from '../lib/queries';

type Source = 'empty' | 'demo' | 'profile';

function SourceCard({ active, icon, title, text, onClick }: { active: boolean; icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all', active ? 'border-primary ring-2 ring-primary/25' : 'hover:border-primary/40')}
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&>svg]:h-[18px] [&>svg]:w-[18px]', active ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground')}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}

export default function NewResumePage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const initialTemplate = TEMPLATE_KEYS.includes(params.get('vorlage') as TemplateKey) ? (params.get('vorlage') as TemplateKey) : 'modern';
  const initialProfile = params.get('profil');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<Locale>(locale);
  const [source, setSource] = useState<Source>(initialProfile ? 'profile' : 'empty');
  const [profileId, setProfileId] = useState(initialProfile ?? '');
  const [templateKey, setTemplateKey] = useState<TemplateKey>(initialTemplate);
  const [loading, setLoading] = useState(false);
  const { data: profiles } = useProfiles();

  const create = async () => {
    setLoading(true);
    try {
      const body = {
        title: title.trim() || t('new.defaultTitle'),
        language,
        templateKey,
        dateFormat: user?.defaultDateFormat,
        source: source === 'profile' ? { type: 'profile', profileId } : { type: source },
      };
      const res = await api.post<{ resume: ResumeDTO }>('/api/resumes', body);
      await qc.invalidateQueries({ queryKey: ['resumes'] });
      await qc.invalidateQueries({ queryKey: ['dashboard'] });
      navigate(`/editor/${res.resume.id}`);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title={t('new.title')} description={t('new.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="space-y-5 p-5 sm:p-6">
          <FormField label={t('new.titleLabel')} hint={t('new.titleHint')}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('new.titlePlaceholder')} maxLength={150} autoFocus />
          </FormField>
          <FormField label={t('new.languageLabel')}>
            <Select value={language} onChange={(e) => setLanguage(e.target.value as Locale)}>
              <option value="de">{t('common.german')}</option>
              <option value="en">{t('common.english')}</option>
            </Select>
          </FormField>
          <div className="grid gap-3">
            <SourceCard active={source === 'empty'} icon={<FilePlus2 />} title={t('new.source.empty')} text={t('new.source.empty.text')} onClick={() => setSource('empty')} />
            <SourceCard active={source === 'demo'} icon={<Sparkles />} title={t('new.source.demo')} text={t('new.source.demo.text')} onClick={() => setSource('demo')} />
            <SourceCard active={source === 'profile'} icon={<UserSquare2 />} title={t('new.source.profile')} text={t('new.source.profile.text')} onClick={() => setSource('profile')} />
            {source === 'profile' ? (
              profiles?.length ? (
                <FormField label={t('new.chooseProfile')} required>
                  <Select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                    <option value="">–</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : (
                <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {t('new.noProfiles')}{' '}
                  <Link to="/profile" className="text-primary hover:underline">
                    {t('nav.profiles')}
                  </Link>
                </p>
              )
            ) : null}
            <Link to="/lebenslaeufe/import" className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-left transition-colors hover:border-primary/40">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileInput className="h-[18px] w-[18px]" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{t('new.source.import')}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t('new.source.import.text')}</span>
              </span>
            </Link>
          </div>
          <Button size="lg" className="w-full" onClick={create} loading={loading} disabled={source === 'profile' && !profileId}>
            {t('new.create')}
          </Button>
        </Card>
        <div>
          <h2 className="mb-3 text-sm font-semibold">{t('new.template')}</h2>
          <TemplatePicker value={templateKey} onChange={setTemplateKey} />
        </div>
      </div>
    </AppShell>
  );
}
