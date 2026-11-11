# Testagram API Platform

The API contract, compatibility, client SDK and integration-governance repository coordinating Testagram's six runtime repositories.

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
| [Testagram Backend](https://github.com/Trendyzima/Testagram-backend-) | Public product API runtime, Appwrite JWT validation, canonical identity, authorization, PostgreSQL product data and social operations |
| [Flutter Client](https://github.com/Trendyzima/testagram-flutter-client-) | Native UI, local UX state and client transport; product data only through Backend |
| [Data Centre](https://github.com/Trendyzima/Testagram-data-centre-) | Storage, video processing, notifications, infrastructure and operations; private service APIs remain private |
| [CDN](https://github.com/Trendyzima/cdn-) | Media delivery/cache data plane; not a product API or identity authority |
| [Federated Content](https://github.com/Trendyzima/federated-content) | ActivityPub/WebFinger protocol state, signed ingress and federation delivery; private Backend integration |
| [The Algorithm](https://github.com/Trendyzima/the-algorithm) | Private ranking/recommendation; Backend authorizes candidates and hydrates canonical records |

## Critical integration rules

1. End-user clients authenticate with Appwrite and send the resulting Appwrite session JWT to the public Backend API.
2. The Backend validates identity and owns authorization. Never treat this repository, a generated SDK, or a client-side claim as an authorization boundary.
3. Flutter must not call PostgreSQL, object storage, private Data Centre endpoints, Federation, or Algorithm directly.
4. CDN media URLs are for byte delivery; media ownership, upload authorization and attachment to posts remain Backend-controlled.
5. Private service tokens must never enter mobile/web bundles, public OpenAPI schemas, generated SDKs or client examples.
6. Do not add Supabase, Redis/Valkey or Upstash runtime dependencies. Existing platform architecture explicitly excludes them.
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
- `contracts/upstream/` — immutable, read-only provider contract snapshots.
- `contracts/registry/` and `contracts/sources.lock.json` — six-service registry and pinned upstream provenance.
- `contracts/schemas/` — reusable JSON schemas.
- `packages/typescript/` — typed fetch client foundation, nested Backend error handling and idempotent post helper.
- `packages/dart/` — reusable Dart HTTP client package with Appwrite JWT transport and tests.
- `docs/` — six-repository topology, ownership, integration flows, security, capability status and release gates.
- `examples/` — safe request/response examples.
- `.github/workflows/` — OpenAPI, TypeScript, Dart, Backend route inventory and six-repository snapshot validation.

## Production status

This repository is a contract and integration foundation, not a production API server. It does not deploy a gateway, change DNS, modify the Backend runtime, or enable unfinished product features. A capability is production-ready only when its owning service implementation, contract tests, authentication/authorization tests and end-to-end evidence all pass.

## License

See [LICENSE](LICENSE).
