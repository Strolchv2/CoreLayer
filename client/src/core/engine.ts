import {
  DEFAULT_DEVICE_ID,
  MAX_FILE_BYTES,
  SEALING_KEY_SIGNATURE_CONTEXT,
  TTL_OPTIONS,
  WS_PATH,
  chatContentSchema,
  type ChatContent,
  type FileRef,
  type GroupInfo,
  type PublicIdentity,
  type ServerWsMessage,
} from '@corelayer/protocol';
import { PreKeyWhisperMessage } from '@privacyresearch/libsignal-protocol-protobuf-ts';
import {
  SessionBuilder,
  SessionCipher,
  SignalProtocolAddress,
} from '@privacyresearch/libsignal-protocol-typescript';
import { Api, ApiError } from './api';
import { bytesEqual, fromB64, randomHex, toArrayBuffer, toB64, utf8 } from './encoding';
import { decryptFile, encryptFile } from './files';
import { safetyNumber } from './fingerprint';
import {
  PREKEY_LOW_WATERMARK,
  SIGNED_PREKEY_ROTATION_MS,
  generateAccount,
  newPreKeys,
  newSignedPreKey,
  pruneSignedPreKeys,
} from './identity';
import {
  decodeRecoveryKey,
  decryptBackup,
  deriveRecovery,
  encodeRecoveryKey,
  encryptBackup,
  generateRecoveryKey,
  type BackupPayload,
} from './recovery';
import { openEnvelope, sealEnvelope } from './sealed';
import { identitySign, identityVerify } from './signalCurve';
import { VaultSignalStore } from './signalStore';
import { getSodium } from './sodium';
import {
  convIdForContact,
  convIdForGroup,
  emptySignalState,
  newVaultState,
  pruneExpired,
  type ChatMessage,
  type Contact,
  type Group,
  type VaultState,
} from './state';
import type { Vault } from './vault';

export class IdentityChangedError extends Error {
  constructor(readonly accountId: string) {
    super(`The safety number with ${accountId} has changed`);
  }
}

export type ConnectionStatus = 'offline' | 'connecting' | 'online';
export type EngineListener = () => void;

const ttlLabel = (s: number) => TTL_OPTIONS.find((o) => o.seconds === s)?.label ?? `${s}s`;

// ---------------------------------------------------------------------------
// Account creation / restore (before an engine exists)
// ---------------------------------------------------------------------------

async function signChallenge(state: VaultState, challenge: string, context: string): Promise<string> {
  const sodium = await getSodium();
  const msg = new Uint8Array([...utf8.encode(context), ...fromB64(challenge)]);
  return toB64(sodium.crypto_sign_detached(msg, fromB64(state.account.auth.priv)));
}

async function signSealingKey(state: VaultState): Promise<string> {
  const msg = new Uint8Array([...utf8.encode(SEALING_KEY_SIGNATURE_CONTEXT), ...fromB64(state.account.sealing.pub)]);
  return toB64(await identitySign(fromB64(state.account.identity.priv), msg));
}

/** Creates all keys on the device and registers the anonymous account. */
export async function createAccount(api: Api, nickname: string): Promise<VaultState> {
  const { account, signal } = await generateAccount(nickname.trim());
  const state = newVaultState(account, signal);
  const signedPreKey = await newSignedPreKey(account, signal);
  const preKeys = await newPreKeys(account, signal);
  const { challenge } = await api.challenge();
  const res = await api.register({
    authPublicKey: account.auth.pub,
    sealingPublicKey: account.sealing.pub,
    sealingKeySignature: await signSealingKey(state),
    identityKey: account.identity.pub,
    registrationId: account.registrationId,
    signedPreKey,
    preKeys,
    challenge,
    signature: await signChallenge(state, challenge, 'corelayer/register/v1:'),
  });
  if (res.accountId !== account.id) throw new Error('server returned an unexpected account id');
  return state;
}

