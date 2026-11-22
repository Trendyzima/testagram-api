# Testagram hybrid social — forensic capability gap register and Q&A implementation contract

**Status:** Source-audited implementation planning; Q&A contract proposal, not shipped code  
**Date:** 2026-11-22  
**Companion:** `docs/product/hybrid-social-experience-architecture.md`  
**Scope:** Backend-first capability audit and seven-organ delivery plan

## 1. Why this register exists

The hybrid product must extend existing Testagram-owned social capabilities instead of rebuilding them under new names. This register distinguishes source-visible implementation from production acceptance and identifies the next coherent feature slice.

The audit used the Backend default-branch route registrations in `cmd/api/main.go`, PostgreSQL migrations, handler files and Flutter feature directory inventory. It is a source snapshot, not a live deployment inspection. The API Control Plane must re-audit the exact immutable candidate SHA before adopting any contract.

## 2. Forensic baseline: existing capabilities found in source

### 2.1 Backend route and handler evidence

The Backend default branch currently registers these relevant routes in `cmd/api/main.go`:

| Capability | Source-visible routes / handlers | Finding |
|---|---|---|
| Profile | `GET /api/me/profile`, `PUT /api/me/profile`, `GET /api/social/profiles/{user_id}` | Existing profile read/update surface |
| Social graph | `POST /api/social/follows`, follow requests, unfollow, block/unblock | Existing local follow and block surface |
| Posts | `POST /api/social/posts`, `GET /api/social/posts/{post_id}` | Existing canonical local post surface |
| Replies | `GET/POST /api/social/posts/{post_id}/replies` | Existing post replies; not Q&A answers |
| Reactions | post reaction state, create and delete routes | Existing post reactions |
| Reposts / quote | `POST/DELETE /api/social/posts/{post_id}/reposts` | Existing repost relationship; quote text is supported in schema |
| Bookmarks | `POST/DELETE /api/social/posts/{post_id}/bookmarks` | Existing post bookmarks |
| Feed | `GET /api/feed/home`, `GET /api/feed/public` | Existing feed orchestration |
| Search | `GET /api/search` | Existing privacy-filtered search |
| Hashtags | trending, read and follow routes | Existing hashtag discovery |
| Polls | poll list/create/read/vote and post-poll read | Existing poll surface |
| Threads | list/create/read/delete, media, bookmark, like and repost routes | Existing distinct long-form thread surface |
| Notifications | list and mark-read routes | Existing notification surface |
| Federation preferences | `GET/PUT /api/me/federation` and subscription routes | Existing preference/subscription surfaces |

Handler evidence includes `social_post_create.go`, `social_replies.go`, `social.go`, `feed_home.go`, `polls.go`, `thread_read.go`, `thread_list.go`, `thread_likes.go` and `thread_reposts.go`.

### 2.2 PostgreSQL evidence

The source migration `20261106_social_core.sql` creates the existing local social graph and interaction primitives:

- `testagram_local.follows`, `blocks`, `mutes`.
- `post_reactions`, `replies`, `reposts`, `bookmarks`.
- `notifications`.
- Counter-maintenance triggers for follows, likes, replies and reposts.

The migration `20261120_social_platform_product_foundation.sql` adds broader product foundations including social lists, list membership, list posts, drafts, scheduled posts, stories, story views/reactions and moderation reports/actions.

The existing canonical local post table originates in `20261019_testagram_local_accounts_posts.sql`. It has author, text, visibility, media references, language, timestamps and deletion state. Existing social reply records are tied to a post and do not provide question-scoped answer acceptance, answer revisions or a durable question lifecycle.

### 2.3 Flutter evidence

The Flutter default branch has existing feature areas for:
- `lib/features/posts`
- `lib/features/threads`
- `lib/features/feed`
- `lib/features/discovery`
- `lib/features/polls`
- `lib/features/federation`
- `lib/features/notifications`
- `lib/features/profile`

The presence of a feature directory is not proof of complete screen coverage or successful end-to-end API wiring. Inspect and test the actual screen, repository, API client, generated SDK and navigation before declaring any UX complete.

### 2.4 Feed protocol identity caution

The Backend feed cursor source enum currently recognizes native, ActivityPub and Bluesky identity shapes. This is useful cursor groundwork only. It does **not** prove AT Protocol DID resolution, repository/record validation, relay ingestion, identity control, moderation-label interoperability or outbound AT Protocol publishing.

## 3. Confirmed product gaps from this source audit

The following are not evidenced by the routes/tables inspected:

1. A first-class question lifecycle and question-specific APIs.
2. First-class answers with question-scoped ordering and answer revisions.
3. Accepted-answer state with an auditable, race-safe transition.
4. Topic records and topic-follow relationships dedicated to knowledge discovery (hashtags are not a substitute for structured topics).
5. Question-specific feeds and search result types.
6. Q&A Flutter screens, repositories and generated typed API operations.
7. AT Protocol adapter interoperability. Existing Bluesky cursor identity handling is not a federation implementation.

