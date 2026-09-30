import type { ResumeDTO } from '@cv-studio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, Download, FileJson, FileText, FileType2, Package, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { IconButton } from '../components/ui/IconButton';
import { Menu } from '../components/ui/Menu';
import { PageSpinner } from '../components/ui/Spinner';
import { useI18n } from '../i18n';
import { api, ApiError, saveBlob } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { relativeTime } from '../lib/format';
import { useResume } from '../lib/queries';
import { ResumeDocument } from '../render/ResumeDocument';
import { ContentPanel } from './content/ContentPanel';
import { EditorProvider, useEditor, useEditorStore } from './EditorContext';
import { EDITOR_ICONS, EditorLayout } from './EditorLayout';
import { AttachmentsPanel } from './panels/AttachmentsPanel';
import { CheckPanel } from './panels/CheckPanel';
import { DesignPanel } from './panels/DesignPanel';
import { ExportDialog } from './panels/ExportDialog';
import { PreviewPanel } from './panels/PreviewPanel';
import { SaveIndicator } from './SaveIndicator';
import { createEditorStore, type EditorDoc, type EditorStore } from './store';
import { clearDraft, readDraft, useAutosave, type DraftBackup } from './useAutosave';

function toDoc(r: ResumeDTO): EditorDoc {
  return {
    kind: 'resume',
    id: r.id,
    title: r.title,
    description: '',
    language: r.language,
    templateKey: r.templateKey,
    design: r.design,
    dateFormat: r.dateFormat,
    attachmentIds: r.attachmentIds,
    content: r.content,
  };
}

async function saveResume(doc: EditorDoc, version: number) {
  return api.put<{ version: number; updatedAt: string }>(`/api/resumes/${doc.id}`, {
    title: doc.title,
    language: doc.language,
    templateKey: doc.templateKey,
    design: doc.design,
    dateFormat: doc.dateFormat,
    content: doc.content,
    attachmentIds: doc.attachmentIds,
    version,
  });
}

function TitleInput() {
  const t = useI18n().t;
  const title = useEditor((s) => s.doc.title);
  const update = useEditorStore().getState().update;
  return (
    <input
      value={title}
      onChange={(e) => update((d) => void (d.title = e.target.value.slice(0, 150)))}
      onBlur={(e) => !e.target.value.trim() && update((d) => void (d.title = t('new.defaultTitle')))}
      aria-label={t('resumes.titleLabel')}
      className="min-w-0 max-w-[16rem] flex-1 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold hover:border-input focus:border-ring focus:bg-card focus:outline-none sm:max-w-sm"
    />
  );
}

