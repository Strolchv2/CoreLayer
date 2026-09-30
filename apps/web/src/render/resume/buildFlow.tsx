/**
 * Wandelt Lebenslaufdaten in einen "Flow" aus Fragmenten um, den die
 * Seitenumbruch-Engine auf A4-Seiten verteilt.
 */
import {
  formatDateRange,
  formatPartialDate,
  getCvLabels,
  LANGUAGE_LEVEL_SCORE,
  nonEmpty,
  safeHref,
  displayUrl,
  sectionHasContent,
  sectionTitle,
  splitParagraphs,
  type CvLabels,
  type PersonalFieldKey,
  type ResumeRenderData,
  type SectionConfig,
  type SkillDisplayMode,
} from '@cv-studio/shared';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { DocumentFlow, Fragment, FlowItem } from '../flow';
import { CvIcon } from '../icons';
import { getTemplateRender, sectionColumn, type TemplateRenderConfig } from '../templateConfig';
import { ContactList, contactEntries, detailEntries, EntryHead, joinParts, Name, Photo, Row } from './parts';

interface Ctx {
  data: ResumeRenderData;
  labels: CvLabels;
  tpl: TemplateRenderConfig;
  hidden: Set<PersonalFieldKey>;
  fmt: (d: string) => string;
  range: (s: string, e: string, current: boolean) => string;
}

type Column = 'main' | 'sidebar';

function dateStyle(ctx: Ctx, column: Column): 'right' | 'left' | 'above' {
  return column === 'sidebar' ? 'above' : ctx.tpl.dates;
}

/** Umhüllt ein Fragment passend zur Datumsdarstellung (linke Datumsspalte, Zeitleiste). */
function wrap(ctx: Ctx, column: Column, node: ReactNode, date?: string): ReactNode {
  if (dateStyle(ctx, column) === 'left') return <Row date={date}>{node}</Row>;
  return node;
}

function tlClass(ctx: Ctx, column: Column, head: boolean): string | undefined {
  if (!ctx.tpl.timeline || column !== 'main') return undefined;
  return clsx('cv-tl', head && 'cv-tl-head');
}

function paragraphFragments(ctx: Ctx, column: Column, keyPrefix: string, text: string, className = 'cv-p'): Fragment[] {
  return splitParagraphs(text).map((para, i) => ({
    key: `${keyPrefix}:p${i}`,
    gap: 'none' as const,
    className: tlClass(ctx, column, false),
    text: {
      value: para,
      render: (t: string, part: { continued: boolean }) =>
        wrap(
          ctx,
          column,
          <p className={clsx(className, part.continued && 'cv-p--cont')} data-text="">
            {t}
          </p>,
        ),
    },
  }));
}

function bulletFragments(ctx: Ctx, column: Column, keyPrefix: string, label: string | null, bullets: string[]): Fragment[] {
  return nonEmpty(bullets).map((b, i) => ({
    key: `${keyPrefix}:${i}`,
    gap: 'none' as const,
    className: tlClass(ctx, column, false),
    node: wrap(
      ctx,
      column,
      <>
        {i === 0 && label ? <div className="cv-label">{label}</div> : null}
        <ul className="cv-list">
          <li>{b}</li>
        </ul>
      </>,
    ),
  }));
}

function headFragment(ctx: Ctx, column: Column, key: string, head: ReactNode, date?: string): Fragment {
  return { key: `${key}:head`, gap: 'item', className: tlClass(ctx, column, true), node: wrap(ctx, column, head, date) };
}

