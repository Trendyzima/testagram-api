# API capability and readiness matrix

**Source registered** means the Backend `main` branch registers the route. **Contracted** means its path and method are represented in this repository's OpenAPI file. Neither status alone proves production deployment readiness. **Registered-only** operations must not be consumed by clients until DTO, auth and error semantics are promoted.

| Capability | Backend route | Owner | Contract status | Integration note |
|---|---|---|---|---|
| Liveness/readiness | GET /healthz, GET /readyz | Backend | Contracted | Plain-text responses |
| Home feed | GET /api/feed/home | Backend + Algorithm | Contracted | Appwrite JWT; following_only/before/limit |
| Search | GET /api/search | Backend | Contracted | Optional auth; q/kind/limit/media_only |
| Main-feed post creation | POST /api/social/posts | Backend | Contracted | Idempotency-Key required; Flutter widget tests cover request shape; deployed Backend/PostgreSQL and staging read-back remain unverified |
| Post interaction summary | GET /api/social/posts/{id}/interaction-summary | Backend | Contracted | Viewer-specific state |
| Reactions/reposts/bookmarks | POST/DELETE /api/social/posts/{id}/reaction, /reposts, /bookmarks | Backend | Contracted | Mutation DTO/status audit continues |
| Replies | GET/POST /api/social/posts/{id}/replies | Backend | Contracted | Reply DTOs still provisional |
| Follow state/create/delete | GET/DELETE /api/social/follows/{target_user_id}; POST /api/social/follows | Backend | Contracted | Correct target-scoped path |
| Notifications | GET /api/social/notifications; POST /{notification_id}/read | Backend + Data Centre | Contracted | DTOs provisional |
| Threads list/create/read | GET/POST /api/threads; GET /api/threads/{thread_id} | Backend | Contracted | Separate product surface from main-feed posts |
| Profiles/connections/follow requests/blocks | /api/social/profiles/*, /api/social/follow-requests/*, /api/social/blocks* | Backend | Registered-only | Do not consume until schemas/auth are promoted |
| Polls/history | /api/social/polls*, /api/social/history | Backend | Registered-only | Handler-specific DTOs pending |
| Thread interactions/media | /api/threads/* interaction and media routes | Backend | Registered-only | Route exists; client contract pending |
| Media lifecycle | /api/media/upload-intent, PUT /api/media/upload, /complete, /delete, /attach, /private-download-url, /list | Backend + Data Centre + CDN | Registered-only | Flutter main-feed public-image client flow exists; real three-provider replication/read-back, private-media/CDN authorization and staging journeys remain release gates |
| TV health | GET /api/tv/health | Backend + Data Centre | Registered-only | Not a TV catalogue/player contract |
| Capability dispatcher | POST /api/capability | Backend | Registered-only | Allow-listed capability calls only; never generic arbitrary RPC |
| Auth lifecycle | POST /api/auth/{signup,resend-verification,verify-email,login,forgot-password,reset-password} | Backend | Registered-only | Dynamic routes; dedicated auth contract required |
| Native identity verification | POST /api/identity/applications; GET /api/identity/applications/{application_id}; GET /api/identity/sessions/{session_id}; POST /api/identity/sessions/{session_id}/evidence/*; POST /api/admin/identity/* | Backend | Registered-only | Native session, secure evidence upload and reviewer/two-person decision APIs are registered; strict public/private DTOs and Flutter end-to-end contract promotion remain required |
| Federation preferences | GET/PUT /api/me/federation | Backend + Federation | Registered-only | Separate privacy/security review |
| M-Pesa callback | POST /api/wallet/mpesa/callback | Backend | Webhook-only | Not a client SDK operation |
| TV catalogue/player, ads, marketplace, creator tools, admin | No complete public client contract verified | Backend + Data Centre + CDN | Not contracted | Do not infer from private services or legacy UI |

## Promotion gate

Promote a registered-only route only after the owner supplies:
1. Handler and DTO references.
2. Strict OpenAPI request/response schemas.
3. Authentication and resource-level authorization tests.
4. Success, validation, conflict, rate-limit and dependency-failure behavior.
5. Contract tests and client failure-state tests.
6. Observability and rollback notes where operationally relevant.


## Cross-repository services

| Provider | Interface | API-repo evidence | Readiness |
|---|---|---|---|
| The Algorithm | Private `POST /v1/feed/rank` | Pinned upstream OpenAPI snapshot; Backend client and candidate validation documented | Provider and consumer interface implemented; staging test required |
| Data Centre platform | Private `/v1/config/*`, `/v1/events`, `/v1/audit` on port 8095 | Pinned provider OpenAPI snapshot and source conformance report | Provider mainline now matches documented methods, 204 write responses and strict object validation; Backend platform typed client and consumer call sites remain absent; DB-backed 204/outage tests remain open |
| Data Centre video | `/v1/videos*`, `/v1/channels*`, `/v1/feed` | Service catalogue only | No client SDK or promoted contract until exact handler DTOs are audited |
| Data Centre notifications | `/v1/devices`, `/v1/notifications`, `/v1/stream` | Service catalogue only | No client SDK or promoted contract until exact handler DTOs are audited |
| CDN | `/v1/*`, HLS/DASH, media aliases, `/route`, restricted purge | Source-audited route contract | Go mainline disables caller-directed URL signing (HTTP 410) and uses trusted Backend-origin classification for public bytes plus forwarded viewer authorization for private bytes; deployed Backend validation, R2 Worker parity, DNS/TLS and live negative tests remain unverified |
| Federation | Public ActivityPub endpoints and private Backend activity/actor interfaces | Pinned public OpenAPI + private OpenAPI + event schema snapshot | Partial; provider OpenAPI description conflicts with registered inbox route; public workers and complete projection/interoperability remain gated |
| Flutter | Public Backend API consumer | Dart client package and public OpenAPI | Consumer integration is downstream; never expose internal APIs |

The complete ownership and source provenance live in [services registry](../contracts/registry/services.json) and [source lock](../contracts/sources.lock.json). See the [Data Centre conformance report](integration/data-centre-platform-contract.md), [CDN delivery contract](integration/cdn-edge-contract.md), and [downstream adoption guide](integration/downstream-adoption-guide.md).
