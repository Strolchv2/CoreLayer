import {
  CERTIFICATE_CATEGORIES,
  createSkill,
  formatDateRange,
  formatPartialDate,
  getCvLabels,
  INTEREST_CATEGORIES,
  isSafeHttpUrl,
  LANGUAGE_LEVELS,
  TRAINING_KINDS,
  type CertificateItem,
  type EducationItem,
  type ExperienceItem,
  type InterestItem,
  type InternshipItem,
  type LanguageItem,
  type ListSectionItemMap,
  type ListSectionKey,
  type ProjectItem,
  type ReferenceItem,
  type SkillGroup,
  type TrainingItem,
  type VolunteeringItem,
} from '@cv-studio/shared';
import { Plus, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { FormField } from '../../components/ui/FormField';
import { IconButton } from '../../components/ui/IconButton';
import { Checkbox, Select } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { useI18n, useT } from '../../i18n';
import { useEditor, useEditorStore } from '../EditorContext';
import { AiAssist } from '../fields/AiAssist';
import { BulletListEditor } from '../fields/BulletListEditor';
import { DateField, FieldGrid, TextAreaField, TextField } from '../fields/Fields';
import { DragHandle, SortableList } from '../fields/SortableList';
import { TagsInput } from '../fields/TagsInput';
import { ItemCard } from './ItemCard';

type Update<T> = (patch: Partial<T>) => void;

function useFormatHelpers() {
  const { locale } = useI18n();
  const dateFormat = useEditor((s) => s.doc.dateFormat);
  const language = useEditor((s) => s.doc.language);
  const labels = getCvLabels(locale);
  return {
    dateFormat,
    language,
    labels,
    range: (s: string, e: string, cur: boolean) => formatDateRange(s, e, cur, dateFormat, { present: labels.present }),
    date: (d: string) => formatPartialDate(d, dateFormat),
  };
}

function CurrentCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function DateRange({
  start,
  end,
  current,
  onChange,
  currentLabel,
}: {
  start: string;
  end: string;
  current?: boolean;
  onChange: (patch: { startDate?: string; endDate?: string; current?: boolean }) => void;
  currentLabel?: string;
}) {
  const t = useT();
  const { dateFormat } = useFormatHelpers();
  const endBeforeStart = start && end && !current && end < start;
  return (
    <div className="space-y-2">
      <FieldGrid>
        <DateField label={t('field.start')} value={start} onChange={(v) => onChange({ startDate: v })} format={dateFormat} />
        <DateField label={t('field.end')} value={end} onChange={(v) => onChange({ endDate: v })} format={dateFormat} disabled={current} error={endBeforeStart ? t('validation.end_before_start') : null} />
      </FieldGrid>
      {current !== undefined ? <CurrentCheckbox checked={current} onChange={(v) => onChange({ current: v, ...(v ? { endDate: '' } : {}) })} label={currentLabel ?? t('field.currentGeneric')} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulare je Eintragstyp                                            */
/* ------------------------------------------------------------------ */

function ExperienceFields({ item, update }: { item: ExperienceItem; update: Update<ExperienceItem> }) {
  const t = useT();
  const { language } = useFormatHelpers();
  return (
    <>
      <FieldGrid>
        <TextField label={t('field.position')} value={item.jobTitle} onChange={(v) => update({ jobTitle: v })} maxLength={200} />
        <TextField label={t('field.employer')} value={item.employer} onChange={(v) => update({ employer: v })} maxLength={200} />
      </FieldGrid>
      <TextField label={t('field.location')} value={item.location} onChange={(v) => update({ location: v })} maxLength={200} />
      <DateRange start={item.startDate} end={item.endDate} current={item.current} onChange={update} currentLabel={t('field.current')} />
      <TextAreaField
        label={t('field.description')}
        value={item.description}
        onChange={(v) => update({ description: v })}
        action={<AiAssist text={item.description} onApply={(v) => update({ description: v })} context="experience" language={language} />}
      />
      <BulletListEditor
        label={t('field.tasks')}
        items={item.tasks}
        onChange={(v) => update({ tasks: v })}
        action={<AiAssist text={item.tasks.join('\n')} onApply={(v) => update({ tasks: v.split('\n').map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean) })} context="bullets" language={language} />}
      />
      <BulletListEditor label={t('field.achievements')} items={item.achievements} onChange={(v) => update({ achievements: v })} />
      <BulletListEditor label={t('field.projects')} items={item.projects} onChange={(v) => update({ projects: v })} />
    </>
  );
}

function EducationFields({ item, update }: { item: EducationItem; update: Update<EducationItem> }) {
  const t = useT();
  return (
    <>
      <TextField label={t('field.institution')} value={item.institution} onChange={(v) => update({ institution: v })} maxLength={200} />
      <FieldGrid>
        <TextField label={t('field.degree')} value={item.degree} onChange={(v) => update({ degree: v })} maxLength={200} />
        <TextField label={t('field.fieldOfStudy')} value={item.fieldOfStudy} onChange={(v) => update({ fieldOfStudy: v })} maxLength={200} />
      </FieldGrid>
      <FieldGrid>
        <TextField label={t('field.location')} value={item.location} onChange={(v) => update({ location: v })} maxLength={200} />
        <TextField label={t('field.grade')} value={item.grade} onChange={(v) => update({ grade: v })} maxLength={60} />
      </FieldGrid>
      <DateRange start={item.startDate} end={item.endDate} current={item.current} onChange={update} />
      <TextAreaField label={t('field.description')} value={item.description} onChange={(v) => update({ description: v })} rows={2} />
    </>
  );
}

function TrainingFields({ item, update }: { item: TrainingItem; update: Update<TrainingItem> }) {
  const t = useT();
  const { labels, dateFormat } = useFormatHelpers();
  return (
    <>
      <FieldGrid>
        <FormField label={t('field.trainingKind')}>
          <Select value={item.kind} onChange={(e) => update({ kind: e.target.value as TrainingItem['kind'] })}>
            {TRAINING_KINDS.map((k) => (
              <option key={k} value={k}>
                {labels.trainingKinds[k]}
              </option>
            ))}
          </Select>
        </FormField>
        <DateField label={t('field.date')} value={item.date} onChange={(v) => update({ date: v })} format={dateFormat} />
      </FieldGrid>
      <TextField label={t('field.title')} value={item.title} onChange={(v) => update({ title: v })} maxLength={200} />
      <FieldGrid>
        <TextField label={t('field.provider')} value={item.provider} onChange={(v) => update({ provider: v })} maxLength={200} />
        <TextField label={t('field.duration')} value={item.duration} onChange={(v) => update({ duration: v })} maxLength={80} />
      </FieldGrid>
      <TextField label={t('field.certificate')} value={item.certificate} onChange={(v) => update({ certificate: v })} maxLength={200} />
      <TextAreaField label={t('field.description')} value={item.description} onChange={(v) => update({ description: v })} rows={2} />
    </>
  );
}

function CertificateFields({ item, update }: { item: CertificateItem; update: Update<CertificateItem> }) {
  const t = useT();
  const { labels, dateFormat } = useFormatHelpers();
  return (
    <>
      <FieldGrid>
        <FormField label={t('field.certificateCategory')}>
          <Select value={item.category} onChange={(e) => update({ category: e.target.value as CertificateItem['category'] })}>
            {CERTIFICATE_CATEGORIES.map((k) => (
              <option key={k} value={k}>
                {labels.certificateCategories[k]}
              </option>
            ))}
          </Select>
        </FormField>
        <TextField label={t('field.title')} value={item.name} onChange={(v) => update({ name: v })} maxLength={200} />
      </FieldGrid>
      <FieldGrid>
        <TextField label={t('field.issuer')} value={item.issuer} onChange={(v) => update({ issuer: v })} maxLength={200} />
        <TextField label={t('field.credentialId')} value={item.credentialId} onChange={(v) => update({ credentialId: v })} maxLength={100} />
      </FieldGrid>
      <FieldGrid>
        <DateField label={t('field.date')} value={item.date} onChange={(v) => update({ date: v })} format={dateFormat} />
        <DateField label={t('field.validUntil')} value={item.validUntil} onChange={(v) => update({ validUntil: v })} format={dateFormat} />
      </FieldGrid>
      <TextAreaField label={t('field.description')} value={item.description} onChange={(v) => update({ description: v })} rows={2} />
    </>
  );
}

function ProjectFields({ item, update }: { item: ProjectItem; update: Update<ProjectItem> }) {
  const t = useT();
  const { language } = useFormatHelpers();
  return (
    <>
      <FieldGrid>
        <TextField label={t('field.projectName')} value={item.name} onChange={(v) => update({ name: v })} maxLength={200} />
        <TextField label={t('field.role')} value={item.role} onChange={(v) => update({ role: v })} maxLength={200} />
      </FieldGrid>
      <DateRange start={item.startDate} end={item.endDate} current={item.current} onChange={update} />
      <TextAreaField
        label={t('field.description')}
        value={item.description}
        onChange={(v) => update({ description: v })}
        action={<AiAssist text={item.description} onApply={(v) => update({ description: v })} context="experience" language={language} />}
      />
      <TagsInput label={t('field.technologies')} values={item.technologies} onChange={(v) => update({ technologies: v })} />
      <BulletListEditor label={t('field.results')} items={item.results} onChange={(v) => update({ results: v })} />
      <TextField
        label={t('field.link')}
        value={item.link}
        onChange={(v) => update({ link: v })}
        placeholder="https://…"
        error={item.link.trim() && !isSafeHttpUrl(item.link) ? t('validation.invalid_url') : null}
        maxLength={500}
      />
    </>
  );
}

function InternshipFields({ item, update }: { item: InternshipItem; update: Update<InternshipItem> }) {
  const t = useT();
  return (
    <>
      <FieldGrid>
        <TextField label={t('field.company')} value={item.company} onChange={(v) => update({ company: v })} maxLength={200} />
        <TextField label={t('field.position')} value={item.jobTitle} onChange={(v) => update({ jobTitle: v })} maxLength={200} />
      </FieldGrid>
      <TextField label={t('field.location')} value={item.location} onChange={(v) => update({ location: v })} maxLength={200} />
      <DateRange start={item.startDate} end={item.endDate} onChange={update} />
      <TextAreaField label={t('field.description')} value={item.description} onChange={(v) => update({ description: v })} rows={2} />
    </>
  );
}

function VolunteeringFields({ item, update }: { item: VolunteeringItem; update: Update<VolunteeringItem> }) {
  const t = useT();
  return (
    <>
      <FieldGrid>
        <TextField label={t('field.organization')} value={item.organization} onChange={(v) => update({ organization: v })} maxLength={200} />
        <TextField label={t('field.position')} value={item.role} onChange={(v) => update({ role: v })} maxLength={200} />
      </FieldGrid>
      <TextField label={t('field.location')} value={item.location} onChange={(v) => update({ location: v })} maxLength={200} />
      <DateRange start={item.startDate} end={item.endDate} current={item.current} onChange={update} />
      <TextAreaField label={t('field.description')} value={item.description} onChange={(v) => update({ description: v })} rows={2} />
    </>
  );
}

function LanguageFields({ item, update }: { item: LanguageItem; update: Update<LanguageItem> }) {
  const t = useT();
  const { labels } = useFormatHelpers();
  return (
    <>
      <FieldGrid>
        <TextField label={t('field.language')} value={item.name} onChange={(v) => update({ name: v })} maxLength={200} list="cvs-language-suggestions" />
        <FormField label={t('field.level')}>
          <Select value={item.level ?? ''} onChange={(e) => update({ level: (e.target.value || null) as LanguageItem['level'] })}>
            <option value="">{t('level.none')}</option>
            {LANGUAGE_LEVELS.map((l) => (
              <option key={l} value={l}>
                {labels.languageLevels[l]}
              </option>
            ))}
          </Select>
        </FormField>
      </FieldGrid>
      <TextField label={t('field.note')} value={item.note} onChange={(v) => update({ note: v })} placeholder={t('field.notePlaceholder')} maxLength={200} />
      <datalist id="cvs-language-suggestions">
        {['Deutsch', 'Englisch', 'Französisch', 'Spanisch', 'Italienisch', 'Türkisch', 'Polnisch', 'Russisch', 'Arabisch', 'Niederländisch', 'English', 'German', 'French', 'Spanish'].map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
    </>
  );
}

function InterestFields({ item, update }: { item: InterestItem; update: Update<InterestItem> }) {
  const t = useT();
  const { labels } = useFormatHelpers();
  return (
    <>
      <FieldGrid>
        <FormField label={t('field.interestCategory')}>
          <Select value={item.category} onChange={(e) => update({ category: e.target.value as InterestItem['category'] })}>
            {INTEREST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {labels.interestCategories[c]}
              </option>
            ))}
          </Select>
        </FormField>
        <TextField label={t('field.interestName')} value={item.name} onChange={(v) => update({ name: v })} maxLength={200} />
      </FieldGrid>
      <TextField label={t('field.description')} value={item.description} onChange={(v) => update({ description: v })} maxLength={500} />
    </>
  );
}

function ReferenceFields({ item, update }: { item: ReferenceItem; update: Update<ReferenceItem> }) {
  const t = useT();
  return (
    <>
      <TextField label={t('field.name')} value={item.name} onChange={(v) => update({ name: v })} maxLength={200} />
      <FieldGrid>
        <TextField label={t('field.position')} value={item.jobTitle} onChange={(v) => update({ jobTitle: v })} maxLength={200} />
        <TextField label={t('field.company')} value={item.company} onChange={(v) => update({ company: v })} maxLength={200} />
      </FieldGrid>
      <FieldGrid>
        <TextField label={t('field.phone')} type="tel" value={item.phone} onChange={(v) => update({ phone: v })} maxLength={40} />
        <TextField label={t('field.email')} type="email" value={item.email} onChange={(v) => update({ email: v })} maxLength={254} />
      </FieldGrid>
    </>
  );
}

function SkillGroupFields({ item, update }: { item: SkillGroup; update: Update<SkillGroup> }) {
  const t = useT();
  const setItems = (items: SkillGroup['items']) => update({ items });
  return (
    <>
      <TextField label={t('editor.skills.group')} value={item.name} onChange={(v) => update({ name: v })} placeholder={t('editor.skills.groupPlaceholder')} maxLength={200} />
      <SortableList
        items={item.items}
        onMove={(from, to) => {
          const next = [...item.items];
          const [m] = next.splice(from, 1);
          if (m) next.splice(to, 0, m);
          setItems(next);
        }}
        className="space-y-1.5"
      >
        {(skill, index) => (
          <div className="flex items-center gap-1">
            <DragHandle />
            <input
              value={skill.name}
              onChange={(e) => setItems(item.items.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const next = [...item.items];
                  next.splice(index + 1, 0, createSkill());
                  setItems(next);
                }
              }}
              placeholder={t('editor.skills.skillPlaceholder')}
              aria-label={t('editor.skills.skillPlaceholder')}
              maxLength={120}
              className="h-9 min-w-0 flex-1 rounded-md border border-transparent bg-muted/50 px-2.5 text-sm hover:border-input focus:border-ring focus:bg-card focus:outline-none"
              autoFocus={!skill.name && index === item.items.length - 1}
            />
            <select
              value={skill.level ?? ''}
              onChange={(e) => setItems(item.items.map((s, i) => (i === index ? { ...s, level: e.target.value ? Number(e.target.value) : null } : s)))}
              aria-label={t('editor.skills.level')}
              className="h-9 rounded-md border border-input bg-card px-1.5 text-sm"
            >
              <option value="">{t('editor.skills.noLevel')}</option>
              {[1, 2, 3, 4, 5].map((l) => (
                <option key={l} value={l}>
                  {'●'.repeat(l)}
                  {'○'.repeat(5 - l)}
                </option>
              ))}
            </select>
            <IconButton label={t('common.remove')} size="sm" tooltip={false} onClick={() => setItems(item.items.filter((_, i) => i !== index))}>
              <X />
            </IconButton>
          </div>
        )}
      </SortableList>
      {item.items.length < 60 ? (
        <Button variant="ghost" size="sm" className="text-primary" icon={<Plus className="h-4 w-4" />} onClick={() => setItems([...item.items, createSkill()])}>
          {t('editor.skills.addSkill')}
        </Button>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Generische Listenansicht                                            */
/* ------------------------------------------------------------------ */

interface ItemConfig<K extends ListSectionKey> {
  fields: (props: { item: ListSectionItemMap[K]; update: Update<ListSectionItemMap[K]> }) => ReactNode;
  summary: (item: ListSectionItemMap[K], h: ReturnType<typeof useFormatHelpers>) => { title: string; subtitle?: string };
}

const CONFIG: { [K in ListSectionKey]: ItemConfig<K> } = {
  experience: {
    fields: (p) => <ExperienceFields {...p} />,
    summary: (i, h) => ({ title: i.jobTitle || i.employer, subtitle: [i.jobTitle ? i.employer : '', h.range(i.startDate, i.endDate, i.current)].filter(Boolean).join(' · ') }),
  },
  education: {
    fields: (p) => <EducationFields {...p} />,
    summary: (i, h) => ({ title: i.degree || i.institution, subtitle: [i.degree ? i.institution : '', h.range(i.startDate, i.endDate, i.current)].filter(Boolean).join(' · ') }),
  },
  trainings: {
    fields: (p) => <TrainingFields {...p} />,
    summary: (i, h) => ({ title: i.title, subtitle: [h.labels.trainingKinds[i.kind], i.provider, h.date(i.date)].filter(Boolean).join(' · ') }),
  },
  certificates: {
    fields: (p) => <CertificateFields {...p} />,
    summary: (i, h) => ({ title: i.name, subtitle: [h.labels.certificateCategories[i.category], i.issuer, h.date(i.date)].filter(Boolean).join(' · ') }),
  },
  skills: {
    fields: (p) => <SkillGroupFields {...p} />,
    summary: (i) => ({ title: i.name, subtitle: i.items.map((s) => s.name).filter(Boolean).join(', ') }),
  },
  languages: {
    fields: (p) => <LanguageFields {...p} />,
    summary: (i, h) => ({ title: i.name, subtitle: i.level ? h.labels.languageLevels[i.level] : undefined }),
  },
  projects: {
    fields: (p) => <ProjectFields {...p} />,
    summary: (i, h) => ({ title: i.name, subtitle: [i.role, h.range(i.startDate, i.endDate, i.current)].filter(Boolean).join(' · ') }),
  },
  internships: {
    fields: (p) => <InternshipFields {...p} />,
    summary: (i, h) => ({ title: i.jobTitle || i.company, subtitle: [i.jobTitle ? i.company : '', h.range(i.startDate, i.endDate, false)].filter(Boolean).join(' · ') }),
  },
  volunteering: {
    fields: (p) => <VolunteeringFields {...p} />,
    summary: (i, h) => ({ title: i.role || i.organization, subtitle: [i.role ? i.organization : '', h.range(i.startDate, i.endDate, i.current)].filter(Boolean).join(' · ') }),
  },
  interests: {
    fields: (p) => <InterestFields {...p} />,
    summary: (i, h) => ({ title: i.name, subtitle: h.labels.interestCategories[i.category] }),
  },
  references: {
    fields: (p) => <ReferenceFields {...p} />,
    summary: (i) => ({ title: i.name, subtitle: [i.jobTitle, i.company].filter(Boolean).join(', ') }),
  },
};

/** Liste der Einträge eines Abschnitts mit Drag & Drop. */
export function SectionItems<K extends ListSectionKey>({ sectionKey, focusItemId }: { sectionKey: K; focusItemId?: string }) {
  const t = useT();
  const confirm = useConfirm();
  const helpers = useFormatHelpers();
  const items = useEditor((s) => s.doc.content[sectionKey]) as ListSectionItemMap[K][];
  const newItemId = useEditor((s) => s.newItemId);
  const { addItem, updateItem, removeItem, duplicateItem, moveItem } = useEditorStore().getState();
  const [openId, setOpenId] = useState<string | null>(null);
  const config = CONFIG[sectionKey];

  useEffect(() => {
    if (newItemId && items.some((i) => i.id === newItemId)) setOpenId(newItemId);
  }, [newItemId, items]);
  useEffect(() => {
    if (focusItemId) setOpenId(focusItemId);
  }, [focusItemId]);

  const sectionLabel = helpers.labels.sections[sectionKey];

  return (
    <div className="space-y-2">
      <SortableList items={items} onMove={(from, to) => moveItem(sectionKey, from, to)} className="space-y-2">
        {(item) => {
          const summary = config.summary(item, helpers);
          const visible = (item as { visible?: boolean }).visible ?? true;
          return (
            <ItemCard
              title={summary.title}
              subtitle={summary.subtitle}
              open={openId === item.id}
              highlight={focusItemId === item.id}
              onToggle={() => setOpenId((id) => (id === item.id ? null : item.id))}
              visible={visible}
              onToggleVisible={() => updateItem(sectionKey, item.id, { visible: !visible } as Partial<ListSectionItemMap[K]>)}
              onDuplicate={() => duplicateItem(sectionKey, item.id)}
              onDelete={async () => {
                const hasContent = Boolean(summary.title);
                if (hasContent && !(await confirm({ title: t('editor.item.deleteConfirm'), description: t('editor.item.deleteText'), confirmLabel: t('common.delete'), destructive: true }))) return;
                removeItem(sectionKey, item.id);
              }}
            >
              {config.fields({ item, update: (patch) => updateItem(sectionKey, item.id, patch) })}
            </ItemCard>
          );
        }}
      </SortableList>
      {items.length < 50 ? (
        <Button variant="outline" size="sm" className="w-full border-dashed" icon={<Plus className="h-4 w-4" />} onClick={() => addItem(sectionKey)}>
          {sectionKey === 'skills' ? t('editor.skills.addGroup') : t('editor.item.add', { section: sectionLabel })}
        </Button>
      ) : null}
    </div>
  );
}

/** "Über mich" / Kurzprofil */
export function ProfileSummaryForm() {
  const t = useT();
  const profile = useEditor((s) => s.doc.content.profile);
  const language = useEditor((s) => s.doc.language);
  const updateContent = useEditor((s) => s.updateContent);
  const set = <K extends keyof typeof profile>(key: K) => (value: (typeof profile)[K]) =>
    updateContent((c) => {
      c.profile[key] = value;
    });
  return (
    <div className="space-y-3">
      <TextField label={t('field.headline')} value={profile.headline} onChange={set('headline')} maxLength={200} />
      <TextAreaField
        label={t('field.summary')}
        value={profile.summary}
        onChange={set('summary')}
        hint={t('field.summaryHint')}
        rows={5}
        action={<AiAssist text={profile.summary} onApply={set('summary')} context="summary" language={language} />}
      />
      <FieldGrid>
        <TextField label={t('field.experienceYears')} value={profile.experience} onChange={set('experience')} placeholder={t('field.experienceYearsPlaceholder')} maxLength={200} />
        <TextField label={t('field.expertise')} value={profile.expertise} onChange={set('expertise')} maxLength={200} />
      </FieldGrid>
      <BulletListEditor label={t('field.strengths')} items={profile.strengths} onChange={set('strengths')} max={12} />
    </div>
  );
}

/** Option "Referenzen auf Anfrage" direkt im Abschnitt */
export function ReferencesOnRequest() {
  const t = useT();
  const section = useEditor((s) => s.doc.content.sections.find((x) => x.key === 'references'));
  const updateSection = useEditor((s) => s.updateSection);
  const onRequest = Boolean(section?.options.onRequest);
  return (
    <label className="flex items-start justify-between gap-3 rounded-xl border bg-muted/30 p-3">
      <span>
        <span className="block text-sm font-medium">{t('editor.references.onRequest')}</span>
        <span className="block text-xs text-muted-foreground">{t('editor.references.onRequestHint')}</span>
      </span>
      <Switch checked={onRequest} onCheckedChange={(v) => updateSection('references', { options: { onRequest: v } })} label={t('editor.references.onRequest')} />
    </label>
  );
}
