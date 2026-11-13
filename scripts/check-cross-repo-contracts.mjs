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
  if (!dataCentreMediaOpenAPI.includes(`    ${route.path}:\n      ${route.method.toLowerCase()}:`)) fail.push(`Data Centre media OpenAPI method mismatch: ${route.method} ${route.path}`);
  if (!backendMediaTests.includes(route.path)) fail.push(`Backend Data Centre client tests missing route coverage: ${route.path}`);
}
if (!backendMediaClient.includes('"X-Testagram-API-Version"')) fail.push("Backend Data Centre client must send X-Testagram-API-Version");
if (!dataCentreMediaServer.includes('r.Header.Get("X-Testagram-API-Version")')) fail.push("Data Centre media server must enforce X-Testagram-API-Version");

const publicSpec = readFileSync("contracts/openapi/testagram-v1.yaml", "utf8");
if (/^  \/internal\//m.test(publicSpec) || publicSpec.includes("/api/cache/purge")) {
  fail.push("Private service or operator-only route leaked into public Backend OpenAPI");
}
if (fail.length) {
  console.error(fail.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Cross-repository contract audit passed: six immutable source pins, source paths, snapshots and public/private boundary verified.");
