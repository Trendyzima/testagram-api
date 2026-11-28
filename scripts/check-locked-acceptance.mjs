import { readFileSync } from "node:fs";

const lock = JSON.parse(readFileSync("contracts/sources.lock.json", "utf8"));
const acceptance = readFileSync("docs/integration/locked-seven-repository-acceptance.md", "utf8");

const runtimeRepositories = {
  backend: "Trendyzima/Testagram-backend-",
  "data-centre": "Trendyzima/Testagram-data-centre-",
  cdn: "Trendyzima/cdn-",
  "flutter-client": "Trendyzima/testagram-flutter-client-",
  federation: "Trendyzima/federated-content",
  algorithm: "Trendyzima/the-algorithm",
};
const gates = ["G0", "G1", "G2", "G3", "G4", "G5", "G6", "G7"];
const failures = [];

for (const [key, fullName] of Object.entries(runtimeRepositories)) {
  const pin = lock.repositories[key];
  if (!pin) {
    failures.push(`Missing immutable source pin: ${key}`);
    continue;
  }
  if (pin.fullName !== fullName) failures.push(`${key}: unexpected repository identity ${pin.fullName}`);
  if (!/^[a-f0-9]{40}$/.test(pin.ref)) failures.push(`${key}: source pin is not a full immutable commit SHA`);
  if (!acceptance.includes(fullName)) failures.push(`Locked acceptance document omits repository ${fullName}`);
  if (!acceptance.includes(pin.ref)) failures.push(`Locked acceptance document omits ${key} source pin ${pin.ref}`);
  if (!Array.isArray(pin.sourcePaths) || pin.sourcePaths.length === 0) failures.push(`${key}: no pinned source paths`);
}

if (!acceptance.includes("Trendyzima/testagram-api")) failures.push("Locked acceptance document omits the API governance repository");
if (!acceptance.includes("Identity-independent ordinary account access")) failures.push("Locked acceptance must contain the current identity-independent account-access policy");
if (!acceptance.includes("Government ID, ID number, selfie, identity evidence, identity review, identity approval")) failures.push("Locked acceptance must explicitly forbid identity evidence and approval as ordinary signup/login prerequisites");
if (!acceptance.includes("native_registration_provisioning")) failures.push("Locked acceptance must record removal of the optional identity-provisioning schema from native sessions");

if (!acceptance.includes("not a runtime service") && !acceptance.includes("not a runtime hop")) {
  failures.push("API governance repository must be explicitly marked build-time only, not a runtime hop");
}
for (const gate of gates) {
  if (!acceptance.includes(`### ${gate} —`)) failures.push(`Locked acceptance gate missing: ${gate}`);
}
for (const marker of [
  "NOT ACCEPTED",
  "exact image digest",
  "coordinated off-host",
  "viewer assertion",
  "idempotency",
  "rollback",
  "production approval",
]) {
  if (!acceptance.toLowerCase().includes(marker.toLowerCase())) failures.push(`Locked acceptance is missing required release invariant: ${marker}`);
}
if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log("Locked seven-repository acceptance is internally consistent with all six immutable runtime source pins and G0-G7 gates.");
