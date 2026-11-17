# Testagram seven-repository integration and release contract

Status: reviewed integration baseline; **not** production cutover authorization.
Reviewed: 2026-11-18.

This repository is the contract control plane. It owns public/private OpenAPI, event schemas, SDKs, route inventories, immutable source pins and cross-repository compatibility CI. It is not a runtime service, identity provider, product database or authorization gateway.

The six runtime repositories are Flutter, Backend, Data Centre, CDN, Federation and Algorithm. Backend remains the sole authority for product identity, object ownership, visibility, quota, moderation, retention and deletion policy.

## Immutable source revisions

The exact revisions used by contract CI are in `contracts/sources.lock.json`. The reviewed source pins are Backend `19645d484433ad081b4e9568b8d675a29294ff2c`, Data Centre `fda92448fb6df8c1c313f1e7751540866ffa97b8`, CDN `28c58a41d69320034132f3e13fac2ce9d8406b1f`, Flutter `a90ae7cf77034308ff205d66614d1061821f27d4`, Federation `b0e75e8d005d3a014badd762bec4e81fe09559fe`, and Algorithm `da8e90e79150636a6efe8e03c2cbc8fb9357764d`. Contract CI checks exact immutable checkouts and snapshots. A source pin is not evidence that a service is deployed.

## Ownership and allowed calls

| Repository | Owns | Allowed runtime path |
|---|---|---|
| Flutter | UI, local presentation, Testagram-native login/session/recovery client | Public Backend API using short-lived native access JWTs; canonical media URLs only |
| Backend | Canonical identity, native credential/session authority, product authorization, social API, PostgreSQL state, media policy and orchestration | Private Algorithm, Federation and Data Centre clients; trusted CDN origin |
| Data Centre | Private media lifecycle, B2/R2 operations, replication/reconciliation, node/platform operations and backups | Private Backend network; object stores and node agents |
| CDN | Go media delivery, public cache, private assertion relay, range/HEAD, shields and origin routing | Public media traffic; authenticated Backend origin |
| Federation | ActivityPub actors, signatures, inbox/outbox, remote delivery and federation state | Private Backend contracts; remote ActivityPub peers |
| Algorithm | Stateless ordering of a bounded, already-authorized candidate set | Private Backend ranking API only |
| API control plane | Versioned contracts, schemas, SDKs, snapshots, source pins and compatibility CI | Build/contract time only; no runtime calls |

## Canonical service contracts

### Flutter -> Backend

- Flutter submits email/password to Backend `POST /api/auth/login` and receives a 15-minute Testagram-native access JWT plus an opaque rotating refresh token.
- Flutter keeps access tokens in memory and stores only the refresh token in platform secure storage. Refresh is sent only to `POST /api/auth/refresh`; it is never a bearer credential.
- Backend verifies signature, issuer, audience, expiry, canonical UUID, token version and session ID, then rechecks the live PostgreSQL session, account state, verified email and provisioning status.
- Logout and logout-all revoke server-side sessions; password reset consumes a one-time hashed recovery token and revokes prior sessions.
- Flutter must not receive service tokens, storage-provider keys, database credentials or private service URLs.
- The client API base is configured through `TESTAGRAM_API_URL`.
- Private media requests use only short-lived Backend-issued viewer assertions; no assertion is reused for a different URL or asset and the raw user JWT is not forwarded to the CDN origin.

### Native authentication and staff sessions

- The Backend is the only end-user credential issuer. Current mainline uses Testagram-native sessions; the native API path does not accept Appwrite JWTs as a compatibility fallback.
- The Admin Console signs in through the same Backend-native login endpoint. It stores its session inside the encrypted `testagram-staff` cookie (`HttpOnly`, `Secure`, `SameSite=Strict`) and checks the enabled PostgreSQL staff principal, recorded `mfa_enrolled_at` marker and role grant. Current step-up rechecks the password only; no TOTP/passkey challenge is implemented yet, so staff invitation and role-grant activation remain fail-closed.
- Staff invitation and role-grant activation remain fail-closed until the dual-control onboarding path is available. Historical Appwrite account IDs are retained only for explicit reconciliation; email equality is never an account-linking rule.
- The Backend and user-aware Data Centre services must share the same `TESTAGRAM_AUTH_JWT_SECRET`. Data Centre video/notification handlers validate the JWT and then recheck the live PostgreSQL session/account state; a signature alone never grants access.
- Data Centre platform routes use `PLATFORM_INTERNAL_TOKEN`, not a user access JWT. Federation ingress/read credentials, Algorithm internal token, CDN viewer assertion, CDN origin token and purge token are separate identities with separate audiences.

