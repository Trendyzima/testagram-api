import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const inventoryPath = resolve("contracts/route-inventory/backend-public-routes.json");
const specPath = resolve("contracts/openapi/testagram-v1.yaml");
const backendPath = resolve("source-repos/backend/cmd/api/main.go");
const postHandlerPath = resolve("source-repos/backend/cmd/api/social_post_create.go");
const postTestsPath = resolve("source-repos/backend/cmd/api/social_post_create_test.go");

const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const source = readFileSync(backendPath, "utf8");
const postHandler = readFileSync(postHandlerPath, "utf8");
const postTests = readFileSync(postTestsPath, "utf8");
const spec = readFileSync(specPath, "utf8");

const normalize = (value) => value.replace(/\{[^}]+\}/g, "{}");
const key = (method, path) => `${method.toUpperCase()} ${normalize(path)}`;

const registered = new Set();
for (const match of source.matchAll(/mux\.HandleFunc\("([A-Z]+) ([^"]+)"\s*,/g)) {
  const [, method, path] = match;
  if (method === "OPTIONS") continue;
  if (path.startsWith("/internal/")) continue;
  if (path.startsWith("/api/") || path.startsWith("/v1/") || path === "/healthz" || path === "/readyz" || path === "/metrics") {
    registered.add(key(method, path));
  }
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
if (!source.includes('for _, action := range []string{"signup", "resend-verification", "verify-email", "login", "forgot-password", "reset-password"}')) {
  throw new Error("Backend auth route loop changed; update route inventory audit.");
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
console.log(`Backend route audit passed: ${registered.size} static routes inventoried; ${inventory.routes.filter((item) => item.status === "contracted").length} contracted operations covered by OpenAPI; post idempotency behavior backed by handler and tests.`);


// The Render/standalone runtime is cmd/fresh-api, whose routes are registered
// in internal/freshapi/server.go. Keep this audit separate from the legacy
// cmd/api inventory: identical paths do not imply identical wire contracts.
const freshInventoryPath = resolve("contracts/route-inventory/fresh-api-public-routes.json");
const freshServerPath = resolve("source-repos/backend/internal/freshapi/server.go");
const freshMainPath = resolve("source-repos/backend/cmd/fresh-api/main.go");
const freshDockerfilePath = resolve("source-repos/backend/Dockerfile.fresh");
const freshRenderPath = resolve("source-repos/backend/render.yaml");
const freshInventory = JSON.parse(readFileSync(freshInventoryPath, "utf8"));
const freshServer = readFileSync(freshServerPath, "utf8");
const freshMain = readFileSync(freshMainPath, "utf8");
const freshDockerfile = readFileSync(freshDockerfilePath, "utf8");
const freshRender = readFileSync(freshRenderPath, "utf8");
const freshRegistered = new Set();
for (const match of freshServer.matchAll(/mux\.HandleFunc\\("([A-Z]+) ([^"]+)"\\s*,/g)) {
  freshRegistered.add(key(match[1], match[2]));
}
const freshExpected = new Set(freshInventory.routes.map(({ method, path }) => key(method, path)));
const freshMissing = [...freshRegistered].filter((route) => !freshExpected.has(route)).sort();
const freshStale = [...freshExpected].filter((route) => !freshRegistered.has(route)).sort();
if (freshMissing.length || freshStale.length) {
  console.error(JSON.stringify({ freshMissing, freshStale }, null, 2));
  process.exit(1);
}
const validContractStatuses = new Set(["uncontracted", "compatibility-review", "contracted"]);
for (const route of freshInventory.routes) {
  if (!validContractStatuses.has(route.contractStatus)) throw new Error(`Unknown Fresh API contract status: ${route.contractStatus}`);
  if (route.exposure === "internal" && !route.path.startsWith("/internal/")) {
    throw new Error(`Fresh API internal route has a public path: ${route.method} ${route.path}`);
  }
  if (route.path.startsWith("/internal/") && route.exposure !== "internal") {
    throw new Error(`Fresh API private route is incorrectly marked public: ${route.method} ${route.path}`);
  }
  if (route.registrationCondition !== "always" && !["identity_secret_and_appwrite_server_key_configured", "internal_token_configured", "storage_service_configured"].includes(route.registrationCondition)) {
    throw new Error(`Unknown Fresh API registration condition: ${route.registrationCondition}`);
  }
}
for (const marker of ["IDENTITY_PREAUTH_SECRET", "APPWRITE_SERVER_API_KEY", "FRESH_FEDERATION_INTERNAL_TOKEN", "FRESH_MEDIA_ENABLED"]) {
  if (!freshMain.includes(marker)) throw new Error(`Fresh API runtime configuration marker missing: ${marker}`);
}
for (const marker of ["/healthz", "HEALTHCHECK", "healthcheck"]) {
  if (!freshDockerfile.includes(marker)) throw new Error(`Fresh API Docker healthcheck marker missing: ${marker}`);
}
if (!freshRender.includes("healthCheckPath: /healthz")) throw new Error("Render Blueprint must use the Fresh API /healthz endpoint.");
const freshUncontracted = freshInventory.routes.filter((route) => route.contractStatus !== "contracted").length;
console.log(`Fresh API runtime audit passed: ${freshRegistered.size} routes match the pinned runtime inventory; ${freshUncontracted} remain explicitly blocked from public contract adoption pending wire-level review.`);
