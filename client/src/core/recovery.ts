import { fromB64, toB64, utf8 } from './encoding';
import { getSodium } from './sodium';
import type { AccountState, Contact, Group } from './state';

/**
 * Recovery key: 32 random bytes generated on the device, shown once as
 * 13 groups of 4 base32 characters. It never reaches the server. Two values
 * are derived from it with BLAKE2b-based crypto_kdf:
 *   - backupId (lookup address of the encrypted backup on the server)
 *   - backup encryption key
 * The server holds only XChaCha20-Poly1305 ciphertext it cannot open.
 * Losing the recovery key means losing the account; there is no reset.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const KDF_CTX = 'CLrecov1'; // exactly 8 bytes

export function encodeRecoveryKey(raw: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of raw) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out.match(/.{1,4}/g)!.join('-');
}

export function decodeRecoveryKey(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('invalid recovery key');
    value = ((value << 5) | i) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  if (out.length !== 32) throw new Error('invalid recovery key');
  return new Uint8Array(out);
}

export async function generateRecoveryKey(): Promise<Uint8Array> {
  return (await getSodium()).randombytes_buf(32);
}

export async function deriveRecovery(raw: Uint8Array): Promise<{ backupId: string; key: Uint8Array }> {
  const sodium = await getSodium();
  const id = sodium.crypto_kdf_derive_from_key(32, 1, KDF_CTX, raw);
  const key = sodium.crypto_kdf_derive_from_key(32, 2, KDF_CTX, raw);
  return { backupId: sodium.to_hex(id), key };
}

/** What a backup contains: the long-term identity, contacts and groups. No messages. */
export interface BackupPayload {
  v: 1;
  account: Pick<AccountState, 'id' | 'nickname' | 'auth' | 'sealing' | 'identity' | 'registrationId'>;
  identities: Record<string, { key: string; verified: boolean }>;
  contacts: Record<string, Contact>;
  groups: Record<string, Group>;
}

export async function encryptBackup(payload: BackupPayload, key: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(utf8.encode(JSON.stringify(payload)), null, null, nonce, key);
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce);
  out.set(ct, nonce.length);
  return toB64(out);
}

export async function decryptBackup(blob: string, key: Uint8Array): Promise<BackupPayload> {
  const sodium = await getSodium();
  const raw = fromB64(blob);
  const n = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  const plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, raw.subarray(n), null, raw.subarray(0, n), key);
  return JSON.parse(utf8.decode(plain)) as BackupPayload;
}