These are source-audit gaps, not claims that no partial work exists anywhere in every branch. Before coding, inspect open branches and the pinned candidate revisions to avoid duplicating active work.

## 4. Q&A product model: separate semantics, shared safety

Do not store answers as ordinary replies. Do not create a second identity, visibility or moderation system. Questions and answers are first-class domain records that reuse canonical Testagram accounts, relationship rules, content moderation, rate limiting, audit, notification and feed infrastructure.

### 4.1 Question

Required fields:
- Stable UUID.
- Author UUID referencing the canonical Testagram local account projection.
- Title (1–180 Unicode code points).
- Body (1–20,000 Unicode code points; allow empty only if product UX explicitly chooses title-only questions).
- Visibility: `public`, `followers` or `private`, matching the supported local content policy.
- Status: `open`, `answered`, `closed`, `removed`.
- Optional accepted-answer reference, which must point to a live answer belonging to the same question.
- Language, content warning and structured topic associations.
- Created/updated/deleted timestamps and optimistic version.
- Moderation state and provenance; never trust client-supplied moderation status.

### 4.2 Answer

Required fields:
- Stable UUID.
- Question UUID and canonical author UUID.
- Body (1–20,000 Unicode code points).
- Created/updated/deleted timestamps.
- Revision number and auditable edit history (actor, previous/current content digest, timestamp and reason where required).
- Moderation state and provenance.
- Optional language and media references only after the existing media authorization contract is reused.

An answer is not a post reply. It is a question-scoped contribution with its own lifecycle, accepted state, revisions, author attribution and ranking.

### 4.3 Topics

A topic is a structured knowledge taxonomy item, not a hashtag string:
- Stable ID, normalized slug, display name and description.
- Alias/redirect policy to prevent duplicate topics.
- Optional parent topic with cycle prevention.
- Topic-follow relationship keyed by user and topic.
- Question-topic join with uniqueness and bounded topic count.
- Moderation/merge/retirement history.

Do not ship user-created unlimited topic trees in the first slice. Begin with curated topics and an audited alias/merge workflow; expand contribution rights only after abuse controls and search quality are accepted.

## 5. Q&A persistence proposal

The following is a design contract. It must be reconciled against the actual migration ledger, current native-auth candidate and migration runner before a migration number/name is assigned.

Proposed tables:
- `testagram_local.questions`
- `testagram_local.answers`
- `testagram_local.answer_revisions`
- `testagram_local.topics`
- `testagram_local.question_topics`
- `testagram_local.topic_follows`

Important integrity rules:
- Foreign keys use canonical local account IDs and restrictive deletion where audit/attribution must survive.
- Question accepted-answer consistency must be enforced transactionally and by a database constraint/trigger where appropriate; a question cannot accept an answer from another question or a deleted/removed answer.
- A unique partial index or equivalent locking protocol must ensure one accepted answer per question.
- Accept/unaccept operations lock the question row and the target answer in a fixed documented order; competing accepts must serialize.
- Closing a question and accepting an answer must have explicit allowed state transitions.
- Soft deletion/tombstones preserve audit and prevent dangling accepted-answer references.
- All public indexes must include visibility/status/deletion predicates and deterministic tie-breakers.
- Avoid mutable counters as the sole source of truth. If counters are added, prove trigger correctness and provide reconciliation queries.
- Migration is additive, forward-only, idempotent under the project's runner contract, and preserves every historical migration. No old migration is edited or removed.
- Revoke PUBLIC privileges and grant only the exact application roles required by the reviewed Backend source. Do not use schema-wide blanket grants/revocations.
- Do not add unapproved third-party database, identity, cache, or queue dependencies.

## 6. Proposed public API contract (not yet registered or shipped)

All protected operations require the Testagram-native short-lived access token and live Backend session/account validation. Every request uses strict DTO decoding, bounded body size, request ID, rate limiting and consistent error envelopes.

| Method | Proposed route | Purpose |
|---|---|---|
| POST | `/api/questions` | Create a question; require Idempotency-Key |
| GET | `/api/questions/{question_id}` | Read question and visibility-filtered summary |
| PATCH | `/api/questions/{question_id}` | Edit own question with optimistic version |
| DELETE | `/api/questions/{question_id}` | Soft-delete own question under lifecycle policy |
| GET | `/api/questions` | List questions by bounded topic/status/sort/cursor |
| POST | `/api/questions/{question_id}/answers` | Create an answer; require Idempotency-Key |
| GET | `/api/questions/{question_id}/answers` | List authorized answers with deterministic cursor |
| PATCH | `/api/answers/{answer_id}` | Edit own answer and append revision |
| DELETE | `/api/answers/{answer_id}` | Soft-delete own answer and reconcile accepted state |
| PUT | `/api/questions/{question_id}/accepted-answer` | Author accepts one answer, using expected question version |
| DELETE | `/api/questions/{question_id}/accepted-answer` | Author clears acceptance under explicit state rules |
| GET | `/api/topics` | Search/list curated topics |
| GET | `/api/topics/{slug}` | Read topic and authorized question feed |
| PUT | `/api/topics/{topic_id}/follow` | Follow topic idempotently |
| DELETE | `/api/topics/{topic_id}/follow` | Unfollow topic idempotently |

