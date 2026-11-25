# Connected Testagram production acceptance — 2026-11-25

**Status: BLOCKED — do not declare production-ready.**  
**Scope:** native email, identity intake, messaging E2EE, protocol selection, deployment and cross-organ runtime acceptance.  
**Authority:** Testagram Backend remains the sole identity, session, authorization and canonical product-data authority. This API repository is build-time governance only.

This register is an explicit release gate, not evidence that a live test has passed. A merged PR, green unit test, image build, Pages preview or healthy process does not prove a cross-organ production journey. Every PASS below requires dated evidence from the exact deployed source revision and environment.

## Release invariants

1. No release may advertise a feature as available or secure until its end-to-end acceptance gate passes.
2. Unverified E2EE remains unavailable. Never infer encryption from ciphertext presence, TLS, database encryption, a client boolean or a version string.
3. Identity applications do not provision accounts until Backend review policy, two-person approval, WebAuthn staff controls, evidence storage and email verification all work together.
4. Native outbound email remains paused until DNS, egress, PTR, SMTP, signed bounce ingress and real mailbox acceptance pass.
5. Production deployment is an explicit, manually confirmed operation. PR and push validation must never deploy production.
6. Flutter communicates only with the public Backend API and canonical CDN URLs. It must never call private organs or carry service credentials.
7. The Backend rechecks current authorization after every service response. Ranking, federation, storage, CDN and notifications cannot become alternate authorization authorities.

## Gate A — native email (Backend PR #536)

**Source state:** PR #536 is merged at `875b473f96fb512d6c89d397ce7dff12746cffec`. Its own acceptance record explicitly says the native mail path is not production-accepted and outbound mail remains paused.

Required evidence, all mandatory:

- [ ] Run the read-only InstaBox network diagnostic and retain its logs.
- [ ] Confirm independently observed egress IPv4 addresses agree.
- [ ] Obtain provider confirmation that the egress address is static/dedicated.
- [ ] Confirm PTR/rDNS is `mail.testagram.site` and forward DNS matches.
- [ ] Verify outbound TCP/25 to Gmail and Outlook MX from InstaBox.
- [ ] Verify Cloudflare Email Routing, MX and plus-addressing on `bounces.testagram.site`.
- [ ] Verify the signed Worker-to-Backend health probe, authentication and API-unavailable behavior.
- [ ] Send real messages to Gmail and Outlook; retain message IDs and inspect SPF, DKIM, DMARC, alignment and inbox placement.
- [ ] Deliver a real hard-bounce DSN; prove exactly one correlated suppression.
- [ ] Replay the same DSN and prove idempotent deduplication.
- [ ] Verify retry exhaustion, dead-letter visibility, suppression, unsubscribe/preferences and delivery audit behavior.
- [ ] Verify notification/authentication email templates and consent rules for every enabled event class.

**Release rule:** no outbound production activation until all boxes are checked with evidence. Do not create a new provider credential or bypass Testagram-owned native delivery to make the gate green.

## Gate B — identity application and account provisioning (Flutter PRs #144 and #147)

**Source state:** PR #144 is an open draft based on Flutter main; PR #147 is an open draft stacked on #144. PR #147's build and Pages checks passed, but this is not production identity acceptance. The Backend's native identity review path remains fail-closed until its production WebAuthn/Admin Console and private evidence-storage gates are verified.

Required evidence:

- [ ] Review and merge #144 only after its latest Pages check completes and its API behavior matches the current Backend contract.
- [ ] Review and merge #147 only after #144 is merged and the stacked base is refreshed.
- [ ] Verify Terms, Privacy, age and consent gates, and that the UI never advances to email verification after a rejected application.
- [ ] Verify the 256-bit idempotency key is generated securely and duplicate submissions do not create duplicate applications.
- [ ] Verify no password, raw evidence bytes, access token or refresh token is persisted in the recoverable application draft.
- [ ] Verify evidence upload uses the private evidence-storage contract, short-lived grants, size/type limits, retention and access audit.
- [ ] Verify staff WebAuthn enrollment/assertion, anti-replay counters, reviewer role separation and two independent approvals in production-equivalent staging.
- [ ] Verify account provisioning is atomic and occurs only after approval; ordinary public `/api/auth/signup` remains disabled.
- [ ] Verify native email verification, login, refresh rotation, logout, logout-all and recovery against the provisioned account on Android and web.
- [ ] Verify rejection, withdrawal, expiry, staff revocation and evidence deletion/retention paths.

