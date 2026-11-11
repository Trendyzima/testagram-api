import 'dart:convert';
import 'package:http/http.dart' as http;

/// Minimal reference only. Production Flutter wiring should use the
/// existing client transport and Appwrite session lifecycle in the app repo.
class TestagramApiTransport {
  TestagramApiTransport({
    required this.baseUrl,
    required this.accessToken,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final String baseUrl;
  final Future<String?> Function() accessToken;
  final http.Client _client;

  Future<http.Response> get(String path, {bool authenticated = true}) async {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw ArgumentError('API path must be origin-relative');
    }
    final headers = <String, String>{'Accept': 'application/json'};
    if (authenticated) {
      final token = await accessToken();
      if (token == null || token.isEmpty) {
        throw StateError('Appwrite session JWT is required');
      }
      headers['Authorization'] = 'Bearer $token';
    }
    return _client.get(Uri.parse('${baseUrl.replaceFirst(RegExp(r'/+$'), '')}$path'),
        headers: headers);
  }

  void close() => _client.close();
}
