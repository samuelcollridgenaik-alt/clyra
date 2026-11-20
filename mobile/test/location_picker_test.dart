import 'dart:async';
import 'package:clyra/core/network/api.dart';
import 'package:clyra/features/complaints/complaint_screens.dart';
import 'package:clyra/features/complaints/location_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class LocationApi extends ClyraApi {
  final paths = <String>[];
  List<Map<String, dynamic>> locations = [
    for (var index = 0; index < 125; index++)
      {
        '_id': 'room-$index',
        'name': 'Room $index',
        'type': 'ROOM',
        'pathName': 'Campus / D Block / Floor 1 / Room $index',
        'isActive': true,
        'isAvailable': true,
      },
    {
      '_id': 'custom-garden',
      'name': 'Community Garden',
      'type': 'COMMON_AREA',
      'pathName': 'Campus / Community Garden',
      'isActive': true
    },
    {
      '_id': 'unavailable',
      'name': 'Hidden room',
      'type': 'ROOM',
      'pathName': 'Campus / Closed Block / Hidden room',
      'isActive': true,
      'isAvailable': false
    },
  ];
  Object? error;
  Completer<dynamic>? pending;
  Map<String, dynamic>? submitted;

  @override
  Future<dynamic> get(String path) async {
    paths.add(path);
    if (pending != null) return pending!.future;
    if (error != null) throw error!;
    return locations;
  }

  @override
  Future<dynamic> post(String path, Map<String, dynamic> data,
      {bool retry = true, Map<String, String> headers = const {}}) async {
    expect(path, '/complaints');
    submitted = data;
    return {'_id': 'test-complaint'};
  }
}

Widget fieldApp(LocationApi api,
        {ValueChanged<String?>? onChanged, GlobalKey<FormState>? form}) =>
    MaterialApp(
        home: Scaffold(
            body: Form(
                key: form,
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: CampusLocationField(
                      api: api, onChanged: onChanged ?? (_) {}),
                ))));

Future<void> search(WidgetTester tester, String query) async {
  await tester.tap(find.byKey(const Key('campus-location-field')));
  await tester.pumpAndSettle();
  await tester.enterText(
      find.byKey(const Key('campus-location-search')), query);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
      'catalog search selects locations after the first 100 with a full path',
      (tester) async {
    final api = LocationApi();
    String? selected;
    await tester.pumpWidget(fieldApp(api, onChanged: (id) {
      selected = id;
    }));
    await tester.pumpAndSettle();
    expect(api.paths, ['/locations/catalog']);
    await search(tester, 'D Block Room 124');
    expect(find.text('1 of 126 locations'), findsOneWidget);
    expect(find.text('Campus / D Block / Floor 1 / Room 124'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('location-room-124')));
    await tester.pumpAndSettle();
    expect(selected, 'room-124');
    expect(find.text('Campus / D Block / Floor 1 / Room 124'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'manual common areas are selectable and unavailable paths stay hidden',
      (tester) async {
    final api = LocationApi();
    String? selected;
    await tester.pumpWidget(fieldApp(api, onChanged: (id) {
      selected = id;
    }));
    await tester.pumpAndSettle();
    await search(tester, 'Hidden room');
    expect(find.text('No matching locations. Try a block name or room number.'),
        findsOneWidget);
    await tester.enterText(
        find.byKey(const Key('campus-location-search')), 'Garden');
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('location-custom-garden')));
    await tester.pumpAndSettle();
    expect(selected, 'custom-garden');
    expect(find.text('Campus / Community Garden'), findsOneWidget);
  });

  testWidgets('loading and failures support retry without async setState',
      (tester) async {
    final api = LocationApi()..pending = Completer<dynamic>();
    await tester.pumpWidget(fieldApp(api));
    expect(find.text('Loading campus locations…'), findsOneWidget);
    api.pending!.completeError(ApiException('Campus server unavailable', 503));
    await tester.pumpAndSettle();
    expect(find.text('Campus server unavailable'), findsOneWidget);
    api.pending = null;
    await tester.tap(find.text('Retry locations'));
    await tester.pumpAndSettle();
    expect(api.paths.length, 2);
    expect(find.text('Campus server unavailable'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('empty catalog explains setup and requires a selection',
      (tester) async {
    final api = LocationApi()..locations = [];
    final form = GlobalKey<FormState>();
    await tester.pumpWidget(fieldApp(api, form: form));
    await tester.pumpAndSettle();
    expect(
        find.text(
            'No active locations yet. Ask an administrator to add campus locations in Facilities.'),
        findsOneWidget);
    expect(form.currentState!.validate(), isFalse);
    await tester.pump();
    expect(find.text('Choose a campus location'), findsOneWidget);
  });

  testWidgets('catalog completion after disposal does not setState',
      (tester) async {
    final api = LocationApi()..pending = Completer<dynamic>();
    await tester.pumpWidget(fieldApp(api));
    await tester.pumpWidget(const SizedBox.shrink());
    api.pending!.complete(api.locations);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'report submits the selected catalog ID using the existing payload',
      (tester) async {
    final api = LocationApi();
    await tester.pumpWidget(MaterialApp(
        home: Builder(
            builder: (context) => Scaffold(
                  body: TextButton(
                      onPressed: () {
                        Navigator.of(context).push(MaterialPageRoute(
                            builder: (_) => ReportScreen(api: api)));
                      },
                      child: const Text('Report')),
                ))));
    await tester.tap(find.text('Report'));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.byType(TextFormField).at(0), 'Leaking garden tap');
    await tester.enterText(find.byType(TextFormField).at(1),
        'Water is leaking near the garden entrance.');
    await tester.ensureVisible(find.byKey(const Key('campus-location-field')));
    await search(tester, 'Garden');
    await tester.tap(find.byKey(const ValueKey('location-custom-garden')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Submit complaint'));
    await tester.tap(find.text('Submit complaint'));
    await tester.pumpAndSettle();
    expect(api.submitted, {
      'title': 'Leaking garden tap',
      'description': 'Water is leaking near the garden entrance.',
      'locationId': 'custom-garden',
    });
    expect(tester.takeException(), isNull);
  });
}
