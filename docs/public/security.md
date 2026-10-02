# Security

## What protects your messages

- **End-to-end encryption by default** for every private and group message
  and every file. There is no unencrypted mode.
- **Keys stay on your device.** Private keys are generated on the device and
  never uploaded (except inside your optional recovery backup, which is
  encrypted with a key only you hold).
- **No master key.** The operator has no key that can decrypt your messages.
- **Forward secrecy.** The Double Ratchet derives a new key for every
  message. Signed prekeys rotate weekly; one-time prekeys are used once.
- **Identity pinning and safety numbers.** If a contact's key changes, the
  conversation is blocked until you accept the change.
- **Encrypted at rest.** Your local data is encrypted with a key derived from
  your passphrase using Argon2id.

## Server hardening

| Measure | Implementation |
|---|---|
| HTTPS / TLS | TLS 1.2+ only (TLS 1.3 preferred), modern ciphers, Nginx |
| HSTS | `max-age=63072000; includeSubDomains; preload` |
| Content Security Policy | `default-src 'self'`, no inline scripts, no third-party origins, `frame-ancestors 'none'` |
| XSS protection | React escapes all output; no raw HTML rendering; strict CSP; `X-Content-Type-Options: nosniff` |
| CSRF protection | No cookies at all, so browsers never send credentials automatically; cross-origin state-changing requests and WebSocket upgrades are rejected by origin check |
| SQL injection protection | Parameterised queries only; all input validated with strict schemas |
| Rate limiting | Per anonymised network key (HMAC with rotating in-memory key), stricter on registration, key lookups and uploads |
| Sessions | Short-lived (24 h) HMAC-signed bearer tokens; not stored; invalid once the account is deleted |
| Cookies | None. Nothing to steal, nothing to track |
| Passphrase hashing | Argon2id (client side, for the vault) |
| Randomness | OS CSPRNG everywhere |
| Key rotation | Signed prekeys weekly; one-time prekeys replenished automatically |
| Input limits | Fixed padded sizes for envelopes and files; body size limits |
| Permissions | `Permissions-Policy` disables geolocation, camera, microphone, sensors, payment, USB, etc. |
| Isolation | `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-Frame-Options: DENY` |
| Caching | API responses `Cache-Control: no-store` |
| Containers | Relay and web: non-root users, read-only file systems, all capabilities dropped, `no-new-privileges`. Database: read-only root file system. Database and relays sit on an internal network unreachable from the internet |

## Disappearing messages

Every conversation has a lifetime: 5 s, 30 s, 1 min, 5 min, 1 h, 24 h or
7 days. There is no "keep forever". After the lifetime, the message is
removed from the app on both devices, and the server deletes any copy it
still holds.

This does **not** mean a message is physically unrecoverable in every
case: screenshots, photos of the screen, a modified app on the other side,
device backups or a compromised device are outside the platform's control.

## Independent audit

Before this software is used in production, the following reviews by
independent experts are required: threat modelling review, penetration
test, cryptographic audit, source code audit, dependency audit,
infrastructure audit, WebSocket audit and authentication audit. The
preparation material is in `docs/audit-preparation.md` in the source
repository. **Until such an audit has been published, treat this software as
experimental.**

## Reporting a vulnerability

Please report security issues privately to the operator of this instance
or through the project's security advisory process on the source
repository. Do not open public issues for vulnerabilities.

## No absolute promises

We will never call this service "100 % untraceable". It is designed to
create, store and link as little identifying information as technically
possible. It cannot protect you if your device is compromised, if you
reveal who you are, or against surveillance outside this platform.
