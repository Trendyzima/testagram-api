# Testagram end-to-end encryption and device trust contract

**Status:** architecture decision / implementation gate — NOT enabled in production  
**Scope:** one-to-one messaging first; group messaging, federated E2EE, encrypted backups and call media E2EE are separate acceptance gates.

## 1. Security objective

Testagram's Backend is an authenticated, authorized, durable message-delivery service. It is not a plaintext processor and must not possess user messaging private keys. Message plaintext, ratchet state and private identity keys remain on the user's devices.

The phrase **end-to-end encrypted** may be shown only when the shipped client completes the approved cryptographic protocol and device-trust lifecycle, and the Backend accepts only a versioned, authenticated envelope from an enrolled device. A non-empty ciphertext field, a client boolean, HTTPS, database encryption-at-rest, or a scoped call-room token is not proof of E2EE.

This document defines a target contract. It does not assert that the endpoints, protocol library, key ceremony or production service are implemented.

## 2. Trust boundaries across the seven organs

| Organ | E2EE responsibility | Explicit prohibition |
| --- | --- | --- |
| Flutter client | Protocol implementation, private-key generation, device verification, encryption/decryption, secure local state and plaintext rendering | Never send plaintext, private keys or ratchet state to a service |
| Backend | Account/session authorization, conversation membership, device directory, signed-prekey validation, one-time-prekey atomic claim, envelope routing, replay/size/rate controls and revocation | Never generate, escrow, recover, log or decrypt user message keys |
| Data Centre | Durable encrypted-object storage, backups, delivery mechanics and operational monitoring | Never receive message keys or plaintext; backup restores ciphertext only |
| CDN | Deliver opaque encrypted attachment bytes under Backend-issued authorization | Never infer privacy from a URL flag or transform/decrypt private E2EE media |
| Notifications | Generic event delivery such as “New message”; deep-link to the conversation | Never include message body, preview, attachment key, ciphertext, or sensitive sender metadata |
| Federation | Separate future trust domain with explicit cross-instance key discovery and protocol interoperability | Never silently downgrade local E2EE or forward private keys |
| Algorithm | No access to private conversation contents; only explicitly public/consented signals | Never ingest private plaintext or encrypted payloads as ranking features |
| API control plane | Versioned schemas, fixtures, compatibility and source-pin gates | Never enter runtime message delivery or store runtime secrets |

The API repository remains build-time governance only. Flutter calls the public Backend; it never calls private organs directly.

## 3. Protocol selection gate

Use a maintained, independently reviewed implementation of the Signal Protocol family rather than inventing a cipher, handshake, ratchet, signature scheme, or group protocol.

Required one-to-one properties:
- asynchronous authenticated session establishment using signed prekeys and one-time prekeys;
- Double Ratchet message keys with forward secrecy and post-compromise recovery;
- identity-key binding and signed-prekey verification;
- replay rejection, bounded skipped-message keys and out-of-order delivery;
- authenticated associated data binding protocol version, conversation, sender device, recipient device, message ID and epoch;
- serialized, durable session-state transitions: persist the next state before releasing/sending ciphertext, and commit receive state only after plaintext is durably accepted locally;
- safe simultaneous session starts, retries, duplicate delivery and crash recovery.

### Dependency assessment — no package is approved by this document

The Flutter client currently declares Dart SDK compatibility from 3.5.0 and has no Signal Protocol dependency.

The Dart `libsignal` wrapper currently documents Dart 3.10 / Flutter 3.38+ minimums, native FFI and web support through dart2js, with dart2wasm explicitly unsupported in its current documentation. It wraps the official Rust implementation but is a third-party binding, not a Signal-maintained Dart client. Its publisher is marked unverified on pub.dev, its package is AGPL-3.0 (with a limited app-store exception that does not automatically extend to the bundled upstream Signal binaries), and its build hooks download precompiled native/WASM artifacts from GitHub releases with SHA-256 checks. These are material licensing, supply-chain, toolchain and deployment risks. Its documentation also warns that message deserialization checks structure but does not authenticate messages, and that production stores must provide durable, serialized persistence; in-memory stores are testing-only. It documents no built-in message backup/restore or Secure Value Recovery. Legal review, source/provenance review, release checksum pinning, Flutter/Dart compatibility testing, web build-mode verification and a durable storage implementation are mandatory before adoption.

The pure-Dart `double_ratchet` package is explicitly published by an unverified uploader, states that it has not had an independent audit, uses its own wire format, and does not provide Sesame multi-device management or PQXDH in the documented version. It is not approved as the production protocol implementation.

