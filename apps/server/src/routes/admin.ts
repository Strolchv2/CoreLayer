import type { AdminStatsDTO, AdminSystemStatusDTO, AdminUserDTO, AuditLogEntryDTO, Paginated } from '@cv-studio/shared';
import { Router } from 'express';
import { sql } from 'kysely';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { badRequest, notFound } from '../lib/errors.js';
import { parse, parseUuidParam } from '../lib/validate.js';
import { currentUser, requireAdmin } from '../middleware/auth.js';
import { redis } from '../middleware/rateLimit.js';
import { pdfRenderer } from '../pdf/renderer.js';
import { deleteUserAccount } from '../services/account.js';
import { audit } from '../services/audit.js';
import { createBackup, deleteBackup, listBackups } from '../services/backup.js';
import { destroyUserSessions } from '../services/sessions.js';
import { directorySize } from '../services/storage.js';
import { listTemplates } from '../services/templates.js';

/**
 * Adminbereich. Datensparsamkeit: Administratoren sehen Konten, Zähler und Protokolle,
 * aber KEINE Lebenslauf-, Anschreiben- oder Dokumentinhalte.
 */
export const adminRouter = Router();
adminRouter.use(requireAdmin);

const count = (v: unknown) => Number(v ?? 0);

adminRouter.get('/stats', async (_req, res) => {
  const d7 = new Date(Date.now() - 7 * 86400_000);
  const d30 = new Date(Date.now() - 30 * 86400_000);
  const [users, resumes, letters, documents, exports, byKind, templates] = await Promise.all([
    db
      .selectFrom('users')
      .select([
        sql<string>`count(*)`.as('total'),
        sql<string>`count(*) filter (where status = 'active')`.as('active'),
        sql<string>`count(*) filter (where status = 'blocked')`.as('blocked'),
        sql<string>`count(*) filter (where role = 'admin')`.as('admins'),
        sql<string>`count(*) filter (where created_at > ${d7})`.as('new7'),
        sql<string>`count(*) filter (where created_at > ${d30})`.as('new30'),
      ])
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('resumes')
      .select([
        sql<string>`count(*)`.as('total'),
        sql<string>`count(*) filter (where archived_at is not null)`.as('archived'),
        sql<string>`count(*) filter (where created_at > ${d30})`.as('new30'),
      ])
      .executeTakeFirstOrThrow(),
    db.selectFrom('cover_letters').select(sql<string>`count(*)`.as('c')).executeTakeFirstOrThrow(),
    db.selectFrom('documents').select([sql<string>`count(*)`.as('c'), sql<string>`coalesce(sum(size_bytes), 0)`.as('bytes')]).executeTakeFirstOrThrow(),
    db
      .selectFrom('export_events')
      .select([sql<string>`count(*)`.as('total'), sql<string>`count(*) filter (where created_at > ${d30})`.as('last30')])
      .executeTakeFirstOrThrow(),
    db.selectFrom('export_events').select(['kind', sql<string>`count(*)`.as('c')]).groupBy('kind').execute(),
    db.selectFrom('resumes').select(['template_key', sql<string>`count(*)`.as('c')]).groupBy('template_key').orderBy(sql`count(*)`, 'desc').execute(),
  ]);
  const body: AdminStatsDTO = {
    users: {
      total: count(users.total),
      active: count(users.active),
      blocked: count(users.blocked),
      admins: count(users.admins),
      newLast7Days: count(users.new7),
      newLast30Days: count(users.new30),
    },
    resumes: { total: count(resumes.total), archived: count(resumes.archived), createdLast30Days: count(resumes.new30) },
    coverLetters: count(letters.c),
    documents: { total: count(documents.c), totalBytes: count(documents.bytes) },
    exports: { total: count(exports.total), last30Days: count(exports.last30), byKind: Object.fromEntries(byKind.map((k) => [k.kind, count(k.c)])) },
    templates: templates.map((t) => ({ key: t.template_key, count: count(t.c) })),
  };
  res.json(body);
});

