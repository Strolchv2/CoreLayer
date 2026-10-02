# Security Policy

**Status: experimental, not yet independently audited.** See
[docs/audit-preparation.md](docs/audit-preparation.md).

## Reporting a vulnerability

Please report vulnerabilities privately via GitHub's
"Report a vulnerability" (Security Advisories) on this repository. Do not
open public issues for security problems.

Include, if possible: affected component (client, relay, protocol,
infrastructure), steps to reproduce, and impact. You do not need to give
your name.

## Scope

Everything in this repository: client cryptography, wire protocol, relay
server, database schema, Nginx and Docker configuration. Of particular
interest: anything that lets the server or a network attacker learn more
than documented in [docs/threat-model.md](docs/threat-model.md).
