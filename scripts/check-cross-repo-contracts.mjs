import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const lock = JSON.parse(readFileSync("contracts/sources.lock.json", "utf8"));
const registry = JSON.parse(readFileSync("contracts/registry/services.json", "utf8"));
const required = ["backend", "data-centre", "cdn", "flutter-client", "federation", "algorithm"];
const fail = [];
const keys = Object.keys(lock.repositories).sort();
const allowedKeys = [...required].sort();
if (required.some((key) => !keys.includes(key)) || keys.some((key) => !allowedKeys.includes(key))) {
  fail.push(`Expected exactly six native runtime repositories; found: ${keys.join(", ")}`);
}
const registryRepos = new Set(registry.services.map((s) => s.repository.toLowerCase()));
const serviceIds = new Set();
for (const service of registry.services) {
  if (serviceIds.has(service.id)) fail.push(`Duplicate service registry ID: ${service.id}`);
  serviceIds.add(service.id);
  if (!service.status || !service.role || !service.repository) fail.push(`Incomplete service registry entry: ${service.id}`);
  if (!Array.isArray(service.contracts) || service.contracts.length === 0) fail.push(`No contract references registered for: ${service.id}`);
  for (const contractPath of service.contracts || []) {
    if (!existsSync(resolve(contractPath))) fail.push(`${service.id}: contract reference missing: ${contractPath}`);
  }
}
if (registry.services.length !== 6) fail.push(`Expected six runtime services; found ${registry.services.length}`);
for (const key of required) {
  const entry = lock.repositories[key];
  if (!entry) continue;
  if (!/^[a-f0-9]{40}$/.test(entry.ref)) fail.push(`${key}: ref must be a full immutable commit SHA`);
  const root = resolve(entry.checkoutPath);
  if (!existsSync(root)) {
    fail.push(`${key}: checkout missing at ${entry.checkoutPath}`);
    continue;
  }
  try {
    const actual = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    if (actual !== entry.ref) fail.push(`${key}: checkout ${actual} does not match pinned ${entry.ref}`);
  } catch {
    fail.push(`${key}: cannot read checked-out git revision`);
  }
  for (const sourcePath of entry.sourcePaths) {
    if (!existsSync(resolve(root, sourcePath))) fail.push(`${key}: pinned source path missing: ${sourcePath}`);
  }
  const repoName = entry.fullName.toLowerCase();
  if (!registryRepos.has(repoName)) fail.push(`${key}: repository missing from service registry`);
}

for (const snapshot of lock.snapshots) {
  const entry = lock.repositories[snapshot.repository];
  if (!entry) {
    fail.push(`Snapshot references unknown repository: ${snapshot.repository}`);
    continue;
  }
  const source = resolve(entry.checkoutPath, snapshot.sourcePath);
  const target = resolve(snapshot.snapshotPath);
  if (!existsSync(source) || !existsSync(target)) {
    fail.push(`Snapshot source or target missing: ${snapshot.sourcePath} -> ${snapshot.snapshotPath}`);
    continue;
  }
  const sourceText = readFileSync(source, "utf8").replace(/\r\n/g, "\n");
  const targetText = readFileSync(target, "utf8").replace(/\r\n/g, "\n");
  if (sourceText !== targetText) fail.push(`Snapshot drift: ${snapshot.snapshotPath} differs from pinned ${snapshot.repository}:${snapshot.sourcePath}`);
}

// The Data Centre media API is a three-party contract: Backend client, OpenAPI
// snapshot, and Data Centre provider handlers must expose the same five routes.
const backendMediaClient = readFileSync(resolve(lock.repositories.backend.checkoutPath, "internal/datacentreclient/client.go"), "utf8");
const backendMediaTests = readFileSync(resolve(lock.repositories.backend.checkoutPath, "internal/datacentreclient/client_test.go"), "utf8");
const dataCentreMediaServer = readFileSync(resolve(lock.repositories["data-centre"].checkoutPath, "backend/services/media/main.go"), "utf8");
const dataCentreMediaOpenAPI = readFileSync("contracts/upstream/datacentre/media-lifecycle-v1.openapi.yaml", "utf8");
const mediaRoutes = [
  { path: "/internal/v1/media/upload-url", method: "POST", client: "post(ctx,", provider: 'mux.HandleFunc("/internal/v1/media/upload-url"' },
  { path: "/internal/v1/media/verify", method: "POST", client: "post(ctx,", provider: 'mux.HandleFunc("/internal/v1/media/verify"' },
  { path: "/internal/v1/media/status", method: "GET", client: "get(ctx,", provider: 'mux.HandleFunc("/internal/v1/media/status"' },
  { path: "/internal/v1/media/download-url", method: "POST", client: "post(ctx,", provider: 'mux.HandleFunc("/internal/v1/media/download-url"' },
  { path: "/internal/v1/media/delete", method: "POST", client: "post(ctx,", provider: 'mux.HandleFunc("/internal/v1/media/delete"' },
];
for (const route of mediaRoutes) {
  const clientSuffix = route.path.slice("/internal/v1/media".length);
  const clientRouteMarker = route.path.endsWith("/status")
    ? `c.prefix+"${clientSuffix}?"`
    : `c.prefix+"${clientSuffix}"`;
  if (!backendMediaClient.includes(clientRouteMarker)) fail.push(`Backend Data Centre client missing route suffix: ${clientSuffix}`);
  if (!dataCentreMediaServer.includes(route.provider)) fail.push(`Data Centre media server missing handler: ${route.path}`);
  if (!dataCentreMediaOpenAPI.includes(route.path)) fail.push(`Data Centre media OpenAPI missing route: ${route.path}`);
  if (!dataCentreMediaOpenAPI.includes(`  ${route.path}:\n    ${route.method.toLowerCase()}:`)) fail.push(`Data Centre media OpenAPI method mismatch: ${route.method} ${route.path}`);
  if (!backendMediaTests.includes(route.path)) fail.push(`Backend Data Centre client tests missing route coverage: ${route.path}`);
}
if (!backendMediaClient.includes('"X-Testagram-API-Version"')) fail.push("Backend Data Centre client must send X-Testagram-API-Version");
if (!dataCentreMediaServer.includes('r.Header.Get("X-Testagram-API-Version")')) fail.push("Data Centre media server must enforce X-Testagram-API-Version");

