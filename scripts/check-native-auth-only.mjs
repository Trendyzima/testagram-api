import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const sourceLock = JSON.parse(readFileSync("contracts/sources.lock.json", "utf8"));
const missingCheckouts = Object.entries(sourceLock.repositories)
  .filter(([, repository]) => !existsSync(resolve(repository.checkoutPath, ".git")))
  .map(([name, repository]) => `${name} (${repository.checkoutPath})`);
assert.equal(
  missingCheckouts.length,
  0,
  `Native-auth audit requires all immutable source checkouts. Run npm run sources:checkout first. Missing: ${missingCheckouts.join(", ")}`,
);

const sdkPaths = [
  "packages/typescript/src/index.ts",
  "packages/typescript/test/client.test.mjs",
  "packages/typescript/README.md",
  "packages/dart/lib/testagram_api.dart",
  "packages/dart/test/testagram_api_test.dart",
  "packages/dart/example_client.dart",
  "packages/dart/README.md",
  "examples/http/home-feed.http",
  "contracts/openapi/testagram-v1.yaml",
];
for (const path of sdkPaths) {
  const content = readFileSync(path, "utf8");
  assert.doesNotMatch(content, /appwrite/i, `${path}: external identity-provider reference is forbidden in the public SDK and API contract`);
}
const sdk = readFileSync(sdkPaths[0], "utf8");
assert.match(sdk, /Testagram-native Backend access token/);
assert.match(sdk, /Authorization/);
assert.match(sdk, /Testagram-native access token is required/);
const contract = readFileSync(sdkPaths[2], "utf8");
assert.match(contract, /testagramBearer/);
assert.match(contract, /loginWithTestagramCredentials/);
assert.match(contract, /refresh/);

// Inspect actual checked-out provider source, not just API prose. Historical
// SQL migration records are intentionally excluded: they remain immutable
// migration history and are separately neutralized by the retirement migration.
const roots = [
  "source-repos/flutter-client/lib",
  "source-repos/flutter-client/android",
  "source-repos/flutter-client/ios",
  "source-repos/flutter-client/web",
  "source-repos/backend/cmd/api",
  "source-repos/backend/cmd/fresh-api",
  "source-repos/backend/admin-console",
  "source-repos/backend/internal",
  "source-repos/backend/deploy/self-hosted",
  "source-repos/data-centre/backend",
  "source-repos/data-centre/vps",
  "source-repos/cdn/cmd",
  "source-repos/cdn/internal",
  "source-repos/cdn/cloudflare",
  "source-repos/algorithm/testagram-feed",
  "source-repos/federation/cmd",
  "source-repos/federation/internal",
];
const explicitFiles = [
  "source-repos/backend/go.mod",
  "source-repos/data-centre/backend/go.mod",
  "source-repos/cdn/go.mod",
  "source-repos/algorithm/testagram-feed/go.mod",
  "source-repos/federation/go.mod",
  "source-repos/flutter-client/pubspec.yaml",
  "source-repos/backend/docker-compose.yml",
  "source-repos/backend/.env.example",
  "source-repos/backend/Dockerfile",
  "source-repos/data-centre/backend/docker-compose.yml",
  "source-repos/data-centre/vps/docker-compose.yml",
  "source-repos/data-centre/vps/.env.example",
  "source-repos/data-centre/vps/fresh.env.example",
];
const extensions = new Set([
  ".go", ".dart", ".yaml", ".yml", ".json", ".toml", ".properties",
  ".gradle", ".kt", ".swift", ".plist", ".xml", ".env", ".sh", ".ts", ".js",
]);
const scanned = [];
function walk(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) walk(join(path, entry));
    return;
  }
  if (!extensions.has(path.slice(path.lastIndexOf(".")))) return;
  // Unit/integration fixtures may name retired providers to prove that legacy
  // paths are rejected. They are not shipped runtime source or configuration.
  if (path.endsWith("_test.go") || path.endsWith(".test.mjs") || path.endsWith(".test.ts")) return;
  scanned.push(path);
}
for (const root of roots) if (existsSync(resolve(root))) walk(resolve(root));
for (const path of explicitFiles) if (existsSync(resolve(path))) scanned.push(resolve(path));
assert.ok(scanned.length > 0, "Native-auth audit scanned zero provider files; refusing a vacuous pass.");
const providerViolations = [];
for (const path of new Set(scanned)) {
  const source = readFileSync(path, "utf8");
  if (/appwrite/i.test(source)) providerViolations.push(path);
}
assert.equal(
  providerViolations.length,
  0,
  `Appwrite runtime, SDK, endpoint, token or fallback remains in provider source/config files:\n${providerViolations.map((path) => `- ${path}`).join("\n")}`,
);
console.log(`Native-only authentication boundary: PASS (SDK/OpenAPI plus ${new Set(scanned).size} provider source/config files contain no Appwrite integration)`);
