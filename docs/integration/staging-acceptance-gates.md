# Staging acceptance gates — identity, media and social circuit

This document defines evidence required before enabling public registration or promoting fresh media storage. It is an acceptance contract, not a claim that production services have passed.

## Safety rules

- Use an isolated staging deployment, PostgreSQL database, and explicitly designated non-production object buckets for every provider under test. Never run destructive tests against production data.
- Do not print credentials, signed URLs, identity evidence, access JWTs, refresh tokens or recovery secrets in CI logs or artifacts.
- Testagram Backend is the sole credential, session, canonical identity, authorization and product-data authority. End-user access uses Backend-issued short-lived Testagram access JWTs and opaque rotating refresh tokens.
- Appwrite JWTs are not accepted as native end-user or staff bearer credentials. Historical Appwrite identifiers may be used only as explicit reconciliation inputs; never auto-link accounts by matching email.
- Keep `TESTAGRAM_IDENTITY_REGISTRATION_ENABLED=false`, `FRESH_MEDIA_ENABLED=false` and `MEDIA_REPLICATION_ENABLED=false` until each owning service's gates pass.
- Tests that create users, objects or posts must use deterministic test identities and clean up only their own staged resources.

## 1. Native identity approval and account provisioning

Required positive path:

1. Submit an identity application with a unique idempotency key and current Terms/Privacy versions.
2. Create a verification session and upload test evidence through the Backend proxy; verify content type, size and SHA-256.
3. Confirm the evidence is private and inaccessible through public CDN routes or unauthenticated object URLs.
4. Confirm one reviewer cannot approve alone; two distinct authorized reviewers must complete the decision.
5. Obtain a short-lived provisioning authorization only after approval.
6. Redeem the approved, short-lived provisioning authorization through the Backend's native registration/provisioning path; create exactly one canonical Testagram account.
7. Verify the Backend persists the canonical account, native credential verifier and identity/application linkage transactionally, without requiring an Appwrite user or JWT.
8. Redeem the same authorization again; assert idempotency and no duplicate account, username or credential records.
9. Complete email verification using the Backend-issued, single-use, expiring verification flow and the configured staging callback origin.
10. Sign in through `POST /api/auth/login`, obtain a short-lived Backend-issued access JWT and opaque refresh token, then resolve `GET /api/me/profile` to the same canonical account UUID.

Required negative paths:

- Unverified email, missing/expired/replayed provisioning or verification token, rejected application, one-person approval, duplicate email/username, invalid evidence checksum, expired session and unavailable PostgreSQL/evidence storage must fail closed.
- Appwrite JWTs, foreign issuers/audiences, expired/revoked access tokens, unknown sessions and refresh-token replay must never authenticate a native user.
- Refresh rotation must invalidate the prior refresh token; replay must revoke the affected session family. Logout and logout-all must revoke active access sessions.
- Recovery must complete only for the intended staging account; invalid, expired and replayed recovery secrets must fail.

Evidence to retain: redacted request IDs, test case IDs, reviewer decision IDs, canonical UUID (non-sensitive test fixture only), and pass/fail result. Never retain evidence bytes or bearer/recovery tokens in artifacts.

## 2. Instabox + R2 + B2 durable replication

Use a unique staging object key and known fixture bytes.

1. Upload through the Backend reservation/completion API.
2. Confirm the primary object exists and calculate SHA-256 from bytes read back from the provider, not ETag.
3. Replicate to the other two independent providers using separate endpoints, buckets and least-privilege credentials.
4. Read the full object independently from Instabox, R2 and B2; compare byte length, content type and SHA-256 against the fixture.
5. Assert the Backend ledger records all three providers as verified before asset status becomes `ready`.
6. Interrupt each destination in turn; assert the asset remains pending/degraded and cannot be attached or published as durable.
7. Restore the destination and verify bounded retry, idempotency, dead-letter visibility and repair without overwriting a good replica.
8. Corrupt or remove one staging replica and verify reconciliation detects and repairs it from a surviving verified copy.
9. Delete the fixture through the lifecycle API and verify tombstone/replica deletion acknowledgements; never perform bucket-wide cleanup.

A CDN cache hit is not a replica. Provider ETags are not portable SHA-256 evidence. Keep all buckets private.

## 3. Media upload, post publication and feed read-back

1. Authenticate a staging user through Backend-native login and resolve its canonical Backend profile.
2. Request a media upload intent with bounded type/size and a unique idempotency key.
3. Upload fixture bytes through the supported Backend upload path.
4. Complete upload with the client-computed SHA-256; poll only within a bounded deadline.
5. Assert pending/degraded media cannot be attached. Assert ready media has verified provider receipts.
6. Create a public post using an idempotency key, attach the ready asset and read the post back.
7. Read `GET /api/feed/home` and verify the post ID, author, visibility and media reference.
8. Fetch the media through the canonical CDN URL. Verify status, content type, byte length and SHA-256.
9. Test private-media access with owner, authorized viewer and unauthorized viewer; verify private responses are not shared-cache hits.
10. Change visibility/delete the asset and verify CDN purge/tombstone behavior prevents stale bytes from being served.

The current Flutter composer creates the text post before uploading/attaching images. This is a partial-success workflow, not an atomic post-plus-media transaction. Tests must assert the UI reports that distinction and that orphan cleanup is retryable.

## 4. Android and web staging journeys

Run against the same isolated staging environment and build-time public endpoints.

- Android debug/QA build installs and launches; web bundle loads from the staging Pages preview.
- Registration stays unavailable unless the staging registration switch is explicitly enabled for the isolated project.
- Exercise the approved registration/application journey, Backend email-verification callback, native password sign-in, refresh rotation, app restart/session restoration using the opaque refresh token, sign-out, logout-all, forgot-password and reset callback.
- Verify access JWTs are memory-only, refresh tokens use platform secure storage, and session restoration never treats a cached profile or expired access JWT as authenticated before Backend refresh succeeds.
- Exercise approved identity provisioning and canonical profile resolution.
- Exercise text post create/read-back, public image upload/attach, feed refresh and CDN image delivery.
- Exercise expired/revoked native access JWT, refresh-token replay, revoked session, Backend outage, PostgreSQL/evidence-storage outage, object-storage outage, upload timeout and retry UI.
- Confirm no server-side credential or provider key appears in Dart defines, APK contents, web bundle, source maps or CI artifacts.

Capture build SHA, app version, staging origin, test case IDs, backend request IDs, and redacted outcome. A mocked HTTP/widget test is not a staging journey.

## Release decision

A gate is **PASS** only when the owning service's tests and the cross-service staging journey both pass against the exact deployed staging revisions. A green compile, unit test, bucket listing, successful upload to one provider, or health endpoint alone is insufficient.

Public registration and fresh media activation remain disabled until all identity, storage, CDN, post/feed and Android/web gates above are signed off.