const identityEvidenceOpenAPI = readFileSync("contracts/upstream/datacentre/identity-evidence-v1.openapi.yaml", "utf8");
const identityEvidenceTests = readFileSync(resolve(lock.repositories["data-centre"].checkoutPath, "backend/services/media/main_test.go"), "utf8");
const backendAPIEntry = readFileSync(resolve(lock.repositories.backend.checkoutPath, "cmd/api/main.go"), "utf8");
const identityEvidenceRoutes = [
  ["/internal/v1/identity-evidence/readyz", "s.identityReady"],
  ["/internal/v1/identity-evidence/upload-url", "s.uploadURL"],
  ["/internal/v1/identity-evidence/verify", "s.verify"],
  ["/internal/v1/identity-evidence/status", "s.status"],
  ["/internal/v1/identity-evidence/download-url", "s.downloadURL"],
  ["/internal/v1/identity-evidence/delete", "s.delete"],
];
for (const [path, handler] of identityEvidenceRoutes) {
  if (!dataCentreMediaServer.includes(`mux.HandleFunc("${path}",${handler})`)) fail.push(`Data Centre identity-evidence provider missing route: ${path}`);
  if (!identityEvidenceOpenAPI.includes(`${path}:`)) fail.push(`Data Centre identity-evidence OpenAPI missing route: ${path}`);
}
for (const [label, source, marker] of [
  ["Backend Data Centre identity client", backendMediaClient, 'c.prefix = "/internal/v1/identity-evidence"'],
  ["Backend identity-evidence config", backendAPIEntry, 'env("IDENTITY_EVIDENCE_DATA_CENTRE_INTERNAL_TOKEN", "")'],
  ["Backend identity-evidence config", backendAPIEntry, "NewIdentityEvidenceClient(dataCentreURL, identityEvidenceToken"],
  ["Backend identity-evidence config", backendAPIEntry, "must be distinct from FRESH_DATA_CENTRE_INTERNAL_TOKEN"],
  ["Data Centre identity-evidence auth", dataCentreMediaServer, 'strings.HasPrefix(r.URL.Path,"/internal/v1/identity-evidence/")'],
  ["Data Centre identity-evidence auth", dataCentreMediaServer, "expected=s.cfg.identityToken"],
  ["Data Centre identity-evidence OpenAPI", identityEvidenceOpenAPI, "IdentityEvidenceBearer"],
  ["Data Centre identity-evidence OpenAPI", identityEvidenceOpenAPI, "identity-evidence-private"],
  ["Data Centre identity-evidence tests", identityEvidenceTests, "TestIdentityEvidenceNamespaceRequiresDedicatedRoute"],
  ["Data Centre identity-evidence tests", identityEvidenceTests, "TestIdentityEvidenceReadinessRequiresDedicatedCredential"],
  ["Data Centre identity-evidence tests", identityEvidenceTests, "TestIdentityEvidenceNamespaceIsPrivateAndBoundToApplication"],
]) {
  if (!source.includes(marker)) fail.push(`${label} missing isolated identity-evidence contract marker: ${marker}`);
}
const backendDataCentreClient = backendMediaClient;
const dataCentreVideoAuth = readFileSync(resolve(lock.repositories["data-centre"].checkoutPath, "backend/services/video/native_auth.go"), "utf8");
const dataCentreVideoMain = readFileSync(resolve(lock.repositories["data-centre"].checkoutPath, "backend/services/video/main.go"), "utf8");
const dataCentreNotification = readFileSync(resolve(lock.repositories["data-centre"].checkoutPath, "backend/services/notification/main.go"), "utf8");
for (const [label, source, marker] of [
  ["Backend Data Centre media client", backendDataCentreClient, 'req.Header.Set("Authorization", "Bearer "+c.token)'],
  ["Backend Data Centre media client", backendDataCentreClient, 'req.Header.Set("X-Request-ID", requestID())'],
  ["Backend Data Centre media client", backendDataCentreClient, "Timeout: 10 * time.Second"],
  ["Backend Data Centre media client", backendDataCentreClient, "http.ErrUseLastResponse"],
  ["Data Centre video auth", dataCentreVideoMain, 'os.Getenv("TESTAGRAM_AUTH_JWT_SECRET")'],
  ["Data Centre video auth", dataCentreVideoAuth, "nativeauth.ParseAccessToken"],
  ["Data Centre video auth", dataCentreVideoAuth, "nativeauth.ResolveUserID"],
  ["Data Centre notification auth", dataCentreNotification, 'mustEnv("TESTAGRAM_AUTH_JWT_SECRET")'],
  ["Data Centre notification auth", dataCentreNotification, "nativeauth.ResolveUserID"],
  ["Data Centre notification auth", dataCentreNotification, "context.WithTimeout(r.Context(), 4*time.Second)"],
]) {
  if (!source.includes(marker)) fail.push(`${label} missing native identity/private service wiring marker: ${marker}`);
}


 // Deployment wiring is part of the Backend <-> Data Centre contract.
 // Fresh-media credentials stay in the Data Centre service. Separately, the
 // Backend's VPS-primary identity-evidence replicator requires B2/R2 replica
 // credentials; those are mapped only behind MEDIA_REPLICATION_ENABLED.
 const backendCompose = readFileSync(resolve(lock.repositories.backend.checkoutPath, "deploy/self-hosted/docker-compose.yml"), "utf8");
 const backendDeploy = readFileSync(resolve(lock.repositories.backend.checkoutPath, "scripts/start-instabox-deployment.sh"), "utf8");
 const identityReplication = readFileSync(resolve(lock.repositories.backend.checkoutPath, "cmd/api/identity_media_replication.go"), "utf8");
 const backendDataCentreEnvExample = readFileSync(resolve(lock.repositories.backend.checkoutPath, "deploy/self-hosted/.env.example"), "utf8");
 const dataCentreCompose = readFileSync(resolve(lock.repositories["data-centre"].checkoutPath, "backend/docker-compose.yml"), "utf8");
 for (const variable of ["FRESH_MEDIA_ENABLED", "DATA_CENTRE_MEDIA_API_URL", "FRESH_DATA_CENTRE_INTERNAL_TOKEN"]) {
   if (!backendCompose.includes(variable)) fail.push(`Backend Compose missing Data Centre media variable: ${variable}`);
   if (!backendDataCentreEnvExample.includes(variable)) fail.push(`Backend env example missing Data Centre media variable: ${variable}`);
 }
 if (!backendDataCentreEnvExample.includes("DATA_CENTRE_MEDIA_API_URL=http://media:8096")) fail.push("Backend env example must use the private media service DNS endpoint");
 if (!dataCentreCompose.includes("MEDIA_INTERNAL_TOKEN: ${FRESH_DATA_CENTRE_INTERNAL_TOKEN:-}")) fail.push("Data Centre media service token must use FRESH_DATA_CENTRE_INTERNAL_TOKEN");
