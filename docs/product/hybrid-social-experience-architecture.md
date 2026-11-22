# Testagram hybrid social product architecture

**Status:** Product architecture proposal and cross-organ contract direction  
**Date:** 2026-11-22  
**Scope:** Seven-organ Testagram platform  
**Authority:** This document defines product capabilities and ownership boundaries. It does not claim that an unimplemented capability is shipped or authorize production changes.

## 1. Product definition

Testagram is one social network with several native participation modes:

- **Knowledge:** durable questions, answers, accepted answers, expertise signals and topic communities.
- **Public conversation:** short posts, replies, quote-posts, reposts, polls, trends and live discussion.
- **Threaded conversation:** connected multi-post narratives, reply controls, contextual discovery and thoughtful conversation ranking.
- **Federated social:** interoperable identities, follows, posts, replies, likes, reposts, blocks and moderation signals across compatible networks.
- **User-directed discovery:** chronological, following, topic, community, media and explainable recommendation feeds, with user control over ranking and filtering.

These are product capabilities, not five separate applications. A person, post, topic, follow graph, block, report and media object must have one coherent Testagram identity and authorization model regardless of which participation mode created or displays it.

The reference platforms are inspiration for capability classes only. Testagram must use its own name, interface, visual identity, data model, ranking policies and implementation.

## 2. Product principles

1. **One account and identity authority.** Backend owns local accounts, sessions, profiles, roles, blocks, mutes, follows and authorization.
2. **One canonical content model with typed experiences.** Questions, answers, short posts, long-form posts, replies, quote-posts, polls and media posts share common identity, visibility, moderation and lifecycle primitives while retaining type-specific validated fields.
3. **User choice over algorithmic control.** Users can choose Following, Latest, Topics, Questions, Communities, Media and personalized feeds where enabled. Chronological access must remain available.
4. **Knowledge must outlive the timeline.** Questions and answers need topic indexing, durable URLs, answer revisions, accepted-answer history, attribution and useful search/discovery.
5. **Conversation must be composable.** Replies, quote-posts and multi-post threads must preserve parentage, context, ordering and visibility checks.
6. **Federation is an adapter, not an authority leak.** Remote protocols never override local account state, local blocks, post visibility, deletion policy or moderation decisions.
7. **Safety is cross-cutting.** Rate limits, spam controls, reports, appeals, labels, blocks, mutes and moderator audit apply consistently to every content type and entry point.
8. **Media is private by default when requested.** Upload authorization and ownership remain Backend decisions; Data Centre owns durability and processing; CDN serves authorized bytes only.
9. **No fake completeness.** A UI control is enabled only when its owning service, API contract, authorization, persistence, observability and tests exist.
10. **Portable, explicit user control.** Provide export/deletion workflows and clear federation boundaries; explain which actions can and cannot be recalled from remote servers.

## 3. Capability synthesis

| Product capability | User value | Required behavior | Primary owner |
|---|---|---|---|
| Questions and answers | Quora-style knowledge exchange | Ask, answer, edit history, accept answer, follow topics, sort answers, report and search | Backend |
| Short public posts | X-style public conversation | Compose, reply, repost, quote-post, like, bookmark, poll and link preview | Backend |
| Threaded posts | Threads-style connected narratives | Compose a sequence, preserve order, reply context, conversation controls and thread view | Backend + Flutter |
| Federated social | Mastodon-style interoperability | Remote actors, WebFinger, ActivityPub inbox/outbox, signatures, delivery retries and remote interaction projections | Federated Content + Backend |
| Protocol portability | Bluesky-style protocol interoperability | AT Protocol identity/record/relay integration as a separate protocol adapter; explicit mapping and unsupported-feature behavior | Federated Content |
| Custom discovery | User-directed feeds | Following/Latest, topic and community feeds, saved feed preferences and explainable ranked feeds | Backend + Algorithm |
| Moderation and trust | Safer participation | Blocks, mutes, reports, labels, rate limits, appeals, moderator actions and audit trails | Backend |
| Rich media | Photos, video and audio | Upload intent, processing, thumbnails, HLS/DASH, private grants, expiry, deletion and replication | Backend + Data Centre + CDN |
| Search and trends | Find knowledge and live conversation | Search posts/questions/answers/topics/people; trend aggregation with spam and privacy controls | Backend; Algorithm for ranking |
| Notifications | Keep up with activity | In-app/device delivery, preferences, deduplication, read state and abuse controls | Backend + Data Centre |

