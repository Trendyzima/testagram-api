# Wallet and profile integration contract

## Ownership

- Testagram Backend is the public API runtime, canonical identity authority, wallet ledger owner and profile authorization authority.
- PostgreSQL is the canonical store for wallet balances, ledger entries, transaction state and local profile fields.
- Flutter is presentation and authenticated transport only. It must never calculate or mutate a balance locally.
- Media bytes and upload lifecycle remain behind the Backend media gateway and the existing storage/CDN services.
- XClone is the visual and interaction reference. Testagram may reuse familiar interaction patterns, but must preserve its own branding, typography, spacing, icons and component language.

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
2. Backend validates the authenticated Appwrite session, active account, wallet state, amount limits and idempotency key.
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
- `PUT /api/me/profile` updates display name, bio, website, location, social links, avatar key and cover key.
- Profile media must first be uploaded through the authenticated Backend media gateway as public images. Backend verifies each selected key belongs to the caller and is ready before associating it with the profile.
- Profile reads return CDN/public delivery URLs; clients must never construct URLs from raw storage keys.
- Username, account status, protected-account state, discoverability and verification are not mutable through this profile editor. They remain separate Backend-authorized workflows.
- Public profile reads continue to respect account status, discoverability, protected-account follow state and block relationships.

## UI direction

Use XClone's own profile and wallet surfaces as a product-specific reference for information hierarchy:
- wallet balance first, clear M-Pesa add-funds action, send action and transaction history;
- profile cover and avatar, display name and handle, concise bio, location/website, follower counts and content timeline;
- clear loading, empty, pending, failed, success and retry states.

Do not copy X's trademarks, logos or exact visual assets. Keep Testagram's distinct brand treatment.
