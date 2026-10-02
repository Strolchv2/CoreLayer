import { ACCOUNT_ID_DOMAIN, DEFAULT_DEVICE_ID, formatAccountId } from '@corelayer/protocol';
import { KeyHelper } from '@privacyresearch/libsignal-protocol-typescript';
import { fromB64, toArrayBuffer, toB64, utf8 } from './encoding';
import { fromPair } from './signalStore';
import { getSodium } from './sodium';
import { emptySignalState, type AccountState, type SignalState } from './state';

export const PREKEY_BATCH = 100;
export const PREKEY_LOW_WATERMARK = 20;
export const SIGNED_PREKEY_ROTATION_MS = 7 * 24 * 3600 * 1000;
/** Old signed prekeys are kept a while for messages still in flight. */
export const SIGNED_PREKEY_GRACE_MS = 14 * 24 * 3600 * 1000;

export async function accountIdFromAuthKey(authPublicKey: Uint8Array): Promise<string> {
  const domain = utf8.encode(ACCOUNT_ID_DOMAIN);
  const buf = new Uint8Array(domain.length + authPublicKey.length);
  buf.set(domain);
  buf.set(authPublicKey, domain.length);
  return formatAccountId(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)));
}

/**
 * Generates every long-term key of a new account on the device. Private keys
 * never leave the device (except inside the optional, end-to-end encrypted
 * recovery backup, under a key only the user holds).
 */
export async function generateAccount(nickname: string): Promise<{ account: AccountState; signal: SignalState }> {
  const sodium = await getSodium();
  const auth = sodium.crypto_sign_keypair();
  const sealing = sodium.crypto_box_keypair();
  const identity = await KeyHelper.generateIdentityKeyPair();
  const account: AccountState = {
    id: await accountIdFromAuthKey(auth.publicKey),
    deviceId: DEFAULT_DEVICE_ID,
    nickname,
    auth: { pub: toB64(auth.publicKey), priv: toB64(auth.privateKey) },
    sealing: { pub: toB64(sealing.publicKey), priv: toB64(sealing.privateKey) },
    identity: fromPair(identity),
    registrationId: KeyHelper.generateRegistrationId(),
    nextPreKeyId: 1,
    nextSignedPreKeyId: 1,
    activeSignedPreKeyId: 0,
  };
  return { account, signal: emptySignalState() };
}

/** Creates a new signed prekey, stores it locally and returns its public part. */
export async function newSignedPreKey(account: AccountState, signal: SignalState) {
  const identity = { pubKey: toArrayBuffer(fromB64(account.identity.pub)), privKey: toArrayBuffer(fromB64(account.identity.priv)) };
  const keyId = account.nextSignedPreKeyId++;
  const spk = await KeyHelper.generateSignedPreKey(identity, keyId);
  signal.signedPreKeys[String(keyId)] = { ...fromPair(spk.keyPair), createdAt: Date.now() };
  account.activeSignedPreKeyId = keyId;
  return { keyId, publicKey: toB64(spk.keyPair.pubKey), signature: toB64(spk.signature) };
}

/** Creates a batch of one-time prekeys, stores them locally and returns the public parts. */
export async function newPreKeys(account: AccountState, signal: SignalState, count = PREKEY_BATCH) {
  const out: { keyId: number; publicKey: string }[] = [];
  for (let i = 0; i < count; i++) {
    const keyId = account.nextPreKeyId;
    account.nextPreKeyId = (account.nextPreKeyId % 0xfffffe) + 1;
    const pk = await KeyHelper.generatePreKey(keyId);
    signal.preKeys[String(keyId)] = fromPair(pk.keyPair);
    out.push({ keyId, publicKey: toB64(pk.keyPair.pubKey) });
  }
  return out;
}

/** Drops signed prekeys that are past their grace period (forward secrecy). */
export function pruneSignedPreKeys(account: AccountState, signal: SignalState, now = Date.now()): void {
  for (const [id, rec] of Object.entries(signal.signedPreKeys)) {
    if (Number(id) !== account.activeSignedPreKeyId && now - rec.createdAt > SIGNED_PREKEY_GRACE_MS) {
      delete signal.signedPreKeys[id];
    }
  }
}