if (!dataCentreCompose.includes("IDENTITY_EVIDENCE_INTERNAL_TOKEN: ${IDENTITY_EVIDENCE_DATA_CENTRE_INTERNAL_TOKEN:-}")) fail.push("Data Centre media service must receive the identity-evidence token under its dedicated environment key");
if (!backendDeploy.includes("ensure_random_secret IDENTITY_EVIDENCE_DATA_CENTRE_INTERNAL_TOKEN") || !backendDeploy.includes('write_dc_env_value IDENTITY_EVIDENCE_DATA_CENTRE_INTERNAL_TOKEN "$IDENTITY_EVIDENCE_DATA_CENTRE_INTERNAL_TOKEN"')) fail.push("Backend deployment must provision a dedicated identity-evidence token to the Data Centre");
if (!backendDeploy.includes('write_env_value IDENTITY_EVIDENCE_DATA_CENTRE_INTERNAL_TOKEN "$IDENTITY_EVIDENCE_DATA_CENTRE_INTERNAL_TOKEN"') || !backendDeploy.includes('verify_container_env "$DC_ENV" "$DATACENTRE/backend/docker-compose.yml" media IDENTITY_EVIDENCE_INTERNAL_TOKEN "$IDENTITY_EVIDENCE_DATA_CENTRE_INTERNAL_TOKEN"')) fail.push("Backend deployment must verify the same dedicated identity-evidence token in both API and Data Centre containers");
if (!backendDeploy.includes('verify_container_env "$BASE_ENV" "$BASE_COMPOSE" api IDENTITY_EVIDENCE_DATA_CENTRE_INTERNAL_TOKEN "$IDENTITY_EVIDENCE_DATA_CENTRE_INTERNAL_TOKEN"')) fail.push("Backend deployment must verify the identity-evidence token in the API container");
if (!backendDeploy.includes('if [[ "$IDENTITY_EVIDENCE_DATA_CENTRE_INTERNAL_TOKEN" == "$FRESH_DATA_CENTRE_INTERNAL_TOKEN" ]]; then')) fail.push("Backend deployment must rotate the identity-evidence token if it equals the general media token");
 if (!backendDeploy.includes('write_dc_env_value FRESH_DATA_CENTRE_INTERNAL_TOKEN "$FRESH_DATA_CENTRE_INTERNAL_TOKEN"')) fail.push("Backend deployment must provision the same private media token into the Data Centre runtime env");
 if (!backendDeploy.includes('MEDIA_DATABASE_USER="$(read_dc_env_value MEDIA_DATABASE_USER)"') ||
    !backendDeploy.includes('MEDIA_DATABASE_PASSWORD="$(read_dc_env_value MEDIA_DATABASE_PASSWORD)"') ||
    !backendDeploy.includes('write_dc_env_value MEDIA_DATABASE_URL "$MEDIA_DATABASE_URL"') ||
    !backendDeploy.includes('postgresql://${MEDIA_DATABASE_USER}:${MEDIA_DATABASE_PASSWORD}@federation-db:5432/${MEDIA_DATABASE_NAME}?sslmode=disable')) {
    fail.push("Backend deployment must provision the dedicated media database URL with its persistent least-privilege role");
  }
 if (!backendDeploy.includes('if [[ "${DATA_CENTRE_MEDIA_ENABLED:-false}" == "true" && "${FRESH_MEDIA_ENABLED:-false}" == "true" ]]; then')) fail.push("Data Centre media provider credentials must require both independent media gates");
 if (!backendDeploy.includes('FRESH_MEDIA_ENABLED and DATA_CENTRE_MEDIA_ENABLED must both be true or both be false')) fail.push("Backend deployment must reject inconsistent Data Centre media feature gates");
 if (!dataCentreCompose.includes("name: ${TESTAGRAM_NETWORK:-testagram-platform}") || !dataCentreCompose.includes("external: true")) fail.push("Data Centre media service must join the externally-created Backend platform network");
 if (!dataCentreCompose.includes("networks: [platform]")) fail.push("Data Centre media service must join the Backend-owned private platform network");
 if (!dataCentreCompose.includes('expose: ["8096"]')) fail.push("Data Centre media API must expose only the private container port, not publish it publicly");
 if (!backendCompose.includes("B2_S3_ACCESS_KEY_ID:") || !backendCompose.includes("B2_S3_SECRET_ACCESS_KEY:") || !backendCompose.includes("CLOUDFLARE_R2_ACCESS_KEY_ID:") || !backendCompose.includes("CLOUDFLARE_R2_SECRET_ACCESS_KEY:")) fail.push("Backend identity-evidence replica credentials must be mapped into the VPS API container");
 if (!backendCompose.includes("MEDIA_REPLICATION_ENABLED:")) fail.push("Backend Compose must preserve the explicit three-provider replication feature gate");
 const backendReplicaGate = backendDeploy.indexOf('if [[ "$(read_env_value MEDIA_REPLICATION_ENABLED)" == "true" ]]; then');
const backendReplicaElse = backendDeploy.indexOf('else\n  # Do not leave old provider credentials mounted in the Backend', backendReplicaGate);
if (backendReplicaGate < 0 || backendReplicaElse < 0 ||
    !backendDeploy.slice(backendReplicaGate, backendReplicaElse).includes('write_env_value "$key" "$value"') ||
    !backendDeploy.slice(backendReplicaElse).includes('write_env_value "$key" ""')) {
  fail.push("Backend API B2/R2 replica credentials must be installed only behind MEDIA_REPLICATION_ENABLED and cleared when it is false");
}
const dataCentreMediaGate = 'if [[ "${DATA_CENTRE_MEDIA_ENABLED:-false}" == "true" && "${FRESH_MEDIA_ENABLED:-false}" == "true" ]]; then';
if (!backendDeploy.includes(dataCentreMediaGate) ||
    !backendDeploy.includes('write_dc_env_value "$key" "$value"') ||
    !dataCentreCompose.includes("B2_S3_ACCESS_KEY_ID: ${B2_S3_ACCESS_KEY_ID:-}") ||
    !dataCentreCompose.includes("CLOUDFLARE_R2_ACCESS_KEY_ID: ${CLOUDFLARE_R2_ACCESS_KEY_ID:-}")) {
  fail.push("B2/R2 provider credentials must be isolated to the private Data Centre media service behind both Data Centre media gates");
}
 if (!identityReplication.includes("identityBucket == privateBucket") || !identityReplication.includes("identityBucket == publicBucket") || !identityReplication.includes('strings.TrimSpace(os.Getenv("B2_S3_IDENTITY_EVIDENCE_PRIVATE_BUCKET"))') || !identityReplication.includes('strings.TrimSpace(os.Getenv("CLOUDFLARE_R2_IDENTITY_EVIDENCE_PRIVATE_BUCKET"))')) fail.push("Backend identity evidence must use dedicated MinIO/B2/R2 buckets distinct from ordinary media");
 if (!backendDeploy.includes("B2_S3_IDENTITY_EVIDENCE_PRIVATE_BUCKET") || !backendDeploy.includes("CLOUDFLARE_R2_IDENTITY_EVIDENCE_PRIVATE_BUCKET") || !backendDeploy.includes("VPS identity evidence bucket must be dedicated")) fail.push("Backend deployment must require explicit dedicated identity-evidence buckets before enabling replication");
 if (!backendDeploy.includes('if [[ "${DATA_CENTRE_MEDIA_ENABLED:-false}" == "true" && "${FRESH_MEDIA_ENABLED:-false}" == "true" ]]; then')) fail.push("Data Centre media provider credentials must remain behind both independent media gates");


 // The public Caddy edge and the private video origin must never share a
 // Docker network. Backend API and video share a dedicated internal network;
 // Caddy retains platform for the separately gated Federation deployment.
 const backendPostgresStart = backendCompose.indexOf("\n  postgres:\n");
 const backendPostgresEnd = backendCompose.indexOf("\n  control-plane:", backendPostgresStart);
 const backendPostgresService = backendPostgresStart >= 0 && backendPostgresEnd > backendPostgresStart
   ? backendCompose.slice(backendPostgresStart, backendPostgresEnd)
   : "";
 const backendCaddyStart = backendCompose.indexOf("\n  caddy:\n");
 const backendCaddyEnd = backendCompose.indexOf("\n  node-exporter:", backendCaddyStart);
 const backendCaddyService = backendCaddyStart >= 0 && backendCaddyEnd > backendCaddyStart
   ? backendCompose.slice(backendCaddyStart, backendCaddyEnd)
   : "";
 const backendAPIStart = backendCompose.indexOf("\n  api:\n");
 const backendAPIEnd = backendCompose.indexOf("\n  admin-console:", backendAPIStart);
 const backendAPIService = backendAPIStart >= 0 && backendAPIEnd > backendAPIStart
   ? backendCompose.slice(backendAPIStart, backendAPIEnd)
   : "";
 const dataCentreVideoStart = dataCentreCompose.indexOf("\n  video:\n");
 const dataCentreVideoEnd = dataCentreCompose.indexOf("\n  video-worker:", dataCentreVideoStart);
 const dataCentreVideoService = dataCentreVideoStart >= 0 && dataCentreVideoEnd > dataCentreVideoStart
   ? dataCentreCompose.slice(dataCentreVideoStart, dataCentreVideoEnd)
   : "";
 if (!backendCaddyService.includes("networks: [edge, control-plane, platform]") ||
     backendCaddyService.includes("video-private")) {
   fail.push("Caddy must retain Federation platform connectivity but must not join the dedicated video-private network");
 }
 if (!backendAPIService.includes("networks: [edge, data, monitoring, platform, egress, video-private]")) {
   fail.push("Backend API must join the dedicated video-private network while retaining its existing service networks");
 }
 if (!backendPostgresService.includes("video-private: {}")) {
   fail.push("Backend PostgreSQL must join video-private so the isolated video service can reach the canonical database without joining platform");
 }
 if (!backendCompose.includes("video-private:\n    name: ${TESTAGRAM_VIDEO_NETWORK:-testagram-video-private}\n    internal: true")) {
   fail.push("Backend Compose must create the dedicated internal video-private network");
 }
 if (!dataCentreVideoService.includes("networks: [internal, egress, video-private]") ||
     dataCentreVideoService.includes("edge") || dataCentreVideoService.includes("platform") ||
     dataCentreVideoService.includes("\n    ports:") || dataCentreVideoService.includes("\n    expose:")) {
   fail.push("Data Centre video service must be private on internal/egress/video-private only, with no host-published port");
 }
 if (!dataCentreCompose.includes("video-private:\n    external: true\n    name: ${TESTAGRAM_VIDEO_NETWORK:-testagram-video-private}")) {
   fail.push("Data Centre video service must join the Backend-created external video-private network");
 }
 if (!backendDeploy.includes("write_dc_env_value TESTAGRAM_VIDEO_NETWORK")) {
   fail.push("Backend deployment must pass the dedicated video-private network name to the Data Centre overlay");
 }

