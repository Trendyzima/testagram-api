# Locked seven-repository end-to-end acceptance

**Status: LOCKED — acceptance criteria are stable; execution is not yet accepted.**  
**Locked on:** 2026-11-18  
**Tracking issue:** https://github.com/Trendyzima/testagram-api/issues/96  
**Control plane:** `Trendyzima/testagram-api` (contract/build-time only; not a runtime service)

This document freezes the release gates and evidence standard for Testagram's seven repositories. It does not authorize production deployment, DNS changes, secret rotation, database migrations, provider writes, account registration, or feature-flag activation.

## 1. Seven-repository topology

There are **six runtime repositories plus one contract-governance repository**:

| Repository | Sole responsibility | Runtime boundary |
|---|---|---|
| `Trendyzima/testagram-flutter-client-` | Flutter web/mobile UI and native session client | Public HTTPS Backend API and canonical CDN URLs only |
| `Trendyzima/Testagram-backend-` | Canonical identity, sessions, PostgreSQL product data, authorization, API and orchestration | Public client ingress; private Algorithm, Federation, Data Centre and trusted CDN origin |
| `Trendyzima/Testagram-data-centre-` | Private infrastructure, storage/media lifecycle, replicas, node operations and backup | Private platform/media network and object providers |
| `Trendyzima/the-algorithm` | Stateless ranking of bounded Backend-authorized candidate IDs | Private Backend ranking request only |
| `Trendyzima/federated-content` | ActivityPub/AT Protocol adapters and protocol state | Private Backend contracts and explicitly enabled remote peers |
| `Trendyzima/cdn-` | Go media delivery, cache, ranges, HLS transport and trusted origin relay | Public media ingress and authenticated Backend origin |
| `testagram-api` | OpenAPI, internal contracts, schemas, SDKs, route inventory, source pins and compatibility CI | Build/contract/release governance only; never a runtime hop |

Backend + PostgreSQL remain the sole authority for Testagram users, sessions, canonical product records, media ownership, visibility, moderation, quota, retention and deletion. Data Centre owns storage mechanics, not product authorization. CDN transports bytes, not access decisions. Algorithm orders candidates, not product records. Federation owns protocol state, not local identity or canonical posts.

**Project boundary:** Testagram-only branding and architecture. Do not add Supabase or XClone as runtime components, dependencies, products, repositories or branding. Historical material must be clearly isolated as historical and must never be a live runtime fallback.

## 2. Immutable baseline

The six runtime source pins are recorded in `contracts/sources.lock.json`; all declared source paths were checked against their immutable Git trees. The Backend pin intentionally targets the native-auth retirement candidate in PR #424 so the API bridge audits the code that removes the legacy runtime instead of the superseded mainline. The other five pins target their latest observed mainline revisions; intervening changes are documented boundary/negative-fixture cleanups. This is an integration-review source baseline, not a deployment attestation. Backend PR #423's social-platform schema foundation is included in the retirement candidate; its migration is source evidence, not proof that production has applied it.

