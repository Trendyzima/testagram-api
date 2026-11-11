# Contract contribution guide

## Before changing a route

1. Identify the owning service and inspect its pinned source revision, current handler, DTOs and tests.
2. Confirm the provider repository owns the implementation and source contract. Do not move business logic into this repository.
3. Update `contracts/sources.lock.json` when intentionally advancing a provider revision; refresh upstream snapshots from that exact commit only.
4. Update `contracts/registry/services.json` and the relevant integration flow/status when an interface or readiness state changes.
5. Confirm method, path, auth, request body, response body, status codes and pagination semantics from source/tests.
6. Add or update the OpenAPI operation and stable operationId.
7. Add examples for success and failure cases.
8. Add/adjust SDK types only from the verified schema.
9. Run `npm run sources:checkout` and `npm run check`.
10. For breaking changes, propose a versioned migration and update the compatibility notes.

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
