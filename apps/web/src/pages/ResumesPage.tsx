import { FilePlus2, FileText, Import } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ResumeCard } from '../components/cv/ResumeCard';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { EmptyState, PageHeader, Skeleton } from '../components/ui/misc';
import { useResumeActions } from '../hooks/useResumeActions';
import { useT } from '../i18n';
import { cn } from '../lib/cn';
import { useResumes } from '../lib/queries';

export default function ResumesPage() {
  const t = useT();
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const { data, isLoading } = useResumes(tab);
  const { actions, dialogs } = useResumeActions();

  return (
    <AppShell>
      <PageHeader
        title={t('resumes.title')}
        description={t('resumes.subtitle')}
        actions={
          <>
            <Link to="/lebenslaeufe/import">
              <Button variant="outline" icon={<Import className="h-4 w-4" />}>
                {t('resumes.import')}
              </Button>
            </Link>
            <Link to="/lebenslaeufe/neu">
              <Button icon={<FilePlus2 className="h-4 w-4" />}>{t('resumes.new')}</Button>
            </Link>
          </>
        }
      />
      <div className="mb-6 inline-flex rounded-xl border bg-card p-1" role="tablist">
        {(['active', 'archived'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn('rounded-lg px-4 py-1.5 text-sm font-medium transition-colors', tab === k ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {t(k === 'active' ? 'resumes.tab.active' : 'resumes.tab.archived')}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : !data?.length ? (
        tab === 'active' ? (
          <EmptyState
            icon={<FileText />}
            title={t('resumes.empty.title')}
            text={t('resumes.empty.text')}
            action={
              <Link to="/lebenslaeufe/neu">
                <Button>{t('resumes.new')}</Button>
              </Link>
            }
          />
        ) : (
          <EmptyState icon={<FileText />} title={t('resumes.emptyArchive.title')} text={t('resumes.emptyArchive.text')} />
        )
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((r) => (
            <ResumeCard key={r.id} resume={r} actions={actions} />
          ))}
        </div>
      )}
      {dialogs}
    </AppShell>
  );
}
