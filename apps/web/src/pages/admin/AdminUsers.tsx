import type { AdminUserDTO, Paginated } from '@cv-studio/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, MoreHorizontal, Shield, ShieldOff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { IconButton } from '../../components/ui/IconButton';
import { Input, Select } from '../../components/ui/Input';
import { Menu } from '../../components/ui/Menu';
import { Badge, Card } from '../../components/ui/misc';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';

export function AdminUsers() {
  const { t, locale } = useI18n();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'blocked'>('all');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), search, status });
  const { data } = useQuery({
    queryKey: ['admin', 'users', page, search, status],
    queryFn: () => api.get<Paginated<AdminUserDTO>>(`/api/admin/users?${params}`),
    placeholderData: keepPreviousData,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const update = async (u: AdminUserDTO, body: { status?: 'active' | 'blocked'; role?: 'user' | 'admin' }) => {
    try {
      await api.patch(`/api/admin/users/${u.id}`, body);
      toast.success(t('admin.users.updated'));
      await qc.invalidateQueries({ queryKey: ['admin'] });
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  const remove = async (u: AdminUserDTO) => {
    if (!(await confirm({ title: t('admin.users.delete'), description: t('admin.users.deleteText', { email: u.email }), confirmLabel: t('common.delete'), destructive: true }))) return;
    try {
      await api.delete(`/api/admin/users/${u.id}`);
      await qc.invalidateQueries({ queryKey: ['admin'] });
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t('admin.users.search')}
          className="sm:max-w-sm"
          aria-label={t('admin.users.search')}
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(1);
          }}
          className="sm:w-44"
          aria-label={t('admin.users.status')}
        >
          <option value="all">{t('common.all')}</option>
          <option value="active">{t('admin.users.status.active')}</option>
          <option value="blocked">{t('admin.users.status.blocked')}</option>
        </Select>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('admin.users.email')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.users.role')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.users.status')}</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">{t('admin.users.created')}</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">{t('admin.users.lastLogin')}</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">{t('admin.users.content')}</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.items.map((u) => (
                <tr key={u.id} className="border-b last:border-b-0">
                  <td className="max-w-[16rem] px-4 py-3">
                    <div className="truncate font-medium">{u.email}</div>
                    {u.displayName ? <div className="truncate text-xs text-muted-foreground">{u.displayName}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.role === 'admin' ? 'primary' : 'neutral'}>{t(u.role === 'admin' ? 'admin.users.role.admin' : 'admin.users.role.user')}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.status === 'active' ? 'success' : 'danger'}>{t(u.status === 'active' ? 'admin.users.status.active' : 'admin.users.status.blocked')}</Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{formatDateTime(u.createdAt, locale)}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{formatDateTime(u.lastLoginAt, locale)}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{t('admin.users.counts', { resumes: u.resumeCount, documents: u.documentCount })}</td>
                  <td className="px-2 py-3 text-right">
                    {u.id !== me?.id ? (
                      <Menu
                        trigger={
                          <IconButton label={t('common.more')} size="sm" tooltip={false}>
                            <MoreHorizontal />
                          </IconButton>
                        }
                        items={[
                          u.status === 'active'
                            ? { label: t('admin.users.block'), icon: <Ban />, onSelect: () => void update(u, { status: 'blocked' }) }
                            : { label: t('admin.users.unblock'), icon: <CheckCircle2 />, onSelect: () => void update(u, { status: 'active' }) },
                          u.role === 'admin'
                            ? { label: t('admin.users.makeUser'), icon: <ShieldOff />, onSelect: () => void update(u, { role: 'user' }) }
                            : { label: t('admin.users.makeAdmin'), icon: <Shield />, onSelect: () => void update(u, { role: 'admin' }) },
                          { label: t('admin.users.delete'), icon: <Trash2 />, destructive: true, separatorBefore: true, onSelect: () => void remove(u) },
                        ]}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{t('admin.pagination', { page, pages })}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('common.back')}
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            {t('common.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
