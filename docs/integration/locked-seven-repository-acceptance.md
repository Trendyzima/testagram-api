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

The six runtime source pins are recorded in `contracts/sources.lock.json`; all declared source paths were checked against their immutable Git trees. Backend PR #424, Data Centre PR #115 and Flutter PR #114 are pinned to their exact open review candidates. CDN pins the exact merged PR #125 commit; Algorithm and Federation pin their latest observed mainline revisions. This is an integration-review source baseline, not a deployment attestation. Backend PR #423's social-platform schema foundation is included in the retirement candidate; its migration is source evidence, not proof that production has applied it.

| Repository | Baseline commit |
|---|---|
| Flutter | `f2819268f03aa76c259e94839dd8afddc3542b69` (PR #114 candidate; mainline base `1f58971720c7a72139d56900a5895c49fa105639`) |
| Backend | `cc33913f0fd4e86669f7c717e12b2503990e6d88` (PR #424 candidate; unmerged) |
| Data Centre | `3d92c379e64fafa440eca9c81ec9edbc8007488e` (PR #115 OpenAPI candidate; mainline base `ada6f26a289775720bb47a639242dbd868388055`) |
| Testagram API control plane | `201fd3335c737e7fe36ed34dfa1ec07b03c31047` |
| Algorithm | `92cf9b47e4de38306c4fe7b61ece24c3e075aa22` |
| Federation | `4d7c26861240fae0fc8a69872dc326b3e1b2bbff` (PR #53 candidate; mainline base `3707d9a3f4e4222c23aecb8a97afbaeec45d3c5d`) |
| CDN | `21a254e9f67dc7a8e55dca37151a6db532405e53` (PR #125 merged) |

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
| Backend | [PR #424](https://github.com/Trendyzima/Testagram-backend-/pull/424) | `c627858a295fbf45b6dbdeeb54d2a5aa0a989470` |
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
| Backend | `Trendyzima/Testagram-backend-` | `c627858a295fbf45b6dbdeeb54d2a5aa0a989470` | Temporary native-auth review candidate; PR #424 remains open |
| Data Centre | `Trendyzima/Testagram-data-centre-` | `58de0bf36b76f9cd74824901b6a86de29f420c65` | Mainline; PR #112 boundary documentation and PR #113 negative-issuer fixture cleanup merged |
| CDN | `Trendyzima/cdn-` | `930f000e030fc920a749b99cae1e0c8c5c01d2b1` | Temporary guarded API-domain handoff candidate; PR #125 CI green, mainline remains `490119514788c13c327ee05eb4ce068a0f73966e` |
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

The route inventory covers 105 static Backend routes across 50 production Go files; 67 operations are represented in OpenAPI. The native-only scan covers 417 runtime, deployment, configuration and documentation files across all six runtime organs and finds zero active external identity-provider integration.
That zero-active-integration result applies to the pinned Backend PR #424 candidate. Backend mainline is still at `287d8669df9dbfcf2ae34f6f532925ca551de4bd` and retains an unused legacy external identity-provider adapter/source path until PR #424 is independently reviewed and merged; do not describe the default branch as fully purged yet.

The exact 27 remaining historical matches are confined to migration/schema history, forward-only upgrade/cleanup migrations and their migration integration fixture, plus one negative CI guard that asserts retired provider configuration is absent. These records are intentionally retained so installations with the original migration ledger can upgrade safely and so the old schema/configuration can be explicitly rejected. They are not supported runtime code, SDKs, endpoints, credentials, session authorities or fallback paths. Deleting or rewriting applied migration history to make a text search return zero would break migration lineage and is not an acceptable production hardening step.

Flutter PR #113, which removes obsolete provider labels from negative test fixtures, is merged at `1f58971720c7a72139d56900a5895c49fa105639`. Flutter PR #100 remains a live production-routing acceptance gate; Backend PR #424 remains the temporary native-auth candidate pin pending independent review and merge. CI success is not deployment evidence.

## 12. API custom-domain handoff remains a separate CDN acceptance gate — 2026-11-21

CDN PR #125 is ready for independent review at candidate `930f000e030fc920a749b99cae1e0c8c5c01d2b1`. The API Control Plane source lock temporarily pins the CDN PR #125 candidate so bridge CI validates the handoff code; the registry separately records CDN mainline `490119514788c13c327ee05eb4ce068a0f73966e` and candidate status. The candidate is not represented as merged mainline. Its Worker tests (29/29), Wrangler custom-domain validation, workflow syntax, Go tests, race detector, vet, build, runtime-image checks and capacity qualification passed. The PR has not merged and no production Cloudflare mutation or deployment has run.

The candidate requires a second explicit dispatch approval before transferring the exact `api.testagram.site` custom-domain owner from the legacy API Worker to the canonical `testagram-cdn` gateway. A separate post-cutover cleanup workflow then requires its own explicit confirmation and deletes only the detached `testagram-api` Worker after verifying the canonical owner, native API health, protected/private route boundaries and absence of routes, custom domains, schedules, service bindings and tail consumers. It removes only verified proxied A/AAAA/CNAME records for that exact hostname, verifies the new owner, and on failure recovers only to the Testagram-owned gateway. It must never reattach the legacy API Worker as a fallback.

After CDN PR #125 merges, refresh this pin to its exact merge SHA and rerun the bridge. The live hostname must then pass API health, readiness, service identity, media, apex redirect, NodeInfo and real-account WebFinger probes before the CDN organ is accepted.

## 13. Latest end-to-end production evidence — 2026-11-21

- Backend PR #424 application, PostgreSQL identity, native staff WebAuthn, dual-control, schema, security and container checks passed at its pinned candidate. Its InstaBox deployment job was skipped; no live native API deployment is evidenced. Independent review remains outstanding.
- A fresh read-only production smoke rerun still fails: `https://testagram.site/` returns HTTP 200 instead of the required 308 redirect to `www`; apex NodeInfo returns HTTP 200 HTML instead of JSON; and `acct:crissbeat@testagram.site` WebFinger returns HTTP 503. The Flutter web root, sign-in route and Pages.dev shell return HTTP 200. These are real production routing failures, not source-level contract failures.
- The API Control Plane source lock temporarily pins Backend PR #424 candidate `c627858a295fbf45b6dbdeeb54d2a5aa0a989470`, Data Centre PR #114 candidate `8b61fe03eb918d352f78d1142651167b3e9fe21a`, and CDN PR #125 candidate `930f000e030fc920a749b99cae1e0c8c5c01d2b1`. The registry separately records Backend mainline `287d8669df9dbfcf2ae34f6f532925ca551de4bd`, Data Centre mainline `58de0bf36b76f9cd74824901b6a86de29f420c65`, and CDN mainline `490119514788c13c327ee05eb4ce068a0f73966e`; none of these candidates is represented as merged. After either source PR merges, refresh the corresponding pin to the exact merge SHA and rerun the bridge.
- The native-only source audit previously reported 27 intentionally retained historical migration/schema/upgrade-fixture matches. The Data Centre candidate removes its obsolete provider-name negative assertions from VPS CI, so that file no longer needs a historical-residue exception. They are not runtime integrations or fallback authorities. Do not rewrite applied migration history to obtain a misleading zero-text-match result.
- Backend PR #424 now adds a Chromium virtual-authenticator browser test for the Admin Console's actual `navigator.credentials.create()` and `navigator.credentials.get()` flows, including RP/origin/challenge checks and attestation/assertion payloads. This automated UI ceremony complements the PostgreSQL verification/replay tests; it does not replace a physical authenticator and live Backend staging ceremony.
- Registration and privileged staff enrollment remain fail-closed until the browser test passes, the live Backend ceremony/recovery/replay checks pass, and production readiness and independent staff lifecycle gates are accepted.


## 14. Current read-only production endpoint probe — 2026-11-21

A fresh read-only fetch of the public endpoints returned:
- `https://testagram.site/`: extraction returned `empty_content`; this does not establish an HTTP status or redirect.
- `https://testagram.site/.well-known/nodeinfo`: fetch timed out.
- `https://testagram.site/.well-known/webfinger?resource=acct%3Acrissbeat%40testagram.site`: HTTP 503.
- `https://api.testagram.site/healthz`: HTTP 404. This path is not established as a public health operation in the locked API contract, so it is not treated as a public acceptance endpoint.

The WebFinger 503 and NodeInfo timeout confirm federation discovery is still not production-accepted. No DNS, Worker, deployment, secret or feature-flag mutation was performed by these probes. The guarded CDN domain handoff and canonical apex/WebFinger routing remain blocked on review, staging acceptance and explicit production approvals.

## 15. Data Centre candidate cleanup — 2026-11-21

Data Centre PR #114 (`8b61fe03eb918d352f78d1142651167b3e9fe21a`) removes obsolete external-provider-name grep assertions from the VPS CI workflow. Those assertions were text-only negative checks and duplicated the API Control Plane's exhaustive native-only audit. The workflow retains the independent obsolete deployment-variable guard, Testagram Backend image assertion, native authentication configuration check, route assertions and service contract validation. No runtime code, credentials, database schema or production infrastructure changed.

The bridge pins this exact Data Centre candidate, records PR #114 as unmerged candidate evidence, and removes the workflow from the historical compatibility allowlist. The expected historical residue count is now 26; the immutable original migration files and migration-upgrade fixtures remain untouched.

## 16. Latest bridge CI and production blockers — 2026-11-21

- API Control Plane PR #116 candidate `5a9180d35bc26c2c48a2bffb700b9418d6d7a85b` passed Node and Dart CI run `44923230908`. The run verified the seven-organ manifest, six immutable runtime pins, six runtime edges, six governance edges, Flutter/API contract, 105 static Backend routes, 67 OpenAPI operations, 45 Flutter client paths, and native-only authentication audit.
- The native-only audit inspected 418 runtime, deployment, configuration and documentation files across all six runtime organs and found no active external identity-provider integration. The remaining 26 allowlisted matches are confined to immutable historical SQL migration records and the upgrade/compatibility test fixture. The Data Centre VPS CI negative-string checks have been removed in PR #114; the source pin now targets that candidate.
- Backend PR #424 candidate `c627858a295fbf45b6dbdeeb54d2a5aa0a989470` passed Backend CI, PostgreSQL identity/registration/recovery/dual-control tests, native staff WebAuthn PostgreSQL tests, Chromium virtual-authenticator UI tests, security scan, container publish and Cloudflare read-only audit. The production deploy sub-job was skipped; this is not evidence of a live deployment.
- CDN PR #125 candidate `930f000e030fc920a749b99cae1e0c8c5c01d2b1` passed Worker, capacity, CI and no-production-deployment source validation. The guarded production custom-domain handoff has not been dispatched.
- Data Centre PR #114 candidate `8b61fe03eb918d352f78d1142651167b3e9fe21a` has passed Android and encrypted restore-drill jobs; its Go/VPS validation was still running at the last check.
- Flutter production smoke PR #100 remains failing against live production: apex `/` returned HTTP 200 instead of the required 308 redirect; NodeInfo discovery returned HTTP 200 with Flutter HTML instead of JSON; and real-account WebFinger returned HTTP 503. `www`, sign-in and Pages.dev Flutter shells returned HTTP 200. This is an actual routing/federation acceptance failure.
- The Chromium Admin Console harness exercises real browser `navigator.credentials.create()` and `.get()` with a virtual authenticator, but it currently stubs `/api/**` responses. It proves the browser ceremony payload and UI flow, not the live Admin Console-to-Backend/PostgreSQL end-to-end path. A live staging ceremony remains required.
- Staff lifecycle is not complete: `POST /api/staff/invite`, `PUT /api/admin/staff/{id}/role` and `DELETE /api/admin/staff/{id}` currently return HTTP 501. The two-person approval ledger records independent decisions but explicitly does not execute staff lifecycle mutations. Keep staff invitation, role changes and revocation closed until a transactional, independently approved implementation and integration tests exist.
- Backend PR #424, CDN PR #125, Data Centre PR #114 and API Control Plane PR #116 remain candidate/open work at this acceptance snapshot. Do not merge the bridge or declare production acceptance until independent reviews, exact post-merge source-pin refresh, live Backend/Admin Console ceremony, staff lifecycle, production routing and real-account Federation probes pass.


## 17. Authoritative source-pin refresh and apex Federation routing — 2026-11-21

The current `contracts/sources.lock.json` and `contracts/registry/seven-organ-bridge.json` are authoritative over earlier historical snapshots in this document. The exact six runtime pins currently validated by the bridge are:

| Runtime organ | Mainline revision | Review candidate revision |
|---|---|---|
| Backend | `a793c55db8b5c258524bfef4b8872f5c6c1038e5` | PR #424: `cc33913f0fd4e86669f7c717e12b2503990e6d88` |
| CDN | `490119514788c13c327ee05eb4ce068a0f73966e` | PR #125: `21a254e9f67dc7a8e55dca37151a6db532405e53` |
| Flutter | `1f58971720c7a72139d56900a5895c49fa105639` | Mainline includes NodeInfo 2.1, real-account WebFinger, actor and unknown-account smoke; PR #100 is a stale draft based on older mainline |
| Data Centre | `ada6f26a289775720bb47a639242dbd868388055` | Mainline |
| Algorithm | `92cf9b47e4de38306c4fe7b61ece24c3e075aa22` | Mainline |
| Federation | `3707d9a3f4e4222c23aecb8a97afbaeec45d3c5d` | Mainline |

The seventh API Control Plane remains governance-only at `201fd3335c737e7fe36ed34dfa1ec07b03c31047`; it is not a runtime service or hop. Backend PR #424 and CDN PR #125 remain unmerged candidate pins and are not represented as accepted mainline revisions. Each candidate is checked against its exact current mainline by the source checkout/merge validation before the bridge audits the combined tree.

The bridge cross-repository checker now also enforces the public ActivityPub discovery chain: Flutter's production NodeInfo/WebFinger smoke, Federation's public discovery handlers, Backend Caddy's apex proxy to `federation-api:8081`, CDN's apex Worker route, and the separately approved exact-owner WebFinger route removal and rollback workflow. CDN PR #125 now includes a separate default-off approval for the legacy `testagram.site/.well-known/webfinger*` route, exact ID/owner revalidation before deletion, and restoration of the exact prior `testagram-web` route if apex verification fails. Its workflow regression test is part of the CDN CI and is included in the immutable source inventory.

The latest CDN candidate passed CI run #524, Worker tests #209, capacity #457 and no-production-deployment origin validation #93. The bridge's next CI run must pass all Node and Dart audits against this refreshed source set before PR #116 is considered merge-ready.

Production acceptance remains **NOT ACCEPTED** until a separate staging Cloudflare zone proves the same route transition and full API/Federation smoke with staging-specific hostnames and credentials, followed by the three explicit production approvals. The production audit still shows the WebFinger route owned by `testagram-web`, the apex root returning HTTP 200 instead of the required 308 redirect, NodeInfo returning Flutter HTML, and the real-account WebFinger endpoint returning HTTP 503. No production routing, DNS, Pages, Worker, database, secret or feature-flag mutation is authorized by this source-pin refresh.


## 18. Staff permission mutation fail-closed correction — 2026-11-21

The latest Backend PR #424 candidate is `cc33913f0fd4e86669f7c717e12b2503990e6d88`. A forensic review found that the Admin Console's role-change, revocation and invitation handlers already return HTTP 501, but the permission-change handler still directly updated `native_staff_permission_overrides` after one owner's step-up. That bypassed the required two-person authorization boundary.

The candidate now removes that direct SQL mutation and keeps permission changes HTTP 501 until a transactional executor applies an approved request only after two distinct authorized approvers. A regression test asserts that the handler remains closed and contains no direct permission write. The API bridge source lock includes both the handler and its regression test, and the cross-repository checker enforces this fail-closed rule. The approval ledger's current record-only behavior is not treated as staff lifecycle execution.

This is a security closure, not a completed staff lifecycle. Invitation, role change, revocation and permission change remain unavailable until the two-person executor and its PostgreSQL integration tests are implemented. No production staff access or permissions were modified. Backend PR #432 contains a separate database-level approval-integrity migration and passed CI #3739, but it is stacked on overlapping PR #431. Reconcile/rebase that migration onto the reviewed PR #424 candidate or its accepted mainline merge before merge; the bridge does not treat the stale stack as accepted.


## 19. Live Cloudflare legacy Worker inventory — 2026-11-21

The latest Backend Cloudflare audit #457 verified that the repository token is active and performed a read-only inventory. The active production API custom domain `api.testagram.site` is still attached to the legacy `testagram-api` Worker, not `testagram-cdn`. That legacy Worker script still exists and has legacy `SUPABASE_*` secret/text bindings (`SUPABASE_ANON_KEY`, `SUPABASE_JWKS_URL`, `SUPABASE_PROJECT_REF`, `SUPABASE_SECRET_KEY`, `SUPABASE_URL`); its last recorded deployment is 2026-09-14. This is a live legacy edge artifact and must be removed after the new gateway is accepted, not confused with intentionally preserved historical migration records.

The same inventory confirms that `testagram.site/.well-known/webfinger*` is still routed to `testagram-web`, while apex and www remain attached to Flutter Pages. The existing `testagram-cdn` Worker has an active five-minute Cron trigger and is explicitly excluded from cleanup candidates.

The Cloudflare token is now active; the earlier missing-secret failure is no longer the current blocker. The remaining gates are the separate staging proof, explicit canonical-host/API-domain/WebFinger approvals, successful public API and Federation probes, and then the separately confirmed post-handoff cleanup of the detached legacy API Worker. No production resources were changed by audit #457.


## 20. Backend security-stack reconciliation and fresh CI — 2026-11-22

The immutable source lock remains on Backend PR #424 candidate `cc33913f0fd4e86669f7c717e12b2503990e6d88`. Fresh GitHub evidence confirms Backend CI run #44946760094 completed successfully across all 15 jobs; the InstaBox workflow's input-validation job passed, but its actual `Deploy backend and private services` job was skipped. This is not deployment evidence.

Backend PR #432 head `9f8c977a980f43e64889d8f166579edd67d61871` passed Backend CI run #44947171601 across all 15 jobs, and its Cloudflare domain-routing audit #44947171620 completed successfully as a read-only audit. Its database migration adds immutable request identity/payload, append-only approval evidence, eligibility checks at approval insertion, and an exact quorum check at the final approved transition. It does not implement the application-level transactional staff lifecycle executor and does not authorize enabling staff mutations.

The branch ancestry is still not reconciled. Although PR #432 currently targets branch `native-auth candidate branch` at the #424 candidate head, a direct commit comparison from #424 head to #432 head reports `diverged`, 32 commits ahead and 6 behind, with merge base `c627858a295fbf45b6dbdeeb54d2a5aa0a989470`. PR #431 head is `24eea9f623cf3fb37ca3aa79a9eac8a262785771`; its permission-handler correction overlaps the fail-closed implementation already present in #424. PR #432's historical description still names #431 as its stack dependency. Therefore, changing the PR base reference has not made its commit ancestry mergeable. Do not merge #431 or #432, do not force-push or rewrite their review history, and do not treat a green CI run as proof that the branch is merge-ready. A clean transplant/rebase of only the approval-integrity migration and its required tests onto #424 remains necessary, followed by fresh CI and independent review.

All review submissions remain absent on PRs #424, #431, #432 and API bridge #116. The bridge PR #116 head `3d7114e19c731e337eb8bdcd072056cdca71cac7` passed API contract CI run #44947566386 in both Node and Dart jobs. Its source lock pins Backend #424 and CDN #125 candidates; it must be refreshed to exact merge commits only after those dependencies are independently reviewed and merged.

No production deployment, DNS/domain transfer, Worker deletion, staff permission change or production routing mutation occurred during this audit. The production legacy Worker and WebFinger ownership blockers, separate staging-zone acceptance, and independent reviews remain release blockers.


## 21. Fresh read-only Cloudflare inventory — 2026-11-21 20:36 UTC

Backend Cloudflare audit run #44947171620 completed successfully in GET-only mode. It independently reconfirms that `api.testagram.site` is a production custom domain owned by Worker `testagram-api`; the canonical `testagram-cdn` gateway does not own that hostname. The exact route `testagram.site/.well-known/webfinger*` remains assigned to `testagram-web`. Apex and `www` remain active Pages domains on `testagram-flutter-web`. The `testagram-cdn` Worker still has its `*/5 * * * *` Cron trigger and must remain excluded from orphan cleanup.

The inventory additionally found a separate legacy Worker `testagram-heartbeat` carrying `SUPABASE_HEARTBEAT_RPC_URL` and `SUPABASE_PUBLISHABLE_KEY` bindings, plus a Worker named `xclone-9b4dz1-9b4dz1-8936-20260809`. These are live Cloudflare inventory findings, not approved Testagram architecture or dependencies. They are not authorized for deletion by this audit. Their ownership, route/domain references, schedules, service bindings, tail consumers and operational dependencies must be proven absent before a separate exact-name retirement workflow is proposed. Do not broaden the existing cleanup allowlist or delete either Worker as part of the API gateway handoff.

The same audit reported eight Worker scripts in the account, four custom-domain bindings including the legacy API binding, and the Pages project `testagram-flutter-web`. It completed with no DNS, Worker, Pages, zone or account mutations. Credential values and DNS record contents were intentionally excluded from the audit summary.

This fresh evidence expands the legacy edge inventory beyond the API Worker. The production release remains blocked on a separately accepted staging zone, canonical API-domain transfer, exact WebFinger route transfer, public API/Federation verification, and independent review. No production resource was changed.


## 22. Clean Backend approval-integrity transplant — 2026-11-22

The former Backend PR #432 stack has been reconciled into a new clean candidate, PR #434, directly descended from PR #424's native-auth candidate. The clean branch has one commit ahead and zero commits behind its exact #424 base. It carries only the independent approval-integrity migration, migration runner and Compose wiring, CI fixtures, integration-test updates and migration-manifest tests. It does not copy the overlapping #431 permission-handler correction; #424's HTTP 501 fail-closed staff permission handler and regression test remain inherited unchanged.

PR #434's initial clean transplant CI passed all 15 jobs. Further forensic review identified missing explicit expiry/replay/concurrency coverage and a credential-revocation race at the database boundary. The candidate was hardened to lock approver principal, identity, active role-grant and WebAuthn credential rows through approval commit, and its CI now tests expired-request rejection/expiry transition, duplicate-decision replay, approval-evidence deletion, and a concurrent approval-versus-credential-revocation transaction. The latest head is `eebd2f633f3df4200821a0d390903877fa75726c`; fresh Backend CI run #44964570240 is pending at the time of this update. The previous green run does not validate these newest changes. Independent security review remains absent.

The approval row still records approver identity but does not persist the exact WebAuthn credential ID and ceremony/session evidence used for step-up. The application verifies the authenticator from the recent step-up token, while the database trigger verifies active eligible credentials. This remaining credential-evidence binding must be resolved or explicitly accepted by an independent security reviewer before the approval ledger can be accepted. Staff invitations, role changes, revocations and permission changes remain disabled.

## 23. Staging workflow and live edge inventory gaps — 2026-11-22

A forensic read of CDN PR #125's production routing workflow found that it contains exact-owner API custom-domain and WebFinger route transfer guards, default-off approvals and rollback logic, but it does not execute or verify a separate staging-zone acceptance workflow. The phrase "after staging acceptance" appears in an error message; it is not a machine-verified staging attestation. The CDN repository currently has no staging-specific workflow or staging Wrangler configuration in the candidate tree. The production routing workflow must not be dispatched until a separate staging acceptance artifact exists and is verified against the exact CDN candidate and staging zone.

The latest read-only Cloudflare inventory enumerated the visible zones as `blueski.top`, `streamora.co.ke` and `testagram.site`; it did not show a separate Testagram staging zone. It confirms the live custom-domain owner `heartbeat.testagram.site` is Worker `testagram-heartbeat`, which retains legacy `SUPABASE_HEARTBEAT_RPC_URL` and `SUPABASE_PUBLISHABLE_KEY` bindings. Therefore that Worker is not an orphan and must not be deleted or detached without a separate replacement and migration plan. The inventory also found `xclone-9b4dz1-9b4dz1-8936-20260809`; it had no route, custom domain, Cron or bindings in the observed inventory, but ownership/source provenance still needs verification before any cleanup.

Backend PR #433's guarded cleanup workflow lists heartbeat and the unexpected Worker as separate exact-name candidates, but its custom-domain and consumer preflights should block heartbeat while the live custom domain remains. No dry-run cleanup was dispatched, and no Worker was deleted. The active five-minute `testagram-cdn` Cron remains excluded from cleanup.

The API bridge source lock intentionally remains pinned to the unmerged Backend #424 and CDN #125 candidates. It must not be advanced to PR #434 or any candidate head until the exact reviewed changes are merged and the accepted merge commits are known. No production DNS, route, Worker, Pages, staff permission or deployment mutation occurred.


## 22. Backend approval-integrity transplant supersedes the stale #431/#432 stack — 2026-11-22

Backend PR #434 (`security/native-approval-ledger-integrity-on-424-20261122`) is the clean replacement candidate for the former #432 stack. It is directly based on PR #424's exact native-auth candidate `cc33913f0fd4e86669f7c717e12b2503990e6d88`; Git comparison reports the base as the merge base, 8 commits ahead and 0 behind at the last ancestry check. It excludes #431's overlapping permission-handler correction; the #424 fail-closed permission handler and regression test remain inherited from the base.

PR #434 carries the approval-integrity migration, ordered migration application and Compose mount, PostgreSQL fixtures, migration-manifest checks, and exact WebAuthn RP ID plus credential-ID binding for every new approval. The application decision path now obtains the exact authenticator ID from the credential-bound recent step-up and writes it with the approval record. The approval-quorum trigger checks that exact credential remains active, verified and not clone-warned at finalization. Admin readiness checks the new schema columns.

The latest PR #434 head observed during this update was `f95340a9f81ea3257e8d7fdb48db33b496bed5e6`; its workflow syntax check passed, while Backend CI and the Cloudflare audit were still running/queued. Earlier complete Backend CI on the predecessor head passed all 15 jobs, but did not cover all later exact-credential/readiness changes. The latest commit adds the credential-bound schema requirement to the migration readiness diagnostics. Therefore PR #434 remains draft and unaccepted pending fresh CI on its final stable head and independent security review.

The bridge source lock deliberately remains pinned to PR #424, not #434: #434 is a stacked, unmerged security candidate and must not be represented as an accepted source dependency. Refresh the Backend lock only after the #424/#434 dependency chain is independently reviewed and actually merged; then pin the resulting merge commit, not a moving branch name. PR #431/#432 must not be merged separately.

No production migration, staff permission enablement, deployment, Cloudflare routing change or cleanup is authorized by this candidate. Staff invitations, role changes, revocations and permission changes remain disabled.


## 23. Latest Backend transplant head and CI state — 2026-11-22

A subsequent forensic refresh observed Backend PR #434 at head `25ebde27e54ae8af28b91910846e48158cb1771f`, still directly based on PR #424 head `cc33913f0fd4e86669f7c717e12b2503990e6d88`. Git comparison remains clean: 16 commits ahead, 0 behind. The newest change adds a PostgreSQL negative test proving an approver cannot substitute a different authenticator credential for the exact credential registered to that staff principal.

The Backend CI run `44965224380` is now running against this exact head; its Admin permissions and dual-control PostgreSQL integration job is included. Workflow syntax validation passed on this head. The immediately preceding Backend CI attempts were cancelled as newer commits arrived, so they are not acceptance evidence. Cloudflare audit remains read-only.

PR #434 remains draft, with no independent review. The bridge lock remains pinned to the unmerged #424 source candidate and has not been advanced to #434 or any unmerged branch. This status is an audit snapshot only; refresh the Backend source pin after independent review and actual merge of the accepted dependency chain.


## 24. Backend PR #434 exact-credential hardening and latest validation — 2026-11-22

The latest Backend PR #434 head is `89e4663f330cb965f66db5614c41661ea037ffe2`. It remains directly based on #424 candidate `cc33913f0fd4e86669f7c717e12b2503990e6d88`; a fresh Git comparison reports 21 commits ahead, 0 behind, with #424 itself as the merge base. PR #434 is still draft, mergeable, and has no independent review submissions.

The approval ledger now persists both the exact WebAuthn RP ID and credential identifier from the verified elevation token. PostgreSQL insert and final-quorum guards require the same active, user-verified, non-cloned credential and lock it through the decision transaction. The Admin Console requires the elevation subject to match the authenticated staff principal and verifies the immutable canonical payload digest before appending an approval. Regression tests now assert the exact credential evidence is persisted and reject a mismatched payload digest or a different authenticator.

The first full CI attempt after introducing the new credential columns exposed a real test-harness omission: the separate identity-registration PostgreSQL harness had not applied migration 061 and its fixture did not seed approver credentials. That harness now applies migration 061 twice to test idempotence, creates exact credential fixtures, and records credential-bound approval rows. The test suite now also asserts that the two exact credential IDs were persisted by the identity-review integration path. This correction is included in the current head; do not treat earlier cancelled or failed runs as final acceptance.

Backend CI run `44965415739` and workflow syntax validation run `44965411063` were in progress when this snapshot was written. The Cloudflare domain-routing audit run `44965415787` is read-only and in progress. A fresh all-green run against this exact head is still required.

The API bridge source lock remains intentionally pinned to the unmerged Backend #424 candidate and CDN #125 candidate. It has not been advanced to PR #434, and no moving branch name is used as an accepted dependency. Refresh the source lock only after independent security review and actual merge of the accepted Backend dependency chain, using the final merge commit SHA.

No PR was merged. No production deployment, DNS or route transfer, Worker deletion, staff permission change or staging-zone acceptance occurred. Staff invitations, role changes, revocations and permission changes remain disabled until a transactional two-person executor is implemented and independently accepted.


## 25. Additional Worker ownership detail from read-only Cloudflare audit — 2026-11-22

Cloudflare audit job `44965369931` succeeded in GET-only mode. It confirms that `testagram-heartbeat` owns the enabled production custom domain `heartbeat.testagram.site` in zone `testagram.site`, and the zone has a proxied AAAA record for that hostname. The Worker still carries `SUPABASE_HEARTBEAT_RPC_URL` and `SUPABASE_PUBLISHABLE_KEY` bindings. It has no reported Cron trigger, route or tail consumer in this inventory, but its custom-domain and DNS ownership prove it is live. Do not delete it or remove its hostname during the API gateway cleanup; it requires a separate native heartbeat replacement, health verification, exact domain transfer and separate retirement approval.

The unexplained Worker `xclone-9b4dz1-9b4dz1-8936-20260809` has no listed custom domain, route, Cron trigger, binding or tail consumer; latest deployment source is `dash_template` (2026-08-15). However, the audit reports `workers_dev=unknown`, so its public workers.dev endpoint status is not proven. Keep it out of all deletion allowlists until that endpoint and account-level service references are explicitly checked.

The same audit shows `testagram-web` has a `17 3 * * *` Cron trigger as well as the exact WebFinger route. The route-transfer workflow must transfer only the exact WebFinger route ID; it must not delete/redeploy `testagram-web` or remove its Cron trigger. The CDN Worker has its own active five-minute Cron and remains protected from cleanup.

No DNS, Worker, Pages, zone or account mutations occurred. This narrows the API cleanup scope but does not authorize any production cleanup or route transfer.


## 25. Backend PR #434 final candidate CI completed — 2026-11-22

Backend PR #434's current head is `4c7a5a74b5e9209f63dff4e0d6b4ee6439f3b10c`, directly descended from PR #424 candidate `cc33913f0fd4e86669f7c717e12b2503990e6d88`. Git comparison reports 22 commits ahead, 0 behind, with #424 as the exact merge base. Its changed files are limited to the approval-integrity migration, Admin Console decision path and regression coverage, PostgreSQL provisioning fixtures, self-hosted migration preflight/Compose wiring, migration harness and CI workflow.

Fresh Backend CI run `44965539075` completed successfully across all 15 jobs on the exact #434 head. Workflow syntax validation run `44965534370` also passed. The read-only Cloudflare domain-routing audit `44965539105` passed. The CI includes PostgreSQL dual-control and identity-registration integration, exact WebAuthn credential binding, mismatched payload-digest rejection, migration idempotence, Compose validation, browser WebAuthn, race detector, Vet, Build and runtime-boundary checks.

The exact WebAuthn RP ID and credential identifier are now persisted on each new approval record. The database trigger checks the same credential at insert and final quorum transition and locks it against concurrent revocation. The application binds the approval to the authenticated elevation subject and verifies the immutable canonical payload digest before recording. Historical unbound approval rows are not accepted into a new quorum; affected pending requests must expire and be re-requested.

**Acceptance remains pending:** PR #434 is still draft and has no independent review submission. It is not merged. PR #424 also remains open and requires its own independent review. The old #431/#432 branches must not be merged separately. The bridge source lock remains pinned to the unmerged #424 candidate, not #434; it must only move to the actual accepted merge commit after the dependency chain is independently reviewed and merged.

The latest Cloudflare inventory still shows no separate Testagram staging zone among the visible zones. `api.testagram.site` remains on `testagram-api` with legacy Supabase bindings; `testagram.site/.well-known/webfinger*` remains on `testagram-web`; `heartbeat.testagram.site` remains on `testagram-heartbeat`; the unexpected Worker remains provenance-unverified; and `testagram-cdn` retains its protected five-minute Cron. The audit was read-only. No production routing, DNS, Worker, Pages, staff permission or deployment mutation occurred.


## 26. Backend PR #434 full CI acceptance snapshot — 2026-11-22

Backend PR #434's stable candidate head is `4c7a5a74b5e9209f63dff4e0d6b4ee6439f3b10c`, directly based on PR #424 candidate `cc33913f0fd4e86669f7c717e12b2503990e6d88`. Git comparison confirms 22 commits ahead, 0 behind, with the #424 candidate as the merge base.

Fresh Backend CI run `44965539075` completed successfully across all 15 jobs on that exact head. This includes:
- Admin permissions and dual-control PostgreSQL integration, including concurrent approval-versus-credential-revocation serialization.
- Identity registration PostgreSQL migration/invariant integration, now applying migration 061 twice and seeding exact RP/credential-bound approver fixtures.
- Exact WebAuthn registration/assertion browser integration.
- Native staff WebAuthn credential, replay and counter tests.
- Go race detector, vet, build and vulnerability scan.
- Self-hosted Compose validation and all other PostgreSQL/MinIO integration jobs.

Cloudflare read-only audit `44965539105` and workflow syntax validation `44965534370` also succeeded. No production Cloudflare changes occurred.

PR #434 remains draft and has zero independent review submissions. Green CI is candidate evidence only; it is not a merge approval or production migration attestation. The source lock remains intentionally pinned to unmerged #424 candidate `cc33913f0fd4e86669f7c717e12b2503990e6d88`, not #434. Refresh it only after independent review and actual merge of the accepted dependency chain, using the final merge commit SHA. Staff invitations, role changes, revocations and permission changes remain disabled.


## Current execution reconciliation — 2026-11-22 03:55 UTC

This section is the current authoritative status and supersedes earlier historical snapshots in this document wherever they describe CDN PR #125 as unmerged or describe the old source pins as current.

### Immutable source pins

- Backend mainline remains `a793c55db8b5c258524bfef4b8872f5c6c1038e5`; Backend PR #424 remains an unmerged candidate at `cc33913f0fd4e86669f7c717e12b2503990e6d88`.
- CDN PR #125 is **merged** at `21a254e9f67dc7a8e55dca37151a6db532405e53`. The source lock and seven-organ registry now pin this exact merge commit as CDN mainline and no longer classify #125 as a candidate.
- Data Centre remains pinned to `ada6f26a289775720bb47a639242dbd868388055`; Flutter to `1f58971720c7a72139d56900a5895c49fa105639`; Algorithm to `92cf9b47e4de38306c4fe7b61ece24c3e075aa22`; Federation to `3707d9a3f4e4222c23aecb8a97afbaeec45d3c5d`; API Control Plane mainline baseline to `201fd3335c737e7fe36ed34dfa1ec07b03c31047`.
- Backend #434 is the clean approval-integrity candidate at `2c74c4017ef0cc54a250e070c470d950a0df314e`, directly based on #424. Its exact-head Backend CI, workflow syntax and read-only Cloudflare audit passed. No independent review is recorded.
- Backend #435 is now based on the exact #434 head `2c74c4017ef0cc54a250e070c470d950a0df314e`; its current head is `1e165ae9d5ca2f4ebdf7a7b4b25b7294f43a2149`. Its Backend CI, Cloudflare audit and Knowledge Engine schema workflow are in progress. The earlier schema-only success on its prior head is not acceptance for this latest head.
- Do not merge #424, #434 or #435 without independent review and the required sequential checks. #435 must remain stacked on the exact accepted #434 revision.

### Flutter CI rerun

The latest recorded Flutter feature revision is `b3ed56d6aa2a4822d0687cdc4d32cfa98cbc7cf8`. The Cloudflare Pages build passed, but the Validate Flutter Client and Flutter Client CI jobs were cancelled before dependency resolution, analysis, tests or builds. Both jobs were explicitly rerun. The reruns were again cancelled while restoring the Flutter SDK cache (approximately 1.67 GB); no Dart analysis or Flutter test result was produced. This is an infrastructure/cache-stage cancellation, not a test failure and not a pass. The Flutter gate remains open.

### API Control Plane refresh

The API bridge branch now updates `contracts/sources.lock.json`, `contracts/registry/seven-organ-bridge.json`, `contracts/route-inventory/backend-public-routes.json` and this acceptance record. The CDN pin now identifies the merged #125 SHA; the Backend route-inventory explanatory source SHA now matches the pinned #424 candidate. The refreshed bridge head is `3e2e420b8c6d293b4e1552cb79a97e69d84f2a0a`. The preceding bridge CI passed on the prior head; no check result is yet recorded for this refreshed head. Keep PR #116 open until exact-head Node and Dart contract CI passes and the Backend dependency chain is reviewed and accepted.

### Staging and production

No separate Testagram staging Cloudflare zone or machine-verified staging attestation has been established. The merged CDN workflow is guarded but production-only; it must not be dispatched without the equivalent staging workflow and successful API, media, apex redirect, NodeInfo, WebFinger and actor/public-key probes. The last read-only inventory still identifies legacy production API/WebFinger routing and related Worker bindings. No production DNS, Worker, Pages, database, staff permission, feature flag or deployment mutation is authorized or evidenced by this reconciliation.
