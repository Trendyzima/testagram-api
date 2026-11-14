import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const inventory = JSON.parse(read("contracts/route-inventory/backend-public-routes.json"));
const backendClient = read("source-repos/flutter-client/lib/core/backend_api.dart");
const identityClient = read("source-repos/flutter-client/lib/features/auth/identity_verification_client.dart");
const publicSpec = read("contracts/openapi/testagram-v1.yaml");
const fail = [];
const warnings = [];
const normalize = (path) => path
  .replace(/\$\{[^}]+\}/g, "{}")
  .replace(/\$[A-Za-z_][A-Za-z0-9_]*/g, "{}")
  .replace(/\{[^}]+\}/g, "{}");

const routes = new Set();
for (const source of [backendClient, identityClient]) {
  for (const match of source.matchAll(/(?:baseUri|_backendOrigin)\.resolve\(['"`]([^'"`]+)['"`]\)/g)) {
    routes.add(normalize(match[1]));
  }
  for (const match of source.matchAll(/_endpoint\(['"`]([^'"`]+)['"`]\)/g)) {
    routes.add(normalize(match[1]));
  }
}
const inventoryByPath = new Map(inventory.routes.map((route) => [normalize(route.path), route]));
const inventoryByOperation = new Map(inventory.routes.map((route) => [
  route.method.toUpperCase() + " " + normalize(route.path),
  route,
]));
// Verify the HTTP method as well as the path for direct BackendApi calls.
// A GET-only contract must never silently authorize a POST/DELETE client call.
const clientOperations = new Set();
for (const match of backendClient.matchAll(/(?:_request|http\\.Request)\\s*\\(\\s*['"]([A-Z]+)['"]\\s*,\\s*baseUri\\.resolve\\(\\s*['"`]([^'"`]+)['"`]/gs)) {
  const method = match[1].toUpperCase();
  const path = normalize(match[2]);
  clientOperations.add(method + " " + path);
}
for (const operation of clientOperations) {
  const entry = inventoryByOperation.get(operation);
  if (!entry) {
    fail.push("Flutter calls a Backend method/path missing from the audited route inventory: " + operation);
  } else if (entry.status !== "contracted") {
    warnings.push(operation + " (" + entry.status + ")");
  }
}
for (const path of [...routes].sort()) {
  const entry = inventoryByPath.get(path);
  if (!entry) {
    fail.push("Flutter calls a Backend route missing from the audited route inventory: " + path);
  } else if (entry.status !== "contracted") {
    warnings.push(path + " (" + entry.status + ")");
  }
}
if (!backendClient.includes("'Authorization': 'Bearer $jwt'") &&
    !backendClient.includes('"Authorization": "Bearer $jwt"')) {
  fail.push("Flutter BackendApi must attach the Appwrite session JWT as a Bearer token");
}
if (!identityClient.includes("X-Verification-Session-Token") ||
    !identityClient.includes("X-Application-Token")) {
  fail.push("Flutter identity client must use scoped applicant/session tokens for pre-auth identity operations");
}
if (/\/internal\//.test(backendClient + identityClient)) {
  fail.push("Flutter public API clients must not call private internal service routes");
}
const forbidden = [
  /https?:\/\/algorithm(?::|\/)/i,
  /https?:\/\/federation(?::|\/)/i,
  /https?:\/\/media(?::|\/)/i,
  /https?:\/\/platform(?::|\/)/i,
  /postgres(?:ql)?:\/\//i,
  /minio\.testagram/i,
  /\.r2\.dev\//i,
  /\.backblazeb2\.com\//i,
  /supabase\.co/i,
];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (path.endsWith(".dart")) {
      const source = readFileSync(path, "utf8");
      for (const pattern of forbidden) if (pattern.test(source)) fail.push("Flutter contains a direct private/provider dependency in " + path + ": " + pattern);
    }
  }
}
walk(resolve(root, "source-repos/flutter-client/lib"));
if (/^  \/internal\//m.test(publicSpec)) fail.push("Private internal endpoints must not be exposed in the public OpenAPI contract");
if (warnings.length) {
  fail.push("Flutter calls Backend operations that are not fully promoted into the public OpenAPI contract:\n" + warnings.map((item) => "- " + item).join("\n"));
}
if (fail.length) {
  console.error(fail.map((item) => "- " + item).join("\n"));
  process.exit(1);
}
console.log("Flutter-to-Backend boundary audit passed: " + routes.size + " client paths and " + clientOperations.size + " method/path operations are inventoried and contracted; JWT/token boundaries are present, and no direct private-service/provider calls were found.");
