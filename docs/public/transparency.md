# Transparency

This page states exactly what the server can and cannot see, how long
anything exists, and what could be handed over if the operator were legally
compelled.

## What the server sees, per action

| Action | Visible to the server at that moment | Stored |
|---|---|---|
| Create account | Public keys, network address (transient) | Anonymous ID, public keys, month-based expiry |
| Log in | Anonymous ID, network address (transient) | Month-based expiry refreshed; used challenge tag for 60 s |
| Look up someone's keys | The ID being looked up, network address (transient). **Not** who is asking | One one-time prekey is deleted |
| Send a message | Recipient ID, padded envelope size, chosen lifetime, network address (transient). **Not** the sender, not the content | Recipient ID, ciphertext, expiry (rounded up to the minute) |
| Receive a message | That your account is connected to this node (while connected) | Nothing; the envelope is deleted on acknowledgement |
| Upload a file | Padded size, lifetime, network address (transient) | Ciphertext and expiry, not linked to any account |
| Download a file | Blob ID, network address (transient) | Nothing |
| Recovery backup | Your account (authenticated), an opaque lookup ID and ciphertext | Lookup ID, ciphertext |
| Delete account | Your account | Everything about it is deleted immediately |

## What the server never sees

Message text · file contents · file names and types · nicknames · contact
lists · group names, members or existence · read status · typing ·
location · recovery keys · passphrases · private keys.

## Logs

| Log | Retention |
|---|---|
| HTTP access logs (Nginx) | **None** — `access_log off` |
| Application request logs (relay) | **None** — request logging disabled |
| Application error logs | Only an error class/code, never request data, IDs or addresses. Written to the container's stdout, not to disk by the application |
| Nginx error log | Level `crit` only |
| Database query logs | Disabled; parameters are never logged |
| Rate-limit state | In memory only, keyed by an HMAC with a key rotated every 24 h; entries expire after at most 1 hour; lost on restart |
| Cross-node delivery notifications | Transient PostgreSQL `NOTIFY` with the recipient ID; not stored |

Operators deploying this software should verify that their hosting
provider's own infrastructure (load balancers, DDoS protection) does not
add logging, and disclose it here if it does.

## Retention summary

| Data | Maximum lifetime |
|---|---|
| Undelivered message | Its disappearing-message lifetime, at most 7 days |
| Delivered message on the server | Deleted on acknowledgement (seconds) |
| Attachment | Its message lifetime, at most 7 days |
| Message on devices | Its disappearing-message lifetime |
| Inactive account | About 6–7 months after the last login (month granularity) |
| Recovery backup | Until disabled or account deletion |
| Bearer token | 24 hours (not stored) |
| Login challenge | Not stored when issued; its random tag is kept 60 seconds after use to block replays |

## Account deletion

Deleting your account immediately removes from the server: the account
row, public keys, all one-time prekeys, every message waiting for you and
your recovery backup. Active connections are closed. On your device, the
encrypted vault is erased. Attachments you uploaded expire on their own.
Copies of messages already on other people's devices remain until their
lifetime ends. Database backups, if an operator makes them, contain only the
data listed above and must be rotated within 7 days.

## Legal requests

If compelled, an operator can at most hand over the data in the "Stored"
column above. There is no plaintext, no contact list, no group list and no
IP history to hand over. Operators should publish a transparency report on
this page listing the number of requests received and what was provided.

## Verifying these claims

Everything stated here can be checked in the published source code:
`server/src/schema.ts` (all stored data), `server/src/app.ts` (all
endpoints), `packages/protocol/src/index.ts` (every field that is ever
sent), `infra/nginx/nginx.conf` (logging and headers).
