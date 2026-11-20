import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:clyra/core/network/api.dart';

http.Response reply(dynamic data, {int status = 200}) => http.Response(
  jsonEncode({'success': status == 200, 'data': data, 'message': 'Session expired'}), status,
  headers: {'content-type': 'application/json'},
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({'clyra_refresh': 'test-refresh-only'}));

  test('parallel unauthorized requests share one refresh and retry', () async {
    var rotations = 0;
    final api = ClyraApi(client: MockClient((request) async {
      if (request.url.path.endsWith('/auth/refresh')) {
        rotations++;
        expect(request.headers['X-Client'], 'mobile');
        await Future<void>.delayed(const Duration(milliseconds: 10));
        return reply({'accessToken': 'fresh-test-token', 'refreshToken': 'new-test-refresh', 'user': {'_id': 'test-user', 'role': 'STUDENT'}});
      }
      return request.headers['Authorization'] == 'Bearer fresh-test-token'
          ? reply([]) : reply(null, status: 401);
    }))..accessToken = 'expired-test-token';
    addTearDown(api.dispose);
    final responses = await Future.wait([api.get('/complaints'), api.get('/notifications')]);
    expect(responses, [[], []]);
    expect(rotations, 1);
    expect(await const FlutterSecureStorage().read(key: 'clyra_refresh'), 'new-test-refresh');
  });

  test('offline restore preserves saved session for retry', () async {
    final api = ClyraApi(client: MockClient((_) async => throw http.ClientException('offline')));
    addTearDown(api.dispose);
    await expectLater(api.restore(), throwsA(isA<ApiException>().having((e) => e.status, 'status', 0)));
    expect(await const FlutterSecureStorage().read(key: 'clyra_refresh'), 'test-refresh-only');
  });

  test('invalid refresh clears stored session', () async {
    final api = ClyraApi(client: MockClient((_) async => reply(null, status: 401)));
    addTearDown(api.dispose);
    await expectLater(api.restore(), throwsA(isA<ApiException>()));
    expect(await const FlutterSecureStorage().read(key: 'clyra_refresh'), isNull);
    expect(api.currentUser, isNull);
  });

  test('logout sends refresh token and clears local state even while offline', () async {
    final api = ClyraApi(client: MockClient((request) async {
      expect(request.url.path, endsWith('/auth/logout'));
      expect(jsonDecode(request.body)['refreshToken'], 'test-refresh-only');
      throw http.ClientException('offline');
    }))..currentUser = {'_id': 'test-user'};
    addTearDown(api.dispose);
    await api.logout();
    expect(api.currentUser, isNull);
    expect(await const FlutterSecureStorage().read(key: 'clyra_refresh'), isNull);
  });
}
