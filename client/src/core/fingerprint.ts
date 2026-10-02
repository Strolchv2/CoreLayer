import { utf8 } from './encoding';

/**
 * Signal "safety number" (fingerprint format version 0), computed with the
 * browser's native WebCrypto SHA-512.
 *
 * Output is bit-identical to libsignal's FingerprintGenerator (verified in
 * test/fingerprint.test.ts). We do not call the library's generator because it
 * hashes through a bundled pure-JS crypto shim (msrcrypto) that stalls under
 * the strict Content Security Policy.
 */
export const SAFETY_NUMBER_ITERATIONS = 5200;
const VERSION = 0;

async function displayStringFor(identifier: string, key: Uint8Array, iterations: number): Promise<string> {
  const id = utf8.encode(identifier); // ids are ASCII, so this equals libsignal's binary-string encoding
  let hash = new Uint8Array([VERSION & 0xff, VERSION >> 8, ...key, ...id]);
  for (let i = 0; i < iterations; i++) {
    const input = new Uint8Array(hash.length + key.length);
    input.set(hash);
    input.set(key, hash.length);
    hash = new Uint8Array(await crypto.subtle.digest('SHA-512', input));
  }
  let out = '';
  for (let offset = 0; offset < 30; offset += 5) {
    const chunk =
      (hash[offset]! * 2 ** 32 + hash[offset + 1]! * 2 ** 24 + hash[offset + 2]! * 2 ** 16 + hash[offset + 3]! * 2 ** 8 + hash[offset + 4]!) %
      100000;
    out += chunk.toString().padStart(5, '0');
  }
  return out;
}

/** 60 digits; identical for both parties of a conversation. */
export async function safetyNumber(
  localId: string,
  localIdentityKey: Uint8Array,
  remoteId: string,
  remoteIdentityKey: Uint8Array,
  iterations = SAFETY_NUMBER_ITERATIONS,
): Promise<string> {
  const a = await displayStringFor(localId, localIdentityKey, iterations);
  const b = await displayStringFor(remoteId, remoteIdentityKey, iterations);
  return [a, b].sort().join('');
}
