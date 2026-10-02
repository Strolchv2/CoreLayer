import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TTL_OPTIONS } from '@corelayer/protocol';
import type { Messenger } from '../core/engine';
import { eraseLocalData } from './session';
import { errorMessage } from './util';

export function Settings({ messenger }: { messenger: Messenger }) {
  const s = messenger.state;
  const [nickname, setNickname] = useState(s.account.nickname);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel settings">
      <h2>Settings</h2>
      {error && <p className="error">{error}</p>}

      <h3>Profile</h3>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          messenger.setNickname(nickname);
        }}
      >
        <input value={nickname} maxLength={40} placeholder="Nickname (optional)" onChange={(e) => setNickname(e.target.value)} />
        <button>Save</button>
      </form>
      <p className="fine">Sent only to people you message, inside encrypted messages. The server never sees it.</p>

      <h3>Disappearing messages</h3>
      <label>
        Default lifetime for new conversations
        <select value={s.settings.defaultTtl} onChange={(e) => messenger.setDefaultTtl(Number(e.target.value))}>
          {TTL_OPTIONS.map((o) => (
            <option key={o.seconds} value={o.seconds}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <p className="fine">
        Messages are removed from this app and from the server after their lifetime. Screenshots, device backups or a
        modified app on the other side are outside our control.
      </p>

      <h3>Recovery key</h3>
      {recoveryKey ? (
        <div className="danger-box">
          <p>
            <strong>Write this down and keep it offline.</strong> It is shown only once. Anyone who has it can take over
            your account. If you lose it, your account cannot be recovered — there is no reset.
          </p>
          <code className="recovery">{recoveryKey}</code>
          <button onClick={() => setRecoveryKey(null)}>I have stored it safely</button>
        </div>
      ) : s.recovery ? (
        <>
          <p className="fine">
            An encrypted backup of your identity, contacts and groups (no messages) is stored on the server. Only your
            recovery key can decrypt it.
          </p>
          <div className="row">
            <button disabled={busy} onClick={() => run(async () => setRecoveryKey(await messenger.enableRecovery()))}>
              Create new recovery key
            </button>
            <button className="ghost" disabled={busy} onClick={() => run(() => messenger.disableRecovery())}>
              Delete backup
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="fine">
            Without a recovery key, losing this device or its passphrase means losing your account. The key is generated on
            this device and never sent to the server.
          </p>
          <button disabled={busy} onClick={() => run(async () => setRecoveryKey(await messenger.enableRecovery()))}>
            Create recovery key
          </button>
        </>
      )}

      <h3>What this app does not do</h3>
      <ul className="facts">
        <li>No online status or "last seen".</li>
        <li>No read receipts and no typing indicators.</li>
        <li>No location, no contact upload, no link previews.</li>
        <li>No analytics, no ads, no cookies.</li>
      </ul>
      <p className="fine">
        These features create metadata about you. If any is ever offered, it will be off by default and explained first.
        See <Link to="/privacy">Privacy</Link>.
      </p>

      <h3>Delete account</h3>
      <p className="fine">
        Removes your account, public keys, pending messages and recovery backup from the server immediately, and erases
        this device's data. This cannot be undone.
      </p>
      <div className="inline-form">
        <input value={confirmDelete} placeholder='Type "DELETE"' onChange={(e) => setConfirmDelete(e.target.value)} />
        <button
          className="danger"
          disabled={busy || confirmDelete !== 'DELETE'}
          onClick={() =>
            run(async () => {
              await messenger.deleteAccount();
              await eraseLocalData();
            })
          }
        >
          Delete account
        </button>
      </div>

      <p className="fine links">
        <Link to="/security">Security</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/cryptography">Cryptography</Link> ·{' '}
        <Link to="/architecture">Architecture</Link> · <Link to="/transparency">Transparency</Link>
      </p>
    </section>
  );
}
