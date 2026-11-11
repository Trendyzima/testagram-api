import 'dart:convert';

import 'package:test/test.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;
import 'package:testagram_api/testagram_api.dart';

void main() {
  test('sends Appwrite bearer token and parses nested Backend errors', () async {
    final client = TestagramApiClient(
      baseUri: Uri.parse('https://api.testagram.site'),
      tokenProvider: () async => 'appwrite-jwt',
      httpClient: MockClient((request) async {
        expect(request.headers['authorization'], 'Bearer appwrite-jwt');
        return http.Response(
          jsonEncode({
            'ok': false,
            'data': null,
            'error': {'code': 'AUTH_REQUIRED', 'message': 'Session expired'},
            'request_id': 'ta-test',
          }),
          401,
          headers: {'x-request-id': 'ta-test'},
        );
      }),
    );
    await expectLater(
      client.get('/api/feed/home'),
      throwsA(isA<TestagramApiException>()
          .having((e) => e.statusCode, 'statusCode', 401)
          .having((e) => e.code, 'code', 'AUTH_REQUIRED')
          .having((e) => e.message, 'message', 'Session expired')
          .having((e) => e.requestId, 'requestId', 'ta-test')),
    );
    client.close();
  });

  test('main-feed post uses the idempotency header', () async {
    final client = TestagramApiClient(
      baseUri: Uri.parse('https://api.testagram.site'),
      tokenProvider: () async => 'jwt',
      httpClient: MockClient((request) async {
        expect(request.url.path, '/api/social/posts');
        expect(request.headers['idempotency-key'], 'post-key-0001');
        expect(jsonDecode(request.body), {
          'content': 'Hello Testagram',
          'visibility': 'public',
        });
        return http.Response('{"ok":true,"data":{"id":"post-1"}}', 201);
      }),
    );
    final result = await client.createPost(
      content: 'Hello Testagram',
      visibility: 'public',
      idempotencyKey: 'post-key-0001',
    );
    expect((result['data'] as Map)['id'], 'post-1');
    client.close();
  });

  test('rejects origin-relative escape paths', () async {
    final client = TestagramApiClient(
      baseUri: Uri.parse('https://api.testagram.site'),
      tokenProvider: () async => 'jwt',
      httpClient: MockClient((_) async => http.Response('{}', 200)),
    );
    expect(() => client.get('//attacker.example/path'), throwsArgumentError);
    client.close();
  });
}
