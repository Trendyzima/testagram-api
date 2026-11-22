# Testagram seven-organ bridge

**Bridge branch:** `integration/seven-organ-bridge-20261120`  
**Control plane:** `Trendyzima/testagram-api`  
**Status:** source pins and static wiring audited; Backend retirement candidate and live runtime acceptance remain pending.

This repository is the build-time governance layer, not a monorepo and not a runtime gateway. The six runtime organs remain independently owned repositories. The API Control Plane coordinates their contracts, immutable source pins, generated SDKs, route inventory and compatibility checks.

## 1. Seven organs and locked source revisions

| Organ | Repository | Locked source revision | Source status |
|---|---|---|---|
| Flutter client | [testagram-flutter-client-](https://github.com/Trendyzima/testagram-flutter-client-) | `714b0f9b3846c0a038db8ae7b01e2a49b626eefe` | PR #120 plaintext-rendering hardening stacked on #118 → #117 → #116; open, draft, unmerged |
| Backend | [Testagram-backend-](https://github.com/Trendyzima/Testagram-backend-) | `2c76af240289931dab390360d107d1df2adddb2e` | PR #441 fail-closed communication follow-up stacked on #439 → #437 → #435 → #434 → #424; open, draft, unmerged |
| Data Centre | [Testagram-data-centre-](https://github.com/Trendyzima/Testagram-data-centre-) | `f3abef58743d27d7a8f62b15fae7e3f7509ee1ef` | PR #115 identity-evidence OpenAPI candidate; not merged (mainline base `ada6f26a289775720bb47a639242dbd868388055`) |
| CDN | [cdn-](https://github.com/Trendyzima/cdn-) | `21a254e9f67dc7a8e55dca37151a6db532405e53` | Current mainline; PR #125 merged |
| Algorithm | [the-algorithm](https://github.com/Trendyzima/the-algorithm) | `92cf9b47e4de38306c4fe7b61ece24c3e075aa22` | Current mainline |
| Federation | [federated-content](https://github.com/Trendyzima/federated-content) | `4d7c26861240fae0fc8a69872dc326b3e1b2bbff` | PR #53 private ActivityPub/ATProto contract candidate; not merged (mainline base `3707d9a3f4e4222c23aecb8a97afbaeec45d3c5d`) |
| Contract control plane | [testagram-api](https://github.com/Trendyzima/testagram-api) | `201fd3335c737e7fe36ed34dfa1ec07b03c31047` | Governance mainline; this bridge PR remains open |

The six runtime pins are stored in `contracts/sources.lock.json`. Flutter, Backend, Data Centre and Federation intentionally pin open review candidates (#120, #441, #115 and #53) for pre-merge contract audit; Flutter #120 includes stacked #118/#117/#116 and Backend #441 includes #439/#437/#435/#434/#424. After each chain is independently reviewed and merged in order, replace its pin with the exact mainline merge SHA. CDN and Algorithm pin current mainline heads. CDN PR #125 is merged. Backend PRs #434 and #435 remain stacked behind #424 and are excluded from the source pin until independently reviewed and merged.

## 2. Merged organ changes represented by this baseline

- Flutter: PRs #109, #112 and #113 (navigation, native-auth deployment documentation and negative-auth fixture cleanup). PRs #116 → #117 → #118 → #120 are open, stacked candidates and none is counted as merged.
- Backend: PRs #418, #419, #421, #423, #426, #427 and #428. PRs #424, #434, #435, #437, #439 and #441 remain open stacked candidates and none is counted as merged. PR #440 is validation-only and must never be merged.
- Data Centre: PRs #111, #112, #113 and #114 (architecture, seven-organ ownership, negative-issuer fixture cleanup and media lifecycle hardening). PR #115 is an unmerged identity-evidence OpenAPI candidate.
- CDN: PRs #122, #123, #124 and #125 (navigation, native media-authorization boundary, negative-auth fixture cleanup and guarded canonical-domain handoff).
- Algorithm: PRs #27, #28 and #29 (navigation and seven-organ ownership).
- Federation: PRs #49, #50 and #51 (navigation, dependency reliability and native ownership boundary).
- API Control Plane: PR #115 (seven-organ navigation and governance graph).

The current bridge itself is PR #116. It remains open until the refreshed source-pin, SDK, route, documentation-residue and edge-wiring checks pass and the Backend candidate chain is independently reviewed and merged sequentially.

One test-only residue cleanup PR is also open:
- Flutter PR #113 removes retired-provider wording from two negative auth/widget fixtures.

These changes do not alter runtime behavior. Their CI and review must pass before merge.

## 3. Runtime ownership and edges

```mermaid
flowchart LR
  F[Flutter] -->|native user session / public API| B[Backend]
  F -->|approved media URLs / bytes| C[CDN]
  B -->|private media and identity-evidence APIs| D[Data Centre]
  B -->|viewer assertions / origin auth| C
  B -->|authorized candidate IDs| A[Algorithm]
  B -->|directional private auth / durable outbox| X[Federation]
  G[Testagram API control plane] -.->|build-time contracts and pins| F
  G -.-> B
  G -.-> D
  G -.-> C
  G -.-> A
  G -.-> X
```

- Backend is the sole authority for Testagram identity, sessions, authorization and canonical product records.
- Flutter calls the public Backend API and approved media URLs only. It stores the rotating refresh credential in platform secure storage; short-lived access tokens remain in memory.
- Data Centre performs storage and infrastructure work. Its user-aware video and notification routes validate Backend-native JWTs and recheck PostgreSQL session/account state. Platform service credentials remain separate.
- CDN transports authorized bytes. Private viewer assertions and CDN-origin authentication are separate trust mechanisms; raw user JWTs are not forwarded as origin credentials.
- Algorithm receives bounded Backend-authorized candidate IDs and returns ranking order/reasons only. Backend rechecks authorization and hydrates canonical records.
- Federation owns protocol state and signed remote delivery. Backend owns local identity, canonical posts, consent and visibility.
- The API Control Plane validates source pins and contracts at build time. It is never a runtime hop.

## 4. Static edge-wiring acceptance

The bridge cross-repository audit now verifies the implementation on both sides of each edge, not just the topology manifest:

1. **Flutter → Backend:** native login/refresh client, secure refresh storage, in-memory access token and authenticated Backend request path.
2. **Flutter → CDN:** approved media URL handling and object/viewer-bound private-media authorization.
3. **Backend → Data Centre:** the typed candidate client uses versioned private media grant/verify/status/delivery/deletion routes and separate identity-evidence routes with distinct credentials. The identity-evidence provider OpenAPI is proposed in Data Centre PR #115 and pinned here as a candidate; it is not yet merged or staging-accepted. Data Centre's separate platform configuration/event/audit API is implemented, but a typed Backend consumer is not verified and is not claimed as an active edge.
4. **Data Centre → Backend identity:** video and notification user-aware routes require the shared native JWT secret and resolve canonical users through PostgreSQL session/account checks.
5. **Backend → CDN:** Backend-issued short-lived viewer assertion, separate origin credential, private no-store behavior, and fail-closed origin relay.
6. **Backend → Algorithm:** dedicated service bearer, API version, request ID, bounded timeout, 200-candidate/50-result limits and matching OpenAPI enum.
7. **Backend → Federation:** distinct private ingress credential, API version, request ID, activity ID idempotency key, durable enqueue and rejection tests for missing/wrong-direction credentials.
8. **API Control Plane → six runtime organs:** immutable source pins, provider snapshots, public route inventory, SDK generation and compatibility CI only.

The static checks do not replace same-environment staging tests. Runtime reachability, secret provisioning, deployed revisions, retry behavior and failure recovery still require explicit evidence.

## 5. Media paths remain distinct

There are two separately implemented storage lifecycles and their evidence must not be mixed:

1. **Backend native virtual-storage path:** Backend-owned media metadata/replica ledger with VPS MinIO primary and R2/B2 independent replicas.
2. **Data Centre dedicated media path:** optional private media service with B2 media-byte primary and R2 verified replica. MinIO/R2 sidecars are metadata mirrors, not a third media-byte copy.

A successful upload to one provider, metadata sidecar, ETag or CDN cache hit is not proof of independent byte durability. Each lifecycle requires its own staging receipts for write, independent read-back, checksum, repair, primary-loss restore, retry and deletion tombstones.

## 6. Provider-residue audit

The expanded bridge audit scans runtime source, deployment configuration and documentation across all six runtime organs, plus the API Control Plane's public contracts and documentation. The last successful run scanned 418 runtime/deployment/configuration/documentation files and found no active external identity-provider integration.

It also found 29 occurrences isolated to an explicit migration/CI compatibility allowlist. These are old schema identifiers and negative fixtures used to prove that legacy database installations can be upgraded and that old credentials are rejected. They are not runtime authentication dependencies. The audit fails if a new occurrence appears outside that allowlist.

The compatibility residue must only be removed through a tested forward migration that preserves applied migration history and historical audit evidence. Do not delete or rewrite applied SQL migrations blindly. The allowlist and its exact file inventory are maintained in `scripts/check-native-auth-only.mjs`.

## 7. Production and security gates still open

- Backend PR chain #424 → #434 → #435 → #437 → #439 → #441 requires sequential independent review and merge. PR #440 is validation-only and must be closed, never merged. CI is source-level evidence and does not prove deployment.
- Staff invitation, role-change and revocation need the complete two-person lifecycle.
- Real browser WebAuthn registration/assertion, recovery, replay rejection and revoked-credential tests remain required.
- Admin Console readiness must be verified against the deployed Backend and production-like PostgreSQL.
- Public registration and staff enrollment remain fail-closed until all gates pass.
- Production `api.testagram.site` remains associated with the legacy Worker. Deploy and health-check the native Backend origin before any custom-domain ownership transfer.
- The CDN routing workflow must implement a tested ownership transfer, DNS/TLS continuity and rollback. Do not bypass its preflight.
- Flutter production-domain, NodeInfo and WebFinger smoke acceptance remains unresolved; rerun after the correct origins are deployed.
- Run each media lifecycle against designated staging buckets, then complete an isolated coordinated restore covering Backend PostgreSQL, Data Centre media state, object bytes, Federation state and encrypted recovery material.
- Public Federation remains disabled until signed inbound verification, replay protection, SSRF controls, durable inbox/outbox, retries and independent peer interoperability pass.
- Capture exact source SHAs and immutable image digests for every deployed organ. Green CI and published images do not prove deployment.

## 8. Branch and merge policy

This bridge records reviewed source revisions; it is not an instruction to merge every branch in GitHub. A branch without a reviewed PR is not automatically merge-ready. Before merging, compare its exact tip against the organ's current main, inspect the complete diff, confirm contract ownership, run relevant checks and resolve stale/conflicting work. Preserve backup branches as recovery references; never merge them into production by default.

The Flutter production smoke PR #100 remains open and is excluded from the merge set until its live-domain failures are repaired and rerun.

## 9. Validation

Run from this repository:

```sh
npm ci
npm run sources:checkout
npm run lint:openapi
npm run lint:internal-openapi
npm run typecheck
npm run build:sdk
npm test
npm run audit:backend-routes
npm run audit:cross-repo
npm run audit:locked-acceptance
npm run audit:navigation
npm run audit:seven-organ-bridge
npm run audit:native-auth-only
dart format .
dart analyze
dart test
```

A green bridge audit proves source/contract consistency only. It does not prove live deployment, DNS/TLS ownership, production WebAuthn, media-provider durability, Federation interoperability or disaster recovery.


## Latest communication and client source-pin refresh — 2026-11-22

- Flutter source pin: PR #120 head `714b0f9b3846c0a038db8ae7b01e2a49b626eefe`, stacked on #118 (`8988ef48c55811d6faccbfa05bebb486d4775f65`) → #117 (`15d06124dd9aa1b83a1a24fc989a6a9c35ecbb1f`) → #116. The #120 widget regression fixture now includes the complete v1 envelope fields; the exact #120 head's Cloudflare Pages and web-container builds passed (runs `44994585577` and `44994585616`). Message composition remains disabled and legacy plaintext is never rendered.
- Backend source pin: PR #441 head `2c76af240289931dab390360d107d1df2adddb2e`, stacked on #439 (`a493cd5ab9185f4eb43d82aa2c05fa0107e59620`) → #437 (`93da847b74d2e874595d113deacbbcda3c283b3a`) → #435 → #434 → #424. The current #441 Backend CI is running; the prior head's formatting failure was traced to `cmd/api/communication_capability.go` and the branch now contains the gofmt-ordered import block. Do not call the run green until the exact current head completes.
- Backend #441 closes fail-open policy handling, routes message delete and call end through the conversation gate, makes call creation/join/end transactional, and removes the legacy plaintext message body from the public message-list response. Its PostgreSQL schema workflow passed on the current head; concurrency/race coverage and independent review remain release gates.
- Backend PR #440 is validation-only and must be closed, never merged. Do not merge the stacked communication candidates out of order.
- Profile/wallet foundations in #437 and Flutter social/deep-link/wallet/monetization foundations in #116 passed their previously recorded exact-head CI. Monetization pages remain navigation foundations; non-wallet actions are unavailable pending verified Backend contracts and settlement/ledger tests.
- No source pin in this document implies a production deployment, live domain cutover, provider settlement, WebAuthn production acceptance or media durability drill.
