# Testagram seven-repository integration and release contract

Status: reviewed integration baseline; **not** production cutover authorization.
Reviewed: 2026-11-13.

This repository is the contract control plane. It owns public/private OpenAPI, event schemas, SDKs, route inventories, immutable source pins and cross-repository compatibility CI. It is not a runtime service, identity provider, product database or authorization gateway.

The six runtime repositories are Flutter, Backend, Data Centre, CDN, Federation and Algorithm. Backend remains the sole authority for product identity, object ownership, visibility, quota, moderation, retention and deletion policy.

## Immutable source revisions

The exact revisions used by contract CI are in `contracts/sources.lock.json`. Backend and Data Centre currently point at reviewed open integration-PR heads, not merged production mainline commits. CDN and Flutter point at merged mainline commits; Federation and Algorithm point at reviewed mainline commits. A source pin is not evidence that a service is deployed.

## Ownership and allowed calls

| Repository | Owns | Allowed runtime path |
|---|---|---|
| Flutter | UI, local presentation and Appwrite session acquisition | Public authenticated Backend API; canonical media URLs only |
| Backend | Product identity, authorization, social API, PostgreSQL state, media policy, outboxes and orchestration | Appwrite Auth; private Algorithm, Federation and Data Centre clients; trusted CDN origin |
| Data Centre | Private media lifecycle, B2/R2 operations, replication/reconciliation, node/platform operations and backups | Private Backend network; object stores and node agents |
| CDN | Go media delivery, public cache, private assertion relay, range/HEAD, shields and origin routing | Public media traffic; authenticated Backend origin |
| Federation | ActivityPub actors, signatures, inbox/outbox, remote delivery and federation state | Private Backend contracts; remote ActivityPub peers |
| Algorithm | Stateless ordering of a bounded, already-authorized candidate set | Private Backend ranking API only |
| API control plane | Versioned contracts, schemas, SDKs, snapshots, source pins and compatibility CI | Build/contract time only; no runtime calls |

## Canonical service contracts

### Flutter -> Backend

- Flutter obtains an Appwrite session JWT and sends it to Backend as a bearer token.
- Backend validates it and derives canonical identity server-side.
- Flutter must not receive service tokens, storage-provider keys, database credentials or private service URLs.
- The client API base is configured through `TESTAGRAM_API_URL`.
- Private media requests use only short-lived Backend-issued viewer assertions; no assertion is reused for a different URL or asset.

### Backend -> Algorithm

- `POST /v1/feed/rank`; readiness `GET /readyz`.
- The current `cmd/api` runtime uses `ALGORITHM_URL=http://algorithm:8092` and `ALGORITHM_INTERNAL_TOKEN`, matching Algorithm's `INTERNAL_TOKEN`.
- The separate `cmd/fresh-api` runtime uses `ALGORITHM_ENDPOINT`; these names are not interchangeable.
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
- Backend's self-hosted Compose stack creates the internal Docker network named `testagram-platform`. Data Centre's media service joins that external network; start the Backend stack first. Do not publish port 8096.
- B2 credentials and R2 credentials exist only in the Data Centre media container. Backend receives only the private URL and service token.
- The media service uses its own `MEDIA_DATABASE_URL`, not the Data Centre platform/control-plane database. `FRESH_MEDIA_ENABLED` stays false until real provider-backed staging acceptance passes.

### Backend -> CDN -> trusted origin -> storage

- Backend issues the authorization assertion; CDN validates/relays it and does not decide user visibility.
- Private origin requests require both CDN service authentication and a valid Backend viewer assertion. Private responses bypass shared cache and return no-store.
- Public cache misses require canonical Backend metadata to prove the object is ready and public before CDN can cache it.
- **Open blocker:** Backend issue #205 tracks the missing canonical public-media origin branch and method-correct HEAD signing. Until this is implemented and tested, public CDN cache misses are not accepted as integrated.
- CDN deployment is also not established: Data Centre issue #53 tracks the canonical pinned Go CDN deployment controller, readiness, rollback and post-deploy smoke. The Cloudflare R2 Worker is separate and must remain unrouted.
- Preserve GET, HEAD, Range, If-Range, ETag, Last-Modified, Content-Range, content type and size bounds. No untrusted redirects or direct-provider fallback.

### Fresh API runtime boundary

The Data Centre Compose `api` container runs Backend `cmd/fresh-api`, which is distinct from the self-hosted Backend `cmd/api` runtime. The current `cmd/api` integration branch has the typed Data Centre media client described above. The `cmd/fresh-api` runtime still uses its own `freshstorage.FromEnv()` provider path and does not yet consume `DATA_CENTRE_MEDIA_API_URL` / `FRESH_DATA_CENTRE_INTERNAL_TOKEN`. Do not pass B2/R2 credentials into the Fresh API container or enable its media flag until a Data Centre-backed adapter and canonical metadata-ledger reconciliation are implemented and tested. Keep `FRESH_MEDIA_ENABLED=false` in that profile.

### TV / HLS

- Data Centre may ingest/normalize approved catalogue sources.
- Backend must own catalogue DTOs and viewer-bound playback grants.
- CDN must enforce grants consistently for playlists, segments and keys.
- Flutter calls Backend only and plays the returned CDN URL.
- Current Go CDN TV legacy proxy is disabled; complete catalogue -> grant -> manifest -> segment/key -> Flutter playback acceptance is still outstanding.

## Contract and CI boundaries

- The Backend route inventory currently audits 82 static routes; 37 contracted operations are represented in the Backend OpenAPI. The separate Fresh API inventory contains 22 routes explicitly marked uncontracted pending wire-level review. CI passing means the inventory is accurately marked; it does not approve those 22 routes for public clients.
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
