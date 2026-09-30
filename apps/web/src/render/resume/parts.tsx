import {
  displayUrl,
  formatPartialDate,
  mailtoHref,
  safeHref,
  telHref,
  type CvLabels,
  type DesignSettings,
  type PersonalData,
  type PersonalFieldKey,
} from '@cv-studio/shared';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { CvIcon, type CvIconName } from '../icons';

export interface ContactEntry {
  key: string;
  icon: CvIconName;
  label: string;
  text: string;
  href?: string;
}

export function contactEntries(p: PersonalData, hidden: Set<PersonalFieldKey>, labels: CvLabels): ContactEntry[] {
  const list: ContactEntry[] = [];
  if (!hidden.has('address')) {
    const cityLine = [p.postalCode, p.city].filter(Boolean).join(' ');
    const address = [p.street, cityLine, p.country].filter(Boolean).join(', ');
    if (address) list.push({ key: 'address', icon: 'location', label: labels.address, text: address });
  }
  if (!hidden.has('phone') && p.phone.trim()) list.push({ key: 'phone', icon: 'phone', label: labels.phone, text: p.phone.trim(), href: telHref(p.phone) });
  if (!hidden.has('email') && p.email.trim()) list.push({ key: 'email', icon: 'mail', label: labels.email, text: p.email.trim(), href: mailtoHref(p.email) });
  if (!hidden.has('website') && p.website.trim()) list.push({ key: 'website', icon: 'globe', label: labels.website, text: displayUrl(p.website), href: safeHref(p.website) });
  if (!hidden.has('linkedin') && p.linkedin.trim()) list.push({ key: 'linkedin', icon: 'linkedin', label: 'LinkedIn', text: displayUrl(p.linkedin), href: safeHref(p.linkedin) });
  if (!hidden.has('github') && p.github.trim()) list.push({ key: 'github', icon: 'github', label: 'GitHub', text: displayUrl(p.github), href: safeHref(p.github) });
  for (const link of p.links) {
    if (!link.visible || !link.url.trim()) continue;
    list.push({ key: `link-${link.id}`, icon: 'link', label: link.label || 'Link', text: link.label ? `${link.label}: ${displayUrl(link.url)}` : displayUrl(link.url), href: safeHref(link.url) });
  }
  return list;
}

export interface DetailEntry {
  key: string;
  icon: CvIconName;
  label: string;
  text: string;
}

export function detailEntries(p: PersonalData, hidden: Set<PersonalFieldKey>, labels: CvLabels): DetailEntry[] {
  const list: DetailEntry[] = [];
  const birth = !hidden.has('birthDate') && p.birthDate ? formatPartialDate(p.birthDate, 'DD.MM.YYYY') : '';
  const place = !hidden.has('birthPlace') ? p.birthPlace.trim() : '';
  if (birth || place) {
    const connector = labels.resumeWord === 'CV' ? 'in' : 'in';
    const text = birth && place ? `${birth} ${connector} ${place}` : birth || place;
    list.push({ key: 'birth', icon: 'calendar', label: birth ? labels.birthDate : labels.birthPlace, text });
  }
  if (!hidden.has('nationality') && p.nationality.trim()) list.push({ key: 'nationality', icon: 'flag', label: labels.nationality, text: p.nationality.trim() });
  if (!hidden.has('maritalStatus') && p.maritalStatus.trim()) list.push({ key: 'marital', icon: 'heart', label: labels.maritalStatus, text: p.maritalStatus.trim() });
  return list;
}

function MaybeLink({ href, children }: { href?: string; children: ReactNode }) {
  return href ? (
    <a href={href} className="cv-link">
      {children}
    </a>
  ) : (
    <>{children}</>
  );
}

/** Kontaktdaten als Liste (Seitenspalte) oder Zeile (Kopfbereich) */
export function ContactList({
  entries,
  variant,
  icons,
  showLabels = false,
}: {
  entries: (ContactEntry | DetailEntry)[];
  variant: 'list' | 'inline';
  icons: DesignSettings['iconStyle'];
  showLabels?: boolean;
}) {
  if (entries.length === 0) return null;
  return (
    <ul className={clsx('cv-contact', `cv-contact--${variant}`, `cv-icons-${icons}`)}>
      {entries.map((e) => (
        <li key={e.key} className="cv-contact-item">
          {icons !== 'none' ? <CvIcon name={e.icon} /> : null}
          {showLabels && icons === 'none' ? <span className="cv-contact-label">{e.label}: </span> : null}
          <span className="cv-contact-text">
            <MaybeLink href={'href' in e ? e.href : undefined}>{e.text}</MaybeLink>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Photo({ url, design }: { url: string; design: DesignSettings }) {
  return (
    <div className={clsx('cv-photo', `cv-photo--${design.photoShape}`)}>
      <img src={url} alt="" />
    </div>
  );
}

export function Name({ personal }: { personal: PersonalData }) {
  return (
    <h1 className="cv-name">
      <span className="cv-name-first">{personal.firstName}</span> <span className="cv-name-last">{personal.lastName}</span>
    </h1>
  );
}

/** Zeile mit linker Datumsspalte (klassischer deutscher Lebenslauf) */
export function Row({ date, children, className }: { date?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('cv-row', className)}>
      <div className="cv-row-date">{date}</div>
      <div className="cv-row-body">{children}</div>
    </div>
  );
}

export function EntryHead({
  title,
  subtitle,
  date,
  dates,
  extra,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  date?: string;
  dates: 'right' | 'left' | 'above';
  extra?: ReactNode;
}) {
  const sub = subtitle ? <div className="cv-entry-sub">{subtitle}</div> : null;
  if (dates === 'left') {
    return (
      <div className="cv-entry-head">
        <div className="cv-entry-title">{title}</div>
        {sub}
        {extra}
      </div>
    );
  }
  if (dates === 'above') {
    return (
      <div className="cv-entry-head cv-entry-head--above">
        {date ? <div className="cv-entry-date">{date}</div> : null}
        <div className="cv-entry-title">{title}</div>
        {sub}
        {extra}
      </div>
    );
  }
  return (
    <div className="cv-entry-head cv-entry-head--right">
      <div className="cv-entry-line">
        <div className="cv-entry-title">{title}</div>
        {date ? <div className="cv-entry-date">{date}</div> : null}
      </div>
      {sub}
      {extra}
    </div>
  );
}

export function joinParts(parts: (string | undefined | null | false)[], sep = ' · '): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(sep);
}
