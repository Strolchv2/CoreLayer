import type { AuditLogEntryDTO, Paginated } from '@cv-studio/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/misc';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

export function AdminLogs() {
  const { t, locale } = useI18n();
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ['admin', 'logs', page, action],
    queryFn: () => api.get<Paginated<AuditLogEntryDTO>>(`/api/admin/logs?${new URLSearchParams({ page: String(page), action })}`),
    placeholderData: keepPreviousData,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="space-y-4">
      <Input value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder={t('admin.logs.filter')} className="sm:max-w-sm" aria-label={t('admin.logs.filter')} />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('admin.logs.time')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.logs.action')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.logs.user')}</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">{t('admin.logs.details')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((e) => (
                <tr key={e.id} className="border-b last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDateTime(e.createdAt, locale)}</td>
                  <td className="px-4 py-2.5">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{e.action}</code>
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-2.5 text-muted-foreground">{e.userEmail ?? (e.userId ? e.userId.slice(0, 8) : '–')}</td>
                  <td className="hidden max-w-xs truncate px-4 py-2.5 font-mono text-xs text-muted-foreground md:table-cell">{Object.keys(e.meta).length ? JSON.stringify(e.meta) : ''}</td>
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
