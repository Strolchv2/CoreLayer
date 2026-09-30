import type { BackupDTO } from '@cv-studio/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseBackup, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { IconButton } from '../../components/ui/IconButton';
import { Card, formatBytes } from '../../components/ui/misc';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';

export function AdminBackups() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({ queryKey: ['admin', 'backups'], queryFn: () => api.get<{ backups: BackupDTO[]; directory: string }>('/api/admin/backups') });

  const create = async () => {
    setBusy(true);
    try {
      await api.post('/api/admin/backups');
      toast.success(t('admin.backups.created'));
      await qc.invalidateQueries({ queryKey: ['admin', 'backups'] });
    } catch (err) {
      toast.error(errorMessage(err, t, 'errors.backup_failed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (b: BackupDTO) => {
    if (!(await confirm({ title: t('admin.backups.deleteTitle'), description: b.name, confirmLabel: t('common.delete'), destructive: true }))) return;
    try {
      await api.delete(`/api/admin/backups/${encodeURIComponent(b.name)}`);
      await qc.invalidateQueries({ queryKey: ['admin', 'backups'] });
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{t('admin.backups.text')}</p>
          {data?.directory ? <p className="mt-1 font-mono text-xs text-muted-foreground">{t('admin.backups.directory', { dir: data.directory })}</p> : null}
        </div>
        <Button icon={<DatabaseBackup className="h-4 w-4" />} onClick={create} loading={busy}>
          {t('admin.backups.create')}
        </Button>
      </Card>
      <Card className="divide-y">
        {data?.backups.length ? (
          data.backups.map((b) => (
            <div key={b.name} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-mono">{b.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(b.createdAt, locale)} · {formatBytes(b.sizeBytes)}
                </div>
              </div>
              <IconButton label={t('common.delete')} onClick={() => void remove(b)}>
                <Trash2 />
              </IconButton>
            </div>
          ))
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t('admin.backups.empty')}</p>
        )}
      </Card>
    </div>
  );
}
