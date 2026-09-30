import { z } from 'zod';
import { FONT_KEYS } from '../constants.js';
import { hexColor } from './common.js';

export const PHOTO_SHAPES = ['circle', 'rounded', 'square'] as const;
export const ICON_STYLES = ['none', 'outline', 'filled'] as const;
export const LINE_STYLES = ['none', 'thin', 'thick', 'double'] as const;
export const BACKGROUND_STYLES = ['white', 'tinted', 'accent-band'] as const;
export const HEADER_STYLES = ['left', 'centered', 'colored', 'split'] as const;

/**
 * Design-Einstellungen eines Lebenslaufs.
 * Größen in pt (Schrift) bzw. mm (Abstände) – druckorientierte Einheiten.
 */
export const designSettingsSchema = z.object({
  primaryColor: hexColor,
  secondaryColor: hexColor,
  textColor: hexColor,
  fontFamily: z.enum(FONT_KEYS),
  headingFontFamily: z.enum(FONT_KEYS),
  /** Grundschriftgröße in pt */
  fontSize: z.number().min(8).max(13),
  /** Faktor für Überschriften relativ zur Grundschrift */
  headingScale: z.number().min(1).max(2),
  lineHeight: z.number().min(1.1).max(2),
  /** Seitenrand in mm */
  pageMargin: z.number().min(8).max(30),
  /** Abstand zwischen Einträgen in mm */
  itemSpacing: z.number().min(0).max(12),
  /** Abstand zwischen Abschnitten in mm */
  sectionSpacing: z.number().min(2).max(20),
  /** Breite der Seitenspalte in Prozent (zweispaltige Vorlagen) */
  sidebarWidth: z.number().min(22).max(45),
  iconStyle: z.enum(ICON_STYLES),
  showPhoto: z.boolean(),
  /** Profilbildgröße in mm */
  photoSize: z.number().min(20).max(50),
  photoShape: z.enum(PHOTO_SHAPES),
  lines: z.enum(LINE_STYLES),
  background: z.enum(BACKGROUND_STYLES),
  headerStyle: z.enum(HEADER_STYLES),
  showPageNumbers: z.boolean(),
});

export type DesignSettings = z.infer<typeof designSettingsSchema>;
export type PhotoShape = (typeof PHOTO_SHAPES)[number];
export type IconStyle = (typeof ICON_STYLES)[number];
export type LineStyle = (typeof LINE_STYLES)[number];
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number];
export type HeaderStyle = (typeof HEADER_STYLES)[number];

/** Allgemeine, professionelle Grundeinstellungen – Vorlagen überschreiben einzelne Werte. */
export const BASE_DESIGN: DesignSettings = {
  primaryColor: '#1f3a5f',
  secondaryColor: '#5b7083',
  textColor: '#1f2328',
  fontFamily: 'inter',
  headingFontFamily: 'inter',
  fontSize: 9.5,
  headingScale: 1.25,
  lineHeight: 1.45,
  pageMargin: 16,
  itemSpacing: 4,
  sectionSpacing: 7,
  sidebarWidth: 32,
  iconStyle: 'outline',
  showPhoto: true,
  photoSize: 34,
  photoShape: 'circle',
  lines: 'thin',
  background: 'white',
  headerStyle: 'left',
  showPageNumbers: true,
};

/** Führt gespeicherte (evtl. unvollständige/ältere) Design-Daten mit Standardwerten zusammen. */
export function normalizeDesign(input: unknown, defaults: DesignSettings): DesignSettings {
  const merged = { ...defaults, ...(typeof input === 'object' && input ? input : {}) };
  const parsed = designSettingsSchema.safeParse(merged);
  if (parsed.success) return parsed.data;
  // Ungültige Einzelwerte verwerfen, gültige behalten
  const result: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(merged)) {
    const field = designSettingsSchema.shape[key as keyof DesignSettings];
    if (field && field.safeParse(value).success) result[key] = value;
  }
  return result as DesignSettings;
}
