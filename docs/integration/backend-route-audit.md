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

## Registered-only surfaces requiring a deeper contract pass

- Authentication: `POST /api/auth/{signup,resend-verification,verify-email,login,forgot-password,reset-password}`.
- Profiles, profile posts/connections, follow requests and blocks.
- Post reads, views, reaction state and interaction lists.
- Polls and browsing history.
- Thread media attachment, delete, likes, reposts and bookmarks.
- Media upload intent, bounded `PUT /api/media/upload`, completion, attachment, delete, private download URL and list.
- TV health and the generic capability dispatcher.
- Federation preference routes and M-Pesa callback are registered but have distinct security/ownership concerns; do not treat them as ordinary client SDK endpoints.

## Remaining source-level work

The exact success and failure status codes, all response DTOs, media attachment semantics, pagination fields, and authorization tests still need a handler-by-handler contract pass. The OpenAPI document intentionally does not pretend those shapes are fully typed yet.
