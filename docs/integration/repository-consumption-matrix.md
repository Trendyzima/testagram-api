# Seven-repository integration map (API control plane + six runtime repositories)

There are seven repositories in the Testagram system: this API repository plus six runtime repositories. This API repository is the shared contract/SDK authority. It is not a proxy, service mesh, data store, or runtime replacement for the Backend.

| Repository | Consume from this API repo | Must not do |
|---|---|---|
| [Testagram Backend](https://github.com/Trendyzima/Testagram-backend-) | Validate route inventory against OpenAPI; publish DTO/handler changes with contract updates; run route audit in CI | Move canonical business logic or PostgreSQL ownership into this repo |
| [Flutter Client](https://github.com/Trendyzima/testagram-flutter-client-) | Use the OpenAPI contract and Dart transport package after release; send Appwrite JWT; consume only contracted operations | Call PostgreSQL, storage credentials, CDN origin APIs, Algorithm, Federation internals or Data Centre private APIs |
| [Data Centre](https://github.com/Trendyzima/Testagram-data-centre-) | Align private service-to-service schemas and operational event contracts where explicitly published | Expose storage nodes, workers, credentials, queues or admin endpoints as public client APIs |
| [CDN](https://github.com/Trendyzima/cdn-) | Align media delivery URL, cache invalidation and origin metadata semantics with Backend-owned media DTOs | Authenticate users, authorize uploads, or become the canonical media metadata owner |
| [Federated Content](https://github.com/Trendyzima/federated-content) | Align signed inbox/outbox and Backend-to-Federation private integration schemas in a separate internal contract namespace | Let Flutter call Federation directly or publish internal tokens |
| [The Algorithm](https://github.com/Trendyzima/the-algorithm) | Align private ranking request/response schemas used by Backend orchestration | Receive client JWTs or become the authority for post visibility/authorization |

## Integration order

1. Merge and tag a reviewed API contract release; do not pin clients to a moving branch.
2. Update Backend CI to run the route-inventory check and update the contract in the same change as route/DTO changes.
3. Integrate Flutter against the released Dart package and only the contracted route set. Add a contract test for each migrated screen.
4. Integrate media delivery between Backend, Data Centre and CDN using server-side credentials only.
5. Integrate Federation and Algorithm through private service contracts, never through the public client SDK.
6. Run cross-repository acceptance tests before any production cutover.

## Versioning

- OpenAPI major version changes only for incompatible public behavior.
- Additive optional fields and new operations are minor changes when backward compatible.
- Bug fixes and documentation-only changes are patch changes.
- Every client release should pin a Git tag or immutable commit, not `main`.
- A route is not stable solely because it appears in the route inventory; only `contracted` operations are approved for client use.
