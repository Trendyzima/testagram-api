# Data Centre private platform API conformance report

**Provider:** `Trendyzima/Testagram-data-centre-`  
**Listener:** private `:8095` (`PLATFORM_ADDR`)  
**Provider OpenAPI snapshot:** `contracts/upstream/datacentre/internal-platform.openapi.yaml`  
**Status:** provider routes exist, but source/spec discrepancies and the missing Backend typed client prevent this interface from being marked integration-ready.

## Registered interface

| Path | Intended method | Behavior | Authentication |
|---|---|---|---|
| `/healthz` | GET probe | Plain-text process liveness | None |
| `/readyz` | GET probe | PostgreSQL readiness | None |
| `/metrics` | GET probe | Prometheus text | Private network only |
| `/v1/config/set` | POST | Insert/update versioned feature flag | `PLATFORM_INTERNAL_TOKEN` bearer |
| `/v1/config/{key}` | GET | Read only enabled, public configuration | Public key/value only |
| `/v1/events` | POST | Store platform event intake | `PLATFORM_INTERNAL_TOKEN` bearer |
| `/v1/audit` | POST | Store audit record | `PLATFORM_INTERNAL_TOKEN` bearer |

## Source/spec discrepancies found

These are findings from comparing `backend/services/platform/main.go` with the provider's `docs/platform/openapi/internal-platform.yaml`. The upstream snapshot is preserved byte-for-byte; this report does not silently rewrite the provider's contract.

1. **Feature flag write status:** the OpenAPI snapshot declares HTTP 204, but the handler calls `writeJSON` and returns HTTP 200 with `{"ok":true}`.
2. **Method enforcement:** the mux registers generic path handlers (`/v1/config/set`, `/v1/events`, `/v1/audit`, `/v1/config/`) rather than method-qualified Go ServeMux patterns. The handlers do not explicitly reject unexpected methods with 405. The OpenAPI method restriction is therefore not enforced by the current handler.
3. **Event/audit schema:** implementation validates required names/actions and JSON validity, but does not enforce every schema constraint currently declared in OpenAPI (for example, object type for `properties`/metadata and all required non-empty identifiers).
4. **Platform credential:** `PLATFORM_INTERNAL_TOKEN` is required at startup and compared in constant time, but the provider does not currently enforce the same 32-character minimum required by the other internal service clients.

## Required provider corrections before typed client generation

- Add explicit method guards and stable 405 responses.
- Align `/v1/config/set` response code/body with the OpenAPI contract (prefer one documented response shape).
- Enforce strict JSON object types and every documented required field/length.
- Enforce a high-entropy minimum token length and document rotation.
- Add handler tests for wrong methods, malformed/oversized payloads, unauthorized calls, database outage and exact response envelopes.
- Publish the corrected provider OpenAPI and update the pinned source revision only after those tests pass.

## Integration boundary

This service owns infrastructure configuration, platform event intake and audit intake. It is not the user/product API. It must not decide user identity, post visibility, media ownership, quota, retention or user authorization.

The Backend's six-repository architecture document explicitly states that a verified typed Backend-to-Data-Centre client is not yet present. Do not make Flutter call this API or mark the Backend/Data Centre integration complete until the provider corrections, typed client and producer/consumer contract tests are merged together.
