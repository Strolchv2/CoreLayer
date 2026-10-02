/**
 * End-to-end test: real relay server + Postgres, two (or three) real client
 * engines talking through it. Requires TEST_DATABASE_URL; skipped otherwise.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/src/app';
import { createPool, migrate, type Db } from '../../server/src/db';
import { Api } from '../src/core/api';
import { Messenger, createAccount, restoreAccount } from '../src/core/engine';
import { convIdForContact, convIdForGroup, type VaultState } from '../src/core/state';
import { MemoryVaultStorage, Vault } from '../src/core/vault';

const DB_URL = process.env.TEST_DATABASE_URL;
const SECRET = Buffer.alloc(32, 7);
const FAST_KDF = { ops: 1, mem: 8 * 1024 * 1024 };

async function waitFor<T>(fn: () => T | undefined | null | false | Promise<T | undefined | null | false>, ms = 10_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe.skipIf(!DB_URL)('end-to-end through the relay', () => {
  let app: FastifyInstance;
  let db: Db;
  let base: string;
  const engines: Messenger[] = [];

  async function boot(state: VaultState): Promise<Messenger> {
    const vault = await Vault.create(new MemoryVaultStorage(), 'test passphrase', state, FAST_KDF);
    const m = new Messenger({ api: new Api(base), wsBase: base.replace('http', 'ws'), vault, state });
    engines.push(m);
    m.start();
    await waitFor(() => m.status === 'online');
    return m;
  }

  const lastText = (m: Messenger, convId: string) => m.state.conversations[convId]?.filter((x) => x.kind !== 'system').at(-1);

  beforeAll(async () => {
    db = createPool(DB_URL!);
    await db.query('DROP TABLE IF EXISTS used_challenges, recovery_backups, blobs, mailbox, one_time_prekeys, accounts CASCADE');
    await migrate(db);
    app = await buildApp({ config: { host: '127.0.0.1', port: 0, databaseUrl: DB_URL!, allowedOrigins: [], trustProxy: false, sessionSecret: SECRET }, db });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const addr = app.server.address();
    base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  });

  afterAll(async () => {
    for (const e of engines) await e.stop();
    await app?.close();
    await db?.end();
  });

  it('exchanges end-to-end encrypted messages without the server learning the sender', async () => {
    const api = new Api(base);
    const alice = await boot(await createAccount(api, 'Alice'));
    const bob = await boot(await createAccount(api, 'Bob'));

    // Bob goes offline so the message has to be stored by the relay.
    await bob.stop();
    const conv = await alice.addContact(bob.me, 'Bob');
    await alice.sendText(conv, 'hello bob, this is secret');

    const rows = await db.query('SELECT * FROM mailbox');
    expect(rows.rows).toHaveLength(1);
    const row = rows.rows[0];
    expect(Object.keys(row).sort()).toEqual(['envelope', 'expires_at', 'recipient_id', 'seq']);
    expect(row.recipient_id).toBe(bob.me);
    const raw = Buffer.from(row.envelope).toString('latin1');
    expect(raw).not.toContain('hello bob');
    expect(raw).not.toContain(alice.me);

    bob.start();
    const got = await waitFor(() => lastText(bob, convIdForContact(alice.me)));
    expect(got.text).toBe('hello bob, this is secret');
    expect(got.from).toBe(alice.me);
    expect(bob.state.contacts[alice.me]?.request).toBe(true);
    expect(bob.state.contacts[alice.me]?.nickname).toBe('Alice');

    // Delete-on-acknowledge.
    await waitFor(async () => (await db.query('SELECT 1 FROM mailbox')).rowCount === 0);

    // Reply over the established session (WhisperMessage, not PreKey).
    bob.acceptRequest(alice.me);
    await bob.sendText(convIdForContact(alice.me), 'hi alice');
    expect((await waitFor(() => lastText(alice, conv)?.from === bob.me && lastText(alice, conv))).text).toBe('hi alice');

    // Safety numbers match on both sides.
    expect(await alice.safetyNumber(bob.me)).toBe(await bob.safetyNumber(alice.me));
    expect((await alice.safetyNumber(bob.me))!.replace(/ /g, '')).toMatch(/^\d{60}$/);
  });

  it('encrypts files client-side and supports groups via pairwise fan-out', async () => {
    const api = new Api(base);
    const [a, b, c] = await Promise.all([createAccount(api, 'A'), createAccount(api, 'B'), createAccount(api, 'C')]);
    const ma = await boot(a);
    const mb = await boot(b);
    const mc = await boot(c);

    const gconv = await ma.createGroup('Friends', [mb.me, mc.me]);
    const gid = gconv.slice(2);
    await waitFor(() => mb.state.groups[gid] && mc.state.groups[gid]);
    expect(mc.state.groups[gid]!.members.sort()).toEqual([ma.me, mb.me, mc.me].sort());
    // Nicknames announced inside encrypted messages are shown for non-contacts.
    expect(mc.displayName(ma.me)).toBe('A');

    await mb.sendText(convIdForGroup(gid), 'hello group');
    await waitFor(() => lastText(ma, gconv)?.text === 'hello group');
    await waitFor(() => lastText(mc, gconv)?.text === 'hello group');

    const data = new TextEncoder().encode('top secret file contents');
    await ma.sendFile(gconv, { name: 'secret.txt', mime: 'text/plain', data });
    const fileMsg = await waitFor(() => lastText(mc, gconv)?.kind === 'file' && lastText(mc, gconv));
    const blob = await db.query('SELECT data FROM blobs');
    expect(Buffer.from(blob.rows[0].data).toString('latin1')).not.toContain('top secret');
    expect(await mc.downloadFile(fileMsg.file!)).toEqual(data);

    // The server holds no trace of the group.
    const tables = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`);
    expect(tables.rows.map((r) => r.table_name)).toEqual(['accounts', 'blobs', 'mailbox', 'one_time_prekeys', 'recovery_backups', 'used_challenges']);

    await mc.leaveGroup(gid);
    await waitFor(() => !ma.state.groups[gid]!.members.includes(mc.me));
  });

  it('rejects a changed identity key until the user approves it', async () => {
    const api = new Api(base);
    const alice = await boot(await createAccount(api, 'Alice2'));
    const bobState = await createAccount(api, 'Bob2');
    const bob = await boot(bobState);
    const conv = await alice.addContact(bob.me);
    await alice.sendText(conv, 'one');
    await waitFor(() => lastText(bob, convIdForContact(alice.me)));

    // Simulate a malicious key swap in the directory.
    const mallory = await createAccount(api, 'Mallory');
    await db.query(
      `UPDATE accounts SET identity_key = m.identity_key, sealing_public_key = m.sealing_public_key,
         sealing_key_signature = m.sealing_key_signature
       FROM accounts m WHERE accounts.id = $1 AND m.id = $2`,
      [bob.me, mallory.account.id],
    );
    delete alice.state.signal.identities[bob.me]!.sealingKey;
    alice.store.deleteSessionsFor(bob.me);
    await alice.sendText(conv, 'two');
    expect(alice.state.signal.identities[bob.me]!.pendingKey).toBeDefined();
    expect(lastText(alice, conv)?.failed).toBe(true);
    expect(alice.state.conversations[conv]!.some((m) => m.kind === 'system' && m.text!.includes('safety number'))).toBe(true);
  });

  it('restores an account from the recovery key and deletes it completely', async () => {
    const api = new Api(base);
    const alice = await boot(await createAccount(api, 'Restorable'));
    const bob = await boot(await createAccount(api, 'Peer'));
    await alice.addContact(bob.me, 'Peer');
    const key = await alice.enableRecovery();
    const backup = await db.query('SELECT blob FROM recovery_backups');
    expect(Buffer.from(backup.rows[0].blob).toString('latin1')).not.toContain('Restorable');
    await alice.stop();

    const restored = await restoreAccount(api, key);
    expect(restored.account.id).toBe(alice.me);
    expect(restored.contacts[bob.me]?.alias).toBe('Peer');
    const alice2 = await boot(restored);
    await alice2.sendText(convIdForContact(bob.me), 'back again');
    await waitFor(() => lastText(bob, convIdForContact(alice2.me))?.text === 'back again');

    await alice2.deleteAccount();
    for (const t of ['accounts', 'one_time_prekeys', 'recovery_backups']) {
      const col = t === 'accounts' ? 'id' : 'account_id';
      expect((await db.query(`SELECT 1 FROM ${t} WHERE ${col} = $1`, [alice2.me])).rowCount).toBe(0);
    }
  });
});
