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
if (fail.length) {
  console.error(fail.map((item) => "- " + item).join("\n"));
  process.exit(1);
}
console.log("Flutter-to-Backend boundary audit passed: " + routes.size + " client paths are inventoried, JWT/token boundaries are present, and no direct private-service/provider calls were found.");
if (warnings.length) {
  console.warn("Client-used routes still marked registered-only and requiring DTO/auth/error contract promotion (" + warnings.length + "):\n" + warnings.map((item) => "- " + item).join("\n"));
}
