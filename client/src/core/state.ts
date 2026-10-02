import { DEFAULT_TTL_SECONDS, type FileRef } from '@corelayer/protocol';

/**
 * Everything the client knows. Lives only on the device, encrypted at rest
 * with a key derived from the user's passphrase (see vault.ts).
 * Binary values are base64 strings so the state can be serialised as JSON.
 */
export interface KeyPairB64 {
  pub: string;
  priv: string;
}

export interface AccountState {
  id: string;
  deviceId: number;
  /** Shown to contacts inside encrypted messages only. Never sent to the server. */
  nickname: string;
  auth: KeyPairB64; // Ed25519 (libsodium format)
  sealing: KeyPairB64; // X25519 (libsodium format)
  identity: KeyPairB64; // Signal identity (libsignal format)
  registrationId: number;
  nextPreKeyId: number;
  nextSignedPreKeyId: number;
  activeSignedPreKeyId: number;
}

export interface SignedPreKeyRecord extends KeyPairB64 {
  createdAt: number;
}

export interface IdentityRecord {
  key: string;
  /** X25519 sealing key, verified against the identity key signature. */
  sealingKey?: string;
  verified: boolean;
  /** Set when a different key was presented; requires explicit user approval. */
  pendingKey?: string;
}

export interface SignalState {
  preKeys: Record<string, KeyPairB64>;
  signedPreKeys: Record<string, SignedPreKeyRecord>;
  sessions: Record<string, string>;
  identities: Record<string, IdentityRecord>;
}

export interface Contact {
  id: string;
  /** Local alias the user picked. Never leaves the device. */
  alias?: string;
  /** Nickname the contact announced in their messages. */
  nickname?: string;
  ttl: number;
  /** Came in unsolicited from an unknown sender. */
  request?: boolean;
}

export interface Group {
  id: string;
  name: string;
  members: string[];
  ttl: number;
}

export interface ChatMessage {
  id: string;
  /** Account id of the author, or 'me'. 'system' for local notices. */
  from: string;
  kind: 'text' | 'file' | 'system';
  text?: string;
  file?: FileRef;
  sentAt: number;
  expiresAt: number;
  failed?: boolean;
}

export interface VaultState {
  version: 1;
  account: AccountState;
  signal: SignalState;
  contacts: Record<string, Contact>;
  groups: Record<string, Group>;
  /** Keyed by conversation id: `u:<accountId>` or `g:<groupId>`. */
  conversations: Record<string, ChatMessage[]>;
  settings: { defaultTtl: number };
  /** Present when an encrypted recovery backup is enabled (kept up to date automatically). */
  recovery?: { backupId: string; key: string };
}

export function emptySignalState(): SignalState {
  return { preKeys: {}, signedPreKeys: {}, sessions: {}, identities: {} };
}

export function newVaultState(account: AccountState, signal: SignalState): VaultState {
  return {
    version: 1,
    account,
    signal,
    contacts: {},
    groups: {},
    conversations: {},
    settings: { defaultTtl: DEFAULT_TTL_SECONDS },
  };
}

export const convIdForContact = (id: string) => `u:${id}`;
export const convIdForGroup = (id: string) => `g:${id}`;

/** Removes expired messages. Returns true if anything was removed. */
export function pruneExpired(state: VaultState, now = Date.now()): boolean {
  let changed = false;
  for (const [cid, msgs] of Object.entries(state.conversations)) {
    const kept = msgs.filter((m) => m.expiresAt > now);
    if (kept.length !== msgs.length) {
      state.conversations[cid] = kept;
      changed = true;
    }
  }
  return changed;
}
