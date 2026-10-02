import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { normalizeAccountId } from '@corelayer/protocol';
import type { Messenger } from '../core/engine';
import type { ChatMessage } from '../core/state';
import { Conversation } from './Conversation';
import { Settings } from './Settings';
import { lockSession } from './session';
import { errorMessage } from './util';

const AUTO_LOCK_MS = 15 * 60 * 1000;

type Panel = { kind: 'conv'; id: string } | { kind: 'new-chat' } | { kind: 'new-group' } | { kind: 'settings' } | { kind: 'none' };

export function ChatScreen({ messenger }: { messenger: Messenger }) {
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  useAutoLock();
  const s = messenger.state;

  // The engine mutates its state in place and re-renders us on every change,
  // so this is simply recomputed on each render.
  const conversations = (() => {
    const ids = new Set([...Object.keys(s.contacts).map((c) => `u:${c}`), ...Object.keys(s.groups).map((g) => `g:${g}`)]);
    return [...ids]
      .map((id) => {
        const msgs = s.conversations[id] ?? [];
        const last: ChatMessage | undefined = msgs[msgs.length - 1];
        return { id, last, title: titleOf(messenger, id), request: id.startsWith('u:') && !!s.contacts[id.slice(2)]?.request };
      })
      .sort((a, b) => (b.last?.sentAt ?? 0) - (a.last?.sentAt ?? 0));
  })();

  const active = panel.kind === 'conv' ? panel.id : null;
  const activeExists = active && (active.startsWith('u:') ? s.contacts[active.slice(2)] : s.groups[active.slice(2)]);

  return (
    <div className={`chat ${panel.kind !== 'none' ? 'has-panel' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-mark" aria-hidden /> CoreLayer
          </div>
          <span className={`conn conn-${messenger.status}`} title="Your connection to the relay (not visible to anyone else)">
            {messenger.status}
          </span>
        </div>
        <MyId id={messenger.me} />
        <div className="sidebar-actions">
          <button onClick={() => setPanel({ kind: 'new-chat' })}>New chat</button>
          <button onClick={() => setPanel({ kind: 'new-group' })}>New group</button>
        </div>
        <ul className="conv-list">
          {conversations.length === 0 && <li className="muted empty">No conversations yet. Share your ID or add a contact by ID.</li>}
          {conversations.map((c) => (
            <li key={c.id}>
              <button className={active === c.id ? 'active' : ''} onClick={() => setPanel({ kind: 'conv', id: c.id })}>
                <span className="conv-title">
                  {c.id.startsWith('g:') && <span className="tag">group</span>}
                  {c.request && <span className="tag warn">request</span>}
                  {c.title}
                </span>
                <span className="conv-last">{c.last ? preview(c.last) : ' '}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="sidebar-foot">
          <button className="ghost" onClick={() => setPanel({ kind: 'settings' })}>
            Settings
          </button>
          <button className="ghost" onClick={() => void lockSession()}>
            Lock
          </button>
          <Link to="/security" className="ghost-link">
            Security
          </Link>
        </div>
      </aside>
      <main className="main">
        {panel.kind !== 'none' && (
          <button className="back-mobile ghost" onClick={() => setPanel({ kind: 'none' })}>
            ← Back
          </button>
        )}
        {panel.kind === 'conv' && activeExists && <Conversation key={panel.id} messenger={messenger} convId={panel.id} />}
        {panel.kind === 'conv' && !activeExists && <div className="center muted">This conversation no longer exists.</div>}
        {panel.kind === 'new-chat' && <NewChat messenger={messenger} onOpen={(id) => setPanel({ kind: 'conv', id })} />}
        {panel.kind === 'new-group' && <NewGroup messenger={messenger} onOpen={(id) => setPanel({ kind: 'conv', id })} />}
        {panel.kind === 'settings' && <Settings messenger={messenger} />}
        {panel.kind === 'none' && (
          <div className="center muted placeholder">
            <p>Select a conversation.</p>
            <p className="fine">Messages are end-to-end encrypted and disappear automatically.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export function titleOf(m: Messenger, convId: string): string {
  if (convId.startsWith('g:')) return m.state.groups[convId.slice(2)]?.name ?? 'Group';
  return m.displayName(convId.slice(2));
}

function preview(m: ChatMessage): string {
  if (m.kind === 'file') return `📎 ${m.file?.name ?? 'file'}`;
  return (m.from === 'me' ? 'You: ' : '') + (m.text ?? '');
}

function MyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="my-id"
      title="Your Anonymous ID. Share it with people you want to talk to."
      onClick={async () => {
        await navigator.clipboard.writeText(id).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <span className="label">Anonymous ID</span>
      <code>{id}</code>
      <span className="muted small">{copied ? 'copied' : 'click to copy'}</span>
    </button>
  );
}

function NewChat({ messenger, onOpen }: { messenger: Messenger; onOpen: (convId: string) => void }) {
  const [id, setId] = useState('');
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const norm = normalizeAccountId(id);
    if (!norm) return setError('An Anonymous ID has 16 characters, e.g. 7F3A-91D2-8C41-0B5E.');
    setBusy(true);
    setError(null);
    try {
      onOpen(await messenger.addContact(norm, alias.trim() || undefined));
    } catch (err) {
      setError(errorMessage(err) === 'not found' ? 'No account with this ID exists.' : errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2>New chat</h2>
      <label>
        Their Anonymous ID
        <input value={id} autoFocus spellCheck={false} placeholder="XXXX-XXXX-XXXX-XXXX" onChange={(e) => setId(e.target.value)} />
      </label>
      <label>
        Name for this contact <span className="muted">(stored only on this device)</span>
        <input value={alias} maxLength={40} onChange={(e) => setAlias(e.target.value)} />
      </label>
      <p className="fine">Your contact list exists only on this device. The server is asked for this ID's public keys, nothing else.</p>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>
        Start chat
      </button>
    </form>
  );
}

function NewGroup({ messenger, onOpen }: { messenger: Messenger; onOpen: (convId: string) => void }) {
  const contacts = Object.values(messenger.state.contacts).filter((c) => !c.request);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ids = new Set(selected);
    for (const raw of extra.split(/[\s,;]+/).filter(Boolean)) {
      const n = normalizeAccountId(raw);
      if (!n) return setError(`Invalid ID: ${raw}`);
      ids.add(n);
    }
    if (ids.size === 0) return setError('Add at least one member.');
    setBusy(true);
    setError(null);
    try {
      onOpen(await messenger.createGroup(name, [...ids]));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2>New group</h2>
      <label>
        Group name <span className="muted">(only members see it)</span>
        <input value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} />
      </label>
      {contacts.length > 0 && (
        <fieldset>
          <legend>Members</legend>
          {contacts.map((c) => (
            <label key={c.id} className="check">
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={(e) => {
                  const n = new Set(selected);
                  if (e.target.checked) n.add(c.id);
                  else n.delete(c.id);
                  setSelected(n);
                }}
              />
              {messenger.displayName(c.id)} <code className="muted">{c.id}</code>
            </label>
          ))}
        </fieldset>
      )}
      <label>
        Other members by ID <span className="muted">(separated by spaces)</span>
        <input value={extra} spellCheck={false} onChange={(e) => setExtra(e.target.value)} />
      </label>
      <p className="fine">
        The server never learns that this group exists. Each message is encrypted separately for every member.
      </p>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={busy}>
        Create group
      </button>
    </form>
  );
}

/** Locks the vault after 15 minutes without interaction. */
function useAutoLock() {
  const last = useRef(Date.now());
  useEffect(() => {
    const touch = () => (last.current = Date.now());
    const events = ['pointerdown', 'keydown'] as const;
    for (const e of events) window.addEventListener(e, touch);
    const t = setInterval(() => {
      if (Date.now() - last.current > AUTO_LOCK_MS) void lockSession();
    }, 10_000);
    return () => {
      for (const e of events) window.removeEventListener(e, touch);
      clearInterval(t);
    };
  }, []);
}
