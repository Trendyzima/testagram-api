# Backend route audit

**Audit basis:** `Trendyzima/Testagram-backend-` `main`, `cmd/api/main.go`, plus the route handlers listed below. This is a source-registration audit, not proof that production DNS or a deployed runtime is healthy.

## Corrections made to the API contract

- `GET /healthz` returns `text/plain` (`ok\n`), not JSON.
- `GET /readyz` returns `text/plain` (`ready\n`) when PostgreSQL is reachable and a plain-text 503 otherwise.
- `GET /api/feed/home` accepts `following_only` (boolean), `before` (opaque cursor) and `limit` (1–50, default 20). The previous `filter`/`cursor` names and 100-item bound were wrong.
- `GET /api/search` accepts `q` (2–120 characters), `kind` (`all|people|posts`), `limit` (1–50) and `media_only`. Authentication is optional for public search results.
- Follow state and unfollow are target-scoped: `GET|DELETE /api/social/follows/{target_user_id}`; follow creation is `POST /api/social/follows` with `target_user_id`.
- The Backend registers `POST /api/social/posts` for main-feed post creation. It requires an `Idempotency-Key` header and JSON `content` plus `visibility`. This is distinct from `/api/threads`. The Flutter README's statement that `/api/posts` is absent refers to a different path; use the registered `/api/social/posts` route after Flutter integration tests are added.
- Backend errors use the envelope `{ ok: false, data: null, error: { code, message }, request_id }`; the request ID is also returned in `X-Request-ID`.
- The TypeScript SDK now reads the nested Backend error message and request ID.

## Route promotion policy

`contracts/route-inventory/backend-public-routes.json` inventories static client-facing route registrations. Entries marked `contracted` have OpenAPI path/method coverage. Entries marked `registered-only` are known to exist in Backend source but are **not yet approved as stable client contracts**. Do not call them from Flutter or expose them in generated SDKs until DTOs, authorization, error behavior and tests are audited.

The inventory check clones Backend main during CI and fails if:
1. a static public route is added or removed without updating the inventory;
2. an inventoried route no longer exists in Backend source;
3. a route marked `contracted` is missing from OpenAPI; or
4. the dynamic authentication route registration changes without an explicit audit update.

## Flutter-used operations promoted from registered-only

The current Flutter client calls the following surfaces. They have now been promoted into OpenAPI with handler-derived request bounds, response envelopes, authentication requirements, privacy behavior, and principal status codes:

- Capability dispatch: `POST /api/capability` (generic capability-specific data remains extensible; new clients should prefer first-class routes).
- Polls: `GET|POST /api/social/polls`, `GET /api/social/polls/{poll_id}`, and `POST /api/social/polls/{poll_id}/vote`.
- Post detail and interaction listing: `GET /api/social/posts/{post_id}` and `GET /api/social/posts/{post_id}/interactions/{kind}`.
- Profiles: `GET /api/social/profiles/{user_id}`, `GET /api/social/profiles/{user_id}/connections`, and `GET /api/social/profiles/{user_id}/posts`.
- Threads: `POST /api/threads/{thread_id}/likes/toggle`, `POST /api/threads/{thread_id}/reposts/toggle`, `POST /api/threads/{thread_id}/bookmarks/toggle`, and `POST /api/threads/{thread_id}/media`.

These DTOs are based on the pinned Backend handlers, not guessed from UI models. The route inventory is method-specific; adding a route with a different HTTP method still requires a separate contract entry.

## Remaining registered-only surfaces

- Authentication: `POST /api/auth/{signup,resend-verification,verify-email,login,forgot-password,reset-password}`.
- Follow requests, blocks, browsing history, profile avatar upload, and other social administration routes not called by the current Flutter boundary.
- Post views, poll-by-post lookup, reaction state, repost state, and other operations not directly adopted by the Flutter client.
- Thread delete/list/state endpoints not yet adopted by the Flutter boundary.
- Media upload intent, bounded `PUT /api/media/upload`, completion, attachment, delete, private download URL and list.
- TV health (private monitor endpoints remain outside the public contract).
- Federation preference routes and M-Pesa callback have distinct security/ownership concerns; do not treat them as ordinary client SDK endpoints.

## Remaining source-level work

This promotion establishes a stronger client contract baseline, but it does not replace handler-level integration tests against a running Backend. In particular, the generic capability response remains extensible, media URLs/headers are viewer-scoped, and the live runtime must still be tested for auth, privacy, pagination, conflict, rate-limit and dependency-failure behavior. The route audit is source-level evidence, not production availability evidence.
