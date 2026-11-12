# Testagram infrastructure topology: Instabox VPS + Cloudflare R2 + Backblaze B2

**Status:** target architecture and integration contract. This document does not authorize DNS changes, provider migration, data copy, credential rotation or production cutover.

## Ownership

| Plane | System | Authority |
|---|---|---|
| Identity | Appwrite | Passwords, email verification, sessions and recovery; not the canonical social-profile database |
| Application data | Instabox VPS PostgreSQL | Canonical users/profiles, relationships, posts, privacy, moderation, media metadata, analytics events and transactional outboxes |
| VPS media replica | Instabox VPS private S3-compatible object store | Full verified media copy on attached storage; never public |
| Cloud object replica | Cloudflare R2 | Full verified media copy in a private bucket; storage, not delivery CDN |
| Independent off-site replica | Backblaze B2 | Full verified media copy and independent recovery source |
| Public byte delivery | Testagram Go CDN | Public media hostname, edge/shield cache, HLS/DASH/range delivery, origin failover and delivery metrics |
| DNS and domain security | Cloudflare DNS | Authoritative DNS, DNSSEC, domain records and DNS analytics; media records point to Testagram CDN |
| Cloudflare analytics | Cloudflare Analytics / Web Analytics | Aggregated DNS, request and website performance telemetry; not the product analytics database |
| Platform operations | Testagram Data Centre | VPS assembly, storage-node health, capacity, replication, monitoring, backups and restore |
| Product authorization | Testagram Backend | Public application API; verifies Appwrite session, resolves VPS PostgreSQL identity, authorizes media and owns quotas/lifecycle |
| Contracts | testagram-api | Versioned schemas and cross-repository compatibility; never a runtime database or proxy |

## Sign-in and application data

1. Flutter obtains an Appwrite session.
2. Flutter sends the Appwrite session JWT to Testagram Backend.
3. Backend validates the session with Appwrite and resolves the explicit Appwrite-to-Testagram identity mapping in PostgreSQL on Instabox VPS.
4. Backend reads and writes canonical user/profile/social data in that PostgreSQL database.
5. Data Centre services use narrowly scoped private service interfaces and the same canonical identity mapping; they do not create competing user records.
6. Appwrite IDs are identity-provider identifiers, not public Testagram user IDs. Never auto-link accounts by matching email addresses.

The production PostgreSQL primary runs on Instabox VPS. Do not point the canonical product database at Neon or Cloudflare D1. Keep PostgreSQL private, encrypted in transit, with durable volumes, WAL/PITR or equivalent tested recovery, off-host encrypted backups and restore drills. A VPS loss must not destroy the only database copy.

## Media upload and three-copy durability

1. Backend authorizes upload intent, object key, owner, visibility, quota, MIME/type, maximum bytes and expiry.
2. Client receives only a short-lived, object-scoped upload capability; it never receives provider master credentials.
3. Bytes land in the selected ingest store. Backend/Data Centre replication copies the exact object to all three stores: Instabox VPS object store, Cloudflare R2 private bucket and Backblaze B2 private bucket.
4. Each destination is independently read back and verified against the same SHA-256, byte length and media type. Provider ETags are not portable SHA-256.
5. An asset becomes ready only when the configured durability policy is satisfied. Default policy for durable user media is all three copies verified. If one provider is unavailable, keep the asset replicating/degraded; do not silently claim three-copy durability.
6. A durable replica ledger records provider, bucket, object key, checksum, size, verified time, state, attempt count and last error. Repair is idempotent and never overwrites a known-good copy from an unverified source.
7. Deletion begins with a Backend tombstone and retention/legal-hold check, then durable per-provider delete jobs. Physical reclamation happens only after all required acknowledgements and the recovery window.

A degraded-write mode may be introduced later only as an explicit policy with maximum duration, alert and repair deadline. It is not the default.

## Media delivery — Testagram CDN, not Cloudflare CDN

1. Backend decides whether a viewer may access an object and issues a short-lived object/viewer/scope-bound delivery authorization.
2. Viewer requests media.testagram.site, which resolves in Cloudflare DNS to Testagram-owned CDN ingress/edge nodes.
3. Testagram CDN validates the delivery capability and serves its own cache/shield.
4. On cache miss, Testagram CDN fetches from private origins in a health-aware order: Instabox VPS, Cloudflare R2, Backblaze B2.
5. Origin requests use private service credentials or short-lived origin signatures. Buckets and VPS object storage remain private; origin endpoints are not advertised to browsers.
6. CDN caches only according to authorization policy. Private media is never shared-cacheable across viewers. Public immutable objects may use long-lived cache keys; manifests and mutable assets use shorter TTLs.
7. CDN logs delivery/cache/origin metrics to Data Centre observability. CDN cache is never counted as a durable media replica.

