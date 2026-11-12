# Seven-repository production readiness audit

**Audit date:** 2026-11-11  
**Scope:** Testagram API governance plus the six runtime repositories  
**Status:** Forensic baseline; NOT a production approval

## Executive finding

All seven repositories are present and the connected GitHub account has administrative/push permissions. Repository presence and documentation are not proof of a deployable, secure, end-to-end system. The current source documentation explicitly records multiple release blockers. Keep production rollout and legacy XClone retirement gated until the evidence below is collected.

## System-wide invariants

1. Flutter obtains an Appwrite session JWT and sends it only to the public Testagram Backend.
2. Backend is the sole authority for canonical identity, authorization, product records, visibility, media ownership and public product APIs.
3. Data Centre, CDN, Federation and Algorithm are private service/data-plane components. Their credentials and private contracts never enter Flutter, web bundles, public OpenAPI or client SDKs.
4. CDN delivers bytes only; it does not decide ownership or authorize product actions.
5. Algorithm may order Backend-authorized candidates only. Backend must re-check visibility/authorization and hydrate canonical records after ranking.
6. Federation resolves local actors through Backend and cannot create local accounts or grant access to local content.
7. Data Centre owns storage/processing/notification infrastructure, not product identity or post authorization.
8. PostgreSQL transactional outboxes and idempotent workers are the durable async boundary. Do not introduce Supabase, Redis/Valkey or Upstash as product runtime dependencies without an explicit architecture decision and threat/recovery review.
9. Never silently convert dependency failures, unsupported routes or authorization errors into empty/success responses.
10. Database changes are forward-only, checksummed, backed up and verified against a restore plan.

## Verified release blockers and contradictions

### P0 — CDN private playback can fail open

The API capability matrix records that private playback currently fails open when `PLAYBACK_SECRET` is unset. This must be changed to fail closed: private playback endpoints must refuse startup/readiness or reject protected requests when the secret is absent or too weak. Add tests for unset, short, rotated and valid secrets; verify no public bypass path exists. Do not enable private media in production until the test is proven against the deployed configuration.

### P0 — Cross-service source drift must be closed

The source lock pins immutable revisions for Backend, Data Centre, CDN, Flutter, Federation and Algorithm. A production release must prove that the checked-out revisions, vendored contract snapshots and provider conformance reports match the exact source revisions being deployed. Re-pin deliberately; never silently advance a pin or update a snapshot without a source audit. CI must fail on missing source, dirty snapshot, unexpected source drift or unreviewed contract changes.

### P0 — Data Centre provider/client integration is incomplete

The API capability matrix records Data Centre platform contract drift (including response-code and method/schema gaps) and the Backend typed client as absent. Resolve the provider OpenAPI against actual handlers and tests, then implement a typed Backend client with bounded timeouts, authentication, error mapping, retries only for safe/idempotent operations, and contract tests. Do not expose private platform routes publicly.

### P0 — Federation is deliberately not production-enabled

Federation documentation states that inbox projection for supported Create/Update/Delete/Like/Announce activities, follower fan-out, recipient deduplication, complete outbox production, interoperability, operational observability and end-to-end tests remain incomplete or gated. Keep public routing and delivery workers disabled until all of these pass. Unsupported activities must remain quarantined/dead-lettered, never silently applied or marked successful.

### P0 — Full media path lacks physical end-to-end proof

Data Centre requires evidence for the physical path: Android storage node → real MP4 upload → signed object transfer → FFmpeg HLS output → reachable API/frontend → actual playback. A local unit test or mocked upload is not sufficient. Verify checksum, ownership, quota, object durability, deletion/retry behavior, CDN origin authorization, cache policy, player startup and recovery on a real device.

### P0 — Backup/restore scope is incomplete

Data Centre documentation states that its existing backup scripts do not alone cover the Backend product database, all media objects, Federation state and Appwrite configuration. Before production approval, run and record a coordinated restore drill covering PostgreSQL, object storage/video media roots, Federation state, Appwrite configuration/secrets and deployment configuration. Record RPO/RTO, checksums, restore ordering and post-restore smoke tests.

### P1 — Flutter is not full XClone parity

Flutter documentation explicitly describes an expanding migration tranche, not a production release. The route migration matrix, native feature parity, main-feed media lifecycle, profile/graph, messaging/calls, stories, TV, creator/ads, commerce/wallet/M-Pesa, moderation/admin, federation UI, offline/accessibility/deep-link/push work and real-device verification must be reconciled against the legacy app. Do not retire XClone or change the Android signing identity until parity, data migration, deep links and upgrade tests are approved.

