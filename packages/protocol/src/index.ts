/**
 * Wire protocol shared by client and server.
 *
 * Everything the server ever receives is described here. If a field is not in
 * this file, the server never sees it. Keep it that way: every new field must
 * pass the privacy review in docs/08-privacy-review.md first.
 */
import { z } from 'zod';

export const PROTOCOL_VERSION = 1;
export const API_PREFIX = '/api/v1';

// ---------------------------------------------------------------------------
// Anonymous account identifiers
// ---------------------------------------------------------------------------

/**
 * An account id is derived from the account's Ed25519 authentication public
 * key: SHA-256(ACCOUNT_ID_DOMAIN || authPublicKey), first 8 bytes, hex, grouped.
 * It contains no personal information and the server cannot choose it.
 */
export const ACCOUNT_ID_DOMAIN = 'corelayer/account-id/v1';
export const ACCOUNT_ID_BYTES = 8;
export const ACCOUNT_ID_RE = /^[0-9A-F]{4}(?:-[0-9A-F]{4}){3}$/;

export function formatAccountId(digest: Uint8Array): string {
  const hex = Array.from(digest.subarray(0, ACCOUNT_ID_BYTES), (b) =>
    b.toString(16).padStart(2, '0'),
  )
    .join('')
    .toUpperCase();
  return hex.match(/.{4}/g)!.join('-');
}

/** Normalises user input ("7f3a91d2 8c41 0b5e") to the canonical form, or null. */
export function normalizeAccountId(input: string): string | null {
  const hex = input.toUpperCase().replace(/[^0-9A-F]/g, '');
  if (hex.length !== ACCOUNT_ID_BYTES * 2) return null;
  return hex.match(/.{4}/g)!.join('-');
}

// Every account currently has exactly one device. The protocol carries the
// device id so that linked devices (each with its own keys) can be added.
export const DEFAULT_DEVICE_ID = 1;

// ---------------------------------------------------------------------------
// Disappearing messages / retention
// ---------------------------------------------------------------------------

/** The only message lifetimes the platform supports. There is no "forever". */
export const TTL_OPTIONS = [
  { seconds: 5, label: '5 seconds' },
  { seconds: 30, label: '30 seconds' },
  { seconds: 60, label: '1 minute' },
  { seconds: 300, label: '5 minutes' },
  { seconds: 3600, label: '1 hour' },
  { seconds: 86400, label: '24 hours' },
  { seconds: 604800, label: '7 days' },
] as const;
export const TTL_SECONDS = TTL_OPTIONS.map((o) => o.seconds) as readonly number[];
export const DEFAULT_TTL_SECONDS = 86400;
/** Hard upper bound for anything the server stores for delivery. */
export const MAX_RETENTION_SECONDS = 604800;

export const ttlSchema = z
  .number()
  .int()
  .refine((v) => TTL_SECONDS.includes(v), 'unsupported ttl');

// ---------------------------------------------------------------------------
// Padding: sizes the server is allowed to see
// ---------------------------------------------------------------------------

/** libsodium crypto_box_seal overhead (ephemeral pk + MAC). */
export const SEALED_BOX_OVERHEAD = 48;
/** Plaintext buckets for sealed envelopes. Every envelope is padded to one of these. */
export const ENVELOPE_BUCKETS = [1024, 4096, 16384, 65536] as const;
export const MAX_ENVELOPE_PLAINTEXT = 65536;

/** Smallest envelope bucket that fits `n` bytes plus at least one padding byte. */
export function envelopeBucket(n: number): number | null {
  for (const b of ENVELOPE_BUCKETS) if (n + 1 <= b) return b;
  return null;
}

export function isValidEnvelopeLength(len: number): boolean {
  return ENVELOPE_BUCKETS.some((b) => b + SEALED_BOX_OVERHEAD === len);
}

/** XChaCha20-Poly1305: 24 byte nonce prepended + 16 byte tag. */
export const BLOB_OVERHEAD = 24 + 16;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const KiB = 1024;
const MiB = 1024 * 1024;

