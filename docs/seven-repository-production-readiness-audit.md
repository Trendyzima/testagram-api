# Seven-organ production-readiness audit

**Audit date:** 2026-11-22  
**Status:** Source-level integration candidate; NOT accepted for production.

This document supersedes earlier architecture snapshots. The seven repositories are six runtime organs plus one build-time governance organ. The API Control Plane is not a runtime gateway.

## Current architecture

| Organ | Authority | Consumer / boundary |
|---|---|---|
| Flutter client | UI, navigation, device capabilities and local presentation | Public Backend API and canonical media URLs |
| Backend | Canonical identity, sessions, authorization, product data, wallet/profile state and orchestration | Public client ingress; private Data Centre, CDN, Algorithm and Federation |
| Data Centre | Infrastructure, storage, video processing, notifications, backups and node operations | Private platform/media network and object providers |
| CDN | Media byte delivery, cache, ranges, HLS transport and trusted origin relay | Public media ingress; Backend-issued viewer assertions and separate origin credential |
| Algorithm | Ranking order and bounded scores only | Private Backend-authorized candidate request |
| Federation | ActivityPub/AT Protocol protocol state, remote actors, signed delivery and durable queues | Private Backend contracts and remote protocol peers |
| API Control Plane | OpenAPI, event schemas, SDKs, immutable source pins, route inventory and compatibility CI | Build/release governance only; no runtime traffic |

Backend PostgreSQL is the sole authority for Testagram user identity, sessions, canonical product records and product authorization. Data Centre owns storage mechanics, not product authorization. CDN transports bytes, not access decisions. Algorithm orders only Backend-authorized candidates. Federation owns protocol state, not local identity or canonical product records.

## Native authentication position

- Flutter uses the Testagram-owned native authentication client. Short-lived access tokens stay in memory; rotating refresh credentials are stored in platform secure storage.
- Backend PR #424 is the open native-only authentication retirement candidate. Its current branch includes the communication/privacy, wallet and knowledge-engine stack brought in through PR #450. The four original conflicts with main have been reconciled; the current combined head is `31040c345f286b5dd34a91ea8c94af3da21e704b`.
- The candidate binds access tokens to canonical user IDs, session IDs and token versions. Protected routes recheck PostgreSQL session/account state. Refresh rotation, replay rejection, logout and revocation have PostgreSQL integration coverage.
- PR #424 remains open and requires independent review plus fresh exact-head CI. It is not merged to main and is not a live deployment.
- Data Centre video and notification user-facing routes use Backend-native JWT verification and live PostgreSQL session/account checks. User tokens are not platform service credentials.
- Admin Console staff access uses native staff principals, role grants, encrypted staff sessions and WebAuthn-backed MFA elevation. General two-person staff invitation/role-change/revocation, live browser ceremony and recovery acceptance remain incomplete.
- Public registration and staff enrollment remain fail-closed until the live readiness handshake, credential ceremony/recovery and two-person lifecycle gates pass.

## Seven-organ wiring

1. **Flutter → Backend:** native login, refresh, recovery, session restoration and public API. Flutter must not receive private service credentials or direct database/object-store access.
2. **Flutter → CDN:** approved media URLs only. Private media access is Backend-authorized and uses short-lived object/viewer-bound assertions.
3. **Backend → Data Centre:** separate private platform and media contracts, distinct service credentials, version headers, bounded timeouts and durable media receipts.
4. **Backend → CDN:** Backend viewer assertions and a separate CDN origin credential. Raw user JWTs are not forwarded as origin credentials.
5. **Backend → Algorithm:** bounded candidate IDs, dedicated service token and versioned request. Backend rehydrates canonical records and rechecks visibility after ranking.
6. **Backend → Federation:** separate directional credentials and durable PostgreSQL outbox. Public inbound federation remains disabled until protocol-signature, replay, SSRF, inbox durability and interoperability acceptance passes.
7. **API Control Plane → six runtime organs:** immutable source pins, OpenAPI/event snapshots, route inventory, SDK generation and compatibility CI only. It is never a runtime hop.

## Verified source and CI position

