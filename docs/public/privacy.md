# Privacy

**The rule behind every decision: if a piece of information is not strictly
required, it is not collected.**

## What you do not need to give us

No name. No phone number. No e-mail address. No postal address. No date of
birth. No location. No social media account. No password reset address.

When you create an account, your device generates cryptographic keys. Your
**Anonymous ID** (for example `7F3A-91D2-8C41-0B5E`) is derived from one of
those public keys. It contains no information about you, and we cannot
choose it for you.

A **nickname** is optional. It is stored on your device and only sent to
your contacts inside end-to-end encrypted messages. The server never sees
it.

## What the server stores

This is the complete list. The database schema is published in
`server/src/schema.ts`.

| Data | Why | How long |
|---|---|---|
| Your Anonymous ID and public keys | So others can start an encrypted conversation with you | Until you delete your account, or after ~6 months without login |
| Unused one-time public prekeys | Forward secrecy for new conversations | Until used or account deletion |
| Encrypted messages waiting for delivery: recipient ID, padded ciphertext, expiry (rounded to the minute) | Store-and-forward when the recipient is offline | Deleted the moment your device confirms receipt, at the latest when the message's lifetime ends (max. 7 days) |
| Encrypted attachments (padded ciphertext, expiry) — not linked to any account | File transfer | Until the message lifetime ends (max. 7 days) |
| Optional encrypted recovery backup | Account recovery with your recovery key | Until you disable it or delete your account |
| Month of your last login (as an inactivity expiry date) | Automatic deletion of abandoned accounts | Refreshed on login |
| Tag of a used login challenge (random, not linked to any account) | Prevents replaying a login | 60 seconds |

## What the server does not store

- IP addresses, in any form, in any table or log
- who sent a message (there is no sender field)
- your contacts, your groups, or who is in them
- message content, file names, file types or thumbnails
- creation dates, "last seen", online status, read receipts, typing indicators
- device model, browser, operating system, language, screen size
- cookies (the service sets none)

## No tracking

- No analytics (no Google Analytics, no Matomo, nothing self-hosted either)
- No advertising, no ad networks, no advertising IDs
- No Facebook Pixel or any other third-party script
- No fingerprinting of any kind (browser, canvas, audio, font, hardware)
- No external fonts, CDNs or embeds: every file is served from this server
- `Referrer-Policy: no-referrer` and a `Permissions-Policy` that disables
  geolocation, camera, microphone and other sensors

## Features that are deliberately missing

| Feature | Why it is missing |
|---|---|
| Online indicator / "last seen" | Reveals your daily routine to everyone who knows your ID |
| Read receipts | Create a timestamped record of every time you read a message |
| Typing indicators | Reveal activity patterns in real time |
| Contact discovery via phone book | Requires uploading your contacts |
| Location sharing | Location is among the most identifying data there is |
| Link previews | The sender's device would fetch third-party websites |

If any of these is ever added as an opt-in, this page will state exactly
which additional metadata it creates before you can enable it.

## Network addresses

Your device has to connect to the server, so the server necessarily sees
your network address while a request is being processed. It is not written
anywhere. For rate limiting (abuse protection) the server computes a keyed
hash of the address with a random key that exists only in memory and is
replaced every 24 hours; rate-limit entries disappear after at most one
hour. If your network address itself is sensitive, connect through Tor or a
trusted VPN.

## Deleting your account

*Settings → Delete account* removes your account, your public keys, all
messages waiting for you and your recovery backup from the server
immediately, and erases the encrypted vault on your device. Attachments you
sent expire on their own (max. 7 days). Messages already delivered to other
people remain on their devices until their lifetime ends.

## Honest limits

We minimise what can identify you. We cannot promise that you can never be
identified: what you write, a compromised device, or surveillance outside
this platform can reveal you. See [/security](/security) and
[/transparency](/transparency).
