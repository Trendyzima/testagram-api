# Testagram Dart API client

This directory is a reusable Dart transport package for Flutter clients. It does not own authentication: pass the current Appwrite session JWT through `tokenProvider`.

## Use from Flutter after the API repository is merged and tagged

```yaml
dependencies:
  testagram_api:
    git:
      url: https://github.com/Trendyzima/testagram-api.git
      ref: v0.1.0
      path: packages/dart
```

Until a release tag exists, do not pin production applications to a moving feature branch. Use a reviewed immutable commit during development.

## Example

```dart
final api = TestagramApiClient(
  baseUri: Uri.parse(const String.fromEnvironment('TESTAGRAM_API_URL')),
  tokenProvider: () async => await appwriteAccount.createJWT().then((jwt) => jwt.jwt),
);

final feed = await api.get('/api/feed/home', query: {
  'limit': '20',
  'following_only': 'false',
});

final post = await api.createPost(
  content: 'Hello Testagram',
  visibility: 'public',
  idempotencyKey: 'composer-session-0001',
);
```

The client parses the Backend's nested `error.code/message` envelope, preserves HTTP status and request IDs, and fails closed when an authenticated call has no JWT. It does not silently retry writes or invent successful responses.

## Validate

```sh
dart pub get
dart format --set-exit-if-changed .
dart analyze
dart test
```
