# Transport, errors and retry semantics

## HTTP conventions

- HTTPS outside local development.
- JSON request/response bodies where an operation declares JSON.
- UTF-8.
- Bearer authentication with Appwrite session JWT for authenticated user operations.
- Preserve server response status and request/correlation identifiers.
- Treat response schemas marked extensible as provisional until Backend wire DTOs are verified.

## Client retry rules

- Safe GET requests may be retried with bounded exponential backoff for transient network errors, 502, 503 and 504.
- Do not blindly retry non-idempotent mutations after an ambiguous timeout.
- Use an idempotency key only where the owning handler explicitly supports it; do not assume universal support.
- Respect 429 and Retry-After.
- Do not retry 400, 401, 403 or 404 without changing the request or authentication state.
- On 401, re-authenticate through Appwrite; do not invent a local token refresh protocol.
- On 403, show an access-denied state; do not substitute cached private content.
- On 5xx, distinguish unavailable from empty data.

## Error payloads

The exact Backend error envelope must be captured from handlers/tests before strict decoding is introduced. The shared schema is deliberately permissive today. Clients must preserve HTTP status even if an error body is missing or malformed.
