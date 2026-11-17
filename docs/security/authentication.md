# Authentication and authorization

## End-user identity

Testagram owns end-user identity, password verification, sessions, recovery and authorization. Flutter sends a short-lived Testagram-native access token to the Backend:

```http
Authorization: Bearer <TESTAGRAM_ACCESS_TOKEN>
```

The Backend verifies the HS256 signature, fixed issuer and audience, token lifetime, canonical Testagram UUID, session ID and token version. It then checks the live PostgreSQL session, revocation state, account status, verified email and registration-provisioning state. A valid signature alone is not sufficient.

- Access tokens are short-lived (15 minutes).
- Refresh tokens are opaque, stored only as one-way hashes, rotated on use and revoked on reuse detection.
- Logout revokes the current session; logout-all increments the account token version and revokes all active sessions.
- Password recovery uses an opaque, hashed, single-use token with a 30-minute expiry. Password reset revokes existing sessions and increments the token version.
- Email verification uses a separate expiring, single-use token.
- Passwords must satisfy the Backend's 12–128 byte policy and are stored using the configured password KDF. Never fabricate or import password hashes.

## Account registration

New accounts enter through the Testagram-owned identity application flow. The application endpoint does not create an account. It requires accepted age, Terms and Privacy declarations, a high-entropy idempotency key, PostgreSQL, configured policy versions, private evidence storage and verified replication.

Identity evidence is stored as private object bytes, while PostgreSQL stores opaque object references, bounded metadata and SHA-256 digests. Evidence is not public media. Manual identity review and independent two-person account approval must complete before native account provisioning. Email verification is then required before the account can sign in.

The registration feature flag remains fail-closed until the storage, email, policy and approval services are ready. The Flutter form may be visible while the Backend still returns a clear registration-unavailable response.

## Staff identity review

The Admin Console uses the same Testagram-native Backend identity authority. It exchanges credentials at the native login endpoint, verifies the current session and PostgreSQL staff principal/role, and stores the session only inside an encrypted `testagram-staff` cookie (`HttpOnly`, `Secure`, `SameSite=Strict`). Staff access requires an enabled principal, enrolled MFA and an explicit PostgreSQL role grant. Staff invitation and role-grant activation remain fail-closed until the dual-control onboarding path is implemented. Historical Appwrite account IDs are reconciliation inputs only; Appwrite bearer tokens are not accepted by the native end-user or staff API paths.

## Security rules

- Never ship JWT signing secrets, refresh tokens, internal service tokens, storage credentials or email-provider credentials to a client.
- Never treat client-side role claims or hidden UI controls as authorization.
- Backend authorizes every read/write against canonical identity, visibility, ownership, blocks, mutes and moderation policy.
- Private Data Centre, Federation and Algorithm endpoints are service-to-service only.
- Do not store bearer tokens, recovery tokens, evidence bytes or signed object URLs in logs, analytics, crash reports or test fixtures.
- Use TLS for all non-local traffic.
