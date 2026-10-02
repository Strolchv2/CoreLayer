import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MAX_FILE_BYTES, MAX_TEXT_LENGTH, TTL_OPTIONS, normalizeAccountId, type FileRef } from '@corelayer/protocol';
import type { Messenger } from '../core/engine';
import type { ChatMessage } from '../core/state';
import { titleOf } from './ChatScreen';
import { INLINE_IMAGE_TYPES, errorMessage, formatBytes, remaining, ttlLabel } from './util';

export function Conversation({ messenger, convId }: { messenger: Messenger; convId: string }) {
  const isGroup = convId.startsWith('g:');
  const peerId = isGroup ? null : convId.slice(2);
  const group = isGroup ? messenger.state.groups[convId.slice(2)] : undefined;
  const contact = peerId ? messenger.state.contacts[peerId] : undefined;
  const ttl = group?.ttl ?? contact?.ttl ?? messenger.state.settings.defaultTtl;
  const messages = messenger.state.conversations[convId] ?? [];
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();
  const listRef = useRef<HTMLDivElement>(null);

  // Members whose safety number changed block sending until approved.
  const changed = (group ? group.members : peerId ? [peerId] : []).filter(
    (m) => m !== messenger.me && messenger.state.signal.identities[m]?.pendingKey,
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const run = (p: Promise<unknown>) => {
    setError(null);
    p.catch((e) => setError(errorMessage(e)));
  };

  return (
    <section className="conversation">
      <header className="conv-head">
        <div>
          <h2>{titleOf(messenger, convId)}</h2>
          <div className="muted small">
            {group ? `${group.members.length} members` : <code>{peerId}</code>}
            {!group && peerId && messenger.state.signal.identities[peerId]?.verified && <span className="tag ok">verified</span>}
          </div>
        </div>
        <div className="conv-tools">
          <label className="ttl" title="Every message in this conversation disappears after this time">
            ⏱
            <select value={ttl} onChange={(e) => run(messenger.setConversationTtl(convId, Number(e.target.value)))}>
              {TTL_OPTIONS.map((o) => (
                <option key={o.seconds} value={o.seconds}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button className="ghost" onClick={() => setShowInfo((v) => !v)}>
            {showInfo ? 'Close' : isGroup ? 'Members' : 'Safety number'}
          </button>
        </div>
      </header>

      {contact?.request && (
        <div className="banner">
          <span>
            Message request from an ID you have not added. Nothing is sent back unless you reply.
          </span>
          <button onClick={() => messenger.acceptRequest(contact.id)}>Accept</button>
          <button className="ghost" onClick={() => messenger.deleteConversation(convId)}>
            Delete
          </button>
        </div>
      )}

      {changed.map((m) => (
        <IdentityChanged key={m} messenger={messenger} accountId={m} />
      ))}

      {showInfo && (isGroup && group ? <GroupInfo messenger={messenger} groupId={group.id} /> : peerId && <SafetyNumber messenger={messenger} accountId={peerId} />)}

      <div className="messages" ref={listRef}>
        <p className="muted small center-text">
          End-to-end encrypted. Messages disappear after {ttlLabel(ttl)}.
        </p>
        {messages.map((m) => (
          <Message key={m.id} messenger={messenger} msg={m} isGroup={isGroup} now={now} />
        ))}
      </div>

      {error && <p className="error pad">{error}</p>}
      {group && group.members.length === 0 ? (
        <p className="muted pad">You are no longer a member of this group.</p>
      ) : (
        <Composer messenger={messenger} convId={convId} disabled={changed.length > 0} onError={setError} />
      )}
    </section>
  );
}

function Message({ messenger, msg, isGroup, now }: { messenger: Messenger; msg: ChatMessage; isGroup: boolean; now: number }) {
  if (msg.kind === 'system') return <div className="system-msg">{msg.text}</div>;
  const mine = msg.from === 'me';
  return (
    <div className={`msg ${mine ? 'mine' : 'theirs'} ${msg.failed ? 'failed' : ''}`}>
      {isGroup && !mine && <div className="author">{messenger.displayName(msg.from)}</div>}
      {msg.kind === 'text' && <div className="text">{msg.text}</div>}
      {msg.kind === 'file' && msg.file && <FileView messenger={messenger} file={msg.file} />}
      <div className="meta">
        {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · disappears in{' '}
        {remaining(msg.expiresAt - now)}
        {msg.failed && ' · not delivered'}
      </div>
    </div>
  );
}

function FileView({ messenger, file }: { messenger: Messenger; file: FileRef }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inline = INLINE_IMAGE_TYPES.includes(file.mime);

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await messenger.downloadFile(file);
      // Non-image files are always handed out as opaque downloads so that
      // e.g. an HTML file can never be rendered inside this origin.
      const blob = new Blob([data as BlobPart], { type: inline ? file.mime : 'application/octet-stream' });
      setUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(errorMessage(e) === 'not found' ? 'This file has expired.' : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="file">
      <div>
        📎 <strong>{file.name || 'file'}</strong> <span className="muted small">{formatBytes(file.size)}</span>
      </div>
      {!url && (
        <button className="small" onClick={load} disabled={busy}>
          {busy ? 'Decrypting…' : 'Download & decrypt'}
        </button>
      )}
      {url && inline && <img src={url} alt={file.name} />}
      {url && (
        <a href={url} download={file.name || 'file'} className="small">
          Save file
        </a>
      )}
      {error && <div className="error small">{error}</div>}
    </div>
  );
}

function Composer({ messenger, convId, disabled, onError }: { messenger: Messenger; convId: string; disabled: boolean; onError: (e: string | null) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    onError(null);
    const t = text;
    setText('');
    try {
      await messenger.sendText(convId, t);
    } catch (err) {
      onError(errorMessage(err));
      setText(t);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const sendFile = async (f: File) => {
    if (f.size > MAX_FILE_BYTES) return onError('Files can be at most 10 MB.');
    setBusy(true);
    onError(null);
    try {
      await messenger.sendFile(convId, { name: f.name, mime: f.type || 'application/octet-stream', data: new Uint8Array(await f.arrayBuffer()) });
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <form className="composer" onSubmit={send}>
      <button type="button" className="ghost icon" title="Send an encrypted file (max. 10 MB)" disabled={disabled || busy} onClick={() => fileRef.current?.click()}>
        📎
      </button>
      <input ref={fileRef} type="file" hidden onChange={(e) => e.target.files?.[0] && void sendFile(e.target.files[0])} />
      <textarea
        rows={1}
        value={text}
        maxLength={MAX_TEXT_LENGTH}
        placeholder={disabled ? 'Verify the changed safety number first' : 'Encrypted message'}
        disabled={disabled}
        onKeyDown={onKey}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="primary" disabled={disabled || busy || !text.trim()}>
        Send
      </button>
    </form>
  );
}

function SafetyNumber({ messenger, accountId }: { messenger: Messenger; accountId: string }) {
  const [number, setNumber] = useState<string | null>(null);
  const rec = messenger.state.signal.identities[accountId];
  useEffect(() => {
    void messenger.safetyNumber(accountId).then(setNumber);
  }, [messenger, accountId, rec?.key, rec?.pendingKey]);
  return (
    <div className="info-box">
      <h3>Safety number</h3>
      <p className="fine">
        Compare these digits with {messenger.displayName(accountId)} in person or over another trusted channel. If they
        match, nobody — including the server — is intercepting your conversation.
      </p>
      <code className="safety">{number ?? 'No keys exchanged yet.'}</code>
      {rec && !rec.pendingKey && (
        <label className="check">
          <input type="checkbox" checked={rec.verified} onChange={(e) => messenger.setVerified(accountId, e.target.checked)} />
          I have verified this safety number
        </label>
      )}
      <ContactAlias messenger={messenger} accountId={accountId} />
    </div>
  );
}

function ContactAlias({ messenger, accountId }: { messenger: Messenger; accountId: string }) {
  const c = messenger.state.contacts[accountId];
  const [alias, setAlias] = useState(c?.alias ?? '');
  if (!c) return null;
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        messenger.renameContact(accountId, alias);
      }}
    >
      <input value={alias} maxLength={40} placeholder={c.nickname ?? 'Local name'} onChange={(e) => setAlias(e.target.value)} />
      <button>Rename</button>
      <button type="button" className="danger ghost" onClick={() => messenger.deleteConversation(`u:${accountId}`)}>
        Delete chat
      </button>
    </form>
  );
}

function IdentityChanged({ messenger, accountId }: { messenger: Messenger; accountId: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="banner danger-banner">
      <span>
        The safety number of <strong>{messenger.displayName(accountId)}</strong> changed. This happens when they reinstall
        — or when someone intercepts the conversation. Messages are blocked until you decide.
      </span>
      <button className="ghost" onClick={() => setShow((v) => !v)}>
        {show ? 'Hide' : 'Show new number'}
      </button>
      <button className="danger" onClick={() => messenger.approveIdentityChange(accountId)}>
        Accept new key
      </button>
      {show && <SafetyNumber messenger={messenger} accountId={accountId} />}
    </div>
  );
}

function GroupInfo({ messenger, groupId }: { messenger: Messenger; groupId: string }) {
  const g = messenger.state.groups[groupId];
  const [add, setAdd] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!g) return null;
  return (
    <div className="info-box">
      <h3>Members</h3>
      <ul className="members">
        {g.members.map((m) => (
          <li key={m}>
            {messenger.displayName(m)} <code className="muted">{m}</code>
            {messenger.state.signal.identities[m]?.verified && <span className="tag ok">verified</span>}
          </li>
        ))}
      </ul>
      <form
        className="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const id = normalizeAccountId(add);
          if (!id) return setError('Invalid ID');
          try {
            await messenger.addGroupMembers(groupId, [id]);
            setAdd('');
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <input value={add} placeholder="Add member by ID" spellCheck={false} onChange={(e) => setAdd(e.target.value)} />
        <button>Add</button>
        <button type="button" className="danger ghost" onClick={() => void messenger.leaveGroup(groupId)}>
          Leave group
        </button>
      </form>
      {error && <p className="error small">{error}</p>}
      <p className="fine">Membership is known only to members' devices. The server does not know this group exists.</p>
    </div>
  );
}

/** Ticks every second so expiry countdowns stay current. */
function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}