### Backend -> Algorithm

- `POST /v1/feed/rank`; readiness `GET /readyz`.
- The current `cmd/api` runtime uses `ALGORITHM_URL=http://algorithm:8092` and `ALGORITHM_INTERNAL_TOKEN`, matching Algorithm's `INTERNAL_TOKEN`.
- Backend submits at most 200 authorized candidates and accepts at most 50 results. It rejects duplicate or unknown IDs and reapplies visibility, blocks, follows and moderation after ranking.

### Backend <-> Federation

- Backend -> Federation uses `FEDERATION_INTERNAL_TOKEN` mapped to Federation's `FEDERATION_INGRESS_TOKEN`.
- Federation -> Backend uses `FEDERATION_BACKEND_INTERNAL_TOKEN` mapped to Federation's `BACKEND_INTERNAL_TOKEN`.
- These are independent, direction-specific secrets. Do not reuse one token for both directions.
- Backend's post transaction and federation outbox event must commit atomically. Duplicate activity IDs are idempotent.
- Federation delivery, inbox and outbox workers remain disabled until consent, signature, replay, idempotency, retry and external-peer acceptance tests pass.

### Backend -> Data Centre media service

- Backend uses `DATA_CENTRE_MEDIA_API_URL=http://media:8096` and `FRESH_DATA_CENTRE_INTERNAL_TOKEN`.
- Data Centre maps the same token to the media service's `MEDIA_INTERNAL_TOKEN`; every request also carries `X-Testagram-API-Version: 1`.
- The service exposes five private routes: upload-url, verify, status, download-url and delete under `/internal/v1/media/*`. It is not a public product API.
- The service owns only media object lifecycle and provider operations. Backend retains ownership/visibility/quota/moderation decisions.
- Backend's self-hosted Compose stack creates the internal Docker network named `testagram-platform`. Data Centre's media service joins that external network; start the Backend stack first. Do not publish port 8096. This is a statically verified configuration contract, not proof that the live VPS containers are currently attached or reachable.
- Fresh-media provider credentials live in the Data Centre media container; the Fresh API receives only the private URL and service token. Native identity evidence is a separate current `cmd/api` path: it writes to the private VPS object-storage primary and uses a Backend-side B2/R2 replica worker for recovery. Those replica credentials are transferred only when `MEDIA_REPLICATION_ENABLED=true`; this exception is not permission to pass provider credentials to Flutter or the Fresh API. Keep registration disabled until the identity-evidence bucket scopes, live replication/restore/deletion and reviewer-access staging gates pass.
- The active Data Centre `backend/docker-compose.yml` includes `media-migrate` and `media` in an opt-in `media` profile. It uses a separate `testagram_media` database, joins only the private `testagram-platform` network and exposes no host port. Data Centre PR #67 fixed shell-variable escaping so the default Compose model remains valid when `MEDIA_DATABASE_URL` is absent; CI validates both the disabled and enabled profile models and runs a dedicated media service runtime smoke. The Backend Instabox deployment workflow currently leaves this profile disabled; Backend PR #224 is stale and conflicts with the merged Go CDN topology, so its deployment changes must be reconciled before use. `FRESH_MEDIA_ENABLED` stays false until a Data Centre-backed Fresh API adapter, canonical metadata-ledger reconciliation and real provider-backed staging acceptance pass.

### Backend -> CDN -> trusted origin -> storage

