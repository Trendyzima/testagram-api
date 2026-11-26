# Testagram screen-to-backend and service coverage matrix

**Audit date:** 2026-11-26  
**Source pins:** see `contracts/sources.lock.json`  
**Purpose:** distinguish implemented client-to-Backend routes, private service hops, intentionally disabled experiences and live acceptance gates. This is a source-level integration map, not a production availability claim.

## Non-negotiable ownership

- Flutter owns presentation, navigation, device permissions and local state. It calls only the public Testagram Backend API and approved media URLs.
- Backend owns native identity/session validation, product authorization, canonical social/knowledge/wallet records, visibility, moderation, notification inbox state and orchestration.
- Data Centre owns storage mechanics, media provider lifecycle, video processing, notification delivery infrastructure and operations. It never overrides Backend authorization or becomes a second product-data authority.
- CDN serves bytes and enforces Backend-issued viewer/origin assertions; it does not decide who may see a post or asset.
- Algorithm ranks only bounded candidate IDs that Backend has already authorized.
- Federation owns ActivityPub/AT Protocol protocol state and remote delivery, not local Testagram identities or visibility.
- API Control Plane owns contracts, SDKs, source pins and CI only; it is not a runtime gateway.

## Screen-to-Backend map

| Flutter screen / capability family | Public Backend contract | Owning data/service path | Source status and boundary |
|---|---|---|---|
| Signup, login, verification, recovery, sessions | Native `/api/auth/*`; identity application/session/evidence routes | Backend native identity + PostgreSQL session/account checks; Data Centre private identity-evidence storage where configured | Source mapped. Public signup remains fail-closed pending independent identity review and live acceptance. |
| Profile, profile edit, connections, follow/block safety | `/api/me/profile`, `/api/social/profiles/*`, follows, blocks, follow requests | Backend canonical account projection and social graph | Source mapped; client never writes identity or authorization state directly. |
| Home/public/following/list/video feed lanes | `GET /api/feed/home`, `GET /api/feed/public` | Backend selects and authorizes candidates; private Algorithm `POST /v1/feed/rank`; Backend rechecks and hydrates canonical posts | Source contract aligned. Ranker failure/fallback and production latency require staging/load acceptance. |
| Posts, detail, replies, likes, reposts, bookmarks, views | `/api/social/posts/*`, `/api/social/*` interaction routes | Backend canonical post/social tables; Backend-owned outbox for downstream events | Source mapped and method/path audited against route inventory + OpenAPI. |
| Threads and thread detail | `/api/threads/*` | Backend canonical thread records and interactions | Source mapped, including deep-link detail, media, toggles, state and interaction lists. |
| Discovery, search, hashtags, suggestions, trending | `/api/search`, `/api/hashtags/*`, social suggestion routes | Backend search/visibility filters; Algorithm may rank only Backend-authorized hashtag candidates | Source mapped; never expose private ranker endpoint to Flutter. |
| Knowledge hub, topics, questions, answers | `/api/knowledge/topics/*`, `/api/knowledge/questions/*` | Backend-owned knowledge records, topic follows and accepted-answer lifecycle | Source mapped; Q&A is distinct from ordinary post replies. |
| Polls | `/api/social/polls/*` | Backend-owned poll/vote state | Source mapped; vote authorization and duplicate/conflict semantics remain Backend-enforced. |
| Social lists and saved timelines | `/api/social/lists/*`, bookmarks | Backend-owned list membership and saved content; feed filtering remains Backend-authorized | Source mapped. |
| Browsing history | `GET/POST/DELETE /api/social/history` | Backend-owned per-user history | Source mapped; detail links reopen the corresponding post/thread/video destination. |
| Notifications and preferences | REST inbox/read/preferences routes; authenticated Backend SSE stream | Backend canonical PostgreSQL inbox and read state; Data Centre notification components are delivery infrastructure only | Source mapped. SSE is a read-only signal; REST remains authoritative for read state. |
| Wallet and transaction history | Authenticated wallet routes | Backend canonical wallet/ledger and provider reconciliation | Screen/API foundation mapped; settlement, webhook reconciliation and production payment acceptance are separate gates. |
| Federation settings and remote content | `/api/me/federation`, `/api/federation/subscriptions` | Backend owns local consent/follow/block/visibility; private Federation bridge owns protocol keys, inbox/outbox and remote delivery | Source mapped. ActivityPub/AT Protocol workers remain disabled until protocol and staging gates pass. |
| Image/video upload and private media | `/api/media/upload-intent`, upload, complete, attach, list, private-download and delete routes | Backend authorization/quota/retention; optional Data Centre media lifecycle; CDN delivery | Source mapped. Provider durability, signed URL expiry, private denial, CDN origin and byte-range behavior require end-to-end staging tests. |
| Shorts and video playback | Backend-authorized feed/media references; Data Centre video processing service | Backend controls visibility; Data Centre processes video; CDN delivers HLS/DASH/segments | Partial integration boundary: the dedicated Data Centre video listener is not routed through current public Caddy ingress. Do not set a video API URL to the general Backend origin. |
| Direct messages | Backend communication capabilities for supported metadata, reactions and sender-only deletion | Backend communication policy, canonical message metadata and durable outbox | Deliberately partial: encrypted send/edit/attachments return `E2EE_NOT_READY`; plaintext rendering remains blocked until device registration, recipient verification, key state and decryption are accepted. |
| One-to-one calls and Audio Spaces | Backend lifecycle/session capabilities | Backend owns call/space metadata and authorization; future public realtime/WebRTC transport and SFU are separate | Not live media: a session record or ticket is not a connected call. Group Spaces require a dedicated SFU; realtime Worker is not publicly routed. |
| Monetization hub | Existing wallet/profile destinations only where a first-class Backend route exists | Backend ledger/provider contracts required for each money-moving workflow | Navigation foundation only. Campaigns, earnings, premium/subscriptions, boosts, payouts, gifts and tips must not be presented as completed workflows without audited routes, ledger invariants, provider reconciliation and tests. |
| Settings, email notifications, federation preferences | `/api/me/*` preference routes | Backend owns account preferences and delivery policy | Source mapped; delivery provider acceptance is separate. |
| TV/IPTV optional surfaces | Separate optional TV contract; not part of core social route inventory | Backend TV catalog/monitor and Data Centre/video infrastructure | Not silently mapped to core screens; TV catalogue public route is not registered in Backend mainline. |

