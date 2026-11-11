# CDN edge and media delivery contract

**Provider:** `Trendyzima/cdn-`  
**Implementation source:** `internal/edge/server.go`  
**Status:** route inventory source-audited; production DNS/origin/private playback are not verified by this document.

## Responsibility

CDN is a byte-delivery plane. It owns edge routing, local/shield caching, HLS/DASH asset delivery, range handling and edge metrics. It does not own users, post visibility, media ownership, quotas, retention or authorization policy.

Backend remains responsible for deciding whether an object may be uploaded, attached, downloaded or played. CDN must enforce a short-lived, key-bound playback authorization for private content or use an authenticated private origin path.

## Registered HTTP surface

| Method/path | Purpose | Exposure |
|---|---|---|
| GET /healthz | Liveness | Private monitoring |
| GET /readyz | Readiness | Private monitoring |
| GET /metrics | Cache/upstream/byte/prefetch metrics | Private monitoring |
| GET /route?key=... | Deterministic edge selection for stable key | Public routing primitive; not global health-aware DNS |
| POST/DELETE /api/cache/purge | Purge all or one cache key | Operator-only; requires PURGE_TOKEN |
| GET /v1/media/url | Media URL helper | Public only when returned URL policy allows it |
| GET /api/media/url | Compatibility media URL helper | Public only when returned URL policy allows it |
| GET /v1/{asset-path} | Canonical asset delivery, including media and HLS/DASH paths | Public or token-authorized private bytes |
| GET /v1/tv/{asset-path} | TV asset delivery | Public or token-authorized private bytes |
| GET /media/{asset-path}, /users/{asset-path}, /profiles/{asset-path}, /uploads/{asset-path}, /avatars/{asset-path}, /covers/{asset-path}, /photos/{asset-path}, /videos/{asset-path} | Legacy-compatible media aliases | Delivery only; authorization remains at the object/token boundary |

HEAD and OPTIONS behavior is implementation-dependent and must be verified for the deployed release before client reliance. Do not infer a media catalogue API from asset delivery routes.

## Required HTTP behavior

- Preserve content type, ETag, Cache-Control, byte-range requests and Content-Range for media.
- Keep live HLS manifests short-lived and retain segments long enough for the advertised playlist window.
- Use cache coalescing, bounded storage and stale-if-error only within the configured policy.
- Never cache a private response as a public object.
- Purge is an administrative operation and must never be exposed in Flutter configuration or generated public SDKs.
- CDN origin/shield URLs and origin credentials remain server-side.
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
