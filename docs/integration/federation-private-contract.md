# Federation private API and event contract

**Provider:** `Trendyzima/federated-content`  
**Consumer:** Testagram Backend  
**Status:** private activity ingress is implemented; complete public federation rollout remains gated.

## Ownership

Backend owns local canonical identity, account status, federation consent, blocks, local posts, visibility, moderation and authorization. Federation owns protocol state: actor key material, remote actor/object cache, inbox receipts, ActivityPub outbox and delivery attempts.

Federation must not create canonical local users/posts or grant local visibility. Flutter must never call Federation's private API.

## Backend -> Federation activity ingress

`POST /internal/v1/activities`

Required headers:
- `Authorization: Bearer <FEDERATION_INTERNAL_TOKEN>` (the Backend-to-Federation secret; injected into the Federation container as `FEDERATION_INGRESS_TOKEN`)
- `Content-Type: application/json`

The Backend client also sends `X-Request-ID` and `Idempotency-Key` as correlation hints. The provider currently generates a request ID if absent and uses the body `activity_id` as its durable idempotency identity; it does not require the `Idempotency-Key` header.

Request shape:
```json
{
  "activity_id": "https://testagram.site/activities/opaque-id",
  "actor_user_id": "canonical-backend-user-id",
  "activity": {
    "id": "https://testagram.site/activities/opaque-id",
    "type": "Create",
    "actor": "https://federation.testagram.site/users/handle",
    "object": {"id": "https://testagram.site/posts/opaque-id"}
  }
}
```

- Accepted first-slice activity types: Create, Update, Delete, Like and Announce.
- Request body maximum: 1 MiB.
- Unknown top-level JSON fields and trailing JSON values are rejected.
- Activity ID is idempotent. Reusing an ID with a different actor or payload is rejected.
- HTTP 202 is returned only after protocol outbox and delivery jobs are durably accepted.
- Delivery happens asynchronously outside the database transaction.

## Federation -> Backend private actor API

The six-runtime-repository integration contract documents these Backend endpoints for Federation:
- `GET /internal/v1/federation/readyz`
- `GET /internal/v1/federation/actors/{handle}`
- `GET /internal/v1/federation/actors/by-id/{user_id}`

These are private service interfaces, not public client APIs. Federation uses the distinct `FEDERATION_BACKEND_INTERNAL_TOKEN` (injected into the Federation container as `BACKEND_INTERNAL_TOKEN`); Backend-to-Federation uses `FEDERATION_INTERNAL_TOKEN` (injected as `FEDERATION_INGRESS_TOKEN`). These values must be independently generated and at least 32 characters. No shared-token fallback is permitted. Never reuse Appwrite user JWTs or one directional token for the reverse direction.

Actor responses and outbox cursor DTOs must be promoted to strict machine-readable schemas after provider/consumer tests are aligned. This document does not invent response fields that are not currently frozen.

## Backend-owned public ActivityPub objects and outbound Create

- Backend inserts a `Create` activity into its transactional outbox in the same PostgreSQL transaction as an opted-in account's public post.
- Federation's dispatcher performs asynchronous signed delivery to the accepted remote-follower routing cache; a post request never waits for remote network delivery.
- Public object IDs use `https://<federation-origin>/objects/{post_id}`.
- Federation dereferences those IDs through `GET /internal/v1/federation/objects/{post_id}`; Backend rechecks that the post is public and its author remains active, discoverable, non-protected and federation-enabled.
- The public object route is `GET /objects/{post_id}` and returns ActivityPub JSON only. Private, deleted, protected or opted-out posts return 404.
- Backend readiness and actor resolution fail closed if the transactional Federation publisher is not configured. Users cannot newly enable federation without that publisher.

## Verified inbound remote follows

Federation validates the remote actor's HTTP Signature and the activity identity before calling the Backend private API:

- `POST /internal/v1/federation/remote-follows` records the remote follower in Backend's canonical social graph.
- `POST /internal/v1/federation/remote-follows/undo` removes that canonical relationship only when the request includes the exact original `follow_activity_id` referenced by the signed Undo.
- Backend rechecks local account activity, federation consent, discoverability and public-account privacy on every mutation.
- Federation's `remote_followers` rows are a delivery-routing cache only. They are updated only after the Backend transaction succeeds.
- Backend failure is retryable. A policy rejection is permanent and must not trigger an ActivityPub Accept.
- The Backend migration is `migrations/20261112_federation_remote_follows.sql`; the Neon mirror is `migrations/neon/003_federation_remote_follows.sql`.

## Published-post event

The private provider interfaces are specified in [Federation ingress OpenAPI](../../contracts/internal/openapi/federation-ingress-v1.yaml) and [Backend actor-provider OpenAPI](../../contracts/internal/openapi/backend-federation-provider-v1.yaml). Their source handlers are pinned in the source lock. Actor response DTOs are strict in the current Backend handler; outbox cursor DTOs must be promoted only when the exact provider endpoints are registered and tested.

The canonical event schema is mirrored from `federated-content/api/events/post-published.v1.schema.json` at the exact commit in `contracts/sources.lock.json`.

The transport is the Backend transactional PostgreSQL outbox and Federation's bounded poller, not a generic message broker. Federation must fetch canonical content and recipients through authenticated Backend APIs, recheck federation consent, and exclude direct/private content. Event payload is a notification of a committed change, not proof of authorization.

## Public ActivityPub endpoints

Public WebFinger, actor, inbox and outbox routes are owned by Federation and documented in the provider's OpenAPI snapshot. The provider registers `POST /users/{username}/inbox`; it verifies the remote HTTP Signature, rechecks local Backend eligibility, persists the inbox receipt and only then returns HTTP 202. Readiness requires both Federation PostgreSQL and the private Backend identity dependency; unavailable dependencies return HTTP 503. Route registration and durable acceptance do not mean that public routing or background workers are enabled. Follow and Undo are the only inbound activity types with active domain processing in the current implementation; other accepted types remain quarantined until their Backend-authorized projections exist. Inbound HTTP Signatures are separate from private service bearer authentication. Keep public inbox routing and delivery/inbox/outbox workers disabled until projection, replay, consent, fan-out, monitoring, restore, key rotation and external interoperability gates pass.
