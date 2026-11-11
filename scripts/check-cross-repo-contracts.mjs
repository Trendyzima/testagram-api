import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";

const lock = JSON.parse(readFileSync("contracts/sources.lock.json", "utf8"));
const registry = JSON.parse(readFileSync("contracts/registry/services.json", "utf8"));
const required = ["backend", "data-centre", "cdn", "flutter-client", "federation", "algorithm"];
const fail = [];
const keys = Object.keys(lock.repositories).sort();
if (JSON.stringify(keys) !== JSON.stringify([...required].sort())) {
  fail.push(`Expected exactly six pinned repositories; found: ${keys.join(", ")}`);
}
const registryRepos = new Set(registry.services.map((s) => s.repository.toLowerCase()));
for (const key of required) {
  const entry = lock.repositories[key];
  if (!entry) continue;
  if (!/^[a-f0-9]{40}$/.test(entry.ref)) fail.push(`${key}: ref must be a full immutable commit SHA`);
  const root = resolve(entry.checkoutPath);
  if (!existsSync(root)) {
    fail.push(`${key}: checkout missing at ${entry.checkoutPath}`);
    continue;
  }
  try {
    const actual = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    if (actual !== entry.ref) fail.push(`${key}: checkout ${actual} does not match pinned ${entry.ref}`);
  } catch {
    fail.push(`${key}: cannot read checked-out git revision`);
  }
  for (const sourcePath of entry.sourcePaths) {
    if (!existsSync(resolve(root, sourcePath))) fail.push(`${key}: pinned source path missing: ${sourcePath}`);
  }
  const repoName = entry.fullName.toLowerCase();
  if (!registryRepos.has(repoName)) fail.push(`${key}: repository missing from service registry`);
}

for (const snapshot of lock.snapshots) {
  const entry = lock.repositories[snapshot.repository];
  if (!entry) {
    fail.push(`Snapshot references unknown repository: ${snapshot.repository}`);
    continue;
  }
  const source = resolve(entry.checkoutPath, snapshot.sourcePath);
  const target = resolve(snapshot.snapshotPath);
  if (!existsSync(source) || !existsSync(target)) {
    fail.push(`Snapshot source or target missing: ${snapshot.sourcePath} -> ${snapshot.snapshotPath}`);
    continue;
  }
  const sourceText = readFileSync(source, "utf8").replace(/\r\n/g, "\n");
  const targetText = readFileSync(target, "utf8").replace(/\r\n/g, "\n");
  if (sourceText !== targetText) fail.push(`Snapshot drift: ${snapshot.snapshotPath} differs from pinned ${snapshot.repository}:${snapshot.sourcePath}`);
}

const publicSpec = readFileSync("contracts/openapi/testagram-v1.yaml", "utf8");
if (/^  \/internal\//m.test(publicSpec) || publicSpec.includes("/api/cache/purge")) {
  fail.push("Private service or operator-only route leaked into public Backend OpenAPI");
}
if (fail.length) {
  console.error(fail.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Cross-repository contract audit passed: six immutable source pins, source paths, snapshots and public/private boundary verified.");
