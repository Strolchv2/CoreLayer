/**
 * Demo-Lebenslauf mit realistischen, aber vollständig fiktiven Beispieldaten.
 * Dient ausschließlich zur Darstellung der Anwendung (Vorlagen-Galerie, Beispiel-Lebenslauf).
 * Domains nutzen die reservierte TLD ".example" (RFC 2606).
 */
import type { Locale } from './constants.js';
import { createEmptyContent, createLink, createSkill } from './factory.js';
import { createId } from './ids.js';
import type { CoverLetterContent } from './schemas/coverLetter.js';
import type { ResumeContent } from './schemas/resume.js';

export function createDemoContent(locale: Locale = 'de'): ResumeContent {
  return locale === 'en' ? demoEn() : demoDe();
}

function demoDe(): ResumeContent {
  const c = createEmptyContent();
  c.personal = {
    ...c.personal,
    firstName: 'Max',
    lastName: 'Mustermann',
    jobTitle: 'Elektromeister & Projektleiter',
    birthDate: '1988-04-12',
    birthPlace: 'Musterstadt',
    nationality: 'deutsch',
    maritalStatus: 'verheiratet',
    street: 'Musterstraße 12',
    postalCode: '12345',
    city: 'Musterstadt',
    country: 'Deutschland',
    phone: '+49 170 0000000',
    email: 'max.mustermann@example.com',
    website: 'max-mustermann.example',
    linkedin: 'linkedin.example/in/max-mustermann',
    github: '',
    links: [],
    hidden: ['maritalStatus'],
  };
  c.profile = {
    headline: 'Elektromeister mit Projektverantwortung',
    summary:
      'Engagierter Elektromeister mit über 12 Jahren Erfahrung in der Planung, Installation und Inbetriebnahme elektrischer Anlagen in Industrie- und Gewerbebauten. Seit 2022 verantwortlich für die Leitung von Projekten mit bis zu 15 Mitarbeitenden – von der Kalkulation bis zur Abnahme. Strukturierte Arbeitsweise, hohes Qualitätsbewusstsein und Freude an der Ausbildung junger Fachkräfte.',
    experience: '12 Jahre',
    expertise: 'Elektro- und Gebäudetechnik',
    strengths: ['Projektleitung & Koordination', 'Normgerechte Planung (VDE)', 'Mitarbeiterführung'],
  };
  c.experience = [
    {
      id: createId(),
      visible: true,
      employer: 'Montage Werk GmbH',
      jobTitle: 'Elektromeister / Projektleiter',
      location: 'Garrel',
      startDate: '2022-01',
      endDate: '',
      current: true,
      description: 'Fachliche und disziplinarische Leitung von Elektroinstallationsprojekten im Industrie- und Gewerbebau.',
      tasks: [
        'Planung elektrischer Anlagen nach DIN VDE',
        'Projektleitung von der Kalkulation bis zur Abnahme',
        'Koordination von bis zu 15 Mitarbeitenden und Subunternehmen',
        'Abnahme- und Wiederholungsprüfungen nach DGUV V3',
      ],
      achievements: [
        'Betreuung mehrerer Großprojekte mit einem Volumen von über 2 Mio. €',
        'Optimierung interner Arbeitsabläufe – Durchlaufzeit pro Projekt um ca. 15 % reduziert',
      ],
      projects: [],
    },
    {
      id: createId(),
      visible: true,
      employer: 'Elektro Nordwest GmbH & Co. KG',
      jobTitle: 'Elektroniker für Energie- und Gebäudetechnik',
      location: 'Musterstadt',
      startDate: '2014-08',
      endDate: '2021-12',
      current: false,
      description: 'Installation und Wartung von Energie- und Gebäudetechnik für Gewerbe- und Privatkunden.',
      tasks: [
        'Installation von Niederspannungs- und KNX-Anlagen',
        'Fehlersuche und Instandsetzung',
        'Anleitung von Auszubildenden',
      ],
      achievements: ['Aufbau des Geschäftsbereichs Photovoltaik mit mehr als 80 installierten Anlagen'],
      projects: [],
    },
    {
      id: createId(),
      visible: true,
      employer: 'Stadtwerke Musterstadt',
      jobTitle: 'Elektroniker (Gesellenzeit)',
      location: 'Musterstadt',
      startDate: '2011-02',
      endDate: '2014-07',
      current: false,
      description: 'Wartung und Instandhaltung von Mittel- und Niederspannungsnetzen.',
      tasks: ['Störungsbeseitigung im Bereitschaftsdienst', 'Montage von Hausanschlüssen'],
      achievements: [],
      projects: [],
    },
  ];
  c.education = [
    {
      id: createId(),
      visible: true,
      institution: 'Meisterschule der Handwerkskammer Musterstadt',
      degree: 'Elektrotechnikermeister',
      fieldOfStudy: 'Energie- und Gebäudetechnik',
      location: 'Musterstadt',
      startDate: '2019-09',
      endDate: '2021-06',
      current: false,
      grade: '1,8',
      description: 'Berufsbegleitende Meisterschule (Teile I–IV)',
    },
    {
      id: createId(),
      visible: true,
      institution: 'Elektro Schmidt GmbH / Berufsbildende Schulen Musterstadt',
      degree: 'Ausbildung zum Elektroniker',
      fieldOfStudy: 'Energie- und Gebäudetechnik',
      location: 'Musterstadt',
      startDate: '2007-08',
      endDate: '2011-01',
      current: false,
      grade: '',
      description: '',
    },
  ];
  c.trainings = [
    {
      id: createId(),
      visible: true,
      kind: 'course',
      title: 'Befähigte Person zur Prüfung elektrischer Arbeitsmittel',
      provider: 'TÜV-Akademie (Beispiel)',
      date: '2023-03',
      duration: '3 Tage',
      certificate: 'Zertifikat',
      description: '',
    },
    {
      id: createId(),
      visible: true,
      kind: 'seminar',
      title: 'Projektmanagement im Handwerk',
      provider: 'Bildungszentrum Musterstadt',
      date: '2022-10',
      duration: '5 Tage',
      certificate: 'Teilnahmebescheinigung',
      description: '',
    },
  ];
  c.skills = [
    {
      id: createId(),
      visible: true,
      name: 'Fachkenntnisse',
      items: [
        createSkill('Elektroinstallation', 5),
        createSkill('KNX / Gebäudeautomation', 4),
        createSkill('Photovoltaik & Speicher', 4),
        createSkill('Prüfung nach DGUV V3', 5),
      ],
    },
    {
      id: createId(),
      visible: true,
      name: 'Software',
      items: [createSkill('MS Office', 4), createSkill('ETS 6', 4), createSkill('DDS-CAD', 3)],
    },
  ];
  c.languages = [
    { id: createId(), visible: true, name: 'Deutsch', level: 'native', note: '' },
    { id: createId(), visible: true, name: 'Englisch', level: 'B2', note: '' },
  ];
  c.certificates = [
    {
      id: createId(),
      visible: true,
      category: 'drivers_license',
      name: 'Führerschein Klasse B, BE',
      issuer: '',
      date: '',
      validUntil: '',
      credentialId: '',
      description: '',
    },
    {
      id: createId(),
      visible: true,
      category: 'first_aid',
      name: 'Ersthelfer (betrieblich)',
      issuer: 'Hilfsorganisation (Beispiel)',
      date: '2024-02',
      validUntil: '2026-02',
      credentialId: '',
      description: '',
    },
  ];
  c.projects = [
    {
      id: createId(),
      visible: true,
      name: 'Neubau Logistikzentrum',
      role: 'Projektleitung Elektro',
      startDate: '2023-02',
      endDate: '2024-05',
      current: false,
      description: 'Komplette Elektroinstallation einer 12.000 m² Logistikhalle inkl. Beleuchtungssteuerung.',
      technologies: ['KNX', 'DALI', 'Photovoltaik 750 kWp'],
      results: ['Termingerechte Übergabe', 'Budget um 4 % unterschritten'],
      link: '',
    },
  ];
  c.volunteering = [
    {
      id: createId(),
      visible: true,
      organization: 'Freiwillige Feuerwehr Musterstadt',
      role: 'Gruppenführer',
      location: 'Musterstadt',
      startDate: '2010-01',
      endDate: '',
      current: true,
      description: '',
    },
  ];
  c.interests = [
    { id: createId(), visible: true, category: 'sport', name: 'Radsport', description: '' },
    { id: createId(), visible: true, category: 'hobby', name: 'Smart-Home-Projekte', description: '' },
  ];
  c.references = [];
  c.sections = c.sections.map((s) =>
    s.key === 'references' ? { ...s, options: { onRequest: true } } : s.key === 'skills' ? { ...s, options: { display: 'bars' } } : s,
  );
  return c;
}