Cloudflare R2 is an object origin, not the public delivery hostname. Do not route viewer media through Cloudflare proxy/CDN or a Cloudflare Worker media proxy. Cloudflare DNS may resolve the custom CDN hostname; the custom CDN owns byte delivery.

## Analytics and DNS

- Cloudflare DNS analytics: query volume, DNS record health and domain telemetry.
- Cloudflare Web Analytics: aggregated website performance/traffic where enabled. Do not send passwords, session JWTs, email addresses, raw recovery URLs or sensitive event payloads.
- Testagram product analytics: Backend accepts validated, minimized events and stores them in Instabox PostgreSQL with retention, access controls and user-consent policy.
- CDN analytics: cache hit ratio, bandwidth, status codes, origin latency/failover, range/HLS/DASH delivery and abuse counters; ship to Data Centre observability and aggregate product metrics in PostgreSQL as needed.
- Never use Cloudflare analytics as the canonical user database, identity store or event ledger.

## Failure policy

| Failure | Required behavior |
|---|---|
| Instabox PostgreSQL unavailable | Fail closed for authenticated writes and authorization decisions; restore from tested backup/WAL recovery |
| Instabox media origin unavailable | CDN falls back to checksum-verified R2 or B2 replica |
| R2 unavailable | Continue from verified Instabox/B2 copies; queue R2 repair and alert |
| B2 unavailable | Continue from verified Instabox/R2 copies; queue B2 repair and alert |
| One media copy not verified | Mark asset degraded/replicating; never report three-copy durability |
| Testagram CDN edge unavailable | Select another healthy Testagram edge; no Cloudflare CDN dependency |
| Cloudflare DNS control-plane outage | Existing DNS answers continue per resolver TTL; retain zone exports and recovery procedures |
| Cloudflare Analytics unavailable | Product APIs/storage continue; telemetry is buffered/dropped under bounded policy |

## Security and operations

- Separate least-privilege credentials for Instabox, R2 and B2. Never reuse keys.
- TLS for all network links; private networks/firewalls for PostgreSQL, MinIO and internal APIs.
- Encrypt database backups and media archives with keys stored separately from the VPS.
- Never expose bucket listing, object-store admin ports, PostgreSQL or origin endpoints publicly.
- No browser or mobile build may contain provider credentials, internal tokens or origin signing keys.
- Replication is checksum-driven, idempotent, observable and repairable in either direction.
- Alert on replica lag, missing copies, checksum mismatch, capacity, PostgreSQL WAL/backup age, failed restores, CDN origin failures and analytics pipeline lag.
- Restore drills must restore PostgreSQL plus representative media from independent copies, verify checksums, log in with a staging Appwrite account, authorize a private media read and play it through Testagram CDN.

## Repository ownership

- Backend: canonical PostgreSQL identity/data; upload authorization; media metadata and replica ledger; three-provider lifecycle; product analytics event API.
- Data Centre: Instabox VPS deployment, private object-store service, replica workers/repair scheduling, backups, monitoring and restore drills.
- CDN: custom edge/shield delivery, authorization, cache isolation and private origin failover across VPS/R2/B2.
- Flutter: Appwrite session and Backend-only product/media APIs; no direct provider credentials.
- testagram-api: shared API/storage/replication/analytics contracts.
- Federation and Algorithm: consume Backend-authorized canonical data only; neither becomes a second user database.

## Production cutover gates

1. Confirm actual Instabox VPS hardware, persistent volume layout, network boundaries and capacity.
2. Run PostgreSQL on Instabox VPS with private access, automated encrypted backups and successful isolated restore.
3. Provision private R2 and B2 buckets and an Instabox object-store bucket; use independent credentials.
4. Implement and test three-way upload, checksum read-back, crash recovery, repair and deletion lifecycle.
5. Implement Testagram CDN authenticated VPS/R2/B2 origin adapters and private-cache tests.
6. Verify Cloudflare authoritative DNS records point to custom CDN and are DNS-only; export zone configuration and test rollback.
7. Validate analytics minimization, consent, retention and alerting.
8. Complete cross-repository staging tests before production DNS or storage cutover.

No production DNS, bucket, secret, database or deployment change is authorized by this document.