function headingItem(section: SectionConfig, labels: CvLabels): FlowItem {
  return {
    key: `h:${section.key}`,
    keepWithNext: true,
    fragments: [
      {
        key: `h:${section.key}`,
        gap: 'section',
        className: 'cv-is-heading',
        node: (
          <h2 className="cv-h2">
            <span>{sectionTitle(section, labels)}</span>
          </h2>
        ),
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Abschnitte                                                          */
/* ------------------------------------------------------------------ */

function sectionItems(ctx: Ctx, section: SectionConfig, column: Column): FlowItem[] {
  const { data, labels } = ctx;
  const c = data.content;
  const ds = dateStyle(ctx, column);
  const items: FlowItem[] = [];

  switch (section.key) {
    case 'profile': {
      // Profiltext immer in voller Breite und ohne Zeitleiste
      const full: Ctx = { ...ctx, tpl: { ...ctx.tpl, dates: ctx.tpl.dates === 'left' ? 'right' : ctx.tpl.dates, timeline: false } };
      return sectionItemsProfile(full, section, column);
    }

    case 'experience':
      for (const e of c.experience.filter((x) => x.visible)) {
        const date = ctx.range(e.startDate, e.endDate, e.current);
        const k = `exp:${e.id}`;
        items.push({
          key: k,
          splittable: true,
          fragments: [
            headFragment(ctx, column, k, <EntryHead dates={ds} title={e.jobTitle} subtitle={joinParts([e.employer, e.location])} date={date} />, date),
            ...paragraphFragments(ctx, column, k, e.description),
            ...bulletFragments(ctx, column, `${k}:tasks`, e.description.trim() || nonEmpty(e.achievements).length ? labels.tasks : null, e.tasks),
            ...bulletFragments(ctx, column, `${k}:ach`, labels.achievements, e.achievements),
            ...bulletFragments(ctx, column, `${k}:proj`, labels.projects, e.projects),
          ],
        });
      }
      break;

    case 'education':
      for (const e of c.education.filter((x) => x.visible)) {
        const date = ctx.range(e.startDate, e.endDate, e.current);
        const k = `edu:${e.id}`;
        const title = joinParts([e.degree, e.fieldOfStudy], ' – ') || e.institution;
        items.push({
          key: k,
          splittable: true,
          fragments: [
            headFragment(
              ctx,
              column,
              k,
              <EntryHead
                dates={ds}
                title={title}
                subtitle={joinParts([title === e.institution ? '' : e.institution, e.location])}
                date={date}
                extra={e.grade ? <div className="cv-entry-meta">{labels.grade}: {e.grade}</div> : null}
              />,
              date,
            ),
            ...paragraphFragments(ctx, column, k, e.description),
          ],
        });
      }
      break;

    case 'internships':
      for (const e of c.internships.filter((x) => x.visible)) {
        const date = ctx.range(e.startDate, e.endDate, false);
        const k = `int:${e.id}`;
        items.push({
          key: k,
          splittable: true,
          fragments: [
            headFragment(ctx, column, k, <EntryHead dates={ds} title={e.jobTitle || e.company} subtitle={joinParts([e.jobTitle ? e.company : '', e.location])} date={date} />, date),
            ...paragraphFragments(ctx, column, k, e.description),
          ],
        });
      }
      break;

    case 'trainings':
      for (const t of c.trainings.filter((x) => x.visible)) {
        const date = ctx.fmt(t.date);
        const k = `tr:${t.id}`;
        items.push({
          key: k,
          splittable: true,
          fragments: [
            headFragment(
              ctx,
              column,
              k,
              <EntryHead dates={ds} title={t.title} subtitle={joinParts([labels.trainingKinds[t.kind], t.provider, t.duration, t.certificate])} date={date} />,
              date,
            ),
            ...paragraphFragments(ctx, column, k, t.description),
          ],
        });
      }
      break;

    case 'certificates':
      for (const ct of c.certificates.filter((x) => x.visible)) {
        const date = ctx.fmt(ct.date);
        const k = `cert:${ct.id}`;
        const sub = joinParts([
          ct.issuer,
          ct.credentialId && `${labels.credentialId} ${ct.credentialId}`,
          ct.validUntil && `${labels.validUntil} ${ctx.fmt(ct.validUntil)}`,
        ]);
        items.push({
          key: k,
          splittable: true,
          fragments: [headFragment(ctx, column, k, <EntryHead dates={ds} title={ct.name} subtitle={sub} date={date} />, date), ...paragraphFragments(ctx, column, k, ct.description)],
        });
      }
      break;

    case 'projects':
      for (const pj of c.projects.filter((x) => x.visible)) {
        const date = ctx.range(pj.startDate, pj.endDate, pj.current);
        const k = `prj:${pj.id}`;
        const techs = nonEmpty(pj.technologies);
        const href = safeHref(pj.link);
        const fragments: Fragment[] = [
          headFragment(ctx, column, k, <EntryHead dates={ds} title={pj.name} subtitle={pj.role} date={date} />, date),
          ...paragraphFragments(ctx, column, k, pj.description),
        ];
        if (techs.length) {
          fragments.push({
            key: `${k}:tech`,
            gap: 'none',
            className: tlClass(ctx, column, false),
            node: wrap(
              ctx,
              column,
              <div className="cv-tech">
                <span className="cv-fact-label">{labels.technologies}:</span> {techs.join(', ')}
              </div>,
            ),
          });
        }
        fragments.push(...bulletFragments(ctx, column, `${k}:res`, labels.results, pj.results));
        if (href) {
          fragments.push({
            key: `${k}:link`,
            gap: 'none',
            className: tlClass(ctx, column, false),
            node: wrap(
              ctx,
              column,
              <div className="cv-entry-link">
                <a className="cv-link" href={href}>
                  {displayUrl(pj.link)}
                </a>
              </div>,
            ),
          });
        }
        items.push({ key: k, splittable: true, fragments });
      }
      break;

    case 'volunteering':
      for (const v of c.volunteering.filter((x) => x.visible)) {
        const date = ctx.range(v.startDate, v.endDate, v.current);
        const k = `vol:${v.id}`;
        items.push({
          key: k,
          splittable: true,
          fragments: [
            headFragment(ctx, column, k, <EntryHead dates={ds} title={v.role || v.organization} subtitle={joinParts([v.role ? v.organization : '', v.location])} date={date} />, date),
            ...paragraphFragments(ctx, column, k, v.description),
          ],
        });
      }
      break;

    case 'skills': {
      const mode: SkillDisplayMode = section.options.display ?? 'tags';
      for (const g of c.skills.filter((x) => x.visible)) {
        const skills = g.items.filter((s) => s.name.trim());
        if (!skills.length) continue;
        const k = `sk:${g.id}`;
        const groupName = g.name.trim() ? <div className="cv-skill-group-name">{g.name}</div> : null;
        if (mode === 'text') {
          items.push({
            key: k,
            fragments: [
              {
                key: `${k}:all`,
                gap: 'item',
                node: wrap(
                  ctx,
                  column,
                  <div className="cv-skill-text">
                    {g.name.trim() ? <span className="cv-fact-label">{g.name}: </span> : null}
                    {skills.map((s) => s.name.trim()).join(', ')}
                  </div>,
                ),
              },
            ],
          });
        } else if (mode === 'tags') {
          items.push({
            key: k,
            fragments: [
              {
                key: `${k}:all`,
                gap: 'item',
                node: wrap(
                  ctx,
                  column,
                  <div className="cv-skill-group">
                    {groupName}
                    <div className="cv-tags">
                      {skills.map((s) => (
                        <span key={s.id} className="cv-tag">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>,
                ),
              },
            ],
          });
        } else {
          items.push({
            key: k,
            splittable: true,
            fragments: skills.map((s, i) => ({
              key: `${k}:${s.id}`,
              gap: i === 0 ? ('item' as const) : ('none' as const),
              node: wrap(
                ctx,
                column,
                <>
                  {i === 0 ? groupName : null}
                  <div className="cv-skill-row">
                    <span className="cv-skill-name">{s.name}</span>
                    {s.level ? <LevelIndicator mode={mode} level={s.level} /> : null}
                  </div>
                </>,
              ),
            })),
          });
        }
      }
      break;
    }

    case 'languages': {
      const mode = section.options.display ?? 'text';
      const langs = c.languages.filter((x) => x.visible && x.name.trim());
      items.push({
        key: 'lang',
        splittable: true,
        fragments: langs.map((l, i) => ({
          key: `lang:${l.id}`,
          gap: i === 0 ? ('item' as const) : ('tight' as const),
          node: wrap(
            ctx,
            column,
            <div className={clsx('cv-lang', (mode === 'bars' || mode === 'stars') && 'cv-lang--graphic')}>
              <div className="cv-lang-line">
                <span className="cv-lang-name">{l.name}</span>
                <span className="cv-lang-level">{joinParts([l.level ? labels.languageLevels[l.level] : '', l.note], ' · ')}</span>
              </div>
              {l.level && (mode === 'bars' || mode === 'stars') ? <LevelIndicator mode={mode} level={LANGUAGE_LEVEL_SCORE[l.level]} /> : null}
            </div>,
          ),
        })),
      });
      break;
    }

    case 'interests': {
      const list = c.interests.filter((x) => x.visible && x.name.trim());
      const mode = section.options.display ?? 'tags';
      const categories = [...new Set(list.map((i) => i.category))];
      const groups = categories.length > 1 ? categories.map((cat) => ({ label: labels.interestCategories[cat], items: list.filter((i) => i.category === cat) })) : [{ label: '', items: list }];
      items.push({
        key: 'interests',
        splittable: true,
        fragments: groups.map((g, i) => ({
          key: `int-g:${i}`,
          gap: i === 0 ? ('item' as const) : ('tight' as const),
          node: wrap(
            ctx,
            column,
            mode === 'tags' ? (
              <div className="cv-skill-group">
                {g.label ? <div className="cv-skill-group-name">{g.label}</div> : null}
                <div className="cv-tags">
                  {g.items.map((it) => (
                    <span key={it.id} className="cv-tag">
                      {it.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="cv-skill-text">
                {g.label ? <span className="cv-fact-label">{g.label}: </span> : null}
                {g.items.map((it) => (it.description ? `${it.name} (${it.description})` : it.name)).join(', ')}
              </div>
            ),
          ),
        })),
      });
      break;
    }

    case 'references':
      if (section.options.onRequest) {
        items.push({ key: 'ref', fragments: [{ key: 'ref:onrequest', gap: 'item', node: wrap(ctx, column, <p className="cv-p">{labels.referencesOnRequest}</p>) }] });
      } else {
        for (const r of c.references.filter((x) => x.visible && x.name.trim())) {
          items.push({
            key: `ref:${r.id}`,
            fragments: [
              {
                key: `ref:${r.id}`,
                gap: 'item',
                node: wrap(
                  ctx,
                  column,
                  <div className="cv-ref">
                    <div className="cv-entry-title">{r.name}</div>
                    <div className="cv-entry-sub">{joinParts([r.jobTitle, r.company], ', ')}</div>
                    <div className="cv-entry-meta">{joinParts([r.phone, r.email])}</div>
                  </div>,
                ),
              },
            ],
          });
        }
      }
      break;
  }

  if (items.length === 0 || items.every((i) => i.fragments.length === 0)) return [];
  return [headingItem(section, labels), ...items.filter((i) => i.fragments.length > 0)];
}

function sectionItemsProfile(ctx: Ctx, section: SectionConfig, column: Column): FlowItem[] {
  const { labels } = ctx;
  const p = ctx.data.content.profile;
  const items: FlowItem[] = [];

  const fragments: Fragment[] = [];
  if (p.headline.trim()) {
    fragments.push({ key: 'profile:headline', gap: 'item', node: wrap(ctx, column, <div className="cv-profile-headline">{p.headline}</div>) });
  }
  fragments.push(...paragraphFragments(ctx, column, 'profile', p.summary, 'cv-p cv-summary'));
  const facts = [
    p.experience.trim() && { label: labels.experienceYears, value: p.experience },
    p.expertise.trim() && { label: labels.expertise, value: p.expertise },
  ].filter(Boolean) as { label: string; value: string }[];
  if (facts.length) {
    fragments.push({
      key: 'profile:facts',
      gap: 'none',
      node: wrap(
        ctx,
        column,
        <div className="cv-facts">
          {facts.map((f) => (
            <span key={f.label} className="cv-fact">
              <span className="cv-fact-label">{f.label}:</span> {f.value}
            </span>
          ))}
        </div>,
      ),
    });
  }
  fragments.push(...bulletFragments(ctx, column, 'profile:strengths', labels.strengths, p.strengths));
  if (fragments[0]) fragments[0].gap = 'item';
  items.push({ key: 'profile', splittable: true, fragments });
  if (items.every((i) => i.fragments.length === 0)) return [];
  return [headingItem(section, labels), ...items];
}

function LevelIndicator({ mode, level }: { mode: 'bars' | 'stars' | 'tags' | 'text'; level: number }) {
  if (mode === 'stars') {
    return (
      <span className="cv-dots" aria-label={`${level}/5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <i key={i} className={i <= level ? 'on' : undefined} />
        ))}
      </span>
    );
  }
  return (
    <span className="cv-bar" aria-label={`${level}/5`}>
      <span style={{ width: `${level * 20}%` }} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Kopfbereich                                                         */
/* ------------------------------------------------------------------ */

function photoUrl(ctx: Ctx): string | null {
  const { data } = ctx;
  if (!data.design.showPhoto || ctx.hidden.has('photo') || !data.photoUrl) return null;
  return data.photoUrl;
}

function TopHeader({ ctx }: { ctx: Ctx }) {
  const { data, labels } = ctx;
  const p = data.content.personal;
  const photo = photoUrl(ctx);
  const contacts = contactEntries(p, ctx.hidden, labels);
  const details = detailEntries(p, ctx.hidden, labels);
  const showLabels = data.templateKey === 'ats';
  return (
    <header className={clsx('cv-header', `cv-header--${data.design.headerStyle}`, photo && 'cv-header--photo')}>
      {photo ? <Photo url={photo} design={data.design} /> : null}
      <div className="cv-header-main">
        <Name personal={p} />
        {p.jobTitle.trim() && !ctx.hidden.has('jobTitle') ? <div className="cv-jobtitle">{p.jobTitle}</div> : null}
        <ContactList entries={contacts} variant="inline" icons={data.design.iconStyle} showLabels={showLabels} />
        {details.length ? <ContactList entries={details} variant="inline" icons={data.design.iconStyle} showLabels /> : null}
      </div>
    </header>
  );
}

function sidebarHeaderItems(ctx: Ctx): FlowItem[] {
  const { data, labels } = ctx;
  const p = data.content.personal;
  const items: FlowItem[] = [];
  const photo = photoUrl(ctx);
  if (photo) items.push({ key: 'sb:photo', fragments: [{ key: 'sb:photo', gap: 'none', node: <Photo url={photo} design={data.design} /> }] });
  const contacts = contactEntries(p, ctx.hidden, labels);
  if (contacts.length) {
    items.push({
      key: 'sb:contact',
      fragments: [
        { key: 'sb:contact:h', gap: 'section', className: 'cv-is-heading', node: <h2 className="cv-h2"><span>{labels.contact}</span></h2> },
        { key: 'sb:contact:list', gap: 'none', node: <ContactList entries={contacts} variant="list" icons={data.design.iconStyle} /> },
      ],
    });
  }
  const details = detailEntries(p, ctx.hidden, labels);
  if (details.length) {
    items.push({
      key: 'sb:details',
      fragments: [
        { key: 'sb:details:h', gap: 'section', className: 'cv-is-heading', node: <h2 className="cv-h2"><span>{labels.personalDetails}</span></h2> },
        { key: 'sb:details:list', gap: 'none', node: <ContactList entries={details} variant="list" icons={data.design.iconStyle} /> },
      ],
    });
  }
  return items;
}

function mainNameItem(ctx: Ctx): FlowItem {
  const p = ctx.data.content.personal;
  return {
    key: 'main:name',
    fragments: [
      {
        key: 'main:name',
        gap: 'none',
        node: (
          <div className="cv-namebar">
            <Name personal={p} />
            {p.jobTitle.trim() && !ctx.hidden.has('jobTitle') ? <div className="cv-jobtitle">{p.jobTitle}</div> : null}
          </div>
        ),
      },
    ],
  };
}

export function buildResumeFlow(data: ResumeRenderData): DocumentFlow {
  const labels = getCvLabels(data.language);
  const tpl = getTemplateRender(data.templateKey);
  const ctx: Ctx = {
    data,
    labels,
    tpl,
    hidden: new Set(data.content.personal.hidden),
    fmt: (d) => formatPartialDate(d, data.dateFormat),
    range: (s, e, cur) => formatDateRange(s, e, cur, data.dateFormat, { present: labels.present }),
  };

  const main: FlowItem[] = [];
  const sidebar: FlowItem[] = [];
  let top: ReactNode | undefined;

  if (tpl.header === 'sidebar' && tpl.layout !== 'single') {
    sidebar.push(...sidebarHeaderItems(ctx));
    main.push(mainNameItem(ctx));
  } else {
    top = <TopHeader ctx={ctx} />;
  }

  for (const section of data.content.sections) {
    if (!section.visible || !sectionHasContent(data.content, section)) continue;
    const column = sectionColumn(section, data.templateKey);
    const target = column === 'sidebar' ? sidebar : main;
    target.push(...sectionItems(ctx, section, column));
  }

  return { top, main, sidebar: tpl.layout === 'single' ? undefined : sidebar };
}

export function PageFooter({ data, index, total }: { data: ResumeRenderData; index: number; total: number }) {
  if (!data.design.showPageNumbers || total < 2) return null;
  const labels = getCvLabels(data.language);
  const name = [data.content.personal.firstName, data.content.personal.lastName].filter(Boolean).join(' ');
  return (
    <div className="cv-footer">
      <span>{joinParts([name, labels.resumeWord], ' – ')}</span>
      <span>{labels.page(index + 1, total)}</span>
    </div>
  );
}

export { CvIcon };