| Repository | Baseline commit |
|---|---|
| Flutter | `1f58971720c7a72139d56900a5895c49fa105639` |
| Backend | `54c7a6c3218aa85c83cfcde0570d2673678e26bc` (PR #424 candidate) |
| Data Centre | `58de0bf36b76f9cd74824901b6a86de29f420c65` |
| Testagram API control plane | `201fd3335c737e7fe36ed34dfa1ec07b03c31047` |
| Algorithm | `92cf9b47e4de38306c4fe7b61ece24c3e075aa22` |
| Federation | `3707d9a3f4e4222c23aecb8a97afbaeec45d3c5d` |
| CDN | `490119514788c13c327ee05eb4ce068a0f73966e` |

A source pin is not a deployment record. Every accepted staging and production run must separately record the actual running image digest and source revision. Mutable tags such as `main` and `latest` are not acceptable release identities.

## 3. Locked acceptance gates

A gate passes only with a reproducible test against the exact deployed build and environment. Static inspection, unit tests, successful image publication, healthy process liveness, or a merged PR alone cannot pass an end-to-end gate.

### G0 — Source, contract and build integrity

- All seven repository heads used by a release are immutable and recorded.
- The six runtime source pins in `contracts/sources.lock.json` match the reviewed provider commits; all pinned source paths exist.
- Provider OpenAPI/event snapshots match their pinned provider source byte-for-byte.
- Public and private OpenAPI lint, generated SDK build, typecheck, unit tests, Backend route inventory and cross-repository contract audits pass.
- Every cross-service edge has a named provider, consumer, version, authentication direction, request/response schema, timeout, error mapping and idempotency rule.
- The API governance repository remains build-time only.

**Fail if:** any source pin drifts, a route is registered but represented as fully supported without handler evidence, a snapshot is stale, private routes enter public OpenAPI/SDKs, or a consumer/provider contract differs.

### G1 — Flutter → Backend native identity and user journey

- Flutter uses only the Testagram-native Backend login/refresh/recovery/session path. No external identity-provider endpoint, SDK, JWT, database, server key, session, or fallback is permitted in the supported runtime.
- Access JWTs remain short-lived and in memory; only opaque rotating refresh tokens are stored in platform secure storage.
- Backend validates signature, issuer, audience, expiry, token version, session ID, canonical user ID, live PostgreSQL session, account state and verification/provisioning state.
- Exercise registration only through the approved staging provisioning process, email verification, login, refresh rotation, logout, logout-all, password recovery and session restoration.
- Exercise authenticated profile read/update, post create/read, feed retrieval, media grant retrieval and denial for expired/revoked/foreign credentials.
- Verify web and Android builds on real browsers/devices; prove no service token, storage key, private host, or database credential is bundled into the client.

**Fail if:** any request, build, runtime container, environment contract or client SDK depends on an external identity provider; any provider token is accepted; or native session checks can be bypassed.\n\n**Fail if:** identity is inferred from email equality, a revoked/expired/wrong-audience token is accepted, a refresh token is replayable, the client calls a private service directly, or user data is lost across refresh/logout/restore.

### G2 — Backend → Algorithm ranking

- Backend calls private `POST /v1/feed/rank` with its dedicated service credential, API version and request ID.
- Request contains at most 200 candidates; requested result limit is at most 50; feed mode matches the published enum.
- Algorithm returns only unique IDs from the submitted candidate set and bounded valid scores/reason codes.
- Test absent/wrong service token, malformed JSON, duplicate/foreign IDs, oversized candidate set, timeout, 5xx, process restart and ranker unavailability.
- Backend rehydrates canonical records and rechecks blocks, privacy, moderation, follow policy and visibility after ranking.
- Ranking outage follows the explicit safe chronological fallback; ranking must never widen access.

**Fail if:** ranker can fetch arbitrary posts, create/authorize product data, return foreign IDs, or a timeout yields an empty/success response that hides the failure.

### G3 — Backend ↔ Federation private trust and protocol acceptance

- Backend → Federation uses its dedicated ingress credential; Federation → Backend uses a separate credential. Each has distinct audience/scope and independent rotation.
- Verify private DNS/network reachability, version headers, request IDs, idempotency keys and bounded timeouts.
- Verify Backend post transaction and outbox event are atomic; Federation acknowledges only after durable acceptance; duplicate activity IDs are idempotent.
- Test actor eligibility, account suspension/deletion, consent, protected/followers-only/direct visibility and stale remote state.
- Before enabling public workers, prove inbound HTTP Signature verification, key ownership/rotation, digest/date handling, replay protection, SSRF controls, durable inbox, supported activity projection, Follow/Undo, recipient deduplication/fan-out, bounded retry, dead-letter inspection and operator replay.
- Run interoperability against at least one independent Mastodon-compatible ActivityPub peer. AT Protocol/DID/lexicon/feed-generator acceptance is a separate protocol gate and cannot be inferred from ActivityPub.

**Fail if:** Federation can create a local account or canonical post, bypass Backend authorization, accept unsigned/replayed inbound activity, or mark a non-durable activity as accepted. Public federation remains disabled until the full gate passes.

### G4 — Backend ↔ Data Centre private platform and media lifecycle

Treat the platform API and media lifecycle API as separate interfaces; do not claim the five media routes prove the broader platform contract.

- Prove Backend's typed platform client (or explicitly mark the platform edge unsupported); match every consumed platform route to provider handler, auth, schema, status code and tests.
- For media, exercise the five private routes: `upload-url`, `verify`, `status`, `download-url`, and `delete` under `/internal/v1/media/*`.
- Confirm the media service is attached to the Backend-owned private network, has no public host port, uses its separate media database, and accepts only its dedicated service token plus API version.
- Treat the Backend native virtual-storage path and the Data Centre dedicated media service as two distinct lifecycle implementations; never combine their receipts or call one a substitute for the other.

  **Backend three-provider media path:** Backend's canonical media metadata/replica ledger and `internal/virtualstorage.Replicator` use Instabox VPS MinIO as the primary media-byte store and Cloudflare R2 + Backblaze B2 as two independent media-byte replicas. Run the guarded `TestLiveMediaReplicationLifecycle` against dedicated staging buckets for private, public and identity-evidence namespaces. Verify actual PUT, independent GET/size/SHA-256 at all three stores, MinIO-primary restoration from a verified surviving replica, missing-R2 repair, same-size B2 corruption repair, tombstone deletion from all three stores, and no ready/public state before all required receipts match.

  **Data Centre dedicated media path:** the optional `media` Compose profile uses a separate `MEDIA_DATABASE_URL` and durable outbox, with B2 as media-byte primary and R2 as media-byte replica. Its MinIO + R2 sidecars are metadata mirrors only, not a third media-byte copy. Run the guarded Data Centre `TestLiveMediaReplicationRestoreDelete` workflow to verify actual B2/R2 PUT, GET, HEAD, size/content-type/SHA-256, primary restore, replica repair, retry and deletion. Then exercise Backend's five private routes: `upload-url`, `verify`, `status`, `download-url`, and `delete` through the typed client.

- For both paths, use only explicitly designated staging buckets. Verify signed upload expiry/content type/size limits, durable receipt, destination read-back, reconciliation, retry after process/worker interruption and deletion tombstones. Never treat a successful PUT, ETag, metadata sidecar, or CDN cache entry as a verified media-byte copy.
- Keep Backend `MEDIA_REPLICATION_ENABLED` and `FRESH_MEDIA_ENABLED` disabled until their respective staging paths pass; the Data Centre media profile must not be started against production providers as a substitute for staging acceptance.
- Exercise provider outage, partial replication, duplicate completion, expired upload grant, delete retry, stale metadata and worker restart for each implementation separately.

**Fail if:** a successful PUT is treated as replication, ETag is treated as SHA-256, a one-copy object becomes ready, a provider credential reaches Flutter/CDN, or Data Centre becomes the product authorization authority.

### G5 — Backend → CDN → origin → object storage

- Verify canonical media host ownership and that the Go CDN is the only viewer-facing delivery path for its assigned hostname.
- CDN origin authentication and Backend viewer assertions are separate credentials with separate audiences and rotation.
- Public cache miss: Backend confirms canonical asset status is ready and visibility is public before CDN can cache.
- Private media: Backend validates the current viewer and issues a short-lived object/viewer-bound assertion. CDN relays it to Backend origin using a separate CDN origin credential. Raw user JWT is never forwarded to origin.
- Test missing, malformed, wrong-object, wrong-viewer, expired and revoked assertions; wrong origin credential; authorization denial; origin redirect; origin outage; deletion and visibility change.
- Verify private responses bypass all shared caches and return no-store; verify public cache headers and purge-before-delete/visibility-change.
- Exercise GET, HEAD, byte ranges, conditional requests, content length/type, cache isolation and no stale private response after origin outage.
- HLS is a separate acceptance: manifests, init fragments, segments, keys, token expiry/refresh, range and player behavior must all be authorized. Do not re-enable legacy playback proxy or arbitrary URL passthrough.

**Fail if:** a public object is inferred from key prefix, private bytes enter a shared cache, CDN accepts a missing viewer assertion for private content, CDN origin credential doubles as viewer authorization, or a provider fallback bypasses Backend.

### G6 — Coordinated off-host backup and restore

- Produce a consistent backup set covering canonical Backend PostgreSQL and its three-provider replica ledger, the separate Data Centre `MEDIA_DATABASE_URL` ledger/outbox when that profile is enabled, actual MinIO/R2/B2 media bytes for the Backend path, actual B2/R2 media bytes for the Data Centre path, Federation protocol/outbox/inbox/cursor state, and required deployment/configuration material.
- Secrets/private keys must be backed up through the approved encrypted recovery process; never place raw secrets in artifacts or logs.
- Restore to isolated infrastructure, not over production.
- Verify database integrity and migration state, account/session revocation semantics, representative object bytes/checksums, public/private authorization, deletion tombstones, Federation cursor/delivery idempotency and all service readiness.
- Record backup timestamp, restore timestamp, measured RPO/RTO, checksums, key recovery, restore ordering, failed-step handling and rollback/forward-recovery instructions.
- Perform a second restore from the restored backup or otherwise prove the backup itself is independently readable and complete.

**Fail if:** only a PostgreSQL dump is restored, objects are missing, metadata points to absent objects, private authorization changes, Federation replays duplicate side effects, or restore is tested destructively on production.

### G7 — Public routing, edge security and runtime deployment

- Resolve one canonical apex/www behavior and make Cloudflare, Caddy, Pages and smoke tests agree.
- Validate distinct API, media, web and federation hostnames, TLS, DNS ownership, origin hostname and certificate behavior.
- Confirm no competing Cloudflare Worker route owns the Go CDN's viewer-facing hostname.
- Enable trusted Cloudflare client-IP headers only when the origin network admits traffic exclusively from trusted Cloudflare paths.
- Deploy exact pinned immutable images to staging and capture source SHA, image digest, config version, health/readiness, network topology and deployment timestamp.
- Run external HTTP checks and authenticated functional probes. Process liveness alone is insufficient.
- Run rollback rehearsal using the last accepted immutable image set.
- Promote the exact accepted staging artifacts to production only after explicit approval, then repeat production probes and functional journeys.

**Fail if:** a hostname routes to the wrong origin, a direct-origin bypass defeats edge controls, the running digest is unknown, deployment uses a mutable tag, or a failed smoke is waived without root-cause resolution.

## 4. Execution order and release decision

1. Refresh source pins and provider snapshots; pass G0.
2. Deploy a fully isolated staging topology with distinct staging secrets and buckets.
3. Pass G1 identity and user journeys.
4. Pass G2 ranking and G3 private federation ingress; keep public federation disabled until its extended protocol acceptance is complete.
5. Pass G4 media/platform and G5 CDN/origin.
6. Pass G6 coordinated restore.
7. Pass G7 routing, failure injection, monitoring and rollback.
8. Freeze accepted image digests and produce a signed/evidence-linked release manifest.
9. Obtain explicit production approval, deploy the same artifacts, and repeat public/functional probes.

**Release rule:** any failed or unexecuted P0 gate means NOT ACCEPTED. A staging pass does not automatically approve production. Production activation flags remain at their reviewed safe values until their own gate has passed.

## 5. Evidence record required for every test

Each result must contain:

- Gate and test-case ID.
- Repository and exact source commit for each participant.
- Exact image digest for every deployed participant.
- Environment identifier (staging or production), not secret values.
- Workflow URL/run ID and/or signed test report.
- Timestamp, request/correlation IDs and sanitized logs.
- Expected result and actual result, including HTTP status and response schema where relevant.
- Provider/object IDs and SHA-256 where media is involved (never credentials).
- Reviewer, pass/fail/blocked status, defect link and rollback/repair action.

No test may report PASS if it ran against an unpinned or unknown build.

## 6. Initial verified position at lock time (2026-11-18)

- Backend, Data Centre and Testagram API CI runs were observed green on their reviewed commits; Algorithm tests and image publication and Federation CI/image publication were observed green. These are repository-level results, not live inter-service acceptance.
- Backend's InstaBox deployment workflow validated inputs but its actual deployment job was skipped pending explicit dispatch confirmation.
- Flutter's scheduled domain smoke failed because apex returned HTTP 200 where the workflow requires HTTP 308 to www; www shell probes succeeded in that run.
- CDN's canonical-host routing workflow failed during preflight; no Cloudflare cutover was reached.
- Backend native virtual storage has a three-provider MinIO/R2/B2 media replicator and live lifecycle test; the existing provider workflow did not yet invoke that media test. A guarded invocation is proposed in Backend PR #359 and has not yet produced live staging evidence.
- Data Centre's separate media profile is a B2-primary/R2-replica byte lifecycle with MinIO/R2 metadata sidecars only. It has a separate media database and outbox; it is not the third copy in Backend's MinIO/R2/B2 pipeline. Its guarded B2/R2 smoke has not been run against staging buckets.
- Algorithm service authentication and Federation private ingress have source-level contract coverage; deployed service-to-service staging acceptance remains unproven.
- Federation public inbound projection/fan-out/interoperability and HLS acceptance remain gated.
- At the initial lock, the source registry had Data Centre pinned 35 commits behind its then-current main. That earlier drift was addressed in the preceding source-refresh work; the subsequent native-auth merges required the additional six-repository baseline refresh recorded in Section 7.


## 8. Required CI execution for this refreshed baseline

The API contract validation workflow must execute the same full sequence on this PR head:

1. `npm run sources:checkout` — sparse-checkout each immutable runtime pin using only active source directories; no retired runtime source is checked out.
2. `npm run lint:openapi` and `npm run lint:internal-openapi`.
3. `npm run typecheck`, `npm run build:sdk`, and `npm test`.
4. `npm run audit:backend-routes`, `npm run audit:cross-repo`, `npm run audit:locked-acceptance`, `npm run audit:tv-health-contract`, and `npm run audit:flutter-backend`.
5. Flutter validation: `dart format .`, `dart analyze`, and `dart test`.

The cross-repository audit must prove that every listed source path exists at its pinned commit, all checkouts resolve to the exact lock SHA, all provider snapshots match their pinned source files, and the Backend/Data Centre media and service-auth contracts remain aligned. A successful workflow on an earlier source-pin set does not satisfy this PR.

## 7. Post-merge verification — 2026-11-18

The following native-identity integration changes are now merged:
- Backend PR #360 — dedicated Data Centre identity-evidence bridge and staging auth acceptance workflow.
- Data Centre PR #93 — private identity-evidence namespace, separate service credential and B2/R2 lifecycle smoke.
- Testagram API PR #99 — native bearer authentication contract alignment.
- The current source baseline above is refreshed to the six runtime repositories' observed `main` heads. The five provider OpenAPI/event snapshots were compared with their current provider source files and are byte-identical.

Observed CI evidence on the merged integration commits:
- Backend CI run `44376987763`, self-hosted stack validation `44376987767`, Go security checks `44376987832`, and container publication `44376987881` completed successfully.
- Backend deployment workflow run `44376987784` completed its input-validation job, but the actual `Deploy backend and private services` job was **skipped**. This is not deployment evidence.
- Data Centre PR #93 CI and API PR #99 contract CI passed on their reviewed PR heads; these results do not substitute for the refreshed source-pin audit on this control-plane PR.

Still unexecuted or blocked:
- The Backend native-auth staging smoke has not been dispatched. It requires the dedicated GitHub `staging` environment origin and test-account secrets, plus explicit staging-only confirmation.
- The Data Centre live provider smoke has not been dispatched. It writes and deletes temporary objects and requires explicitly designated staging B2/R2 buckets and the manual confirmation input.
- The Backend three-provider MinIO/B2/R2 lifecycle and the Data Centre B2/R2 lifecycle remain separate acceptance paths; neither has live end-to-end evidence recorded here.
- The Backend retirement candidate now implements real WebAuthn registration/assertion ceremonies, credential encryption, challenge expiry/replay protection, and Backend-issued MFA elevation. Staff-review production activation remains gated until the live Admin Console-to-Backend readiness handshake, independent enrollment, deployed credential ceremony, replay rejection and protected-action elevation pass against the production-like PostgreSQL stack.
- Public registration, media replication, Federation delivery, CDN domain cutover and production feature activation remain subject to their individual gates and explicit approval.

**Decision: NOT ACCEPTED for end-to-end staging or production until all required gates have passing evidence.** Merged branches and green repository CI do not waive the live integration, restore, security or deployment gates.

### Temporary immutable review pins for the open integration PRs

The following source pins are intentionally temporary review baselines for open provider pull requests. They identify immutable commits, not merged mainline or deployed releases. After the provider PRs merge, refresh `contracts/sources.lock.json`, this document's baseline table, and all source snapshots to the resulting merged mainline SHAs before release acceptance.

| Repository | Review PR | Immutable review commit |
|---|---|---|
| Backend | [PR #424](https://github.com/Trendyzima/Testagram-backend-/pull/424) | `54c7a6c3218aa85c83cfcde0570d2673678e26bc` |
| Algorithm | [PR #27](https://github.com/Trendyzima/the-algorithm/pull/27) | `88b2ae0eb81e127768aaf4ef1ed19495ce6fda20` |


## 9. Federation source-pin reconciliation — 2026-11-21

Federated Content PR #50 (pgx dependency security/reliability update) was merged to `main` at `b44eca07a9c7641cf03ee685c025bcfe6dfc7858`. Both post-merge checks (`test` and `image`) completed successfully on that exact commit. The current federation source pin in `contracts/sources.lock.json` and the seven-organ registry is refreshed to this merge commit; PR #50 is recorded in the registry's merged pull-request history. This source refresh is not live federation deployment or protocol acceptance evidence.


## 10. Native MFA revocation and WebAuthn configuration hardening — 2026-11-21

The Backend review pin now includes credential-bound MFA elevation and shared WebAuthn RP configuration attestation. Every privileged identity-review request and Admin Console sensitive action rechecks the exact authenticator used for step-up against PostgreSQL; revoked, unverified or clone-warned credentials invalidate outstanding elevation immediately. The Backend and Admin Console compare a canonical fingerprint of the configured RP ID and allowed origins; mismatches fail readiness closed. Regression tests cover the token binding, revocation, fingerprint mismatch and canonicalization. This remains source/CI evidence only: the live browser authenticator ceremony, recovery, and production origin have not yet been accepted.


## 11. Seven-organ source-pin refresh — 2026-11-21

The bridge records four runtime organs at their latest merged mainline revisions and separately pins Backend PR #424 and CDN PR #125 as immutable review candidates. Their actual mainline SHAs remain recorded independently in the seven-organ registry. The API Control Plane remains a governance repository and is not a runtime organ dependency.

| Organ | Repository | Locked source revision | Integration status |
|---|---|---|---|
| Flutter client | `Trendyzima/testagram-flutter-client-` | `1f58971720c7a72139d56900a5895c49fa105639` | Mainline; PRs #112 documentation cleanup and #113 retired-provider test-label cleanup merged |
| Backend | `Trendyzima/Testagram-backend-` | `54c7a6c3218aa85c83cfcde0570d2673678e26bc` | Temporary native-auth review candidate; PR #424 remains open |
| Data Centre | `Trendyzima/Testagram-data-centre-` | `58de0bf36b76f9cd74824901b6a86de29f420c65` | Mainline; PR #112 boundary documentation and PR #113 negative-issuer fixture cleanup merged |
| CDN | `Trendyzima/cdn-` | `d2fc2af2248581cafe4b64a8cb4f654732d66962` | Temporary guarded API-domain handoff candidate; PR #125 CI green, mainline remains `490119514788c13c327ee05eb4ce068a0f73966e` |
| Algorithm | `Trendyzima/the-algorithm` | `92cf9b47e4de38306c4fe7b61ece24c3e075aa22` | Mainline; PRs #28 and #29 ownership documentation merged |
| Federation | `Trendyzima/federated-content` | `3707d9a3f4e4222c23aecb8a97afbaeec45d3c5d` | Mainline; PR #51 native boundary documentation merged |
| API Control Plane | `Trendyzima/testagram-api` | `201fd3335c737e7fe36ed34dfa1ec07b03c31047` | Governance-only mainline; this bridge remains an open candidate PR |

The four refreshed mainline pins were compared with their previous locked revisions. The intervening changes were confined to documentation and negative-test-fixture cleanup and did not alter runtime source paths or provider snapshots. Backend and CDN candidate commits are intentionally not described as merged mainline revisions. Once PRs #424 and #125 merge, refresh both pins to their exact merge SHAs and regenerate all relevant route/source evidence before accepting the integration.

This source refresh fixes source-pin drift; it does not prove deployed interoperability. The exact contract CI run on this refreshed baseline must pass before the bridge is merge-ready.

## 11. Seven-organ wiring and provider-residue verification — 2026-11-21

API contract CI run `44896464421` passed both Node and Dart validation against the current bridge candidate. The bridge checker now requires the exact six approved runtime edges and six governance edges, rejects duplicate/missing/extra edges, checks each repository's exact owner/name, and rejects duplicate or path-traversing entries in immutable source inventories.

The cross-organ audit verified:
- Flutter-to-Backend native access/refresh/session boundary and the prohibition on direct private-service calls
- Backend-to-Data-Centre private media contract, service-token separation, request IDs, timeout and live native-session checks on user-aware routes
- Backend-to-CDN separation of user JWT, viewer assertion, origin and purge credentials, including assertion issuer/audience/owner/expiry validation
- Backend-to-Algorithm bounded, already-authorized candidate flow
- Backend-to-Federation directional service credentials and durable ingress/outbox contract

The route inventory covers 105 static Backend routes across 50 production Go files; 67 operations are represented in OpenAPI. The native-only scan covers 418 runtime, deployment, configuration and documentation files across all six runtime organs and finds zero active external identity-provider integration.
That zero-active-integration result applies to the pinned Backend PR #424 candidate. Backend mainline is still at `287d8669df9dbfcf2ae34f6f532925ca551de4bd` and retains an unused legacy external identity-provider adapter/source path until PR #424 is independently reviewed and merged; do not describe the default branch as fully purged yet.

The exact 27 remaining historical matches are confined to migration/schema history, forward-only upgrade/cleanup migrations and their migration integration fixture, plus one negative CI guard that asserts retired provider configuration is absent. These records are intentionally retained so installations with the original migration ledger can upgrade safely and so the old schema/configuration can be explicitly rejected. They are not supported runtime code, SDKs, endpoints, credentials, session authorities or fallback paths. Deleting or rewriting applied migration history to make a text search return zero would break migration lineage and is not an acceptable production hardening step.

Flutter PR #113, which removes obsolete provider labels from negative test fixtures, is merged at `1f58971720c7a72139d56900a5895c49fa105639`. Flutter PR #100 remains a live production-routing acceptance gate; Backend PR #424 remains the temporary native-auth candidate pin pending independent review and merge. CI success is not deployment evidence.

## 12. API custom-domain handoff remains a separate CDN acceptance gate — 2026-11-21

CDN PR #125 is ready for independent review at candidate `d2fc2af2248581cafe4b64a8cb4f654732d66962`. The API Control Plane source lock temporarily pins the CDN PR #125 candidate so bridge CI validates the handoff code; the registry separately records CDN mainline `490119514788c13c327ee05eb4ce068a0f73966e` and candidate status. The candidate is not represented as merged mainline. Its Worker tests (29/29), Wrangler custom-domain validation, workflow syntax, Go tests, race detector, vet, build, runtime-image checks and capacity qualification passed. The PR has not merged and no production Cloudflare mutation or deployment has run.

The candidate requires a second explicit dispatch approval before transferring the exact `api.testagram.site` custom-domain owner from the legacy API Worker to the canonical `testagram-cdn` gateway. It removes only verified proxied A/AAAA/CNAME records for that exact hostname, verifies the new owner, and on failure recovers only to the Testagram-owned gateway. It must never reattach the legacy API Worker as a fallback.

After CDN PR #125 merges, refresh this pin to its exact merge SHA and rerun the bridge. The live hostname must then pass API health, readiness, service identity, media, apex redirect, NodeInfo and real-account WebFinger probes before the CDN organ is accepted.

## 13. Latest end-to-end production evidence — 2026-11-21

- Backend PR #424 application, PostgreSQL identity, native staff WebAuthn, dual-control, schema, security and container checks passed at its pinned candidate. Its InstaBox deployment job was skipped; no live native API deployment is evidenced. Independent review remains outstanding.
- A fresh read-only production smoke rerun still fails: `https://testagram.site/` returns HTTP 200 instead of the required 308 redirect to `www`; apex NodeInfo returns HTTP 200 HTML instead of JSON; and `acct:crissbeat@testagram.site` WebFinger returns HTTP 503. The Flutter web root, sign-in route and Pages.dev shell return HTTP 200. These are real production routing failures, not source-level contract failures.
- The API Control Plane source lock temporarily pins both Backend PR #424 candidate `54c7a6c3218aa85c83cfcde0570d2673678e26bc` and CDN PR #125 candidate `d2fc2af2248581cafe4b64a8cb4f654732d66962`. The registry separately records Backend mainline `287d8669df9dbfcf2ae34f6f532925ca551de4bd` and CDN mainline `490119514788c13c327ee05eb4ce068a0f73966e`; neither candidate is represented as merged. After either source PR merges, refresh the corresponding pin to the exact merge SHA and rerun the bridge.
- The native-only source audit reports 27 intentionally retained historical migration/schema/upgrade-fixture matches. They are not runtime integrations or fallback authorities. Do not rewrite applied migration history to obtain a misleading zero-text-match result.
- Registration and privileged staff enrollment remain fail-closed until the real browser WebAuthn ceremony, recovery/replay, production readiness and staff lifecycle gates pass.

