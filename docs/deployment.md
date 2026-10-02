# Deployment

## Quick start (local, self-signed certificate)

```bash
./infra/scripts/gen-dev-cert.sh          # creates infra/certs/{cert,key}.pem
cp .env.example .env                     # then set the secrets
docker compose up --build
# open https://localhost  (accept the self-signed certificate)
```

## Production checklist

- [ ] Real TLS certificate (e.g. Let's Encrypt) mounted at `infra/certs/`.
- [ ] `SESSION_SECRET`: 32+ random bytes, base64 (`openssl rand -base64 32`).
- [ ] `POSTGRES_PASSWORD`: strong random value.
- [ ] `ALLOWED_ORIGINS` set to the public origin, e.g. `https://chat.example`.
- [ ] Only ports 80/443 exposed. Database and relay nodes stay on the
      internal Docker network.
- [ ] Hosting provider and any CDN/DDoS service configured **without**
      request logging; if that is impossible, disclose it on /transparency.
- [ ] Database backups (if any) encrypted and rotated within 7 days.
- [ ] HSTS preload submitted once the domain is stable.
- [ ] Optional: publish an onion service pointing at the Nginx container.
- [ ] Independent audits completed (see `audit-preparation.md`).

## Scaling

Relay nodes are stateless. Increase `RELAY_REPLICAS` (or run nodes in other
regions against the same PostgreSQL). Every node must share
`SESSION_SECRET`. Delivery between nodes uses PostgreSQL `LISTEN/NOTIFY`.

## Configuration reference (relay)

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `HOST`, `PORT` | Listen address (default `127.0.0.1:3000`) |
| `SESSION_SECRET` | Base64 HMAC key for bearer tokens, shared by all nodes |
| `ALLOWED_ORIGINS` | Comma-separated origins allowed for state-changing requests and WebSockets |
| `TRUST_PROXY` | `1` behind the reverse proxy, so rate limiting sees client addresses (never stored) |
