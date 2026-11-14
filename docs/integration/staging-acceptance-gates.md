# Staging acceptance gates — identity, media and social circuit

This document defines evidence required before enabling public registration or promoting fresh media storage. It is an acceptance contract, not a claim that production services have passed.

## Safety rules

- Use isolated staging Appwrite project, PostgreSQL database, Instabox bucket, R2 bucket and B2 bucket. Never run destructive tests against production data.
- Do not print credentials, signed URLs, identity evidence, JWTs or recovery secrets in CI logs or artifacts.
- Appwrite is the credential/session authority. Backend is the canonical account, authorization and product-data authority.
- Never create or link a canonical account by email matching alone. Provisioning must bind the verified Appwrite user ID to exactly one canonical UUID.
- Keep `TESTAGRAM_IDENTITY_REGISTRATION_ENABLED=false`, `FRESH_MEDIA_ENABLED=false` and `MEDIA_REPLICATION_ENABLED=false` until each owning service's gates pass.
- Tests that create users, objects or posts must use deterministic test identities and clean up only their own staged resources.

## 1. Identity approval and Appwrite provisioning

Required positive path:

1. Submit an identity application with a unique idempotency key and current Terms/Privacy versions.
2. Create a verification session and upload test evidence through the Backend proxy; verify content type, size and SHA-256.
3. Confirm the evidence is private and inaccessible through public CDN routes or unauthenticated object URLs.
4. Confirm one reviewer cannot approve alone; two distinct authorized reviewers must complete the decision.
5. Obtain a short-lived provisioning authorization only after approval.
6. Create the Appwrite user and redeem the authorization with a valid Appwrite JWT.
7. Verify the Backend stores one canonical account UUID and one Appwrite identity mapping.
8. Redeem the same authorization again; assert idempotent/no duplicate account creation.
9. Verify email using the production-shaped callback URL in the staging Appwrite project.
10. Sign in, obtain a fresh Appwrite JWT and resolve `GET /api/me/profile` to the same canonical UUID.

Required negative paths:

- Unverified email, missing/expired/replayed token, mismatched Appwrite subject, rejected application, one-person approval, duplicate email/username, invalid evidence checksum, expired session and unavailable PostgreSQL/evidence storage must fail closed.
- Unknown Appwrite identities must not be auto-linked by matching email.
- Recovery callback must complete only for the intended staging user; invalid, expired and replayed recovery secrets must fail.

Evidence to retain: redacted request IDs, test case IDs, reviewer decision IDs, canonical UUID (non-sensitive test fixture only), Appwrite user ID (staging only), and pass/fail result. Never retain evidence bytes or bearer/recovery tokens in artifacts.

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

1. Authenticate a staging Appwrite user and resolve its canonical Backend profile.
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
- Exercise sign-up/application, email verification callback, sign-in, session restore, sign-out, forgot-password and reset callback.
- Exercise approved identity provisioning and canonical profile resolution.
- Exercise text post create/read-back, public image upload/attach, feed refresh and CDN image delivery.
- Exercise expired JWT, revoked/unlinked account, Backend outage, Appwrite outage, storage outage, upload timeout and retry UI.
- Confirm no server-side credential or provider key appears in Dart defines, APK contents, web bundle, source maps or CI artifacts.

Capture build SHA, app version, staging origin, test case IDs, backend request IDs, and redacted outcome. A mocked HTTP/widget test is not a staging journey.

## Release decision

A gate is **PASS** only when the owning service's tests and the cross-service staging journey both pass against the exact deployed staging revisions. A green compile, unit test, bucket listing, successful upload to one provider, or health endpoint alone is insufficient.

Public registration and fresh media activation remain disabled until all identity, storage, CDN, post/feed and Android/web gates above are signed off.
