# Six-repository release and integration gates

This checklist is required before downstream repositories pin a new API contract or before a coordinated production promotion.

## Contract preparation
- [ ] Update the provider-owned contract or source implementation first.
- [ ] Record exact provider commit SHA and source paths in `contracts/sources.lock.json`.
- [ ] Refresh immutable snapshots only from those exact commits.
- [ ] Classify every interface as implemented, partial, registered-only, catalogue-only or planned.
- [ ] Run OpenAPI lint, schema validation and compatibility diff.
- [ ] Review request/response DTOs, status codes, pagination, idempotency, rate limits and failure semantics.

## Provider/consumer verification
- [ ] Flutter uses only the Backend public API and passes Appwrite JWTs; no private service URLs or credentials in the bundle.
- [ ] Backend/Algorithm tests cover 1-200 candidate bounds, 1-50 result bounds, unknown/duplicate IDs, invalid scores, timeout and ranking fallback policy.
- [ ] Backend/Federation tests cover distinct directional credentials, actor consent, durable acceptance, idempotency collisions, outbox cursor recovery and disabled-worker defaults.
- [ ] Backend/Data Centre tests cover private network auth, 1 MiB body limit, feature config, event/audit intake and database outage; typed Backend client must exist before claiming integration.
- [ ] Backend/CDN tests cover public delivery, private token expiry/wrong-key denial, ranges, cache headers, purge authorization and origin outage.
- [ ] Data Centre video/notification service contracts are audited separately from the platform API.
- [ ] Every provider and consumer CI passes against the same immutable source revisions.

## Staging and production
- [ ] Private DNS, network routes, ports, TLS/mTLS and secret rotation verified.
- [ ] Appwrite JWT expiry/revocation and account-linking negative tests pass.
- [ ] Cross-service request IDs and redaction are verified in logs.
- [ ] Backup restore, media checksum verification and deletion/tombstone propagation are proven.
- [ ] CDN hostname, DNS, TLS, origin and private media end-to-end are verified.
- [ ] Federation interoperability and safety gates pass before enabling public inbox/outbound workers.
- [ ] All deployables are pinned to immutable image digests; rollback is documented.
- [ ] Release owner explicitly approves merge/deploy. Passing CI alone is not cutover authorization.
