/**
 * API-Client: gleiche Origin, Cookies (httpOnly-Session) und CSRF-Header (Double-Submit).
 */
import type { ApiErrorBody } from '@cv-studio/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const CSRF_COOKIE = 'cvs_csrf';

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

let csrfPromise: Promise<void> | null = null;
async function ensureCsrf(force = false): Promise<string> {
  if (force || !readCookie(CSRF_COOKIE)) {
    csrfPromise ??= fetch('/api/auth/csrf', { credentials: 'same-origin' }).then(() => undefined);
    await csrfPromise.finally(() => {
      csrfPromise = null;
    });
  }
  return readCookie(CSRF_COOKIE) ?? '';
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  /** Rohantwort (z. B. für Datei-Downloads) */
  raw?: boolean;
}

async function toError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    /* keine JSON-Antwort */
  }
  const code = body?.error?.code ?? (res.status === 413 ? 'file_too_large' : res.status >= 500 ? 'internal_error' : 'generic');
  return new ApiError(res.status, code, body?.error?.message ?? res.statusText, body?.error?.fields);
}

async function request<T>(method: Method, url: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-CSRF-Token'] = await ensureCsrf();
  let body: BodyInit | undefined;
  if (options.form) body = options.form;
  else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body, credentials: 'same-origin', signal: options.signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'Network error');
  }
  if (!res.ok) {
    const error = await toError(res);
    // Abgelaufenes CSRF-Token einmalig erneuern
    if (error.code === 'csrf_invalid' && !retried) {
      await ensureCsrf(true);
      return request<T>(method, url, options, true);
    }
    if (res.status === 401) window.dispatchEvent(new CustomEvent('cvs:unauthorized'));
    throw error;
  }
  if (options.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(url: string, signal?: AbortSignal) => request<T>('GET', url, { signal }),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, { body: body ?? {} }),
  put: <T>(url: string, body: unknown) => request<T>('PUT', url, { body }),
  patch: <T>(url: string, body: unknown) => request<T>('PATCH', url, { body }),
  delete: <T>(url: string, body?: unknown) => request<T>('DELETE', url, { body }),
  upload: <T>(url: string, form: FormData) => request<T>('POST', url, { form }),
  /** POST/GET mit Dateiantwort */
  download: async (method: 'GET' | 'POST', url: string, body?: unknown): Promise<{ blob: Blob; fileName: string }> => {
    const res = await request<Response>(method, url, { body: method === 'POST' ? body ?? {} : undefined, raw: true });
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plain = disposition.match(/filename="([^"]+)"/i)?.[1];
    const fileName = utf8 ? decodeURIComponent(utf8) : plain ?? 'download';
    return { blob: await res.blob(), fileName };
  },
};

/** Löst einen Browser-Download für einen Blob aus. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
