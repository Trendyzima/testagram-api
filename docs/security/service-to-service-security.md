# Service-to-service security policy

## Identity classes

| Identity | Used by | Accepted by | Never use for |
|---|---|---|---|
| Testagram-native user access JWT | Flutter | Backend public API; user-aware Data Centre video/notification routes | Service-to-service authentication, CDN origin authentication |
| Encrypted `testagram-staff` session cookie | Admin Console browser | Admin Console staff routes | Flutter public API, private service credentials |
| Opaque rotating refresh token | Flutter secure storage; Admin Console encrypted session | Backend `/api/auth/refresh` only | Bearer authorization to any product/service route |
| Algorithm internal token | Backend | Algorithm | Flutter or Federation |
| Federation ingress token | Backend | Federation private ingress | Federation-to-Backend calls or public ActivityPub peers |
| Federation Backend token | Federation | Backend private APIs | Backend-to-Federation calls |
| Platform internal token | Authorized platform callers | Data Centre platform API | Browser/mobile or product authorization |
| CDN viewer assertion | Backend-authorized media clients | CDN private-media assertion relay and trusted origin | General API authentication or service-to-service identity |
| CDN origin and purge tokens | Backend/CDN runtime and authorized operators | Trusted CDN origin and purge routes respectively | Public SDK or client bundle |
| S3/object-store credentials | Backend/Data Centre runtime | Object storage | Flutter, CDN public responses or API docs |

## Mandatory controls

- Use a unique high-entropy secret for each service direction and audience.
- The Backend and user-aware Data Centre services must use the same `TESTAGRAM_AUTH_JWT_SECRET`; the Data Centre still rechecks the live PostgreSQL session/account state and does not trust a valid signature alone.
- Store credentials only in server-side deployment secret stores. No secret may appear in this repository, `.env.example` with a real value, generated SDK, public OpenAPI document, mobile build define or frontend bundle.
- Validate credentials in constant time where bearer comparison is implemented.
- Rotate secrets independently and document a staged overlap window.
- Require private network routing for internal endpoints; add mTLS/workload identity where deployment supports it.
- Enforce bounded request body, timeout, concurrency and response sizes.
- Propagate request IDs but never log raw authorization headers, JWTs, signed URLs, private message content or key material.
- Distinguish liveness from readiness. A readiness check must include dependencies required for that service's advertised function.
- Public ActivityPub uses protocol signatures; do not confuse protocol signatures with internal service bearer credentials.
- CDN viewer assertions are distinct from user access JWTs and from CDN origin/purge credentials. Never forward a raw user JWT as an origin service credential.

## Product authorization

Backend rechecks user permissions after every private service response that could influence returned product data. Algorithm scores, Federation events, Data Centre placement receipts and CDN cache hits are not authorization grants.
