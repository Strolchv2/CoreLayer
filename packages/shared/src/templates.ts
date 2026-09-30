import type { Locale, SectionKey, TemplateKey } from './constants.js';
import { BASE_DESIGN, type DesignSettings } from './schemas/design.js';

export type TemplateLayout = 'single' | 'sidebar-left' | 'sidebar-right';

export interface TemplateMeta {
  key: TemplateKey;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  layout: TemplateLayout;
  /** Einspaltig, ohne grafische Elemente in Kerninformationen – gut für Bewerbermanagementsysteme */
  atsFriendly: boolean;
  /** Abschnitte, die bei zweispaltigen Vorlagen standardmäßig in die Seitenspalte gehören */
  sidebarSections: SectionKey[];
  defaultDesign: DesignSettings;
  /** Farbvorschläge im Design-Editor */
  palette: string[];
}

const SIDEBAR_DEFAULT: SectionKey[] = ['skills', 'languages', 'certificates', 'interests'];

const d = (overrides: Partial<DesignSettings>): DesignSettings => ({ ...BASE_DESIGN, ...overrides });

export const TEMPLATES: Record<TemplateKey, TemplateMeta> = {
  classic: {
    key: 'classic',
    name: { de: 'Classic', en: 'Classic' },
    description: {
      de: 'Zeitlos und seriös – klassischer deutscher Lebenslauf mit klarer Gliederung.',
      en: 'Timeless and serious – a traditional CV with a clear structure.',
    },
    layout: 'single',
    atsFriendly: true,
    sidebarSections: [],
    defaultDesign: d({
      primaryColor: '#243b53',
      secondaryColor: '#627d98',
      fontFamily: 'source-sans',
      headingFontFamily: 'merriweather',
      fontSize: 10,
      headingScale: 1.2,
      headerStyle: 'split',
      photoShape: 'rounded',
      lines: 'thin',
      iconStyle: 'none',
    }),
    palette: ['#243b53', '#1f2937', '#3b3b58', '#0f4c5c', '#5c3d2e'],
  },
  modern: {
    key: 'modern',
    name: { de: 'Modern', en: 'Modern' },
    description: {
      de: 'Farbige Seitenspalte mit Foto, Kontakt und Kenntnissen – modern und übersichtlich.',
      en: 'Coloured sidebar with photo, contact details and skills – modern and clear.',
    },
    layout: 'sidebar-left',
    atsFriendly: false,
    sidebarSections: SIDEBAR_DEFAULT,
    defaultDesign: d({
      primaryColor: '#1e3a5f',
      secondaryColor: '#3d7ea6',
      fontFamily: 'inter',
      headingFontFamily: 'inter',
      sidebarWidth: 33,
      photoShape: 'circle',
      photoSize: 36,
      lines: 'none',
      background: 'accent-band',
    }),
    palette: ['#1e3a5f', '#14532d', '#312e81', '#7c2d12', '#334155'],
  },
  minimal: {
    key: 'minimal',
    name: { de: 'Minimal', en: 'Minimal' },
    description: {
      de: 'Reduziert auf das Wesentliche – viel Weißraum, ruhige Typografie.',
      en: 'Reduced to the essentials – generous white space and calm typography.',
    },
    layout: 'single',
    atsFriendly: true,
    sidebarSections: [],
    defaultDesign: d({
      primaryColor: '#111827',
      secondaryColor: '#6b7280',
      fontFamily: 'lato',
      headingFontFamily: 'lato',
      fontSize: 9.5,
      headingScale: 1.1,
      pageMargin: 20,
      lines: 'none',
      iconStyle: 'none',
      photoShape: 'square',
      photoSize: 30,
    }),
    palette: ['#111827', '#374151', '#1e40af', '#065f46', '#9f1239'],
  },
  professional: {
    key: 'professional',
    name: { de: 'Professional', en: 'Professional' },
    description: {
      de: 'Farbiger Kopfbereich und dezente Seitenspalte – ideal für Fach- und Führungskräfte.',
      en: 'Coloured header with a subtle sidebar – ideal for specialists and managers.',
    },
    layout: 'sidebar-right',
    atsFriendly: false,
    sidebarSections: SIDEBAR_DEFAULT,
    defaultDesign: d({
      primaryColor: '#0f4c81',
      secondaryColor: '#5a7184',
      fontFamily: 'open-sans',
      headingFontFamily: 'open-sans',
      fontSize: 9.25,
      sidebarWidth: 31,
      headerStyle: 'colored',
      photoShape: 'circle',
      lines: 'thin',
    }),
    palette: ['#0f4c81', '#1f2937', '#155e75', '#4c1d95', '#7f1d1d'],
  },
  executive: {
    key: 'executive',
    name: { de: 'Executive', en: 'Executive' },
    description: {
      de: 'Souverän und hochwertig – für Führungspositionen mit starker Hierarchie.',
      en: 'Confident and premium – for leadership roles with a strong hierarchy.',
    },
    layout: 'single',
    atsFriendly: true,
    sidebarSections: [],
    defaultDesign: d({
      primaryColor: '#1b2a41',
      secondaryColor: '#8a7045',
      fontFamily: 'source-sans',
      headingFontFamily: 'eb-garamond',
      fontSize: 10,
      headingScale: 1.35,
      headerStyle: 'colored',
      lines: 'thick',
      photoShape: 'rounded',
      iconStyle: 'none',
    }),
    palette: ['#1b2a41', '#2d2a32', '#123524', '#3e2723', '#1e1b4b'],
  },
  creative: {
    key: 'creative',
    name: { de: 'Creative', en: 'Creative' },
    description: {
      de: 'Ausdrucksstark mit kräftiger Akzentfarbe – für kreative und moderne Berufe.',
      en: 'Expressive with a bold accent colour – for creative and modern professions.',
    },
    layout: 'sidebar-left',
    atsFriendly: false,
    sidebarSections: SIDEBAR_DEFAULT,
    defaultDesign: d({
      primaryColor: '#0f766e',
      secondaryColor: '#f59e0b',
      fontFamily: 'open-sans',
      headingFontFamily: 'lato',
      sidebarWidth: 34,
      headingScale: 1.35,
      photoShape: 'circle',
      photoSize: 38,
      iconStyle: 'filled',
      lines: 'none',
      background: 'tinted',
    }),
    palette: ['#0f766e', '#be185d', '#6d28d9', '#c2410c', '#0369a1'],
  },
  ats: {
    key: 'ats',
    name: { de: 'ATS', en: 'ATS' },
    description: {
      de: 'Maximal maschinenlesbar – einspaltig, ohne Grafiken, mit Standardüberschriften.',
      en: 'Maximum machine readability – single column, no graphics, standard headings.',
    },
    layout: 'single',
    atsFriendly: true,
    sidebarSections: [],
    defaultDesign: d({
      primaryColor: '#111111',
      secondaryColor: '#444444',
      textColor: '#111111',
      fontFamily: 'arimo',
      headingFontFamily: 'arimo',
      fontSize: 10,
      headingScale: 1.2,
      showPhoto: false,
      iconStyle: 'none',
      lines: 'thin',
      showPageNumbers: false,
    }),
    palette: ['#111111', '#1f2937', '#1e3a8a'],
  },
  technical: {
    key: 'technical',
    name: { de: 'Technical', en: 'Technical' },
    description: {
      de: 'Strukturiert und präzise – mit Fokus auf Technologien, Projekte und Werkzeuge.',
      en: 'Structured and precise – focused on technologies, projects and tools.',
    },
    layout: 'sidebar-right',
    atsFriendly: false,
    sidebarSections: ['skills', 'languages', 'certificates', 'interests'],
    defaultDesign: d({
      primaryColor: '#0b5394',
      secondaryColor: '#38761d',
      fontFamily: 'ibm-plex-sans',
      headingFontFamily: 'jetbrains-mono',
      fontSize: 9.25,
      headingScale: 1.15,
      sidebarWidth: 30,
      photoShape: 'rounded',
      photoSize: 30,
      lines: 'thin',
    }),
    palette: ['#0b5394', '#1f2937', '#166534', '#7e22ce', '#b45309'],
  },
  elegant: {
    key: 'elegant',
    name: { de: 'Elegant', en: 'Elegant' },
    description: {
      de: 'Feine Serifenschrift und zentrierter Kopf – stilvoll und hochwertig.',
      en: 'Refined serif typography with a centred header – stylish and premium.',
    },
    layout: 'single',
    atsFriendly: true,
    sidebarSections: [],
    defaultDesign: d({
      primaryColor: '#3d3d3d',
      secondaryColor: '#9c7c4c',
      fontFamily: 'lato',
      headingFontFamily: 'playfair',
      fontSize: 9.75,
      headingScale: 1.3,
      headerStyle: 'centered',
      lines: 'double',
      photoShape: 'circle',
      iconStyle: 'none',
    }),
    palette: ['#3d3d3d', '#2f3e46', '#5e3023', '#264653', '#4a4e69'],
  },
};

export const TEMPLATE_LIST: TemplateMeta[] = Object.values(TEMPLATES);

export function getTemplateMeta(key: string): TemplateMeta {
  return TEMPLATES[key as TemplateKey] ?? TEMPLATES.modern;
}
