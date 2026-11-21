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

## Native identity and cross-organ integration state (2026-11-21)

- Flutter uses the Testagram-owned native authentication client: short-lived access tokens remain in memory and rotating refresh credentials are stored only in platform secure storage.
- Backend PR #424 is the reviewed native-auth retirement candidate currently pinned by the bridge. It removes the old provider adapter and parallel legacy runtime, and makes PostgreSQL-backed Testagram sessions the only supported user/staff identity authority. The PR remains open; this is not yet a merged-mainline or deployed-production claim.
- Backend native access tokens are bound to canonical user IDs, session IDs and token versions. Protected routes recheck the live PostgreSQL session and account state; refresh rotation, replay rejection and revocation have PostgreSQL integration coverage.
- Data Centre video and notification user-aware routes validate Backend-issued native JWTs. The video service resolves the token through its native verifier, and the notification service calls `nativeauth.ResolveUserID`; both use the shared auth secret and live PostgreSQL session/account checks. These user tokens are not platform service credentials.
- Admin Console staff access uses native staff principals, role grants, encrypted staff sessions and WebAuthn-backed MFA elevation. The general two-person staff invitation/role-change/revocation lifecycle and live browser ceremony/recovery remain acceptance gates; staff enrollment and public registration stay closed until they pass.
- Backend-to-Data-Centre, Backend-to-CDN, Backend-to-Algorithm and Backend-to-Federation use separate directional service credentials or object/viewer-bound assertions. User JWTs are never reused as service credentials.
- The API Control Plane pins the six runtime organs and validates contracts/SDKs at build time only. It is not a runtime gateway, identity authority or product-data service.
- The public API hostname is a target contract, not proof of live routing. Production still requires the exact Backend candidate to be reviewed, merged, deployed and health-checked before the legacy Worker association can be transferred safely.
- Preserve canonical Testagram UUIDs, profile ownership, social records, media ownership and audit history during any schema upgrade. Never link identities by matching email alone.

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