/** Restores the long-term identity from the encrypted backup addressed by the recovery key. */
export async function restoreAccount(api: Api, recoveryKeyText: string): Promise<VaultState> {
  const raw = decodeRecoveryKey(recoveryKeyText);
  const { backupId, key } = await deriveRecovery(raw);
  const { blob } = await api.getRecovery(backupId);
  const backup = await decryptBackup(blob, key);
  const signal = emptySignalState();
  for (const [id, rec] of Object.entries(backup.identities)) signal.identities[id] = { key: rec.key, verified: rec.verified };
  const state = newVaultState(
    {
      ...backup.account,
      deviceId: DEFAULT_DEVICE_ID,
      // Fresh, random key-id ranges so that new prekeys never collide with old ones.
      nextPreKeyId: 1 + Math.floor(Math.random() * 0xf00000),
      nextSignedPreKeyId: 1 + Math.floor(Math.random() * 0xf00000),
      activeSignedPreKeyId: 0,
    },
    signal,
  );
  state.contacts = backup.contacts;
  state.groups = backup.groups;
  state.recovery = { backupId, key: toB64(key) };
  const signedPreKey = await newSignedPreKey(state.account, signal);
  const preKeys = await newPreKeys(state.account, signal);
  const token = await login(api, state);
  await api.uploadKeys(token, { signedPreKey, preKeys, replaceAll: true });
  return state;
}

async function login(api: Api, state: VaultState): Promise<string> {
  const { challenge } = await api.challenge();
  const { token } = await api.session({
    accountId: state.account.id,
    challenge,
    signature: await signChallenge(state, challenge, 'corelayer/session/v1:'),
  });
  return token;
}

// ---------------------------------------------------------------------------
// The messenger engine
// ---------------------------------------------------------------------------

export interface EngineOptions {
  api: Api;
  /** e.g. "wss://chat.example" ; WS_PATH is appended. */
  wsBase: string;
  vault: Vault;
  state: VaultState;
}

export class Messenger {
  readonly api: Api;
  readonly state: VaultState;
  readonly store: VaultSignalStore;
  status: ConnectionStatus = 'offline';