function demoEn(): ResumeContent {
  const c = demoDe();
  c.personal.jobTitle = 'Master Electrician & Project Manager';
  c.personal.nationality = 'German';
  c.personal.country = 'Germany';
  c.personal.street = '12 Sample Street';
  c.profile = {
    headline: 'Master electrician with project responsibility',
    summary:
      'Dedicated master electrician with more than 12 years of experience in planning, installing and commissioning electrical systems for industrial and commercial buildings. Since 2022 responsible for leading projects with up to 15 team members – from cost estimation to final acceptance. Structured, quality-focused and passionate about training young professionals.',
    experience: '12 years',
    expertise: 'Electrical & building services engineering',
    strengths: ['Project management & coordination', 'Standards-compliant design', 'Team leadership'],
  };
  const [e1, e2, e3] = c.experience;
  if (e1) {
    e1.jobTitle = 'Master Electrician / Project Manager';
    e1.description = 'Technical and personnel management of electrical installation projects.';
    e1.tasks = [
      'Design of electrical systems according to DIN VDE',
      'Project management from estimation to acceptance',
      'Coordination of up to 15 employees and subcontractors',
    ];
    e1.achievements = [
      'Managed several large-scale projects worth more than €2 million',
      'Optimised internal workflows – reduced lead time per project by approx. 15%',
    ];
  }
  if (e2) {
    e2.jobTitle = 'Electronics Technician for Energy and Building Services';
    e2.description = 'Installation and maintenance of energy and building services systems.';
    e2.tasks = ['Installation of low-voltage and KNX systems', 'Troubleshooting and repairs', 'Supervising apprentices'];
    e2.achievements = ['Built up the photovoltaics business with more than 80 installed systems'];
  }
  if (e3) {
    e3.jobTitle = 'Electronics Technician';
    e3.description = 'Maintenance of medium- and low-voltage grids.';
    e3.tasks = ['On-call fault clearance', 'Installation of house connections'];
  }
  const [ed1, ed2] = c.education;
  if (ed1) {
    ed1.degree = 'Master Craftsman in Electrical Engineering';
    ed1.fieldOfStudy = 'Energy and building services';
    ed1.description = 'Part-time master craftsman school';
  }
  if (ed2) {
    ed2.degree = 'Apprenticeship as Electronics Technician';
    ed2.fieldOfStudy = 'Energy and building services';
  }
  c.skills = [
    {
      id: createId(),
      visible: true,
      name: 'Technical skills',
      items: [
        createSkill('Electrical installation', 5),
        createSkill('KNX / building automation', 4),
        createSkill('Photovoltaics & storage', 4),
      ],
    },
    { id: createId(), visible: true, name: 'Software', items: [createSkill('MS Office', 4), createSkill('ETS 6', 4)] },
  ];
  c.languages = [
    { id: createId(), visible: true, name: 'German', level: 'native', note: '' },
    { id: createId(), visible: true, name: 'English', level: 'B2', note: '' },
  ];
  c.trainings = c.trainings.map((t, i) => ({
    ...t,
    title: i === 0 ? 'Qualified person for testing electrical equipment' : 'Project management in the trades',
    duration: i === 0 ? '3 days' : '5 days',
    certificate: i === 0 ? 'Certificate' : 'Certificate of attendance',
  }));
  c.certificates = c.certificates.map((ct, i) => ({
    ...ct,
    name: i === 0 ? "Driver's licence class B, BE" : 'Company first aider',
    issuer: i === 0 ? '' : 'Relief organisation (sample)',
  }));
  c.projects = c.projects.map((p) => ({
    ...p,
    name: 'New logistics centre',
    role: 'Electrical project lead',
    description: 'Complete electrical installation of a 12,000 m² logistics hall incl. lighting control.',
    results: ['Handed over on schedule', '4% under budget'],
  }));
  c.volunteering = c.volunteering.map((v) => ({ ...v, organization: 'Volunteer Fire Department', role: 'Squad leader' }));
  c.interests = [
    { id: createId(), visible: true, category: 'sport', name: 'Cycling', description: '' },
    { id: createId(), visible: true, category: 'hobby', name: 'Smart home projects', description: '' },
  ];
  c.personal.links = [createLink('Portfolio', 'max-mustermann.example/projects')];
  return c;
}