The older `libsignal_protocol_dart` option also requires a separate maintenance, provenance, algorithm, license and compatibility review. The upstream Signal repository currently documents Java, Swift and TypeScript library interfaces; a Dart wrapper is a separate supply-chain and maintenance boundary. Do not select a package solely because it compiles.

**Decision gate:** produce a reproducible dependency review covering source repository, publisher/provenance, release signatures/checksums, upstream Signal version, security advisories, supported Dart/Flutter versions, Android ABI/build hooks, web/WASM behavior, storage APIs, test vectors and independent review. If the official protocol implementation cannot support both Android and the required web client safely, do not ship a weaker home-grown fallback; keep secure composition disabled until a supported implementation exists.

## 4. Device identity and key lifecycle

Each account may own multiple independently revocable devices. A device record has a random opaque device ID, platform/client version, creation and last-seen timestamps, public identity key, key version and revocation state. Device labels are user-facing metadata, not identity proof.

### Enrollment
1. Require an authenticated, active Testagram session and explicit user action on the device.
2. Generate identity and prekey private material locally using the approved library and cryptographic RNG.
3. Keep private identity, signed-prekey, one-time-prekey and ratchet material in platform-protected storage; never upload private values.
4. Register the public identity key using a proof-of-possession challenge signed by the new device.
5. Upload a signed prekey and a bounded batch of one-time prekeys. The Backend verifies the signature against the registered identity key and enforces unique IDs, key lengths, suite/version and quotas.
6. A new device must be verified by an already trusted device using a QR/short-authentication-string ceremony, or by an explicit high-friction account recovery ceremony. Email/password login alone must not silently add a trusted device.
7. Record the identity fingerprint and notify existing devices about new enrollment.

### Session establishment and message delivery
1. Sender fetches one authenticated prekey bundle per recipient device.
2. Backend claims one-time prekeys atomically and exactly once; if none remain, a valid signed-prekey-only bundle may be returned only according to the approved protocol's rules.
3. Sender verifies the recipient identity against its pinned identity and user-visible verification state.
4. Sender creates/advances the protocol session and encrypts locally.
5. The client submits a versioned envelope with conversation ID, sender device ID, recipient device targets, message ID, protocol header, ciphertext and authenticated metadata. No plaintext field is accepted.
6. Backend independently verifies account/session state, device registration, conversation membership, envelope bounds, signature/proof and replay/idempotency constraints. Backend cannot prove the client encrypted honest plaintext; the security claim depends on the reviewed client implementation and verified device identity.
7. Recipient decrypts locally. Decryption failure, invalid authentication tag, unknown identity, unsupported version or downgrade attempt fails closed and never renders raw payload bytes.

### Revocation, rotation and recovery
- Device removal is immediate for future bundle fetches and message delivery. Publish revocation to all active devices and invalidate cached bundles.
- Identity-key change is a security event. Never silently replace a pinned key; require re-verification and warn/block messaging according to policy.
- Rotate signed prekeys on a defined schedule and replenish one-time prekeys with low-water alerts.
- Password reset, email verification or staff action must never decrypt old messages or recreate missing private keys.
- New-device transfer uses an authenticated encrypted device-to-device ceremony. No server-side plaintext escrow or universal recovery key.
- If every trusted device is lost, old history may be unrecoverable. Explain this clearly before enabling E2EE.

## 5. Server-side API shape — proposed, not live

The following resource boundaries are design targets only; they must not be added to generated SDKs or called by clients until the Backend implementation, route inventory, OpenAPI contract and integration tests land together.

- Device enrollment: challenge, register public identity, list devices, revoke device.
- Prekey publication: publish/rotate signed prekey and replenish one-time prekeys.
- Prekey retrieval: fetch recipient device bundles with atomic one-time-prekey consumption.
- Encrypted message send/list: accept only the approved versioned envelope; reject legacy plaintext and unknown protocol versions for E2EE conversations.
- Device verification: exchange and confirm safety-number/QR fingerprints; publish key-change events.
- Capability discovery: expose supported protocol version and server policy without claiming that a client is secure merely because it reports a version.

Every mutating request requires authenticated Testagram session, live account/session check, active conversation membership, device ownership proof, request-size limits, rate limits, idempotency and audit metadata that contains no secrets. Do not expose private internal service URLs or service credentials to Flutter.

## 6. Data and metadata rules

