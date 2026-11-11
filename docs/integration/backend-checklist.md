# Backend integration checklist

The route-registration inventory is checked in CI against the exact Backend commit pinned in `contracts/sources.lock.json`. This prevents an unreviewed upstream change from silently changing the API repository's evidence. This verifies route existence and HTTP methods; it does **not** prove deployed availability or fully type every response.

- [x] Confirm source listener default: `:8080` (`LISTEN_ADDR`).
- [x] Confirm `GET /healthz` and `GET /readyz` return plain text, not JSON.
- [x] Confirm Appwrite JWT is the client identity token and Backend owns authorization.
- [x] Confirm core route methods and the route-specific follow paths.
- [x] Confirm feed query names and bounds: `following_only`, `before`, `limit=1..50`.
- [x] Confirm search query names and bounds: `q=2..120`, `kind`, `limit=1..50`, `media_only`.
- [x] Confirm main-feed create-post route: `POST /api/social/posts`, `Idempotency-Key`, `content`, `visibility`.
- [x] Confirm Backend error envelope shape: nested `error.code` and `error.message`, plus `request_id`.
- [ ] Confirm every response DTO and all mutation status codes from handler tests.
- [ ] Confirm cursor encoding, page metadata and pagination behavior per operation.
- [ ] Add executable HTTP contract tests against a disposable PostgreSQL/Appwrite test environment.
- [ ] Verify production hostname, DNS, TLS and runtime health; the OpenAPI server URL is intended, not live-verified.
- [ ] Promote registered-only operations only after auth, DTO and test evidence is linked.

See [source route audit](backend-route-audit.md), [route inventory](../../contracts/route-inventory/backend-public-routes.json), [six-repository registry](../../contracts/registry/services.json), and [release gates](../operations/cross-repository-release-gates.md).
