# Testagram source-audit snapshot — 2026-11-22

**Purpose:** Reproducibility record for the hybrid social capability audit.  
**Status:** Source references only; not a release lock or deployment attestation.

## Immutable repository revisions used as audit references

| Organ | Repository | Revision | Audit meaning |
|---|---|---|---|
| Flutter Client | `Trendyzima/testagram-flutter-client-` | `1f58971720c7a72139d56900a5895c49fa105639` | Mainline client feature-directory reference recorded by the API bridge |
| Backend | `Trendyzima/Testagram-backend-` | `287d8669df9dbfcf2ae34f6f532925ca551de4bd` | Mainline Backend base recorded by native-auth PR #424 |
| Data Centre | `Trendyzima/Testagram-data-centre-` | `58de0bf36b76f9cd74824901b6a86de29f420c65` | Mainline infrastructure reference recorded by the API bridge |
| CDN | `Trendyzima/cdn-` | `490119514788c13c327ee05eb4ce068a0f73966e` | Mainline CDN reference recorded by the API bridge |
| Federated Content | `Trendyzima/federated-content` | `3707d9a3f4e4222c23aecb8a97afbaeec45d3c5d` | Mainline federation reference recorded by the API bridge |
| The Algorithm | `Trendyzima/the-algorithm` | `92cf9b47e4de38306c4fe7b61ece24c3e075aa22` | Mainline ranking reference recorded by the API bridge |
| API Control Plane | `Trendyzima/testagram-api` | `201fd3335c737e7fe36ed34dfa1ec07b03c31047` | Base revision of this product-architecture PR |

## Candidate revisions are not mainline

- Backend PR #424 candidate: `cc33913f0fd4e86669f7c717e12b2503990e6d88`.
- Backend PR #434 approval-integrity candidate: `4c7a5a74b5e9209f63dff4e0d6b4ee6439f3b10c`.
- CDN PR #125 guarded custom-domain candidate: `19f2ed0df2993ba833aee9526c2a7e6cbd4a0662`.
- API bridge PR #116 candidate: `4b72e933e23381bfb403c2df933ef65b257c4ca3`.

These are review candidates, not merged mainline. The product architecture PR does not silently update `contracts/sources.lock.json` to any of them.

## Reproducibility rules

1. Re-run the route, migration, handler, Flutter screen/repository and test audit against the exact Backend/Flutter commits selected for the next implementation branch.
2. Reconcile the Backend implementation base with the native-auth/approval-integrity dependency. Do not build new Q&A code on a legacy-auth mainline if the accepted integration target is the native-auth candidate.
3. Verify every path and schema against the checked-out commit before using this register as a coding specification.
4. Update API source pins only to verified merged mainline commits, never to a draft candidate simply because its CI is green.
5. Record CI run IDs, commit SHAs, reviewer identities and staging evidence separately. A source snapshot is not a test result or production acceptance.
6. If a source revision changes, mark the audit stale and repeat affected checks rather than assuming the same routes, migration order or Flutter wiring.

## Key conclusion

The inspected Backend source already contains a substantial social platform: profiles, follows, blocks, posts, replies, reactions, reposts/quotes, bookmarks, polls, feeds, hashtags, search, threads and notifications. The next high-value additive product domain is first-class Q&A with structured topics and answer acceptance/revisions. This conclusion is constrained to the source revisions above and must be revalidated on the native-auth candidate before implementation.
