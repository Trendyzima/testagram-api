import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const sdkPaths = [
  "packages/typescript/src/index.ts",
  "packages/typescript/test/client.test.mjs",
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
  scanned.push(path);
}
for (const root of roots) if (existsSync(resolve(root))) walk(resolve(root));
for (const path of explicitFiles) if (existsSync(resolve(path))) scanned.push(resolve(path));
for (const path of new Set(scanned)) {
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(source, /appwrite/i, `${path}: Appwrite runtime, SDK, endpoint, token or fallback is forbidden`);
}
console.log(`Native-only authentication boundary: PASS (SDK/OpenAPI plus ${new Set(scanned).size} provider source/config files contain no Appwrite integration)`);
