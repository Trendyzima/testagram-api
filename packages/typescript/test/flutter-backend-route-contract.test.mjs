import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const spec = readFileSync(resolve(root, "contracts/openapi/testagram-v1.yaml"), "utf8");
const inventory = JSON.parse(readFileSync(resolve(root, "contracts/route-inventory/backend-public-routes.json"), "utf8"));
const normalize = (path) => path.replace(/\\{[^}]+\\}/g, "{}");
const operations = new Set();
for (const block of spec.split(/(?=^  \/)/m).filter((item) => /^  \//.test(item))) {
  const match = block.match(/^  (\/[^:\\n]+):/m);
  if (!match) continue;
  for (const method of ["get", "post", "put", "patch", "delete", "head", "options"]) {
    if (new RegExp("^    " + method + ":", "m").test(block)) operations.add(method.toUpperCase() + " " + normalize(match[1]));
  }
}
const required = [
  [
    "GET",
    "/api/feed/public"
  ],
  [
    "GET",
    "/api/social/posts/{post_id}/poll"
  ],
  [
    "GET",
    "/api/social/posts/{post_id}/reaction"
  ],
  [
    "GET",
    "/api/social/posts/{post_id}/reposts"
  ],
  [
    "DELETE",
    "/api/threads/{thread_id}"
  ],
  [
    "GET",
    "/api/threads/{thread_id}/likes"
  ],
  [
    "GET",
    "/api/threads/{thread_id}/likes/state"
  ],
  [
    "GET",
    "/api/threads/{thread_id}/reposts"
  ],
  [
    "GET",
    "/api/threads/{thread_id}/reposts/state"
  ],
  [
    "POST",
    "/api/threads/likes/states"
  ],
  [
    "POST",
    "/api/threads/reposts/states"
  ],
  [
    "POST",
    "/api/threads/bookmarks/states"
  ],
  [
    "GET",
    "/api/social/history"
  ],
  [
    "POST",
    "/api/social/history"
  ],
  [
    "DELETE",
    "/api/social/history"
  ],
  [
    "POST",
    "/api/media/list"
  ],
  [
    "POST",
    "/api/media/private-download-url"
  ]
];
test("Flutter runtime operations are promoted into the public OpenAPI contract", () => {
  for (const [method, path] of required) {
    const operation = method + " " + normalize(path);
    const entry = inventory.routes.find((route) => route.method === method && normalize(route.path) === normalize(path));
    assert.ok(entry, "route inventory is missing " + operation);
    assert.equal(entry.status, "contracted", operation + " must be contracted only after specification");
    assert.ok(operations.has(operation), "public OpenAPI is missing " + operation);
  }
});
