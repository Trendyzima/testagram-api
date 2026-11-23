import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const inventoryPath = resolve("contracts/route-inventory/backend-public-routes.json");
const specPath = resolve("contracts/openapi/testagram-v1.yaml");
const backendDir = resolve("source-repos/backend/cmd/api");
const backendFiles = [];
function collectGoFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) collectGoFiles(path);
    else if (entry.isFile() && entry.name.endsWith(".go") && !entry.name.endsWith("_test.go")) backendFiles.push(path);
  }
}
collectGoFiles(backendDir);
const source = backendFiles.map((path) => readFileSync(path, "utf8")).join("\n");
if (/appwrite/i.test(source)) {
  throw new Error("The canonical cmd/api runtime must contain no Appwrite integration, endpoint, token, SDK, or fallback.");
}
const postHandlerPath = resolve("source-repos/backend/cmd/api/social_post_create.go");
const postTestsPath = resolve("source-repos/backend/cmd/api/social_post_create_test.go");

const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const sourceLock = JSON.parse(readFileSync(resolve("contracts/sources.lock.json"), "utf8"));
if (inventory.sourceRef !== sourceLock.repositories.backend.ref) {
  throw new Error("Backend public route inventory sourceRef does not match contracts/sources.lock.json.");
}
const postHandler = readFileSync(postHandlerPath, "utf8");
const postTests = readFileSync(postTestsPath, "utf8");
const spec = readFileSync(specPath, "utf8");

// Enforce the public/private listener boundary. Readiness and metrics must
// exist only on the Docker-private listener and never enter public OpenAPI.
const apiMain = readFileSync(resolve("source-repos/backend/cmd/api/main.go"), "utf8");
const publicRoutesStart = apiMain.indexOf("func (s *service) routes() http.Handler {");
const internalRoutesStart = apiMain.indexOf("func (s *service) internalRoutes() http.Handler {");
if (publicRoutesStart < 0 || internalRoutesStart <= publicRoutesStart) {
  throw new Error("Backend public/private listener functions are missing or reordered.");
}
const publicRoutesSource = apiMain.slice(publicRoutesStart, internalRoutesStart);
const nextFunction = apiMain.indexOf("\nfunc ", internalRoutesStart + 1);
const internalRoutesSource = apiMain.slice(internalRoutesStart, nextFunction < 0 ? apiMain.length : nextFunction);
for (const route of ["GET /readyz", "GET /metrics"]) {
  const registration = 'mux.HandleFunc("' + route + '",';
  if (publicRoutesSource.includes(registration)) {
    throw new Error("Private endpoint registered on public listener: " + route);
  }
  if (!internalRoutesSource.includes(registration)) {
    throw new Error("Private endpoint missing from internal listener: " + route);
  }
}
const normalize = (value) => value.replace(/\{[^}]+\}/g, "{}");
const key = (method, path) => `${method.toUpperCase()} ${normalize(path)}`;

