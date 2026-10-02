# CoreLayer — Anonymous Global Chat

An end-to-end encrypted messenger whose first priority is **anonymity and
minimal traceability**. No phone number, no e-mail, no name. Your account is
a key pair on your device.

> **The rule behind every decision: if a piece of information is not
> strictly required, it is not collected.**

> ⚠️ **Experimental. Not yet independently audited.** Do not rely on it for
> high-risk use until the audits in
> [docs/audit-preparation.md](docs/audit-preparation.md) are done.

![Conversation with safety number](docs/screenshots/chat.png)

## What it does

| | |
|---|---|
| Identity | Random anonymous ID derived from a device-generated Ed25519 key (`7F3A-91D2-8C41-0B5E`). Optional nickname, only visible to contacts |
| Private messages | Signal protocol (X3DH + Double Ratchet): end-to-end encryption, forward secrecy |
| Sealed sender | The relay sees the recipient, never the sender. Sending requires no login |
| Groups | End-to-end encrypted via pairwise fan-out. The server does not know groups exist |
| Files | Encrypted on the device (XChaCha20-Poly1305, fresh key per file), padded, no thumbnails |
| Disappearing messages | 5 s, 30 s, 1 min, 5 min, 1 h, 24 h, 7 days. There is no "forever" |
| Metadata | Fixed-size padding, no sender field, no timestamps except rounded expiries, no online status, no read receipts, no typing indicators |
| Local storage | Whole state encrypted with Argon2id + XChaCha20-Poly1305 |
| Recovery | Optional recovery key generated locally; the server only stores an encrypted backup it cannot open |
| Tracking | None. No analytics, no ads, no cookies, no third-party requests, no fingerprinting |
| Safety numbers | 60-digit fingerprints; key changes block the conversation until approved |
| Infrastructure | Stateless relay nodes (any number) + PostgreSQL, Nginx with strict TLS/HSTS/CSP and **no access log** |

Full documentation — the same pages the app serves publicly:

- [Security](docs/public/security.md) · [Privacy](docs/public/privacy.md) ·
  [Cryptography](docs/public/cryptography.md) ·
  [Architecture](docs/public/architecture.md) ·
  [Transparency](docs/public/transparency.md)
- [Threat model](docs/threat-model.md) · [Privacy review process](docs/privacy-review.md) ·
  [Audit preparation](docs/audit-preparation.md) · [Deployment](docs/deployment.md)

## Repository layout

```text
packages/protocol   Wire protocol: every field the server can ever receive (zod schemas)
server/             Relay: Node.js + TypeScript, Fastify, WebSocket, PostgreSQL
  src/schema.ts     The complete database schema (read it as a privacy statement)
client/             React + TypeScript web client
  src/core/         All cryptography and the messaging engine (framework-independent)
  src/ui/           User interface
docs/               Threat model, architecture, public /security … /transparency pages
infra/              Nginx configuration, development certificate script
docker-compose.yml  Reference deployment (PostgreSQL, 2 relay nodes, Nginx)
```

## Run it

### Docker (reference deployment)

```bash
./infra/scripts/gen-dev-cert.sh
cp .env.example .env   # set SESSION_SECRET and POSTGRES_PASSWORD (openssl rand -base64 32)
docker compose up --build
# https://localhost
```

### Development

```bash
npm install
npm run build -w @corelayer/protocol
# PostgreSQL must be running:
DATABASE_URL=postgres://user:pass@127.0.0.1:5432/corelayer npm run dev:server
npm run dev:client     # http://localhost:5173 (proxies /api and /ws)
```

### Tests

```bash
export TEST_DATABASE_URL=postgres://user:pass@127.0.0.1:5432/corelayer_test
npm test
```

The suite includes end-to-end tests that run real client engines against a
real relay and PostgreSQL, and assert on what the database actually
contains: no plaintext, no sender, no group, no personal data, complete
deletion on account deletion, cross-node delivery, identity-change blocking
and recovery.

## Honest limits

This software minimises what can identify you. It does **not** make anyone
"100 % untraceable". It cannot protect you from a compromised device, from
what you reveal yourself, or from surveillance outside the platform. A
browser-delivered client also depends on the server delivering honest code.
The relay necessarily sees network addresses while connected (never stored);
use Tor if that matters to you. See the [threat model](docs/threat-model.md).

## License

[AGPL-3.0-or-later](LICENSE). Any operator who modifies and runs this
service must publish their source code — which is exactly what users of a
privacy service should be able to demand.
