import type { Direction, KeyPairType, SessionRecordType, StorageType } from '@privacyresearch/libsignal-protocol-typescript';
import { bytesEqual, fromB64, toArrayBuffer, toB64 } from './encoding';
import type { KeyPairB64, VaultState } from './state';

const toPair = (p: KeyPairB64): KeyPairType => ({
  pubKey: toArrayBuffer(fromB64(p.pub)),
  privKey: toArrayBuffer(fromB64(p.priv)),
});
export const fromPair = (p: KeyPairType): KeyPairB64 => ({ pub: toB64(p.pubKey), priv: toB64(p.privKey) });

/** "7F3A-...-0B5E.1" -> "7F3A-...-0B5E" (the library mixes both forms). */
const nameOf = (identifier: string) => identifier.replace(/\.\d+$/, '');

/**
 * libsignal storage backed by the encrypted vault state.
 *
 * Identity keys are pinned on first use and never replaced silently: if a
 * contact presents a different identity key, it is parked as `pendingKey`
 * and every message under that key is rejected until the user approves it
 * (ideally after comparing safety numbers out of band).
 */
export class VaultSignalStore implements StorageType {
  constructor(
    private readonly state: VaultState,
    private readonly onChange: () => void,
  ) {}

  private get s() {
    return this.state.signal;
  }

  async getIdentityKeyPair() {
    return toPair(this.state.account.identity);
  }

  async getLocalRegistrationId() {
    return this.state.account.registrationId;
  }

  async isTrustedIdentity(identifier: string, identityKey: ArrayBuffer, _direction: Direction) {
    return this.isTrusted(nameOf(identifier), new Uint8Array(identityKey));
  }

  isTrusted(name: string, key: Uint8Array): boolean {
    const rec = this.s.identities[name];
    return !rec || bytesEqual(fromB64(rec.key), key);
  }

  /** Pins `key` for `name` if nothing is pinned yet. Returns true if the key differs from the pinned one. */
  async saveIdentity(identifier: string, publicKey: ArrayBuffer): Promise<boolean> {
    const name = nameOf(identifier);
    const key = toB64(publicKey);
    const rec = this.s.identities[name];
    if (!rec) {
      this.s.identities[name] = { key, verified: false };
      this.onChange();
      return false;
    }
    if (rec.key === key) return false;
    rec.pendingKey = key;
    this.onChange();
    return true;
  }

  /** User accepted a changed identity key: pin it and drop old sessions. */
  approvePendingIdentity(name: string): void {
    const rec = this.s.identities[name];
    if (!rec?.pendingKey) return;
    // The sealing key belonged to the old identity; it is re-fetched and re-verified.
    this.s.identities[name] = { key: rec.pendingKey, verified: false };
    this.deleteSessionsFor(name);
  }

  setVerified(name: string, verified: boolean): void {
    const rec = this.s.identities[name];
    if (rec) rec.verified = verified;
    this.onChange();
  }

  deleteSessionsFor(name: string): void {
    for (const k of Object.keys(this.s.sessions)) if (nameOf(k) === name) delete this.s.sessions[k];
    this.onChange();
  }

  async loadPreKey(keyId: string | number) {
    const p = this.s.preKeys[String(keyId)];
    return p ? toPair(p) : undefined;
  }

  async storePreKey(keyId: string | number, keyPair: KeyPairType) {
    this.s.preKeys[String(keyId)] = fromPair(keyPair);
    this.onChange();
  }

  async removePreKey(keyId: string | number) {
    delete this.s.preKeys[String(keyId)];
    this.onChange();
  }

  async storeSession(encodedAddress: string, record: SessionRecordType) {
    this.s.sessions[encodedAddress] = record;
    this.onChange();
  }

  async loadSession(encodedAddress: string) {
    return this.s.sessions[encodedAddress];
  }

  async loadSignedPreKey(keyId: string | number) {
    const p = this.s.signedPreKeys[String(keyId)];
    return p ? toPair(p) : undefined;
  }

  async storeSignedPreKey(keyId: string | number, keyPair: KeyPairType) {
    this.s.signedPreKeys[String(keyId)] = { ...fromPair(keyPair), createdAt: Date.now() };
    this.onChange();
  }

  async removeSignedPreKey(keyId: string | number) {
    delete this.s.signedPreKeys[String(keyId)];
    this.onChange();
  }
}
