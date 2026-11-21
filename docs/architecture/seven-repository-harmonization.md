# Seven-repository architecture and contract baseline

Status: review baseline; not production cutover authorization.
Reviewed: 2026-11-16.

This document is the authoritative architecture baseline for the seven Testagram repositories. It separates six runtime repositories from the API contract control plane. It does not combine repositories, transfer ownership, or authorize deployment.

## Repository boundaries

| Repository | Owns | Must not own |
|---|---|---|
| `testagram-flutter-client-` | Flutter UI, navigation, device capabilities, local presentation state, public Backend transport and secure storage of the native refresh credential | Canonical identity, authorization, PostgreSQL access, private service credentials, direct Algorithm/Federation/Data Centre calls |
| `Testagram-backend-` | Canonical Testagram identity, account state, product authorization, social graph, posts, media ownership/visibility/quota/retention, public API, transactional outboxes and orchestration | CDN byte delivery, remote ActivityPub protocol implementation, independent ranking policy, infrastructure provider control plane |
| `Testagram-data-centre-` | Instabox/VPS operations, storage providers, media processing, replica evidence, backup/restore, node agents, notifications and private infrastructure APIs | User identity, post visibility, social graph, media ownership, quota or product retention policy |
| `cdn-` | Edge/media byte delivery, cache and shield behavior, HLS/DASH manifests and segments, range handling, origin authentication and short-lived media assertion verification | User login, canonical asset ownership, visibility decisions, grants, quota or retention |
| `federated-content` | ActivityPub protocol actors, keys, inbox/outbox, signature verification, remote delivery and protocol state | Local account creation, local follow authority, canonical blocks, post visibility or local moderation decisions |
| `the-algorithm` | Ranking a bounded candidate set supplied by Backend and returning only candidate identifiers | Candidate authorization, canonical post hydration, account permissions, visibility or moderation |
| `testagram-api` | Public/private OpenAPI, event schemas, service contracts, SDKs, immutable source pins, snapshots, fixtures and cross-repository compatibility CI | Runtime requests, product data, user sessions, secrets or authorization decisions |

The six runtime repositories remain independently versioned and deployed. The seventh repository, `testagram-api`, is a build-time contract control plane, not a seventh runtime service.

## Identity and authentication boundary

### Canonical ownership

Backend is the only authority that creates canonical Testagram accounts and decides whether an account is active. Native registration is an application and review workflow, not an account-creation shortcut:

1. The applicant submits an idempotent registration application and required declarations.
2. Verification evidence is uploaded to private storage and submitted for review.
3. Review requires the configured independent approvals; a single reviewer or client assertion cannot provision an account.
4. Backend validates the approved state and performs one-time provisioning transactionally.
5. Only after provisioning can the account use the native login/session lifecycle.

Application tokens, verification-session tokens, reviewer capabilities, access tokens and refresh tokens are different credentials with different audiences and lifetimes. They must never be interchangeable.

### Native user sessions

- Flutter uses Testagram-owned auth pages and the Backend native auth endpoints. It does not acquire a session from an external identity provider.
- Access tokens are short-lived. Refresh credentials are stored using platform secure storage, rotated on refresh and revocable server-side.
- Backend validates signature, issuer, audience, expiry, session state, revocation and canonical account status before authorizing a request.
- Native mode must fail closed. A native-token validation failure must never fall back to an external identity provider.
- The Backend retirement change removes the legacy identity and media adapter packages from the native runtime. Historical migration records are retained only to migrate and preserve prior attribution; they are not authentication providers or fallback paths. The legacy `/api/auth/registration-consent` route is not the native registration or account-provisioning authority.
- Production activation, controlled staff enrollment, reviewer/admin WebAuthn and the live Admin Console-to-Backend readiness contract remain separate release gates. Do not infer production activation from merged source code.

### Contract drift that must be resolved

`contracts/openapi/testagram-v1.yaml` now declares `testagramBearer` for authenticated user and staff operations. Public login, refresh, recovery and applicant-scoped identity operations explicitly declare `security: []`. Staff review operations require a native Backend token with the Backend-issued recent `mfa_at` elevation. Keep each operation classified as public, native-user, reviewer/admin or service-to-service, and require matching Backend enforcement and tests before publishing SDKs.