Do not add these paths to the public OpenAPI or Flutter SDK until matching Backend routes and tests exist. A contract-first PR must be source-audited against the exact Backend candidate; proposed routes are not implemented routes.

### 6.1 Request semantics

- Creation requires a high-entropy idempotency key. Same key + same canonical request returns the original result; same key + different request returns 409.
- Updates require an expected version/ETag or equivalent conditional-write token. Stale edits return 409 and never silently overwrite newer content.
- Accept-answer requires the question owner, a live answer on that question, a non-removed question and an expected version. Repeating the same accepted answer is idempotent.
- A user cannot accept their own answer unless an explicit product rule is later adopted and abuse-reviewed; default policy should prohibit self-acceptance.
- Visibility is inherited from the question for answer listing. An answer cannot be more public than its parent question.
- All nested routes re-check question and answer visibility at read and write time.
- Never leak whether a private question exists to an unauthorized viewer; use a consistent not-found response.
- Cursor pagination is keyset-based with stable ordering and opaque integrity-protected cursors. Do not use unbounded offset pagination for large question/answer feeds.

## 7. Visibility and moderation matrix

| Condition | Expected behavior |
|---|---|
| Public question, active public author | Eligible for public discovery |
| Followers question | Only author and accepted followers can read question and answers |
| Private question | Author-only unless a later explicit audience model is approved |
| Author blocked by viewer or viewer blocked by author | Hide question, answers, search, feed and notifications consistently |
| Author suspended/deactivated | Apply account policy consistently; never expose through cached search/feed results |
| Question removed | Hide from public reads; retain restricted audit/tombstone evidence |
| Answer removed | Exclude from lists and accepted-answer eligibility; reconcile accepted reference transactionally |
| Question closed | Reads remain available; new answers denied unless a documented reopen transition occurs |
| Moderation unavailable | Fail closed for new question/answer publication, not bypass moderation |
| Search/feed cache stale | Backend rechecks current visibility before serialization |

Reuse existing Backend social authorization primitives where they correctly model question visibility. Do not fork a weaker Q&A-only privacy checker.

## 8. Cross-organ execution plan

### Slice Q0 — source and contract lock
- Identify the exact Backend base candidate after native-auth reconciliation; do not base feature work on a stale mainline if #424/#434 is the accepted integration path.
- Reconcile route inventory, migrations, Compose mounts, migration runner and CI order.
- Verify current social moderation and authorization APIs can be reused without importing legacy identity-provider packages.
- Write migration rollback/recovery and lock-order design before implementation.

### Slice Q1 — Backend Q&A foundation
- Add additive PostgreSQL migration and migration-manifest/Compose integration.
- Implement question/answer/topic repositories and strict HTTP DTO handlers.
- Implement idempotent create, optimistic edits, accepted-answer locking, revisions and soft deletion.
- Add PostgreSQL integration tests for visibility, concurrency, duplicate retries, edit conflicts, deletion and accepted-answer races.
- Add moderation, abuse rate limits, audit and notification outbox events.
- Run Go tests, race detector, vet, build, migration replay and clean-install/upgrade harnesses.

### Slice Q2 — API Control Plane
- Add public OpenAPI paths only after handlers are present and exact route inventory matches.
- Add strict schemas, examples, error responses and security declarations.
- Update route inventory, generated Dart/TypeScript SDKs and compatibility CI.
- Pin only the reviewed immutable Backend commit; do not pin a draft branch as if it were merged mainline.

### Slice Q3 — Flutter
- Add QuestionList, QuestionDetail, AskQuestion, AnswerComposer, AnswerRevision and Topic pages.
- Add repositories using generated Testagram API SDK; no direct database, federation, algorithm or storage access.
- Provide loading, empty, offline, rate-limited, conflict, moderation-pending and unavailable states.
- Add Android/Web widget and integration tests, accessibility and physical-device smoke.

### Slice Q4 — Algorithm
- Backend constructs authorized question candidate IDs and metadata only.
- Algorithm orders bounded candidate IDs for question discovery; it cannot authorize or hydrate.
- Backend rejects unknown/duplicate/out-of-set IDs and rechecks current visibility before returning results.
- Provide newest and unanswered chronological modes that do not depend on the ranker.
- Evaluate answer quality without allowing popularity to suppress new contributors or minority expertise.