**Release rule:** no public identity intake activation until all boxes are checked in staging and the production Admin Console/evidence store are ready.

## Gate C — messaging E2EE (Backend PRs #542/#545; Flutter PR #152; API PR #145)

**Source state:** Backend PRs #542 and #545 are merged. Flutter PR #152 is merged. They correctly fail closed: encrypted send/edit and private-message attachments are unavailable until the cryptographic lifecycle exists. API PR #145 is merged as an architecture evaluation only; it adds no runtime implementation and approves no package. The current decision remains NO PROTOCOL APPROVED.

Required implementation and evidence:

- [ ] Approve exactly one protocol architecture for direct and group messaging, including cross-platform Android/web behavior. Do not add unreviewed Dart wrappers or invent a cryptographic wire protocol.
- [ ] Complete legal/license review, source provenance, dependency pinning, reproducible build, upstream test-vector review and independent cryptographic/security review for the selected implementation.
- [ ] Implement device identity generation, proof-of-possession enrollment, QR/safety-number verification and device revocation.
- [ ] Implement signed-prekey publication, atomic one-time-prekey claim, replenishment, rotation and abuse limits if required by the selected protocol.
- [ ] Implement durable, serialized cryptographic session/group state on device; prove crash/retry/concurrency safety.
- [ ] Implement authenticated versioned envelopes and bind conversation, sender device, recipient/device membership, message ID and epoch into authenticated metadata.
- [ ] Implement local encryption and local decryption only. Backend, Data Centre, CDN, notifications, analytics, logs and support tooling must never receive plaintext or private keys.
- [ ] Implement replay/downgrade rejection, invalid-tag/signature handling, out-of-order delivery, duplicate delivery, offline recipient, simultaneous session start, key change and revoked-device tests.
- [ ] Implement multi-device transfer/recovery without server-side plaintext escrow. Explain that loss of all trusted devices can make history unrecoverable.
- [ ] Implement encrypted attachments: encrypt bytes before upload; distribute content keys only inside verified encrypted messages; verify ciphertext integrity across storage replicas; decrypt/preview only on recipient devices.
- [ ] Keep message notifications generic; no plaintext previews or attachment keys.
- [ ] Keep group messaging, federation E2EE and call-media E2EE separately disabled until their own membership/rekey, federation trust and frame-encryption gates pass.
- [ ] Pass identical published and negative test vectors on Android and supported web build targets.
- [ ] Run independent penetration and cryptographic review before removing `503 E2EE_NOT_READY`.

**Release rule:** keep secure composition, encrypted attachments and E2EE claims disabled until every applicable box passes. Never make the UI look complete by weakening the Backend fail-closed controls.

## Gate D — deployment and seven-organ integration

**Source state:** the six runtime pins in `contracts/sources.lock.json` were checked against the current `main` HEADs on 2026-11-25 and match: Backend `bd7a5ce1ca59089f3ea57740fa83f4cdd30a0189`; Data Centre `8bc8b86d5ad718bb0d4820a832c301602c2021bf`; CDN `8b8b7212741f81d98216c4f79cde95ebccfe2f97`; Flutter `8ba79ffb45e142978f420652927d70f8ed8257cb`; Federation `cbd9f2587f8d7ce0703c4123c9c2a9bd76bb51ca`; Algorithm `da83f146b90cf852838fbacc96a5f4dae876e9d6`. Backend mainline validation, PostgreSQL integrations, staff WebAuthn tests and vulnerability scan passed on the inspected revision. Production deployment, identity activation and native-mail diagnostic jobs were skipped because the workflow intentionally requires an explicit manual `workflow_dispatch` confirmation; this is a safeguard, not a failed test. A Flutter Pages deployment succeeded for its recorded commit. None of these facts establishes that all runtime organs are deployed compatibly or reachable.

Required evidence for one coordinated staging release:

