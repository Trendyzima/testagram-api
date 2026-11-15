# Seven-repository platform integration baseline

**Status:** proposed integration contract; not a production deployment or authorization to change live identity settings.  
**Control plane:** this repository (`testagram-api`).  
**Canonical product-data authority:** Testagram Backend + PostgreSQL.  
**Application runtime:** InstaBox-managed VPS infrastructure.  
**Public edge:** Cloudflare.  
**Release policy:** independent PRs; no merge or production cutover until the relevant gates pass.

## 1. Repository ownership

| Repository | Owns | Must not become authority for |
|---|---|---|
| [Testagram Backend](https://github.com/Trendyzima/Testagram-backend-) | Public product API; canonical users, account IDs, sessions, profiles, posts, follows, blocks, visibility, authorization; transactional event production | Federation protocol state, CDN byte delivery, ranking policy |
| [Testagram Data Centre](https://github.com/Trendyzima/Testagram-data-centre-) | VPS/control-plane operations, node-agent lifecycle, object storage, media processing, backups, notifications, durable worker supervision | Canonical users/posts or product authorization |
| [Testagram CDN](https://github.com/Trendyzima/cdn-) | Media byte delivery, edge caching, range/HLS transport, origin streaming | Media ownership, visibility decisions or private-media authorization |
| [The Algorithm](https://github.com/Trendyzima/the-algorithm) | Candidate ranking, feed generation, recommendation and explainable ranking signals | Candidate retrieval, user identity, visibility, blocks or final authorization |
| [Federated Content](https://github.com/Trendyzima/federated-content) | ActivityPub protocol state, WebFinger, actor keys, inbox/outbox, remote actor cache and delivery | Canonical local identity, canonical post state or authorization |
| [Testagram API](https://github.com/Trendyzima/testagram-api) | OpenAPI, internal service contracts, event schemas, SDKs, source pins and compatibility/release gates | Runtime product data or user-facing request serving |
| [Flutter Client](https://github.com/Trendyzima/testagram-flutter-client-) | Presentation, navigation, device capabilities, local UX state and typed API transport | Identity authority, ranking, federation delivery or media storage |

The API contract repository is a governance/build-time control plane. It is not a runtime hop.

## 2. Non-negotiable data and identity invariants

1. PostgreSQL is the canonical source of product records. Service-local databases may hold protocol state, caches, leases and operational metadata, but must refer to canonical Testagram IDs and must not silently fork product truth.
2. Existing canonical Testagram UUIDs and source account IDs are immutable migration inputs. Never regenerate IDs, auto-link accounts solely by email, or rewrite ownership references during a provider transition.
3. Preserve the current production authentication provider and session validation path until the native path passes route-by-route compatibility, account reconciliation, credential recovery, client integration, staff authorization and production rollback gates.
4. Never fabricate an existing password hash from an external identity provider. Use an explicit password-reset-required state where a credential cannot be migrated.
5. No migration, secret rotation, provider switch, DNS change or production deployment is implied by this document.
6. Never log passwords, bearer tokens, refresh tokens, private signing keys or raw session credentials.

## 3. Runtime request and event topology

```text
Flutter Client
   | public HTTPS + current production session
   v
Backend API + canonical PostgreSQL
   |-- authorized candidate request ------> Algorithm ranker
   |<-- ordered IDs + explainable reasons --
   |-- canonical hydration + final authorization --> Flutter
   |
   |-- transactional outbox / private events --> Data Centre workers
   |                                              |-- node activation
   |                                              |-- media processing / replicas
   |                                              |-- notifications / backups
   |
   |-- canonical federation events ----------> Federated Content
   |<-- authenticated, idempotent results -----
   |
   |-- short-lived authorized media grants --> CDN --> trusted Backend origin
   |
   +-- OpenAPI/event contract versions ------> this repository (build-time only)
```

All private service calls use authenticated service identities, explicit audience/scope, bounded timeouts and least privilege. Public clients never receive node-agent, federation-ingress, ranking or storage-control credentials.

## 4. Event envelope and delivery guarantees

Every cross-service event must carry a versioned envelope with these logical fields:

- `id`: globally unique event ID (UUID).
- `type`: namespaced event type, for example `identity.session.authenticated`, `feed.candidate.requested`, `post.published`, `media.object.ready`, `social.follow.created`, `social.comment.created`, `federation.activity.accepted`.
- `schema_version`: explicit positive integer.
- `occurred_at`: UTC timestamp.
- `aggregate_type` and `aggregate_id`: canonical aggregate identity.
- `actor_user_id`: canonical Testagram UUID where applicable; omit for system events.
- `correlation_id` and `causation_id`: request/parent trace identifiers.
- `data`: minimal typed payload; no credentials or secrets.

Delivery is at-least-once. Consumers MUST be idempotent on event ID, persist processing outcome, tolerate duplicate and out-of-order delivery, bound retries, and route exhausted work to a inspectable dead-letter state. Use aggregate sequence/version checks where ordering matters. Do not promise exactly-once delivery across independent services.

For database-originated events, write the product mutation and outbox record in the same PostgreSQL transaction. Consumers acknowledge only after their durable side effect commits. Leases must expire and be reclaimable after worker/process failure.

## 5. Node-agent activation worker boundary

Backend owns authenticated activity signal creation and the durable claim/ack contract. Data Centre owns the worker process, VPS service actuator, node/service allowlist, health checks, and operational recovery.

The worker must:
- claim work through the private Backend contract using a dedicated service credential;
- validate event type, tenant/service allowlist, lease expiry and idempotency key;
- activate only explicitly registered, approved services; never execute arbitrary shell commands or user-supplied image references;
- acknowledge only after a verified service state transition;
- renew or safely relinquish leases during long operations;
- recover expired claims, use bounded exponential backoff and expose dead letters;
- apply concurrency limits, jitter, graceful shutdown and restart-safe state;
- emit structured logs, metrics and trace correlation without sensitive values.

A user activity impulse is not permission to start arbitrary infrastructure. Auto-suspend/activation remains disabled until service allowlists, operator controls, abuse limits and rollback are tested. Login/feed/post/media/follow/comment/federation event producers must emit only after their existing authentication and authorization checks succeed.

## 6. Algorithm boundary

Backend retrieves and filters candidates using canonical identity, blocks, privacy, moderation, follows and pagination rules. The ranker receives only the minimum authorized candidate features and returns ordered canonical IDs plus bounded reason codes/scores. Backend rehydrates each result and rechecks visibility and authorization immediately before response. Ranker failure must degrade to a deterministic safe chronological feed; it must never widen access.

## 7. Federation boundary: separate protocols, shared canonical data

ActivityPub and AT Protocol are separate protocol adapters. Do not conflate their identities, signatures, repositories, lexicons or delivery semantics.

- ActivityPub adapter: WebFinger, actor documents, HTTP Signatures, inbox/outbox, Follow/Undo, Create/Update/Delete, Like/Announce and delivery retries.
- AT Protocol adapter: DID resolution, handle verification, signing/rotation, repository records, lexicons, AppView/feed-generator interfaces and authenticated service endpoints as applicable.
- Both adapters map verified remote activities to a normalized internal activity model and call Backend private APIs for local policy decisions.
- Remote identities remain protocol-scoped and are linked to local accounts only through explicit, verified user action.
- Backend remains authoritative for local posts, blocks, visibility and account status. Federation service stores protocol state and delivery receipts only.
- Outbound delivery must be SSRF-resistant: public-address validation, redirect restrictions, response/body limits, timeouts, per-domain concurrency and retry budgets.

Mastodon/GoToSocial interoperability is an ActivityPub acceptance target. Bluesky interoperability is an AT Protocol acceptance target. Passing one does not imply passing the other.

## 8. Media security and storage

Backend decides whether a principal may access an object and issues short-lived, scoped media grants. CDN validates the grant and fetches bytes only from the trusted Backend/Data Centre origin contract. Private objects must not be exposed by guessing object keys or bypassing Backend authorization. Preserve HEAD, Range, HLS/DASH and large-object streaming behavior.

Data Centre owns object placement, checksums, replication and restore evidence. A node's advertised free disk space is capacity telemetry, not proof that an object is durable. A replica counts only after byte/hash verification and a durable placement receipt.

## 9. Authentication migration sequence

1. Inventory every public, internal, staff, media and federation route and its current identity/authorization dependency.
2. Reconcile external source account IDs to existing canonical Testagram UUIDs; produce conflict reports for ambiguous or unverified mappings.
3. Add native credential/session records additively; never delete source records during this phase.
4. Implement native access/refresh rotation, reuse detection, logout, recovery and audit.
5. Integrate Flutter secure storage, refresh-on-401, logout-all and error handling; integrate Data Centre and internal service identities separately.
6. Run shadow verification and route-by-route compatibility tests without changing the production provider.
7. Require independent security review, rollback drill, account-count/ownership reconciliation and explicit operator approval before any provider cutover.
8. Retain a tested rollback path until the agreed observation window closes.

## 10. Release gates and evidence

A repository PR is not a platform release. Every release candidate must record exact repository commit SHAs and pass:

- contract lint, schema compatibility and generated SDK drift checks;
- Backend route/auth regression and PostgreSQL migration tests;
- event producer/consumer contract tests, duplicate delivery, ordering, lease expiry and crash-recovery tests;
- node-agent allowlist, no-shell-injection, restart and health verification;
- ranker authorization-boundary, deterministic fallback and latency tests;
- ActivityPub and AT Protocol protocol-specific interoperability suites;
- CDN private/public authorization, HEAD/Range/HLS, origin fail-closed and cache-isolation tests;
- Flutter login/refresh/logout, feed, post, media and federation journey tests;
- VPS staging deployment, service restart, backup/restore and observability evidence.

PRs remain separate and unmerged until their own exact-head checks, independent review and cross-repository compatibility gates pass. Deploy only through the existing InstaBox control plane. Cloudflare remains the public edge. Do not introduce Render as a runtime or deployment target.

## 11. Current known follow-up work

This baseline does not claim the following are complete: node-agent activation worker implementation and event producers; all-route native-auth parity and Flutter integration; durable media object transport/verified replicas; complete ActivityPub inbox/outbox producer and Mastodon interoperability; AT Protocol implementation and Bluesky interoperability; and end-to-end staging/VPS acceptance.

Track each item in its owning repository with a separate PR, exact source pin and test evidence. Update this contract when the implementation changes, not to make the implementation appear complete.
