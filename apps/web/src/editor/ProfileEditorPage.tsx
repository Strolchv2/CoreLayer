import { getTemplateMeta, type ProfileDTO } from '@cv-studio/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FilePlus2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { IconButton } from '../components/ui/IconButton';
import { Input, Textarea } from '../components/ui/Input';
import { PageSpinner } from '../components/ui/Spinner';
import { useI18n } from '../i18n';
import { api, ApiError } from '../lib/api';
import { qk } from '../lib/queries';
import { ResumeDocument } from '../render/ResumeDocument';
import { ContentPanel } from './content/ContentPanel';
import { EditorProvider, useEditor, useEditorStore } from './EditorContext';
import { EDITOR_ICONS, EditorLayout } from './EditorLayout';
import { CheckPanel } from './panels/CheckPanel';
import { PreviewPanel } from './panels/PreviewPanel';
import { SaveIndicator } from './SaveIndicator';
import { createEditorStore, type EditorDoc, type EditorStore } from './store';
import { useAutosave } from './useAutosave';

function toDoc(p: ProfileDTO, locale: 'de' | 'en'): EditorDoc {
  return {
    kind: 'profile',
    id: p.id,
    title: p.name,
    description: p.description,
    language: locale,
    templateKey: 'modern',
    design: getTemplateMeta('modern').defaultDesign,
    dateFormat: 'MM/YYYY',
    attachmentIds: [],
    content: p.content,
  };
}

const saveProfile = (doc: EditorDoc, version: number) =>
  api.put<{ version: number; updatedAt: string }>(`/api/profiles/${doc.id}`, { name: doc.title.trim() || 'Profil', description: doc.description, content: doc.content, version });

function ProfileMeta({ profileId }: { profileId: string }) {
  const { t } = useI18n();
  const title = useEditor((s) => s.doc.title);
  const description = useEditor((s) => s.doc.description);
  const update = useEditorStore().getState().update;
  return (
    <div className="space-y-4">
      <FormField label={t('editor.profileName')} required>
        <Input value={title} maxLength={100} onChange={(e) => update((d) => void (d.title = e.target.value))} />
      </FormField>
      <FormField label={t('editor.profileDescription')}>
        <Textarea value={description} maxLength={300} rows={3} onChange={(e) => update((d) => void (d.description = e.target.value))} />
      </FormField>
      <Link to={`/lebenslaeufe/neu?profil=${profileId}`}>
        <Button className="w-full" icon={<FilePlus2 className="h-4 w-4" />}>
          {t('editor.createResumeFromProfile')}
        </Button>
      </Link>
    </div>
  );
}

function ProfileView({ store, profileId }: { store: EditorStore; profileId: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('content');
  const { saveNow } = useAutosave(store, saveProfile);
  const doc = useEditor((s) => s.doc);
  const renderData = useMemo(
    () => ({ content: doc.content, design: doc.design, templateKey: doc.templateKey, language: doc.language, dateFormat: doc.dateFormat, photoUrl: doc.content.personal.photoId ? `/api/documents/${doc.content.personal.photoId}/file` : null }),
    [doc],
  );
  return (
    <EditorLayout
      header={
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card/80 px-3">
          <IconButton
            label={t('editor.back')}
            onClick={async () => {
              await saveNow();
              await qc.invalidateQueries({ queryKey: qk.profiles });
              navigate('/profile');
            }}
          >
            <ArrowLeft />
          </IconButton>
          <span className="truncate text-sm font-semibold">
            {t('editor.profileMeta')}: {doc.title}
          </span>
          <SaveIndicator onRetry={() => void saveNow()} />
        </header>
      }
      content={<ContentPanel />}
      preview={<PreviewPanel data={renderData} render={(data, wrap, onLayout) => <ResumeDocument data={data} onLayout={onLayout} pageWrapper={(p, i) => wrap(p, i)} />} />}
      side={[
        { key: 'design', label: 'editor.profileMeta', icon: EDITOR_ICONS.design, content: <ProfileMeta profileId={profileId} /> },
        { key: 'check', label: 'editor.tab.check', icon: EDITOR_ICONS.check, content: <CheckPanel onJump={() => setTab('content')} /> },
      ]}
      mobileTab={tab}
      onMobileTabChange={setTab}
    />
  );
}

/** Profil-Editor: gleiche Inhaltsverwaltung wie im Lebenslauf, ohne Design. */
export default function ProfileEditorPage() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const { data, error, isLoading } = useQuery({
    queryKey: qk.profile(id),
    queryFn: () => api.get<{ profile: ProfileDTO }>(`/api/profiles/${id}`).then((r) => r.profile),
    staleTime: Infinity,
    gcTime: 0,
  });
  const [store, setStore] = useState<EditorStore | null>(null);
  useEffect(() => {
    if (data) setStore(createEditorStore(toDoc(data, locale), data.version));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

  if (isLoading) return <PageSpinner />;
  if (error || !data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground">{error instanceof ApiError && error.status === 404 ? t('errors.not_found') : t('errors.generic')}</p>
        <Link to="/profile">
          <Button variant="outline">{t('editor.back')}</Button>
        </Link>
      </div>
    );
  }
  if (!store) return <PageSpinner />;
  return (
    <EditorProvider store={store}>
      <ProfileView store={store} profileId={data.id} />
    </EditorProvider>
  );
}