The table is a target capability map, not an implementation-completion statement. Each capability must be promoted through source-audited contracts and acceptance gates.

## 4. Seven-organ responsibility map

### 4.1 Flutter Client — experience and interaction

Owns:
- Unified navigation and composer with post-type selection.
- Question and answer reading/writing experiences.
- Short-post, quote-post, reply and thread composition.
- Feed selection, user-controlled sorting and ranking explanations.
- Topic/community pages, profiles, search, notifications and moderation UX.
- Accessible interaction states, drafts and local presentation state.

Must not own:
- Canonical post/answer records, identity authority, permission decisions, feed ranking policy, federation delivery, private service credentials or direct database/storage access.

### 4.2 Backend — canonical product authority

Owns:
- Accounts, sessions, profiles, relationships and privacy settings.
- Canonical content records and typed content semantics.
- Questions, answers, accepted answers, revisions, topics and community membership.
- Posts, replies, quote-posts, reposts, polls, bookmarks and reactions.
- Visibility, blocks, mutes, reports, moderation, rate limits and authorization.
- Feed orchestration, candidate authorization, pagination and final record hydration.
- Search indexing contracts, notifications orchestration and media ownership.
- Idempotency, audit events, deletion/tombstone policy and export requests.

Backend must authorize every read and write. It must never trust a client-provided ranking result, federation projection, media URL or remote actor claim as authorization.

### 4.3 The Algorithm — ranking only

Owns:
- Candidate ordering for enabled personalized, topic, discovery and recommendation feeds.
- Explainable ranking reason codes and deterministic ranking profiles.
- Diversity, freshness and repetition controls within Backend-supplied bounds.
- Offline evaluation and ranking quality measurement where approved.

Must not:
- Fetch or invent canonical records, authorize visibility, decide blocks, change follow state, paginate the public API or make the final decision that a user may see content.

Backend constructs bounded eligible candidate IDs, calls the ranker, rejects unknown/duplicate/out-of-set IDs, rechecks visibility and hydrates canonical records. A safe chronological fallback must work when ranking is unavailable.

### 4.4 Federated Content — protocol interoperability

Owns:
- ActivityPub actors, WebFinger, keys, signed ingress, inbox/outbox and durable remote delivery.
- Remote actor and object projections, retry/dead-letter handling and protocol-specific safety validation.
- A future separate AT Protocol adapter for Bluesky-compatible interoperability, if explicitly implemented and accepted.

Backend remains authoritative for local accounts, local follows, local blocks, local visibility, local content and moderation. Protocol-specific records must not be flattened into a false assumption that ActivityPub and AT Protocol have identical identity, repository, record, deletion or moderation semantics.

### 4.5 Data Centre — media and operational durability

Owns:
- Object storage, video/audio processing, thumbnails, transcoding and media lifecycle workers.
- Replication, checksums, backup, restore, capacity and node operations.
- Private service APIs, operational notifications and infrastructure health.

Backend issues upload intents and decides ownership, visibility, retention and deletion. Data Centre executes storage/processing instructions and reports verifiable outcomes. No client receives storage credentials.

### 4.6 CDN — byte delivery

Owns:
- Approved public/private media byte delivery, caching, range requests and HLS/DASH transport.
- Viewer assertion enforcement and edge cache isolation.
- Purge/expiry mechanics under narrowly scoped Backend authorization.

CDN does not decide whether a person may view an object. Private delivery must be object-bound, short-lived and origin-authoritative. Revoked or deleted mutable media must not remain available through stale shared caches.

### 4.7 API Control Plane — contracts and integration governance

Owns:
- Public and private OpenAPI contracts, schemas, event definitions and SDKs.
- Immutable source pins, route inventory, contract compatibility and cross-organ CI.
- Product capability traceability and locked acceptance evidence.

It is not a runtime gateway, product database, identity authority or social-service runtime.

## 5. Canonical content and relationship model

Use shared lifecycle and authorization primitives with explicit typed payloads.

### Shared content envelope

Every locally authored content item should have:
- Stable Testagram content ID and author ID.
- Explicit content type and schema version.
- Created/updated timestamps and edit/version history where applicable.
- Visibility/audience policy and reply/quote permissions.
- Language, content warnings and moderation state.
- Optional topic/community associations and media references.
- Reply-to, quote-of and thread-parent relationships where applicable.
- Idempotency key, audit provenance and deletion/tombstone state.

