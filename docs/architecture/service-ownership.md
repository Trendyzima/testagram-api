# Service ownership and request flow

The API repository is the contract control plane only. It is not in the runtime request path and does not replace the Go Backend.

## Runtime request path

```text
Flutter client -- Appwrite session JWT --> Testagram Backend public API
                                               |
                                               +--> Appwrite Auth (JWT validation)
                                               +--> canonical PostgreSQL product state
                                               +--> Algorithm (private ranking only)
                                               +--> Federation (private ActivityPub protocol API)
                                               +--> Data Centre (private platform/media services; typed Backend client is still a gate)
                                               +--> CDN media URL --> CDN edge/shield --> configured object origin
```

## Ownership

- **Backend:** Appwrite JWT verification, canonical identity, product authorization, canonical social records, public API, media lifecycle and service orchestration.
- **Flutter:** presentation, navigation, device features, Appwrite session acquisition and public Backend transport. No direct private-service or database access.
- **Data Centre:** platform operations, storage nodes, video processing, notification delivery, backups and infrastructure. The platform API exists; Backend's typed client and end-to-end contract tests are not yet verified.
- **CDN:** edge routing, cache/shield and media byte delivery. It does not decide ownership, visibility, quota or retention.
- **Federation:** ActivityPub actor keys/documents, signed inbox, protocol outbox and remote delivery. Backend remains authoritative for local eligibility, visibility and blocks.
- **Algorithm:** ranking only. Backend supplies bounded authorized candidates, validates returned IDs and rechecks visibility before hydrating canonical data.
- **API repo:** OpenAPI, private contract snapshots, source provenance, SDKs, compatibility policy, fixtures and cross-repository CI.

## Authentication

1. User signs in through Appwrite Client SDK.
2. Flutter obtains the Appwrite session JWT.
3. Flutter sends `Authorization: Bearer <JWT>` to Backend.
4. Backend validates the JWT and resolves the linked canonical Testagram identity.
5. Backend authorizes every resource operation.

Service-to-service credentials are separate, directional and server-side only. Never forward an Appwrite JWT as a private service token. Federation public ingress uses ActivityPub HTTP Signatures, not Appwrite authentication.

See [seven-repository architecture](six-repository-architecture.md), [communication flows](../integration/communication-flows.md), and [service-to-service security](../security/service-to-service-security.md).
