import { getTemplateMeta, type SectionConfig, type TemplateKey } from '@cv-studio/shared';
import type { ColumnLayoutKind } from './PaginatedDocument';

/** Darstellungsspezifische Eigenschaften einer Vorlage (ergänzt die Metadaten aus @cv-studio/shared). */
export interface TemplateRenderConfig {
  key: TemplateKey;
  layout: ColumnLayoutKind;
  /** 'top' = Kopfbereich über den Spalten, 'sidebar' = Foto/Kontakt in der Seitenspalte, Name in der Hauptspalte */
  header: 'top' | 'sidebar';
  /** Datumsdarstellung bei Einträgen */
  dates: 'right' | 'left' | 'above';
  /** Zeitleisten-Optik (vertikale Linie mit Punkten) */
  timeline?: boolean;
}

export const TEMPLATE_RENDER: Record<TemplateKey, TemplateRenderConfig> = {
  classic: { key: 'classic', layout: 'single', header: 'top', dates: 'left' },
  modern: { key: 'modern', layout: 'sidebar-left', header: 'sidebar', dates: 'above' },
  minimal: { key: 'minimal', layout: 'single', header: 'top', dates: 'left' },
  professional: { key: 'professional', layout: 'sidebar-right', header: 'top', dates: 'right' },
  executive: { key: 'executive', layout: 'single', header: 'top', dates: 'right' },
  creative: { key: 'creative', layout: 'sidebar-left', header: 'sidebar', dates: 'above', timeline: true },
  ats: { key: 'ats', layout: 'single', header: 'top', dates: 'right' },
  technical: { key: 'technical', layout: 'sidebar-right', header: 'top', dates: 'right' },
  elegant: { key: 'elegant', layout: 'single', header: 'top', dates: 'left' },
};

export function getTemplateRender(key: string): TemplateRenderConfig {
  return TEMPLATE_RENDER[key as TemplateKey] ?? TEMPLATE_RENDER.modern;
}

/** In welche Spalte gehört ein Abschnitt? */
export function sectionColumn(section: SectionConfig, templateKey: TemplateKey): 'main' | 'sidebar' {
  const render = getTemplateRender(templateKey);
  if (render.layout === 'single') return 'main';
  const choice = section.options.column ?? 'auto';
  if (choice === 'main' || choice === 'sidebar') return choice;
  return getTemplateMeta(templateKey).sidebarSections.includes(section.key) ? 'sidebar' : 'main';
}