  private readonly vault: Vault;
  private readonly wsBase: string;
  private listeners = new Set<EngineListener>();
  private token: string | null = null;
  private ws: WebSocket | null = null;
  private stopped = true;
  private backoff = 1000;
  private incoming: Promise<void> = Promise.resolve();
  private seen = new Set<string>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> = Promise.resolve();
  private backupTimer: ReturnType<typeof setTimeout> | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];

  constructor(opts: EngineOptions) {
    this.api = opts.api;
    this.vault = opts.vault;
    this.state = opts.state;
    this.wsBase = opts.wsBase;
    this.store = new VaultSignalStore(this.state, () => this.markDirty());
  }

  get me(): string {
    return this.state.account.id;
  }

  subscribe(fn: EngineListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  // --- persistence ---------------------------------------------------------

  markDirty(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, 250);
  }

  /** Writes the encrypted vault now. Resolves once the write is done. */
  flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.saving = this.saving.then(() => this.vault.save(this.state)).catch(() => undefined);
    return this.saving;
  }

  private changed(opts: { backup?: boolean } = {}): void {
    this.markDirty();
    if (opts.backup) this.scheduleBackup();
    this.emit();
  }

  // --- lifecycle -------------------------------------------------------------

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    if (pruneExpired(this.state)) this.changed();
    // Disappearing messages: purge expired messages every second.
    this.timers.push(
      setInterval(() => {
        if (pruneExpired(this.state)) this.changed();
      }, 1000),
    );
    // Keep the WebSocket alive and replenish keys periodically.
    this.timers.push(setInterval(() => this.ws?.readyState === 1 && this.ws.send(JSON.stringify({ t: 'ping' })), 30_000));
    this.timers.push(setInterval(() => void this.maintainKeys().catch(() => undefined), 6 * 3600_000));
    this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    this.ws?.close();
    this.ws = null;
    this.setStatus('offline');
    await this.incoming;
    await this.flush();
  }

  private setStatus(s: ConnectionStatus): void {
    this.status = s;
    this.emit();
  }

  private async authToken(fresh = false): Promise<string> {
    if (!this.token || fresh) this.token = await login(this.api, this.state);
    return this.token;
  }

  /** Runs an authenticated request, logging in again once if the token expired. */
  private async authed<T>(fn: (token: string) => Promise<T>): Promise<T> {
    try {
      return await fn(await this.authToken());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return fn(await this.authToken(true));
      throw e;
    }
  }

  private connect(): void {
    if (this.stopped) return;
    this.setStatus('connecting');
    void (async () => {
      let token: string;
      try {
        token = await this.authToken(true);
      } catch {
        return this.scheduleReconnect();
      }
      const ws = new WebSocket(this.wsBase + WS_PATH);
      this.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', token }));
      ws.onmessage = (ev) => {
        let msg: ServerWsMessage;
        try {
          msg = JSON.parse(String(ev.data)) as ServerWsMessage;
        } catch {
          return;
        }
        if (msg.t === 'ready') {
          this.backoff = 1000;
          this.setStatus('online');
          void this.maintainKeys().catch(() => undefined);
        } else if (msg.t === 'msg') {
          const { id, envelope } = msg;
          this.incoming = this.incoming.then(() => this.receive(id, envelope)).catch(() => undefined);
        }
      };
      ws.onclose = () => {
        if (this.ws === ws) this.ws = null;
        this.scheduleReconnect();
      };
    })();
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.setStatus('connecting');
    const delay = this.backoff * (0.5 + Math.random());
    this.backoff = Math.min(this.backoff * 2, 30_000);
    setTimeout(() => this.connect(), delay);
  }

  /** Replenishes one-time prekeys and rotates the signed prekey weekly. */
  async maintainKeys(): Promise<void> {
    const { account, signal } = this.state;
    const active = signal.signedPreKeys[String(account.activeSignedPreKeyId)];
    const rotate = !active || Date.now() - active.createdAt > SIGNED_PREKEY_ROTATION_MS;
    const { count } = await this.authed((t) => this.api.keyCount(t));
    if (!rotate && count >= PREKEY_LOW_WATERMARK) return;
    const signedPreKey = rotate ? await newSignedPreKey(account, signal) : undefined;
    const preKeys = count < PREKEY_LOW_WATERMARK ? await newPreKeys(account, signal) : [];
    await this.flush(); // private halves must be persisted before the public halves are published
    await this.authed((t) => this.api.uploadKeys(t, { signedPreKey, preKeys }));
    pruneSignedPreKeys(account, signal);
    this.changed();
  }

  // --- peers -----------------------------------------------------------------

  private async verifyPublicIdentity(p: PublicIdentity): Promise<void> {
    const msg = new Uint8Array([...utf8.encode(SEALING_KEY_SIGNATURE_CONTEXT), ...fromB64(p.sealingPublicKey)]);
    if (!(await identityVerify(fromB64(p.identityKey), msg, fromB64(p.sealingKeySignature)))) {
      throw new Error('invalid sealing key signature');
    }
  }

  /** Pins a peer's identity (trust on first use) or detects a changed one. */
  private async pin(p: PublicIdentity): Promise<void> {
    await this.verifyPublicIdentity(p);
    const rec = this.state.signal.identities[p.accountId];
    if (rec && rec.key !== p.identityKey) {
      if (rec.pendingKey !== p.identityKey) {
        rec.pendingKey = p.identityKey;
        this.notice(this.convOf(p.accountId), `The safety number with ${this.displayName(p.accountId)} has changed. Verify it before continuing.`);
      }
      throw new IdentityChangedError(p.accountId);
    }
    this.state.signal.identities[p.accountId] = { key: p.identityKey, sealingKey: p.sealingPublicKey, verified: rec?.verified ?? false };
    this.markDirty();
  }

  /** Long-term keys of a peer, fetched and verified once, then cached locally. */
  private async peerKeys(accountId: string): Promise<{ identityKey: string; sealingKey: string }> {
    const rec = this.state.signal.identities[accountId];
    if (rec?.pendingKey) throw new IdentityChangedError(accountId);
    if (rec?.sealingKey) return { identityKey: rec.key, sealingKey: rec.sealingKey };
    await this.pin(await this.api.publicIdentity(accountId));
    const r = this.state.signal.identities[accountId]!;
    return { identityKey: r.key, sealingKey: r.sealingKey! };
  }

  private address(accountId: string) {
    return new SignalProtocolAddress(accountId, DEFAULT_DEVICE_ID);
  }

  private async ensureSession(accountId: string): Promise<void> {
    const addr = this.address(accountId);
    if (await new SessionCipher(this.store, addr).hasOpenSession()) return;
    const bundle = await this.api.keyBundle(accountId);
    await this.pin(bundle);
    await new SessionBuilder(this.store, addr).processPreKey({
      identityKey: toArrayBuffer(fromB64(bundle.identityKey)),
      registrationId: bundle.registrationId,
      signedPreKey: {
        keyId: bundle.signedPreKey.keyId,
        publicKey: toArrayBuffer(fromB64(bundle.signedPreKey.publicKey)),
        signature: toArrayBuffer(fromB64(bundle.signedPreKey.signature)),
      },
      preKey: bundle.preKey
        ? { keyId: bundle.preKey.keyId, publicKey: toArrayBuffer(fromB64(bundle.preKey.publicKey)) }
        : undefined,
    });
  }

  // --- sending ---------------------------------------------------------------

  /** Encrypts `content` for one recipient and hands it to the relay without naming the sender. */
  private async deliver(to: string, content: ChatContent): Promise<void> {
    const { sealingKey } = await this.peerKeys(to);
    await this.ensureSession(to);
    const cipher = new SessionCipher(this.store, this.address(to));
    const res = await cipher.encrypt(toArrayBuffer(utf8.encode(JSON.stringify(content))));
    if (!res.body || (res.type !== 1 && res.type !== 3)) throw new Error('encryption failed');
    const body = Uint8Array.from(res.body, (c) => c.charCodeAt(0)); // libsignal returns a binary string
    const envelope = await sealEnvelope(
      { v: 1, from: this.me, device: this.state.account.deviceId, type: res.type, body: toB64(body) },
      fromB64(sealingKey),
    );
    await this.flush(); // ratchet state must be on disk before the message leaves
    await this.api.sendMessage({ to, envelope: toB64(envelope), ttlSeconds: content.ttl });
  }

  private conversationTarget(convId: string): { members: string[]; group?: GroupInfo; ttl: number } {
    if (convId.startsWith('g:')) {
      const g = this.state.groups[convId.slice(2)];
      if (!g) throw new Error('unknown group');
      return { members: g.members.filter((m) => m !== this.me), group: { id: g.id, name: g.name, members: g.members }, ttl: g.ttl };
    }
    const c = this.state.contacts[convId.slice(2)];
    if (!c) throw new Error('unknown contact');
    return { members: [c.id], ttl: c.ttl };
  }

  private newContent(kind: ChatContent['kind'], ttl: number, extra: Partial<ChatContent> = {}): ChatContent {
    return {
      v: 1,
      id: randomHex(16),
      kind,
      sentAt: Date.now(),
      ttl,
      ...(this.state.account.nickname ? { nick: this.state.account.nickname } : {}),
      ...extra,
    };
  }

  private async fanOut(recipients: string[], content: ChatContent): Promise<string[]> {
    const failed: string[] = [];
    for (const to of recipients) {
      try {
        await this.deliver(to, content);
      } catch {
        failed.push(to);
      }
    }
    return failed;
  }

  private async sendContent(convId: string, kind: 'text' | 'file', extra: Partial<ChatContent>): Promise<void> {
    const target = this.conversationTarget(convId);
    const content = this.newContent(kind, target.ttl, { ...extra, ...(target.group ? { group: target.group } : {}) });
    const msg: ChatMessage = {
      id: content.id,
      from: 'me',
      kind,
      text: content.text,
      file: content.file,
      sentAt: content.sentAt,
      expiresAt: content.sentAt + content.ttl * 1000,
    };
    this.append(convId, msg);
    const failed = await this.fanOut(target.members, content);
    if (failed.length > 0) {
      msg.failed = true;
      this.notice(convId, `Could not deliver to ${failed.map((f) => this.displayName(f)).join(', ')}.`);
      this.changed();
    }
  }

  sendText(convId: string, text: string): Promise<void> {
    const t = text.trim();
    if (!t) return Promise.resolve();
    return this.sendContent(convId, 'text', { text: t });
  }

  /** Encrypts the file on the device, uploads only ciphertext, sends the key end-to-end. */
  async sendFile(convId: string, file: { name: string; mime: string; data: Uint8Array }): Promise<void> {
    if (file.data.length > MAX_FILE_BYTES) throw new Error('File is larger than 10 MB');
    const { ttl } = this.conversationTarget(convId);
    const { key, blob } = await encryptFile(file.data);
    const { id } = await this.api.uploadBlob(blob, ttl);
    const ref: FileRef = { blobId: id, key: toB64(key), size: file.data.length, name: file.name.slice(0, 200), mime: file.mime.slice(0, 100) };
    await this.sendContent(convId, 'file', { file: ref });
  }

  async downloadFile(ref: FileRef): Promise<Uint8Array> {
    return decryptFile(await this.api.downloadBlob(ref.blobId), fromB64(ref.key));
  }

  // --- contacts & groups -----------------------------------------------------

  /** Adds a contact locally. The server is only asked for the contact's public keys. */
  async addContact(accountId: string, alias?: string): Promise<string> {
    if (accountId === this.me) throw new Error('That is your own ID');
    await this.peerKeys(accountId);
    const existing = this.state.contacts[accountId];
    this.state.contacts[accountId] = {
      ...(existing ?? { id: accountId, ttl: this.state.settings.defaultTtl }),
      ...(alias ? { alias } : {}),
      request: false,
    };
    this.changed({ backup: true });
    return convIdForContact(accountId);
  }

  acceptRequest(accountId: string): void {
    const c = this.state.contacts[accountId];
    if (c) c.request = false;
    this.changed({ backup: true });
  }

  renameContact(accountId: string, alias: string): void {
    const c = this.state.contacts[accountId];
    if (c) c.alias = alias.trim() || undefined;
    this.changed({ backup: true });
  }

  async createGroup(name: string, members: string[]): Promise<string> {
    const unique = [...new Set(members.filter((m) => m !== this.me))];
    for (const m of unique) await this.peerKeys(m);
    const group: Group = { id: randomHex(16), name: name.trim().slice(0, 80) || 'Group', members: [this.me, ...unique], ttl: this.state.settings.defaultTtl };
    this.state.groups[group.id] = group;
    const convId = convIdForGroup(group.id);
    this.notice(convId, `You created the group "${group.name}".`);
    this.changed({ backup: true });
    const content = this.newContent('group-update', group.ttl, { group: { id: group.id, name: group.name, members: group.members } });
    await this.fanOut(unique, content);
    return convId;
  }

  async addGroupMembers(groupId: string, members: string[]): Promise<void> {
    const g = this.state.groups[groupId];
    if (!g) return;
    for (const m of members) await this.peerKeys(m);
    g.members = [...new Set([...g.members, ...members])];
    this.changed({ backup: true });
    const content = this.newContent('group-update', g.ttl, { group: { id: g.id, name: g.name, members: g.members } });
    await this.fanOut(g.members.filter((m) => m !== this.me), content);
  }

  async leaveGroup(groupId: string): Promise<void> {
    const g = this.state.groups[groupId];
    if (!g) return;
    const others = g.members.filter((m) => m !== this.me);
    const content = this.newContent('group-leave', g.ttl, { group: { id: g.id, name: g.name, members: g.members } });
    delete this.state.groups[groupId];
    delete this.state.conversations[convIdForGroup(groupId)];
    this.changed({ backup: true });
    await this.fanOut(others, content);
  }

  /** Deletes a conversation from this device only. */
  deleteConversation(convId: string): void {
    delete this.state.conversations[convId];
    if (convId.startsWith('u:')) delete this.state.contacts[convId.slice(2)];
    this.changed({ backup: true });
  }

  async setConversationTtl(convId: string, ttl: number): Promise<void> {
    const target = this.conversationTarget(convId);
    if (convId.startsWith('g:')) this.state.groups[convId.slice(2)]!.ttl = ttl;
    else this.state.contacts[convId.slice(2)]!.ttl = ttl;
    this.notice(convId, `You set disappearing messages to ${ttlLabel(ttl)}.`);
    this.changed();
    await this.fanOut(target.members, this.newContent('ttl-update', ttl, target.group ? { group: target.group } : {}));
  }

  setNickname(nickname: string): void {
    this.state.account.nickname = nickname.trim().slice(0, 40);
    this.changed({ backup: true });
  }

  setDefaultTtl(ttl: number): void {
    this.state.settings.defaultTtl = ttl;
    this.changed();
  }

  displayName(accountId: string): string {
    if (accountId === this.me) return 'You';
    const c = this.state.contacts[accountId];
    return c?.alias || c?.nickname || this.state.nicknames?.[accountId] || accountId;
  }

  // --- safety numbers --------------------------------------------------------

  async safetyNumber(accountId: string): Promise<string | null> {
    const rec = this.state.signal.identities[accountId];
    if (!rec) return null;
    const fp = await safetyNumber(this.me, fromB64(this.state.account.identity.pub), accountId, fromB64(rec.pendingKey ?? rec.key));
    return fp.match(/.{5}/g)!.join(' ');
  }

  setVerified(accountId: string, verified: boolean): void {
    this.store.setVerified(accountId, verified);
    this.changed({ backup: true });
  }

  approveIdentityChange(accountId: string): void {
    this.store.approvePendingIdentity(accountId);
    this.notice(this.convOf(accountId), `You accepted the new safety number of ${this.displayName(accountId)}.`);
    this.changed({ backup: true });
  }

  // --- receiving -------------------------------------------------------------

  private async receive(seq: string, envelopeB64: string): Promise<void> {
    // A redelivery (e.g. the previous ack was lost) is acknowledged again but not reprocessed.
    if (!this.seen.has(seq)) {
      this.seen.add(seq);
      if (this.seen.size > 5000) this.seen = new Set([...this.seen].slice(-2500));
      try {
        await this.handleEnvelope(envelopeB64);
      } catch {
        // Undecryptable or malformed input is dropped; there is nothing to retry.
      }
      await this.flush(); // persist ratchet state before acknowledging
    }
    this.ws?.readyState === 1 && this.ws.send(JSON.stringify({ t: 'ack', ids: [seq] }));
  }

  private async handleEnvelope(envelopeB64: string): Promise<void> {
    const sealed = await openEnvelope(fromB64(envelopeB64), {
      publicKey: fromB64(this.state.account.sealing.pub),
      privateKey: fromB64(this.state.account.sealing.priv),
    });
    const from = sealed.from;
    if (from === this.me) return;
    const body = fromB64(sealed.body);
    const cipher = new SessionCipher(this.store, this.address(from));
    let plain: ArrayBuffer;

    if (sealed.type === 3) {
      // libsignal 0.0.16 does not await its own identity check for PreKey
      // messages, so the presented identity key is checked here, before any
      // session state is touched.
      const presented = PreKeyWhisperMessage.decode(body.slice(1)).identityKey;
      if (!presented) throw new Error('missing identity key');
      try {
        await this.peerKeys(from);
      } catch (e) {
        if (e instanceof IdentityChangedError) return;
        throw e;
      }
      const pinned = this.state.signal.identities[from]!;
      if (!bytesEqual(fromB64(pinned.key), presented)) {
        if (pinned.pendingKey !== toB64(presented)) {
          pinned.pendingKey = toB64(presented);
          this.notice(this.convOf(from), `A message from ${this.displayName(from)} used a different safety number and was rejected. Verify before accepting.`);
          this.changed();
        }
        return;
      }
      plain = await cipher.decryptPreKeyWhisperMessage(toArrayBuffer(body), 'binary');
    } else {
      if (this.state.signal.identities[from]?.pendingKey) return;
      try {
        plain = await cipher.decryptWhisperMessage(toArrayBuffer(body), 'binary');
      } catch (e) {
        // Most likely the sender (or we) restored from backup and the old
        // session is gone. Drop it so the next message starts a new one.
        this.store.deleteSessionsFor(from);
        this.notice(this.convOf(from), `A message from ${this.displayName(from)} could not be decrypted.`);
        this.changed();
        throw e;
      }
    }

    const content = chatContentSchema.parse(JSON.parse(utf8.decode(plain)));
    this.handleContent(from, content);
  }

  private convOf(accountId: string): string {
    return convIdForContact(accountId);
  }

  private handleContent(from: string, content: ChatContent): void {
    const now = Date.now();
    const sentAt = Math.min(content.sentAt, now); // never trust a sender clock in the future
    const expiresAt = sentAt + content.ttl * 1000;

    // Remember the nickname the sender chose (shown e.g. for group members).
    const contact = this.state.contacts[from];
    if (content.nick) {
      if (contact) contact.nickname = content.nick;
      (this.state.nicknames ??= {})[from] = content.nick;
    }

    let convId: string;
    if (content.group) {
      const info = content.group;
      if (!info.members.includes(from)) return; // only members may speak for a group
      let g = this.state.groups[info.id];
      if (content.kind === 'group-leave') {
        if (!g) return;
        g.members = g.members.filter((m) => m !== from);
        this.notice(convIdForGroup(g.id), `${this.displayName(from)} left the group.`);
        this.changed({ backup: true });
        return;
      }
      if (!g) {
        if (!info.members.includes(this.me)) return;
        g = { id: info.id, name: info.name, members: info.members, ttl: content.ttl };
        this.state.groups[g.id] = g;
        this.notice(convIdForGroup(g.id), `${this.displayName(from)} added you to "${info.name}".`);
      } else if (!g.members.includes(from)) {
        return; // a former member cannot re-add themselves
      } else {
        g.name = info.name;
        g.members = info.members;
        if (!info.members.includes(this.me)) {
          this.notice(convIdForGroup(g.id), `You were removed from "${g.name}".`);
          g.members = [];
        }
      }
      convId = convIdForGroup(g.id);
      if (content.kind === 'ttl-update') {
        g.ttl = content.ttl;
        this.notice(convId, `${this.displayName(from)} set disappearing messages to ${ttlLabel(content.ttl)}.`);
      }
      if (content.kind === 'group-update' || content.kind === 'ttl-update') {
        this.changed({ backup: true });
        return;
      }
    } else {
      if (content.kind !== 'text' && content.kind !== 'file' && content.kind !== 'ttl-update') return;
      if (!contact) {
        // Unsolicited first contact: shown as a message request.
        this.state.contacts[from] = { id: from, nickname: content.nick, ttl: content.ttl, request: true } satisfies Contact;
      }
      convId = convIdForContact(from);
      if (content.kind === 'ttl-update') {
        this.state.contacts[from]!.ttl = content.ttl;
        this.notice(convId, `${this.displayName(from)} set disappearing messages to ${ttlLabel(content.ttl)}.`);
        this.changed({ backup: true });
        return;
      }
    }

    if (expiresAt <= now) return; // already expired in transit
    if (content.kind !== 'text' && content.kind !== 'file') return;
    this.append(convId, { id: content.id, from, kind: content.kind, text: content.text, file: content.file, sentAt, expiresAt });
  }

  private append(convId: string, msg: ChatMessage): void {
    const list = (this.state.conversations[convId] ??= []);
    if (list.some((m) => m.id === msg.id)) return;
    list.push(msg);
    this.changed();
  }

  /** Local-only notice in a conversation. Expires like everything else. */
  private notice(convId: string, text: string): void {
    const ttl = convId.startsWith('g:')
      ? (this.state.groups[convId.slice(2)]?.ttl ?? this.state.settings.defaultTtl)
      : (this.state.contacts[convId.slice(2)]?.ttl ?? this.state.settings.defaultTtl);
    const now = Date.now();
    this.append(convId, { id: randomHex(16), from: 'system', kind: 'system', text, sentAt: now, expiresAt: now + ttl * 1000 });
  }

  // --- recovery & account ----------------------------------------------------

  private backupPayload(): BackupPayload {
    const { id, nickname, auth, sealing, identity, registrationId } = this.state.account;
    const identities: BackupPayload['identities'] = {};
    for (const [k, v] of Object.entries(this.state.signal.identities)) identities[k] = { key: v.key, verified: v.verified };
    return { v: 1, account: { id, nickname, auth, sealing, identity, registrationId }, identities, contacts: this.state.contacts, groups: this.state.groups };
  }

  private scheduleBackup(): void {
    if (!this.state.recovery || this.backupTimer) return;
    this.backupTimer = setTimeout(() => {
      this.backupTimer = null;
      void this.uploadBackup().catch(() => undefined);
    }, 5000);
  }

  private async uploadBackup(): Promise<void> {
    const r = this.state.recovery;
    if (!r) return;
    const blob = await encryptBackup(this.backupPayload(), fromB64(r.key));
    await this.authed((t) => this.api.putRecovery(t, r.backupId, blob));
  }

  /** Generates a recovery key on the device and stores an encrypted backup. Returns the key for the user to write down. */
  async enableRecovery(): Promise<string> {
    const raw = await generateRecoveryKey();
    const { backupId, key } = await deriveRecovery(raw);
    this.state.recovery = { backupId, key: toB64(key) };
    await this.uploadBackup();
    this.changed();
    return encodeRecoveryKey(raw);
  }

  async disableRecovery(): Promise<void> {
    await this.authed((t) => this.api.deleteRecovery(t));
    delete this.state.recovery;
    this.changed();
  }

  /** Deletes the account and everything the server holds for it. */
  async deleteAccount(): Promise<void> {
    await this.authed((t) => this.api.deleteAccount(t));
    await this.stop();
  }
}
