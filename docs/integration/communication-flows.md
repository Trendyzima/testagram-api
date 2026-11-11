# Six-repository communication flows

## Direction and trust matrix

| Caller | Receiver | Interface | Credential / trust | Current status |
|---|---|---|---|---|
| Flutter | Backend | Public HTTP API | Appwrite user-session JWT | Core routes implemented; Flutter adoption must pin SDK/contracts |
| Backend | Algorithm | `POST /v1/feed/rank` | Dedicated `ALGORITHM_INTERNAL_TOKEN` bearer, private network | Client and provider contract exist |
| Federation | Backend | Actor resolution, readiness and outbox reads | `FEDERATION_BACKEND_INTERNAL_TOKEN` | Private client path documented; keep internal |
| Backend | Federation | `POST /internal/v1/activities` | Distinct `FEDERATION_INTERNAL_TOKEN` bearer | Private ingress exists; delivery remains gated |
| Backend | Data Centre platform | `/v1/config/*`, `/v1/events`, `/v1/audit` | `PLATFORM_INTERNAL_TOKEN` for protected writes | Provider API exists; Backend typed client is not verified |
| Backend | CDN | Media URL/origin configuration; CDN is fetched by clients | Public URL or expiring private playback token; purge token is operator-only | Edge routes exist; production wiring not verified |
| Data Centre | CDN / object storage | Origin and media byte paths | Server-side origin credentials; never browser-visible | Deployment-specific |
| Federation | remote instances | ActivityPub WebFinger, actor, inbox/outbox | HTTP Signatures and HTTPS | Protocol surface exists; public rollout gated |
| API repo | all six repos | Versioned contracts, pinned snapshots, SDKs, CI | GitHub source artifacts; no runtime credentials | Governance only; not a runtime hop |

## Correlation and error rules

- Carry a bounded `X-Request-ID` across service-to-service calls; generate one at the first trusted ingress when absent.
- Do not forward an Appwrite user JWT as a service-to-service credential.
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
