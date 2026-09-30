import type { z } from 'zod';
import { badRequest, notFound } from './errors.js';

/** Validiert Eingaben mit einem Zod-Schema und liefert verständliche Feldfehler. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  throw badRequest('validation_failed', 'Validation failed', fields);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ungültige IDs verhalten sich wie nicht vorhandene Ressourcen (404). */
export function parseUuidParam(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw notFound();
  return value.toLowerCase();
}
