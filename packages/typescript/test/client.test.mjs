import test from "node:test";
import assert from "node:assert/strict";
import { TestagramApiClient, TestagramApiError } from "../src/index.ts";

test("requires an Appwrite JWT for authenticated requests", async () => {
  const client = new TestagramApiClient({
    baseUrl: "https://api.testagram.site",
    fetch: async () => new Response("{}", { status: 200 }),
  });
  await assert.rejects(() => client.get("/api/feed/home"), /Appwrite session JWT is required/);
});

test("preserves HTTP status and error body", async () => {
  const client = new TestagramApiClient({
    baseUrl: "https://api.testagram.site",
    getAccessToken: () => "test-jwt",
    fetch: async () => new Response(JSON.stringify({
      ok: false,
      data: null,
      error: { code: "FORBIDDEN", message: "Denied by Backend" },
      request_id: "ta-test-1",
    }), { status: 403, headers: { "x-request-id": "ta-test-1" } }),
  });
  await assert.rejects(
    () => client.get("/api/feed/home"),
    (error) => error instanceof TestagramApiError && error.status === 403 && error.message === "Denied by Backend" && error.requestId === "ta-test-1",
  );
});

test("rejects protocol-relative paths", async () => {
  const client = new TestagramApiClient({ baseUrl: "https://api.testagram.site" });
  await assert.rejects(() => client.get("//evil.example/path"), /absolute path/);
});
