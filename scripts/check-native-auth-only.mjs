import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const paths = [
  "packages/typescript/src/index.ts",
  "packages/typescript/test/client.test.mjs",
  "contracts/openapi/testagram-v1.yaml",
];
for (const path of paths) {
  const content = readFileSync(path, "utf8");
  assert.doesNotMatch(content, /appwrite/i, `${path}: external identity-provider reference is forbidden in the public SDK and API contract`);
}
const sdk = readFileSync(paths[0], "utf8");
assert.match(sdk, /Testagram-native Backend access token/);
assert.match(sdk, /Authorization/);
assert.match(sdk, /Testagram-native access token is required/);
const contract = readFileSync(paths[2], "utf8");
assert.match(contract, /testagramBearer/);
assert.match(contract, /loginWithTestagramCredentials/);
assert.match(contract, /refresh/);
console.log("Native-only authentication boundary: PASS (SDK and public contract contain no external identity-provider integration)");
