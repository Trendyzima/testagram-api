import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const openapi = readFileSync("contracts/openapi/testagram-v1.yaml", "utf8");
const authDocs = readFileSync("docs/security/authentication.md", "utf8");
const bridge = JSON.parse(readFileSync("contracts/registry/seven-organ-bridge.json", "utf8"));
const sourceLock = JSON.parse(readFileSync("contracts/sources.lock.json", "utf8"));

const signupStart = openapi.indexOf("  /api/auth/signup:");
const loginStart = openapi.indexOf("  /api/auth/login:", signupStart);
const refreshStart = openapi.indexOf("  /api/auth/refresh:", loginStart);
const identityStart = openapi.indexOf("  /api/identity/applications:", refreshStart);
assert.ok(signupStart >= 0 && loginStart > signupStart && refreshStart > loginStart && identityStart > refreshStart,
  "public signup, login, refresh and separate identity routes must all exist");

const signup = openapi.slice(signupStart, loginStart);
const login = openapi.slice(loginStart, refreshStart);
const identity = openapi.slice(identityStart, openapi.indexOf("\n  /", identityStart + 5) > 0 ? openapi.indexOf("\n  /", identityStart + 5) : undefined);
const noIdentityRequirement = /does not require a government ID, ID number, selfie, identity evidence, identity review, or identity approval/i;
assert.match(signup, noIdentityRequirement, "ordinary signup contract must explicitly prohibit identity prerequisites");
assert.match(login, /no identity application, ID document, selfie, evidence review, or identity approval is required/i,
  "ordinary login contract must explicitly prohibit identity prerequisites");
assert.match(identity, /separate optional identity-assurance application/i,
  "identity application must be documented as separate and optional");
assert.match(identity, /does not create a basic Testagram account/i,
  "identity application must not be the public account-creation path");

assert.match(authDocs, /Ordinary registration does \*\*not\*\* require a government ID, ID number, selfie, identity evidence, manual identity review, identity approval, or identity-evidence storage/i);
assert.match(authDocs, /Failure or unavailability of that optional workflow must never block ordinary signup, email verification, login, refresh, or logout/i);
assert.match(authDocs, /Optional identity-assurance intake remains closed/i,
  "staff identity-intake readiness must be explicitly separated from public signup readiness");

const invariant = bridge.invariants.find((item) => item.startsWith("Ordinary public signup, email verification"));
assert.ok(invariant, "seven-organ bridge must carry the identity-independent basic-access invariant");
assert.match(invariant, /never require government ID, ID number, selfie, identity evidence, identity review, identity approval/i);
assert.match(invariant, /optional identity assurance may gate only specifically designated sensitive capabilities/i);
assert.ok(bridge.repositories.some((repo) => repo.id === "api-control-plane" && repo.kind === "governance"),
  "API Control Plane must remain governance-only, not a runtime identity provider");


const organPolicies = [
  ["flutter-client", "docs/platform/public-account-registration-policy.md", /must never make government ID, an ID number, a selfie, identity evidence, manual identity review or identity approval a form field/i],
  ["backend", "docs/platform/native-auth-acceptance.md", /must not query or require an identity-application row, evidence object, identity-review decision, identity-approval ledger/i],
  ["data-centre", "docs/backend-infrastructure-api-contract.md", /must not require the media profile, identity-evidence namespace, dedicated identity bucket/i],
  ["cdn", "docs/media-authorization.md", /must not request, inspect, cache, infer or require government ID/i],
  ["algorithm", "docs/testagram-backend-feed-contract.md", /must not require or infer government-ID status, selfie status, identity evidence/i],
  ["federation", "docs/backend-integration-contract.md", /must never require a government ID, ID number, selfie, identity evidence/i],
];
for (const [organ, relativePath, expected] of organPolicies) {
  const source = sourceLock.repositories[organ];
  assert.ok(source?.checkoutPath, `missing source checkout for ${organ}`);
  const policyText = readFileSync(join(source.checkoutPath, relativePath), "utf8");
  assert.match(policyText, expected, `${organ} must explicitly document identity-independent ordinary account access`);
}

const backendRoot = sourceLock.repositories.backend.checkoutPath;
const sessionSource = readFileSync(join(backendRoot, "cmd/api/native_sessions.go"), "utf8");
assert.doesNotMatch(sessionSource, /testagram_identity\.native_registration_provisioning|lockNativeProvisioningAllowsAccess/,
  "native login, access-token validation and refresh must not depend on the identity-provisioning schema");
const backendMain = readFileSync(join(backendRoot, "cmd/api/main.go"), "utf8");
const readiness = backendMain.match(/func nativeAuthReadinessRelations\(\) \[\]string \{[\s\S]*?\n\}/)?.[0] ?? "";
assert.ok(readiness.length > 0, "Backend must expose a testable native-auth readiness relation list");
assert.doesNotMatch(readiness, /testagram_identity\./,
  "ordinary native-auth readiness must not require identity schema relations");
assert.match(backendMain, /if svc\.identityEvidenceStorageConfigured\(\) \{\s*go svc\.runIdentityEvidenceRetentionWorker/,
  "identity retention worker must not start when optional evidence storage is disabled");

const dataRoot = sourceLock.repositories["data-centre"].checkoutPath;
const dataTests = readFileSync(join(dataRoot, "backend/services/media/main_test.go"), "utf8");
assert.match(dataTests, /TestIdentityEvidenceRoutesAreInaccessibleWhenFeatureDisabled/,
  "Data Centre must test that identity-evidence routes remain closed when disabled");

console.log("Identity-independent signup/login, six-organ policy docs and native-session boundaries: PASS");

