# API capability and readiness matrix

Status labels: **documented** means repository documentation identifies a route; it does not mean this repository independently verified a live deployment. **Not contracted** means no route is declared here until an owner supplies an implementation and tests.

| Capability | Known route/surface | Owning service | Contract status | Notes |
|---|---|---|---|---|
| Process health | GET /healthz | Backend | Documented | Liveness only |
| Readiness | GET /readyz | Backend | Documented | Dependency readiness |
| Home feed | GET /api/feed/home | Backend | Documented | Following filter and opaque cursor |
| Post interaction summary | GET /api/social/posts/{id}/interaction-summary | Backend | Documented | Viewer state and counters |
| Reaction lifecycle | POST/DELETE /api/social/posts/{id}/reaction | Backend | Documented | Verify payload fields/enums |
| Repost lifecycle | POST/DELETE /api/social/posts/{id}/reposts | Backend | Documented | |
| Bookmark lifecycle | POST/DELETE /api/social/posts/{id}/bookmarks | Backend | Documented | |
| Replies | GET/POST /api/social/posts/{id}/replies | Backend | Documented | |
| Search | GET /api/search | Backend | Documented | Privacy-filtered |
| Follow graph | GET/POST/DELETE /api/social/follows... | Backend | Documented | Exact query/body shapes need handler verification |
| Notifications | GET /api/social/notifications | Backend | Documented | |
| Mark notification read | POST /api/social/notifications/{id}/read | Backend | Documented | |
| Threads | GET/POST /api/threads and thread interactions | Backend | Documented | Separate product surface |
| Main feed post creation | None verified | Backend | **Not implemented/contracted** | Do not fake it with Threads |
| Main feed media lifecycle | No complete public contract verified | Backend + Data Centre + CDN | Not contracted | Backend must own upload authorization and post attachment |
| TV catalogue/player/studio | No public client route verified | Backend + Data Centre + CDN | Not contracted | Private video services stay private |
| Ads/creator marketplace | No public route verified | Backend | Not contracted | Include billing, consent and moderation controls only after owner design |
| Marketplace/orders/wallet/M-Pesa | No public route verified | Backend | Not contracted | Payment state must be server-authoritative and idempotent |
| Admin/moderation | No public route verified | Backend | Not contracted | Staff-only auth and audit requirements |
| Federation | Public ActivityPub routes belong to Federation service | Federation + Backend | Separate protocol boundary | Do not expose private federation internals to clients |

## Promotion gate

A row may move to production-ready only after all of the following are linked:

1. Owning implementation route and handler.
2. OpenAPI request/response schemas copied from actual DTOs, not guessed.
3. Authentication and resource-level authorization tests.
4. Contract tests run against the owner service.
5. Client integration and failure-state tests.
6. Observability, rate-limit and rollback plan where relevant.
