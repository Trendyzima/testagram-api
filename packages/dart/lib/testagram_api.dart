import 'dart:convert';

import 'package:http/http.dart' as http;

/// Resolves the current Appwrite session JWT. Return null only for public
/// operations; authenticated calls fail closed when no token is available.
typedef TestagramTokenProvider = Future<String?> Function();

class TestagramApiException implements Exception {
  const TestagramApiException({
    required this.message,
    required this.statusCode,
    this.code,
    this.requestId,
    this.body,
  });

  final String message;
  final int statusCode;
  final String? code;
  final String? requestId;
  final Object? body;

  @override
  String toString() => message;
}

class TestagramApiClient {
  TestagramApiClient({
    required Uri baseUri,
    required TestagramTokenProvider tokenProvider,
    http.Client? httpClient,
  })  : _baseUri = _validateBaseUri(baseUri),
        _tokenProvider = tokenProvider,
        _http = httpClient ?? http.Client();

  final Uri _baseUri;
  final TestagramTokenProvider _tokenProvider;
  final http.Client _http;

  static Uri _validateBaseUri(Uri uri) {
    if (!uri.isAbsolute ||
        (uri.scheme != 'https' && uri.scheme != 'http') ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment) {
      throw ArgumentError.value(uri, 'baseUri', 'Use an absolute HTTP(S) API origin.');
    }
    return uri.replace(path: uri.path.replaceFirst(RegExp(r'/+$'), ''));
  }

  Uri _resolve(String path, [Map<String, String>? query]) {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw ArgumentError.value(path, 'path', 'API path must be origin-relative.');
    }
    return _baseUri.replace(
      path: '${_baseUri.path}${path}',
      queryParameters: query,
    );
  }

  Future<Map<String, dynamic>> request(
    String method,
    String path, {
    Map<String, String>? query,
    Object? body,
    Map<String, String>? headers,
    bool authenticated = true,
  }) async {
    final requestHeaders = <String, String>{
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
      ...?headers,
    };
    if (authenticated) {
      final token = await _tokenProvider();
      if (token == null || token.trim().isEmpty) {
        throw StateError('An Appwrite session JWT is required.');
      }
      requestHeaders['Authorization'] = 'Bearer $token';
    }

    final request = http.Request(method, _resolve(path, query))
      ..headers.addAll(requestHeaders);
    if (body != null) request.body = jsonEncode(body);

    final streamed = await _http.send(request);
    final response = await http.Response.fromStream(streamed);
    final requestId = response.headers['x-request-id'];
    Object? decoded;
    if (response.body.isNotEmpty) {
      try {
        decoded = jsonDecode(response.body);
      } on FormatException {
        decoded = response.body;
      }
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final root = decoded is Map ? decoded : const <String, dynamic>{};
      final error = root['error'];
      final nested = error is Map ? error : const <String, dynamic>{};
      throw TestagramApiException(
        message: (nested['message'] ?? root['message'] ?? 'Testagram API request failed.')
            .toString(),
        statusCode: response.statusCode,
        code: nested['code']?.toString(),
        requestId: requestId ?? root['request_id']?.toString(),
        body: decoded,
      );
    }
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded == null) return <String, dynamic>{};
    throw const FormatException('Expected a JSON object from Testagram Backend.');
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? query,
    bool authenticated = true,
  }) =>
      request('GET', path, query: query, authenticated: authenticated);

  Future<Map<String, dynamic>> post(
    String path, {
    Object? body,
    Map<String, String>? headers,
  }) =>
      request('POST', path, body: body, headers: headers);

  Future<Map<String, dynamic>> delete(String path) => request('DELETE', path);

  Future<Map<String, dynamic>> createPost({
    required String content,
    required String visibility,
    required String idempotencyKey,
  }) {
    if (idempotencyKey.length < 8 || idempotencyKey.length > 128 ||
        !RegExp(r'^[A-Za-z0-9._:-]+$').hasMatch(idempotencyKey)) {
      throw ArgumentError.value(idempotencyKey, 'idempotencyKey', 'Use 8-128 safe characters.');
    }
    return post(
      '/api/social/posts',
      body: {'content': content, 'visibility': visibility},
      headers: {'Idempotency-Key': idempotencyKey},
    );
  }

  void close() => _http.close();
}