adminRouter.get('/system', async (_req, res) => {
  let dbOk = false;
  let latency: number | null = null;
  let size: number | null = null;
  try {
    const t = performance.now();
    const row = await sql<{ size: string }>`select pg_database_size(current_database()) as size`.execute(db);
    latency = Math.round(performance.now() - t);
    size = Number(row.rows[0]?.size ?? 0);
    dbOk = true;
  } catch {
    dbOk = false;
  }
  let redisOk: boolean | null = null;
  if (redis) {
    try {
      redisOk = (await redis.ping()) === 'PONG';
    } catch {
      redisOk = false;
    }
  }
  const mem = process.memoryUsage();
  const body: AdminSystemStatusDTO = {
    version: config.version,
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    memory: { rssBytes: mem.rss, heapUsedBytes: mem.heapUsed },
    database: { ok: dbOk, latencyMs: latency, sizeBytes: size },
    redis: { configured: Boolean(redis), ok: redisOk },
    pdfRenderer: await pdfRenderer.healthCheck(),
    storage: { uploadBytes: await directorySize(config.uploadDir), backupCount: (await listBackups()).length },
    ai: { enabled: config.ai.enabled },
    mail: { transport: config.mail.transport },
  };
  res.json(body);
});

adminRouter.get('/users', async (req, res) => {
  const { page, pageSize, search, status } = parse(
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(5).max(100).default(25),
      search: z.string().trim().max(100).default(''),
      status: z.enum(['all', 'active', 'blocked']).default('all'),
    }),
    req.query,
  );
  let q = db.selectFrom('users');
  if (search) q = q.where((eb) => eb.or([eb('email', 'ilike', `%${search.replace(/[%_\\]/g, '\\$&')}%`), eb('display_name', 'ilike', `%${search.replace(/[%_\\]/g, '\\$&')}%`)]));
  if (status !== 'all') q = q.where('status', '=', status);
  const [{ c }, rows] = await Promise.all([
    q.select(sql<string>`count(*)`.as('c')).executeTakeFirstOrThrow(),
    q
      .select(['id', 'email', 'display_name', 'role', 'status', 'created_at', 'last_login_at'])
      .select((eb) => [
        eb.selectFrom('resumes').select(sql<string>`count(*)`.as('c')).whereRef('resumes.user_id', '=', 'users.id').as('resume_count'),
        eb.selectFrom('documents').select(sql<string>`count(*)`.as('c')).whereRef('documents.user_id', '=', 'users.id').as('document_count'),
      ])
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute(),
  ]);
  const body: Paginated<AdminUserDTO> = {
    items: rows.map((r) => ({
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      role: r.role,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      lastLoginAt: r.last_login_at?.toISOString() ?? null,
      resumeCount: count(r.resume_count),
      documentCount: count(r.document_count),
    })),
    total: count(c),
    page,
    pageSize,
  };
  res.json(body);
});

async function activeAdminCount(): Promise<number> {
  const { c } = await db
    .selectFrom('users')
    .select(sql<string>`count(*)`.as('c'))
    .where('role', '=', 'admin')
    .where('status', '=', 'active')
    .executeTakeFirstOrThrow();
  return count(c);
}

adminRouter.patch('/users/:id', async (req, res) => {
  const admin = currentUser(req);
  const id = parseUuidParam(req.params.id);
  const input = parse(z.object({ status: z.enum(['active', 'blocked']), role: z.enum(['user', 'admin']) }).partial(), req.body);
  const target = await db.selectFrom('users').select(['id', 'role', 'status']).where('id', '=', id).executeTakeFirst();
  if (!target) throw notFound();
  if (id === admin.id && (input.status === 'blocked' || input.role === 'user')) throw badRequest('cannot_modify_self');
  const losesAdmin = target.role === 'admin' && target.status === 'active' && (input.role === 'user' || input.status === 'blocked');
  if (losesAdmin && (await activeAdminCount()) <= 1) throw badRequest('last_admin');

  await db
    .updateTable('users')
    .set({ ...(input.status ? { status: input.status } : {}), ...(input.role ? { role: input.role } : {}), updated_at: new Date() })
    .where('id', '=', id)
    .execute();
  if (input.status === 'blocked') await destroyUserSessions(id);
  await audit(admin.id, input.status === 'blocked' ? 'admin.user_blocked' : input.status === 'active' ? 'admin.user_unblocked' : 'admin.user_role_changed', {
    targetUserId: id,
    ...(input.role ? { role: input.role } : {}),
  });
  res.json({ ok: true });
});

