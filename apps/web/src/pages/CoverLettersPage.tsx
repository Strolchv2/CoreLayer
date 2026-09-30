import type { CoverLetterDTO } from '@cv-studio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Mail, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { Dialog } from '../components/ui/Dialog';
import { FormField } from '../components/ui/FormField';
import { IconButton } from '../components/ui/IconButton';
import { Checkbox, Input, Select } from '../components/ui/Input';
import { Menu } from '../components/ui/Menu';
import { Card, EmptyState, PageHeader, Skeleton } from '../components/ui/misc';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { relativeTime } from '../lib/format';
import { qk, useCoverLetters, useResumes } from '../lib/queries';

export default function CoverLettersPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { data, isLoading } = useCoverLetters();
  const { data: resumes } = useResumes('active');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const linked = resumes?.find((r) => r.id === resumeId);
      const res = await api.post<{ coverLetter: CoverLetterDTO }>('/api/cover-letters', {
        title: title.trim() || t('letters.newTitle'),
        resumeId: resumeId || null,
        language: linked?.language ?? locale,
        demo,
      });
      await qc.invalidateQueries({ queryKey: qk.coverLetters });
      navigate(`/anschreiben/${res.coverLetter.id}`);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, letterTitle: string) => {
    if (!(await confirm({ title: t('letters.deleteTitle'), description: t('letters.deleteText', { title: letterTitle }), confirmLabel: t('common.delete'), destructive: true }))) return;
    try {
      await api.delete(`/api/cover-letters/${id}`);
      toast.success(t('letters.deleted'));
      await qc.invalidateQueries({ queryKey: qk.coverLetters });
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  return (
    <AppShell>
      <PageHeader title={t('letters.title')} description={t('letters.subtitle')} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>{t('letters.new')}</Button>} />
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !data?.length ? (
        <EmptyState icon={<Mail />} title={t('letters.empty.title')} text={t('letters.empty.text')} action={<Button onClick={() => setOpen(true)}>{t('letters.new')}</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((l) => (
            <Card key={l.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/anschreiben/${l.id}`} className="block truncate font-semibold hover:text-primary">
                    {l.title}
                  </Link>
                  <p className="truncate text-sm text-muted-foreground">{l.subject || l.company || '—'}</p>
                </div>
                <Menu
                  trigger={
                    <IconButton label={t('common.more')} size="sm" tooltip={false}>
                      <MoreHorizontal />
                    </IconButton>
                  }
                  items={[
                    { label: t('common.edit'), icon: <Pencil />, onSelect: () => navigate(`/anschreiben/${l.id}`) },
                    {
                      label: t('common.duplicate'),
                      icon: <Copy />,
                      onSelect: async () => {
                        await api.post(`/api/cover-letters/${l.id}/duplicate`).catch((err) => toast.error(errorMessage(err, t)));
                        await qc.invalidateQueries({ queryKey: qk.coverLetters });
                      },
                    },
                    { label: t('common.delete'), icon: <Trash2 />, destructive: true, onSelect: () => void remove(l.id, l.title), separatorBefore: true },
                  ]}
                />
              </div>
              <div className="mt-auto pt-4 text-xs text-muted-foreground">
                {l.resumeTitle ? `${t('letters.linkedTo', { title: l.resumeTitle })} · ` : ''}
                {relativeTime(l.updatedAt, t, locale)}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('letters.newTitle')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={create} loading={busy}>
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label={t('letters.titleLabel')}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('letters.titlePlaceholder')} maxLength={150} autoFocus />
          </FormField>
          <FormField label={t('letters.linkResume')} hint={t('letters.linkResumeHint')}>
            <Select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              <option value="">{t('letters.noResume')}</option>
              {resumes?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={demo} onChange={(e) => setDemo(e.target.checked)} />
            {t('letters.withExample')}
          </label>
        </div>
      </Dialog>
    </AppShell>
  );
}