- Backend issues the authorization assertion; CDN validates/relays it and does not decide user visibility. The viewer assertion is distinct from the Flutter user access JWT and from the CDN origin/purge credentials.
- Private origin requests require both CDN service authentication and a valid Backend viewer assertion. Private responses bypass shared cache and return no-store.
- Public cache misses require canonical Backend metadata to prove the object is ready and public before CDN can cache it.
- Backend PR #206 implements the canonical public-origin branch: a viewer assertion may be omitted only for an asset whose Backend metadata row is both `ready` and `public`; private media still requires a key-bound viewer assertion and a separate CDN origin credential. The provider is resolved from canonical metadata and GET/HEAD are signed with the correct method. Backend PR #223 adds and passes a PostgreSQL-backed handler acceptance matrix for public/private/deleted/quarantined denial, wrong service credentials, owner/key mismatch, method-correct GET/HEAD, Range forwarding and private no-store/public cache classification. The API contract CI statically checks Backend origin registration/authorization and CDN consumer enforcement. Deployed CDN smoke, cache-purge revocation under live traffic and custom-domain routing remain separate gates. Treat source wiring and CI handler acceptance as implemented, not fully deployed.
- Backend PR #223 now owns pinned Go CDN promotion and Instabox runtime configuration. The first deployment attempt reached the VPS but failed at optional Data Centre media Compose interpolation; Data Centre PR #67 fixed the Compose regression and the failed deployment job is being rerun. The deployment is not accepted until that rerun verifies all containers, publishes the CDN HTTPS endpoint and passes public health/readiness plus unauthenticated media denial. CDN issues #61/#65 still report that `media.testagram.site` serves an older R2 Worker; DNS/custom-domain cutover, rollback and Cloudflare route verification remain outstanding.
- Preserve GET, HEAD, Range, If-Range, ETag, Last-Modified, Content-Range, content type and size bounds. No untrusted redirects or direct-provider fallback.

### Fresh API runtime boundary

The legacy Fresh API runtime is not part of the current Backend `main` source pin. Do not treat old `cmd/fresh-api` references or its environment names as a supported authentication path. The supported native user-authenticated public API is Backend `cmd/api`; private Data Centre media/platform APIs remain service-token protected. Any retained Fresh API image or profile must be separately reconciled against a current source revision before it is enabled.

### TV / HLS

- Data Centre may ingest/normalize approved catalogue sources.
- Backend must own catalogue DTOs and viewer-bound playback grants.
- CDN must enforce grants consistently for playlists, segments and keys.
- Flutter calls Backend only and plays the returned CDN URL.
- Current Go CDN TV legacy proxy is disabled; complete catalogue -> grant -> manifest -> segment/key -> Flutter playback acceptance is still outstanding.

## Contract and CI boundaries

- The Backend route inventory is pinned to the exact Backend `main` source SHA in `contracts/route-inventory/backend-public-routes.json`; the current inventory audits static routes and explicitly marks registered-only operations. Contract CI must verify parity after each source-pin refresh. The separate Fresh API inventory contains 22 routes explicitly marked uncontracted pending wire-level review. CI passing means the inventory is accurately marked; it does not approve those 22 routes for public clients.
- API cross-repository CI checks immutable source checkout, OpenAPI lint, SDK build, tests, Backend route inventory and cross-repository snapshots.
- Every source path in the current six runtime pins must exist at the pinned commit. Every snapshot must match its upstream source byte-for-byte.
- A contract change requires producer, consumer, schema, fixtures, route inventory and pin updates in the same reviewed integration cycle.

## Production acceptance gates

Do not declare the circuit complete until all of these are evidenced on the same immutable revisions:

1. All seven repository CI workflows green on the final merged mainline commits.
2. Backend -> Algorithm and Backend <-> Federation authenticated contract tests, including negative, duplicate, timeout and retry cases.
3. Backend -> Data Centre five media routes exercised through the real private network and token.
4. Real B2 primary PUT, independent GET/hash, R2 full-copy/read-back/hash, retry/reconciliation, deletion and restore tests using isolated staging buckets.
5. Backend -> CDN private viewer assertion and origin authentication, plus public classification, HEAD, Range, conditional requests, purge and cache-isolation tests.
6. Flutter image and video playback verified against the real Backend/CDN path on Android; HLS playlist/segment/key authorization verified end to end.
7. Federation inbox/outbox and remote peer interoperability acceptance before enabling workers.
8. Pinned Go CDN deployment, external health/readiness smoke, rollback and operational monitoring.
9. Independent database backup restore, object restore and deletion/tombstone reconciliation drills.
10. No production activation flag enabled before the corresponding acceptance gate passes.

CI green, a source pin, a Compose file, or an open PR is not proof of a deployed or fully working service.
