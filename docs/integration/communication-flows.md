# Seven-repository communication flows (API control plane + six runtime repositories)

This system contains **seven repositories total**: this API governance repository plus six runtime repositories. The API repository is not a seventh runtime service and must never appear in the production request path. The six runtime repositories are Backend, Flutter, Data Centre, CDN, Federated Content and The Algorithm.\n\n## Direction and trust matrix

| Caller | Receiver | Interface | Credential / trust | Current status |
|---|---|---|---|---|
| Flutter | Backend | Public HTTP API | Testagram-native short-lived access JWT; refresh token used only at `/api/auth/refresh` | PR #114 candidate adds native block/unblock client methods against contracted Backend routes; full session and production acceptance remain separate gates |
| Backend | Algorithm | `POST /v1/feed/rank`, `POST /v1/topics/rank` | Dedicated `ALGORITHM_INTERNAL_TOKEN` bearer, private network; API version and request ID on both | Typed Backend client and both provider routes/OpenAPI operations exist; Backend owns candidate authorization and hydration |
| Federation | Backend | Actor resolution, readiness and outbox reads | `FEDERATION_BACKEND_INTERNAL_TOKEN` | Private client path documented; keep internal |
| Backend | Federation | `POST /internal/v1/activities` | Distinct `FEDERATION_INTERNAL_TOKEN` bearer | Private ingress exists; delivery remains gated |
| Backend | Data Centre media / identity evidence | `/internal/v1/media/*`, `/internal/v1/identity-evidence/*` | Separate `FRESH_DATA_CENTRE_INTERNAL_TOKEN` and `IDENTITY_EVIDENCE_DATA_CENTRE_INTERNAL_TOKEN`; never reused | Typed Backend client and matching Data Centre routes exist in the PR #424 candidate; staging/runtime acceptance remains pending |
| Backend | Data Centre platform | `/v1/config/*`, `/v1/events`, `/v1/audit` | `PLATFORM_INTERNAL_TOKEN` for protected writes | Provider API exists; Backend typed consumer is not verified and is not claimed as active |
| Backend | CDN | Backend-authorized media issuance and byte-delivery contract | Dedicated Backend-to-CDN issuer assertion, key/scope/expiry-bound; playback token separate; purge token operator-only | Issuer contract is a release gate; CDN must not infer visibility from a caller-controlled query flag |
| Data Centre | CDN / object storage | Origin and media byte paths | Server-side origin credentials; never browser-visible | Deployment-specific |
| Federation | remote instances | ActivityPub WebFinger, actor, inbox/outbox | HTTP Signatures and HTTPS | Protocol surface exists; public rollout gated |
| API control plane | Backend, Flutter, Data Centre, CDN, Federation and Algorithm | Versioned contracts, pinned snapshots, SDKs, fixtures and CI | GitHub source artifacts; no runtime credentials | Governance only; not a runtime hop |

## Correlation and error rules

- Carry a bounded `X-Request-ID` across service-to-service calls; generate one at the first trusted ingress when absent.
- Do not forward a user access JWT or refresh token as a service-to-service credential.
- Distinct service credentials are directional and audience-specific. Rotating one must not require reusing another service's key.
- Never log authorization headers, JWTs, service tokens, signed URLs, private content or raw webhook signatures.
- Public Backend errors retain the Backend's documented nested `error.code` / `error.message` envelope and request ID. Internal providers may have their own error shape; adapters translate at the owning boundary.
- Timeouts, request-body limits, candidate limits, concurrency and retries are part of the contract, not optional tuning.
- Retry only idempotent operations or operations with durable idempotency keys.
- HTTP 202 from Federation means durable acceptance only; it does not mean remote delivery or activity projection completed.

## Event and outbox model

Testagram does not require a generic broker to establish reliable cross-repository events. Use the owning service's PostgreSQL transactional outbox, bounded polling, cursor persistence, idempotent intake, leases and dead-letter/reconciliation behavior.

The `testagram.post.published` event schema is mirrored from Federation's repository. It is a payload contract, not a claim that Kafka, RabbitMQ, Redis streams or a managed queue is deployed. Federation must re-fetch canonical post/actor data through private Backend interfaces and re-check eligibility; do not trust an event as an authorization grant.

## Failure behavior

- Algorithm is optional only under Backend's explicit fallback policy. A ranker outage must never bypass Backend visibility filters.
- Data Centre unavailability must not cause Flutter to call storage nodes or direct object storage.
- CDN cache misses must resolve only through configured origins/shields. Private media must fail closed when authorization is absent or expired.
- Federation delivery failure is asynchronous and must not roll back an already committed local post.
- An unknown or unimplemented capability returns an explicit error; no fabricated success or fallback to retired Supabase behavior.
