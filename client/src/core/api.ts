import {
  API_PREFIX,
  challengeResponseSchema,
  keyBundleSchema,
  publicIdentitySchema,
  keyCountResponseSchema,
  recoveryBlobSchema,
  registerResponseSchema,
  sessionResponseSchema,
  uploadBlobResponseSchema,
  type KeyBundle,
  type RegisterRequest,
  type SendMessageRequest,
} from '@corelayer/protocol';
import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Thin HTTP client. Requests carry no cookies (`credentials: 'omit'`), no
 * referrer and no identifying headers beyond what the browser always sends.
 * Only the endpoints that really need an account send the bearer token;
 * sending messages, fetching keys and blobs are anonymous requests.
 */
export class Api {
  constructor(readonly baseUrl: string) {}

  private async req<T>(
    method: string,
    path: string,
    opts: { json?: unknown; body?: Uint8Array; token?: string; schema?: z.ZodType<T>; raw?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (opts.json !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.body) headers['Content-Type'] = 'application/octet-stream';
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    const res = await fetch(this.baseUrl + API_PREFIX + path, {
      method,
      headers,
      body: opts.json !== undefined ? JSON.stringify(opts.json) : (opts.body as BodyInit | undefined),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        msg = ((await res.json()) as { error?: string }).error ?? msg;
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, msg);
    }
    if (opts.raw) return new Uint8Array(await res.arrayBuffer()) as T;
    if (!opts.schema) return undefined as T;
    return opts.schema.parse(await res.json());
  }

  challenge() {
    return this.req('GET', '/auth/challenge', { schema: challengeResponseSchema });
  }
  register(body: RegisterRequest) {
    return this.req('POST', '/accounts', { json: body, schema: registerResponseSchema });
  }
  session(body: { accountId: string; challenge: string; signature: string }) {
    return this.req('POST', '/auth/session', { json: body, schema: sessionResponseSchema });
  }
  deleteAccount(token: string) {
    return this.req<void>('DELETE', '/accounts/me', { token });
  }
  publicIdentity(accountId: string) {
    return this.req('GET', `/keys/${accountId}/identity`, { schema: publicIdentitySchema });
  }
  keyBundle(accountId: string): Promise<KeyBundle> {
    return this.req('GET', `/keys/${accountId}`, { schema: keyBundleSchema });
  }
  keyCount(token: string) {
    return this.req('GET', '/keys', { token, schema: keyCountResponseSchema });
  }
  uploadKeys(token: string, body: unknown) {
    return this.req<void>('PUT', '/keys', { token, json: body });
  }
  sendMessage(body: SendMessageRequest) {
    return this.req<void>('POST', '/messages', { json: body });
  }
  uploadBlob(data: Uint8Array, ttl: number) {
    return this.req('POST', `/blobs?ttl=${ttl}`, { body: data, schema: uploadBlobResponseSchema });
  }
  downloadBlob(id: string) {
    return this.req<Uint8Array>('GET', `/blobs/${id}`, { raw: true });
  }
  putRecovery(token: string, backupId: string, blob: string) {
    return this.req<void>('PUT', `/recovery/${backupId}`, { token, json: { blob } });
  }
  deleteRecovery(token: string) {
    return this.req<void>('DELETE', '/recovery', { token });
  }
  getRecovery(backupId: string) {
    return this.req('GET', `/recovery/${backupId}`, { schema: recoveryBlobSchema });
  }
}
