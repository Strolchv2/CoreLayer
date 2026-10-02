# Architecture

## Overview

```text
 DEVICE A                                                   DEVICE B
 ┌──────────────────────┐                                   ┌──────────────────────┐
 │ plaintext            │                                   │ plaintext            │
 │   │ Signal (Double   │                                   │   ▲ Signal decrypt   │
 │   ▼ Ratchet)         │                                   │   │                  │
 │ ciphertext + my ID   │                                   │ ciphertext + A's ID  │
 │   │ pad + sealed box │                                   │   ▲ open sealed box  │
 │   ▼ (to B's key)     │                                   │   │                  │
 │ envelope             │                                   │ envelope             │
 └────┬─────────────────┘                                   └──────────▲───────────┘
      │ HTTPS POST /messages (no login)          WebSocket (B logged in)│
      ▼                                                                 │
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  RELAY NODES (stateless, any number)                                       │
 │   knows: recipient = B, envelope size bucket, expiry                       │
 │   does not know: sender, content, groups, contacts                         │
 │                    ┌──────────────────────────┐                            │
 │                    │ PostgreSQL               │                            │
 │                    │ mailbox(recipient,       │◀─ NOTIFY recipient-id ─▶   │
 │                    │   ciphertext, expiry)    │   wakes the node holding   │
 │                    └──────────────────────────┘   B's connection           │
 └────────────────────────────────────────────────────────────────────────────┘
```

The server is a **relay**: it stores ciphertext until the recipient picks it
up and deletes it on acknowledgement. It never needs to know what a message
says, who sent it, or what it means.

## Components

| Component | Technology | Role |
|---|---|---|
| Client | React + TypeScript (Vite) | All cryptography, all user data, contacts, groups, message history |
| Relay | Node.js + TypeScript (Fastify, WebSocket) | Key directory, mailbox, blob store, recovery blob store |
| Database | PostgreSQL | The 6 tables listed below |
| Reverse proxy | Nginx | TLS, HSTS, CSP and other headers, static files, **no access log** |
| Deployment | Docker Compose | Reproducible, self-hostable stack |

All source code is published: client, relay, protocol definitions,
database schema, Docker and Nginx configuration.

## Data flows

### Account creation

1. The device generates: Ed25519 auth key, X25519 sealing key, Signal
   identity key, signed prekey, 100 one-time prekeys.
2. It requests a challenge, signs it, and uploads **only the public keys**.
3. The server derives the Anonymous ID from the auth key and stores the
   public keys. Nothing else is asked or stored.

### Sending a message

1. If there is no session yet, the device fetches the recipient's prekey
   bundle (an **anonymous** request), checks the signatures and pins the
   identity key.
2. Signal-encrypts the message, wraps it with the sender ID in a padded
   sealed box for the recipient, and POSTs it **without credentials**.
3. The relay stores `(recipient, ciphertext, expiry)` and sends a database
   notification carrying only the recipient ID, so whichever node holds the
   recipient's connection can push it.

### Receiving

1. The device logs in (challenge-response), opens a WebSocket and
   authenticates with a short-lived token.
2. Pending envelopes are pushed. The device decrypts, saves its new
   ratchet state to the encrypted vault, then acknowledges.
3. The relay deletes acknowledged envelopes immediately.

### Groups

There is no group object on the server. A group message is sent as one
individual message per member. Every group message carries the member list
inside the encryption, so members stay in sync.

### Attachments

The device encrypts the file with a fresh key, uploads the padded ciphertext
anonymously, and sends the blob ID and key inside an encrypted message.

## Database schema (complete)

```text
accounts          id, auth_public_key, sealing_public_key, sealing_key_signature,
                  identity_key, registration_id, signed_prekey_id, signed_prekey,
                  signed_prekey_signature, retain_until (month granularity)
one_time_prekeys  account_id, key_id, public_key
mailbox           seq, recipient_id, envelope, expires_at
blobs             id, data, expires_at
recovery_backups  id, account_id, blob
used_challenges   tag, expires_at   (replay protection, at most 60 seconds)
```

No column holds an IP address, a timestamp of an action, a sender, a
contact, a group, or plaintext.

## Global infrastructure

Relay nodes are stateless: login challenges and sessions are signed
tokens (only redeemed challenge tags are remembered, for 60 seconds, to
block replays), delivery notifications go through PostgreSQL
`LISTEN/NOTIFY`. Any number of nodes can
run behind a load balancer, in any region, against one database. The
reference Docker Compose file runs two relay nodes.

The infrastructure is designed so that no node collects central
information about users: no logs, no analytics, no external services.

Planned: an onion-service (Tor) address for every deployment, and
federation between independently operated relays.

## Development order

The project was built in this order, so that encryption is the foundation
and not an add-on: threat model → privacy architecture → cryptographic
architecture → key management → anonymous authentication → encrypted
messaging → encrypted groups → encrypted files → metadata minimisation →
security hardening → audit preparation → UI → deployment.