adminRouter.delete('/users/:id', async (req, res) => {
  const admin = currentUser(req);
  const id = parseUuidParam(req.params.id);
  if (id === admin.id) throw badRequest('cannot_modify_self');
  const target = await db.selectFrom('users').select(['id', 'role']).where('id', '=', id).executeTakeFirst();
  if (!target) throw notFound();
  if (target.role === 'admin' && (await activeAdminCount()) <= 1) throw badRequest('last_admin');
  await deleteUserAccount(id);
  await audit(admin.id, 'admin.user_deleted', { targetUserId: id });
  res.json({ ok: true });
});

adminRouter.get('/templates', async (_req, res) => {
  res.json({ templates: await listTemplates({ includeInactive: true, withUsage: true }) });
});

adminRouter.patch('/templates/:key', async (req, res) => {
  const admin = currentUser(req);
  const key = String(req.params.key);
  const input = parse(
    z
      .object({
        name: z.string().trim().min(1).max(80),
        description: z.string().trim().max(300),
        isActive: z.boolean(),
        sortOrder: z.number().int().min(0).max(1000),
      })
      .partial(),
    req.body,
  );
  if (input.isActive === false) {
    const { c } = await db.selectFrom('templates').select(sql<string>`count(*)`.as('c')).where('is_active', '=', true).where('key', '!=', key).executeTakeFirstOrThrow();
    if (count(c) === 0) throw badRequest('last_template');
  }
  const row = await db
    .updateTable('templates')
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
      updated_at: new Date(),
    })
    .where('key', '=', key)
    .returning('key')
    .executeTakeFirst();
  if (!row) throw notFound();
  await audit(admin.id, 'admin.template_updated', { template: key });
  res.json({ ok: true });
});

adminRouter.get('/logs', async (req, res) => {
  const { page, pageSize, action } = parse(
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(10).max(200).default(50),
      action: z.string().trim().max(60).default(''),
    }),
    req.query,
  );
  let q = db.selectFrom('audit_log').leftJoin('users', 'users.id', 'audit_log.user_id');
  if (action) q = q.where('audit_log.action', 'like', `${action.replace(/[%_\\]/g, '\\$&')}%`);
  const [{ c }, rows] = await Promise.all([
    q.select(sql<string>`count(*)`.as('c')).executeTakeFirstOrThrow(),
    q
      .select(['audit_log.id', 'audit_log.action', 'audit_log.user_id', 'audit_log.meta', 'audit_log.created_at', 'users.email'])
      .orderBy('audit_log.created_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute(),
  ]);
  const body: Paginated<AuditLogEntryDTO> = {
    items: rows.map((r) => ({
      id: String(r.id),
      action: r.action,
      userId: r.user_id,
      userEmail: r.email ?? null,
      meta: (r.meta ?? {}) as Record<string, unknown>,
      createdAt: r.created_at.toISOString(),
    })),
    total: count(c),
    page,
    pageSize,
  };
  res.json(body);
});

adminRouter.get('/backups', async (_req, res) => {
  res.json({ backups: await listBackups(), directory: config.backupDir });
});

adminRouter.post('/backups', async (req, res) => {
  const backup = await createBackup();
  await audit(currentUser(req).id, 'admin.backup_created', { sizeBytes: backup.sizeBytes });
  res.status(201).json({ backup });
});

adminRouter.delete('/backups/:name', async (req, res) => {
  await deleteBackup(String(req.params.name));
  await audit(currentUser(req).id, 'admin.backup_deleted');
  res.json({ ok: true });
});