// Verify the other service-to-service edges against both pinned producers and consumers.
// These are source-level contract guards; staging tests remain separate release gates.
const algorithmClient = readFileSync(resolve(lock.repositories.backend.checkoutPath, "internal/algorithmclient/client.go"), "utf8");
const algorithmOpenAPI = readFileSync(resolve(lock.repositories.algorithm.checkoutPath, "testagram-feed/api/openapi.yaml"), "utf8");
const algorithmRankTests = readFileSync(resolve(lock.repositories.backend.checkoutPath, "internal/algorithmclient/client_test.go"), "utf8");
for (const [label, source, marker] of [
  ["Backend Algorithm client", algorithmClient, "/v1/feed/rank"],
  ["Algorithm OpenAPI", algorithmOpenAPI, "/v1/feed/rank:"],
  ["Backend Algorithm client", algorithmClient, 'req.Header.Set("X-Testagram-API-Version", "1")'],
  ["Backend Algorithm client", algorithmClient, 'req.Header.Set("Authorization", "Bearer "+c.token)'],
  ["Backend Algorithm tests", algorithmRankTests, "/v1/feed/rank"],
]) {
  if (!source.includes(marker)) fail.push(`${label} missing agreed ranking contract marker: ${marker}`);
}
if (!algorithmClient.includes('req.Header.Set("X-Request-ID", newRequestID())') || !algorithmClient.includes("1200 * time.Millisecond") || !algorithmClient.includes("timeout > 5*time.Second")) fail.push("Backend Algorithm client must use request IDs and a bounded timeout");
if (!algorithmClient.includes("len(input.Candidates) > 200") || !algorithmClient.includes("input.Limit > 50")) {
  fail.push("Backend Algorithm client must enforce the 200-candidate / 50-result bounds");
}

const rankingPath = algorithmOpenAPI.indexOf("/v1/feed/rank:");
const rankingContract = rankingPath >= 0 ? algorithmOpenAPI.slice(rankingPath, rankingPath + 2400) : "";
if (!rankingContract.includes("required: [limit, feedMode, candidates]")) {
  fail.push("Algorithm OpenAPI must require feedMode for POST /v1/feed/rank");
}
if (!rankingContract.includes("enum: [for_you, following, media, discover]")) {
  fail.push("Algorithm OpenAPI feedMode enum must match the Backend-supported modes");
}
if (!algorithmClient.includes('case "for_you", "following", "media", "discover":')) {
  fail.push("Backend Algorithm client must validate exactly the feedMode enum published by the Algorithm contract");
}
const algorithmServer = readFileSync(resolve(lock.repositories.algorithm.checkoutPath, "testagram-feed/cmd/feed-api/main.go"), "utf8");
for (const [label, source, marker] of [
  ["Backend Algorithm topic client", algorithmClient, "/v1/topics/rank"],
  ["Algorithm topic OpenAPI", algorithmOpenAPI, "/v1/topics/rank:"],
  ["Algorithm topic provider", algorithmServer, 'HandleFunc("POST /v1/topics/rank"'],
  ["Backend Algorithm topic tests", algorithmRankTests, "TestRankTopicsSendsAuthenticatedBoundedContract"],
]) {
  if (!source.includes(marker)) fail.push(`${label} missing agreed topic-ranking contract marker: ${marker}`);
}
const topicRankingPath = algorithmOpenAPI.indexOf("/v1/topics/rank:");
const topicRankingContract = topicRankingPath >= 0 ? algorithmOpenAPI.slice(topicRankingPath, topicRankingPath + 2400) : "";
if (!topicRankingContract.includes("required: [limit, candidates]") || !topicRankingContract.includes("maxItems: 200")) {
  fail.push("Algorithm topic OpenAPI must bound Backend-authorized candidates and require a result limit");
}

const backendFederationClient = [
  readFileSync(resolve(lock.repositories.backend.checkoutPath, "internal/federationclient/client.go"), "utf8"),
  readFileSync(resolve(lock.repositories.backend.checkoutPath, "internal/federationclient/remote_subscription.go"), "utf8"),
].join("\n");
const federationServer = readFileSync(resolve(lock.repositories.federation.checkoutPath, "internal/httpapi/server.go"), "utf8");
const federationATProto = readFileSync(resolve(lock.repositories.federation.checkoutPath, "internal/httpapi/atproto_internal.go"), "utf8");
const federationRemoteObjects = readFileSync(resolve(lock.repositories.federation.checkoutPath, "internal/httpapi/remote_objects_internal.go"), "utf8");
const federationPrivateOpenAPI = readFileSync("contracts/upstream/federation/backend-private-v1.openapi.yaml", "utf8");
const internalFederationOpenAPI = readFileSync("contracts/internal/openapi/federation-ingress-v1.yaml", "utf8");
const federationIngress = readFileSync(resolve(lock.repositories.federation.checkoutPath, "internal/httpapi/internal_activities.go"), "utf8");
const federationTests = readFileSync(resolve(lock.repositories.federation.checkoutPath, "internal/httpapi/internal_activities_test.go"), "utf8");
const federationRemoteSubscription = readFileSync(resolve(lock.repositories.federation.checkoutPath, "internal/httpapi/remote_subscriptions_internal.go"), "utf8");
const federationRemoteSubscriptionTests = readFileSync(resolve(lock.repositories.federation.checkoutPath, "internal/httpapi/remote_subscriptions_internal_test.go"), "utf8");
for (const [label, source, marker] of [
  ["Backend Federation client", backendFederationClient, "/internal/v1/activities"],
  ["Backend Federation client", backendFederationClient, 'req.Header.Set("Idempotency-Key", input.ActivityID)'],
  ["Federation server", federationServer, 'HandleFunc("POST /internal/v1/activities"'],
  ["Federation ingress", federationIngress, "validInternalBearer(r, ingressToken)"],
  ["Federation ingress", federationIngress, "EnqueueOutbox"],
  ["Federation ingress", federationIngress, "http.StatusAccepted"],
  ["Backend Federation client", backendFederationClient, '/internal/v1/atproto/feed'],
  ["Federation server", federationServer, 'HandleFunc("POST /internal/v1/atproto/feed"'],
  ["Backend Federation client", backendFederationClient, '/internal/v1/remote-objects'],
  ["Federation server", federationServer, 'HandleFunc("POST /internal/v1/remote-objects"'],
  ["Federation private provider OpenAPI", federationPrivateOpenAPI, "/internal/v1/activities:"],
  ["Federation private provider OpenAPI", federationPrivateOpenAPI, "/internal/v1/remote-objects:"],
  ["Federation private provider OpenAPI", federationPrivateOpenAPI, "/internal/v1/atproto/feed:"],
  ["Federation private provider OpenAPI", federationPrivateOpenAPI, "/internal/v1/remote-subscriptions/verify:"],
  ["API Control Plane Federation OpenAPI", internalFederationOpenAPI, "/internal/v1/remote-objects:"],
  ["API Control Plane Federation OpenAPI", internalFederationOpenAPI, "/internal/v1/activities:"],
  ["API Control Plane Federation OpenAPI", internalFederationOpenAPI, "/internal/v1/atproto/feed:"],
  ["API Control Plane Federation OpenAPI", internalFederationOpenAPI, "/internal/v1/remote-subscriptions/verify:"],
  ["Federation ATProto handler", federationATProto, "validInternalBearer(r, token)"],
  ["Federation ATProto handler", federationATProto, "http.MaxBytesReader(w, r.Body, 16<<10)"],
  ["Federation remote-object handler", federationRemoteObjects, "validInternalBearer(r, token)"],
  ["Federation remote-object handler", federationRemoteObjects, "http.MaxBytesReader(w, r.Body, 32<<10)"],
  ["Backend Federation remote-subscription client", backendFederationClient, '/internal/v1/remote-subscriptions/verify'],
  ["Federation remote-subscription route", federationServer, 'HandleFunc("POST /internal/v1/remote-subscriptions/verify"'],
  ["Federation remote-subscription handler", federationRemoteSubscription, "validInternalBearer(r, token)"],
  ["Federation remote-subscription handler", federationRemoteSubscription, "s.backend.VerifyRemoteSubscription"],
  ["Federation remote-subscription handler", federationRemoteSubscription, "resolveRemoteActivityPubActor"],
  ["Federation remote-subscription handler", federationRemoteSubscription, "s.atproto.AuthorFeedByDID"],
]) {
  if (!source.includes(marker)) fail.push(`${label} missing agreed durable-ingress contract marker: ${marker}`);
}
if (!backendFederationClient.includes('req.Header.Set("X-Testagram-API-Version", "1")') || !backendFederationClient.includes('req.Header.Set("X-Request-ID", requestID)') || !backendFederationClient.includes("Idempotency-Key")) fail.push("Backend Federation client must send version, request ID and idempotency identity");
if (!federationPrivateOpenAPI.includes("federationServiceBearer") || !federationPrivateOpenAPI.includes("X-Testagram-API-Version")) fail.push("Federation private OpenAPI must document the dedicated service bearer and API version header");
if (!federationTests.includes("TestInternalActivityEndpointRejectsMissingServiceCredential") || !federationTests.includes("TestInternalActivityEndpointUsesDedicatedIngressCredential")) {
  fail.push("Federation ingress tests must prove missing and wrong-direction service credentials are rejected");
}
if (!federationRemoteSubscriptionTests.includes("TestResolveRemoteActivityPubActorRejectsUnsafeIdentitiesBeforeNetwork")) {
  fail.push("Federation remote-subscription actor-resolution safety regression test is missing");
}

