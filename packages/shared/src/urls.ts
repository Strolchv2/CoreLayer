/**
 * Hilfsfunktionen für benutzerdefinierte Links.
 * Nur http(s)-Links sind erlaubt – verhindert u. a. `javascript:`-XSS in Lebenslauf-Links.
 */

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

/** Ergänzt fehlendes Protokoll ("www.example.de" → "https://www.example.de"). */
export function normalizeUrl(input: string): string {
  const s = input.trim();
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  return `https://${s.replace(/^\/+/, '')}`;
}

export function isSafeHttpUrl(input: string): boolean {
  if (!input) return true;
  try {
    const url = new URL(normalizeUrl(input));
    return SAFE_PROTOCOLS.has(url.protocol) && Boolean(url.hostname) && url.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Liefert eine sichere href oder `undefined`. */
export function safeHref(input: string): string | undefined {
  if (!input || !isSafeHttpUrl(input)) return undefined;
  return new URL(normalizeUrl(input)).toString();
}

/** Anzeige ohne Protokoll und abschließenden Slash ("https://max.de/" → "max.de"). */
export function displayUrl(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, (m) => m)
    .replace(/\/$/, '');
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Telefonnummern: Ziffern, Leerzeichen, +, /, -, (, ) und Punkt. */
export const PHONE_PATTERN = /^\+?[0-9\s/().-]{4,30}$/;

export function mailtoHref(email: string): string | undefined {
  return EMAIL_PATTERN.test(email.trim()) ? `mailto:${email.trim()}` : undefined;
}

export function telHref(phone: string): string | undefined {
  const p = phone.trim();
  if (!PHONE_PATTERN.test(p)) return undefined;
  return `tel:${p.replace(/[^\d+]/g, '')}`;
}
