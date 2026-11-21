import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const bridge = readJson("../contracts/registry/seven-organ-bridge.json");
const pins = readJson("../contracts/sources.lock.json");

assert.equal(bridge.schemaVersion, 1, "unsupported bridge manifest schema");
assert.equal(bridge.bridge, "testagram-seven-organ-bridge");
const expected = new Set([
  "flutter-client", "backend", "data-centre", "cdn",
  "algorithm", "federation", "api-control-plane",
]);
const ids = bridge.repositories.map((repo) => repo.id);
assert.equal(ids.length, 7, "bridge must describe exactly seven repositories");
assert.equal(new Set(ids).size, 7, "duplicate repository identity in bridge manifest");
assert.deepEqual(new Set(ids), expected, "bridge repository set is incomplete or contains an unknown organ");

const byId = new Map(bridge.repositories.map((repo) => [repo.id, repo]));
for (const repo of bridge.repositories) {
  assert.match(repo.mainCommit, /^[0-9a-f]{40}$/, `${repo.id}: invalid immutable main commit`);
  assert.equal(repo.defaultBranch, "main", `${repo.id}: unexpected default branch`);
  assert.ok(repo.fullName.startsWith("Trendyzima/"), `${repo.id}: unexpected repository owner`);
  assert.ok(Array.isArray(repo.mergedPullRequests), `${repo.id}: merged PR evidence must be an array`);
  if (repo.kind === "runtime") {
    assert.ok(repo.sourcePinKey, `${repo.id}: runtime organ missing source pin key`);
    const pin = pins.repositories[repo.sourcePinKey];
    assert.ok(pin, `${repo.id}: source pin missing from contracts/sources.lock.json`);
    assert.equal(pin.fullName, repo.fullName, `${repo.id}: source pin repository mismatch`);
    assert.equal(pin.ref, repo.mainCommit, `${repo.id}: bridge commit and source pin differ`);
    assert.match(pin.ref, /^[0-9a-f]{40}$/);
    assert.ok(Array.isArray(pin.sourcePaths) && pin.sourcePaths.length > 0, `${repo.id}: source path inventory missing`);
  } else {
    assert.equal(repo.id, "api-control-plane", "only the API control plane may be non-runtime");
    assert.equal(repo.kind, "governance");
    assert.equal(repo.sourcePinKey, null, "control plane must not pin itself as a runtime provider");
  }
}

const expectedRuntimeEdges = new Set([
  "flutter-client->backend",
  "flutter-client->cdn",
  "backend->data-centre",
  "backend->cdn",
  "backend->algorithm",
  "backend->federation",
]);
const actualRuntimeEdges = bridge.runtimeEdges.map((edge) => `${edge.from}->${edge.to}`);
assert.equal(actualRuntimeEdges.length, expectedRuntimeEdges.size, "unexpected runtime edge count");
assert.equal(new Set(actualRuntimeEdges).size, actualRuntimeEdges.length, "duplicate runtime edge");
assert.deepEqual(new Set(actualRuntimeEdges), expectedRuntimeEdges, "runtime wiring differs from the approved seven-organ topology");
for (const edge of bridge.runtimeEdges) {
  assert.ok(byId.has(edge.from) && byId.has(edge.to), "runtime edge references an unknown organ");
  assert.notEqual(edge.from, "api-control-plane", "API control plane must never be a runtime caller");
  assert.notEqual(edge.to, "api-control-plane", "API control plane must never be a runtime dependency");
  assert.ok(typeof edge.contract === "string" && edge.contract.trim().length >= 12, "runtime edge must name its explicit contract");
}
const expectedGovernanceTargets = new Set([
  "flutter-client", "backend", "data-centre", "cdn", "algorithm", "federation",
]);
const actualGovernanceTargets = bridge.governanceEdges.map((edge) => edge.to);
assert.equal(actualGovernanceTargets.length, expectedGovernanceTargets.size, "unexpected governance edge count");
assert.equal(new Set(actualGovernanceTargets).size, actualGovernanceTargets.length, "duplicate governance edge");
assert.deepEqual(new Set(actualGovernanceTargets), expectedGovernanceTargets, "control plane must govern each runtime organ exactly once");
for (const edge of bridge.governanceEdges) {
  assert.equal(edge.from, "api-control-plane", "governance edges must originate at the API control plane");
  assert.ok(byId.has(edge.to) && edge.to !== "api-control-plane", "invalid governance target");
  assert.ok(typeof edge.contract === "string" && edge.contract.trim().length >= 12, "governance edge must name its explicit contract");
}
assert.ok(bridge.invariants.some((item) => item.includes("Backend is the canonical identity")));
assert.ok(bridge.invariants.some((item) => item.includes("never a runtime gateway")));
assert.ok(!JSON.stringify(bridge).toLowerCase().includes("supabase"), "unapproved external provider reference");
assert.ok(!JSON.stringify(bridge).toLowerCase().includes("xclone"), "unapproved external product reference");

console.log("Seven-organ bridge manifest, six immutable runtime pins, topology and trust boundaries: PASS");
