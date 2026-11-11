import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const inventoryPath = resolve("contracts/route-inventory/backend-public-routes.json");
const specPath = resolve("contracts/openapi/testagram-v1.yaml");
const backendPath = resolve("source-repos/backend/cmd/api/main.go");

const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const source = readFileSync(backendPath, "utf8");
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

if (missingFromInventory.length || staleInventory.length || missingFromOpenApi.length) {
  console.error(JSON.stringify({ missingFromInventory, staleInventory, missingFromOpenApi }, null, 2));
  process.exit(1);
}
console.log(`Backend route audit passed: ${registered.size} static routes inventoried; ${inventory.routes.filter((item) => item.status === "contracted").length} contracted operations covered by OpenAPI.`);
