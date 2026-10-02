import { describe, expect, it } from 'vitest';
import { FingerprintGenerator, KeyHelper } from '@privacyresearch/libsignal-protocol-typescript';
import { safetyNumber } from '../src/core/fingerprint';

describe('safety numbers', () => {
  it('are bit-identical to libsignal FingerprintGenerator', async () => {
    for (let i = 0; i < 3; i++) {
      const a = await KeyHelper.generateIdentityKeyPair();
      const b = await KeyHelper.generateIdentityKeyPair();
      const expected = await new FingerprintGenerator(50).createFor('7F3A-91D2-8C41-0B5E', a.pubKey, '0000-1111-2222-3333', b.pubKey);
      const ours = await safetyNumber('7F3A-91D2-8C41-0B5E', new Uint8Array(a.pubKey), '0000-1111-2222-3333', new Uint8Array(b.pubKey), 50);
      expect(ours).toBe(expected);
      expect(ours).toMatch(/^\d{60}$/);
    }
  });
});
