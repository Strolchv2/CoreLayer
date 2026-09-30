import { getCvLabels, getTemplateMeta, SKILL_DISPLAY_MODES, type ResumeContent, type SectionConfig, type SectionKey } from '@cv-studio/shared';
import {
  Award,
  BookOpen,
  Briefcase,
  FolderKanban,
  GraduationCap,
  Heart,
  HandHeart,
  Languages,
  MessageSquareQuote,
  Sparkles,
  User,
  UserRound,
  Wrench,
  Building2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FormField } from '../../components/ui/FormField';
import { Input, Select } from '../../components/ui/Input';
import { useI18n, useT, type MessageKey } from '../../i18n';
import { useEditor, useEditorStore } from '../EditorContext';
import { SortableList } from '../fields/SortableList';
import { PersonalForm } from './PersonalForm';
import { ProfileSummaryForm, ReferencesOnRequest, SectionItems } from './SectionForms';
import { SectionCard } from './SectionCard';

export const SECTION_ICONS: Record<SectionKey | 'personal', ReactNode> = {
  personal: <UserRound />,
  profile: <User />,
  experience: <Briefcase />,
  education: <GraduationCap />,
  internships: <Building2 />,
  trainings: <BookOpen />,
  certificates: <Award />,
  skills: <Wrench />,
  languages: <Languages />,
  projects: <FolderKanban />,
  volunteering: <HandHeart />,
  interests: <Heart />,
  references: <MessageSquareQuote />,
};

function SectionOptions({ section }: { section: SectionConfig }) {
  const t = useT();
  const templateKey = useEditor((s) => s.doc.templateKey);
  const updateSection = useEditorStore().getState().updateSection;
  const defaultTitle = getCvLabels(useEditor((s) => s.doc.language)).sections[section.key];
  const twoColumn = getTemplateMeta(templateKey).layout !== 'single';
  const hasDisplay = section.key === 'skills' || section.key === 'languages' || section.key === 'interests';
  const displayModes = section.key === 'interests' ? (['tags', 'text'] as const) : section.key === 'languages' ? (['text', 'bars', 'stars'] as const) : SKILL_DISPLAY_MODES;
  return (
    <>
      <FormField label={t('editor.section.customTitle')} hint={t('editor.section.customTitleHint', { title: defaultTitle })}>
        <Input value={section.title} placeholder={defaultTitle} maxLength={80} onChange={(e) => updateSection(section.key, { title: e.target.value })} />
      </FormField>
      {hasDisplay ? (
        <FormField label={t('editor.section.display')} hint={section.key === 'skills' ? t('editor.display.atsHint') : undefined}>
          <Select value={section.options.display ?? (section.key === 'languages' ? 'text' : 'tags')} onChange={(e) => updateSection(section.key, { options: { display: e.target.value as SectionConfig['options']['display'] } })}>
            {displayModes.map((m) => (
              <option key={m} value={m}>
                {t(`editor.display.${m}` as MessageKey)}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}
      {twoColumn ? (
        <FormField label={t('editor.section.column')}>
          <Select value={section.options.column ?? 'auto'} onChange={(e) => updateSection(section.key, { options: { column: e.target.value as 'auto' | 'main' | 'sidebar' } })}>
            <option value="auto">{t('editor.section.column.auto')}</option>
            <option value="main">{t('editor.section.column.main')}</option>
            <option value="sidebar">{t('editor.section.column.sidebar')}</option>
          </Select>
        </FormField>
      ) : null}
    </>
  );
}

function itemCount(key: SectionKey, content: ResumeContent): number {
  if (key === 'profile') return content.profile.summary.trim() ? 1 : 0;
  return (content[key] as unknown[]).length;
}

/** Linke Spalte: persönliche Daten und sortierbare Abschnitte. */
export function ContentPanel() {
  const t = useT();
  const { locale } = useI18n();
  const labels = getCvLabels(locale);
  const sections = useEditor((s) => s.doc.content.sections);
  const content = useEditor((s) => s.doc.content);
  const focus = useEditor((s) => s.focus);
  const { moveSection, updateSection } = useEditorStore().getState();
  const [open, setOpen] = useState<Set<string>>(() => new Set(['personal']));
  const refs = useRef(new Map<string, HTMLElement>());

  // Sprung aus dem Qualitätscheck: Abschnitt öffnen und hinscrollen
  useEffect(() => {
    if (!focus || focus.section === 'design') return;
    setOpen((prev) => new Set(prev).add(focus.section));
    requestAnimationFrame(() => refs.current.get(focus.section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [focus]);

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const setRef = (key: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(key, el);
    else refs.current.delete(key);
  };

  return (
    <div className="space-y-3">
      <SectionCard ref={setRef('personal')} title={t('editor.personal')} icon={SECTION_ICONS.personal} open={open.has('personal')} onToggle={() => toggle('personal')} sortable={false}>
        <PersonalForm />
      </SectionCard>

      <div className="flex items-center justify-between px-1 pt-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('editor.sections')}</h2>
      </div>
      <p className="px-1 text-xs text-muted-foreground">{t('editor.sectionsHint')}</p>

      <SortableList items={sections.map((s) => ({ ...s, id: s.key }))} onMove={moveSection} className="space-y-2.5">
        {(section) => (
          <SectionCard
            ref={setRef(section.key)}
            title={section.title.trim() || labels.sections[section.key]}
            icon={SECTION_ICONS[section.key]}
            count={itemCount(section.key, content)}
            open={open.has(section.key)}
            onToggle={() => toggle(section.key)}
            visible={section.visible}
            onToggleVisible={() => updateSection(section.key, { visible: !section.visible })}
            options={<SectionOptions section={section} />}
          >
            {section.key === 'profile' ? (
              <ProfileSummaryForm />
            ) : (
              <>
                {section.key === 'references' ? <ReferencesOnRequest /> : null}
                <SectionItems sectionKey={section.key} focusItemId={focus?.section === section.key ? focus.itemId : undefined} />
              </>
            )}
          </SectionCard>
        )}
      </SortableList>
      <p className="flex items-center gap-1.5 px-1 pt-1 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" /> {t('editor.bullets.pasteHint')}
      </p>
    </div>
  );
}
