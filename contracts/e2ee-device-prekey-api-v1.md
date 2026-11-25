# Testagram device trust and prekey API contract v1

**Status: proposed contract only — NOT implemented, NOT generated into SDKs, NOT enabled in production.**
**Protocol status: no protocol approved.** This contract intentionally leaves cryptographic algorithms and wire encodings protocol-neutral until Testagram approves one maintained implementation and completes legal, provenance, cross-platform and independent security review.

This is a Backend-owned runtime API contract. The API repository is build-time governance only; it does not serve these routes, store runtime keys, or authorize users.

## Security invariants

1. Backend authenticates the Testagram session and derives the account ID from that session. Never accept an account/user ID as the authority for device ownership.
2. Private identity keys, signed-prekey private keys, one-time-prekey private keys, ratchet/session state and message plaintext are generated and retained on trusted clients only. They are never accepted by these routes.
3. A password/email login alone does not establish a trusted device. Enrollment requires proof of possession plus approval from an already trusted device or a separately reviewed high-friction recovery ceremony.
4. A new device remains **pending/untrusted** until the approval ceremony completes. It cannot publish recipient prekeys, fetch bundles, send encrypted envelopes or receive encrypted messages while pending.
5. Device revocation is immediate for subsequent API authorization and prekey claims. Cached bundles must be invalidated; message delivery fanout must re-check device state.
6. One-time prekeys are claimed atomically and at most once. Retries use idempotency keys and return the same claim result only to the same authenticated requester and target.
7. Every signed object is bound to the protocol suite/version, device ID, key ID, purpose and canonical serialization. Reject unknown versions, duplicate IDs, malformed encodings, oversized bodies, invalid signatures and replay.
8. Backend stores public key material and lifecycle metadata only. Logs, analytics, notifications, backups and support exports must not contain private material, plaintext, access tokens or raw proofs.
9. A successful HTTP response means the state transition is durably committed. No endpoint may report a device as verified before the approval transaction commits.
10. These endpoints do not themselves prove that a client encrypted honest plaintext. E2EE claims require the reviewed client protocol implementation and full acceptance evidence.

## Common HTTP behavior

- Base path: `/api/communications/v1`.
- Transport: HTTPS only.
- Authentication: `Authorization: Bearer <Testagram access token>`; native Backend session validation and current account status are mandatory.
- Mutations: `Content-Type: application/json`, `Idempotency-Key` (at least 128 bits of random entropy; URL-safe encoding), bounded request body.
- Responses: JSON envelope consistent with the current Backend API response convention; timestamps are RFC 3339 UTC.
- Request correlation: accept/propagate `X-Request-ID`; never echo credentials or proof bytes into logs.
- Common errors: `401 AUTH_REQUIRED`, `403 DEVICE_NOT_TRUSTED`, `409 IDEMPOTENCY_CONFLICT`, `409 DEVICE_STATE_CONFLICT`, `413 REQUEST_TOO_LARGE`, `422 INVALID_KEY_MATERIAL`, `429 RATE_LIMITED`, `503 E2EE_NOT_READY`.
- Unknown fields are rejected for cryptographic request objects. No silent algorithm negotiation or downgrade.

## Lifecycle and endpoints

### 1. Begin enrollment challenge

`POST /devices/enrollment-challenges`

Request:
```json
{
  "client_instance_id": "opaque-random-client-instance-id",
  "platform": "android",
  "client_version": "1.0.0",
  "protocol_suite": "implementation-approved-suite-id",
  "protocol_version": "1"
}
```

Response (illustrative):
```json
{
  "challenge_id": "opaque-id",
  "challenge": "base64url-random-challenge",
  "expires_at": "2026-11-25T14:20:00Z",
  "approval_required": true
}
```

Requirements:
- Challenge is cryptographically random, single-use, account-bound, purpose-bound and expires within five minutes.
- Apply per-account, per-IP and per-device enrollment limits.
- A client instance ID is not a device identity and must not be treated as proof.

### 2. Register a pending device

`POST /devices`

