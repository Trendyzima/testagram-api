# Testagram API Platform

The API contract, compatibility, client SDK and integration-governance repository for Testagram's seven-repository platform.

> **Boundary:** this repository does not replace the Go Backend, own product data, or expose private infrastructure services. The Backend remains the public product API runtime and authority. This repository defines and validates the contract consumed by Flutter and other clients, and coordinates compatibility across services.

## Repository role

- OpenAPI 3.1 contracts for verified public Backend routes.
- Versioning, error-envelope, pagination, authentication and idempotency conventions.
- Typed client SDK foundations and generated-client workflow.
- Contract linting, breaking-change checks, examples and cross-repository integration tests.
- A registry of service ownership and explicitly unimplemented/future capabilities.

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

The OpenAPI document includes only routes and semantics evidenced by the current Backend and Flutter repository documentation. In particular, the main-feed create-post operation is **not** declared because the Flutter migration ledger explicitly says the Backend does not yet register a first-class create-post route. TV catalogue/player, marketplace, advertising, wallet/M-Pesa, admin and several profile/messaging capabilities remain future contract work until their owning services expose and test real endpoints.

See [API capability matrix](docs/capability-matrix.md), [service ownership](docs/architecture/service-ownership.md), and [contract contribution guide](docs/CONTRIBUTING.md).

## Quick start

Requirements: Node.js 22+, npm 10+, Python 3.12+ only for optional tooling.

```sh
npm install
npm run lint:openapi
npm run typecheck
npm test
```

Validate the spec without installing project tooling:

```sh
npx --yes @redocly/cli lint contracts/openapi/testagram-v1.yaml
```

## Layout

- `contracts/openapi/` — versioned OpenAPI source of truth.
- `contracts/schemas/` — reusable JSON schemas.
- `packages/typescript/` — typed fetch client foundation.
- `packages/dart/` — Flutter-facing transport conventions and DTO foundation.
- `docs/` — architecture, ownership, capability status, security and change process.
- `examples/` — safe request/response examples.
- `.github/workflows/` — contract validation and tests.

## Production status

This repository is a contract and integration foundation, not a production API server. It does not deploy a gateway, change DNS, modify the Backend runtime, or enable unfinished product features. A capability is production-ready only when its owning service implementation, contract tests, authentication/authorization tests and end-to-end evidence all pass.

## License

See [LICENSE](LICENSE).