// Staff lifecycle remains closed until the two-person approval ledger has a
// transactional executor. A single owner must not directly mutate staff
// permissions, roles, invitations or revocations from the Admin Console.
const backendAdminSecurity = readFileSync(resolve(lock.repositories.backend.checkoutPath, "admin-console/security.go"), "utf8");
const backendAdminMain = readFileSync(resolve(lock.repositories.backend.checkoutPath, "admin-console/main.go"), "utf8");
const permissionStart = backendAdminSecurity.indexOf("func (a *app) handleSetStaffPermission");
const permissionEnd = backendAdminSecurity.indexOf("func (a *app) handleStaffList", permissionStart);
if (permissionStart < 0 || permissionEnd < 0) {
  fail.push("Backend Admin Console staff-permission handler is missing");
} else {
  const permissionHandler = backendAdminSecurity.slice(permissionStart, permissionEnd);
  if (!permissionHandler.includes("http.StatusNotImplemented") || !permissionHandler.includes("two-person approval executor")) {
    fail.push("Backend staff permission mutation must remain closed until the two-person executor is implemented");
  }
  for (const marker of ["native_staff_permission_overrides", "INSERT INTO", "UPDATE testagram_auth"]) {
    if (permissionHandler.includes(marker)) fail.push(`Backend staff permission handler contains an unsafe direct mutation: ${marker}`);
  }
}
for (const [label, source, marker] of [
  ["Backend staff role change", backendAdminSecurity, 'http.StatusNotImplemented,map[string]string{"error":"Staff role changes require the two-person native staff approval workflow. No direct role mutation is permitted."}'],
  ["Backend staff revocation", backendAdminSecurity, 'http.StatusNotImplemented,map[string]string{"error":"Staff revocation requires the two-person native staff approval workflow. No direct role mutation is permitted."}'],
  ["Backend staff invitation", backendAdminMain, "Native staff invitation provisioning is not yet available"],
]) {
  if (!source.includes(marker)) fail.push(`${label} must remain closed until transactional two-person execution exists`);
}

// Verify the production Data Centre overlay joins Federation to private
// Backend networking. Public ActivityPub remains fail-closed at Caddy until
// the locked G3 protocol acceptance gate is independently passed.
const backendCaddyfile = readFileSync(resolve(lock.repositories.backend.checkoutPath, "deploy/self-hosted/Caddyfile"), "utf8");
for (const [label, source, marker] of [
  ["Data Centre Federation deployment", dataCentreCompose, "  federation-api:"],
  ["Data Centre Federation deployment", dataCentreCompose, "BACKEND_INTERNAL_URL: http://api:8082"],
  ["Data Centre Federation deployment", dataCentreCompose, 'expose: ["8081"]'],
  ["Data Centre Federation deployment", dataCentreCompose, "  platform:\n    external: true\n    name: ${TESTAGRAM_NETWORK:-testagram-platform}"],
  ["Data Centre Federation deployment", dataCentreCompose, "  edge:\n    external: true\n    name: ${TESTAGRAM_EDGE_NETWORK:-testagram-self-hosted_edge}"],
  ["Backend private API", backendCompose, 'INTERNAL_LISTEN_ADDR: ":8082"'],
  ["Backend Caddy deployment", backendCompose, "name: testagram-self-hosted"],
  ["Backend Caddy deployment", backendCompose, "networks: [edge, control-plane, platform]"],
  ["Backend Caddy Federation gate", backendCaddyfile, 'respond "Federation is disabled until locked G3 protocol acceptance passes." 503'],
]) {
  if (!source.includes(marker)) fail.push(`${label} missing shared-network federation wiring: ${marker}`);
}

