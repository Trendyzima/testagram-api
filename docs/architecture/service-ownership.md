# Seven-repository service ownership and request flow

This document is the shared architecture reference for all seven Testagram repositories. The API repository is a contract control plane only: it is not in the runtime request path, does not replace the Go Backend, and does not own product data.

## Runtime request path

```text
Flutter client -- Testagram bearer session --> Testagram Backend public API
                                                |
                                                +--> canonical PostgreSQL product state
                                                +--> Algorithm (private ranking only)
                                                +--> Federation (private ActivityPub protocol API)
                                                +--> Data Centre (private media/platform services)
                                                +--> CDN media URL --> CDN edge/shield --> approved object origin
```

The API repository publishes the public/private contracts, generated SDKs, source pins and compatibility gates used to keep these boundaries aligned. It is not a request-path gateway.

## Seven repository ownership

| Repository | Owns | Must not own |
| --- | --- | --- |
| `testagram-flutter-client-` | Native Android/web presentation, navigation, device features, UX state and public Backend transport | Canonical identities, product authorization, social records, ranking policy, federation delivery or object bytes |
| `Testagram-backend-` | Canonical identity, authentication policy, authorization, PostgreSQL product records, profiles, posts, social graph, feed orchestration and media lifecycle | ActivityPub protocol execution, ranking policy or edge byte delivery |
| `Testagram-data-centre-` | Private service deployment, VPS/node operations, video processing, notifications, storage durability, replication, backups and restore | Product identity, post visibility or media ownership policy |
| `cdn-` | Public/private media byte delivery, edge routing, cache/shield, ranges and streaming | User identity, media ownership, privacy decisions, upload authorization or retention |
| `federated-content` | ActivityPub/WebFinger actors and keys, signed inbox/outbox, remote actor projections and delivery | Canonical local accounts, local follow authority, blocks, post visibility or media ownership |
| `the-algorithm` | Private candidate ranking and recommendations; ordered IDs and explainable reasons | Candidate authorization, source records, social graph authority, visibility or pagination |
| `testagram-api` | OpenAPI 3.1, private schemas, events, SDKs, immutable source pins, compatibility policy and cross-repository CI | Runtime traffic, product data, authentication decisions or service authorization |

## Public hostname and edge ownership

The intended production hostname map is part of the shared seven-repository architecture.
The Cloudflare Worker `testagram-cdn` in the CDN repository is a hostname gateway,
not a product API, media authorization service or object store.

| Public hostname | Edge path | Canonical owner |
| --- | --- | --- |
| `www.testagram.site` | Cloudflare Worker → Caddy edge → private Flutter web container | Flutter Client owns the web application; Backend deployment owns its private serving runtime |
| `testagram.site` | Cloudflare Worker → Caddy edge | Federation owns WebFinger/ActivityPub; Caddy redirects ordinary web paths to www |
| `api.testagram.site` | Cloudflare Worker → Backend public listener | Testagram Backend |
| `media.testagram.site` | Cloudflare Worker → Go CDN listener | Testagram CDN |

Data Centre, Federation and Algorithm remain private service boundaries except
for Federation protocol paths deliberately exposed through the apex. The Flutter
client calls only the public Backend API and approved media URLs; it must never
connect directly to private service APIs, PostgreSQL or object-store credentials.
The API repository remains the contract control plane and does not receive
runtime user traffic.

Cloudflare Pages project `testagram-flutter-web` is retained for preview builds
only after the guarded migration completes. The production apex and www custom
domains must not be reattached to Pages by any future preview workflow.

This hostname map describes the target after the verified cutover; it does not
authorize premature DNS changes or Pages detachment. Before cutover, the
self-hosted Flutter image must be published and anonymously pullable (or the
host must have a read-only registry credential), the Backend/Caddy origin must
pass health and application-shell probes, Worker/DNS/Pages ownership must be
enumerated, and the guarded rollback path must be available. Preserve the
existing production routes until those conditions pass.

## Authentication and identity migration state (2026-11-16)

- Flutter mainline contains the Testagram-owned `NativeAuthClient`; it stores the rotating refresh credential in secure storage and keeps short-lived access tokens in memory.
- Backend mainline contains native login/session primitives and the approved-identity provisioning path. Identity applications must pass independent evidence review and two-person account approval before a native account is provisioned; email verification is a separate required step.
- The Backend's `TESTAGRAM_AUTH_PROVIDER` still defaults to `appwrite`. Native bearer authentication is deployment-gated; merged code is not evidence of a production provider cutover.
- Appwrite remains a compatibility dependency for legacy deployments and for the staff identity-review/approval path. Reviewer credentials are never user sessions and must never be forwarded to other services.
- Data Centre video and notification user-facing adapters still validate Appwrite JWTs in the current source. Native-session interoperability for those services is an explicit remaining migration gate. Do not remove their verifier or credentials until a native-token verifier, canonical-user mapping, revocation behavior and end-to-end tests are implemented.
- The public Backend accepts the configured end-user authentication provider; a deployment must not assume that both providers are active simultaneously. Private service credentials remain separate, directional, server-side secrets.
- Preserve canonical Testagram UUIDs, profile ownership, social records, media ownership and audit history during any identity linking or migration. Never link identities by matching an email alone.

## Cross-service invariants

1. Backend authenticates the viewer, builds bounded candidate sets, applies account/post visibility, blocks and mutes, and rechecks authorization after ranking before hydrating canonical posts.
2. Algorithm returns ordering only. If it is unavailable or returns invalid IDs, Backend uses its tested safe chronological fallback; publishing, authentication and authorization must continue independently.
3. Federation resolves local actors and eligibility through Backend. ActivityPub ingress uses signed HTTP requests; remote delivery is durable, idempotent and isolated from the client request path.
4. Data Centre owns object durability and processing. Backend owns upload intent, media ownership, visibility and deletion policy.
5. CDN delivers bytes only. Private-media authorization is origin-authoritative, short-lived and object-bound. Private responses must not enter shared caches; revoked or deleted mutable media must not be served stale.
6. Flutter calls only the public Backend API and approved media URLs. It never connects directly to PostgreSQL, object-store credentials, private service APIs, Federation or Algorithm.
7. API contracts and source pins must match reviewed source revisions. Update a pin only to a verified merged mainline commit; update vendored snapshots only after byte-for-byte comparison with their upstream source.

## Release gates

- Native identity: applicant intake, evidence integrity/replication, two independent reviewer decisions, two-person provisioning approval, one-time redemption, email verification, login, password recovery, refresh rotation, logout/revocation and account-disable behavior.
- Authentication migration: explicit provider selection, staff reviewer separation, Flutter Android/Web acceptance, and native-token verification in Data Centre video/notification services.
- Media: real upload/read-back/checksum/replica repair across the configured VPS/B2/R2 topology; private CDN grants, expiry, range/HLS behavior, cache isolation and purge/revocation tests.
- Federation: Mastodon/GoToSocial interoperability, durable inbox/outbox replay, remote actor safety, local visibility rechecks and bounded follower fan-out. Public delivery stays disabled until these gates pass.
- Ranking: deterministic lane profiles, candidate bounds, invalid-result rejection, authorization recheck and chronological fallback.
- API: OpenAPI lint, strict DTO verification, generated Dart/TypeScript SDK tests, source-lock validation and cross-repository compatibility CI.
- Client: Flutter analysis, unit/widget tests, Android debug/release QA builds, Web build and physical-device smoke tests.

## Deployment safety

These architecture and contract changes do not authorize a production deployment, DNS change, database migration, secret rotation or service cutover. Keep existing production authentication and infrastructure unchanged until the explicit release gates are independently accepted.
