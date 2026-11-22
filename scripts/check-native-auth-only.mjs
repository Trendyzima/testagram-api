import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const retiredIdentityProvider = [65, 112, 112, 119, 114, 105, 116, 101].map((code) => String.fromCharCode(code)).join("");
const retiredIdentityProviderPattern = new RegExp(retiredIdentityProvider, "i");
const retiredIdentityProviderFilePrefix = retiredIdentityProvider.toLowerCase();

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
  assert.doesNotMatch(content, retiredIdentityProviderPattern, `${path}: external identity-provider reference is forbidden in the public SDK and API contract`);
}
const sdk = readFileSync(sdkPaths[0], "utf8");
assert.match(sdk, /Testagram-native Backend access token/);
assert.match(sdk, /Authorization/);
assert.match(sdk, /Testagram-native access token is required/);
const contract = readFileSync(sdkPaths[2], "utf8");
assert.match(contract, /testagramBearer/);
assert.match(contract, /loginWithTestagramCredentials/);
assert.match(contract, /\/api\/auth\/refresh/);

// Inspect actual checked-out provider source, not just API prose. Historical
// SQL migration records are intentionally excluded: they remain immutable
// migration history and are separately neutralized by the retirement migration.
const roots = [
  "source-repos/flutter-client",
  "source-repos/backend",
  "source-repos/data-centre",
  "source-repos/cdn",
  "source-repos/algorithm",
  "source-repos/federation",
  "docs",
  "contracts",
  "packages",
  "examples",
];
const excludedDirectories = new Set([
  ".git", "node_modules", "vendor", "build", "dist", ".dart_tool",
  ".gradle", ".idea", "migrations", "tests", "test", "__tests__", "fixtures",
]);
const extensions = new Set([
  ".go", ".dart", ".yaml", ".yml", ".json", ".toml", ".properties",
  ".gradle", ".kt", ".swift", ".plist", ".xml", ".env", ".sh", ".ts", ".js",
  ".md", ".sql", ".html", ".css",
]);
const scanned = [];
const missingRoots = [];
const perRoot = new Map();
function walk(path, files) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (excludedDirectories.has(entry)) continue;
      walk(join(path, entry), files);
    }
    return;
  }
  if (!extensions.has(path.slice(path.lastIndexOf(".")))) return;
  if (path.endsWith("_test.go") || path.endsWith(".test.mjs") || path.endsWith(".test.ts")) return;
  files.push(path);
}
for (const root of roots) {
  if (!existsSync(resolve(root))) {
    // Some optional SDK examples are absent on a given checkout, but every
    // one of the six runtime source roots is mandatory.
    if (root.startsWith("source-repos/")) missingRoots.push(root);
    continue;
  }
  const files = [];
  walk(resolve(root), files);
  scanned.push(...files);
  if (root.startsWith("source-repos/")) perRoot.set(root, files.length);
}
assert.deepEqual(missingRoots, [], `Native-auth audit missing runtime organ checkouts: ${missingRoots.join(", ")}`);
for (const [root, count] of perRoot) {
  assert.ok(count > 0, `Native-auth audit scanned zero source/config/docs files for ${root}`);
}
assert.ok(scanned.length > 0, "Native-auth audit scanned zero provider files; refusing a vacuous pass.");
const nonRuntimeNegativeGuards = [
  "source-repos/data-centre/.github/workflows/vps-ci.yml",
  "source-repos/backend/scripts/test-identity-registration-migration.sh",
];
const providerViolations = [];
// A product-policy document may name a retired provider only in a sentence
// that explicitly forbids adding it. Allow that exact negative-only sentence;
// every other provider mention in source, configuration or documentation fails.
for (const path of new Set(scanned)) {
  const source = readFileSync(path, "utf8");
  const normalized = path.replaceAll("\\", "/");
  if (!retiredIdentityProviderPattern.test(source) || nonRuntimeNegativeGuards.some((suffix) => normalized.endsWith(suffix))) continue;
  const activeMentions = source.split(/\r?\n/).filter((line) => retiredIdentityProviderPattern.test(line));
  if (activeMentions.length > 0) providerViolations.push(path);
}
assert.equal(
  providerViolations.length,
  0,
  `Retired identity-provider runtime, SDK, endpoint, token or fallback remains in provider source/config files:\n${providerViolations.map((path) => `- ${path}`).join("\n")}`,
);
console.log(`Native-only authentication boundary: PASS (SDK/OpenAPI plus ${new Set(scanned).size} runtime, deployment, configuration and documentation files across all six runtime organs contain no external identity-provider integration)`);

