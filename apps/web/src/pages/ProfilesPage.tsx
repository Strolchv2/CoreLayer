import type { ProfileDTO, ProfileSummaryDTO } from '@cv-studio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, FilePlus2, MoreHorizontal, Pencil, Plus, Trash2, UserSquare2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { Dialog } from '../components/ui/Dialog';
import { FormField } from '../components/ui/FormField';
import { IconButton } from '../components/ui/IconButton';
import { Input } from '../components/ui/Input';
import { Menu } from '../components/ui/Menu';
import { Card, EmptyState, PageHeader, Skeleton } from '../components/ui/misc';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { relativeTime } from '../lib/format';
import { qk, useProfiles } from '../lib/queries';

export default function ProfilesPage() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { data, isLoading } = useProfiles();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ profile: ProfileDTO }>('/api/profiles', { name: name.trim(), description });
      await qc.invalidateQueries({ queryKey: qk.profiles });
      navigate(`/profile/${res.profile.id}`);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: ProfileSummaryDTO) => {
    if (!(await confirm({ title: t('profiles.deleteTitle'), description: t('profiles.deleteText', { name: p.name }), confirmLabel: t('common.delete'), destructive: true }))) return;
    try {
      await api.delete(`/api/profiles/${p.id}`);
      toast.success(t('profiles.deleted'));
      await qc.invalidateQueries({ queryKey: qk.profiles });
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  const duplicate = async (p: ProfileSummaryDTO) => {
    try {
      await api.post(`/api/profiles/${p.id}/duplicate`);
      await qc.invalidateQueries({ queryKey: qk.profiles });
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  return (
    <AppShell>
      <PageHeader title={t('profiles.title')} description={t('profiles.subtitle')} actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>{t('profiles.new')}</Button>} />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState icon={<UserSquare2 />} title={t('profiles.empty.title')} text={t('profiles.empty.text')} action={<Button onClick={() => setCreating(true)}>{t('profiles.new')}</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <Card key={p.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/profile/${p.id}`} className="block truncate font-semibold hover:text-primary">
                    {p.name}
                  </Link>
                  <p className="truncate text-sm text-muted-foreground">{[p.fullName, p.jobTitle].filter(Boolean).join(' · ') || '—'}</p>
                </div>
                <Menu
                  trigger={
                    <IconButton label={t('common.more')} size="sm" tooltip={false}>
                      <MoreHorizontal />
                    </IconButton>
                  }
                  items={[
                    { label: t('common.edit'), icon: <Pencil />, onSelect: () => navigate(`/profile/${p.id}`) },
                    { label: t('common.duplicate'), icon: <Copy />, onSelect: () => void duplicate(p) },
                    { label: t('common.delete'), icon: <Trash2 />, destructive: true, onSelect: () => void remove(p), separatorBefore: true },
                  ]}
                />
              </div>
              {p.description ? <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{p.description}</p> : null}
              <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
                <span>
                  {t('profiles.resumeCount', { n: p.resumeCount })} · {relativeTime(p.updatedAt, t, locale)}
                </span>
                <Link to={`/lebenslaeufe/neu?profil=${p.id}`}>
                  <Button size="sm" variant="outline" icon={<FilePlus2 className="h-3.5 w-3.5" />}>
                    {t('profiles.createResume')}
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title={t('profiles.new')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={create} loading={busy} disabled={!name.trim()}>
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label={t('profiles.nameLabel')} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('profiles.namePlaceholder')} maxLength={100} autoFocus />
          </FormField>
          <FormField label={t('profiles.descriptionLabel')}>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
          </FormField>
        </div>
      </Dialog>
    </AppShell>
  );
}