Do not apply one global security requirement to every operation: public identity enrollment, applicant-scoped capabilities, reviewer/admin routes and service-to-service endpoints have different security requirements.

## Canonical request paths

### Flutter to Backend

Flutter calls only the public Backend API for product operations. It sends the native Testagram access token for authenticated user operations. It never receives service credentials or direct storage-provider credentials. No private service hostname is embedded in a client build.

### Backend to Algorithm

Backend sends a bounded, already-authorized candidate set to the private ranking API. Algorithm may reorder or filter only IDs in that submitted set. Backend validates returned IDs and rechecks visibility, blocks, follows, moderation and account state before hydrating canonical content. Ranking failure may use only an explicit Backend-owned fallback policy.

### Backend to Federation

Backend commits canonical posts and federation outbox events atomically. Federation receives idempotent activities through its private ingress contract and resolves local actors through private Backend endpoints. Directional service credentials are independent. Federation must not create local users or mutate local follows without Backend authorization. Remote inbox/outbox activation remains gated on signature, replay, consent, idempotency, durability and interoperability acceptance.

### Backend to Data Centre

Backend owns media intent and product policy. Data Centre performs storage and infrastructure work under private, versioned contracts. Replica acceptance requires independent byte-count and SHA-256 read-back evidence; a successful upload response or CDN cache entry is not proof of durable replication. Keep media activation disabled until authenticated provider write/read/hash/delete and restore drills pass.

### Backend to CDN and object origin

Backend decides asset ownership, visibility, quota, retention and deletion, then issues public URLs or short-lived viewer-bound assertions. CDN verifies the assertion and origin authentication and delivers bytes; it does not mint grants or decide visibility. Private responses must bypass shared cache and use private/no-store semantics. Public caching is allowed only after Backend has explicitly authorized the asset as public. Range, content-type, playlist and segment expiry behavior must be preserved.

### Data Centre and CDN

Data Centre manages storage and processing; CDN delivers bytes. CDN cache is not a replica and cannot satisfy backup or retention requirements. Object origin credentials remain server-side and distinct from user/viewer assertions.

## Shared interface rules

- Version public and private contracts explicitly; reject unsupported versions.
- Use strict request/response schemas, bounded bodies, bounded batches, deadlines and bounded concurrency.
- Use a distinct high-entropy credential per service direction and audience. Never forward a user token as a service credential.
- Propagate request IDs across service hops. Never log access/refresh tokens, service credentials, signed URLs, evidence contents or raw authorization headers.
- Retries must be bounded and limited to idempotent operations or operations protected by idempotency keys.
- Acknowledgement means durable acceptance only where the receiving contract says so.
- Preserve account suspension, blocks, moderation, privacy and deletion tombstones across caches, projections, federation and media delivery.
- Readiness must include required dependencies; liveness alone is not readiness.
- Producer, consumer, OpenAPI/schema, fixtures, SDKs and contract tests change together.

## Current integration gates

1. **Auth/OpenAPI alignment:** classify every operation and verify native user, staff elevation, public and service-to-service enforcement against matching handlers and tests.
2. **Client contract:** verify Flutter login, registration, verification, recovery, refresh rotation, logout, revoked sessions and expired-session UX against Backend.
3. **Reviewer boundary:** verify staff authentication, MFA, least privilege, two-person approval, evidence access audit and reviewer token separation from user sessions.
4. **Data Centre:** verify the actual platform route inventory against Backend typed clients; prove provider operations and replica read-back.
5. **CDN:** prove production hostname, trusted origin, viewer assertion, private-cache bypass, public visibility header, ranges and deletion behavior in staging.
6. **Federation:** prove actor resolution, directional credentials, durable outbox, signature/replay protection, consent and remote interoperability.
7. **Algorithm:** prove candidate-subset enforcement, bounded response size, timeout behavior, fallback and Backend post-ranking authorization recheck.
8. **Release provenance:** refresh immutable source pins and snapshots only from reviewed commits; run each repository's CI and cross-repository contract tests against the same pinned revisions.

## Release policy

All work remains in reviewable, unmerged pull requests until the owner approves it. No PR merge, production deployment, secret rotation, database migration execution, DNS cutover or feature activation is authorized by this document. A green repository CI is necessary but not sufficient for production acceptance.