// Public ActivityPub discovery is deliberately disabled until G3 acceptance.
// Keep the protocol handlers and apex path matcher present, but require Caddy
// to return 503 rather than proxying unaccepted public federation traffic.
const federationCaddy = readFileSync(resolve(lock.repositories.backend.checkoutPath, "deploy/self-hosted/Caddyfile"), "utf8");
const flutterDomainSmoke = readFileSync(resolve(lock.repositories["flutter-client"].checkoutPath, ".github/workflows/domain-smoke.yml"), "utf8");
const cdnWrangler = readFileSync(resolve(lock.repositories.cdn.checkoutPath, "cloudflare/wrangler.toml"), "utf8");
const cdnRoutingWorkflow = readFileSync(resolve(lock.repositories.cdn.checkoutPath, ".github/workflows/restore-canonical-host-routing.yml"), "utf8");
for (const [label, source, marker] of [
  ["Federation public discovery", federationServer, 'HandleFunc("GET /.well-known/webfinger"'],
  ["Federation public discovery", federationServer, 'HandleFunc("GET /.well-known/nodeinfo"'],
  ["Federation public discovery", federationServer, 'HandleFunc("GET /nodeinfo/2.1"'],
  ["Backend Caddy apex routing", federationCaddy, "@activitypub path /.well-known/webfinger* /.well-known/nodeinfo* /nodeinfo/* /users/* /inbox /outbox /objects/*"],
  ["Backend Caddy apex fail-closed gate", federationCaddy, 'respond "Federation is disabled until locked G3 protocol acceptance passes." 503'],
  ["Backend Caddy ordinary web redirect", federationCaddy, "redir https://www.testagram.site{uri} 308"],
  ["Flutter production smoke", flutterDomainSmoke, "Flutter application shell"],
  ["CDN apex route", cdnWrangler, 'pattern = "testagram.site/*"'],
  ["CDN WebFinger route transfer", cdnRoutingWorkflow, "confirm_legacy_webfinger_route_transfer"],
  ["CDN WebFinger route transfer", cdnRoutingWorkflow, 'select(.pattern=="testagram.site/.well-known/webfinger*")'],
  ["CDN WebFinger route transfer", cdnRoutingWorkflow, 'steps.preflight.outputs.legacy_webfinger_route_id'],
  ["CDN WebFinger route transfer", cdnRoutingWorkflow, 'DELETE "$API/zones/$zone_id/workers/routes/$route_id"'],
  ["CDN WebFinger route rollback", cdnRoutingWorkflow, "Restore the exact legacy WebFinger route if apex verification fails"],
  ["CDN WebFinger route rollback", cdnRoutingWorkflow, 'POST "$API/zones/$zone_id/workers/routes"'],
]) {
  if (!source.includes(marker)) fail.push(`${label} missing public Federation routing marker: ${marker}`);
}

// The public API ingress is a distinct Cloudflare Worker route, not the media CDN.
// Keep the edge token, trusted forwarding headers, Caddy gate, and route activation
// order identical across the Backend deployment artifacts.
const backendApiEdgeWorker = readFileSync(resolve(lock.repositories.backend.checkoutPath, "infra/cloudflare-api-gateway/src/index.mjs"), "utf8");
const backendApiEdgeTests = readFileSync(resolve(lock.repositories.backend.checkoutPath, "infra/cloudflare-api-gateway/test/index.test.mjs"), "utf8");
const backendApiEdgeWorkflow = readFileSync(resolve(lock.repositories.backend.checkoutPath, ".github/workflows/cloudflare-api-gateway.yml"), "utf8");
const backendApiEdgeWrangler = readFileSync(resolve(lock.repositories.backend.checkoutPath, "infra/cloudflare-api-gateway/wrangler.toml"), "utf8");
const backendApiEdgeDeployTest = readFileSync(resolve(lock.repositories.backend.checkoutPath, "tests/test_cloudflare_api_gateway_deployment_order.py"), "utf8");
const backendApiEdgeEnvExample = readFileSync(resolve(lock.repositories.backend.checkoutPath, "deploy/self-hosted/.env.example"), "utf8");
const backendDeployScript = readFileSync(resolve(lock.repositories.backend.checkoutPath, "scripts/start-instabox-deployment.sh"), "utf8");
for (const [label, source, marker] of [
  ["Backend API edge Worker", backendApiEdgeWorker, 'const EXPECTED_ORIGIN_HOST = "8443-agq4me2xgrgx5ge52ts437tqea.instabox.tech"'],
  ["Backend API edge Worker", backendApiEdgeWorker, 'headers.set("x-forwarded-host", API_HOST)'],
  ["Backend API edge Worker", backendApiEdgeWorker, 'headers.set("x-testagram-edge-token", edgeToken)'],
  ["Backend API edge Worker", backendApiEdgeWorker, 'headers.delete(name)'],
  ["Backend API edge tests", backendApiEdgeTests, "without trusting client forwarding headers"],
  ["Backend API edge tests", backendApiEdgeTests, "fails closed when the shared edge token is absent or malformed"],
  ["Backend API edge deployment test", backendApiEdgeDeployTest, "test_worker_is_not_publicly_routed_by_wrangler_before_secret_install"],
  ["Backend API edge deployment test", backendApiEdgeDeployTest, "test_preflight_fails_closed_on_any_overlapping_route_owned_by_another_worker"],
  ["Backend API edge workflow", backendApiEdgeWorkflow, "confirm_production_deploy"],
  ["Backend API edge workflow", backendApiEdgeWorkflow, "wrangler@4 secret put EDGE_PROXY_SHARED_TOKEN"],
  ["Backend API edge workflow", backendApiEdgeWorkflow, "API edge secret installed before route attachment"],
  ["Backend API edge workflow", backendApiEdgeWorkflow, "Canonical API route was not verified after attachment"],
  ["Backend API edge workflow", backendApiEdgeWorkflow, "exactly one active testagram.site zone in the pinned Cloudflare account"],
  ["Backend API edge workflow", backendApiEdgeWorkflow, "partial or overlapping cutover"],
  ["Backend API edge config", backendApiEdgeWrangler, "workers_dev = false"],
  ["Backend API edge config", backendApiEdgeWrangler, 'APP_ORIGIN = "https://8443-agq4me2xgrgx5ge52ts437tqea.instabox.tech"'],
  ["Backend Caddy API edge", backendCaddyfile, "@api_edge {"],
  ["Backend Caddy API edge", backendCaddyfile, "header_up X-Forwarded-Host api.testagram.site"],
  ["Backend Caddy API edge", backendCaddyfile, "header X-Testagram-Edge-Token {$EDGE_PROXY_SHARED_TOKEN}"],
  ["Backend Caddy API edge", backendCaddyfile, "header_up -X-Testagram-Edge-Token"],
  ["Backend Caddy API edge", backendCaddyfile, "reverse_proxy api:8080"],
  ["Backend Compose API edge", backendCompose, "EDGE_PROXY_SHARED_TOKEN: ${EDGE_PROXY_SHARED_TOKEN:?Set EDGE_PROXY_SHARED_TOKEN in .env}"],
  ["Backend edge env template", backendApiEdgeEnvExample, "EDGE_PROXY_SHARED_TOKEN=REPLACE_WITH_A_SEPARATE_RANDOM_32_BYTE_EDGE_TOKEN"],
  ["Backend deployment token persistence", backendDeployScript, 'write_env_value EDGE_PROXY_SHARED_TOKEN "$EDGE_PROXY_SHARED_TOKEN"'],
  ["Backend deployment token forwarding", backendDeployScript, "EDGE_PROXY_SHARED_TOKEN:$edge_proxy_token"],
]) {
  if (!source.includes(marker)) fail.push(`${label} missing shared API edge contract marker: ${marker}`);
}
const legacyOrigin = "https://8080-agq4me2xgrgx5ge52ts437tqea.instabox.tech";
if (backendApiEdgeWorker.includes("8080-agq4me2xgrgx5ge52ts437tqea.instabox.tech")) fail.push("Backend API edge Worker must not target the retired 8080 origin");
if (backendApiEdgeWrangler.includes("8080-agq4me2xgrgx5ge52ts437tqea.instabox.tech")) fail.push("Backend API edge config must not target the retired 8080 origin");
if (!backendApiEdgeTests.includes(legacyOrigin)) fail.push("Backend API edge tests must reject the retired 8080 origin");
const edgeSecretInstallIndex = backendApiEdgeWorkflow.indexOf("wrangler@4 secret put EDGE_PROXY_SHARED_TOKEN");
const edgeRouteAttachIndex = backendApiEdgeWorkflow.indexOf('"$API/zones/$zone_id/workers/routes" -o "$RUNNER_TEMP/edge-route-created.json"');
if (edgeSecretInstallIndex < 0 || edgeRouteAttachIndex < 0 || edgeSecretInstallIndex >= edgeRouteAttachIndex) {
  fail.push("Backend API edge must install EDGE_PROXY_SHARED_TOKEN before creating the public api.testagram.site route");
}
if (backendApiEdgeWrangler.includes("routes =")) {
  fail.push("Backend API edge Wrangler config must not attach a public route before the shared secret is installed");
}