/**
 * Padded plaintext size for a file of `n` bytes. Small files all look the
 * same (64 KiB), medium files are rounded to powers of two, large files to
 * whole MiB. This hides exact sizes, which are a strong fingerprint.
 */
export function blobBucket(n: number): number | null {
  const need = n + 1;
  if (need > MAX_FILE_BYTES + MiB) return null;
  if (need <= 64 * KiB) return 64 * KiB;
  if (need <= MiB) {
    let b = 128 * KiB;
    while (b < need) b *= 2;
    return b;
  }
  return Math.ceil(need / MiB) * MiB;
}

export function isValidBlobLength(len: number): boolean {
  const plain = len - BLOB_OVERHEAD;
  return plain > 0 && blobBucket(plain - 1) === plain;
}
export const MAX_BLOB_BYTES = (blobBucket(MAX_FILE_BYTES) ?? 0) + BLOB_OVERHEAD;

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

const b64 = (maxBytes: number) =>
  z
    .string()
    .max(Math.ceil(maxBytes / 3) * 4 + 4)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, 'base64');

export const accountIdSchema = z.string().regex(ACCOUNT_ID_RE);
export const keyIdSchema = z.number().int().min(1).max(0xffffff);

/** Curve25519 public keys in libsignal format (0x05 prefix + 32 bytes). */
const signalPublicKey = b64(33);
const signature64 = b64(64);
const rawKey32 = b64(32);

export const preKeySchema = z.object({ keyId: keyIdSchema, publicKey: signalPublicKey });
export const signedPreKeySchema = preKeySchema.extend({ signature: signature64 });

export const MAX_PREKEYS_PER_UPLOAD = 100;

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------

/** GET /auth/challenge -> one-time challenge, valid for 60 seconds. */
export const challengeResponseSchema = z.object({ challenge: b64(32) });

/** Domain separation for signatures made with the authentication key. */
export const AUTH_SIGNATURE_CONTEXT = {
  register: 'corelayer/register/v1:',
  session: 'corelayer/session/v1:',
} as const;

/**
 * The sealing key is signed with the Signal identity key (XEdDSA), so a
 * malicious server cannot substitute it without also changing the identity
 * key — which clients pin and users can verify via safety numbers.
 */
export const SEALING_KEY_SIGNATURE_CONTEXT = 'corelayer/sealing-key/v1:';

