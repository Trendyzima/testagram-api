# Service ownership and request flow

## Client request path

```text
Flutter / Web / TV client
        |
        | Appwrite session JWT (Bearer)
        v
Testagram Backend public API
        |
        +--> canonical PostgreSQL identity, product records, privacy and authorization
        |
        +--> private Data Centre APIs / durable events for storage, video and notifications
        |
        +--> private Federation API for ActivityPub protocol operations
        |
        +--> private Algorithm service for candidate ordering only
        |
        +--> media URL returned to client --> Testagram CDN data plane --> authorized origin/object storage
```

The API contract repository is not in the runtime request path. It is the versioned agreement and tooling layer used to keep the Backend, Flutter and service integrations compatible.

## Non-negotiable ownership

- Backend: Appwrite JWT verification, identity mapping, product authorization, canonical social data, public product API.
- Data Centre: storage nodes, video processing, notification delivery, control plane, backups and infrastructure.
- CDN: cache and byte delivery. It does not decide whether a user owns or may attach media.
- Federation: ActivityPub actors, signatures, inbox/outbox protocol state and remote delivery. Backend remains authoritative for local user eligibility and content visibility.
- Algorithm: ranking only. Backend rechecks visibility and hydrates canonical data.
- Flutter: presentation, navigation, device features and transport. No direct private-service or database access.
- API repo: OpenAPI, compatibility policy, SDK foundations, examples, contract and integration tests.

## Auth

1. User signs in through Appwrite Client SDK.
2. Client obtains the Appwrite session JWT.
3. Client sends `Authorization: Bearer <JWT>` to Backend.
4. Backend validates the JWT with Appwrite and resolves the linked canonical Testagram identity.
5. Backend authorizes every resource operation. Unknown/unlinked identities fail closed.

Do not copy Appwrite secrets or private service credentials into clients or this repository.
