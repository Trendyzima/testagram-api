# Authentication and authorization

## Client identity

The supported client identity flow is Appwrite session authentication. Flutter uses the Appwrite Client SDK to obtain a session JWT, then sends it to the Testagram Backend as an HTTP Bearer token.

```http
Authorization: Bearer <APPWRITE_SESSION_JWT>
```

The Backend validates the JWT with the Appwrite Account API and resolves the Appwrite identity through its canonical PostgreSQL identity bridge. Unknown or unlinked identities must fail closed. Do not link accounts by matching email.

## Rules

- Never ship Appwrite API keys, Backend internal tokens, Federation tokens, storage credentials or signing secrets in a client.
- Never treat client-side role claims or hidden UI controls as authorization.
- Backend must authorize each read/write against canonical identity, visibility, ownership, blocks and moderation policy.
- Private Data Centre, Federation and Algorithm endpoints are service-to-service only.
- Do not store bearer tokens in logs, analytics, crash reports or test fixtures.
- Use TLS for all non-local traffic.
- Token refresh/re-authentication behavior must follow Appwrite SDK semantics; do not invent a refresh endpoint in this contract.