/** POST /accounts — create an anonymous account. No email, phone or name. */
export const registerRequestSchema = z.object({
  authPublicKey: rawKey32, // Ed25519
  sealingPublicKey: rawKey32, // X25519, used for sealed-sender envelopes
  identityKey: signalPublicKey, // Signal identity key
  sealingKeySignature: signature64, // identity key signature over the sealing key
  registrationId: z.number().int().min(0).max(16383),
  signedPreKey: signedPreKeySchema,
  preKeys: z.array(preKeySchema).max(MAX_PREKEYS_PER_UPLOAD),
  challenge: b64(32),
  signature: signature64, // Ed25519 over register context || challenge
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export const registerResponseSchema = z.object({ accountId: accountIdSchema });

/** POST /auth/session — prove possession of the auth key, receive a bearer token. */
export const sessionRequestSchema = z.object({
  accountId: accountIdSchema,
  challenge: b64(32),
  signature: signature64,
});
export const sessionResponseSchema = z.object({
  token: z.string().min(32).max(128),
  expiresInSeconds: z.number().int(),
});

/** GET /keys/:accountId/identity — long-term public keys only (consumes nothing). */
export const publicIdentitySchema = z.object({
  accountId: accountIdSchema,
  identityKey: signalPublicKey,
  sealingPublicKey: rawKey32,
  sealingKeySignature: signature64,
});
export type PublicIdentity = z.infer<typeof publicIdentitySchema>;

/** GET /keys/:accountId — full prekey bundle (consumes one one-time prekey). Unauthenticated on purpose. */
export const keyBundleSchema = publicIdentitySchema.extend({
  deviceId: z.number().int(),
  registrationId: z.number().int(),
  signedPreKey: signedPreKeySchema,
  preKey: preKeySchema.optional(),
});
export type KeyBundle = z.infer<typeof keyBundleSchema>;

/** PUT /keys — replenish one-time prekeys and/or rotate the signed prekey. */
export const uploadKeysRequestSchema = z.object({
  signedPreKey: signedPreKeySchema.optional(),
  preKeys: z.array(preKeySchema).max(MAX_PREKEYS_PER_UPLOAD),
  /** Discard every one-time prekey stored on the server first (after restore). */
  replaceAll: z.boolean().optional(),
});
export const keyCountResponseSchema = z.object({ count: z.number().int() });

/**
 * POST /messages — sealed-sender delivery. Unauthenticated on purpose: the
 * server learns the recipient (needed for routing) but not the sender.
 */
export const sendMessageRequestSchema = z.object({
  to: accountIdSchema,
  envelope: b64(MAX_ENVELOPE_PLAINTEXT + SEALED_BOX_OVERHEAD),
  ttlSeconds: ttlSchema,
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

/** POST /blobs?ttl=N (octet-stream body) -> { id } ; GET /blobs/:id */
export const blobIdSchema = z.string().regex(/^[0-9a-f]{32}$/);
export const uploadBlobResponseSchema = z.object({ id: blobIdSchema });

/** PUT /recovery/:backupId (authenticated) ; GET /recovery/:backupId */
export const backupIdSchema = z.string().regex(/^[0-9a-f]{64}$/);
export const MAX_BACKUP_BYTES = 256 * 1024;
export const recoveryBlobSchema = z.object({ blob: b64(MAX_BACKUP_BYTES) });

export const errorResponseSchema = z.object({ error: z.string() });

// ---------------------------------------------------------------------------
// WebSocket (authenticated, used only to *receive*)
// ---------------------------------------------------------------------------

export const WS_PATH = '/ws';

export const clientWsMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('auth'), token: z.string().min(32).max(128) }),
  z.object({ t: z.literal('ack'), ids: z.array(z.string().regex(/^\d{1,19}$/)).max(500) }),
  z.object({ t: z.literal('ping') }),
]);
export type ClientWsMessage = z.infer<typeof clientWsMessageSchema>;

export type ServerWsMessage =
  | { t: 'ready' }
  | { t: 'msg'; id: string; envelope: string }
  | { t: 'pong' }
  | { t: 'error'; error: string };

// ---------------------------------------------------------------------------
// Inside the envelope (only ever visible to the two endpoints)
// ---------------------------------------------------------------------------

/** Sealed envelope plaintext — encrypted to the recipient's sealing key. */
export const sealedContentSchema = z.object({
  v: z.literal(1),
  from: accountIdSchema,
  device: z.number().int(),
  /** Signal message type: 1 = WhisperMessage, 3 = PreKeyWhisperMessage */
  type: z.union([z.literal(1), z.literal(3)]),
  body: b64(MAX_ENVELOPE_PLAINTEXT),
});
export type SealedContent = z.infer<typeof sealedContentSchema>;

export const fileRefSchema = z.object({
  blobId: blobIdSchema,
  key: rawKey32,
  size: z.number().int().min(0).max(MAX_FILE_BYTES),
  name: z.string().max(200),
  mime: z.string().max(100),
});
export type FileRef = z.infer<typeof fileRefSchema>;

export const groupInfoSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{32}$/),
  name: z.string().max(80),
  members: z.array(accountIdSchema).min(1).max(100),
});
export type GroupInfo = z.infer<typeof groupInfoSchema>;

export const MAX_TEXT_LENGTH = 8000;

/** The end-to-end encrypted payload (Signal plaintext). */
export const chatContentSchema = z.object({
  v: z.literal(1),
  id: z.string().regex(/^[0-9a-f]{32}$/),
  kind: z.enum(['text', 'file', 'group-update', 'group-leave', 'ttl-update']),
  sentAt: z.number().int(),
  ttl: ttlSchema,
  /** Optional nickname chosen by the sender. Never sent to the server. */
  nick: z.string().max(40).optional(),
  group: groupInfoSchema.optional(),
  text: z.string().max(MAX_TEXT_LENGTH).optional(),
  file: fileRefSchema.optional(),
});
export type ChatContent = z.infer<typeof chatContentSchema>;
