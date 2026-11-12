# CDN edge and media delivery contract

**Provider:** `Trendyzima/cdn-`  
**Implementation source:** `internal/edge/server.go`  
**Status:** route inventory source-audited; URL helper issuer trust is a P0 release blocker (CDN issue #54); production DNS/origin/private playback are not verified by this document.

## Responsibility

CDN is a byte-delivery plane. It owns edge routing, local/shield caching, HLS/DASH asset delivery, range handling and edge metrics. It does not own users, post visibility, media ownership, quotas, retention or authorization policy.

Backend remains responsible for deciding whether an object may be uploaded, attached, downloaded or played. CDN must enforce a short-lived, key-bound playback authorization for private content or use an authenticated private origin path. **Current source has a fail-open configuration edge:** when `PLAYBACK_SECRET` is empty, the asset authorization helper accepts requests without a token. Production private-media use is blocked until the CDN is changed to fail closed when private authorization is expected and staging proves missing/expired/wrong-key denial.

## Critical media URL issuance boundary\n\nThe current Go CDN `GET /v1/media/url` helper accepts a caller-controlled `private=1` query flag and signs the requested normalized path itself. That flag is not a Backend authorization decision: a caller can request a signed URL for a path without proving ownership, visibility, relationship access or moderation eligibility. Omitting the flag also defaults to a public URL. Therefore this helper must not be treated as the private-media authorization API. Track and close [CDN issue #54](https://github.com/Trendyzima/cdn-/issues/54) before enabling private product media.\n\nThe required design is Backend-authorized issuance: Backend authenticates the user and resolves canonical object visibility, then sends a narrowly scoped, short-lived service assertion to CDN bound to the normalized object key, action/scope, expiry, issuer/audience and viewer where needed. CDN validates that assertion before minting a distinct playback token. Playback HMAC and Backend issuer authentication must use separate credentials and must not be interchangeable. Public delivery must be explicitly classified by Backend policy, not inferred from a missing query flag. Go CDN and R2 Worker must share the same authorization and cache semantics.\n\n## Registered HTTP surface

| Method/path | Purpose | Exposure |
|---|---|---|
| GET /healthz | Liveness | Private monitoring |
| GET /readyz | Readiness | Private monitoring |
| GET /metrics | Cache/upstream/byte/prefetch metrics | Private monitoring |
| GET /route?key=... | Deterministic edge selection for stable key | Public routing primitive; not global health-aware DNS |
| POST/DELETE /api/cache/purge | Purge all or one cache key | Operator-only; requires PURGE_TOKEN |
| GET /v1/media/url | Media URL helper; `private=1` requests a signed URL | Public only when returned URL policy allows it |
| GET /api/media/url | Compatibility media URL helper | Public only when returned URL policy allows it |
| GET/HEAD /v1/{asset-path} | Canonical asset delivery, including media and HLS/DASH paths | Public or token-authorized private bytes |
| GET /v1/tv/{asset-path} | TV asset delivery | Public or token-authorized private bytes |
| GET /media/{asset-path}, /users/{asset-path}, /profiles/{asset-path}, /uploads/{asset-path}, /avatars/{asset-path}, /covers/{asset-path}, /photos/{asset-path}, /videos/{asset-path} | Legacy-compatible media aliases | Delivery only; authorization remains at the object/token boundary |

Asset delivery accepts GET and HEAD; media URL helpers accept GET; purge accepts POST and DELETE. CORS preflight is handled by middleware. Do not infer a media catalogue API from asset delivery routes.

## Required HTTP behavior

- Preserve content type, ETag, Cache-Control, byte-range requests and Content-Range for media.
- Keep live HLS manifests short-lived and retain segments long enough for the advertised playlist window.
- Use cache coalescing, bounded storage and stale-if-error only within the configured policy.
- Never cache a private response as a public object.
- Purge is an administrative operation and must never be exposed in Flutter configuration or generated public SDKs.
- CDN origin/shield URLs and origin credentials remain server-side.
- `PLAYBACK_SECRET` must be provisioned as a server-side secret before private playback is enabled. A `private=1` URL request without that secret currently produces no signed token.
- Public host `media.testagram.site` is an intended deployment value only; DNS, TLS, origin reachability and private playback must be verified before configuring Backend `MEDIA_PUBLIC_BASE_URL`.

## End-to-end acceptance

1. Backend creates a media upload intent after authorization and quota checks.
2. Upload completes to the configured private/public object storage.
3. Backend persists metadata and ownership and attaches media only through authorized product operations.
4. Public media can be fetched through CDN and returns correct bytes, content type and cache headers.
5. Private media fails without a valid token, rejects expired/wrong-key tokens, and is never publicly cacheable.
6. HLS/DASH playlist and segment retrieval works with range and seek behavior.
7. Deletion/retention invalidates access and stale edge objects within the documented safety window.
8. Origin outage, shield outage, cache miss and purge failure are tested.

## Not provided by this contract

CDN does not provide product search, user identity, upload authorization, TV catalogue, payment processing or media ownership. Those remain with the owning product services.