- [ ] Refresh `contracts/sources.lock.json` to exact reviewed mainline commits for all six runtime repositories; verify each declared source path exists.
- [ ] Record immutable image digests and deployed source SHAs for Backend, Data Centre, Algorithm, Federation and CDN, plus Flutter web release SHA.
- [ ] Run public/private OpenAPI, route inventory, generated SDK, schema and compatibility checks against those exact pins.
- [ ] Verify every service edge has explicit provider/consumer, version, directional auth, timeout, bounded retries, idempotency and error mapping.
- [ ] Exercise Flutter → Backend native signup/login/session/feed/post/profile/notification/media journeys.
- [ ] Exercise Backend → Algorithm ranking and prove Backend rechecks visibility, blocks, moderation and membership after ranking.
- [ ] Exercise Backend ↔ Federation signed ingress, replay protection, durable inbox/outbox, deduplication, SSRF controls and an independent Mastodon-compatible peer. Keep public federation disabled if any required test fails.
- [ ] Exercise Backend ↔ Data Centre media upload, verification, independent object read-back, checksum, repair, deletion and restore using designated staging buckets only.
- [ ] Exercise Backend → CDN → origin → object storage for public/private authorization, viewer assertion expiry/revocation, range/HEAD, cache isolation, purge and deletion.
- [ ] Restore a complete off-host backup into an isolated environment and verify database, media bytes, ledger/outbox, federation state and key operational metadata.
- [ ] Verify monitoring, alerting, rate limits, security audit, incident rollback and restore procedures.
- [ ] Verify the production workflow requires explicit manual confirmation and that PR/push events cannot execute production deployment.
- [ ] Perform a coordinated, manually approved production rollout only after staging acceptance; record smoke tests and rollback evidence.

**Release rule:** no production promotion while any runtime organ is represented by an unverified pin, skipped deployment, missing service credential, unverified DNS route or untested data migration.

## Evidence record

For every checkbox, attach:

- repository and immutable source SHA;
- workflow/run URL or reproducible command and environment;
- test timestamp and result;
- relevant sanitized logs/response IDs;
- operator/approver and rollback reference where production-impacting.

Never attach secrets, raw identity evidence, private keys, refresh tokens, message plaintext or unredacted personal data.

## Current release decision

**NOT ACCEPTED FOR FULL PRODUCTION.** The merged code provides important foundations and fail-closed protections, but the live email, identity intake, actual E2EE implementation and coordinated seven-organ deployment gates remain incomplete. The release decision changes only when the evidence above is attached and independently reviewed.


## 6. Identity intake implementation review (2026-11-25)

The current Backend implementation and Flutter identity client were inspected directly. The following controls are present in source and should be retained:

- Backend registration rejects requests unless staff WebAuthn readiness and its live prerequisites are ready; PostgreSQL and private Data Centre evidence storage must also be configured and healthy.
- Registration requires configured Terms and Privacy versions, an adult declaration, explicit acceptance flags, a 256-bit-class idempotency capability (43 URL-safe characters), bounded request bodies, and IP/email rate limits.
- Idempotent retries are serialized with a transaction-scoped PostgreSQL advisory lock; reuse of the same capability with different application details is rejected.
- Identity evidence is owned by the private Data Centre media service. There is no Backend-local object-store fallback. Evidence is not considered protected until replication status, digest, size, and content type match.
- Flutter validates that upload reservations resolve only to the configured HTTPS Backend origin, with the expected path, method, metadata and short expiry. It does not follow a server-provided object-store URL.
- Recoverable Flutter drafts are stored in secure storage and exclude passwords, native access/refresh tokens, raw evidence bytes and evidence object URLs.

These source-level controls are not production proof. Remaining identity acceptance work: review every status/expiry/revocation/deletion transition; verify the actual Data Centre service's authorization binding, short-lived grants, object immutability, audit trail, deletion propagation and backup exclusion; run the full staging flow with two distinct WebAuthn staff identities; verify atomic account provisioning, email verification, login, refresh rotation, logout, recovery and duplicate/replay handling; and complete jurisdiction-specific legal review of the currently marked draft Terms and Privacy text. Public intake remains disabled until those checks pass.

## 7. Change control and next implementation sequence

1. Keep 503/closed gates for unapproved E2EE, unready identity review, and unverified mail/deployment dependencies.
2. Land isolated, test-backed changes in their owning runtime repository; update API contracts and source pins only after runtime changes are reviewed and merged.
3. Run unit, integration, security, contract, cross-organ staging and rollback tests on exact pinned SHAs.
4. Require an authorized operator to execute the protected production workflow manually and attach real provider/network evidence. Never synthesize successful DNS, mail delivery, identity review or deployment results.
5. Promote only after all gates above are evidenced; retain rollback and feature-disable paths.

No secrets, provider credentials, production configuration, feature flags, migrations, account records, or deployments were changed by this review.
