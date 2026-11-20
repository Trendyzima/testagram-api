# Testagram seven-organ bridge

**Bridge branch:** `integration/seven-organ-bridge-20261120`  
**Control plane:** `Trendyzima/testagram-api`  
**Status:** source merge set assembled; runtime acceptance remains pending.

This bridge is a release-governance layer, not a monorepo and not a new runtime gateway. The six runtime organs remain independently owned repositories. The API repository coordinates their contracts, immutable source pins, compatibility checks and acceptance evidence.

## 1. Seven organs and immutable mainline revisions

| Organ | Repository | Accepted mainline revision |
|---|---|---|
| Flutter client | [testagram-flutter-client-](https://github.com/Trendyzima/testagram-flutter-client-) | `855758a1df5cf6616f4196124ca929787327da82` |
| Backend | [Testagram-backend-](https://github.com/Trendyzima/Testagram-backend-) | `301cd904ddd786a2625df5910f3955b31370a5db` |
| Data Centre | [Testagram-data-centre-](https://github.com/Trendyzima/Testagram-data-centre-) | `182107393c219ac24078785271731ae7cf0837bf` |
| CDN | [cdn-](https://github.com/Trendyzima/cdn-) | `506f22f0ae42d359f01a1f940d48aa578469e0a0` |
| Algorithm | [the-algorithm](https://github.com/Trendyzima/the-algorithm) | `8dc66f06201fa0bfe62702a4c5a6dec61a4282e4` |
| Federation | [federated-content](https://github.com/Trendyzima/federated-content) | `e6946a4c903219d729b778cd4ed91b909a66826a` |
| Contract control plane | [testagram-api](https://github.com/Trendyzima/testagram-api) | `201fd3335c737e7fe36ed34dfa1ec07b03c31047` (bridge base) |

The six runtime pins are also stored in `contracts/sources.lock.json`. The bridge audit verifies that the manifest and lockfile agree. All 309 declared provider source paths (169 Backend, 38 Data Centre, 17 CDN, 54 Flutter, 20 Federation, 11 Algorithm) were checked against the exact Git trees and all were present.

## 2. Merge set assembled

The following reviewed PRs were merged into their owning organ's `main` branch after their reported checks passed:

- Flutter #109 — seven-repository navigation links.
- Backend #419 — Algorithm feed-mode contract correction.
- Backend #418 — seven-repository navigation links.
- API #115 — machine-checked seven-repository navigation graph.
- Data Centre #111 — architecture corrections and acceptance evidence boundaries.
- CDN #122 — seven-repository navigation links.
- Algorithm #27 — seven-repository navigation links.
- Federation #49 — seven-repository circuit links.

The bridge manifest records these PR numbers and immutable resulting mainline revisions. Squash merges were used. No production deployment, DNS update, feature-flag change, provider write or secret mutation was performed as part of this source merge.

## 3. Runtime ownership and edges

```mermaid
flowchart LR
  F[Flutter] -->|native user session / public API| B[Backend]
  F -->|approved media URLs / bytes| C[CDN]
  B -->|private platform and media APIs| D[Data Centre]
  B -->|viewer assertions / origin auth| C
  B -->|authorized candidate IDs| A[Algorithm]
  B -->|directional private auth / outbox| X[Federation]
  G[Testagram API control plane] -.->|build-time contracts and pins| F
  G -.-> B
  G -.-> D
  G -.-> C
  G -.-> A
  G -.-> X
```

- Backend is the only canonical authority for Testagram identity, sessions, authorization and product records.
- Flutter calls public Backend APIs; it never calls private infrastructure or holds service/provider credentials.
- Data Centre performs storage and infrastructure work. Backend still decides who may upload, view, attach or delete media.
- CDN transports authorized bytes. Private viewer assertions and CDN-origin authentication are separate trust mechanisms.
- Algorithm receives a bounded set of Backend-authorized candidate IDs and returns ordering/reasons only. Backend rechecks authorization and hydrates canonical records.
- Federation owns protocol state, WebFinger/ActivityPub behavior and signed remote delivery. Backend owns local identity, canonical posts, consent and visibility.
- API contracts and source pins are checked at build time. The API repository is never a runtime hop.

## 4. Media paths must remain distinct

There are two separately implemented storage lifecycles and their evidence must not be mixed:

1. Backend native virtual-storage path: the Backend's own media ledger and three-provider replication implementation. Its staging receipts must prove each configured media-byte origin independently.
2. Data Centre dedicated media path: B2 is the media-byte primary and R2 is the verified media-byte replica. VPS MinIO and R2 metadata sidecars are metadata mirrors, not a third media-byte copy.

A successful upload to one provider, a metadata sidecar, an ETag or a CDN cache hit is not proof of independent byte durability. Keep media feature flags fail-closed until each owning lifecycle has its own staging evidence.

## 5. Branch and merge policy

This bridge records the reviewed merge set, not an instruction to merge every branch name in GitHub. The branch inventory includes historical, backup, migration, experimental, legacy-provider and feature branches. A branch without a reviewed PR is not automatically merge-ready. Before any further merge, compare its exact tip against its organ's current `main`, inspect the complete diff, confirm current contract ownership, run relevant checks and resolve stale or conflicting work. Preserve backup branches as recovery references; never merge them into production by default.

Flutter production-domain smoke PR #100 remains draft with a failed smoke run. It is deliberately excluded from this merge set and must be repaired and rerun before reconsideration.

## 6. Complete branch census and forensic dispositions

The GitHub branch search was paginated to completion for all seven repositories. The inventory contained **938 branch refs** at the time of this pass:

| Organ | Branch refs |
|---|---:|
| Flutter | 118 |
| Backend | 399 |
| API control plane | 112 |
| Data Centre | 112 |
| CDN | 120 |
| Algorithm | 29 |
| Federation | 48 |
| **Total** | **938** |

A branch census is not permission to merge every ref. Many refs are backups, migration experiments, legacy-provider cutovers, old release candidates or stale snapshots. Only reviewed PRs with current diffs and passing required checks were merged. Branches without PRs were not merged directly into `main`.

Representative branch-level decisions:

- Flutter `fix/webfinger-smoke-probe-handle-20261120` and CDN `fix/webfinger-negative-control-handle-20261120`: the changed workflow/test file blobs are already identical to current `main`; no duplicate cherry-pick is required.
- Federation `fix/nodeinfo-discovery-runtime`: the inspected server, tests and configuration files are already identical to current `main`; the old branch is not a new fix to merge.
- Data Centre `fix/live-media-smoke-staging-isolation`: not merged. Its workflow runs on pushes to `main` without requiring the explicit manual confirmation input, and its environment has fallback paths to general provider credentials. That is not an acceptable trigger for live provider writes.
- Data Centre `feat/independent-media-backup-drill`: not merged. It is roughly 400 commits behind current main, requires an Appwrite export, and does not back up/restore the dedicated media PostgreSQL ledger. Its offline object-byte verification is not a complete native Testagram disaster-recovery path.
- Backend `fix/close-native-intake-until-staff-mfa-20261120`: not merged. The inspected change adds a readiness boolean and startup log but does not itself enforce a request-time registration/review gate; it is also substantially behind current main.
- Backend `fix/backend-identity-review-live-mfa-claim`: not merged. It is 143 commits behind current main and needs a current-base rebase plus complete review before any code is considered.
- CDN `fix/cloudflare-apex-federation-route-20261116`: not merged. It is 31 commits ahead and 18 behind with a broad routing/worker/workflow diff; it needs a focused rebase and live-route-specific checks, not a blind merge.

### Production smoke evidence that remains a blocker

The existing Flutter production-domain smoke run `44480693441` failed on 2026-11-19. Its read-only probes recorded:

- `https://testagram.site/`: HTTP 200, no redirect Location; expected HTTP 308 to `https://www.testagram.site/`.
- `https://testagram.site/.well-known/nodeinfo`: HTTP 200 but `text/html`, not NodeInfo JSON.
- WebFinger for the real account `acct:crissbeat@testagram.site`: HTTP 503, `application/json`.

The www frontend and Pages.dev shell returned HTTP 200. This failure is not a Flutter build failure and is not repaired by changing the smoke-test negative-control handle. It points to live apex/federation route ownership or deployed origin readiness. Keep PR #100 draft and do not claim public federation acceptance until the live routes are corrected and the same probes pass.

## 7. Bridge validation

Run from this repository:

```sh
npm ci
npm run audit:seven-organ-bridge
npm run check
```

The offline bridge audit checks all seven repository identities, six immutable runtime source pins, the governance-only API boundary, declared graph edges and trust invariants. The existing cross-repository audit checks the pinned source files and contract snapshots. A green bridge audit is not a live deployment acceptance result.

## 8. Remaining acceptance gates

- Exact deployed image digests and source revisions for all six runtime organs.
- Same-staging registration, email verification, native login, refresh rotation, logout and restart journey.
- PostgreSQL account/session/product writes, authorization, transaction rollback and recovery.
- Separate Backend and Data Centre media lifecycle acceptance, including provider read-back, checksums, replication, primary-loss restore and deletion.
- CDN public/private authorization, expiry, cache isolation, range delivery and cross-account denial.
- Federation signed inbound, replay protection, durable inbox/outbox and remote delivery against an independent peer.
- Algorithm authenticated ranking, timeout/fallback, candidate-set enforcement and Backend authorization rechecks.
- Live DNS, TLS, health probes, immutable deployment revisions and measured recovery.

The locked G0–G7 acceptance document remains authoritative for the full evidence standard. Source merges and CI success do not close those runtime gates.
