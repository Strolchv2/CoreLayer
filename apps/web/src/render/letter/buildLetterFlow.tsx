import {
  createEmptyContent,
  formatPartialDate,
  getCvLabels,
  splitParagraphs,
  type CoverLetterRenderData,
  type PersonalData,
} from '@cv-studio/shared';
import clsx from 'clsx';
import type { DocumentFlow, FlowItem } from '../flow';
import { ContactList, contactEntries, joinParts, Name, Photo } from '../resume/parts';

/** Absenderdaten: aus dem verknüpften Lebenslauf oder aus den Briefangaben. */
function senderPersonal(data: CoverLetterRenderData): PersonalData {
  if (data.personal) return data.personal;
  const s = data.content.sender;
  const [first = '', ...rest] = s.name.trim().split(' ');
  return {
    ...createEmptyContent().personal,
    firstName: first,
    lastName: rest.join(' '),
    street: s.street,
    postalCode: s.postalCode,
    city: s.city,
    phone: s.phone,
    email: s.email,
    hidden: [],
  };
}

function todayPartial(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function buildLetterFlow(data: CoverLetterRenderData, photoUrl: string | null): DocumentFlow {
  const labels = getCvLabels(data.language);
  const c = data.content;
  const personal = senderPersonal(data);
  // Sender-Angaben im Brief haben Vorrang vor den Lebenslaufdaten
  const letterPersonal: PersonalData = {
    ...personal,
    street: c.sender.street || personal.street,
    postalCode: c.sender.postalCode || personal.postalCode,
    city: c.sender.city || personal.city,
    phone: c.sender.phone || personal.phone,
    email: c.sender.email || personal.email,
  };
  const hidden = new Set(letterPersonal.hidden);
  const contacts = contactEntries(letterPersonal, hidden, labels);
  const showPhoto = Boolean(photoUrl) && data.design.showPhoto && !hidden.has('photo');

  const top = (
    <header className={clsx('cv-header', `cv-header--${data.design.headerStyle}`)}>
      {showPhoto && photoUrl ? <Photo url={photoUrl} design={{ ...data.design, photoSize: Math.min(data.design.photoSize, 28) }} /> : null}
      <div className="cv-header-main">
        {c.sender.name.trim() && !letterPersonal.firstName ? <h1 className="cv-name">{c.sender.name}</h1> : <Name personal={letterPersonal} />}
        {letterPersonal.jobTitle.trim() && !hidden.has('jobTitle') ? <div className="cv-jobtitle">{letterPersonal.jobTitle}</div> : null}
        <ContactList entries={contacts} variant="inline" icons={data.design.iconStyle} />
      </div>
    </header>
  );

  const senderName = c.sender.name.trim() || [letterPersonal.firstName, letterPersonal.lastName].filter(Boolean).join(' ');
  const senderLine = joinParts([senderName, letterPersonal.street, joinParts([letterPersonal.postalCode, letterPersonal.city], ' ')]);
  const r = c.recipient;
  const recipientLines = [r.company, r.department, r.contactPerson, r.street, joinParts([r.postalCode, r.city], ' ')].filter((l) => l.trim());
  const date = formatPartialDate(c.date || todayPartial(), 'DD.MM.YYYY');
  const place = c.place.trim() || letterPersonal.city;

  const main: FlowItem[] = [
    {
      key: 'address',
      fragments: [
        {
          key: 'address',
          gap: 'none',
          node: (
            <div className="cv-letter-address">
              {senderLine ? <div className="cv-letter-sender-line">{senderLine}</div> : null}
              {recipientLines.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          ),
        },
      ],
    },
    { key: 'date', fragments: [{ key: 'date', gap: 'section', node: <div className="cv-letter-date">{joinParts([place, date], ', ')}</div> }] },
  ];
  if (c.subject.trim()) {
    main.push({ key: 'subject', keepWithNext: true, fragments: [{ key: 'subject', gap: 'section', node: <div className="cv-letter-subject">{c.subject}</div> }] });
  }
  if (c.salutation.trim()) {
    main.push({ key: 'salutation', keepWithNext: true, fragments: [{ key: 'salutation', gap: 'section', node: <p className="cv-p">{c.salutation}</p> }] });
  }
  const paragraphs = splitParagraphs(c.body);
  if (paragraphs.length) {
    main.push({
      key: 'body',
      splittable: true,
      fragments: paragraphs.map((p, i) => ({
        key: `body:${i}`,
        gap: 'item' as const,
        text: {
          value: p,
          render: (t: string) => (
            <p className="cv-p" data-text="">
              {t}
            </p>
          ),
        },
      })),
    });
  }
  main.push({
    key: 'closing',
    fragments: [
      {
        key: 'closing',
        gap: 'section',
        node: (
          <div className="cv-letter-closing">
            {c.closing.trim() ? <p className="cv-p">{c.closing}</p> : null}
            <div className="cv-letter-signature">
              {data.signatureUrl ? <img src={data.signatureUrl} alt="" /> : <div className="cv-letter-signature-space" />}
            </div>
            {(c.signatureName || senderName).trim() ? <p className="cv-p">{c.signatureName || senderName}</p> : null}
          </div>
        ),
      },
    ],
  });

  return { top, main };
}
