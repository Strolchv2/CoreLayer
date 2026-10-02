import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createAccount, restoreAccount } from '../core/engine';
import { MIN_PASSPHRASE_LENGTH, Vault } from '../core/vault';
import { InfoNav } from './InfoPage';
import { api, eraseLocalData, openSession, storage } from './session';
import { errorMessage } from './util';

type Mode = 'unlock' | 'welcome' | 'create' | 'restore';

export function Onboarding({ hasVault }: { hasVault: boolean }) {
  const [mode, setMode] = useState<Mode>(hasVault ? 'unlock' : 'welcome');
  return (
    <div className="onboarding">
      <div className="card">
        <div className="brand big">
          <span className="brand-mark" aria-hidden /> CoreLayer
        </div>
        {mode === 'unlock' && <Unlock onReset={() => setMode('welcome')} />}
        {mode === 'welcome' && <Welcome onCreate={() => setMode('create')} onRestore={() => setMode('restore')} />}
        {mode === 'create' && <Create onBack={() => setMode('welcome')} />}
        {mode === 'restore' && <Restore onBack={() => setMode('welcome')} />}
      </div>
      <InfoNav />
    </div>
  );
}

function Welcome({ onCreate, onRestore }: { onCreate: () => void; onRestore: () => void }) {
  return (
    <>
      <p className="lead">Anonymous, end-to-end encrypted chat.</p>
      <ul className="facts">
        <li>No phone number, e-mail or name — your account is a key on this device.</li>
        <li>Messages and files are encrypted before they leave your device.</li>
        <li>No tracking, no ads, no online status, no read receipts.</li>
        <li>Every message disappears after a lifetime you choose.</li>
      </ul>
      <button className="primary" onClick={onCreate}>
        Create anonymous account
      </button>
      <button className="ghost" onClick={onRestore}>
        Restore with recovery key
      </button>
      <p className="fine">
        Experimental software, not yet independently audited. Read <Link to="/security">Security</Link> and{' '}
        <Link to="/transparency">Transparency</Link> before relying on it.
      </p>
    </>
  );
}

function PassphraseFields({ value, onChange }: { value: [string, string]; onChange: (v: [string, string]) => void }) {
  return (
    <>
      <label>
        Device passphrase
        <input type="password" autoComplete="new-password" value={value[0]} onChange={(e) => onChange([e.target.value, value[1]])} />
      </label>
      <label>
        Repeat passphrase
        <input type="password" autoComplete="new-password" value={value[1]} onChange={(e) => onChange([value[0], e.target.value])} />
      </label>
      <p className="fine">
        Encrypts everything stored on this device (Argon2id). It is never sent anywhere and cannot be reset.
      </p>
    </>
  );
}

function checkPassphrase([a, b]: [string, string]): string | null {
  if (a.length < MIN_PASSPHRASE_LENGTH) return `Use at least ${MIN_PASSPHRASE_LENGTH} characters.`;
  if (a !== b) return 'The passphrases do not match.';
  return null;
}

function Create({ onBack }: { onBack: () => void }) {
  const [nickname, setNickname] = useState('');
  const [pass, setPass] = useState<[string, string]>(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = checkPassphrase(pass);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const state = await createAccount(api, nickname);
      const vault = await Vault.create(storage, pass[0], state);
      openSession(vault, state);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h2>New anonymous account</h2>
      <label>
        Nickname <span className="muted">(optional, only your contacts see it)</span>
        <input value={nickname} maxLength={40} placeholder="e.g. ShadowFox" onChange={(e) => setNickname(e.target.value)} />
      </label>
      <PassphraseFields value={pass} onChange={setPass} />
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>
        {busy ? 'Generating keys…' : 'Create account'}
      </button>
      <button type="button" className="ghost" onClick={onBack} disabled={busy}>
        Back
      </button>
    </form>
  );
}

function Restore({ onBack }: { onBack: () => void }) {
  const [key, setKey] = useState('');
  const [pass, setPass] = useState<[string, string]>(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = checkPassphrase(pass);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const state = await restoreAccount(api, key);
      const vault = await Vault.create(storage, pass[0], state);
      openSession(vault, state);
    } catch (err) {
      setError(err instanceof Error && err.message === 'not found' ? 'No backup exists for this recovery key.' : errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h2>Restore account</h2>
      <label>
        Recovery key
        <textarea rows={3} value={key} spellCheck={false} autoComplete="off" onChange={(e) => setKey(e.target.value)} />
      </label>
      <PassphraseFields value={pass} onChange={setPass} />
      <p className="fine">Your identity, contacts and groups are restored. Old messages are not part of the backup.</p>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>
        {busy ? 'Restoring…' : 'Restore'}
      </button>
      <button type="button" className="ghost" onClick={onBack} disabled={busy}>
        Back
      </button>
    </form>
  );
}

function Unlock({ onReset }: { onReset: () => void }) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { vault, state } = await Vault.unlock(storage, pass);
      openSession(vault, state);
    } catch (err) {
      setError(errorMessage(err) === 'wrong passphrase' ? 'Wrong passphrase.' : errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h2>Unlock</h2>
      <label>
        Device passphrase
        <input type="password" autoFocus autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>
        {busy ? 'Unlocking…' : 'Unlock'}
      </button>
      {!confirmErase ? (
        <button type="button" className="ghost" onClick={() => setConfirmErase(true)}>
          Forgot passphrase?
        </button>
      ) : (
        <div className="danger-box">
          <p>
            The passphrase cannot be recovered. You can erase this device and restore your account with your
            recovery key, if you created one. Without it, the account is lost.
          </p>
          <button
            type="button"
            className="danger"
            onClick={async () => {
              await eraseLocalData();
              onReset();
            }}
          >
            Erase local data
          </button>
        </div>
      )}
    </form>
  );
}
