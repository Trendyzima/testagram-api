import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const registry = JSON.parse(readFileSync("contracts/registry/services.json", "utf8"));
const doc = readFileSync("docs/seven-repository-navigation.md", "utf8");
const expected = {
  "backend-public": { repository: "Trendyzima/Testagram-backend-", consumers: ["flutter-client"] },
  "flutter-client": { repository: "Trendyzima/testagram-flutter-client-", consumers: ["backend-public"] },
  "data-centre-platform": { repository: "Trendyzima/Testagram-data-centre-", consumers: ["backend-public"] },
  "cdn-edge": { repository: "Trendyzima/cdn-", consumers: ["backend-public", "flutter-client"] },
  federation: { repository: "Trendyzima/federated-content", consumers: ["backend-public", "remote-activitypub-peers"] },
  algorithm: { repository: "Trendyzima/the-algorithm", consumers: ["backend-public"] },
};
const failures = [];
const byId = new Map(registry.services.map((service) => [service.id, service]));

if (registry.services.length !== 6) failures.push(`Expected six runtime services; found ${registry.services.length}`);
for (const [id, contract] of Object.entries(expected)) {
  const service = byId.get(id);
  if (!service) {
    failures.push(`Registry is missing runtime service: ${id}`);
    continue;
  }
  if (service.repository !== contract.repository) failures.push(`${id}: repository identity drifted to ${service.repository}`);
  const actualConsumers = [...(service.consumers || [])].sort();
  const expectedConsumers = [...contract.consumers].sort();
  if (JSON.stringify(actualConsumers) !== JSON.stringify(expectedConsumers)) {
    failures.push(`${id}: consumer graph mismatch; expected ${expectedConsumers.join(", ")}, found ${actualConsumers.join(", ")}`);
  }
  const url = `https://github.com/${contract.repository}`;
  if (!doc.includes(url)) failures.push(`${id}: navigation document is missing direct repository link ${url}`);
  if (!Array.isArray(service.contracts) || service.contracts.length === 0) {
    failures.push(`${id}: no contract paths registered`);
  } else {
    for (const path of service.contracts) {
      if (!existsSync(resolve(path))) failures.push(`${id}: registered contract path does not exist: ${path}`);
    }
  }
}
if (!doc.includes("https://github.com/Trendyzima/testagram-api")) {
  failures.push("Navigation document is missing the Testagram API control-plane link");
}
for (const invariant of [
  "Not a runtime service or gateway",
  "Backend retains user authorization",
  "Backend rechecks access",
  "not proof of live DNS",
  "G0–G7 locked acceptance",
]) {
  if (!doc.toLowerCase().includes(invariant.toLowerCase())) {
    failures.push(`Navigation document is missing trust-boundary invariant: ${invariant}`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}
console.log("Seven-repository navigation audit passed: six runtime identities, consumer graph, contract paths and seven direct repository links are consistent.");
