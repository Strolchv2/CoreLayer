# Independent Audit Preparation

**Status: not yet audited. Do not use in production before the audits below
are completed and their reports published.**

## Required audits

| Audit | Scope | Key files |
|---|---|---|
| Threat model review | Adversaries, assumptions, limitations | `docs/threat-model.md` |
| Cryptographic audit | Use of libsodium and Signal; sealed sender; identity pinning; recovery derivation; vault KDF parameters; the choice of `@privacyresearch/libsignal-protocol-typescript` | `client/src/core/*.ts` |
| Protocol audit | Wire format, padding, replay, ordering, key directory trust | `packages/protocol/src/index.ts`, `client/src/core/engine.ts` |
| Source code audit | Relay and client | `server/src`, `client/src` |
| Authentication audit | Challenge-response, token format, revocation | `server/src/auth.ts`, `server/src/app.ts` |
| WebSocket audit | Auth handshake, flooding, origin checks, delivery/ack semantics | `server/src/app.ts`, `server/src/relay.ts` |
| Dependency audit | Supply chain, pinned versions, licences | `package-lock.json` |
| Infrastructure audit | TLS, headers, logging, container hardening | `infra/`, `docker-compose.yml` |
| Penetration test | Deployed instance | — |

## Questions we explicitly ask auditors

1. Is `@privacyresearch/libsignal-protocol-typescript` 0.0.16 acceptable, or
   must it be replaced (e.g. by official libsignal compiled to WebAssembly)?
   Known issue: `SessionBuilder.processV3` does not await
   `isTrustedIdentity`. Our mitigation is in `Messenger.handleEnvelope`.
2. Is the sealed-sender construction (sealed box over the Signal
   ciphertext + claimed sender, sender authenticity derived from the inner
   Signal session) sound? Are there sender-spoofing paths for first
   contact?
3. Are the padding buckets adequate?
4. Are Argon2id parameters (3 passes, 64 MiB) adequate for the vault?
5. Can a malicious relay do more than documented in the threat model?
6. Web-delivery risk: what is the best achievable code-integrity
   guarantee for the browser client?

## Running the test suite

```bash
npm ci
# PostgreSQL required for API and end-to-end tests:
export TEST_DATABASE_URL=postgres://user:pass@127.0.0.1:5432/corelayer_test
npm test
```

The end-to-end tests (`client/test/e2e.test.ts`) run real client engines
against a real relay and assert, among other things, that the database
contains no plaintext, no sender and no group data.

## Dependency inventory (runtime)

| Package | Purpose |
|---|---|
| `libsodium-wrappers-sumo` | All symmetric crypto, sealed boxes, Ed25519, Argon2id, KDF, padding |
| `@privacyresearch/libsignal-protocol-typescript` | X3DH, Double Ratchet, safety numbers |
| `@privacyresearch/libsignal-protocol-protobuf-ts` | Signal message decoding (identity pre-check) |
| `react`, `react-dom`, `react-router-dom`, `react-markdown` | UI |
| `zod` | Input validation (client and server) |
| `fastify`, `@fastify/websocket`, `@fastify/helmet`, `@fastify/rate-limit` | Relay HTTP/WebSocket server |
| `pg` | PostgreSQL client (parameterised queries) |
