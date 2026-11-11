# Dart / Flutter API transport

The Flutter repository remains the canonical application and should own the production API integration. This folder documents a minimal transport contract and may be copied/adapted there after review; it is not a second Flutter app or a generated SDK yet.

## Required behavior

- Use Appwrite Client SDK for login/session.
- Inject the current Appwrite session JWT for each authenticated Backend request.
- Keep API origin configurable through `--dart-define=TESTAGRAM_API_URL=...`.
- Never ship private service tokens or call PostgreSQL, Data Centre private endpoints, Federation or Algorithm directly.
- Preserve HTTP status and distinguish loading, empty, unavailable and forbidden states.
- Do not fabricate empty results or success for unimplemented features.

See `example_client.dart` for a dependency-light starting point. Adapt it to the Flutter repo's existing HTTP package and error model rather than introducing a second networking stack.
