import { ArrowRight, Clock, FileDown, FilePlus2, FileText, FolderUp, Import, Mail, PenLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { ResumeCard } from '../components/cv/ResumeCard';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Card, EmptyState, Skeleton } from '../components/ui/misc';
import { useResumeActions } from '../hooks/useResumeActions';
import { useI18n } from '../i18n';
import { relativeTime } from '../lib/format';
import { useDashboard } from '../lib/queries';

function StatCard({ icon, label, value, hint, to }: { icon: ReactNode; label: string; value: ReactNode; hint?: string; to?: string }) {
  const body = (
    <Card className="h-full p-5 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-foreground [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
      </div>
      <div className="mt-3 truncate text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
  return to ? (
    <Link to={to} className="block rounded-2xl focus-visible:outline-2">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { data, isLoading } = useDashboard();
  const { actions, dialogs } = useResumeActions();

  const name = user?.displayName?.split(' ')[0];
  return (
    <AppShell>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{name ? t('dashboard.welcome', { name }) : t('dashboard.welcomeNoName')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <Link to="/lebenslaeufe/neu">
          <Button icon={<FilePlus2 className="h-4 w-4" />}>{t('resumes.new')}</Button>
        </Link>
      </div>

      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<FileText />} label={t('dashboard.card.resumes')} value={data.resumeCount} hint={t('dashboard.more', { letters: data.coverLetterCount, documents: data.documentCount, profiles: data.profileCount })} to="/lebenslaeufe" />
            <StatCard
              icon={<Clock />}
              label={t('dashboard.card.lastEdited')}
              value={<span className="text-lg">{data.lastEdited ? data.lastEdited.title : t('dashboard.card.noLastEdited')}</span>}
              hint={data.lastEdited ? relativeTime(data.lastEdited.updatedAt, t, locale) : undefined}
              to={data.lastEdited ? `/editor/${data.lastEdited.id}` : undefined}
            />
            <StatCard icon={<PenLine />} label={t('dashboard.card.drafts')} value={data.draftCount} hint={t('dashboard.card.draftsHint')} to="/lebenslaeufe" />
            <StatCard icon={<FileDown />} label={t('dashboard.card.exports')} value={data.exportCount} hint={t('dashboard.card.exportsHint')} />
          </div>

          {data.lastEdited ? (
            <Card className="mt-6 flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{t('dashboard.card.lastEdited')}</p>
                <p className="truncate font-medium">{data.lastEdited.title}</p>
              </div>
              <Link to={`/editor/${data.lastEdited.id}`}>
                <Button variant="outline">
                  {t('dashboard.continue')} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </Card>
          ) : null}

          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('dashboard.recent')}</h2>
              {data.recentResumes.length ? (
                <Link to="/lebenslaeufe" className="text-sm font-medium text-primary hover:underline">
                  {t('dashboard.viewAll')}
                </Link>
              ) : null}
            </div>
            {data.recentResumes.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title={t('dashboard.empty.title')}
                text={t('dashboard.empty.text')}
                action={
                  <Link to="/lebenslaeufe/neu">
                    <Button>{t('resumes.new')}</Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.recentResumes.slice(0, 4).map((r) => (
                  <ResumeCard key={r.id} resume={r} actions={actions} />
                ))}
              </div>
            )}
          </section>

          <section className="mt-10">
            <h2 className="mb-4 text-lg font-semibold">{t('dashboard.quick')}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { to: '/lebenslaeufe/neu', icon: <FilePlus2 />, label: t('dashboard.quick.new') },
                { to: '/anschreiben', icon: <Mail />, label: t('dashboard.quick.letter') },
                { to: '/dokumente', icon: <FolderUp />, label: t('dashboard.quick.upload') },
                { to: '/lebenslaeufe/import', icon: <Import />, label: t('dashboard.quick.import') },
              ].map((q) => (
                <Link key={q.to} to={q.to} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent/40 [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:text-primary">
                  {q.icon}
                  {q.label}
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
      {dialogs}
    </AppShell>
  );
}
