import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
/** Projektwurzel des Servers (apps/server) – funktioniert für src/ (tsx) und dist/ (Build). */
const serverRoot = path.resolve(here, '..');

const bool = (def: boolean) =>
  z
    .enum(['true', 'false', '1', '0', 'yes', 'no'])
    .optional()
    .transform((v) => (v === undefined ? def : ['true', '1', 'yes'].includes(v)));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default('0.0.0.0'),
  APP_URL: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1).default('postgres://cvstudio:cvstudio_dev@localhost:5432/cvstudio'),
  DATABASE_SSL: bool(false),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
  SESSION_TTL_DAYS: z.coerce.number().min(1).max(90).default(14),
  COOKIE_SECURE: z.enum(['true', 'false', 'auto']).default('auto'),
  TRUST_PROXY: z.string().default('loopback'),
  STORAGE_DIR: z.string().default(path.join(serverRoot, 'storage')),
  RENDER_BUNDLE_DIR: z.string().default(path.resolve(serverRoot, '../web/dist')),
  CHROMIUM_EXECUTABLE_PATH: z.string().optional(),
  PDF_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  PDF_TIMEOUT_MS: z.coerce.number().int().min(5000).default(45000),
  REDIS_URL: z.string().optional(),
  MAIL_TRANSPORT: z.enum(['smtp', 'outbox']).default('outbox'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: bool(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('CV Studio <no-reply@localhost>'),
  AI_PROVIDER: z.enum(['none', 'anthropic']).default('none'),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-opus-5-5'),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  PG_DUMP_PATH: z.string().default('pg_dump'),
  RATE_LIMIT_DISABLED: bool(false),
  LEGAL_OPERATOR_NAME: z.string().default(''),
  LEGAL_OPERATOR_ADDRESS: z.string().default(''),
  LEGAL_OPERATOR_EMAIL: z.string().default(''),
  LEGAL_OPERATOR_PHONE: z.string().default(''),
  LEGAL_REPRESENTATIVE: z.string().default(''),
  LEGAL_REGISTER: z.string().default(''),
  LEGAL_VAT_ID: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Keine Werte ausgeben (könnten Secrets enthalten) – nur die betroffenen Variablen.
  console.error('Ungültige Konfiguration:', parsed.error.issues.map((i) => i.path.join('.')).join(', '));
  process.exit(1);
}
const env = parsed.data;

if (env.NODE_ENV === 'production' && env.DATABASE_URL.includes('cvstudio_dev')) {
  console.error('In Produktion muss DATABASE_URL mit einem eigenen Passwort gesetzt werden.');
  process.exit(1);
}

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  host: env.HOST,
  appUrl: env.APP_URL.replace(/\/$/, ''),
  databaseUrl: env.DATABASE_URL,
  databaseSsl: env.DATABASE_SSL,
  databasePoolMax: env.DATABASE_POOL_MAX,
  sessionTtlMs: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  cookieSecure: env.COOKIE_SECURE === 'auto' ? env.NODE_ENV === 'production' : env.COOKIE_SECURE === 'true',
  trustProxy: env.TRUST_PROXY,
  storageDir: path.resolve(env.STORAGE_DIR),
  uploadDir: path.resolve(env.STORAGE_DIR, 'uploads'),
  backupDir: path.resolve(env.STORAGE_DIR, 'backups'),
  outboxDir: path.resolve(env.STORAGE_DIR, 'mail-outbox'),
  renderBundleDir: path.resolve(env.RENDER_BUNDLE_DIR),
  chromiumExecutablePath: env.CHROMIUM_EXECUTABLE_PATH,
  pdfConcurrency: env.PDF_CONCURRENCY,
  pdfTimeoutMs: env.PDF_TIMEOUT_MS,
  redisUrl: env.REDIS_URL,
  mail: {
    transport: env.MAIL_TRANSPORT,
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.MAIL_FROM,
  },
  ai: {
    provider: env.AI_PROVIDER,
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.AI_MODEL,
    enabled: env.AI_PROVIDER === 'anthropic' && Boolean(env.ANTHROPIC_API_KEY),
  },
  bootstrapAdmin: env.ADMIN_EMAIL && env.ADMIN_PASSWORD ? { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD } : null,
  logLevel: env.LOG_LEVEL,
  pgDumpPath: env.PG_DUMP_PATH,
  rateLimitDisabled: env.RATE_LIMIT_DISABLED,
  legal: {
    operatorName: env.LEGAL_OPERATOR_NAME,
    operatorAddress: env.LEGAL_OPERATOR_ADDRESS,
    operatorEmail: env.LEGAL_OPERATOR_EMAIL,
    operatorPhone: env.LEGAL_OPERATOR_PHONE,
    representative: env.LEGAL_REPRESENTATIVE,
    register: env.LEGAL_REGISTER,
    vatId: env.LEGAL_VAT_ID,
  },
  version: process.env.npm_package_version ?? '1.0.0',
} as const;

export type AppConfig = typeof config;
