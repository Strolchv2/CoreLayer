import { describe, expect, it } from 'vitest';
import { ENVELOPE_BUCKETS, SEALED_BOX_OVERHEAD, blobBucket, isValidBlobLength, isValidEnvelopeLength } from '@corelayer/protocol';
import { fromB64, toB64 } from '../src/core/encoding';
import { decryptFile, encryptFile } from '../src/core/files';
import {
  decodeRecoveryKey,
  decryptBackup,
  deriveRecovery,
  encodeRecoveryKey,
  encryptBackup,
  generateRecoveryKey,
  type BackupPayload,
} from '../src/core/recovery';
import { openEnvelope, sealEnvelope } from '../src/core/sealed';
import { getSodium } from '../src/core/sodium';
import { generateAccount } from '../src/core/identity';
import { VaultSignalStore } from '../src/core/signalStore';
import { newVaultState } from '../src/core/state';
import { MemoryVaultStorage, Vault } from '../src/core/vault';

const FAST_KDF = { ops: 1, mem: 8 * 1024 * 1024 };

describe('sealed sender envelopes', () => {
  it('round-trips and pads to a fixed bucket', async () => {
    const sodium = await getSodium();
    const kp = sodium.crypto_box_keypair();
    for (const size of [1, 500, 3000, 20000]) {
      const content = { v: 1 as const, from: '7F3A-91D2-8C41-0B5E', device: 1, type: 1 as const, body: toB64(new Uint8Array(size)) };
      const env = await sealEnvelope(content, kp.publicKey);
      expect(isValidEnvelopeLength(env.length)).toBe(true);
      expect(ENVELOPE_BUCKETS.map((b) => b + SEALED_BOX_OVERHEAD)).toContain(env.length);
      expect(await openEnvelope(env, kp)).toEqual(content);
    }
  });

  it('hides small length differences', async () => {
    const sodium = await getSodium();
    const kp = sodium.crypto_box_keypair();
    const mk = (n: number) => ({ v: 1 as const, from: '7F3A-91D2-8C41-0B5E', device: 1, type: 1 as const, body: toB64(new Uint8Array(n)) });
    const a = await sealEnvelope(mk(10), kp.publicKey);
    const b = await sealEnvelope(mk(400), kp.publicKey);
    expect(a.length).toBe(b.length);
  });

  it('cannot be opened with another key', async () => {
    const sodium = await getSodium();
    const kp = sodium.crypto_box_keypair();
    const other = sodium.crypto_box_keypair();
    const env = await sealEnvelope({ v: 1, from: '7F3A-91D2-8C41-0B5E', device: 1, type: 1, body: '' }, kp.publicKey);
    await expect(openEnvelope(env, other)).rejects.toThrow();
  });
});

describe('file encryption', () => {
  it('round-trips, pads and authenticates', async () => {
    const data = new Uint8Array(70_000).map((_, i) => i & 0xff);
    const { key, blob } = await encryptFile(data);
    expect(isValidBlobLength(blob.length)).toBe(true);
    expect(blob.length).toBe(blobBucket(data.length)! + 40);
    expect(await decryptFile(blob, key)).toEqual(data);
    blob[100]! ^= 1;
    await expect(decryptFile(blob, key)).rejects.toThrow();
  });

  it('makes all small files the same size', async () => {
    const a = await encryptFile(new Uint8Array(10));
    const b = await encryptFile(new Uint8Array(60_000));
    expect(a.blob.length).toBe(b.blob.length);
  });
});

describe('vault (Argon2id at rest)', () => {
  it('encrypts state and rejects a wrong passphrase', async () => {
    const { account, signal } = await generateAccount('ShadowFox');
    const state = newVaultState(account, signal);
    const storage = new MemoryVaultStorage();
    await Vault.create(storage, 'correct horse battery', state, FAST_KDF);
    expect(JSON.stringify(storage.file)).not.toContain('ShadowFox');
    expect(JSON.stringify(storage.file)).not.toContain(account.auth.priv);
    const { state: loaded } = await Vault.unlock(storage, 'correct horse battery');
    expect(loaded.account.id).toBe(account.id);
    await expect(Vault.unlock(storage, 'wrong passphrase!')).rejects.toThrow('wrong passphrase');
  });

  it('refuses short passphrases', async () => {
    const { account, signal } = await generateAccount('');
    await expect(Vault.create(new MemoryVaultStorage(), 'short', newVaultState(account, signal), FAST_KDF)).rejects.toThrow();
  });
});

describe('recovery key', () => {
  it('encodes and decodes losslessly', async () => {
    const raw = await generateRecoveryKey();
    const text = encodeRecoveryKey(raw);
    expect(text).toMatch(/^([A-Z2-9]{4}-){12}[A-Z2-9]{4}$/);
    expect(decodeRecoveryKey(text.toLowerCase().replace(/-/g, ' '))).toEqual(raw);
    expect(() => decodeRecoveryKey('AAAA-BBBB')).toThrow();
  });

  it('derives independent id and key and encrypts the backup', async () => {
    const raw = await generateRecoveryKey();
    const { backupId, key } = await deriveRecovery(raw);
    expect(backupId).toMatch(/^[0-9a-f]{64}$/);
    expect(toB64(key)).not.toBe(toB64(fromB64(toB64(raw))));
    const payload = { v: 1, account: { id: 'X' }, identities: {}, contacts: {}, groups: {} } as unknown as BackupPayload;
    const blob = await encryptBackup(payload, key);
    expect(await decryptBackup(blob, key)).toEqual(payload);
    const other = await deriveRecovery(await generateRecoveryKey());
    await expect(decryptBackup(blob, other.key)).rejects.toThrow();
  });
});

describe('identity pinning', () => {
  it('pins the first key and never silently replaces it', async () => {
    const { account, signal } = await generateAccount('');
    const state = newVaultState(account, signal);
    const store = new VaultSignalStore(state, () => undefined);
    const k1 = new Uint8Array(33).fill(1).buffer;
    const k2 = new Uint8Array(33).fill(2).buffer;
    expect(await store.isTrustedIdentity('PEER', k1, 1)).toBe(true);
    expect(await store.saveIdentity('PEER.1', k1)).toBe(false);
    expect(await store.isTrustedIdentity('PEER', k1, 1)).toBe(true);
    expect(await store.isTrustedIdentity('PEER.1', k2, 1)).toBe(false);
    expect(await store.saveIdentity('PEER.1', k2)).toBe(true);
    expect(await store.isTrustedIdentity('PEER', k2, 1)).toBe(false); // still pending
    store.approvePendingIdentity('PEER');
    expect(await store.isTrustedIdentity('PEER', k2, 1)).toBe(true);
  });
});
