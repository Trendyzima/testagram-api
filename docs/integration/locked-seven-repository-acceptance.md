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
| `testagram-flutter-client-` | Flutter web/mobile UI and native session client | Public HTTPS Backend API and canonical CDN URLs only |
| `Testagram-backend-` | Canonical identity, sessions, PostgreSQL product data, authorization, API and orchestration | Public client ingress; private Algorithm, Federation, Data Centre and trusted CDN origin |
| `Testagram-data-centre-` | Private infrastructure, storage/media lifecycle, replicas, node operations and backup | Private platform/media network and object providers |
| `the-algorithm` | Stateless ranking of bounded Backend-authorized candidate IDs | Private Backend ranking request only |
| `federated-content` | ActivityPub/AT Protocol adapters and protocol state | Private Backend contracts and explicitly enabled remote peers |
| `cdn-` | Go media delivery, cache, ranges, HLS transport and trusted origin relay | Public media ingress and authenticated Backend origin |
| `testagram-api` | OpenAPI, internal contracts, schemas, SDKs, route inventory, source pins and compatibility CI | Build/contract/release governance only; never a runtime hop |

Backend + PostgreSQL remain the sole authority for Testagram users, sessions, canonical product records, media ownership, visibility, moderation, quota, retention and deletion. Data Centre owns storage mechanics, not product authorization. CDN transports bytes, not access decisions. Algorithm orders candidates, not product records. Federation owns protocol state, not local identity or canonical posts.

**Project boundary:** Testagram-only branding and architecture. Do not add Supabase or XClone as runtime components, dependencies, products, repositories or branding. Historical material must be clearly isolated as historical and must never be a live runtime fallback.

## 2. Immutable baseline

The baseline below is the reviewed `main` head observed on 2026-11-18. The six runtime source pins are recorded in `contracts/sources.lock.json`; this governance repository is identified separately.

| Repository | Baseline commit |
|---|---|
| Flutter | `a90ae7cf77034308ff205d66614d1061821f27d4` |
| Backend | `e440e341a98004b4e982035f068f80aaf6f64dee` |
| Data Centre | `bbf08499bcd80adcdafd8fff38b7bd34e8edd741` |
| Testagram API control plane | `d75595a2c4eb28d50e630d4b29d1bffc666b3a88` |
| Algorithm | `da8e90e79150636a6efe8e03c2cbc8fb9357764d` |
| Federation | `b0e75e8d005d3a014badd762bec4e81fe09559fe` |
| CDN | `eb30f4f2b7ecfaaf121411657a281f4195d8d314` |

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

- Flutter uses the Testagram-native Backend login/refresh/recovery/session path; no Appwrite JWT fallback is accepted on end-user routes.
- Access JWTs remain short-lived and in memory; only opaque rotating refresh tokens are stored in platform secure storage.
- Backend validates signature, issuer, audience, expiry, token version, session ID, canonical user ID, live PostgreSQL session, account state and verification/provisioning state.
- Exercise registration only through the approved staging provisioning process, email verification, login, refresh rotation, logout, logout-all, password recovery and session restoration.
- Exercise authenticated profile read/update, post create/read, feed retrieval, media grant retrieval and denial for expired/revoked/foreign credentials.
- Verify web and Android builds on real browsers/devices; prove no service token, storage key, private host, or database credential is bundled into the client.

**Fail if:** identity is inferred from email equality, a revoked/expired/wrong-audience token is accepted, a refresh token is replayable, the client calls a private service directly, or user data is lost across refresh/logout/restore.

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
- Use explicitly designated staging buckets only. Verify signed upload expiry/content type/size limits, actual PUT, independent GET and SHA-256/byte-count verification, durable replication receipt, destination read-back, reconciliation, retry after process/worker interruption, delete tombstone and restore from the surviving verified copy.
- Prove no object is published as ready until required copies have independently passed read-back verification.
- Exercise provider outage, partial replication, duplicate completion, expired upload grant, delete retry, stale metadata and worker restart.

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

- Produce a consistent backup set covering canonical Backend PostgreSQL, required Data Centre media metadata/replica ledger, actual B2/R2 object data, Federation protocol/outbox/inbox/cursor state, and required deployment/configuration material.
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

## 6. Current verified position (2026-11-18)

- Backend, Data Centre and Testagram API CI runs were observed green on their reviewed commits; Algorithm tests and image publication and Federation CI/image publication were observed green. These are repository-level results, not live inter-service acceptance.
- Backend's InstaBox deployment workflow validated inputs but its actual deployment job was skipped pending explicit dispatch confirmation.
- Flutter's scheduled domain smoke failed because apex returned HTTP 200 where the workflow requires HTTP 308 to www; www shell probes succeeded in that run.
- CDN's canonical-host routing workflow failed during preflight; no Cloudflare cutover was reached.
- Data Centre media profile is present in source and CI, but live B2/R2 lifecycle and coordinated restore remain unproven.
- Algorithm service authentication and Federation private ingress have source-level contract coverage; deployed service-to-service staging acceptance remains unproven.
- Federation public inbound projection/fan-out/interoperability and HLS acceptance remain gated.
- Current source pin registry had Data Centre pinned 35 commits behind its current main. This PR refreshes that pin and its reviewed source path set; the two Data Centre OpenAPI snapshots were checked against current main and are byte-identical. CDN's pin is also refreshed to current main. CI must validate these refreshed pins before merge.

**Decision: NOT ACCEPTED for end-to-end staging or production until all required gates have passing evidence.** This is a locked acceptance standard, not a claim that all seven repositories are already integrated or deployed.