### P1 — Public API schemas remain provisional

The capability matrix marks several DTOs provisional or registered-only, including replies, notifications, profiles, polls, thread interactions and media lifecycle. A registered route is not a client contract. Promote each route only with exact handler-derived schemas, auth/resource-authorization tests, success/error semantics, idempotency behavior and consumer tests.

### P1 — Algorithm deployment and privacy boundary require staging evidence

The Algorithm repository is a large upstream-derived codebase; its root README is not a Testagram deployment contract. The Testagram-specific service under `testagram-feed/` is the relevant integration surface. Validate its exact build/runtime dependencies, candidate schema, authentication, bounded resource use, ranking timeout/fallback policy and Backend post-ranking authorization. Keep it private and fail safely when unavailable.

### P1 — CDN capacity statements are targets, not evidence

The CDN documentation correctly describes 100,000 logical viewers as an engineering target, not a measured capacity claim. Validate real edge bandwidth, origin/shield throughput, cache-hit ratio, concurrency, memory/disk bounds, hot-cache sizing, regional failure and live HLS continuity under representative load. Do not publish capacity claims until load-test evidence is attached.

### P1 — CDN dependency policy conflicts with the platform baseline

The Backend/API architecture excludes Redis/Valkey and Upstash runtime dependencies, while the CDN README documents optional Upstash Redis control-plane coordination. Resolve this explicitly. Preferred baseline is PostgreSQL-backed durable coordination or a separately approved optional control-plane adapter that is disabled by default, never required for media delivery, and has documented failure semantics. Ensure no secret or credential is shipped to clients.

## Release gates (all required)

- [ ] All six runtime repositories have immutable reviewed source pins and reproducible builds.
- [ ] Public and private OpenAPI contracts lint; provider snapshots match pinned source.
- [ ] Backend Appwrite JWT validation, identity bridge, resource authorization and rate-limit tests pass against PostgreSQL.
- [ ] Data Centre provider/client contract tests pass; private service network and token rotation are verified.
- [ ] CDN fails closed for protected media and passes cache/origin authorization, purge authorization and load tests.
- [ ] Federation workers remain disabled until projection, fan-out, replay, dead-letter, SSRF and interoperability gates pass.
- [ ] Algorithm is private, bounded, observable and cannot override Backend authorization.
- [ ] Flutter analyzer, tests, Android/web builds, release-signing and real-device migration tests pass.
- [ ] Physical media path passes from upload through playback and deletion.
- [ ] Coordinated backup/restore drill passes with measured RPO/RTO.
- [ ] Monitoring, alerting, runbooks, incident ownership, rollback and staged rollout are approved.
- [ ] No unresolved P0/P1 security, data-loss or cross-service contract issue remains.

## Execution order

1. Close P0 security and data-integrity blockers (CDN fail-closed, Backend auth, storage and migration safety).
2. Reconcile provider contracts and source pins; implement missing typed clients and contract tests.
3. Complete media and Federation end-to-end workflows while keeping public rollout flags disabled.
4. Validate Algorithm ranking isolation and Backend post-ranking authorization.
5. Finish Flutter parity, release signing and staged upgrade tests.
6. Run load, failure-injection, backup/restore and production-like deployment rehearsals.
7. Release behind staged traffic/feature flags with rollback criteria and named operational ownership.

## Evidence rule

Every checkbox must link to a commit, passing CI run, test report, deployment configuration review, physical-device result or restore/load-test report. A README statement, planned feature, merged code or green compile alone is not sufficient evidence.


## Expanded infrastructure hardening — Backblaze B2, Cloudflare R2, Workers, DNS and backup

### P0 — Reconcile the media metadata authority before enabling fresh media

The Backend README and architecture contract identify PostgreSQL as the canonical product/media metadata ledger. However, the audited `cmd/fresh-api/main.go` wires `freshstorage.NewAppwriteStoreWithUserQuota(db)`, and `internal/freshstorage.AppwriteStore` persists reservations, quota, media records and replica state through Appwrite document transactions. This is a material authority mismatch, not a naming detail.

Before production, choose and document one authoritative transactional ledger. The stated architecture selects PostgreSQL. If Appwrite document storage is only a transitional implementation, keep fresh media disabled until the PostgreSQL implementation, migration/reconciliation plan, concurrency tests and restore coverage are merged. Do not operate two independently writable quota/replica ledgers.

