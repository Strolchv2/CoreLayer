import type { DateFormat, DesignSettings, TemplateKey } from '@cv-studio/shared';
import clsx from 'clsx';
import type { CSSProperties } from 'react';
import { FONT_STACKS } from './fonts';

const DATE_COLUMN: Record<DateFormat, string> = {
  YYYY: '7.2em',
  'MM/YYYY': '10.6em',
  'MM.YYYY': '10.6em',
  'DD.MM.YYYY': '13.4em',
};

/** Übersetzt Design-Einstellungen in CSS-Variablen (Einheiten: pt/mm – druckorientiert). */
export function designStyle(design: DesignSettings, dateFormat: DateFormat): CSSProperties {
  return {
    '--cv-primary': design.primaryColor,
    '--cv-secondary': design.secondaryColor,
    '--cv-text': design.textColor,
    '--cv-font': FONT_STACKS[design.fontFamily].stack,
    '--cv-heading-font': FONT_STACKS[design.headingFontFamily].stack,
    '--cv-fs': `${design.fontSize}pt`,
    '--cv-hs': String(design.headingScale),
    '--cv-lh': String(design.lineHeight),
    '--cv-margin': `${design.pageMargin}mm`,
    '--cv-item-gap': `${design.itemSpacing}mm`,
    '--cv-section-gap': `${design.sectionSpacing}mm`,
    '--cv-sidebar-w': `${design.sidebarWidth}%`,
    '--cv-photo': `${design.photoSize}mm`,
    '--cv-date-col': DATE_COLUMN[dateFormat],
  } as CSSProperties;
}

export function pageClasses(templateKey: TemplateKey, design: DesignSettings, extra?: string): string {
  return clsx(
    'cv-doc',
    `tpl-${templateKey}`,
    `bg-${design.background}`,
    `lines-${design.lines}`,
    `hdr-${design.headerStyle}`,
    `icons-${design.iconStyle}`,
    extra,
  );
}