### Typed content experiences

- **Question:** title, body, topics, optional details, status and accepted-answer reference.
- **Answer:** question reference, body, attribution, revision history and optional author note.
- **Short post:** text, attachments and optional poll.
- **Long-form/thread item:** ordered membership in a thread with explicit continuation semantics.
- **Reply:** parent reference and conversation context.
- **Quote-post:** reference to an original item plus the author's independent commentary; original visibility must be rechecked at read time.
- **Repost:** a relationship/event, not a copied content record.
- **Poll:** bounded options, open/close time, eligibility and anti-abuse rules.

Do not model answers as ordinary replies only: answers need question-scoped ranking, accepted-answer state, revisions and durable knowledge discovery. Do not model reposts as duplicated posts. Do not let a quote-post bypass the original item's privacy or deletion state.

### Core relationships

Follow, topic-follow, community membership, block, mute, bookmark, reaction, answer acceptance and moderation action must be distinct typed relationships with clear uniqueness, actor, target, timestamps and authorization rules.

## 6. Feed and discovery architecture

Expose distinct user-understandable feed modes rather than one opaque universal timeline:

1. **Following:** posts from followed local and eligible remote accounts, ordered chronologically or by a user-selected supported mode.
2. **Latest:** chronological public/local content within the user's eligible scope.
3. **For You:** personalized ranking, only after consent/preferences and ranking acceptance gates.
4. **Questions:** unanswered, active, followed-topic and recently answered questions.
5. **Topics:** content scoped to selected topics, with freshness and quality filters.
6. **Communities:** content scoped to communities the user can access.
7. **Media:** eligible image/video/audio posts with safe media handling.
8. **Custom feeds:** saved filters and ordering rules, introduced only with bounded query cost and abuse controls.

Backend owns feed semantics, authorization, cursors and hydration. Algorithm can order a bounded candidate set only. Every feed needs stable cursor behavior, duplicate suppression, deleted/blocked-content exclusion, observability and a tested chronological fallback.

For answers, provide question-specific sort modes such as recommended, newest and most useful. Ranking must not silently erase minority or new answers; preserve access to chronological ordering and explain ranking signals at a useful level.

## 7. Federation strategy: ActivityPub and AT Protocol

Mastodon-style interoperability is aligned with the existing ActivityPub direction. Bluesky-style interoperability is not achieved by claiming ActivityPub support alone.

Implement federation in protocol stages:

- **Stage A — ActivityPub:** finish WebFinger/NodeInfo, actor documents, key management, signed inbox validation, durable outbox, retry/idempotency, remote actor safety, local visibility rechecks and Mastodon/GoToSocial interoperability.
- **Stage B — AT Protocol discovery and design:** separately specify identity resolution, DID/document handling, repository/record semantics, relay/firehose ingestion, lexicon mapping, moderation-label behavior, deletion propagation and outbound-write scope.
- **Stage C — bounded AT Protocol pilot:** read-only discovery/import first; then limited outbound publishing only after identity control, signing, rate limits, deletion semantics and interoperability tests pass.
- **Stage D — operational acceptance:** replay, abuse, remote outage, key rotation, data minimization, block/mute enforcement and user-facing disclosure tests.

Do not promise cross-protocol feature parity. Unsupported features must be explicitly represented, not silently dropped or misrepresented. A remote interaction is subject to local policy and protocol capability.

## 8. Safety, privacy and integrity requirements

- Enforce authorization in Backend on every object and relationship operation.
- Recheck visibility after ranking and immediately before serialization.
- Apply block/mute rules consistently to feeds, search, notifications, replies, quotes and federation projections.
- Rate-limit account creation, follows, replies, mentions, polls, votes, reports and federation delivery.
- Protect against spam, scraping, coordinated manipulation, malicious links, impersonation and media abuse.
- Maintain auditable moderator actions, reason codes, appeal state and separation of duties.
- Keep staff permissions fail-closed until a fully tested two-person executor and independent security review are accepted.
- Bind sensitive staff approvals to exact WebAuthn RP ID and credential identity; enforce immutable payload digests, quorum, expiry, replay prevention and revocation races in PostgreSQL.
- Provide data export, account deletion and federation limitations disclosures.
- Keep private media grants short-lived and object-bound; prevent private cache leakage.
- Avoid exposing private service contracts, credentials or internal topology in client bundles.

