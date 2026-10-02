# Cryptography

**No custom cryptography.** Every primitive and protocol comes from an
established library: [libsodium](https://doc.libsodium.org/) and an
implementation of the [Signal protocol](https://signal.org/docs/). This page
lists every place cryptography is used.

## Private messages: the Signal protocol

| | |
|---|---|
| Key agreement | X3DH (Extended Triple Diffie-Hellman) over Curve25519 |
| Ongoing encryption | Double Ratchet: a new key for every message |
| Message encryption | Signal v3 message format (AES-256-CBC + HMAC-SHA256, HKDF-SHA256) |
| Properties | Confidentiality, integrity, **forward secrecy**, post-compromise security |
| Implementation | `@privacyresearch/libsignal-protocol-typescript` 0.0.16 |

Each device publishes an identity key, a signed prekey (rotated every 7
days, old ones deleted after a 14-day grace period) and a supply of
one-time prekeys (each handed out once, then deleted from the server).

**About the implementation.** This is a community TypeScript port of the
original libsignal JavaScript library, not Signal's audited official
`libsignal`. During development we found that its PreKey path does not wait
for its own identity check; our client therefore verifies the presented
identity key itself before decrypting. An independent cryptographic audit
must assess this library or replace it before production use.

## Sealed sender

The Signal ciphertext and the sender's ID are placed in a second envelope:
a libsodium **sealed box** (`crypto_box_seal`: ephemeral X25519 key +
XSalsa20-Poly1305) addressed to the recipient's *sealing key*. The request
that delivers it to the server carries no account credentials. The server
therefore sees the recipient but not the sender.

The sealing key is signed with the identity key (XEdDSA), so the server
cannot swap it without also changing the identity key, which clients pin.

## Padding

Lengths are information. Before encryption:

- envelopes are padded (ISO/IEC 7816-4) to **1, 4, 16 or 64 KiB**;
- attachments are padded to **64 KiB**, then powers of two up to 1 MiB,
  then whole MiB.

The server rejects anything that is not padded to one of these sizes.

## Groups

Group messages are encrypted **pairwise**: the sender's device encrypts the
message separately for each member over the existing Signal sessions
("client-side fan-out", the scheme Signal itself used for years). The group
— its name, members and existence — is only known to the members' devices.
The server never learns that a group exists.

Planned: migration to Messaging Layer Security (MLS, RFC 9420) for large
groups, after an audited implementation is available.

## Attachments

Each file gets a fresh random 256-bit key and is encrypted on the device
with **XChaCha20-Poly1305** (libsodium) before upload. The key, file name
and type travel only inside the end-to-end encrypted message. The server
stores an opaque, padded blob under a random 128-bit ID, not linked to any
account. No thumbnails are generated or uploaded.

## Safety numbers

For every contact the app shows a 60-digit safety number, computed from both
identity keys (Signal fingerprint format, 5200 SHA-512 iterations). Compare
it in person or over another channel. If a contact's identity key changes,
messages are **blocked** until you explicitly accept the new key.

## Anonymous authentication

| | |
|---|---|
| Account key | Ed25519 key pair generated on the device |
| Anonymous ID | First 64 bits of SHA-256(domain ‖ public key) |
| Login | Signature over a single-use server challenge (96-bit nonce, expiry, HMAC-SHA256 tag; valid 60 s) |
| Session | Bearer token, HMAC-SHA256, valid 24 h, no cookie, nothing stored server-side |

## Local storage on your device

The entire local state (keys, sessions, contacts, messages) is one document
encrypted with **XChaCha20-Poly1305**. The key is derived from your
passphrase with **Argon2id** (3 passes, 64 MiB memory, random 128-bit salt).
Nothing readable is written to browser storage.

## Recovery key

- 256 random bits generated on the device, shown once as 52 characters.
- Two independent values are derived with libsodium's `crypto_kdf`
  (BLAKE2b): a lookup ID and a backup encryption key.
- The backup (long-term keys, contacts, groups — **no messages**) is
  encrypted with XChaCha20-Poly1305 and stored under the lookup ID.
- The server never sees the recovery key and cannot open the backup.
- **If you lose the recovery key, your account cannot be recovered.**

## Randomness

All keys, nonces, IDs and challenges come from the operating system's
CSPRNG: `crypto.getRandomValues` / libsodium `randombytes_buf` in the client,
`crypto.randomBytes` on the server.

## No master key

There is no administrator key, backdoor key or universal decryption key.
The operator has no key that can decrypt private messages, files or
backups. This can be verified in the source code.
