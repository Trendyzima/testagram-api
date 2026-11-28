import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const openapi = readFileSync("contracts/openapi/testagram-v1.yaml", "utf8");
const authDocs = readFileSync("docs/security/authentication.md", "utf8");
const bridge = JSON.parse(readFileSync("contracts/registry/seven-organ-bridge.json", "utf8"));

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

const policy = bridge.accountAccessPolicy;
assert.ok(policy, "seven-organ bridge must define machine-readable basic account policy");
assert.equal(policy.ordinaryRegistration.endpoint, "POST /api/auth/signup");
assert.equal(policy.ordinaryLogin.endpoint, "POST /api/auth/login");
assert.equal(policy.optionalIdentityAssurance.enabledByDefault, false);
for (const forbidden of ["government_id", "id_number", "selfie", "identity_evidence", "manual_identity_review", "identity_approval", "identity_evidence_bucket", "identity_service_readiness"]) {
  assert.ok(policy.ordinaryRegistration.forbiddenPrerequisites.includes(forbidden), `signup must forbid ${forbidden} as a prerequisite`);
}
for (const forbidden of ["identity_application", "identity_provisioning_row", "identity_evidence", "manual_identity_review", "identity_approval", "identity_evidence_storage"]) {
  assert.ok(policy.ordinaryLogin.forbiddenPrerequisites.includes(forbidden), `login must forbid ${forbidden} as a prerequisite`);
}
const invariant = bridge.invariants.find((item) => item.startsWith("Ordinary public signup, email verification"));
assert.ok(invariant, "seven-organ bridge must carry the identity-independent basic-access invariant");
assert.match(invariant, /never require government ID, ID number, selfie, identity evidence, identity review, identity approval/i);
assert.match(invariant, /optional identity assurance may gate only specifically designated sensitive capabilities/i);
assert.ok(bridge.repositories.some((repo) => repo.id === "api-control-plane" && repo.kind === "governance"),
  "API Control Plane must remain governance-only, not a runtime identity provider");

console.log("Identity-independent public signup/login contract and seven-organ governance invariant: PASS");
