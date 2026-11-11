# API contract release checklist

- [ ] Contract change is backed by owning service implementation and tests.
- [ ] Backend route inventory audit passes against the intended Backend ref.
- [ ] OpenAPI lint and bundle pass.
- [ ] Breaking-change diff reviewed against the previous released OpenAPI file.
- [ ] TypeScript typecheck, package build and tests pass.
- [ ] Dart package analysis and tests pass when Dart code changes.
- [ ] Authenticated and unauthenticated behavior verified.
- [ ] Resource-level authorization verified for every mutation and private read.
- [ ] Pagination and rate-limit behavior verified.
- [ ] No private token, internal URL or credential entered public contract or SDK.
- [ ] Flutter compatibility checked against supported release(s).
- [ ] Backend and Data Centre deployment order documented if needed.
- [ ] Rollback and deprecation plan documented.
- [ ] Production endpoint, TLS and DNS verified independently.
- [ ] Release tag points to the reviewed commit; downstream repositories pin the tag/commit, not main.