- Message body is absent/empty for E2EE rows. Store ciphertext, nonce/header and bounded protocol metadata only.
- Bind all relevant routing metadata into authenticated associated data; server-side routing fields remain independently authorized.
- Never include ciphertext, plaintext, attachment keys, private keys, tokens, signed URLs or ratchet state in logs, analytics, crash reports, notification payloads or support tooling.
- Keep sender/recipient IDs, device IDs, timestamps, IP/network metadata, conversation membership and message sizes classified as visible metadata. E2EE does not hide these by default.
- Notification previews are disabled for E2EE conversations unless a separately reviewed local-only notification path is implemented.
- Reactions, edits, replies, disappearing-message controls and read receipts must be specified as authenticated encrypted control messages or explicitly identified server-visible metadata. Do not silently leak message text through those side channels.
- Public posts remain ordinary product content; do not accidentally apply private-chat encryption semantics to public feed content.

## 7. Attachments and calls

### Attachments
- Generate a fresh random content-encryption key and nonce locally for each attachment.
- Encrypt before upload using the approved authenticated-encryption scheme; distribute the attachment key only inside the encrypted message.
- Upload opaque ciphertext through Backend-authorized storage flow. CDN/Data Centre may store and replicate bytes but must not receive keys.
- Hash and verify ciphertext integrity across replicas. Decrypt and generate previews/thumbnails only on recipient devices.
- Revocation, deletion, cache expiry, range requests and download authorization must work without exposing the key.

### Voice/video
Signaling encryption, HTTPS, DTLS-SRTP transport encryption and room authorization are not equivalent to end-to-end media encryption when an SFU or server can access media keys.
A call may be labelled E2EE only after frame-level media encryption is integrated, media keys are exchanged through verified device sessions, membership changes rotate keys, and Android/web/SFU interoperability tests prove the SFU cannot decrypt frames. Until then, call media E2EE stays disabled.

## 8. Group and federation boundaries

One-to-one sessions are the first release. Group conversations require a separately reviewed group protocol (for example, a maintained Sender Keys or MLS implementation), authenticated membership epochs, removal/rekey semantics, concurrent membership changes, replay protection and multi-device fanout. Do not reuse one-to-one encryption by inventing shared static group keys.

Cross-instance federation is a separate security domain. E2EE across remote servers requires interoperable device identity, prekey discovery, trust and revocation semantics across instances. Until that exists, do not claim federated messages are E2EE and do not downgrade local encrypted conversations when a remote participant is added.

## 9. Mandatory acceptance gates

### Cryptographic correctness
- Published upstream test vectors and negative vectors pass unchanged.
- Wrong key, modified ciphertext/header/AAD, invalid signature, replay, duplicate and downgrade all fail closed.
- Out-of-order, dropped, retried and concurrently delivered messages behave as specified.
- Simultaneous session establishment converges safely.
- Ratchet state survives process death and is not advanced twice after retry.
- Old message keys are discarded according to bounded protocol limits; post-compromise recovery is demonstrated.

### Device and account security
- Device enrollment requires proof of possession and existing-device/recovery verification.
- Revoked devices cannot fetch new prekeys or receive new messages.
- Key replacement triggers a visible security warning and re-verification.
- Refresh-token rotation/revocation, account suspension and device revocation are enforced at every relevant route.
- Database, backup, logs, analytics, support exports and notification queues contain no private key material or plaintext.

### Product integration
- Android and web clients pass the same cross-platform test vectors.
- Login on a new device, offline recipient, multiple devices, reinstall, backup/restore and lost-device journeys are tested.
- Message list, realtime events, notifications, attachment uploads, CDN delivery and deletion preserve ciphertext-only handling.
- Public feed, search, ranking, moderation and federation do not ingest private plaintext.
- Security review and an independent penetration/cryptographic audit pass before any E2EE production claim.

## 10. Current fail-closed release state

Until all gates above pass:
- secure message composition and sending remain disabled;
- Backend encrypted send/edit capabilities return `503 E2EE_NOT_READY`;
- message rows and call sessions must not claim E2EE;
- clients never render plaintext legacy bodies or raw ciphertext;
- calls remain explicitly not E2EE;
- group messaging, encrypted attachments and federated E2EE remain unavailable.

This is an intentional safety state, not a completed E2EE implementation. The release gate may be removed only by a reviewed, tested and deployed end-to-end implementation across Flutter and Backend, with matching contracts and verified runtime acceptance.
