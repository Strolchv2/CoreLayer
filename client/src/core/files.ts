import { blobBucket } from '@corelayer/protocol';
import { getSodium } from './sodium';

/**
 * Attachment encryption: a fresh random 256-bit key per file, XChaCha20-
 * Poly1305 (libsodium), plaintext padded to a size bucket before encryption.
 * Name, type and key travel only inside the end-to-end encrypted message.
 * Output layout: nonce (24) || ciphertext+tag.
 */
export async function encryptFile(data: Uint8Array): Promise<{ key: Uint8Array; blob: Uint8Array }> {
  const sodium = await getSodium();
  const bucket = blobBucket(data.length);
  if (bucket === null) throw new Error('file too large');
  const padded = sodium.pad(data, bucket);
  const key = sodium.crypto_aead_xchacha20poly1305_ietf_keygen();
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(padded, null, null, nonce, key);
  const blob = new Uint8Array(nonce.length + ct.length);
  blob.set(nonce);
  blob.set(ct, nonce.length);
  return { key, blob };
}

export async function decryptFile(blob: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  const n = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  const padded = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, blob.subarray(n), null, blob.subarray(0, n), key);
  return sodium.unpad(padded, padded.length);
}
