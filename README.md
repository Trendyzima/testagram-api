# Testagram API Platform

The API contract, compatibility, client SDK and integration-governance repository coordinating Testagram's six runtime repositories and this contract control plane.

> **Boundary:** this repository does not replace the Go Backend, own product data, or expose private infrastructure services. The Backend remains the public product API runtime and authority. This repository defines and validates the contract consumed by Flutter and other clients, and coordinates compatibility across services.

## Repository role

- OpenAPI 3.1 contracts for verified public Backend routes.
- Versioning, error-envelope, pagination, authentication and idempotency conventions.
- Typed client SDK foundations and generated-client workflow.
- Contract linting, breaking-change checks, examples and cross-repository integration tests.
- A machine-readable registry for all six runtime repositories, pinned provider revisions and source snapshots.
- Cross-repository CI that checks all six immutable source revisions and verifies that vendored contracts match their exact upstream files.

## System ownership

| Repository | Authority |
|---|---|
| [testagram-api](https://github.com/Trendyzima/testagram-api) | API contracts, client SDKs, compatibility rules and integration governance |
| [Testagram Backend](https://github.com/Trendyzima/Testagram-backend-) | Public product API runtime, provider-gated Testagram-native bearer authentication, canonical identity, authorization, PostgreSQL product data and social operations; Appwrite remains a transitional reviewer/compatibility dependency |
| [Flutter Client](https://github.com/Trendyzima/testagram-flutter-client-) | Native UI, local UX state and client transport; product data only through Backend |
| [Data Centre](https://github.com/Trendyzima/Testagram-data-centre-) | Storage, video processing, notifications, infrastructure and operations; private service APIs remain private |
| [CDN](https://github.com/Trendyzima/cdn-) | Media delivery/cache data plane; not a product API or identity authority |
| [Federated Content](https://github.com/Trendyzima/federated-content) | ActivityPub/WebFinger protocol state, signed ingress and federation delivery; private Backend integration |
| [The Algorithm](https://github.com/Trendyzima/the-algorithm) | Private ranking/recommendation; Backend authorizes candidates and hydrates canonical records |

## Critical integration rules

1. Flutter uses the Testagram-owned `NativeAuthClient` and sends short-lived Testagram access tokens to the Backend. Protected end-user routes use native Backend sessions and live PostgreSQL session/account checks; no Appwrite bearer fallback is accepted. Runtime deployment and existing-account reconciliation still require their own staged evidence.
2. Staff review uses native Backend sessions, the encrypted Testagram staff cookie and PostgreSQL staff-role/MFA records. Historical account identifiers are reconciliation inputs only; they are not accepted as user or staff bearer credentials. Never treat this repository, a generated SDK, or a client-side claim as an authorization boundary.
3. Flutter must not call PostgreSQL, object storage, private Data Centre endpoints, Federation, or Algorithm directly.
4. CDN media URLs are for byte delivery; media ownership, upload authorization and attachment to posts remain Backend-controlled.
5. Private service tokens must never enter mobile/web bundles, public OpenAPI schemas, generated SDKs or client examples.
6. Do not introduce external cache, queue or product-data services without an approved Testagram architecture decision.
7. Do not invent success responses or silently fall back to another service when an operation is not implemented.

## Verified contract status

The public OpenAPI contract includes a source-audited core route set. Backend mainline registers `POST /api/social/posts` for main-feed publishing; this is distinct from the Threads composer. The six-repository registry also tracks private Algorithm, Data Centre and Federation contracts plus CDN delivery semantics. Their source ownership and readiness are not conflated: Backend-to-Data-Centre typed client integration remains outstanding; Federation workers and CDN production wiring remain gated. Media, TV catalogue/player, marketplace, advertising, wallet/M-Pesa, admin and several profile/messaging capabilities remain registered-only or future work until their DTOs, authorization and tests are audited.

See [API capability matrix](docs/capability-matrix.md), [service ownership](docs/architecture/service-ownership.md), and [contract contribution guide](docs/CONTRIBUTING.md).

## Quick start

Requirements: Node.js 22+, npm 10+, Python 3.12+ only for optional tooling.

```sh
npm install
npm run sources:checkout
npm run check
```

Validate the spec without installing project tooling:

```sh
npx --yes @redocly/cli lint contracts/openapi/testagram-v1.yaml
```

## Layout

- `contracts/openapi/` — public Backend OpenAPI contract.
- `contracts/internal/openapi/` — private Backend/Algorithm/Federation/Data Centre contracts; never export these to Flutter.
- `contracts/upstream/` — immutable, read-only provider contract snapshots.
- `contracts/registry/` and `contracts/sources.lock.json` — six-service registry and pinned upstream provenance.
- `contracts/schemas/` — reusable JSON schemas.
- `packages/typescript/` — typed fetch client foundation, nested Backend error handling and idempotent post helper.
- `packages/dart/` — reusable Dart HTTP client package with Testagram-native bearer transport and tests.
- `docs/` — seven-repository topology, ownership, integration flows, downstream adoption, security, provider conformance audits, capability status and release gates.
- `examples/` — safe request/response examples.
- `.github/workflows/` — OpenAPI, TypeScript, Dart, Backend route inventory and six-repository snapshot validation.

## Production status

This repository is a contract and integration foundation, not a production API server. It does not deploy a gateway, change DNS, modify the Backend runtime, or enable unfinished product features. A capability is production-ready only when its owning service implementation, contract tests, authentication/authorization tests and end-to-end evidence all pass.

## License

See [LICENSE](LICENSE).
