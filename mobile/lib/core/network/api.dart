import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final String message;
  final int status;
  ApiException(this.message, this.status);
  @override
  String toString() => message;
}

class ClyraApi extends ChangeNotifier {
  ClyraApi({String? baseUrl, http.Client? client, FlutterSecureStorage? storage})
      : base = baseUrl ?? const String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:4000/api/v1'),
        _client = client ?? http.Client(),
        _storage = storage ?? const FlutterSecureStorage();
  final String base;
  final http.Client _client;
  final FlutterSecureStorage _storage;
  Future<void>? _refreshing;
  int _sessionVersion = 0;
  String? accessToken;
  Map<String, dynamic>? currentUser;

  Future<void> restore() async {
    if (await _storage.read(key: 'clyra_refresh') == null) return;
    await _refresh();
  }

  Future<void> _applySession(dynamic data) async {
    if (data is! Map || data['user'] is! Map || data['accessToken'] is! String) {
      throw ApiException('Unexpected session response. Please try again.', 502);
    }
    if (data['refreshToken'] != null) {
      await _storage.write(key: 'clyra_refresh', value: data['refreshToken'] as String);
    }
    accessToken = data['accessToken'] as String;
    currentUser = Map<String, dynamic>.from(data['user'] as Map);
    notifyListeners();
  }

  Future<void> _refresh() => _refreshing ??= _rotate().whenComplete(() => _refreshing = null);

  Future<void> _rotate() async {
    final version = _sessionVersion;
    final token = await _storage.read(key: 'clyra_refresh');
    if (token == null) {
      await logout(localOnly: true);
      throw ApiException('Your session has expired. Please sign in again.', 401);
    }
    try {
      final data = await post('/auth/refresh', {'refreshToken': token}, retry: false, headers: {'X-Client': 'mobile'});
      if (version != _sessionVersion) throw ApiException('Session ended. Please sign in again.', 401);
      await _applySession(data);
    } on ApiException catch (e) {
      // Offline servers must not destroy a valid saved session.
      if ((e.status == 401 || e.status == 403) && version == _sessionVersion) await logout(localOnly: true);
      rethrow;
    }
  }

  Future<void> login(String email, String password) async {
    final data = await post('/auth/login', {'email': email, 'password': password}, retry: false, headers: {'X-Client': 'mobile'});
    _sessionVersion++;
    await _applySession(data);
  }

  Future<void> logout({bool localOnly = false}) async {
    _sessionVersion++;
    final refresh = await _storage.read(key: 'clyra_refresh');
    accessToken = null;
    currentUser = null;
    await _storage.delete(key: 'clyra_refresh');
    notifyListeners();
    if (!localOnly) {
      try { await post('/auth/logout', {'refreshToken': refresh}, retry: false); } catch (_) { /* Local sign-out is always available. */ }
    }
  }

  Future<void> updateProfile(Map<String, dynamic> fields) async {
    currentUser = Map<String, dynamic>.from(await patch('/users/me', fields) as Map);
    notifyListeners();
  }

  Future<dynamic> get(String path) => _request('GET', path, null);
  Future<Map<String, dynamic>> getPage(String path) async => Map<String, dynamic>.from(await _request('GET', path, null, envelope: true));
  Future<dynamic> post(String path, Map<String, dynamic> data, {bool retry = true, Map<String, String> headers = const {}}) => _request('POST', path, data, retry: retry, headers: headers);
  Future<dynamic> patch(String path, Map<String, dynamic> data) => _request('PATCH', path, data);

  Future<http.Response> _send(http.BaseRequest request) async {
    try {
      return await _client.send(request).then(http.Response.fromStream).timeout(const Duration(seconds: 20));
    } catch (_) {
      throw ApiException('Unable to reach campus server. Check your connection and try again.', 0);
    }
  }

  Map<String, dynamic> _decode(http.Response response) {
    dynamic decoded;
    try { decoded = jsonDecode(response.body); } catch (_) { throw ApiException('Unexpected server response. Please try again.', response.statusCode); }
    if (decoded is! Map<String, dynamic>) throw ApiException('Unexpected server response.', response.statusCode);
    if (response.statusCode >= 400 || decoded['success'] != true) throw ApiException(decoded['message']?.toString() ?? 'Request failed', response.statusCode);
    return decoded;
  }

  Future<bool> _renewIfNeeded(int status, String? attemptedToken, bool retry) async {
    if (status != 401 || !retry) return false;
    // Concurrent expired requests share one rotation, including late responses.
    if (attemptedToken == accessToken) await _refresh();
    return true;
  }

  Future<dynamic> _request(String method, String path, Map<String, dynamic>? body, {bool retry = true, bool envelope = false, Map<String, String> headers = const {}}) async {
    final attemptedToken = accessToken;
    final request = http.Request(method, Uri.parse('$base$path'))
      ..headers.addAll({'Content-Type': 'application/json', if (attemptedToken != null) 'Authorization': 'Bearer $attemptedToken', ...headers});
    if (body != null) request.body = jsonEncode(body);
    final response = await _send(request);
    if (await _renewIfNeeded(response.statusCode, attemptedToken, retry)) {
      return _request(method, path, body, retry: false, envelope: envelope, headers: headers);
    }
    if (response.statusCode == 401 && !retry && !path.startsWith('/auth/')) await logout(localOnly: true);
    final decoded = _decode(response);
    return envelope ? decoded : decoded['data'];
  }

  Future<Map<String, dynamic>> uploadImage(File file, {required String complaintId, required String resourceType, bool retry = true}) async {
    final attemptedToken = accessToken;
    final request = http.MultipartRequest('POST', Uri.parse('$base/media/upload'));
    if (attemptedToken != null) request.headers['Authorization'] = 'Bearer $attemptedToken';
    request.fields.addAll({'complaintId': complaintId, 'resourceType': resourceType});
    request.files.add(await http.MultipartFile.fromPath('file', file.path));
    final response = await _send(request);
    if (await _renewIfNeeded(response.statusCode, attemptedToken, retry)) return uploadImage(file, complaintId: complaintId, resourceType: resourceType, retry: false);
    return Map<String, dynamic>.from(_decode(response)['data'] as Map);
  }

  @override
  void dispose() { _client.close(); super.dispose(); }
}