function EditorView({ store, resumeId }: { store: EditorStore; resumeId: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [mobileTab, setMobileTab] = useState('content');
  const [exportOpen, setExportOpen] = useState(false);
  const [conflictBusy, setConflictBusy] = useState(false);
  const { saveNow } = useAutosave(store, saveResume);
  const doc = useEditor((s) => s.doc);
  const saveState = useEditor((s) => s.saveState);
  const imported = params.get('import') === '1';

  const flush = useCallback(async () => {
    await saveNow();
    const s = store.getState();
    if (s.revision !== s.savedRevision) await saveNow();
    await qc.invalidateQueries({ queryKey: ['resumes'] });
  }, [saveNow, store, qc]);

  const renderData = useMemo(
    () => ({
      content: doc.content,
      design: doc.design,
      templateKey: doc.templateKey,
      language: doc.language,
      dateFormat: doc.dateFormat,
      photoUrl: doc.content.personal.photoId ? `/api/documents/${doc.content.personal.photoId}/file` : null,
    }),
    [doc.content, doc.design, doc.templateKey, doc.language, doc.dateFormat],
  );

  const download = async (kind: 'docx' | 'json') => {
    const id = toast.loading(t('export.generating'));
    try {
      await flush();
      const { blob, fileName } = kind === 'docx' ? await api.download('POST', `/api/resumes/${resumeId}/export/docx`) : await api.download('GET', `/api/resumes/${resumeId}/export/json`);
      saveBlob(blob, fileName);
      toast.success(kind === 'docx' ? t('export.docxDone') : t('export.done'), { id });
    } catch (err) {
      toast.error(errorMessage(err, t), { id });
    }
  };

  const resolveConflict = async (keepMine: boolean) => {
    setConflictBusy(true);
    try {
      const server = await api.get<{ resume: ResumeDTO }>(`/api/resumes/${resumeId}`);
      if (keepMine) {
        const s = store.getState();
        const res = await saveResume(s.doc, server.resume.version);
        s.markSaved(res.version, s.revision, res.updatedAt);
        clearDraft('resume', resumeId);
      } else {
        store.getState().replaceDoc(toDoc(server.resume), server.resume.version);
        clearDraft('resume', resumeId);
      }
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setConflictBusy(false);
    }
  };

  const name = { first: doc.content.personal.firstName, last: doc.content.personal.lastName };

  const header = (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card/80 px-2 backdrop-blur sm:px-3">
      <IconButton
        label={t('editor.back')}
        onClick={async () => {
          await flush().catch(() => undefined);
          navigate('/lebenslaeufe');
        }}
      >
        <ArrowLeft />
      </IconButton>
      <TitleInput />
      <SaveIndicator onRetry={() => void saveNow()} />
      <div className="ml-auto flex items-center gap-1.5">
        <span className="hidden md:block">
          <Button
            variant="ghost"
            size="sm"
            icon={<FileText className="h-4 w-4" />}
            onClick={async () => {
              await flush().catch(() => undefined);
              window.open(`/api/resumes/${resumeId}/preview`, '_blank', 'noopener');
            }}
          >
            {t('editor.pdfPreview')}
          </Button>
        </span>
        <div className="flex">
          <Button size="sm" className="rounded-r-none" icon={<Download className="h-4 w-4" />} onClick={() => setExportOpen(true)} data-testid="export-button">
            <span className="hidden sm:inline">{t('editor.exportPdf')}</span>
            <span className="sm:hidden">PDF</span>
          </Button>
          <Menu
            trigger={
              <Button size="sm" className="rounded-l-none border-l border-white/20 px-2" aria-label={t('editor.moreExport')}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            }
            items={[
              { label: t('editor.exportPackage'), icon: <Package />, onSelect: () => setExportOpen(true) },
              { label: t('editor.exportDocx'), icon: <FileType2 />, onSelect: () => void download('docx') },
              { label: t('editor.exportJson'), icon: <FileJson />, onSelect: () => void download('json') },
              { label: t('editor.pdfPreview'), icon: <FileText />, onSelect: () => window.open(`/api/resumes/${resumeId}/preview`, '_blank', 'noopener') },
            ]}
          />
        </div>
      </div>
    </header>
  );

  const banner = (
    <>
      {imported ? (
        <div className="flex items-center justify-between gap-3 border-b bg-warning/10 px-4 py-2 text-sm">
          <span className="flex items-center gap-2 text-warning">
            <TriangleAlert className="h-4 w-4 shrink-0" /> {t('editor.importBanner')}
          </span>
          <button className="text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setParams({})}>
            {t('common.close')}
          </button>
        </div>
      ) : null}
      {saveState === 'error' ? <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">{t('editor.save.errorText')}</div> : null}
    </>
  );

  return (
    <>
      <EditorLayout
        header={header}
        banner={banner}
        content={<ContentPanel />}
        preview={
          <PreviewPanel
            data={renderData}
            render={(data, wrap, onLayout) => <ResumeDocument data={data} onLayout={onLayout} pageWrapper={(page, index) => wrap(page, index)} />}
          />
        }
        side={[
          { key: 'design', label: 'editor.tab.design', icon: EDITOR_ICONS.design, content: <DesignPanel /> },
          { key: 'check', label: 'editor.tab.check', icon: EDITOR_ICONS.check, content: <CheckPanel onJump={() => setMobileTab('content')} /> },
          { key: 'attachments', label: 'editor.tab.attachments', icon: EDITOR_ICONS.attachments, content: <AttachmentsPanel /> },
        ]}
        mobileTab={mobileTab}
        onMobileTabChange={setMobileTab}
      />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        resumeId={resumeId}
        preselectedDocumentIds={doc.attachmentIds}
        fullName={name}
        language={doc.language}
        beforeExport={flush}
      />
      <Dialog
        open={saveState === 'conflict'}
        onOpenChange={() => undefined}
        title={t('editor.conflict.title')}
        description={t('editor.conflict.text')}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => void resolveConflict(false)} disabled={conflictBusy}>
              {t('editor.conflict.loadServer')}
            </Button>
            <Button onClick={() => void resolveConflict(true)} loading={conflictBusy}>
              {t('editor.conflict.keepMine')}
            </Button>
          </>
        }
      />
    </>
  );
}

/** Lebenslauf-Editor: Formular | Live-Vorschau | Design & Check */
export default function ResumeEditorPage() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const { data, error, isLoading } = useResume(id);
  const [store, setStore] = useState<EditorStore | null>(null);
  const [draft, setDraft] = useState<DraftBackup | null>(null);

  useEffect(() => {
    if (!data) return;
    setStore(createEditorStore(toDoc(data), data.version));
    const local = readDraft('resume', data.id);
    if (local && JSON.stringify(local.doc) !== JSON.stringify(toDoc(data))) setDraft(local);
    else if (local) clearDraft('resume', data.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

  if (isLoading) return <PageSpinner />;
  if (error || !data) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground">{notFound ? t('editor.notFound') : t('editor.loadFailed')}</p>
        <Link to="/lebenslaeufe">
          <Button variant="outline">{t('editor.back')}</Button>
        </Link>
      </div>
    );
  }
  if (!store) return <PageSpinner />;

  return (
    <EditorProvider store={store}>
      <EditorView store={store} resumeId={data.id} />
      <Dialog
        open={Boolean(draft)}
        onOpenChange={(o) => !o && setDraft(null)}
        title={t('editor.restore.title')}
        description={draft ? t('editor.restore.text', { time: relativeTime(draft.savedAt, t, locale) }) : ''}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                clearDraft('resume', data.id);
                setDraft(null);
              }}
            >
              {t('editor.restore.discard')}
            </Button>
            <Button
              onClick={() => {
                if (draft) store.getState().update((d) => Object.assign(d, draft.doc));
                setDraft(null);
              }}
            >
              {t('editor.restore.apply')}
            </Button>
          </>
        }
      />
    </EditorProvider>
  );
}
