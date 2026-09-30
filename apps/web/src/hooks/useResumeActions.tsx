import type { ProfileDTO, ResumeDTO, ResumeSummaryDTO } from '@cv-studio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { ResumeActions } from '../components/cv/ResumeCard';
import { Button } from '../components/ui/Button';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { Dialog } from '../components/ui/Dialog';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { useT } from '../i18n';
import { api, saveBlob } from '../lib/api';
import { errorMessage } from '../lib/errors';

/** Gemeinsame Aktionen für Lebenslauf-Karten (Übersicht & Dashboard). */
export function useResumeActions(): { actions: ResumeActions; dialogs: React.ReactNode } {
  const t = useT();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState<ResumeSummaryDTO | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['resumes'] }), qc.invalidateQueries({ queryKey: ['dashboard'] })]);

  const actions: ResumeActions = {
    onRename: (r) => {
      setRenaming(r);
      setTitle(r.title);
    },
    onDuplicate: async (r) => {
      try {
        await api.post<{ resume: ResumeDTO }>(`/api/resumes/${r.id}/duplicate`);
        toast.success(t('resumes.duplicated'));
        await refresh();
      } catch (err) {
        toast.error(errorMessage(err, t));
      }
    },
    onExport: async (r) => {
      const id = toast.loading(t('export.generating'));
      try {
        const { blob, fileName } = await api.download('POST', `/api/resumes/${r.id}/export/pdf`);
        saveBlob(blob, fileName);
        toast.success(t('export.done'), { id });
        await refresh();
      } catch (err) {
        toast.error(errorMessage(err, t, 'errors.pdf_export_failed'), { id });
      }
    },
    onArchive: async (r, archived) => {
      try {
        await api.patch(`/api/resumes/${r.id}`, { archived });
        toast.success(archived ? t('resumes.archived') : t('resumes.restored'));
        await refresh();
      } catch (err) {
        toast.error(errorMessage(err, t));
      }
    },
    onDelete: async (r) => {
      const ok = await confirm({
        title: t('resumes.deleteTitle'),
        description: t('resumes.deleteText', { title: r.title }),
        confirmLabel: t('common.delete'),
        destructive: true,
      });
      if (!ok) return;
      try {
        await api.delete(`/api/resumes/${r.id}`);
        toast.success(t('resumes.deleted'));
        await refresh();
      } catch (err) {
        toast.error(errorMessage(err, t));
      }
    },
    onSaveAsProfile: async (r) => {
      try {
        const res = await api.post<{ profile: ProfileDTO }>('/api/profiles', { name: r.title.slice(0, 100), fromResumeId: r.id });
        toast.success(t('resumes.profileCreated'));
        await qc.invalidateQueries({ queryKey: ['profiles'] });
        navigate(`/profile/${res.profile.id}`);
      } catch (err) {
        toast.error(errorMessage(err, t));
      }
    },
  };

  const submitRename = async () => {
    if (!renaming || !title.trim()) return;
    setBusy(true);
    try {
      await api.patch(`/api/resumes/${renaming.id}`, { title: title.trim() });
      toast.success(t('resumes.renamed'));
      setRenaming(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const dialogs = (
    <Dialog
      open={Boolean(renaming)}
      onOpenChange={(o) => !o && setRenaming(null)}
      title={t('resumes.renameTitle')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => setRenaming(null)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submitRename} loading={busy} disabled={!title.trim()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submitRename();
        }}
      >
        <FormField label={t('resumes.titleLabel')} required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} autoFocus />
        </FormField>
      </form>
    </Dialog>
  );

  return { actions, dialogs };
}
