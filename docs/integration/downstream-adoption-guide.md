# Downstream adoption guide for the six Testagram repositories

This guide describes how each runtime repository consumes this API repository. It does not make runtime changes automatically. All downstream changes must be separate reviewed pull requests.

## Release artifact policy

- Consume a tagged immutable release or exact commit SHA. Do not pin production to a moving branch.
- The public Flutter SDK contains only public Backend routes. Private service OpenAPI files and provider snapshots are documentation/governance artifacts, not client SDK exports.
- Provider-owned contracts remain authoritative in their source repositories. The API repository stores exact snapshots and source pins for compatibility review.
- A new contract release is not production cutover authorization. Each provider/consumer pair must pass its own tests.

## Flutter client — public API consumer

1. Pin the Dart package from the API repository using a release tag and the packages/dart path.
2. Set TESTAGRAM_API_URL to the public Backend origin at build time.
3. Supply the current Appwrite session JWT through the SDK token provider.
4. Use only public Backend OpenAPI operations. Do not import internal OpenAPI contracts into the app.
5. Never ship service tokens, object-store credentials, private hostnames, CDN purge credentials or internal API URLs.
6. Keep unsupported capabilities in an explicit unavailable state rather than fabricating data or falling back to another provider.

## Backend — public API and orchestration owner

1. Keep the Go Backend as the only public product API runtime.
2. Update contracts/openapi/testagram-v1.yaml when public route behavior changes, with handler/test evidence.
3. Update contracts/route-inventory/backend-public-routes.json and pass the pinned source route audit.
4. Consume Algorithm, Data Centre and Federation private contracts only from Backend-owned server-side clients.
5. Keep private route paths blocked at the public ingress even when they share the Backend listener.
6. Recheck authorization after ranking and after any private service response that could affect user-visible content.

## Data Centre — private platform and media infrastructure provider

1. Maintain the provider-owned platform OpenAPI and service catalogue in the Data Centre repository.
2. The API repo mirrors the current platform OpenAPI under contracts/upstream/datacentre.
3. Resolve the current conformance issues in the Data Centre platform audit before generating a typed Backend client.
4. Keep video and notification APIs separate from the platform configuration/event/audit API; publish dedicated provider contracts before client adoption.
5. Never accept product ownership or visibility decisions from infrastructure callers.

## CDN — media delivery provider

1. Keep edge implementation and origin/shield configuration in the CDN repository.
2. Maintain the CDN edge contract when route behavior, token rules, cache headers or range behavior changes.
3. Backend supplies authorized URLs; Flutter only consumes them. CDN does not own user identity or media lifecycle.
4. Resolve the fail-open PLAYBACK_SECRET behavior before private media is used in production.
5. Verify public host, DNS, TLS, origin and shield reachability independently.

## Federated Content — ActivityPub provider

1. Maintain the public ActivityPub OpenAPI and private ingress handler in the Federation repository.
2. Backend-to-Federation and Federation-to-Backend credentials are distinct and directional.
3. Backend owns local actor eligibility and canonical post visibility; Federation re-resolves those facts before protocol actions.
4. Use the versioned post-published schema with durable outbox polling; do not assume a broker is deployed.
5. Keep signed inbox/outbound workers disabled until signature, replay, consent, projection, fan-out, observability and interoperability gates pass.

## The Algorithm — private ranking provider

1. Maintain testagram-feed/api/openapi.yaml as the ranking provider contract.
2. Backend is the only caller and sends a bounded candidate set (1-200) with a requested result limit (1-50).
3. Return only unique IDs from the submitted candidate set and finite scores in [0,1].
4. Never read canonical user/post data, Appwrite, PostgreSQL or object storage from the ranker.
5. Backend validates ranker output and reapplies visibility and authorization before returning content.

## How to propose a cross-repository change

1. Make the provider change and tests in the owning repository.
2. Update that provider's own contract and merge/review it.
3. Advance the provider SHA in contracts/sources.lock.json.
4. Refresh snapshots from the exact pinned commit and update the registry.
5. Run all six-source audits and consumer/provider tests.
6. Open downstream PRs to the affected repositories, pinning the reviewed API release.
7. Coordinate deployment order and rollback. Never deploy based only on a green contract-repository CI run.
