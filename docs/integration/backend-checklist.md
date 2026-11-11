# Backend integration checklist

Before treating this contract as canonical, reconcile every operation with the Backend mainline source:

- [ ] Confirm actual listener/base path and production API hostname.
- [ ] Confirm /healthz and /readyz response status/body.
- [ ] Confirm Appwrite JWT middleware behavior and public exceptions.
- [ ] Confirm actual route registrations and HTTP methods.
- [ ] Confirm query parameter names, accepted enums and defaults.
- [ ] Confirm request/response DTOs and error envelope from handler tests.
- [ ] Confirm whether 200, 201 or 204 is returned for each mutation.
- [ ] Confirm cursor format and pagination fields.
- [ ] Confirm rate-limit behavior and Retry-After header.
- [ ] Confirm request ID header name.
- [ ] Add backend-driven contract tests and CI integration.
- [ ] Remove provisional descriptions and replace ExtensibleObject with strict DTOs only after verification.

Current known route inventory is taken from Backend README and Flutter migration documentation. It is not a substitute for source-level route inspection.
