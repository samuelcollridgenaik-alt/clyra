import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:clyra/core/network/api.dart';
import 'package:clyra/main.dart';
import 'package:clyra/features/auth/login_screen.dart';
import 'package:clyra/features/complaints/complaint_screens.dart';
import 'package:clyra/features/tasks/tasks_screen.dart';
import 'package:clyra/features/notifications/notifications_screen.dart';

class FakeApi extends ClyraApi {
  int reads = 0;
  Completer<void>? pending;

  @override
  Future<dynamic> get(String path) async {
    reads++;
    final complaint = {'_id': 'complaint-1', 'title': 'Test campus issue',
      'complaintCode': 'TEST-001', 'category': 'Other', 'status': 'SUBMITTED'};
    if (path.startsWith('/complaints/summary')) {
      return {'total': 1, 'active': 1, 'resolved': 0};
    }
    if (path.startsWith('/complaints?')) return [complaint];
    if (path.startsWith('/assignments?')) {
      return [for (final status in ['PENDING', 'COMPLETED']) {
        '_id': 'assignment-000000000001-$status', 'complaintId': 'complaint-1',
        'assignmentStatus': status, 'complaint': complaint,
      }];
    }
    if (path.startsWith('/notifications?')) {
      return [{'_id': 'notification-1', 'title': 'Test update', 'message': 'Changed', 'isRead': false}];
    }
    return [];
  }

  // Also supports the older Desktop client, which has no getPage method.
  // ignore: annotate_overrides
  Future<Map<String, dynamic>> getPage(String path) async =>
      {'data': await get(path), 'meta': {'total': 2}};

  @override
  Future<dynamic> patch(String path, Map<String, dynamic> data) async {
    await pending?.future;
    return {};
  }

  @override
  Future<dynamic> post(String path, Map<String, dynamic> data,
      {bool retry = true, Map<String, String> headers = const {}}) async {
    await pending?.future;
    return {};
  }

  @override
  Future<void> login(String email, String password) async {
    await pending?.future;
  }
}

void main() {
  final screens = <String, Widget Function(FakeApi)>{
    'student home': (api) => HomeScreen(api: api, staff: false),
    'staff home': (api) => HomeScreen(api: api, staff: true),
    'complaints': (api) => ComplaintList(api: api),
    'active tasks': (api) => TasksScreen(api: api, history: false),
    'task history': (api) => TasksScreen(api: api, history: true),
    'notifications': (api) => NotificationsScreen(api: api),
  };
  for (final entry in screens.entries) {
    testWidgets('${entry.key} loads and refreshes without an async setState', (tester) async {
      final api = FakeApi();
      await tester.pumpWidget(MaterialApp(home: Scaffold(body: entry.value(api))));
      expect(tester.takeException(), isNull);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      final indicators = find.byType(RefreshIndicator);
      if (indicators.evaluate().isNotEmpty) {
        final before = api.reads;
        await tester.widget<RefreshIndicator>(indicators).onRefresh();
        await tester.pumpAndSettle();
        expect(api.reads, greaterThan(before));
        expect(tester.takeException(), isNull);
      }
    });
  }

  for (final tasks in [false, true]) {
    testWidgets('${tasks ? 'task' : 'notification'} completion after disposal is safe', (tester) async {
      final api = FakeApi()..pending = Completer<void>();
      await tester.pumpWidget(MaterialApp(home: Scaffold(body: tasks
          ? TasksScreen(api: api, history: false) : NotificationsScreen(api: api))));
      await tester.pumpAndSettle();
      await tester.tap(find.text(tasks ? 'Accept task' : 'Test update'));
      await tester.pumpWidget(const SizedBox.shrink());
      api.pending!.complete();
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('login completion does not call a disposed screen callback', (tester) async {
    final api = FakeApi()..pending = Completer<void>();
    var notified = false;
    await tester.pumpWidget(MaterialApp(home: LoginScreen(api: api, onLogin: () { notified = true; })));
    await tester.enterText(find.byType(TextFormField).at(0), 'test@example.invalid');
    await tester.enterText(find.byType(TextFormField).at(1), 'test-only');
    await tester.ensureVisible(find.text('Sign in to Clyra'));
    await tester.tap(find.text('Sign in to Clyra'));
    await tester.pumpWidget(const SizedBox.shrink());
    api.pending!.complete();
    await tester.pumpAndSettle();
    expect(notified, isFalse);
    expect(tester.takeException(), isNull);
  });
}