// Classify routes by the listener function that registers them, not by URL
// prefix: some authenticated /internal/* service routes intentionally use the
// public listener, while Federation /internal/v1/* routes use the private one.
const registered = new Set();
const publicInternalRoutes = new Set();
for (const match of publicRoutesSource.matchAll(/mux\.HandleFunc\("([A-Z]+) ([^"]+)"\s*,/g)) {
  const [, method, path] = match;
  if (method === "OPTIONS") continue;
  if (path === "/readyz" || path === "/metrics") {
    throw new Error("Private readiness/metrics endpoint registered on public listener: " + method + " " + path);
  }
  if (path.startsWith("/internal/")) publicInternalRoutes.add(key(method, path));
  // Inventory every static route registered on the public listener, regardless
  // of path family, so a newly introduced prefix cannot silently escape audit.
  registered.add(key(method, path));
}
const expectedPublicInternalRoutes = new Set([
  "POST /internal/media/quarantine",
  "POST /internal/media/fresh/register",
  "POST /internal/media/fresh/revoke",
  "POST /internal/media/fresh/cdn-download-url",
  "GET /internal/tv/catalog",
  "GET /internal/edge/recovery-ready",
  "POST /internal/tv/health",
  "GET /internal/cdn/v1/{}",
  "HEAD /internal/cdn/v1/{}",
]);
const unexpectedPublicInternalRoutes = [...publicInternalRoutes].filter((route) => !expectedPublicInternalRoutes.has(route)).sort();
const missingPublicInternalRoutes = [...expectedPublicInternalRoutes].filter((route) => !publicInternalRoutes.has(route)).sort();
if (unexpectedPublicInternalRoutes.length || missingPublicInternalRoutes.length) {
  throw new Error("Public-listener authenticated internal routes drifted: " + JSON.stringify({
    unexpectedPublicInternalRoutes, missingPublicInternalRoutes
  }));
}
const privateInternalRoutes = new Set(
  [...internalRoutesSource.matchAll(/mux\.HandleFunc\("([A-Z]+) ([^"]+)"\s*,/g)]
    .map((match) => key(match[1], match[2]))
    .filter((route) => route.includes(" /internal/v1/federation/"))
);
const expectedPrivateInternalRoutes = new Set([
  "GET /internal/v1/federation/readyz",
  "GET /internal/v1/federation/actors/{}",
  "GET /internal/v1/federation/actors/by-id/{}",
  "GET /internal/v1/federation/objects/{}",
  "POST /internal/v1/federation/remote-follows",
  "POST /internal/v1/federation/remote-follows/undo",
  "POST /internal/v1/federation/subscriptions/verify",
]);
const missingPrivateInternalRoutes = [...expectedPrivateInternalRoutes].filter((route) => !privateInternalRoutes.has(route)).sort();
const unexpectedPrivateInternalRoutes = [...privateInternalRoutes].filter((route) => !expectedPrivateInternalRoutes.has(route)).sort();
if (missingPrivateInternalRoutes.length || unexpectedPrivateInternalRoutes.length) {
  throw new Error("Private Federation route inventory drifted: " + JSON.stringify({
    missingPrivateInternalRoutes, unexpectedPrivateInternalRoutes
  }));
}
const expected = new Set(inventory.routes.map(({ method, path }) => key(method, path)));
const missingFromInventory = [...registered].filter((route) => !expected.has(route)).sort();
const staleInventory = [...expected].filter((route) => !registered.has(route)).sort();

const pathBlocks = new Map();
const pathMatches = [...spec.matchAll(/^  (\/[^:\n]+):\s*$/gm)];
for (let i = 0; i < pathMatches.length; i++) {
  const start = pathMatches[i].index;
  const end = i + 1 < pathMatches.length ? pathMatches[i + 1].index : spec.length;
  pathBlocks.set(normalize(pathMatches[i][1]), spec.slice(start, end));
}
if (pathBlocks.has("/readyz") || pathBlocks.has("/metrics")) {
  throw new Error("Private readiness/metrics endpoints must not appear in public OpenAPI.");
}
if (!pathBlocks.has("/healthz")) throw new Error("Public /healthz liveness route is missing from OpenAPI.");
const missingFromOpenApi = [];
for (const route of inventory.routes.filter((item) => item.status === "contracted")) {
  const block = pathBlocks.get(normalize(route.path));
  if (!block || !new RegExp(`^    ${route.method.toLowerCase()}:\\s*$`, "m").test(block)) {
    missingFromOpenApi.push(key(route.method, route.path));
  }
}

const dynamicActions = inventory.dynamicAuthActions;
for (const action of dynamicActions) {
  if (!source.includes(`"${action}"`)) {
    throw new Error(`Dynamic auth action missing from Backend registration: ${action}`);
  }
}
const authRouteLoop = source.match(/for _, action := range \[\]string\{([^}]+)\}\s*\{\s*action := action\s*mux\.HandleFunc\("OPTIONS \/api\/auth\/"\+action/);
if (!authRouteLoop) {
  throw new Error("Backend native auth route loop is missing.");
}
const registeredAuthActions = [...authRouteLoop[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort();
const expectedAuthActions = [...dynamicActions].sort();
if (JSON.stringify(registeredAuthActions) !== JSON.stringify(expectedAuthActions)) {
  throw new Error("Backend dynamic auth actions do not match the API route inventory.");
}

const postEvidence = [
  'r.Header.Get("Idempotency-Key")',
  "validSocialPostIdempotencyKey",
  "http.MaxBytesReader(w, r.Body, 16<<10)",
  'case "public", "followers", "private":',
  "http.StatusConflict",
  "http.StatusUnprocessableEntity",
  "http.StatusCreated",
  "http.StatusOK",
];
for (const marker of postEvidence) {
  if (!postHandler.includes(marker)) throw new Error(`Main-feed post handler contract changed: ${marker}`);
}
if (!postTests.includes("TestValidSocialPostIdempotencyKey") ||
    !postTests.includes("TestSocialPostRequestHashNormalizesValidatedInput")) {
  throw new Error("Main-feed post idempotency tests changed; review the contract before updating this audit.");
}

if (missingFromInventory.length || staleInventory.length || missingFromOpenApi.length) {
  console.error(JSON.stringify({ missingFromInventory, staleInventory, missingFromOpenApi }, null, 2));
  process.exit(1);
}
console.log(`Backend route audit passed: ${registered.size} static routes inventoried across ${backendFiles.length} production Go files; ${inventory.routes.filter((item) => item.status === "contracted").length} contracted operations covered by OpenAPI; post idempotency behavior backed by handler and tests.`);
