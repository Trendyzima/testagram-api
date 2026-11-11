# Contract contribution guide

## Before changing a route

1. Identify the owning service and inspect its current mainline handler, DTOs and tests.
2. Confirm method, path, auth, request body, response body, status codes and pagination semantics from source/tests.
3. Add or update the OpenAPI operation and stable operationId.
4. Add examples for success and failure cases.
5. Add/adjust SDK types only from the verified schema.
6. Run `npm run check`.
7. For breaking changes, propose a versioned migration and update the compatibility notes.

## Compatibility rules

- Do not remove or repurpose an existing field in a compatible version.
- Additive optional response fields are preferred.
- New required request fields are breaking.
- Enum expansion can break exhaustive clients; document it and ensure clients handle unknown values.
- Preserve cursor opacity. Clients must not parse or synthesize cursors.
- Never change an idempotency key's scope or semantics without a migration.
- A deprecation requires a replacement, a published sunset window and telemetry proving clients have migrated.

## Security

- Public OpenAPI describes public client routes only.
- Never include private URLs, tokens, internal headers, database schemas or staff-only operations in public SDK output.
- Appwrite JWT is an identity credential; authorization remains server-side.
- Avoid logging Authorization headers, cookies, media signed URLs or personal payloads.
- Every mutation must enforce ownership/permission at the Backend.
