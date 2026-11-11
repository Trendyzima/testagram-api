# Testagram TypeScript API client

This workspace publishes `@trendyzima/testagram-api-client` to GitHub Packages when a reviewed `api-vX.Y.Z` tag is pushed.

## Install in a consuming Node.js repository

Configure the GitHub Packages registry and a read-only package token (store the token in CI secrets; never commit it):

```ini
@trendyzima:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Then install:

```sh
npm install @trendyzima/testagram-api-client
```

## Use

```ts
import { TestagramApiClient, endpoints } from "@trendyzima/testagram-api-client";

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

The caller supplies the Appwrite session JWT. The SDK does not store credentials, authorize resources, retry mutations or bypass Backend ownership. Use a published version pinned by the consuming repository's lockfile.

## Build and release

Build from the repository root with `npm run build:sdk`. The distributable output is written to the ignored `packages/typescript/dist` directory. A maintainer publishes it by pushing a reviewed `api-vX.Y.Z` tag after CI passes.
