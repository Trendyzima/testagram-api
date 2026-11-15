# Testagram authentication and hybrid media release contract

This is a cross-repository contract for Backend, Data Centre, CDN and Flutter. It is a release gate, not a production cutover authorization.

## Canonical ownership

- PostgreSQL on InstaBox VPS owns canonical Testagram account UUIDs, identity links, product records, media metadata, visibility, moderation, quotas, deletion tombstones and the canonical replica ledger.
- Appwrite remains the active production credential/session provider until native authentication is explicitly approved after parity and rollback acceptance.
- Data Centre owns VPS MinIO, R2/B2 replication workers and operational job/receipt state.
- Cloudflare R2 and Backblaze B2 are private object stores. Cloudflare DNS remains authoritative; Testagram Go CDN remains the public media byte-delivery plane.
- CDN cache is disposable and never a durable replica.
- No Render runtime/deployment dependency.

## Authentication request contract

Flutter presents an Appwrite session JWT to Backend. Backend validates it with Appwrite and resolves an explicit provider subject to the existing canonical Testagram UUID in PostgreSQL. Unknown, ambiguous, inactive or unprovisioned identities fail closed. Email equality is never sufficient to link accounts.

Native authentication can be enabled only after route-by-route public, staff, internal and media auth inventory; immutable account ID and relationship reconciliation; verified-email provenance reconciliation; password migration/reset policy with no fabricated hashes; token issuer/audience/expiry, refresh rotation/reuse detection, revocation, recovery and abuse controls; Flutter login/restart/refresh/logout/recovery/device tests; staff MFA/step-up and internal service credential separation; backup/restore, rollback rehearsal, security review and explicit operator approval.

Until then, the production Appwrite path remains intact and native handlers remain non-authoritative/shadow or disabled.

## Media upload contract

1. Client calls Backend with authenticated user session to create an upload intent.
2. Backend derives canonical owner UUID from verified session; client cannot choose owner.
3. Backend validates namespace, visibility, MIME, maximum size, quota, key and expiry.
4. Client receives a short-lived scoped upload capability only; no provider master credential.
5. Completion includes declared SHA-256. Backend/Data Centre independently streams each copy and verifies SHA-256, size and content type.
6. Asset status becomes ready only after all three durable destinations are verified: VPS private MinIO, Cloudflare R2 private bucket and Backblaze B2 private bucket.
7. Partial provider failure leaves the asset replicating/degraded; retries are idempotent, leased and bounded.

## Media download and authorization contract

- Backend remains the sole authority for owner, visibility, moderation and viewer permission.
- Private media requires short-lived object/viewer/scope-bound authorization assertion; CDN relays to trusted Backend origin and never shared-caches private bytes.
- Public media is cacheable only after Backend explicitly confirms canonical visibility=public and status=ready.
- No direct B2/R2/MinIO URL fallback may bypass Backend policy.
- CDN must not claim provider failover until an origin adapter validates the same object digest and Backend authorization contract.
- Delete uses durable tombstones and provider receipts; CDN cache purge is not object deletion.

## Three-copy receipt semantics

Every provider receipt is keyed by canonical asset ID + provider ID + namespace + object key and contains expected and observed byte length, expected and observed SHA-256, observed content type, verification timestamp, provider operation/version identifier where available, replica state and last error category. Never persist credentials, signed URLs or authorization assertions in receipts.

Provider ETags are opaque transport metadata, not a portable checksum.

## Required cross-repository release evidence

- Backend: route/auth matrix, identity reconciliation report, transactional outbox/replica ledger, private/public media auth tests.
- Data Centre: provider smoke tests for MinIO/R2/B2, leased replication/reconciliation, restore and delete drills.
- CDN: private cache bypass, public classification, origin auth and checksum-safe failover, HEAD/Range/HLS.
- Flutter: Appwrite session compatibility, native migration UX only when enabled, upload checksum, retry, playback and deletion tests.
- API: schema compatibility, generated client drift, exact source commit pins and route inventory parity.

No repository PR is merged merely because its local tests pass. Require exact-head CI, review, staging evidence and cross-repository compatibility. Any production provider/auth/DNS change requires a separate explicit release approval.