const cdnServer = readFileSync(resolve(lock.repositories.cdn.checkoutPath, "internal/edge/server.go"), "utf8");
const cdnTests = readFileSync(resolve(lock.repositories.cdn.checkoutPath, "internal/edge/server_test.go"), "utf8");
for (const [label, source, marker] of [
  ["CDN server", cdnServer, 'strings.TrimSpace(s.cfg.OriginAuthToken)==""'],
  ["CDN server", cdnServer, '"X-Testagram-Viewer-Authorization"'],
  ["CDN server", cdnServer, '"X-Testagram-Origin-Auth"'],
  ["CDN server", cdnServer, '"private, no-store"'],
  ["CDN server", cdnServer, '"X-Testagram-Visibility"'],
  ["CDN tests", cdnTests, "TestPrivateAuthorizationDenialCannotFailOverToAnotherOrigin"],
  ["CDN tests", cdnTests, "TestReadyRequiresOriginServiceCredential"],
  ["CDN tests", cdnTests, "TestViewerAuthorizationIsNotForwardedAcrossOriginRedirect"],
]) {
  if (!source.includes(marker)) fail.push(`${label} missing fail-closed media authorization marker: ${marker}`);
}

// The Backend public/private CDN origin branch is now present on the pinned mainline.
// Keep its authorization and method-correct signing path coupled to the CDN contract.
const backendMediaAssertion = readFileSync(resolve(lock.repositories.backend.checkoutPath, "internal/mediaassertion/assertion.go"), "utf8");
for (const marker of [
  'issuer="testagram-backend"',
  'audience="testagram-cdn"',
  "DefaultTTL=2*time.Minute",
  "maxTTL=5*time.Minute",
  "hmac.Equal",
  "m[1]!=owner",
]) {
  if (!backendMediaAssertion.includes(marker)) fail.push(`Backend CDN viewer assertion missing audience/owner/expiry binding: ${marker}`);
}
const backendMediaOrigin = readFileSync(resolve(lock.repositories.backend.checkoutPath, "cmd/api/media.go"), "utf8");
const backendMediaOriginTests = readFileSync(resolve(lock.repositories.backend.checkoutPath, "cmd/api/media_cdn_origin_test.go"), "utf8");
for (const [label, source, marker] of [
  ["Backend CDN origin", backendMediaOrigin, "func (s *service) mediaCDNOrigin"],
  ["Backend CDN origin", backendMediaOrigin, 'r.Header.Get("X-Testagram-Origin-Auth")'],
  ["Backend CDN origin", backendMediaOrigin, 'assetStatus != "ready"'],
  ["Backend CDN origin", backendMediaOrigin, 'else if visibility != "public"'],
  ["Backend CDN origin", backendMediaOrigin, "VerifyForKey"],
  ["Backend CDN origin", backendMediaOrigin, "PresignObjectHead"],
  ["Backend CDN origin", backendMediaOrigin, "PresignObjectGet"],
  ["Backend CDN origin", backendMediaOrigin, "writeCDNOriginResponse"],
  ["Backend CDN origin tests", backendMediaOriginTests, "TestCDNOriginRequestForwardsRangeValidators"],
  ["Backend CDN origin tests", backendMediaOriginTests, "TestWriteCDNOriginResponseHEADHasHeadersButNoBody"],
  ["Backend CDN origin tests", backendMediaOriginTests, "TestWriteCDNOriginResponsePublicUsesSharedCachePolicy"],
]) {
  if (!source.includes(marker)) fail.push(`${label} missing canonical public/private origin marker: ${marker}`);
}

// Verify the Backend's canonical CDN origin is paired with the Go edge's
// viewer-assertion relay, method-correct HEAD signing and private cache bypass.
const backendRouter = readFileSync(resolve(lock.repositories.backend.checkoutPath, "cmd/api/main.go"), "utf8");
const backendMedia = readFileSync(resolve(lock.repositories.backend.checkoutPath, "cmd/api/media.go"), "utf8");
const backendOriginTests = readFileSync(resolve(lock.repositories.backend.checkoutPath, "cmd/api/media_cdn_origin_test.go"), "utf8");
for (const [label, source, marker] of [
  ["Backend router", backendRouter, 'HandleFunc("GET /internal/cdn/v1/{key...}", s.mediaCDNOrigin)'],
  ["Backend router", backendRouter, 'HandleFunc("HEAD /internal/cdn/v1/{key...}", s.mediaCDNOrigin)'],
  ["Backend CDN origin", backendMedia, 'r.Header.Get("X-Testagram-Origin-Auth")'],
  ["Backend CDN origin", backendMedia, "VerifyForKey"],
  ["Backend CDN origin", backendMedia, 'else if visibility != "public"'],
  ["Backend CDN origin", backendMedia, "s.dataCentreMedia.HeadURL"],
  ["Backend CDN origin", backendMedia, "s.virtualStorage.HeadURL"],
  ["Backend CDN origin", backendMedia, "s.media.PresignObjectHead"],
  ["Backend CDN origin", backendMedia, "writeCDNOriginResponse"],
  ["Backend CDN origin tests", backendOriginTests, "TestWriteCDNOriginResponseHEADHasHeadersButNoBody"],
  ["Backend CDN origin tests", backendOriginTests, "TestCDNOriginRequestForwardsRangeValidators"],
  ["Backend CDN origin tests", backendOriginTests, "TestWriteCDNOriginResponsePublicUsesSharedCachePolicy"],
]) {
  if (!source.includes(marker)) fail.push(`${label} missing CDN origin contract marker: ${marker}`);
}