### Slice Q5 — Data Centre/CDN
- Reuse existing media upload intents and media ownership model for question/answer attachments.
- No separate Q&A object store, client credential or media authorization logic.
- Private media uses existing short-lived object-bound grants and cache isolation.
- No Data Centre/CDN change is needed for text-only Q&A; do not add unnecessary service edges.

### Slice Q6 — Federation
- First define an explicit ActivityPub mapping for questions/answers only if the protocol representation preserves parent identity, answer semantics, visibility, deletion and accepted-answer limitations.
- Never silently map a Q&A answer to a generic reply and claim parity.
- AT Protocol support is a separate future adapter; do not imply it from Bluesky cursor support.
- Remote writes remain disabled until identity control, signatures, moderation, deletion and interoperability acceptance pass.

## 9. Required Q&A test matrix

### Database and concurrency
- Clean install and upgrade from every supported migration baseline.
- Apply the new migration twice through the actual migration runner.
- Concurrent answer creation with the same idempotency key.
- Concurrent competing accepted-answer writes; exactly one accepted answer survives.
- Answer delete racing with acceptance; no dangling accepted-answer reference.
- Question close racing with answer creation; no answer is accepted after close commits.
- Stale question/answer update; 409 and no lost update.
- Transaction rollback leaves no partial question, answer, revision or notification.

### Authorization and privacy
- Anonymous/public, owner, accepted follower, unrelated viewer, blocked viewer and suspended-account cases.
- Private question existence is not disclosed to unauthorized users.
- Answers inherit parent visibility.
- Search, feed, notifications and topic pages apply identical authorization.
- Re-check authorization after ranking and before hydration.

### Abuse and moderation
- Moderation unavailable, timeout, rejection and retry behavior.
- Per-account and per-target rate limits.
- Duplicate reports and moderator actions preserve audit.
- Spam/link/mention floods and oversized Unicode payloads.
- Removed/edited content does not remain visible in search/feed/media caches.

### API and client
- Strict unknown-field rejection, body-size bounds, malformed UUIDs, cursor tampering and content limits.
- Idempotency replay and conflicting payloads.
- Flutter offline retry, duplicate submit prevention, conflict resolution and session expiry.
- Generated SDK compatibility and route-source audit.

## 10. Other hybrid work: do not duplicate existing features

After Q&A, prioritize in this order:

1. **Unified interaction semantics:** reconcile existing post and thread likes/bookmarks/reposts/quotes so the Flutter client does not expose contradictory behavior. Keep distinct storage where the domain differs; normalize API DTOs where semantics genuinely match.
2. **Feed controls:** current Backend feed modes include `for_you`, `following`, `latest`, `media` and `discover`. Add user-visible saved preferences and explicit question/topic lanes only after source tests prove authorization and pagination.
3. **Structured topics:** add curated taxonomy and topic feeds; hashtags remain a separate lightweight tagging/discovery mechanism.
4. **Thread/post composition:** preserve existing distinct thread semantics until a reviewed migration plan proves that unifying storage is safer than a compatibility adapter. Do not rewrite stable thread IDs or lose historical engagement.
5. **Search:** add questions/answers/topics as typed result categories, with visibility checks before and after indexing.
6. **Federation:** ActivityPub acceptance first. AT Protocol design/pilot remains separate and gated.
7. **Media:** no additional media stack; reuse Backend ownership, Data Centre durability and CDN delivery boundaries.

## 11. Acceptance and non-claims

A Q&A feature is complete only when Backend source, PostgreSQL migration and integration tests, public OpenAPI, route inventory, generated SDK, Flutter UX, cross-organ CI and operational telemetry agree on the same contract.

A successful build does not prove live deployment. A merged API contract does not prove a Backend route exists. A visible Flutter screen does not prove the write path is authorized. A Bluesky cursor does not prove AT Protocol federation. A social reply is not an accepted answer.

No production deployment, feature-flag enablement, database migration, DNS change, staff permission change or federation write enablement is authorized by this planning document.


## 12. Execution trace — 2026-11-22

The first Backend persistence slice has been opened as [Backend PR #435](https://github.com/Trendyzima/Testagram-backend-/pull/435), stacked on Backend #434 and native-auth #424. It adds the initial Q&A tables, accepted-answer integrity guards, immutable answer revision records, idempotency ledgers, Compose migration mount and a backup-gated operator migration script.

The dedicated PostgreSQL 17 schema workflow #3 passed, including migration replay and the tested database invariants. PR #435 remains draft: HTTP handlers, public OpenAPI routes, generated SDKs, Flutter wiring, feed/search integration and end-to-end authorization tests are not yet complete. The parent Backend CI is still in progress. This execution trace is evidence of a tested schema candidate only; it is not a production migration or feature-availability claim.
