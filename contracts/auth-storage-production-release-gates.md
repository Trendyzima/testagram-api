# Testagram authentication and hybrid media release contract

This is a cross-repository contract for Backend, Data Centre, CDN and Flutter. It is a release gate, not production cutover authorization.

## Canonical ownership

- PostgreSQL on the Testagram Backend owns canonical Testagram account UUIDs, credentials, session state, product records, media metadata, visibility, moderation, quotas, deletion tombstones and the canonical replica ledger.
- Testagram Backend is the sole end-user identity issuer and authorization authority. Public Flutter clients use Testagram-native sessions; no external identity-provider session is accepted on the end-user API path.
- The Admin Console now authenticates through the Testagram-native Backend session and stores it in an encrypted `testagram-staff` cookie (`HttpOnly`, `Secure`, `SameSite=Strict`). Staff authorization is checked against enabled PostgreSQL staff principals, a recorded MFA-enrollment marker and role grants. The current step-up verifies the password only; TOTP/passkey challenge verification is not implemented, so staff invitation and role-grant activation remain fail-closed. Historical Appwrite IDs are retained only for explicit account reconciliation; Appwrite bearer tokens are not accepted by the native end-user or staff API paths.
- Data Centre owns VPS MinIO, R2/B2 replication workers and operational job/receipt state.
- Cloudflare R2 and Backblaze B2 are private object stores. Cloudflare DNS remains authoritative; Testagram Go CDN is the public media byte-delivery plane.
- CDN cache is disposable and never a durable replica.
- No Render runtime/deployment dependency.

## End-user authentication contract

1. Flutter submits email and password to Backend `POST /api/auth/login`.
2. Backend verifies the password against the canonical PostgreSQL identity, checks email verification, account disablement, registration provisioning and password-reset-required state.
3. Backend issues a 15-minute HS256 access token and an opaque 30-day refresh token. The refresh token is stored server-side only as a one-way hash.
4. Flutter stores only the refresh token in platform secure storage; access tokens remain in memory.
5. Refresh rotates the refresh token atomically. Reuse of a revoked token family revokes the family.
6. Logout revokes the current session. Logout-all increments the identity token version and revokes every active session.
7. Password recovery returns a generic anti-enumeration response, stores only a one-way hash of the single-use token, expires the token after 30 minutes, and sends the recovery link through Testagram's configured email transport. Successful reset changes the password, increments token version and revokes all active sessions.
8. Email verification uses an expiring single-use token and is separate from account provisioning.

The Backend validates signature, issuer, audience, role, canonical subject UUID, session UUID, token version and expiry, then checks live PostgreSQL session/account state. A cryptographically valid JWT without an active database session is not authenticated.

## Registration and provisioning

- Public account creation begins with `POST /api/identity/applications`; this endpoint creates an application, not a login-capable account.
- The Backend requires accepted age, Terms and Privacy declarations, a high-entropy idempotency key, configured policy versions and rate-limit capacity.
- Identity evidence requires private object storage, byte-size/content-type checks, SHA-256 verification, reviewer-access auditing and a retention/deletion worker.
- Two distinct matching identity reviewers and two distinct account approvers are required before native provisioning.
- Provisioning creates the canonical Testagram identity and profile transactionally, consumes the application-scoped authorization once, and records the provisioning ledger.
- Email verification must complete before a session can be issued.
- Registration remains fail-closed until PostgreSQL, private evidence storage, verified replication, email delivery, policy versions and the staff approval path are configured and tested.

## Media upload contract

1. Client calls Backend with an authenticated Testagram-native session to create an upload intent.
2. Backend derives canonical owner UUID from the verified session; client cannot choose owner.
3. Backend validates namespace, visibility, moderation, MIME, maximum size, quota, key and expiry.
4. Client receives a short-lived scoped upload capability only; no provider master credential.
5. Completion includes declared SHA-256. Backend/Data Centre independently streams each copy and verifies SHA-256, size and content type.
6. Asset status becomes ready only after all required durable destinations are verified: VPS private MinIO, Cloudflare R2 private bucket and Backblaze B2 private bucket.
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

- Backend: native auth route matrix, session/recovery/revocation tests, identity provisioning and evidence-retention integration tests, transactional outbox/replica ledger, private/public media authorization tests.
- Data Centre: native session verification for video and notifications, provider smoke tests for MinIO/R2/B2, leased replication/reconciliation, restore and delete drills.
- CDN: private cache bypass, public classification, origin auth and checksum-safe failover, HEAD/Range/HLS.
- Flutter: native login/restart/refresh/logout/recovery tests, registration application UX, upload checksum, retry, playback and deletion tests.
- API: schema compatibility, generated client drift, exact source commit pins and route inventory parity.
- Staff console: native login, encrypted session cookie, session validation and PostgreSQL role/MFA checks are implemented. Complete the fail-closed invitation and two-person staff-role onboarding workflow before opening staff enrollment.

No repository PR is merged merely because its local tests pass. Require exact-head CI, review, staging evidence and cross-repository compatibility. Any production provider/auth/DNS change requires a separate explicit release approval.

A separate legacy Fresh Backend image is still referenced by Data Centre `vps/docker-compose.yml` and requires Appwrite endpoint/project/database/server-key configuration. It is pinned and audited separately from current Backend `main`; it is not part of the native auth contract. Do not remove it until deployed traffic, account reconciliation, rollback and production cutover are verified and separately approved.
