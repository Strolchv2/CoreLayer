# Privacy Review (mandatory for every feature)

No feature, field, table, log line, dependency or external service is
merged without answering these questions in the pull request:

1. **Which data does this feature create?** List every new value, including
   metadata (timestamps, counters, sizes, connection events).
2. **Why is it needed?** Name the technical function that fails without it.
3. **Can the feature work without it?** Describe the alternative you
   considered (client-side only, padded, coarse, ephemeral, aggregated).
4. **How long must it exist?** State the retention and the mechanism that
   enforces it (delete-on-ack, expiry sweep, memory only).
5. **Can the server avoid it?** If the data can live only on the device, it
   must.
6. **Who could link it?** Could the new data be joined with anything else
   the server sees (network address, timing, recipient id) to identify
   someone or reveal a relationship?

If a feature creates unnecessary personal data: **change it or drop it.**

## Checklist for reviewers

- [ ] No new column or field holds an IP address, user agent, device
      information, location, contact or group relationship.
- [ ] No new exact timestamp is stored server-side (expiries are rounded).
- [ ] No new log statement includes request data, account ids or addresses.
- [ ] No third-party script, font, CDN, analytics or embed.
- [ ] Any new payload sent to the server is padded or has a fixed size.
- [ ] New metadata-producing behaviour (presence, receipts, typing) is off by
      default and explained in the UI before it can be enabled.
- [ ] `docs/threat-model.md` and `docs/public/*.md` are updated.

## Decisions taken so far

| Feature | Data it would create | Decision |
|---|---|---|
| Phone/e-mail signup | Real-world identifier | Not implemented. Accounts are keys |
| Contact discovery | Server-side social graph | Not implemented. Contacts are exchanged out of band by ID |
| Server-side groups | Group membership graph | Not implemented. Pairwise fan-out, membership only on devices |
| Sender field in mailbox | Who-talks-to-whom log | Not stored. Sealed sender, unauthenticated send endpoint |
| Online status / last seen | Activity log | Not implemented |
| Read receipts | Reading timestamps | Not implemented |
| Typing indicators | Real-time activity | Not implemented |
| Link previews | Third-party requests revealing links | Not implemented |
| Thumbnails | Unencrypted image derivatives | Not implemented |
| Access logs | IP + timestamp + path | Disabled in Nginx and the relay |
| Account creation date | Timestamp | Not stored; only a month-granularity expiry |
| Rate limiting | IP addresses | HMAC with rotating in-memory key, no persistence |
| Message timestamps on server | Exact send times | Only expiry, rounded up to the minute |
| Message length | Content fingerprint | Fixed padding buckets, enforced by the server |
| Nicknames | Pseudonymous profile on server | Only inside encrypted messages |
| Recovery | E-mail or phone | Local recovery key, encrypted backup |