### P0 — B2/R2 dual-copy completion is synchronous, not yet a durable replication workflow

The current `CompleteUpload` path verifies the selected primary object, streams it to the peer provider, reads back/verifies the peer and only then commits the protected record. This is a sound publication invariant: one-copy uploads are not published. But the provider copy is performed inline in the request path. The source architecture itself records that durable outbox-driven replication, bounded retry and dead-letter recovery remain required.

Production acceptance requires:
- Persist a replication job/outbox row in the same transaction as the primary-verified state.
- Idempotent worker lease/claim, bounded exponential retry with jitter, retry-after handling and dead-letter/manual replay.
- Publish the media record only after both provider copies pass independent SHA-256 and byte-length verification.
- Recover jobs after API process termination, client disconnect, provider timeout and worker restart.
- Reconcile database replica ledger against B2 and R2 inventories without treating ETags as SHA-256.
- Keep the last known-good copy; never repair from an unverified source.

### P0 — Cloudflare Worker and hostname ownership must be made unambiguous

The CDN repository's Go README reserves `media.testagram.site` for the Go CDN data plane and says Cloudflare must not attach a media route to that hostname. The Cloudflare Worker tests and examples also use `media.testagram.site` as the R2 Worker host, while `cloudflare/wrangler.toml` has `workers_dev=false` and no checked-in route/custom-domain declaration. This is a route ownership collision and a deployment ambiguity.

Before deployment:
- Assign distinct hostnames to the Go CDN and private R2 Worker (for example, `media.testagram.site` for Go CDN and a separately approved private-origin hostname for the Worker).
- Record authoritative DNS ownership, Cloudflare zone, Worker custom-domain/route, origin and TLS mode in the deployment registry.
- Do not create or change DNS records until the intended origin and current live route are verified.
- Keep R2 bucket private; use Worker binding access only. Do not enable public bucket access as a workaround.
- Ensure Cloudflare cache rules never cache private responses, token-bearing query URLs or authenticated API responses.
- Validate GET, HEAD, byte ranges, HLS manifests/segments, token expiry, wrong-key denial, missing/weak secret denial and origin outage from outside the private network.

### P0 — Backblaze B2 and R2 credential/bucket controls

Backend expects independent B2 and R2 S3-compatible endpoints, regions, buckets, access keys and secret keys. Keep each credential scoped to only its own bucket and minimum operations. Separate upload/read/replication/cleanup permissions where provider capabilities permit. Do not reuse keys between providers or share long-lived provider credentials with Flutter, Android storage nodes, CDN edges or Data Centre node agents.

Staging proof must include: signed PUT expiry and required Content-Type; upload size enforcement; read-back SHA-256; cross-provider streaming copy; destination read-back; multipart behavior; versioning/object-lock policy decision; delete/restore behavior; credential rotation; and denial when either provider is unavailable. ETag is not a portable content hash.

### P0 — Backup scripts do not yet prove B2/R2/Appwrite media recovery

The Data Centre backup script explicitly says media bytes in B2/R2 and Appwrite identity/documents are outside its archive. It backs up the Data Centre and Neon databases and optional node state, then transfers the encrypted archive over SSH/rsync. Its restore drill validates those database archives in an isolated container only. This is not a full Testagram media restore.

Required independent recovery plan:
- PostgreSQL product/social database (or the explicitly selected canonical ledger), Data Centre databases, Federation database and Appwrite project configuration/documents/keys.
- B2 and R2 object bytes, bucket configuration, versioning/lifecycle configuration and checksums.
- Independent encrypted off-provider backup/archive with tested credentials and a separate failure domain.
- Restore into isolated infrastructure; verify object counts, byte counts, sampled/full SHA-256, metadata-to-object references, signed private playback, feed hydration and HLS playback.
- Record measured RPO/RTO and repeatable restore commands. Keep active storage replication distinct from backup: two live provider copies are not a backup if deletion/corruption propagates to both.

### P1 — Cloudflare zone and edge hardening

