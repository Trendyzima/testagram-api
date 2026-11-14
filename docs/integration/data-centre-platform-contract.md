# Data Centre private platform API conformance report

**Provider:** `Trendyzima/Testagram-data-centre-`  
**Listener:** private `:8095` (`PLATFORM_ADDR`)  
**Provider OpenAPI:** `contracts/upstream/datacentre/internal-platform.openapi.yaml`  
**Reviewed provider mainline:** `acf3911b63477cd9f4eee62e2c4c711c6e8ba4e4`  
**Status:** provider method, response and validation behavior now match the pinned OpenAPI for the inspected routes. The Backend consumer is still not implemented/verified, so the service-to-service edge is not end-to-end complete.

## Verified provider behavior

| Path | Contract | Source evidence |
|---|---|---|
| `GET /healthz` | 200 plain-text liveness | Explicit GET guard |
| `GET /readyz` | 200 or 503 based on PostgreSQL readiness | Explicit GET guard and database ping |
| `GET /metrics` | 200 Prometheus text | Explicit GET guard |
| `POST /v1/config/set` | Bearer-authenticated JSON; 204 on success | Explicit POST guard, strict decoder, constant-time bearer comparison, 204 response |
| `GET /v1/config/{key}` | Public and enabled config only | Explicit GET guard; key validation and public/enabled SQL predicate |
| `POST /v1/events` | Bearer-authenticated JSON; 204 on success | Explicit POST guard; event name bounds and object-only properties |
| `POST /v1/audit` | Bearer-authenticated JSON; 204 on success | Explicit POST guard; non-empty action/resource fields and object-only metadata |

The provider requires `PLATFORM_INTERNAL_TOKEN` at startup and rejects values shorter than 32 non-whitespace characters. Request bodies are bounded to 1 MiB, unknown JSON fields and trailing JSON values are rejected, and authorization uses constant-time comparison.

## Tests present in provider mainline

`backend/services/platform/main_test.go` covers:
- method guards and `Allow` headers for all public handlers;
- bearer scheme and token validation;
- bounded, single-object JSON decoding and rejection of unknown/trailing fields;
- object-only event properties and audit metadata;
- key validation and length bounds.

## Remaining provider test gap

The current unit suite does not include a database-backed successful handler test asserting the exact `204 No Content` behavior for config, event and audit writes, nor a database outage integration test. Add these when a deterministic PostgreSQL test harness is available. Do not describe these untested cases as verified.

## Backend consumer gap — still open

The Backend currently has a typed `internal/datacentreclient` for the **media lifecycle API** (`:8096`), not this **platform API** (`:8095`). Its Compose configuration and environment example do not expose a `PLATFORM_API_URL` / `PLATFORM_INTERNAL_TOKEN` connection, and no Backend call to `/v1/config/set`, `/v1/events`, `/v1/audit` was found in the inspected mainline.

Before this edge can be marked integrated:
1. Decide which Backend-owned workflows actually require platform config, event intake or audit intake; do not add a generic dependency that makes core posting/authentication fail when the platform service is unavailable.
2. Add a bounded typed Backend client with HTTPS/private-network validation, minimum 32-character token enforcement, redirect rejection, request IDs, response/body limits and explicit timeouts.
3. Wire only justified producer call sites. Audit records must not contain credentials, JWTs, raw evidence, private post content or signed URLs. Define whether each call is synchronous, best-effort or backed by a durable outbox.
4. Add consumer/provider contract tests, including wrong method, unauthorized, malformed payload, 204 success, timeout and provider outage.
5. Add private Compose network wiring and separate server-only credentials; never expose the platform token to Flutter or OpenAPI public SDKs.

## Integration boundary

The platform service owns infrastructure configuration, platform event intake and audit intake. It is not the user/product API. It must not decide user identity, post visibility, media ownership, quota, retention or user authorization. The separate Data Centre media service and Backend `datacentreclient` must not be confused with this platform API.
