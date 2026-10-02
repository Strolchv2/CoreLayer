# Threat Model

This document came first in development order and every later design
decision refers back to it. It is meant to be read by auditors and is
updated whenever the protocol changes.

## 1. Assets

| Asset | Where it lives | Protection |
|---|---|---|
| Message content (text, files, file names) | Endpoints only | Signal protocol (X3DH + Double Ratchet), files with per-file keys |
| Who talks to whom (social graph) | Endpoints only (contact list, groups) | No server-side contact list or group table, sealed sender |
| Long-term private keys | Device (encrypted vault) | Never transmitted. Exception: the optional recovery backup, encrypted under a key only the user has |
| Network identity (IP address) | Visible to the network and the relay while connected | Not stored or logged; only an HMAC with a rotating in-memory key is used for rate limiting |
| Account existence | Server (`accounts` table) | Random id, no personal data |
| Local data at rest | Browser IndexedDB | Argon2id + XChaCha20-Poly1305 vault |

## 2. Adversaries

| # | Adversary | Capabilities | In scope? |
|---|---|---|---|
| A1 | Passive network observer (ISP, Wi-Fi operator) | Sees encrypted traffic, timing, sizes, IP addresses | Yes |
| A2 | Active network attacker | Can intercept or modify traffic | Yes (TLS + HSTS, end-to-end encryption) |
| A3 | Honest-but-curious operator | Full read access to database, memory, logs | **Primary design target** |
| A4 | Malicious operator / compromised server | Can modify server code, replay or drop messages, substitute keys | Partially (see §4) |
| A5 | Legal compulsion against the operator | Can force handover of everything the server has | Yes: the server should have nearly nothing |
| A6 | Other users | Can message anyone whose id they know, spam, try enumeration | Yes |
| A7 | Thief with the locked device | Has the encrypted vault | Yes (Argon2id passphrase) |
| A8 | Attacker controlling an unlocked device (malware, forensic access while unlocked) | Everything the user sees | **Out of scope** — no messenger can protect against this |
| A9 | Global passive adversary correlating traffic at many points | Timing correlation across the internet | **Out of scope** for the relay; users who need this must use Tor |

## 3. What each adversary learns

### A3 — honest-but-curious operator (database dump + memory)

Learns:

- that an account with a given random id exists, and its public keys;
- the number of remaining one-time prekeys of an account;
- for each *pending* (not yet delivered) message: recipient id, padded
  ciphertext size bucket, expiry rounded to the minute;
- encrypted attachments (size bucket, expiry), not linked to any account;
- whether an account has a recovery backup (an opaque ciphertext);
- tags of login challenges redeemed in the last 60 seconds (random, not
  linked to accounts);
- in memory and only while connected: which account ids are currently
  connected to the relay node, and the transient network address of each
  request.

Does **not** learn: message content, file names or types, nicknames,
contact lists, group membership or existence, who sent a message (no
sender is stored; the HTTP request that delivers a message is
unauthenticated), read state, typing, online history, IP history.

### A4 — malicious operator

A malicious operator can additionally:

- **Substitute keys in the directory** (person-in-the-middle). Mitigation:
  identity keys are pinned on first use, any change is blocked until the
  user explicitly approves it, and users can compare 60-digit safety
  numbers out of band. The sealing key is signed by the identity key, so it
  cannot be swapped independently.
- **Serve malicious JavaScript** to web clients. This is the fundamental
  limit of every browser-delivered end-to-end encrypted application. See
  §5.
- **Correlate timing in real time**: a sender's unauthenticated `POST
  /messages` followed by a push on the recipient's WebSocket, combined with
  network addresses seen at that moment, can link sender and recipient.
  Mitigation for users: Tor. Planned: random delivery delays and cover
  traffic.
- Drop, delay or replay messages. Replays are rejected by the Double
  Ratchet; drops cannot be prevented.
- Drain one-time prekeys (falls back to signed-prekey-only X3DH, which
  still provides forward secrecy after the first reply).

### A5 — legal compulsion

The operator can only hand over what is listed for A3. There is no
plaintext, no master key, no contact database, no IP log. Logging
can be enabled in the future only by deploying different code — which
is why the source is public and auditable.

### A6 — other users

- **Spam / flooding**: sending is anonymous, so a recipient can receive
  unsolicited messages. Unknown senders are shown as message requests.
  Rate limits apply per anonymised network key. Planned: per-recipient
  delivery tokens and optional proof-of-work.
- **Enumeration**: ids have 64 bits; key lookups are rate limited.
- **Prekey draining**: rate limited.

### A7 — stolen locked device

The vault is encrypted with a key derived by Argon2id (3 passes, 64 MiB).
Strength depends on the passphrase; a minimum length is enforced.

## 4. Trust assumptions

1. The device and browser are not compromised.
2. The cryptographic libraries are correct: libsodium, and the Signal
   protocol implementation `@privacyresearch/libsignal-protocol-typescript`.
   The latter is a community TypeScript port, **not** the audited official
   libsignal. One defect was found during development: its PreKey message
   path does not await an identity-trust check. The client performs that
   check itself before decrypting. Replacing it with official libsignal
   (once usable in browsers) is on the roadmap and must be decided in the
   cryptographic audit.
3. Users verify safety numbers for high-risk conversations.
4. TLS certificates are not mis-issued (HSTS preload recommended).

## 5. Known limitations (stated honestly)

- **Web delivery**: whoever controls the server can ship different code.
  Mitigations: open source, reproducible builds, source maps shipped,
  strict CSP. Planned: signed desktop/mobile builds and build hash
  publication.
- **Network metadata**: the relay sees connection addresses while a
  request is in flight. It stores none, but it cannot avoid seeing them.
  Use Tor or a trusted VPN if your network address itself is sensitive.
- **Recipient routing**: the relay must know a message's recipient to
  deliver it.
- **Group fan-out**: a group message is N individual messages sent in a
  burst; an observer can estimate the group size.
- **Disappearing messages** are removed from the app and the server after
  their lifetime, but screenshots, other apps, backups of the device or a
  modified client of the recipient are outside the platform's control.
- **Single device per account** at the moment.
- **No anonymity guarantee**: the platform minimises identifying data. It
  cannot prevent identification through what users write, through a
  compromised device, or through surveillance outside the platform. The
  project never claims to be "100 % untraceable".

## 6. Review triggers

This document must be updated, and the privacy review
([privacy-review.md](privacy-review.md)) repeated, whenever:

- a field is added to `packages/protocol/src/index.ts`,
- a table or column is added to `server/src/schema.ts`,
- logging, monitoring or a third-party service is introduced,
- a cryptographic library is changed or upgraded.