Cloudflare account settings are not available through this repository connection, so no live DNS, zone, WAF, TLS, Worker secret, R2 bucket ACL or cache configuration is claimed changed. Operator verification must cover:
- DNS record target and proxy mode for each hostname; no duplicate/conflicting A/AAAA/CNAME records.
- Full (strict) TLS from Cloudflare to origin, valid origin certificate, automatic renewal and expiry alerts.
- WAF managed rules, bot/rate protections for auth, upload-intent, completion, purge and expensive endpoints.
- Explicit allowlist for origin access; authenticated origin pulls or equivalent service authentication for private origins.
- Cache bypass for API, auth, private media, signed URLs and purge endpoints; immutable cache only for versioned public assets.
- DDoS controls, upload/body-size limits, request timeout behavior, WebSocket/realtime compatibility and real client-IP trust only behind known Cloudflare proxy ranges.
- Zone export, registrar recovery, DNS rollback and incident runbooks.

### P1 — Backblaze operational controls

Backblaze account-side settings are not accessible through this GitHub connection. Verify bucket privacy, region/endpoint correctness, application-key scope, key rotation, lifecycle/versioning policy, account billing alerts, bandwidth/transaction limits, object lock where required, and restore access independent of the active production key. Never assume cross-provider replication is a backup or that provider availability implies recoverability.

## Infrastructure cutover checklist

- [ ] Canonical media metadata/quota/replica ledger selected and implemented consistently.
- [ ] B2 and R2 staging integration tests pass with real isolated buckets.
- [ ] Durable replication outbox, worker, retry, dead-letter and replay are implemented.
- [ ] Cloudflare Worker private-only semantics and strong signing secret are tested.
- [ ] Go CDN and R2 Worker have separate, documented hostnames and route ownership.
- [ ] Cloudflare DNS/TLS/WAF/cache/origin rules are externally verified.
- [ ] B2/R2 keys are independently scoped, rotated and absent from client/node images.
- [ ] Independent encrypted object backup exists outside the active B2/R2 pair.
- [ ] Full Appwrite + product DB + B2/R2 restore drill passes.
- [ ] Real Android upload → both replicas verified → Backend attach → Cloudflare/Go CDN delivery → HLS playback → deletion/recovery passes.


## Additional findings and work after the initial audit snapshot (2026-11-11)

### P0 — CDN URL issuance still trusts a caller-controlled visibility flag

The Go CDN `GET /v1/media/url` helper accepts `private=1` from the caller and signs the requested normalized path itself. This does not prove that Backend authorized the viewer for the object. Omitting the flag also defaults to a public URL. Fail-closed playback-token verification is necessary but does not fix the issuer trust boundary. Track [CDN #54](https://github.com/Trendyzima/cdn-/issues/54); Backend must authorize object visibility and issue a narrowly scoped service assertion bound to key, scope, expiry, issuer/audience and viewer as applicable. Playback signing and issuer authentication must use distinct credentials.

### P0 — Archived XClone is still named as CDN deployment owner

The CDN source-verification workflow explicitly describes production deployment as living in the archived XClone repository. That workflow currently runs verification rather than deployment, but the ownership reference is still operationally unsafe and must be replaced with an owned deployment workflow/runbook in CDN or Data Centre. Track [CDN #55](https://github.com/Trendyzima/cdn-/issues/55). No production route or deployment was changed during this pass.

### P1 — Full TV migration needs a first-party catalogue contract

The archived XClone Flutter TV screen imports Supabase and calls the legacy `tv-catalog` Edge Function directly. The audited Backend has IPTV social interactions and TV health reporting, but no verified public TV catalogue contract. Track [Backend #161](https://github.com/Trendyzima/Testagram-backend-/issues/161). Data Centre may own source ingestion; Backend must expose the only public product API and authorize playback. Flutter must not call the legacy Edge Function, upstream feeds or CDN origin directly.

### Flutter source-port update

[Flutter PR #11](https://github.com/Trendyzima/testagram-flutter-client-/pull/11) ports reviewed TV catalogue-cache/playback policies, inbox path validation, Team Chat display hints and moderation form guards with tests. It does not claim screen-level feature parity. XClone remains archived and read-only.

### API contract terminology update

[API PR #3](https://github.com/Trendyzima/testagram-api/pull/3) clarifies that the API repository is the contract control plane plus six runtime repositories (seven repositories total), and records the Backend-authorized CDN issuer boundary. This is documentation-only and does not alter runtime behavior.

## Current evidence caveat

GitHub Actions source CI is not proof of live provider, DNS, TLS, WAF, origin, secret, backup or restore correctness. Real B2/R2 account integration, Cloudflare zone configuration and an isolated full media restore remain unverified. Keep production media, public federation, and XClone retirement gated until their own acceptance evidence is attached.
