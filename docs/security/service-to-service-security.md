# Service-to-service security policy

## Identity classes

| Identity | Used by | Accepted by | Never use for |
|---|---|---|---|
| Appwrite user-session JWT | Flutter | Backend public API | Service-to-service authentication |
| Algorithm internal token | Backend | Algorithm | Flutter or Federation |
| Federation Backend token | Federation | Backend private APIs | Backend-to-Federation calls |
| Federation service token | Backend | Federation private ingress | Flutter or public ActivityPub peers |
| Platform internal token | Authorized platform callers | Data Centre platform API | Browser/mobile or product authorization |
| CDN purge token | Operator/authorized backend maintenance | CDN purge route | Public SDK or client bundle |
| S3/object-store credentials | Backend/Data Centre runtime | Object storage | Flutter, CDN public responses or API docs |

## Mandatory controls

- Use a unique high-entropy secret for each service direction and audience.
- Store credentials only in server-side deployment secret stores. No secret may appear in this repository, `.env.example` with a real value, generated SDK, public OpenAPI document, mobile build define or frontend bundle.
- Validate credentials in constant time where bearer comparison is implemented.
- Rotate secrets independently and document a staged overlap window.
- Require private network routing for internal endpoints; add mTLS/workload identity where deployment supports it.
- Enforce bounded request body, timeout, concurrency and response sizes.
- Propagate request IDs but never log raw authorization headers, JWTs, signed URLs, private message content or key material.
- Distinguish liveness from readiness. A readiness check must include dependencies required for that service's advertised function.
- Public ActivityPub uses protocol signatures; do not confuse protocol signatures with internal service bearer credentials.

## Product authorization

Backend rechecks user permissions after every private service response that could influence returned product data. Algorithm scores, Federation events, Data Centre placement receipts and CDN cache hits are not authorization grants.
