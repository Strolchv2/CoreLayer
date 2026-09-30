import { getTemplateMeta, type ResumeSummaryDTO } from '@cv-studio/shared';
import { Archive, ArchiveRestore, Copy, FileDown, MoreHorizontal, Pencil, Trash2, UserSquare2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useI18n } from '../../i18n';
import { relativeTime } from '../../lib/format';
import { IconButton } from '../ui/IconButton';
import { Menu } from '../ui/Menu';
import { Badge } from '../ui/misc';

export interface ResumeActions {
  onRename: (r: ResumeSummaryDTO) => void;
  onDuplicate: (r: ResumeSummaryDTO) => void;
  onExport: (r: ResumeSummaryDTO) => void;
  onArchive: (r: ResumeSummaryDTO, archived: boolean) => void;
  onDelete: (r: ResumeSummaryDTO) => void;
  onSaveAsProfile: (r: ResumeSummaryDTO) => void;
}

/** Stilisierte Miniatur (ohne Inhalte zu laden) – Farbe und Aufbau der Vorlage. */
function PaperMini({ templateKey }: { templateKey: string }) {
  const meta = getTemplateMeta(templateKey);
  const color = meta.defaultDesign.primaryColor;
  const sidebar = meta.layout !== 'single';
  return (
    <div className="relative aspect-[210/297] w-full overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-black/5">
      {sidebar ? (
        <div className="absolute inset-y-0 w-[32%]" style={{ background: color, opacity: meta.defaultDesign.background === 'accent-band' ? 1 : 0.12, [meta.layout === 'sidebar-left' ? 'left' : 'right']: 0 }} />
      ) : null}
      {meta.defaultDesign.headerStyle === 'colored' ? <div className="absolute inset-x-0 top-0 h-[16%]" style={{ background: color }} /> : null}
      <div className={`absolute top-[7%] space-y-[6%] ${sidebar && meta.layout === 'sidebar-left' ? 'left-[40%] right-[8%]' : 'left-[9%] right-[40%]'}`}>
        <div className="h-[7px] w-3/4 rounded-sm" style={{ background: meta.defaultDesign.headerStyle === 'colored' ? '#fff' : color }} />
        <div className="h-[4px] w-1/2 rounded-sm bg-black/20" />
      </div>
      <div className={`absolute top-[26%] space-y-[9px] ${sidebar && meta.layout === 'sidebar-left' ? 'left-[40%] right-[8%]' : 'left-[9%] right-[9%]'}`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-[3px]">
            <div className="h-[4px] w-1/3 rounded-sm" style={{ background: color, opacity: 0.8 }} />
            <div className="h-[3px] w-full rounded-sm bg-black/10" />
            <div className="h-[3px] w-5/6 rounded-sm bg-black/10" />
            <div className="h-[3px] w-4/6 rounded-sm bg-black/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResumeCard({ resume, actions }: { resume: ResumeSummaryDTO; actions: ResumeActions }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const meta = getTemplateMeta(resume.templateKey);
  const archived = Boolean(resume.archivedAt);
  return (
    <article className="group relative flex flex-col rounded-2xl border bg-card p-3 transition-shadow hover:shadow-[var(--shadow-soft)]">
      <Link to={`/editor/${resume.id}`} className="block rounded-xl bg-preview p-5 pb-0" aria-label={`${t('common.open')}: ${resume.title}`}>
        <div className="mx-auto w-[62%] translate-y-1 transition-transform duration-200 group-hover:-translate-y-0.5">
          <PaperMini templateKey={resume.templateKey} />
        </div>
      </Link>
      <div className="flex items-start justify-between gap-2 px-1.5 pt-3">
        <div className="min-w-0">
          <Link to={`/editor/${resume.id}`} className="block truncate font-medium hover:text-primary">
            {resume.title}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{[resume.fullName, resume.jobTitle].filter(Boolean).join(' · ') || meta.name[locale]}</p>
        </div>
        <Menu
          trigger={
            <IconButton label={t('common.more')} size="sm" tooltip={false}>
              <MoreHorizontal />
            </IconButton>
          }
          items={[
            { label: t('common.edit'), icon: <Pencil />, onSelect: () => navigate(`/editor/${resume.id}`) },
            { label: t('common.rename'), icon: <Pencil />, onSelect: () => actions.onRename(resume) },
            { label: t('common.duplicate'), icon: <Copy />, onSelect: () => actions.onDuplicate(resume) },
            { label: t('resumes.exportPdf'), icon: <FileDown />, onSelect: () => actions.onExport(resume) },
            { label: t('resumes.saveAsProfile'), icon: <UserSquare2 />, onSelect: () => actions.onSaveAsProfile(resume) },
            archived
              ? { label: t('common.unarchive'), icon: <ArchiveRestore />, onSelect: () => actions.onArchive(resume, false), separatorBefore: true }
              : { label: t('common.archive'), icon: <Archive />, onSelect: () => actions.onArchive(resume, true), separatorBefore: true },
            { label: t('common.delete'), icon: <Trash2 />, destructive: true, onSelect: () => actions.onDelete(resume) },
          ]}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1.5 pb-1">
        <Badge>{meta.name[locale]}</Badge>
        <Badge>{resume.language.toUpperCase()}</Badge>
        {resume.lastExportedAt ? <Badge tone="success">{t('resumes.exported', { time: relativeTime(resume.lastExportedAt, t, locale) })}</Badge> : <Badge tone="warning">{t('resumes.notExported')}</Badge>}
      </div>
      <p className="px-1.5 pt-1 text-xs text-muted-foreground">{t('common.updated', { time: relativeTime(resume.updatedAt, t, locale) })}</p>
    </article>
  );
}
