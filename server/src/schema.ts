/**
 * The complete database schema. Read it as a privacy statement: these are the
 * only things the server persists.
 *
 * Deliberately absent: IP addresses, user agents, e-mail, phone numbers,
 * names, creation timestamps, last-seen timestamps, contact lists, group
 * memberships, message senders, message plaintext, read state.
 */
export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS accounts (
  -- Anonymous id, derived from auth_public_key. Contains no personal data.
  id                      text PRIMARY KEY,
  auth_public_key         bytea NOT NULL UNIQUE,   -- Ed25519, for challenge-response login
  sealing_public_key      bytea NOT NULL,          -- X25519, for sealed-sender envelopes
  sealing_key_signature   bytea NOT NULL,          -- identity-key signature over it
  identity_key            bytea NOT NULL,          -- Signal identity public key
  registration_id         integer NOT NULL,
  signed_prekey_id        integer NOT NULL,
  signed_prekey           bytea NOT NULL,
  signed_prekey_signature bytea NOT NULL,
  -- Coarse (month granularity) inactivity expiry. Accounts that do not log in
  -- for ~6 months are deleted automatically. No exact timestamps are kept.
  retain_until            date NOT NULL
);

CREATE TABLE IF NOT EXISTS one_time_prekeys (
  account_id text    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  key_id     integer NOT NULL,
  public_key bytea   NOT NULL,
  PRIMARY KEY (account_id, key_id)
);

-- Store-and-forward queue. Rows are deleted as soon as the recipient
-- acknowledges them, or when they expire (at most 7 days). There is no sender
-- column: the sender is only named inside the sealed, encrypted envelope.
CREATE TABLE IF NOT EXISTS mailbox (
  seq          bigserial   PRIMARY KEY,
  recipient_id text        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  envelope     bytea       NOT NULL,                -- padded ciphertext
  expires_at   timestamptz NOT NULL                 -- rounded up to the minute
);
CREATE INDEX IF NOT EXISTS mailbox_recipient_idx ON mailbox (recipient_id, seq);
CREATE INDEX IF NOT EXISTS mailbox_expires_idx ON mailbox (expires_at);

-- Encrypted attachments. Not linked to any account: the server does not know
-- who uploaded a blob or who downloads it. Ids are random 128-bit capabilities.
CREATE TABLE IF NOT EXISTS blobs (
  id         text        PRIMARY KEY,
  data       bytea       NOT NULL,                  -- padded ciphertext
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS blobs_expires_idx ON blobs (expires_at);

-- Optional encrypted account backup, addressed by a value derived from the
-- user's recovery key. The server never sees the recovery key.
CREATE TABLE IF NOT EXISTS recovery_backups (
  id         text  PRIMARY KEY,
  account_id text  NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  blob       bytea NOT NULL
);
`;
