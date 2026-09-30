import type { DateFormat } from './constants.js';

/**
 * Datumswerte werden als "Teil-ISO-Datum" gespeichert:
 *   ''            – nicht gesetzt
 *   'YYYY'        – nur Jahr
 *   'YYYY-MM'     – Monat und Jahr
 *   'YYYY-MM-DD'  – vollständiges Datum
 * Die Darstellung im Lebenslauf richtet sich nach dem gewählten Datumsformat.
 */
export type PartialDate = string;

export type DatePrecision = 'year' | 'month' | 'day';

export const PARTIAL_DATE_PATTERN = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Prüft Syntax und Kalendergültigkeit (z. B. kein 30.02.). */
export function isValidPartialDate(value: string): boolean {
  if (value === '') return true;
  if (!PARTIAL_DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y === undefined || y < MIN_YEAR || y > MAX_YEAR) return false;
  if (m !== undefined && d !== undefined && d > daysInMonth(y, m)) return false;
  return true;
}

export function datePrecision(value: PartialDate): DatePrecision | null {
  if (!value) return null;
  const parts = value.split('-').length;
  return parts === 1 ? 'year' : parts === 2 ? 'month' : 'day';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function build(year: number, month?: number, day?: number): PartialDate | null {
  let value = String(year);
  if (month !== undefined) value += `-${pad(month)}`;
  if (day !== undefined) value += `-${pad(day)}`;
  return isValidPartialDate(value) ? value : null;
}

/**
 * Wandelt eine Benutzereingabe in ein Teil-ISO-Datum um.
 * Akzeptiert u. a. "2022", "01/2022", "1.2022", "15.01.2022", "2022-01", "2022-01-15".
 * Gibt `null` zurück, wenn die Eingabe kein gültiges Datum ist.
 */
export function parseDateInput(input: string): PartialDate | null {
  const s = input.trim();
  if (s === '') return '';
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})$/))) return build(Number(m[1]));
  if ((m = s.match(/^(\d{4})-(\d{1,2})$/))) return build(Number(m[1]), Number(m[2]));
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)))
    return build(Number(m[1]), Number(m[2]), Number(m[3]));
  if ((m = s.match(/^(\d{1,2})\s*[./-]\s*(\d{4})$/))) return build(Number(m[2]), Number(m[1]));
  if ((m = s.match(/^(\d{1,2})\s*[./]\s*(\d{1,2})\s*[./]\s*(\d{4})$/)))
    return build(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

/** Formatiert ein Teil-Datum im gewünschten Format; fehlende Genauigkeit wird sinnvoll reduziert. */
export function formatPartialDate(value: PartialDate, format: DateFormat): string {
  if (!value || !isValidPartialDate(value)) return '';
  const [y, m, d] = value.split('-');
  if (format === 'YYYY' || !m) return y ?? '';
  if (format === 'MM/YYYY') return `${m}/${y}`;
  if (format === 'MM.YYYY') return `${m}.${y}`;
  // DD.MM.YYYY
  return d ? `${d}.${m}.${y}` : `${m}.${y}`;
}

/** Darstellung eines Datums im Eingabefeld (entspricht dem gewählten Format, aber verlustfrei). */
export function toDateInputString(value: PartialDate, format: DateFormat): string {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  if (!m) return y ?? '';
  const sep = format === 'MM/YYYY' ? '/' : '.';
  if (d) return `${d}.${m}.${y}`;
  return `${m}${sep}${y}`;
}

export interface DateRangeLabels {
  present: string;
  separator?: string;
}

export function formatDateRange(
  start: PartialDate,
  end: PartialDate,
  current: boolean,
  format: DateFormat,
  labels: DateRangeLabels,
): string {
  const sep = labels.separator ?? ' – ';
  const s = formatPartialDate(start, format);
  const e = current ? labels.present : formatPartialDate(end, format);
  if (s && e) return s === e ? s : `${s}${sep}${e}`;
  return s || e;
}

/** Vergleich für Sortierungen (neueste zuerst: `-comparePartialDates(a, b)`). */
export function comparePartialDates(a: PartialDate, b: PartialDate): number {
  const norm = (v: string) => (v ? v.padEnd(10, v.length === 4 ? '-00-00' : '-00') : '');
  return norm(a).localeCompare(norm(b));
}

/** Teil-Datum in Monatsindex umrechnen (für Zeitraum- und Lückenberechnungen). */
export function toMonthIndex(value: PartialDate): number | null {
  if (!value) return null;
  const [y, m] = value.split('-').map(Number);
  if (y === undefined) return null;
  return y * 12 + ((m ?? 1) - 1);
}

export function currentPartialMonth(now: Date = new Date()): PartialDate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}
