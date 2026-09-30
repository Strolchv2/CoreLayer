import { TEMPLATE_LIST, type TemplateDTO, type TemplateKey } from '@cv-studio/shared';
import { sql } from 'kysely';
import { db } from '../db/index.js';

/** Legt fehlende Vorlagen an (idempotent). Bestehende Admin-Anpassungen bleiben erhalten. */
export async function seedTemplates(): Promise<void> {
  await db
    .insertInto('templates')
    .values(
      TEMPLATE_LIST.map((t, i) => ({
        key: t.key,
        name: t.name.de,
        description: t.description.de,
        is_active: true,
        sort_order: i,
      })),
    )
    .onConflict((oc) => oc.column('key').doNothing())
    .execute();
}

export async function listTemplates(options: { includeInactive?: boolean; withUsage?: boolean } = {}): Promise<TemplateDTO[]> {
  let q = db.selectFrom('templates').selectAll().orderBy('sort_order').orderBy('key');
  if (!options.includeInactive) q = q.where('is_active', '=', true);
  const rows = await q.execute();
  let usage = new Map<string, number>();
  if (options.withUsage) {
    const counts = await db
      .selectFrom('resumes')
      .select(['template_key', sql<string>`count(*)`.as('count')])
      .groupBy('template_key')
      .execute();
    usage = new Map(counts.map((c) => [c.template_key, Number(c.count)]));
  }
  return rows.map((r) => ({
    key: r.key as TemplateKey,
    name: r.name,
    description: r.description,
    isActive: r.is_active,
    sortOrder: r.sort_order,
    ...(options.withUsage ? { usageCount: usage.get(r.key) ?? 0 } : {}),
  }));
}

export async function isTemplateActive(key: string): Promise<boolean> {
  const row = await db.selectFrom('templates').select('is_active').where('key', '=', key).executeTakeFirst();
  return Boolean(row?.is_active);
}
