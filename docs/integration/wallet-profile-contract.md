# Wallet and profile integration contract

## Ownership

- Testagram Backend is the public API runtime, canonical identity authority, wallet ledger owner and profile authorization authority.
- PostgreSQL is the canonical store for wallet balances, ledger entries, transaction state and local profile fields.
- Flutter is presentation and authenticated transport only. It must never calculate or mutate a balance locally.
- Media bytes and upload lifecycle remain behind the Backend media gateway and the storage/CDN services.
- Use Testagram's own approved design system, branding, typography, spacing, icons and component language.

## Wallet launch scope

The initial wallet launches in **KES only**.

Supported Backend capabilities:
- `testagram.wallet.balance`
- `testagram.wallet.transactions.list`
- `testagram.wallet.recipient.resolve`
- `testagram.wallet.transfer`
- `testagram.wallet.tip`
- `testagram.wallet.mpesa.stk_push`
- `testagram.wallet.mpesa.status`

### M-Pesa deposits

1. Flutter asks the user for a Kenyan Safaricom number and a whole-KES amount.
2. Backend validates the Testagram-native access token, canonical user, live PostgreSQL session/account state, wallet state, amount limits and idempotency key.
3. Backend initiates an STK Push with Safaricom and persists the checkout identifiers and pending transaction.
4. Flutter reports that the prompt was sent; it must not show the deposit as credited yet.
5. Safaricom calls the public Backend callback. Backend validates callback details, independently queries Safaricom for payment confirmation and settles the top-up exactly once in a PostgreSQL transaction.
6. Flutter reads the Backend status capability and refreshes the balance only after the authoritative state becomes `settled`.

A request accepted by Safaricom is not a successful deposit. Pending, failed and settled states must remain distinct. The callback URL must be HTTPS and all Daraja credentials must be server-side environment secrets; never put them in Flutter, public OpenAPI examples or repository files.

### Internal transfers

Backend resolves the recipient, locks both wallet rows in deterministic order, checks active wallet state and available funds, enforces KES currency and an idempotency-key/request-hash pair, then commits the sender debit, recipient credit and paired ledger records in one transaction. A duplicate request with the same key and payload is safe; reusing a key with a different payload is a conflict.

### Withdrawal availability

M-Pesa B2C withdrawals are **not part of the current native client release**. Do not show a working withdrawal action or promise a payout until Backend implements the B2C disbursement workflow, balance reservation/refund semantics, callback/query reconciliation, idempotency, operational limits and audit controls. STK Push top-up support does not imply B2C payout support.

## Profile contract

- `GET /api/me/profile` returns the authenticated user's canonical profile.
- `GET /api/social/profiles/{user_id}` returns an active profile only when the viewer is allowed to resolve it.
- `testagram.social.profile.resolve` resolves a username through the authenticated Backend and applies the same discoverability, protected-account and block restrictions as profile reads.
- `PUT /api/me/profile` updates display name, bio, website, location, social links, avatar key and cover key.
- Profile media must first be uploaded through the authenticated Backend media gateway as public images. Backend verifies each selected key belongs to the caller and is ready before associating it with the profile.
- Profile reads return CDN/public delivery URLs; clients must never construct URLs from raw storage keys.
- Username, account status, protected-account state, discoverability and verification are not mutable through this profile editor. They remain separate Backend-authorized workflows.
- Public profile reads continue to respect account status, discoverability, protected-account follow state and block relationships.

## UI direction

Use a clear Testagram-owned information hierarchy:
- wallet balance first, clear M-Pesa add-funds action, send action and transaction history;
- profile cover and avatar, display name and handle, concise bio, location/website, follower counts and content timeline;
- clear loading, empty, pending, failed, success and retry states.

Keep Testagram's distinct brand treatment and use only approved Testagram design-system assets.


## Deep-link contract

### Canonical destinations

- Public username profile: `https://testagram.site/@{username}` and the equivalent `/u/{username}` path.
- Canonical UUID profile: `https://testagram.site/profile/{user_id}`.
- Wallet landing page: `https://testagram.site/wallet`.
- The `testagram://profile/{username}` and `testagram://wallet` forms are reserved for native application delivery where the platform explicitly registers the Testagram scheme.

### Resolution and authorization

- Flutter parses only allow-listed Testagram HTTPS hosts and the registered Testagram scheme. It rejects arbitrary hosts, user-info URLs, fragments, malformed handles and unsupported paths.
- Username links resolve through `testagram.social.profile.resolve`; the Backend performs viewer-scoped resolution and returns the canonical account UUID only if the viewer is allowed to discover the profile.
- Flutter then loads the profile through the existing `GET /api/social/profiles/{user_id}` contract. It never bypasses profile privacy by resolving a username locally.
- An incoming destination is retained across the authentication gate and opened only after the Backend validates the Testagram-native session.
- Wallet links open the wallet landing screen only. They never carry a recipient, amount, transfer command, M-Pesa checkout identifier or payment instruction. A deep link must never initiate a money movement.

### Platform association and release gate

- Android App Links require a verified `assetlinks.json` association for the production package name and signing certificate.
- iOS Universal Links require a valid `apple-app-site-association` file and matching Associated Domains entitlement.
- The Flutter source repository currently contains the Dart client but not the Android/iOS runner projects. Native association files, signing identity and domain hosting must be added and verified in the actual mobile packaging repository before claiming cold-start or warm-start native link support.
- Browser/web routing and the Dart route parser are necessary but do not alone prove native App Links or Universal Links.

## Wallet retry and settlement safety

- Every M-Pesa top-up attempt must persist its idempotency key and the exact normalized phone/amount payload before the first network request.
- A retry after a timeout or lost response must reuse the same key for the same payload. It must never silently generate a new key for an unresolved attempt.
- Backend must bind each idempotency key to the original phone, KES amount and currency. Reuse with a different payload returns an explicit conflict and must not return another customer's or another amount's checkout.
- The Flutter client must recover an unresolved attempt after process restart, query the authoritative top-up state when a checkout ID is known, and block a new distinct deposit while the prior request is ambiguous.
- A pending STK request is not a credit. Only a provider-verified callback/query and a committed PostgreSQL settlement transaction may change the wallet balance.
- The transaction list and balance refresh remain read-only projections of the Backend ledger. Client-side balance arithmetic is prohibited.
- M-Pesa B2C withdrawal remains unavailable until the separate payout lifecycle is implemented and independently accepted.
