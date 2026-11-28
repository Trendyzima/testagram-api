# Native mail ownership and integration contract

Testagram transactional email has one owner: **Testagram Backend**.

- Backend owns registration verification OTPs and links, password recovery, notification mail, message templates, PostgreSQL transactional outbox, encrypted payloads, lease/retry/idempotency state, direct-to-recipient-MX SMTP transport, STARTTLS, DKIM signing, VERP return paths, bounce correlation and delivery observability.
- InstaBox VPS is the production execution environment for the Backend mail worker and its persistent native mail keys.
- Cloudflare owns authoritative DNS and the authenticated inbound bounce-feedback Worker. It is not an outbound email-sending API in this architecture.
- PostgreSQL is the durable queue/state store. A queued message or SMTP acceptance is not proof of inbox delivery.
- Actual Gmail and Outlook receipt, SPF/DKIM/DMARC alignment, provider-managed PTR, outbound TCP/25, authenticated bounce processing, retry/replay safety, key persistence and monitoring are mandatory production acceptance evidence.

No other Testagram repository may create a second mail subsystem, configure an outbound provider, add an SMTP relay account, or embed mail-provider credentials. Flutter only presents Backend authentication flows and calls Backend endpoints; Data Centre owns infrastructure but not mail transport; CDN, Algorithm and Federation do not send account-verification mail.

Future email work must extend the Backend's existing native outbox, templates, transport and feedback pipeline. A change to this ownership model requires an owner-approved architecture decision and coordinated updates to all seven-repository contracts before implementation. No provider or relay fallback is permitted when native mail configuration or network prerequisites fail.
