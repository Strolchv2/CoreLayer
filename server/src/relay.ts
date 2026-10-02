import type { Db } from './db.js';

/** A connected, authenticated receiver. */
export interface Receiver {
  /** Pushes every pending (not yet sent on this connection) message. */
  flush(): Promise<void>;
  close(code: number, reason: string): void;
}

const CHANNEL = 'corelayer_mailbox';

/**
 * In-memory map of receivers connected to *this* relay node. It is never
 * persisted and never exposed to other users (there is no online status).
 *
 * Several relay nodes can run against the same database. When a message is
 * stored, the accepting node issues a Postgres NOTIFY carrying only the
 * recipient id; every node holding a connection for that recipient then
 * pushes the pending messages. NOTIFY payloads are transient and not stored.
 */
export class Relay {
  private receivers = new Map<string, Set<Receiver>>();
  private listener: { release(): void; query(sql: string): Promise<unknown> } | null = null;

  constructor(private readonly db: Db) {}

  async start(): Promise<void> {
    const client = await this.db.connect();
    client.on('notification', (n) => {
      if (n.channel === CHANNEL && n.payload) this.wake(n.payload);
    });
    await client.query(`LISTEN ${CHANNEL}`);
    this.listener = client;
  }

  async stop(): Promise<void> {
    if (!this.listener) return;
    await this.listener.query(`UNLISTEN ${CHANNEL}`).catch(() => undefined);
    this.listener.release();
    this.listener = null;
  }

  /** Announce a newly stored message to all relay nodes (including this one). */
  async announce(recipientId: string): Promise<void> {
    await this.db.query('SELECT pg_notify($1, $2)', [CHANNEL, recipientId]);
  }

  add(accountId: string, r: Receiver): void {
    let set = this.receivers.get(accountId);
    if (!set) this.receivers.set(accountId, (set = new Set()));
    set.add(r);
  }

  remove(accountId: string, r: Receiver): void {
    const set = this.receivers.get(accountId);
    if (!set) return;
    set.delete(r);
    if (set.size === 0) this.receivers.delete(accountId);
  }

  private wake(accountId: string): void {
    for (const r of this.receivers.get(accountId) ?? []) void r.flush().catch(() => undefined);
  }

  disconnect(accountId: string): void {
    for (const r of this.receivers.get(accountId) ?? []) r.close(4001, 'account deleted');
    this.receivers.delete(accountId);
  }
}
