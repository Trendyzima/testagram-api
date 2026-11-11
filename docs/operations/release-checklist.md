# API contract release checklist

- [ ] Contract change is backed by owning service implementation and tests.
- [ ] OpenAPI lint passes.
- [ ] Breaking-change diff reviewed.
- [ ] TypeScript typecheck and tests pass.
- [ ] Dart client analysis/tests pass when Dart code changes.
- [ ] Authenticated and unauthenticated behavior verified.
- [ ] Resource-level authorization verified for every mutation and private read.
- [ ] Pagination and rate-limit behavior verified.
- [ ] No private token, internal URL or credential entered public contract or SDK.
- [ ] Flutter compatibility checked against supported release(s).
- [ ] Backend and Data Centre deployment order documented if needed.
- [ ] Rollback and deprecation plan documented.
- [ ] Production endpoint and TLS/DNS verified independently.
