import {
  SEALED_BOX_OVERHEAD,
  envelopeBucket,
  isValidEnvelopeLength,
  sealedContentSchema,
  type SealedContent,
} from '@corelayer/protocol';
import { utf8 } from './encoding';
import { getSodium } from './sodium';

/**
 * Sealed-sender envelope.
 *
 * The Signal ciphertext and the sender's account id are wrapped in a libsodium
 * sealed box (X25519 + XSalsa20-Poly1305 with an ephemeral sender key) for
 * the recipient's sealing key. The relay therefore sees only the recipient
 * and an opaque blob — not who sent it.
 *
 * The plaintext is padded (ISO/IEC 7816-4) to a fixed bucket size first, so
 * the ciphertext length does not reveal the message length.
 *
 * Authenticity of the claimed sender does not rest on this layer: the inner
 * Signal message only decrypts under the session (and identity key) of the
 * account named in `from`.
 */
export async function sealEnvelope(content: SealedContent, recipientSealingKey: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  const plain = utf8.encode(JSON.stringify(content));
  const bucket = envelopeBucket(plain.length);
  if (bucket === null) throw new Error('message too large');
  const padded = sodium.pad(plain, bucket);
  if (padded.length !== bucket) throw new Error('padding failed');
  return sodium.crypto_box_seal(padded, recipientSealingKey);
}

export async function openEnvelope(
  envelope: Uint8Array,
  sealing: { publicKey: Uint8Array; privateKey: Uint8Array },
): Promise<SealedContent> {
  const sodium = await getSodium();
  if (!isValidEnvelopeLength(envelope.length)) throw new Error('bad envelope size');
  const padded = sodium.crypto_box_seal_open(envelope, sealing.publicKey, sealing.privateKey);
  const plain = sodium.unpad(padded, envelope.length - SEALED_BOX_OVERHEAD);
  return sealedContentSchema.parse(JSON.parse(utf8.decode(plain)));
}
