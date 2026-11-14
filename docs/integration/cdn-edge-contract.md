# CDN edge and media delivery contract

**Provider:** `Trendyzima/cdn-`  
**Implementation source:** `internal/edge/server.go`  
**Status:** current Go mainline disables caller-directed URL signing and routes viewer-authorized requests through the trusted Backend origin. This closes the unsafe signer behavior described by CDN issue #54 in the inspected source, but deployed configuration, Backend authorization validation, R2 Worker parity, DNS/TLS and production acceptance remain unverified.

## Responsibility

CDN is a byte-delivery plane. It owns edge routing, local/shield caching, HLS/DASH asset delivery, range handling and edge metrics. It does not own users, post visibility, media ownership, quotas, retention or authorization policy.

Backend remains the sole authority for object ownership, visibility, relationship access, moderation and deletion. The inspected CDN mainline has two distinct delivery paths:

- Public path: an unauthenticated edge request is resolved through the trusted Backend internal CDN origin. The Go edge accepts bytes only when the Backend response explicitly sets `X-Testagram-Visibility: public`. Unknown or private visibility is rejected; public-provider fallback is not used.
- Private path: the edge forwards the viewer's `Authorization` value to the trusted Backend internal CDN origin as `X-Testagram-Viewer-Authorization`. It accepts the response only when Backend explicitly classifies it as `private`. Private bytes bypass shared cache and are returned with `Cache-Control: private, no-store`, `CDN-Cache-Control: no-store`, and `Vary: Authorization, Range`.

The caller-directed `GET /v1/media/url` and compatibility `GET /api/media/url` handlers are registered but deliberately disabled: the inspected implementation returns HTTP 410 and does not mint a URL from a caller-supplied path or `private=1` flag. This is a meaningful source-level remediation of the original issue #54 design flaw. Do not infer from that source change alone that private delivery is production-safe: Backend must validate the forwarded viewer authorization, deployment must provision a trusted origin credential, and production tests must prove correct viewer/object authorization and no cache leakage. The legacy `PLAYBACK_SECRET` setting is not the authorization mechanism for this inspected viewer-to-Backend flow and must not be treated as a substitute for Backend authorization.

The Go edge rejects legacy query playback tokens, does not cache authenticated private responses, disables redirect following on origin clients to prevent credential forwarding, and does not retry authorization denials against a different origin. These are source-level properties; acceptance tests remain mandatory.

## Registered HTTP surface

| Method/path | Purpose | Exposure |
|---|---|---|
| GET /healthz | Liveness | Private monitoring |
| GET /readyz | Readiness | Private monitoring; requires trusted origin configuration |
| GET /metrics | Cache/upstream/byte/prefetch metrics | Private monitoring |
| GET /route?key=... | Deterministic edge selection for stable key | Public routing primitive; not global health-aware DNS |
| POST/DELETE /api/cache/purge | Purge all or one cache key | Operator-only; requires PURGE_TOKEN |
| GET /v1/media/url | Disabled legacy URL-issuance helper | Returns HTTP 410; use Backend-authorized media access |
| GET /api/media/url | Disabled compatibility URL-issuance helper | Returns HTTP 410; does not sign caller-selected paths |
| GET/HEAD /v1/{asset-path} | Canonical asset delivery, including media and HLS/DASH paths | Public bytes require Backend public classification; private bytes require forwarded viewer authorization and Backend private classification |
| GET /v1/tv/{asset-path} | TV asset delivery | Separate gated TV path; do not infer TV catalogue or playback-grant readiness |
| GET /media/{asset-path}, /users/{asset-path}, /profiles/{asset-path}, /uploads/{asset-path}, /avatars/{asset-path}, /covers/{asset-path}, /photos/{asset-path}, /videos/{asset-path} | Legacy-compatible media aliases | Delivery only; authorization remains at the Backend object boundary |

Asset delivery accepts GET and HEAD; disabled media URL helpers accept GET but return HTTP 410; purge accepts POST and DELETE. CORS preflight is handled by middleware. Do not infer a media catalogue API from asset delivery routes.

## Required HTTP and security behavior

- Preserve content type, ETag, Cache-Control, byte-range requests and Content-Range for media.
- Keep live HLS manifests short-lived and retain segments long enough for the advertised playlist window.
- Use cache coalescing and bounded storage; mutable user media must not be served stale after authorization failure or Backend outage.
- Never cache a private response as a public object. Authenticated private delivery must bypass shared cache and use `private, no-store` semantics.
- Purge is an administrative operation and must never be exposed in Flutter configuration or generated public SDKs.
- CDN origin/shield URLs and origin credentials remain server-side.
- Do not re-enable either URL-issuance helper as a caller-directed signer. Any future issuance API requires a separately reviewed Backend authorization contract; the current helpers return HTTP 410.
- Public host `media.testagram.site` is an intended deployment value only; DNS, TLS, origin reachability and private-media authorization must be verified before configuring Backend `MEDIA_PUBLIC_BASE_URL`.

## End-to-end acceptance

1. Backend creates a media upload intent after authorization and quota checks.
2. Upload completes to the configured private/public object storage.
3. Backend persists metadata and ownership and attaches media only through authorized product operations.
4. Public media can be fetched through CDN and returns correct bytes, content type and cache headers only after Backend explicitly classifies it public.
5. Private media is fetched through viewer authorization accepted by Backend; wrong-user, wrong-object, expired-session and revoked-access cases are denied, and private bytes are never publicly cacheable.
6. HLS/DASH playlist and segment retrieval works with range and seek behavior under the separately approved playback grant contract.
7. Deletion/retention invalidates access and stale edge objects within the documented safety window.
8. Origin outage, shield outage, cache miss and purge failure are tested.
9. Backend authenticates `X-Testagram-Origin-Auth`, validates `X-Testagram-Viewer-Authorization` against the canonical user/session and object ACL, and returns `X-Testagram-Visibility` only after authorization.
10. CDN and any R2 Worker implementation have equivalent public/private authorization, cache, range and denial semantics. Go source tests alone do not satisfy this gate.

## Not provided by this contract

CDN does not provide product search, user identity, upload authorization, TV catalogue, payment processing or media ownership. Those remain with the owning product services.
