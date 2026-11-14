# Seven-repository production acceptance gates

Purpose: one product-level release gate for Testagram. Repository CI is necessary but never sufficient. A capability is accepted only when provider, consumer, deployment configuration and end-to-end evidence agree on the same immutable revisions.

## Release decision rules

- Never award 10/10 or production-ready status from README claims, route registration, unit tests alone, or a green workflow on a different commit.
- Record repository, exact commit SHA, environment, workflow/run URL, result, timestamp and reviewer for every acceptance item.
- Keep P0 security and data-integrity gates blocking. Never weaken fail-closed behavior to make a smoke test pass.
- Do not merge superseded branches. Rebase follow-up work onto current default branches and preserve immutable source pins.
- Production changes require a backup/rollback plan and explicit deployment approval.

## Product-level acceptance matrix

| Domain | Required evidence | Pass condition | Current evidence status |
|---|---|---|---|
| Architecture and ownership | Service registry, data ownership, dependency graph and trust boundaries | One canonical owner for identity, posts, authorization, storage lifecycle and ranking; private services are not publicly exposed | Architecture documented; live topology needs verification |
| Backend and social | Authenticated integration tests for signup/session, profiles, feed, posts, replies, reactions, follows, blocks and pagination | Correct authorization and stable DTO/error behavior on deployed Backend; writes are idempotent | Core slices implemented; full journey not accepted |
| API contracts | Provider/consumer conformance, immutable source pins, schemas and negative tests | Every consumed route has exact request/response/error/auth semantics; no undocumented drift | Data Centre drift and missing typed client documented |
| Identity and provisioning | Application/session/evidence/reviewer/two-person approval tests | Evidence stays private; reviewer authorization enforced; decisions audited; provisioning idempotent; clean registration/login succeeds | Runtime acceptance outstanding |
| Storage and recovery | Isolated B2 primary/R2 replica round-trip, checksums, primary restore, deletion, retry, crash/restart and migration tests | Bytes and metadata reconcile; restore is checksum-verified; deletion is durable and idempotent | Live lifecycle workflow must be executed |
| CDN and media | Backend-authorized public/private delivery, wrong-user/wrong-object/revoked-session tests, no-store/cache checks, range/HEAD, origin outage and purge | Backend decides visibility; CDN cannot mint access; private bytes never enter shared cache; failures deny safely | Go source has safer viewer-forwarding path; deployed Backend validation and R2 Worker parity unverified |
| Algorithm | Candidate-bound ranking, malformed/duplicate/foreign ID rejection, timeout/fallback and staging traffic | Ranker returns only submitted candidate IDs; Backend rechecks visibility and hydrates canonical records | Interface implemented; staging acceptance pending |
| Federation | Inbox signature/replay, durable cursor restart, idempotent inbox, Follow/Undo, outbox fan-out, projection and Mastodon/GoToSocial interoperability | No public delivery until workers, consent, fan-out, retries, observability and interoperability pass | Partial implementation; public delivery gated |
| Flutter | Physical Android clean install, registration, verification, login, profile, post, upload, retrieval, interaction, logout/login | Full journey passes against staging; failures recover; no internal credentials/hosts in app | Physical-device journey unverified |
| Production operations | VPS/container inventory, health/readiness, alerts, backup/restore, migrations, secret rotation, rollback and load tests | Services healthy; alerts tested; recovery RTO/RPO measured; deployment reproducible | Operational evidence incomplete |

## Mandatory end-to-end journeys

### A. New user to published post

1. Install a clean Android release-candidate build.
2. Register using the supported email flow and verify the email.
3. Complete native identity review and two-person approval where policy requires it.
4. Redeem provisioning exactly once and create the canonical Backend account.
5. Log in; verify Appwrite JWT acceptance and Backend user mapping.
6. Create a profile, publish an idempotent text post, refresh the feed and confirm exactly one canonical post.
7. Exercise replies, reactions, follows, logout and login persistence.

### B. Private media lifecycle

1. Backend authorizes upload intent and quota.
2. Upload to configured private storage; verify size, content signature and SHA-256.
3. Complete and attach media through authorized product operations.
4. As owner, fetch the private object; as unrelated user and anonymous viewer, verify denial.
5. Revoke visibility/delete the post and verify access is denied within the documented consistency window.
6. Confirm CDN returns private, no-store, bypasses shared cache, preserves byte ranges and never serves stale bytes after authorization failure.
7. Restore a missing/corrupt B2 primary from a verified R2 replica and prove checksum equality; exercise durable deletion and retry.

### C. Service-to-service integration

1. Backend calls Algorithm with a bounded candidate set; rejects foreign, duplicate or malformed result IDs and rechecks canonical authorization.
2. Backend calls Data Centre with the pinned typed client and exact provider contract; test unauthorized, forbidden, not found, conflict, rate limit, 5xx, timeout and malformed response behavior.
3. Federation remains private until inbox/outbox processors and delivery workers pass restart, replay, idempotency, consent and interoperability tests.
4. CDN and Backend prove public and private visibility paths against the deployed origin, including credential rotation and origin outage.

### D. Production operations and recovery

1. Capture read-only inventory of VPS, Compose projects, containers, image digests, health, restart counts, resource use, disk and network state.
2. Verify alerts by inducing a controlled non-production failure; do not test restart automation against production without an approved recovery procedure.
3. Take encrypted database and object-store backups; restore into an isolated environment and verify row/object counts and checksums.
4. Run forward-only migrations against a restored copy first; record rollback or forward-fix strategy.
5. Measure load, latency, error rates, saturation and recovery time; do not claim capacity from architecture targets alone.

## Evidence record

For every gate attach repository and exact commit SHA for every participating service; environment identifier; workflow URL/run ID or signed test report; test case and expected result; actual result, logs/metrics correlation IDs and timestamp; reviewer and explicit pass/fail/blocked decision; and rollback/remediation issue when not passed.

## Current release decision

NOT ACCEPTED. This control document is not evidence that any gate has passed. Production-ready status requires current, reviewable evidence for every P0 gate and every mandatory end-to-end journey.
