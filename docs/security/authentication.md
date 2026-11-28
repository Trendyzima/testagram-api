# Authentication and authorization

## End-user identity

Testagram owns end-user identity, password verification, sessions, recovery and authorization. Flutter sends a short-lived Testagram-native access token to the Backend:

```http
Authorization: Bearer <TESTAGRAM_ACCESS_TOKEN>
```

The Backend verifies the HS256 signature, fixed issuer and audience, token lifetime, canonical Testagram UUID, session ID and token version. It then checks the live PostgreSQL session, revocation state, account enabled state and verified email. A valid signature alone is not sufficient. Ordinary account access does not depend on an identity application or evidence record; an explicitly disabled account remains blocked.

- Access tokens are short-lived (15 minutes).
- Refresh tokens are opaque, stored only as one-way hashes, rotated on use and revoked on reuse detection.
- Logout revokes the current session; logout-all increments the account token version and revokes all active sessions.
- Password recovery uses an opaque, hashed, single-use token with a 30-minute expiry. Password reset revokes existing sessions and increments the token version.
- Email verification uses a separate expiring, single-use token.
- Passwords must satisfy the Backend's 12–128 byte policy and are stored using the configured password KDF. Never fabricate or import password hashes.

## Account registration

Ordinary public account creation uses the Testagram-native `POST /api/auth/signup` email/password endpoint. It creates a pending native account, records the user's Terms, Privacy and age self-declaration, and queues email verification. After the user verifies their email, they can sign in with their password and receive a native session. Ordinary registration does **not** require a government ID, ID number, selfie, identity evidence, manual identity review, identity approval, or identity-evidence storage.

The separate `POST /api/identity/applications` workflow is not the public signup path and does not create a basic account. It is isolated for optional, explicitly protected capabilities that may require additional assurance. Its evidence bytes remain private, and its reviewer/approval controls stay fail-closed when the dedicated identity service is disabled. Failure or unavailability of that optional workflow must never block ordinary signup, email verification, login, refresh, or logout.

## Staff identity review

The Admin Console uses the same Testagram-native Backend identity authority. It verifies the current session and PostgreSQL staff principal/role, and stores the session only inside an encrypted `testagram-staff` cookie (`HttpOnly`, `Secure`, `SameSite=Strict`). A recorded `mfa_enrolled_at` timestamp is informational only; it is not a live second-factor proof. The Admin Console now fails closed for all identity-review queue, evidence, decision and approval operations unless a fresh phishing-resistant MFA proof is present in the staff session. The password-only `POST /api/admin/step-up` endpoint returns HTTP 503 and does not issue a step-up proof. The native-auth implementation adds one-time WebAuthn registration/assertion challenges, cryptographic verification, RP ID/origin checks, credential-counter and replay protection, and Backend-signed five-minute MFA elevation. Staff enrollment remains closed until owner-authorized enrollment and independent staff authorization are verified on the deployed stack. Optional identity-assurance intake remains closed until PostgreSQL and live Admin Console readiness pass end to end; this gate applies only to the separate identity workflow, never to ordinary public signup or login. The Backend's direct identity-review API routes additionally require a signed `mfa_at` timestamp claim from a verified phishing-resistant challenge within five minutes; the Backend verifies it against the live native session before authorizing direct reviewer routes, preventing a direct-API bypass of the Admin Console gate. The supported runtime has no external identity-provider dependency or fallback. Historical provider identifiers and migration artifacts are inert reconciliation records, never authentication credentials. Any legacy identifier retained for audit or account-reconciliation records is inert data and is never consulted to authenticate a request.

## Security rules

- Never ship JWT signing secrets, refresh tokens, internal service tokens, storage credentials or email-provider credentials to a client.
- Never treat client-side role claims or hidden UI controls as authorization.
- Backend authorizes every read/write against canonical identity, visibility, ownership, blocks, mutes and moderation policy.
- Private Data Centre, Federation and Algorithm endpoints are service-to-service only.
- Do not store bearer tokens, recovery tokens, evidence bytes or signed object URLs in logs, analytics, crash reports or test fixtures.
- Use TLS for all non-local traffic.
The current Data Centre `vps/docker-compose.yml` selects the canonical Backend image through `TESTAGRAM_BACKEND_IMAGE`, built from `cmd/api`; `vps/DEPLOYMENT.md` documents Testagram-native PostgreSQL identity. The Backend retirement change removes the obsolete Fresh API entrypoint, provider adapters and associated image path from the native source branch. Do not route Flutter or new services to historical `/auth/v1/*` endpoints or accept foreign-provider bearer tokens as canonical credentials. Production traffic cutover, backup and rollback still require independent verification.