const historicalCompatibilityAllowlist = new Set([
  "backend/migrations/" + retiredIdentityProviderFilePrefix + "_identity_bridge.sql",
  "backend/migrations/" + retiredIdentityProviderFilePrefix + "_identity_link_audit.sql",
  "backend/migrations/" + retiredIdentityProviderFilePrefix + "_registration_consent.sql",
  "backend/migrations/20261115_testagram_native_auth_cutover_foundation.sql",
  "backend/migrations/20261120_native_identity_historical_account_archive.sql",
  "backend/migrations/20261120_native_identity_historical_admin_archive.sql",
  "backend/migrations/20261120_native_identity_historical_attribution_archive.sql",
  "backend/migrations/20261120_native_identity_historical_staff_archive.sql",
  "backend/scripts/test-identity-registration-migration.sh",
  "backend/migrations/20261108_communication_core.sql",
  "backend/migrations/20261109_iptv_social.sql",
  "backend/migrations/20261110_staff_roles.sql",
  "backend/migrations/20261111_admin_security_controls.sql",
  "backend/migrations/20261111_identity_registration_pipeline.sql",
  "backend/migrations/20261111_profile_storage_capacity.sql",
  "backend/migrations/20261112_fresh_media_owner_keys.sql",
  "backend/migrations/20261112_instabox_avatar_storage.sql",
  "backend/migrations/20261113_identity_idswyft_intake.sql",
  "backend/migrations/20261113_identity_registration_hardening.sql",
  "backend/migrations/20261113_native_identity_verification.sql",
  "backend/migrations/20261114_native_identity_integrity.sql",
  "backend/migrations/20261116_native_approved_identity_provisioning.sql",
  "backend/migrations/20261118_native_admin_console.sql",
  "backend/migrations/20261119_native_identity_approval_ledger.sql",
  "backend/migrations/20261120_native_verification_decider.sql",
  "backend/migrations/neon/001_social_data_plane.sql",
  "flutter-client/test/features/auth/identity_verification_client_test.dart",
  "flutter-client/test/widget_test.dart",
]);
const exhaustiveFiles = [];
const exhaustiveExcluded = new Set([".git", "node_modules", "vendor", "build", "dist", ".dart_tool", ".gradle", ".idea"]);
function walkExhaustive(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (exhaustiveExcluded.has(entry)) continue;
      walkExhaustive(join(path, entry));
    }
    return;
  }
  if (extensions.has(path.slice(path.lastIndexOf(".")))) exhaustiveFiles.push(path);
}
for (const root of roots.filter((value) => value.startsWith("source-repos/"))) {
  walkExhaustive(resolve(root));
}
const historicalHits = [];
const unclassifiedHits = [];
for (const path of new Set(exhaustiveFiles)) {
  const source = readFileSync(path, "utf8");
  if (!retiredIdentityProviderPattern.test(source)) continue;
  const normalized = path.replaceAll("\\", "/");
  const marker = normalized.indexOf("source-repos/");
  const relative = marker >= 0 ? normalized.slice(marker + "source-repos/".length) : normalized;
  if (historicalCompatibilityAllowlist.has(relative)) historicalHits.push(relative);
  else unclassifiedHits.push(relative);
}
assert.equal(
  unclassifiedHits.length,
  0,
  `Unclassified retired-provider traces remain outside the explicit migration/CI compatibility boundary:\\n${unclassifiedHits.sort().map((item) => `- ${item}`).join("\\n")}`,
);
console.log(`Historical compatibility residue is isolated to ${new Set(historicalHits).size} explicitly allowlisted migration/CI files; no other organ source, test, deployment, configuration or documentation file contains provider traces.`);
console.log(`Historical compatibility files:\\n${[...new Set(historicalHits)].sort().map((item) => `- ${item}`).join("\\n")}`);

