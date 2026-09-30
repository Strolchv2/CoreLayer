import type {
  CertificateCategory,
  InterestCategory,
  LanguageLevel,
  Locale,
  SectionKey,
  TrainingKind,
} from './constants.js';

/**
 * Beschriftungen, die im Lebenslauf/PDF selbst erscheinen (nicht die UI!).
 * Die Lebenslaufsprache ist unabhängig von der UI-Sprache wählbar.
 */
export interface CvLabels {
  sections: Record<SectionKey, string>;
  present: string;
  tasks: string;
  achievements: string;
  projects: string;
  technologies: string;
  results: string;
  grade: string;
  duration: string;
  certificate: string;
  validUntil: string;
  credentialId: string;
  experienceYears: string;
  expertise: string;
  strengths: string;
  referencesOnRequest: string;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  maritalStatus: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  personalDetails: string;
  contact: string;
  page: (current: number, total: number) => string;
  resumeWord: string;
  coverLetterWord: string;
  applicationWord: string;
  languageLevels: Record<LanguageLevel, string>;
  trainingKinds: Record<TrainingKind, string>;
  certificateCategories: Record<CertificateCategory, string>;
  interestCategories: Record<InterestCategory, string>;
  attachments: string;
}

export const CV_LABELS: Record<Locale, CvLabels> = {
  de: {
    sections: {
      profile: 'Profil',
      experience: 'Berufserfahrung',
      education: 'Ausbildung',
      internships: 'Praktika',
      trainings: 'Weiterbildungen',
      certificates: 'Zertifikate & Qualifikationen',
      skills: 'Kenntnisse',
      languages: 'Sprachkenntnisse',
      projects: 'Projekte',
      volunteering: 'Ehrenamt',
      interests: 'Interessen & Hobbys',
      references: 'Referenzen',
    },
    present: 'heute',
    tasks: 'Aufgaben',
    achievements: 'Erfolge',
    projects: 'Projekte',
    technologies: 'Technologien',
    results: 'Ergebnisse',
    grade: 'Abschlussnote',
    duration: 'Dauer',
    certificate: 'Zertifikat',
    validUntil: 'gültig bis',
    credentialId: 'Nr.',
    experienceYears: 'Berufserfahrung',
    expertise: 'Fachgebiet',
    strengths: 'Schwerpunkte',
    referencesOnRequest: 'Referenzen auf Anfrage',
    birthDate: 'Geburtsdatum',
    birthPlace: 'Geburtsort',
    nationality: 'Staatsangehörigkeit',
    maritalStatus: 'Familienstand',
    address: 'Adresse',
    phone: 'Telefon',
    email: 'E-Mail',
    website: 'Webseite',
    personalDetails: 'Persönliche Daten',
    contact: 'Kontakt',
    page: (c, t) => `Seite ${c} von ${t}`,
    resumeWord: 'Lebenslauf',
    coverLetterWord: 'Anschreiben',
    applicationWord: 'Bewerbung',
    languageLevels: {
      native: 'Muttersprache',
      C2: 'C2 – annähernd muttersprachlich',
      C1: 'C1 – verhandlungssicher',
      B2: 'B2 – fließend',
      B1: 'B1 – gute Kenntnisse',
      A2: 'A2 – Grundkenntnisse',
      A1: 'A1 – Anfänger',
    },
    trainingKinds: {
      training: 'Weiterbildung',
      certificate: 'Zertifikat',
      seminar: 'Seminar',
      course: 'Lehrgang',
      workshop: 'Schulung',
    },
    certificateCategories: {
      drivers_license: 'Führerschein',
      first_aid: 'Erste Hilfe',
      safety: 'Sicherheitsunterweisung',
      professional: 'Fachzertifikat',
      technical: 'Technisches Zertifikat',
      other: 'Qualifikation',
    },
    interestCategories: {
      interest: 'Interessen',
      hobby: 'Hobbys',
      club: 'Vereine',
      sport: 'Sport',
      other: 'Sonstiges',
    },
    attachments: 'Anlagen',
  },
  en: {
    sections: {
      profile: 'Profile',
      experience: 'Professional Experience',
      education: 'Education',
      internships: 'Internships',
      trainings: 'Further Training',
      certificates: 'Certifications & Qualifications',
      skills: 'Skills',
      languages: 'Languages',
      projects: 'Projects',
      volunteering: 'Volunteering',
      interests: 'Interests & Hobbies',
      references: 'References',
    },
    present: 'present',
    tasks: 'Responsibilities',
    achievements: 'Achievements',
    projects: 'Projects',
    technologies: 'Technologies',
    results: 'Results',
    grade: 'Grade',
    duration: 'Duration',
    certificate: 'Certificate',
    validUntil: 'valid until',
    credentialId: 'No.',
    experienceYears: 'Experience',
    expertise: 'Field of expertise',
    strengths: 'Key strengths',
    referencesOnRequest: 'References available upon request',
    birthDate: 'Date of birth',
    birthPlace: 'Place of birth',
    nationality: 'Nationality',
    maritalStatus: 'Marital status',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
    website: 'Website',
    personalDetails: 'Personal details',
    contact: 'Contact',
    page: (c, t) => `Page ${c} of ${t}`,
    resumeWord: 'CV',
    coverLetterWord: 'Cover Letter',
    applicationWord: 'Application',
    languageLevels: {
      native: 'Native speaker',
      C2: 'C2 – Proficient',
      C1: 'C1 – Advanced',
      B2: 'B2 – Upper intermediate',
      B1: 'B1 – Intermediate',
      A2: 'A2 – Elementary',
      A1: 'A1 – Beginner',
    },
    trainingKinds: {
      training: 'Training',
      certificate: 'Certificate',
      seminar: 'Seminar',
      course: 'Course',
      workshop: 'Workshop',
    },
    certificateCategories: {
      drivers_license: "Driver's licence",
      first_aid: 'First aid',
      safety: 'Safety training',
      professional: 'Professional certificate',
      technical: 'Technical certificate',
      other: 'Qualification',
    },
    interestCategories: {
      interest: 'Interests',
      hobby: 'Hobbies',
      club: 'Clubs',
      sport: 'Sports',
      other: 'Other',
    },
    attachments: 'Attachments',
  },
};

export function getCvLabels(locale: string): CvLabels {
  return CV_LABELS[(locale as Locale) in CV_LABELS ? (locale as Locale) : 'de'];
}

/** Numerischer Wert eines Sprachniveaus (für Balken-/Punktdarstellung). */
export const LANGUAGE_LEVEL_SCORE: Record<LanguageLevel, number> = {
  native: 5,
  C2: 5,
  C1: 4,
  B2: 3,
  B1: 3,
  A2: 2,
  A1: 1,
};