- The API bridge source lock is refreshed to the current exact candidate heads: Backend PR #424 (`31040c345f286b5dd34a91ea8c94af3da21e704b`) and Flutter PR #116 (`2d29bb883645bc6ffd6ef5ff3409cd1bd59d6c54`); Data Centre, CDN, Algorithm and Federation pin their current mainline commits.
- Data Centre PR #115 and Federation PR #53 are now merged into main. Flutter PR #123 is merged into the PR #116 feature branch; Backend PR #450 is merged into the PR #424 feature branch. These are candidate-branch integrations, not mainline merges.
- The combined Backend #424 exact-head CI passed on `31040c345f286b5dd34a91ea8c94af3da21e704b`. The combined Flutter #116 exact-head CI passed on `2d29bb883645bc6ffd6ef5ff3409cd1bd59d6c54`. The API bridge CI passed on `3bf64616892f5fd9f013f3f31504f472bb71ec9c` (run `45005227967`).
- The API bridge's native-auth audit passed across 442 runtime, deployment, configuration and documentation files. The product gap document now uses provider-neutral prohibition wording. The exhaustive compatibility check recognizes only the three exact dated, immutable historical migration paths; no unclassified provider traces remain.
- Backend PR #449 fixed the missing edge-token propagation in the deployment code and is merged into main. The latest production deploy fails safely before machine selection because `TESTAGRAM_EDGE_PROXY_SHARED_TOKEN` is not configured in the production GitHub environment; no machine start, deployment or DNS change occurred.

## Production blockers

### Identity and staff security
- Complete exact-head CI and independent security review, then merge the reviewed Backend candidate.
- Implement the full two-person staff invitation, role-change and revocation lifecycle.
- Perform real browser WebAuthn registration/assertion, recovery, replay rejection and revoked-credential tests.
- Verify Admin Console readiness against the deployed Backend and production-like PostgreSQL.
- Keep public registration and staff enrollment disabled until every gate passes.

### Routing and deployment
- Production `api.testagram.site` remains associated with the legacy Worker. The native Backend origin must be deployed and health-checked before any custom-domain ownership transfer. The deployment workflow is currently blocked by the missing `TESTAGRAM_EDGE_PROXY_SHARED_TOKEN` production secret; use the same 64-hex token configured on the Cloudflare API Worker.
- The CDN routing workflow must implement a tested ownership transfer, DNS/TLS continuity and rollback. Do not bypass its preflight.
- The Flutter production-domain smoke previously failed apex redirect, NodeInfo and WebFinger checks. Re-run after the correct origins are deployed.
- Capture exact source SHAs and immutable image digests for every deployed organ. Green CI and published images do not prove deployment.

### Media and recovery
- Backend native media replication and the optional Data Centre media profile are separate implementations and require separate staging bucket acceptance.
- Verify real object bytes and SHA-256 at every required provider, repair, restore, tombstone deletion and retry after worker interruption.
- Perform a coordinated isolated restore covering Backend PostgreSQL, Data Centre media state, object bytes, Federation state, deployment configuration and encrypted recovery material. Record RPO/RTO and post-restore authorization behavior.

### Federation and ranking
- Algorithm must return only IDs in the submitted Backend-authorized candidate set; Backend must recheck visibility after ranking.
- Federation private ingress/outbox contracts require deployed staging acceptance. Public federation stays disabled until signature verification, replay protection, SSRF controls, durable inbox/outbox, retries and independent peer interoperability pass.

## Provider-residue classification

No external identity-provider runtime, SDK, endpoint, bearer fallback or product-facing architecture is permitted. The active source, deployment configuration and documentation audit must remain clean across all six runtime organs and the API Control Plane.

A small, explicit migration/CI compatibility boundary still contains old schema identifiers so existing PostgreSQL installations can be upgraded without rewriting applied migration history or discarding audit evidence. These are not runtime authentication paths. The bridge's exhaustive residue audit allowlists only those migration/fixture locations and fails on any new occurrence elsewhere. The remaining compatibility boundary must be reduced further only through a tested forward migration; never delete applied migration history or historical identity evidence blindly.

## Release decision

**NOT ACCEPTED for production.** Source CI is necessary but insufficient. Production acceptance requires independent review, merged and deployed Backend, live native authentication and staff WebAuthn proof, complete staff lifecycle, safe routing transfer, all six runtime-edge staging tests, coordinated restore and explicit production approval.
