import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const lock = JSON.parse(readFileSync("contracts/sources.lock.json", "utf8"));
const registry = JSON.parse(readFileSync("contracts/registry/services.json", "utf8"));
const required = ["backend", "data-centre", "cdn", "flutter-client", "federation", "algorithm"];
const fail = [];
const keys = Object.keys(lock.repositories).sort();
if (JSON.stringify(keys) !== JSON.stringify([...required].sort())) {
  fail.push(`Expected exactly six pinned repositories; found: ${keys.join(", ")}`);
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
  if (!backendMediaClient.includes(route.path)) fail.push(`Backend Data Centre client missing route: ${route.path}`);
  if (!dataCentreMediaServer.includes(route.provider)) fail.push(`Data Centre media server missing handler: ${route.path}`);
  if (!dataCentreMediaOpenAPI.includes(route.path)) fail.push(`Data Centre media OpenAPI missing route: ${route.path}`);
  if (!dataCentreMediaOpenAPI.includes(`  ${route.path}:\n    ${route.method.toLowerCase()}:`)) fail.push(`Data Centre media OpenAPI method mismatch: ${route.method} ${route.path}`);
  if (!backendMediaTests.includes(route.path)) fail.push(`Backend Data Centre client tests missing route coverage: ${route.path}`);
}
if (!backendMediaClient.includes('"X-Testagram-API-Version"')) fail.push("Backend Data Centre client must send X-Testagram-API-Version");
if (!dataCentreMediaServer.includes('r.Header.Get("X-Testagram-API-Version")')) fail.push("Data Centre media server must enforce X-Testagram-API-Version");

 // Deployment wiring is part of the Backend <-> Data Centre contract. Keep
 // the media API private on the Backend-owned platform network and share only
 // the dedicated service token; provider credentials must remain Data Centre-only.
 const backendCompose = readFileSync(resolve(lock.repositories.backend.checkoutPath, "deploy/self-hosted/docker-compose.yml"), "utf8");
 const backendEnvExample = readFileSync(resolve(lock.repositories.backend.checkoutPath, "deploy/self-hosted/.env.example"), "utf8");
 const dataCentreCompose = readFileSync(resolve(lock.repositories["data-centre"].checkoutPath, "vps/docker-compose.fresh.yml"), "utf8");
 const dataCentreEnvExample = readFileSync(resolve(lock.repositories["data-centre"].checkoutPath, "vps/.env.example"), "utf8");
 for (const variable of ["FRESH_MEDIA_ENABLED", "DATA_CENTRE_MEDIA_API_URL", "FRESH_DATA_CENTRE_INTERNAL_TOKEN"]) {
   if (!backendCompose.includes(variable)) fail.push(`Backend Compose missing Data Centre media variable: ${variable}`);
   if (!backendEnvExample.includes(variable)) fail.push(`Backend env example missing Data Centre media variable: ${variable}`);
 }
 if (!backendEnvExample.includes("DATA_CENTRE_MEDIA_API_URL=http://media:8096")) fail.push("Backend env example must use the private media service DNS endpoint");
 if (!dataCentreCompose.includes("MEDIA_INTERNAL_TOKEN: ${FRESH_DATA_CENTRE_INTERNAL_TOKEN:-}")) fail.push("Data Centre media service token must use FRESH_DATA_CENTRE_INTERNAL_TOKEN");
 if (!dataCentreEnvExample.includes("FRESH_DATA_CENTRE_INTERNAL_TOKEN=")) fail.push("Data Centre env example must document the shared internal token");
 if (!dataCentreCompose.includes("name: testagram-platform") || !dataCentreCompose.includes("external: true")) fail.push("Data Centre media service must join the externally-created Backend platform network");
 if (!dataCentreCompose.includes("networks: [services, platform]")) fail.push("Data Centre media service must join both its private services and Backend platform networks");
 if (!dataCentreCompose.includes('expose: ["8096"]')) fail.push("Data Centre media API must expose only the private container port, not publish it publicly");
 if (/B2_S3_(ACCESS_KEY_ID|SECRET_ACCESS_KEY)|R2_(ACCESS_KEY_ID|SECRET_ACCESS_KEY)/.test(backendCompose)) fail.push("B2/R2 provider credentials must not be configured in Backend Compose");

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
if (!algorithmClient.includes("len(input.Candidates) > 200") || !algorithmClient.includes("input.Limit > 50")) {
  fail.push("Backend Algorithm client must enforce the 200-candidate / 50-result bounds");
}

const backendFederationClient = readFileSync(resolve(lock.repositories.backend.checkoutPath, "internal/federationclient/client.go"), "utf8");
const federationServer = readFileSync(resolve(lock.repositories.federation.checkoutPath, "internal/httpapi/server.go"), "utf8");
const federationIngress = readFileSync(resolve(lock.repositories.federation.checkoutPath, "internal/httpapi/internal_activities.go"), "utf8");
const federationTests = readFileSync(resolve(lock.repositories.federation.checkoutPath, "internal/httpapi/internal_activities_test.go"), "utf8");
for (const [label, source, marker] of [
  ["Backend Federation client", backendFederationClient, "/internal/v1/activities"],
  ["Backend Federation client", backendFederationClient, 'req.Header.Set("Idempotency-Key", input.ActivityID)'],
  ["Federation server", federationServer, 'HandleFunc("POST /internal/v1/activities"'],
  ["Federation ingress", federationIngress, "validInternalBearer(r, ingressToken)"],
  ["Federation ingress", federationIngress, "EnqueueOutbox"],
  ["Federation ingress", federationIngress, "http.StatusAccepted"],
]) {
  if (!source.includes(marker)) fail.push(`${label} missing agreed durable-ingress contract marker: ${marker}`);
}
if (!federationTests.includes("TestInternalActivityEndpointRejectsMissingServiceCredential") || !federationTests.includes("TestInternalActivityEndpointUsesDedicatedIngressCredential")) {
  fail.push("Federation ingress tests must prove missing and wrong-direction service credentials are rejected");
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

const publicSpec = readFileSync("contracts/openapi/testagram-v1.yaml", "utf8");
if (/^  \/internal\//m.test(publicSpec) || publicSpec.includes("/api/cache/purge")) {
  fail.push("Private service or operator-only route leaked into public Backend OpenAPI");
}
if (fail.length) {
  console.error(fail.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Cross-repository contract audit passed: six immutable source pins, source paths, snapshots and public/private boundary verified.");
