import { randomBytes } from 'node:crypto';

export interface Config {
  host: string;
  port: number;
  databaseUrl: string;
  /** Origins allowed to make state-changing requests and open WebSockets. Empty = any. */
  allowedOrigins: string[];
  /** Trust X-Forwarded-For from the reverse proxy (only when the API port is not public). */
  trustProxy: boolean;
  /** HMAC key for bearer tokens, shared by all relay nodes. Random per process if unset. */
  sessionSecret: Buffer;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  return {
    host: env.HOST ?? '127.0.0.1',
    port: Number(env.PORT ?? 3000),
    databaseUrl,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
    sessionSecret: env.SESSION_SECRET ? Buffer.from(env.SESSION_SECRET, 'base64') : randomBytes(32),
  };
}