export function createDemoCoverLetter(locale: Locale = 'de'): CoverLetterContent {
  if (locale === 'en') {
    return {
      sender: {
        name: 'Max Mustermann',
        street: '12 Sample Street',
        postalCode: '12345',
        city: 'Musterstadt',
        phone: '+49 170 0000000',
        email: 'max.mustermann@example.com',
      },
      recipient: {
        company: 'Sample Engineering Ltd.',
        contactPerson: 'Ms Jane Doe',
        department: 'Human Resources',
        street: '1 Example Road',
        postalCode: '54321',
        city: 'Sampletown',
      },
      place: 'Musterstadt',
      date: '',
      subject: 'Application as Electrical Project Manager',
      salutation: 'Dear Ms Doe,',
      body:
        'With great interest I read your advertisement for an Electrical Project Manager. As a master electrician with more than twelve years of professional experience, I would like to contribute my expertise to your team.\n\nIn my current position at Montage Werk GmbH I am responsible for electrical installation projects from estimation to final acceptance and coordinate teams of up to 15 people. I particularly value clear communication with clients and trades.\n\nI look forward to hearing from you and to the opportunity of a personal interview.',
      closing: 'Kind regards,',
      signatureName: 'Max Mustermann',
      signatureDocumentId: null,
    };
  }
  return {
    sender: {
      name: 'Max Mustermann',
      street: 'Musterstraße 12',
      postalCode: '12345',
      city: 'Musterstadt',
      phone: '+49 170 0000000',
      email: 'max.mustermann@example.com',
    },
    recipient: {
      company: 'Beispiel Elektrotechnik AG',
      contactPerson: 'Frau Erika Beispiel',
      department: 'Personalabteilung',
      street: 'Beispielweg 1',
      postalCode: '54321',
      city: 'Beispielstadt',
    },
    place: 'Musterstadt',
    date: '',
    subject: 'Bewerbung als Projektleiter Elektrotechnik',
    salutation: 'Sehr geehrte Frau Beispiel,',
    body:
      'mit großem Interesse habe ich Ihre Stellenanzeige für die Position als Projektleiter Elektrotechnik gelesen. Als Elektromeister mit mehr als zwölf Jahren Berufserfahrung möchte ich meine Kompetenzen gerne in Ihr Team einbringen.\n\nIn meiner aktuellen Position bei der Montage Werk GmbH verantworte ich Elektroinstallationsprojekte von der Kalkulation bis zur Abnahme und koordiniere Teams mit bis zu 15 Mitarbeitenden. Besonders wichtig sind mir dabei eine klare Kommunikation mit Bauherren und Gewerken sowie eine termingerechte, normgerechte Ausführung.\n\nÜber die Einladung zu einem persönlichen Gespräch freue ich mich sehr.',
    closing: 'Mit freundlichen Grüßen',
    signatureName: 'Max Mustermann',
    signatureDocumentId: null,
  };
}