## 9. Contract and implementation sequence

A capability is not complete because a screen or endpoint exists. Each increment requires:
1. Backend schema/migration and rollback strategy.
2. Backend route, strict DTO validation, authentication and authorization.
3. Public/private OpenAPI and event contract updates.
4. Database integration, concurrency, idempotency and negative tests.
5. Flutter UX, loading/empty/error/offline states and client tests.
6. Algorithm integration only where ranking is required, with bounded candidates and fallback.
7. Federation adapter changes only where remote interoperability is required.
8. Data Centre/CDN changes only where media or delivery semantics require them.
9. Cross-organ contract CI, end-to-end tests, telemetry and operational runbooks.
10. Independent review and explicit staged acceptance before production enablement.

### Recommended delivery increments

- **P0 — trust foundation:** native identity, sessions, profile, blocks/mutes, reporting, moderation audit, rate limits, canonical content envelope and authorization.
- **P1 — core social:** short posts, replies, follows, reactions, reposts, quote-posts, bookmarks, Following and Latest feeds.
- **P2 — knowledge:** questions, answers, accepted answers, revisions, topics, topic follows and question discovery.
- **P3 — conversation depth:** multi-post threads, polls, communities, search, notifications and media-rich posts.
- **P4 — ranking control:** explainable For You/topic feeds, saved feed preferences, quality evaluation and robust chronological fallback.
- **P5 — federation acceptance:** ActivityPub production interoperability, durable delivery and remote moderation semantics.
- **P6 — protocol expansion:** separately scoped AT Protocol pilot and interoperability acceptance.

These are sequencing recommendations, not a claim that the underlying organs are currently at those completion levels.

## 10. Acceptance matrix

| Area | Minimum evidence before enabling |
|---|---|
| Content | Schema constraints, ownership, edit/delete behavior, visibility and concurrent-write tests |
| Q&A | Question-scoped answer ordering, acceptance integrity, revision history and search/index tests |
| Social graph | Follow/block/mute race tests, privacy checks and idempotent relationship operations |
| Feeds | Cursor stability, bounded candidates, post-rank authorization, invalid-ID rejection and fallback |
| Threads/quotes | Parent integrity, ordering, deleted/private original behavior and permission checks |
| Moderation | Report workflow, rate limits, audit, appeal and cross-entry-point enforcement |
| ActivityPub | Signature verification, replay protection, delivery retries, actor safety and real peer smoke |
| AT Protocol | Separate protocol specification, DID/record correctness, relay tests and explicit capability mapping |
| Media | Upload authorization, checksum/read-back, replication/restore, private grant expiry, purge and cache isolation |
| Client | Flutter analysis/tests, Android release QA, web build and physical-device smoke |
| Operations | Health, metrics, logs, alerting, backup/restore drills, rollback and incident runbooks |

## 11. Current known gaps and non-claims

The existing seven-organ architecture provides a sound ownership split, but the following are not to be treated as completed merely because they appear in this product target:

- Full Q&A lifecycle and answer-quality/discovery workflows.
- Complete short-post, quote-post, thread, poll and community capability parity.
- Production-ready search, trends, saved/custom feeds and notifications.
- Full ActivityPub public routing and independently verified peer interoperability.
- Any AT Protocol/Bluesky interoperability; it requires a separate protocol adapter and acceptance.
- Complete Backend-to-Data-Centre typed client integration and DB-backed outage behavior.
- Live media replication/restore, CDN private-media negative tests and production routing acceptance.
- Native-auth production cutover and all browser/device/recovery acceptance gates.
- Independently reviewed and merged Backend native-auth/approval-integrity candidates and CDN routing candidate.

The API Control Plane must keep source pins tied to verified immutable commits. Candidate branches are not mainline. CI success is not production deployment evidence. No DNS, Worker, secret, database, bucket, staff-permission or production feature-flag mutation is authorized by this document.

## 12. Definition of a coherent Testagram experience

A user should be able to ask a question, publish a short thought, write a connected thread, answer another person's question, follow a topic, join a community, discover a useful feed and interact with remote federated accounts without encountering contradictory identities, privacy rules, moderation behavior or content ownership.

The product feels unified because all organs implement one set of Testagram-owned contracts and invariants—not because the organs are collapsed into one service.