Request:
```json
{
  "challenge_id": "opaque-id",
  "device_id": "client-generated-random-opaque-id",
  "platform": "android",
  "client_version": "1.0.0",
  "protocol_suite": "implementation-approved-suite-id",
  "protocol_version": "1",
  "identity_key": {
    "key_id": "identity-key-id",
    "public_key": "base64url-public-key"
  },
  "proof": {
    "purpose": "device-enrollment",
    "signed_payload": "base64url-canonical-challenge-binding",
    "signature": "base64url-signature"
  }
}
```

Response: `201` with `device_id`, `state: pending_verification`, `created_at`, and the required approval method. Never return private key material.

Requirements:
- Verify the challenge is live, unused and bound to the authenticated account.
- Verify proof of possession using the submitted public identity key and the exact canonical challenge, device ID, account binding, suite/version and purpose.
- Enforce unique device IDs within the account and unique key IDs within the device.
- Store the device as pending; do not accept prekeys or issue message-delivery eligibility yet.
- Do not let a request choose its own `verified`, `trusted`, `revoked` or authorization state.

### 3. List devices

`GET /devices`

Return only the authenticated account's devices. Each item contains `device_id`, `platform`, `client_version`, `state` (`pending_verification`, `verified`, `revoked`), public identity-key fingerprint, key version, `created_at`, `last_seen_at`, `verified_at`, and `revoked_at`. Do not return raw proof material or private keys.

### 4. Begin existing-device approval

`POST /devices/{device_id}/verification-challenges`

Called by the pending device. Response includes a short-lived challenge and a QR/deep-link payload containing only the account-scoped device ID, challenge ID, challenge bytes, suite/version and expiry. The payload is not itself approval.

### 5. Approve a device from an already trusted device

`POST /devices/{device_id}/verification`

The caller must be an active, verified device in the same account. Request:
```json
{
  "challenge_id": "opaque-id",
  "approval_device_id": "already-verified-device-id",
  "approved_fingerprint": "canonical-fingerprint-shown-to-user",
  "proof": {
    "purpose": "approve-new-device",
    "signature": "base64url-signature"
  }
}
```

Requirements:
- The existing trusted device signs the exact new-device identity fingerprint, challenge, account, target device ID, suite/version and approval purpose.
- Require an explicit user confirmation on the approving device after displaying a matching QR/safety-number comparison.
- Reject approval by the pending device itself, an unverified/revoked device, a different account, an expired challenge or a replayed signature.
- Commit device verification and challenge consumption atomically.
- Emit a metadata-only security event to existing account devices; never include private keys or message content.

### 6. Revoke a device

`DELETE /devices/{device_id}`

The authenticated user may revoke a device, subject to step-up authentication/recovery policy. Response: `204`.

Requirements:
- Revocation is idempotent and irreversible for that device identity; re-enrollment creates a new device identity and repeats verification.
- Commit revocation, key-directory invalidation and delivery eligibility change atomically.
- Reject revocation of the last trusted device unless the explicit recovery flow is used; do not lock an account out by accident.
- Re-check revocation on every prekey claim and encrypted-message delivery. Short-lived cached bundles must not authorize delivery after revocation.
- Notify remaining trusted devices with a metadata-only event.

### 7. Publish or rotate signed prekey and one-time prekeys

`PUT /devices/{device_id}/prekeys`

Only the owning verified device may publish. Request:
```json
{
  "protocol_suite": "implementation-approved-suite-id",
  "protocol_version": "1",
  "signed_prekey": {
    "key_id": "spk-unique-id",
    "public_key": "base64url-public-key",
    "signature": "base64url-signature",
    "expires_at": "2026-12-25T00:00:00Z"
  },
  "one_time_prekeys": [
    {"key_id": "opk-unique-id-1", "public_key": "base64url-public-key"},
    {"key_id": "opk-unique-id-2", "public_key": "base64url-public-key"}
  ]
}
```

Requirements:
- Backend verifies signed-prekey signature using the enrolled public identity key and protocol-defined canonical bytes.
- Enforce protocol-specific key sizes/encodings, expiry bounds, maximum batch size, per-device inventory limits and unique key IDs.
- Reject private-key fields, unknown fields, duplicate IDs, expired keys and invalid signatures.
- Store prekeys in a transaction. Replenishment is idempotent and cannot overwrite an existing key ID with different bytes.
- Do not allow a revoked or pending device to publish.

