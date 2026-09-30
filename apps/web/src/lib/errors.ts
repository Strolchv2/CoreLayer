import type { MessageKey } from '../i18n/messages';
import { messages } from '../i18n/messages';
import type { Translate } from '../i18n';
import { ApiError } from './api';

/** Übersetzt Fehler in verständliche Meldungen – niemals technische Details anzeigen. */
export function errorMessage(err: unknown, t: Translate, fallback: MessageKey = 'errors.generic'): string {
  if (err instanceof ApiError) {
    const key = `errors.${err.code}` as MessageKey;
    if (key in messages.de) return t(key);
    return t(fallback);
  }
  return t(fallback);
}

/** Feldfehler (Zod-Codes) in Übersetzungen umwandeln. */
export function fieldErrors(err: unknown, t: Translate): Record<string, string> {
  if (!(err instanceof ApiError) || !err.fields) return {};
  const out: Record<string, string> = {};
  for (const [field, code] of Object.entries(err.fields)) {
    const key = `validation.${code}` as MessageKey;
    out[field] = key in messages.de ? t(key) : t('validation.required');
  }
  return out;
}
