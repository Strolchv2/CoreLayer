import type { Translate } from '../i18n';

/** Relative Zeitangabe ("vor 5 Min.") mit Fallback auf Datum. */
export function relativeTime(iso: string | null | undefined, t: Translate, locale: string): string {
  if (!iso) return t('common.never');
  const date = new Date(iso);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return t('time.justNow');
  if (diff < 3600) return t('time.minutesAgo', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('time.hoursAgo', { n: Math.floor(diff / 3600) });
  if (diff < 172800) return t('time.yesterday');
  if (diff < 7 * 86400) return t('time.daysAgo', { n: Math.floor(diff / 86400) });
  return date.toLocaleDateString(locale === 'en' ? 'en-GB' : 'de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString(locale === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}