### 8. Claim a recipient device bundle

`POST /prekeys/bundles:claim`

Request:
```json
{
  "recipient_user_id": "target-account-id",
  "recipient_device_ids": ["verified-device-id"],
  "protocol_suite": "implementation-approved-suite-id",
  "protocol_version": "1"
}
```

Response includes, per target device, the public identity key, signed prekey and signature, and either one atomically claimed one-time prekey or an explicit `one_time_prekey: null` when the selected protocol permits signed-prekey-only setup. It also includes the target device's current public fingerprint and key version.

Requirements:
- Requester must be an active verified device; target devices must be verified, active and eligible for this conversation.
- Backend derives requester account/device from the authenticated session plus verified device proof, not caller-supplied identity fields.
- Enforce conversation membership and block/privacy policy before returning bundles.
- Claim one-time prekeys with a transaction/row lock and a single-use state transition. Concurrent claims must never return the same one-time prekey.
- Idempotency key is bound to requester device, target device set and request body. A replay from another requester or changed body is rejected.
- Return no private key or recipient recovery secret.
- Rate-limit discovery and claim operations; alert on depletion and abusive enumeration.

### 9. Confirm identity-key change / re-verification

`POST /devices/{device_id}/identity-key-rotations`

Only the existing verified device may request rotation. Rotation must include the new public identity key, a proof signed by the old identity key binding the new key and version, and the protocol-required proof signed by the new key. If the old key is unavailable, use the explicit account recovery flow; never silently replace a pinned identity.

Response state is `pending_reverification` until existing trusted devices approve the new fingerprint. During this state, clients must show a security warning and apply the selected protocol's block/hold policy. A key change must invalidate cached prekey bundles and generate a metadata-only security event.

## Device states

Allowed transitions:

- `pending_verification -> verified`: only successful existing-device approval or reviewed recovery.
- `verified -> revoked`: user-initiated revocation, authorized recovery/security response, or account security policy.
- `verified -> pending_reverification`: identity-key replacement.
- `pending_reverification -> verified`: successful re-verification of the new fingerprint.
- `revoked` is terminal. Never reactivate the same device identity.

Backend state is authoritative. Client-provided booleans such as `is_verified`, `trusted`, `e2ee_enabled` or `key_changed` are never accepted as authorization inputs.

## Required conformance tests

- Challenge entropy, expiry, account binding, single use and replay rejection.
- Invalid proof, wrong key, wrong purpose, malformed encoding, duplicate key ID and unknown suite/version rejection.
- Pending device cannot publish prekeys, claim bundles, send, receive or verify itself.
- Existing verified device can approve only after fingerprint comparison; another account/device cannot approve.
- Revocation immediately blocks prekey claim and future delivery, including with a previously cached bundle.
- Concurrent one-time-prekey claims never return the same key; retry by the same idempotency key returns a stable result.
- Changed body/requester under reused idempotency key returns conflict.
- Identity-key rotation invalidates caches and requires visible re-verification.
- Account suspension, refresh-token revocation, logout-all and session expiry are enforced.
- Database backups, logs, analytics, notifications and support exports contain no private key material or plaintext.
- Android and supported web clients pass the same protocol-owned test vectors and negative vectors.

## Activation gates

This contract is not a feature flag and must not be interpreted as route availability. Before implementation is enabled:
1. Approve exactly one protocol family and exact maintained implementation for Android and supported web.
2. Complete licensing, source provenance, dependency pinning, reproducible build and upstream security review.
3. Implement Backend handlers, migrations, transactional constraints, OpenAPI and generated SDK updates in one reviewed change set.
4. Implement client-side key generation, protected storage, serialized session state and the verification ceremony.
5. Add cross-platform conformance and negative tests, independent security review and full staging acceptance.
6. Verify message send/list, realtime, notifications, encrypted attachments, deletion and revocation across Backend, Data Centre and CDN.
7. Only then remove `503 E2EE_NOT_READY` for the exact accepted scope. Group, federation, backup and call-media encryption remain separate gates.

Until then all routes described here are design-only, no SDK is generated, and secure messaging remains disabled.
