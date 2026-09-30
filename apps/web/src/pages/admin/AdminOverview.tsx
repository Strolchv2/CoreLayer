import { getTemplateMeta, type AdminStatsDTO, type AdminSystemStatusDTO } from '@cv-studio/shared';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, formatBytes, Skeleton } from '../../components/ui/misc';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </Card>
  );
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean | null; detail: string }) {
  const icon = ok === null ? <MinusCircle className="h-4 w-4 text-muted-foreground" /> : ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />;
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-b-0">
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="truncate text-right text-muted-foreground">{detail}</span>
    </div>
  );
}

export function AdminOverview() {
  const { t, locale } = useI18n();
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.get<AdminStatsDTO>('/api/admin/stats') });
  const system = useQuery({ queryKey: ['admin', 'system'], queryFn: () => api.get<AdminSystemStatusDTO>('/api/admin/system'), refetchInterval: 30_000 });
  const s = stats.data;
  const sys = system.data;
  const maxTemplate = Math.max(1, ...(s?.templates.map((x) => x.count) ?? [1]));

  return (
    <div className="space-y-6">
      {!s ? (
        <Skeleton className="h-28" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t('admin.stats.users')} value={s.users.total} sub={`${s.users.active} ${t('admin.stats.active')} · ${s.users.blocked} ${t('admin.stats.blocked')} · ${s.users.newLast7Days} ${t('admin.stats.new7')}`} />
          <Stat label={t('admin.stats.resumes')} value={s.resumes.total} sub={`${s.resumes.createdLast30Days} ${t('admin.stats.new30')}`} />
          <Stat label={t('admin.stats.documents')} value={s.documents.total} sub={`${formatBytes(s.documents.totalBytes)} · ${s.coverLetters} ${t('admin.stats.coverLetters')}`} />
          <Stat label={t('admin.stats.exports')} value={s.exports.total} sub={`${s.exports.last30Days} ${t('admin.stats.last30')}`} />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">{t('admin.system')}</h2>
          {!sys ? (
            <Skeleton className="h-48" />
          ) : (
            <div>
              <StatusRow label={t('admin.system.database')} ok={sys.database.ok} detail={sys.database.ok ? `${sys.database.latencyMs} ms · ${formatBytes(sys.database.sizeBytes ?? 0)}` : t('admin.system.error')} />
              <StatusRow label={t('admin.system.pdf')} ok={sys.pdfRenderer.ok} detail={sys.pdfRenderer.message} />
              <StatusRow label={t('admin.system.redis')} ok={sys.redis.configured ? sys.redis.ok : null} detail={sys.redis.configured ? (sys.redis.ok ? t('admin.system.ok') : t('admin.system.error')) : t('admin.system.notConfigured')} />
              <StatusRow label={t('admin.system.ai')} ok={sys.ai.enabled ? true : null} detail={sys.ai.enabled ? t('admin.system.enabled') : t('admin.system.disabled')} />
              <StatusRow label={t('admin.system.mail')} ok={true} detail={sys.mail.transport} />
              <StatusRow label={t('admin.system.storage')} ok={true} detail={`${formatBytes(sys.storage.uploadBytes)} · ${sys.storage.backupCount} Backups`} />
              <StatusRow label={t('admin.system.memory')} ok={null} detail={`${formatBytes(sys.memory.rssBytes)} RSS`} />
              <StatusRow label={t('admin.system.uptime')} ok={null} detail={`${Math.floor(sys.uptimeSeconds / 3600)} h ${Math.floor((sys.uptimeSeconds % 3600) / 60)} min`} />
              <StatusRow label={t('admin.system.version')} ok={null} detail={`${sys.version} · Node ${sys.nodeVersion}`} />
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">{t('admin.stats.templateUsage')}</h2>
          {!s ? (
            <Skeleton className="h-48" />
          ) : (
            <div className="space-y-2.5">
              {s.templates.map((tpl) => (
                <div key={tpl.key} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3 text-sm">
                  <span className="truncate">{getTemplateMeta(tpl.key).name[locale]}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(tpl.count / maxTemplate) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">{tpl.count}</span>
                </div>
              ))}
              {Object.keys(s.exports.byKind).length ? (
                <div className="flex flex-wrap gap-2 border-t pt-4 text-xs text-muted-foreground">
                  {Object.entries(s.exports.byKind).map(([k, n]) => (
                    <span key={k} className="rounded-md bg-muted px-2 py-1">
                      {k}: {n}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