// The active Backend overlay must carry the optional private Data Centre media
// profile, with a separate database and no public host port.
const dataCentreOverlay = readFileSync(resolve(lock.repositories["data-centre"].checkoutPath, "backend/docker-compose.yml"), "utf8");
const dataCentreMediaProvisioner = readFileSync(resolve(lock.repositories["data-centre"].checkoutPath, "scripts/provision-media-database.sh"), "utf8");
for (const marker of [
  "media-migrate:",
  "media:",
  "MEDIA_DATABASE_URL",
  "MEDIA_DATABASE_NAME",
  "MEDIA_INTERNAL_TOKEN: ${FRESH_DATA_CENTRE_INTERNAL_TOKEN:-}",
  "B2_S3_BUCKET",
  "CLOUDFLARE_R2_BUCKET",
  'expose: ["8096"]',
  "networks: [platform]",
  "http://127.0.0.1:8096/readyz",
]) {
  if (!dataCentreOverlay.includes(marker)) fail.push(`Data Centre active overlay missing private media lifecycle contract: ${marker}`);
}
if (/^\\s+ports:\\s*\\n\\s+- ["']?8096:/m.test(dataCentreOverlay)) {
  fail.push("Data Centre media service must not publish port 8096 to the host");
}

if (!dataCentreOverlay.includes("../scripts/provision-media-database.sh:/scripts/provision-media-database.sh:ro") || !dataCentreOverlay.includes("entrypoint: [\"/bin/sh\", \"/scripts/provision-media-database.sh\"]")) {
  fail.push("Data Centre media profile must run its dedicated database provisioner");
}
if (!dataCentreMediaProvisioner.includes("CREATE DATABASE") || !dataCentreMediaProvisioner.includes("MEDIA_DATABASE_URL") || !dataCentreMediaProvisioner.includes("NOSUPERUSER NOCREATEDB NOCREATEROLE")) {
  fail.push("Data Centre media database provisioner must create a separate database and restricted runtime role");
}


const flutterNativeAuth = readFileSync(resolve(lock.repositories["flutter-client"].checkoutPath, "lib/core/auth/native_auth_client.dart"), "utf8");
const flutterBackendApi = readFileSync(resolve(lock.repositories["flutter-client"].checkoutPath, "lib/core/backend_api.dart"), "utf8");
const flutterSafetyTests = readFileSync(resolve(lock.repositories["flutter-client"].checkoutPath, "test/profile_safety_api_test.dart"), "utf8");
const backendRouteInventory = JSON.parse(readFileSync("contracts/route-inventory/backend-public-routes.json", "utf8"));
const normalizeClientPath = (path) => path.replace(/\$\{[^}]+\}/g, '{}').replace(/\{[^}]+\}/g, '{}').replace(/\$[A-Za-z_][A-Za-z0-9_]*/g, '{}');
const contractedBackendOperations = new Set(backendRouteInventory.routes.filter((route) => route.status === 'contracted').map((route) => route.method.toUpperCase() + ' ' + normalizeClientPath(route.path)));
const flutterBackendOperations = [...flutterBackendApi.matchAll(/_request\('(GET|POST|PUT|DELETE|HEAD)',\s*baseUri\.resolve\('([^']+)'/g)].map((match) => match[1] + ' ' + normalizeClientPath(match[2]));
const uncontractedFlutterOperations = flutterBackendOperations.filter((operation) => !contractedBackendOperations.has(operation));
if (uncontractedFlutterOperations.length) fail.push("Flutter calls Backend operations that are not public-contract approved: " + uncontractedFlutterOperations.join(", "));
if (!flutterSafetyTests.includes("blocks and unblocks through the authenticated Backend routes")) fail.push("Flutter block/unblock API tests are missing");
if (!flutterBackendApi.includes("Future<Map<String, dynamic>> blockUser(") || !flutterBackendApi.includes("Future<Map<String, dynamic>> unblockUser(")) fail.push("Flutter profile safety methods must match the approved Backend block routes");
for (const [label, source, marker] of [
  ["Flutter native auth", flutterNativeAuth, "FlutterSecureStorage"],
  ["Flutter native auth", flutterNativeAuth, "_refreshKey"],
  ["Flutter native auth", flutterNativeAuth, "_accessToken"],
  ["Flutter native auth", flutterNativeAuth, "_post('refresh'"],
  ["Flutter Backend API", flutterBackendApi, "'Authorization': 'Bearer $token'"],
  ["Flutter private media", flutterBackendApi, "Bearer v1."],
]) {
  if (!source.includes(marker)) fail.push(`${label} missing native-session/media contract marker: ${marker}`);
}

const publicSpec = readFileSync("contracts/openapi/testagram-v1.yaml", "utf8");
if (/^  \/internal\//m.test(publicSpec) || publicSpec.includes("/api/cache/purge")) {
  fail.push("Private service or operator-only route leaked into public Backend OpenAPI");
}

const backendSocialCapabilities = readFileSync(resolve(lock.repositories.backend.checkoutPath, "cmd/api/capability_social.go"), "utf8");
const backendSocialProfiles = readFileSync(resolve(lock.repositories.backend.checkoutPath, "cmd/api/social_profile.go"), "utf8");
const backendWalletMpesa = readFileSync(resolve(lock.repositories.backend.checkoutPath, "cmd/api/wallet_mpesa.go"), "utf8");
const flutterDeepLinks = readFileSync(resolve(lock.repositories["flutter-client"].checkoutPath, "lib/core/testagram_deep_link.dart"), "utf8");
const flutterMainShell = readFileSync(resolve(lock.repositories["flutter-client"].checkoutPath, "lib/app/main_shell.dart"), "utf8");
const flutterProfileScreen = readFileSync(resolve(lock.repositories["flutter-client"].checkoutPath, "lib/features/profile/profile_screen.dart"), "utf8");
const flutterWalletScreen = readFileSync(resolve(lock.repositories["flutter-client"].checkoutPath, "lib/features/wallet/wallet_screen.dart"), "utf8");
const flutterTopUpStore = readFileSync(resolve(lock.repositories["flutter-client"].checkoutPath, "lib/features/wallet/topup_attempt_store.dart"), "utf8");
const profileWalletContract = readFileSync("docs/integration/wallet-profile-contract.md", "utf8");

for (const [label, source, marker] of [
  ["Backend social capability", backendSocialCapabilities, "testagram.social.profile.resolve"],
  ["Backend profile resolver", backendSocialProfiles, "validSocialUsername"],
  ["Backend profile resolver", backendSocialProfiles, "discoverable_by_username"],
  ["Backend profile resolver", backendSocialProfiles, "NOT EXISTS("],
  ["Backend profile resolver", backendSocialProfiles, "socialProfileReadFor"],
  ["Backend profile resolver", backendSocialProfiles, "PROFILE_NOT_FOUND"],
  ["Flutter profile resolver", flutterBackendApi, "testagram.social.profile.resolve"],
  ["Flutter profile resolver", flutterBackendApi, "resolveProfileUsername"],
  ["Flutter profile safety UI", flutterProfileScreen, "_blockProfileAccount"],
  ["Flutter profile safety UI", flutterProfileScreen, "widget.api.blockUser"],
  ["Flutter deep links", flutterDeepLinks, "testagram.site"],
  ["Flutter deep links", flutterDeepLinks, "uri.hasQuery"],
  ["Flutter deep links", flutterDeepLinks, "uri.hasFragment"],
  ["Flutter deep links", flutterMainShell, "initialDeepLink"],
  ["Flutter deep links", flutterMainShell, "resolveProfileUsername"],
  ["Backend M-Pesa idempotency", backendWalletMpesa, "mpesaTopupRequestMatches"],
  ["Backend M-Pesa idempotency", backendWalletMpesa, "IDEMPOTENCY_CONFLICT"],
  ["Backend M-Pesa idempotency", backendWalletMpesa, "TOPUP_RECONCILIATION_PENDING"],
  ["Backend M-Pesa idempotency", backendWalletMpesa, "idempotency_key"],
  ["Flutter M-Pesa persistence", flutterTopUpStore, "FlutterSecureStorage"],
  ["Flutter M-Pesa persistence", flutterTopUpStore, "idempotency_key"],
  ["Flutter M-Pesa recovery", flutterBackendApi, "getMpesaTopUpAttemptStatus"],
  ["Flutter M-Pesa recovery", flutterWalletScreen, "_topUpAttemptStore.save(attempt)"],
  ["Flutter M-Pesa recovery", flutterWalletScreen, "getMpesaTopUpAttemptStatus"],
  ["Profile/wallet product contract", profileWalletContract, "## Deep-link contract"],
  ["Profile/wallet product contract", profileWalletContract, "## Wallet retry and settlement safety"],
]) {
  if (!source.includes(marker)) fail.push(`${label} missing cross-repository acceptance marker: ${marker}`);
}
const persistedAttemptAt = flutterWalletScreen.indexOf("_topUpAttemptStore.save(attempt)");
const firstTopUpRequestAt = flutterWalletScreen.indexOf("requestMpesaTopUp(");
if (persistedAttemptAt < 0 || firstTopUpRequestAt < 0 || persistedAttemptAt > firstTopUpRequestAt) {
  fail.push("Flutter must persist the M-Pesa idempotency key before dispatching the first top-up request");
}
if (flutterDeepLinks.includes("transfer") || flutterDeepLinks.includes("topup")) {
  fail.push("Wallet deep-link parser must not accept payment or transfer destinations");
}

if (fail.length) {
  console.error(fail.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Cross-repository contract audit passed: six immutable source pins, snapshots, all six runtime edges, native user-token propagation, private credentials and public/private boundaries verified.");
