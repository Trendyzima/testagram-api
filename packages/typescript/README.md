# Testagram TypeScript API client

Install from this repository after it is merged and a release tag is published:

```sh
npm install git+https://github.com/Trendyzima/testagram-api.git#v0.1.0
```

Import the built client:

```ts
import { TestagramApiClient, endpoints } from "@testagram/api-client";

const api = new TestagramApiClient({
  baseUrl: "https://api.testagram.site",
  getAccessToken: async () => appwriteJwt,
});

const feed = await api.get(endpoints.homeFeed);
const created = await api.createPost({
  content: "Hello Testagram",
  visibility: "public",
  idempotencyKey: crypto.randomUUID(),
});
```

The caller supplies the Appwrite session JWT. The SDK does not store credentials, authorize resources, retry mutations or bypass Backend ownership. Use an immutable release tag/commit; do not depend on a moving branch in production.

Build from the repository root with `npm run build:sdk`. The distributable output is written to the ignored `packages/typescript/dist` directory.