## Private service wiring

| Producer | Consumer | Contract | Critical invariants |
|---|---|---|---|
| Backend | Algorithm | Private `POST /v1/feed/rank` and topic ranking; versioned bearer + request ID | Max 200 authorized candidates; return only submitted IDs; Backend rechecks authorization and hydrates canonical records. |
| Backend | Federation | Directional private service credentials and durable activity enqueue/authorized remote reads | Separate credentials per direction; outbox commit is atomic with the product transaction; idempotent acceptance; workers remain disabled pending acceptance. |
| Backend | Data Centre media | Typed `internal/datacentreclient` for `/internal/v1/media/*` | Private token; bounded requests; no redirect following; provider URL validation; Backend remains owner/quota/visibility authority. |
| Backend | Data Centre identity evidence | Separate typed client and separate token under `/internal/v1/identity-evidence/*` | Dedicated private namespace/buckets; evidence is not public media; independent retention and access checks. |
| Backend | CDN | Viewer assertions, origin authentication and purge contract | CDN never accepts raw product authorization decisions; purge-before-delete/moderation; private responses cannot be cached as public. |
| Flutter | Backend | Public HTTPS API with Testagram-native access token | No direct calls to Algorithm, Federation, Data Centre private APIs, PostgreSQL or storage providers. |
| Flutter | CDN | Backend-approved media URLs only | No origin/purge/service credentials or private provider URLs in the client. |

## Benchmark capability interpretation

The product benchmark is capability quality, not imitation of another company's internal architecture:

- **X:** fast home/following feeds, post/reply interactions, reposts, bookmarks, lists, search, hashtags and trends.
- **Bluesky / Mastodon / Elk:** portable identity and interoperable protocol boundaries, explicit federation controls, remote actor provenance and safe inbound/outbound delivery.
- **TikTok:** vertical video discovery, efficient playback, creator/media lifecycle and feed ranking; Testagram's dedicated video ingress remains an explicit integration gate.
- **Facebook / Threads:** profiles, social graph, conversations, threads, notifications, discovery and coherent cross-screen navigation.
- **Quora:** structured topics, question lifecycle, answer ordering and auditable accepted answers distinct from ordinary replies.
- **Telegram:** reliable conversation UX, device/session trust, private media and calls; Testagram must not claim secure messaging or connected calls before E2EE and realtime acceptance.

## Acceptance required before calling the wiring complete

1. Run the client-to-Backend route audit against the exact pinned Flutter and Backend SHAs; every method/path used by Flutter must be present in the inventory and public OpenAPI.
2. Run producer/consumer contract tests for Backend↔Algorithm, Backend↔Federation, Backend↔Data Centre media/identity evidence and Backend↔CDN.
3. In staging, verify private DNS, TLS, distinct service credentials, readiness, deadlines, request IDs, authorization failures, retries, duplicate delivery and recovery.
4. Exercise screen journeys with real test accounts: auth/refresh/logout, create/read/edit/delete, follows/blocks, feeds/search, questions/answers, polls, notifications, wallet and media upload/playback/delete.
5. Keep E2EE send/edit/attachments, live calls/Spaces, monetization workflows, video direct ingress and production federation disabled until their dedicated acceptance gates pass.
6. Production deployment remains a separate manual action; green source CI does not authorize deployment.

