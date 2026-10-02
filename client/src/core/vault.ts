import { fromB64, toB64, utf8 } from './encoding';
import { getSodium } from './sodium';
import type { VaultState } from './state';

/**
 * Local encryption at rest. The whole client state is one JSON document,
 * encrypted with XChaCha20-Poly1305 under a key derived from the user's
 * passphrase with Argon2id. Nothing readable is written to browser storage.
 */
export interface VaultFile {
  v: 1;
  kdf: { alg: 'argon2id13'; salt: string; ops: number; mem: number };
  nonce: string;
  ct: string;
}

/** Storage backend: IndexedDB in the browser, memory in tests. */
export interface VaultStorage {
  load(): Promise<VaultFile | null>;
  save(file: VaultFile): Promise<void>;
  clear(): Promise<void>;
}

export const MIN_PASSPHRASE_LENGTH = 8;

/** Argon2id parameters: 3 passes, 64 MiB — usable on phones, costly to brute-force. */
const KDF_OPS = 3;
const KDF_MEM = 64 * 1024 * 1024;

export class Vault {
  private constructor(
    private readonly storage: VaultStorage,
    private readonly key: Uint8Array,
    private readonly kdf: VaultFile['kdf'],
  ) {}

  static async create(storage: VaultStorage, passphrase: string, state: VaultState, opts?: { ops?: number; mem?: number }) {
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) throw new Error('passphrase too short');
    const sodium = await getSodium();
    const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
    const kdf = { alg: 'argon2id13' as const, salt: toB64(salt), ops: opts?.ops ?? KDF_OPS, mem: opts?.mem ?? KDF_MEM };
    const vault = new Vault(storage, await deriveKey(passphrase, kdf), kdf);
    await vault.save(state);
    return vault;
  }

  static async unlock(storage: VaultStorage, passphrase: string): Promise<{ vault: Vault; state: VaultState }> {
    const file = await storage.load();
    if (!file) throw new Error('no vault');
    const sodium = await getSodium();
    const key = await deriveKey(passphrase, file.kdf);
    let plain: Uint8Array;
    try {
      plain = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, fromB64(file.ct), null, fromB64(file.nonce), key);
    } catch {
      throw new Error('wrong passphrase');
    }
    return { vault: new Vault(storage, key, file.kdf), state: JSON.parse(utf8.decode(plain)) as VaultState };
  }

  async save(state: VaultState): Promise<void> {
    const sodium = await getSodium();
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(utf8.encode(JSON.stringify(state)), null, null, nonce, this.key);
    await this.storage.save({ v: 1, kdf: this.kdf, nonce: toB64(nonce), ct: toB64(ct) });
  }

  /** Forget the key (lock). */
  async wipeKey(): Promise<void> {
    (await getSodium()).memzero(this.key);
  }
}

async function deriveKey(passphrase: string, kdf: VaultFile['kdf']): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_pwhash(
    sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
    passphrase,
    fromB64(kdf.salt),
    kdf.ops,
    kdf.mem,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}

export class MemoryVaultStorage implements VaultStorage {
  file: VaultFile | null = null;
  async load() {
    return this.file;
  }
  async save(f: VaultFile) {
    this.file = f;
  }
  async clear() {
    this.file = null;
  }
}

export class IndexedDbVaultStorage implements VaultStorage {
  private db(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('corelayer', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('vault');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const req = fn(db.transaction('vault', mode).objectStore('vault'));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    }).finally(() => db.close()) as Promise<T>;
  }

  async load() {
    return (await this.tx<VaultFile | undefined>('readonly', (s) => s.get('state'))) ?? null;
  }
  async save(f: VaultFile) {
    await this.tx('readwrite', (s) => s.put(f, 'state'));
  }
  async clear() {
    await this.tx('readwrite', (s) => s.delete('state'));
  }
}
