import 'package:flutter/material.dart';
import 'core/network/api.dart';
import 'core/theme/app_theme.dart';
import 'core/widgets/async_state.dart';
import 'features/auth/login_screen.dart';
import 'features/complaints/complaint_screens.dart';
import 'features/tasks/tasks_screen.dart';
import 'features/notifications/notifications_screen.dart';
import 'features/profile/profile_screen.dart';

void main() { WidgetsFlutterBinding.ensureInitialized(); runApp(const ClyraApp()); }
class ClyraApp extends StatefulWidget {
  const ClyraApp({super.key, this.api});
  final ClyraApi? api;
  @override State<ClyraApp> createState() => _ClyraAppState();
}
class _ClyraAppState extends State<ClyraApp> {
  late final ClyraApi api;
  bool ready = false;
  String? restoreError;
  @override void initState() { super.initState(); api = widget.api ?? ClyraApi(); api.addListener(sessionChanged); restore(); }
  void sessionChanged() { if (mounted) setState(() {}); }
  Future<void> restore() async {
    setState(() { ready = false; restoreError = null; });
    try { await api.restore(); }
    on ApiException catch (e) {
      if (e.status != 401 && e.status != 403) restoreError = e.toString();
    } catch (_) { restoreError = 'Could not read your saved session. Please try again.'; }
    finally { if (mounted) setState(() => ready = true); }
  }
  @override void dispose() { api.removeListener(sessionChanged); if (widget.api == null) api.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => MaterialApp(
    title: 'Clyra', debugShowCheckedModeBanner: false, theme: ClyraTheme.light,
    // Reset navigation too when a session is revoked, including open detail routes.
    key: ValueKey(api.currentUser?['_id']),
    home: !ready ? const Scaffold(body: Center(child: CircularProgressIndicator()))
      : restoreError != null ? Scaffold(body: Center(child: AsyncMessage(title: 'Reconnect to your campus', message: restoreError!, retry: restore, icon: Icons.wifi_off_outlined)))
      : api.currentUser == null ? LoginScreen(api: api, onLogin: sessionChanged)
      : MainShell(api: api, onLogout: () { api.logout(); }),
  );
}
class MainShell extends StatefulWidget {
  const MainShell({super.key, required this.api, required this.onLogout});
  final ClyraApi api;
  final VoidCallback onLogout;
  @override State<MainShell> createState() => _MainShellState();
}
class _MainShellState extends State<MainShell> {
  int index = 0;
  int revision = 0;
  Future<void> openReport() async {
    await Navigator.push(context, MaterialPageRoute(builder: (_) => ReportScreen(api: widget.api)));
    if (mounted) setState(() => revision++);
  }
  @override Widget build(BuildContext context) {
    final staff = widget.api.currentUser?['role'] == 'STAFF';
    final admin = widget.api.currentUser?['role'] == 'ADMIN';
    final tabs = staff ? ['Home', 'Tasks', 'History', 'Profile'] : ['Home', admin ? 'Complaints' : 'My Complaints', 'Notifications', 'Profile'];
    final views = [
      HomeScreen(key: ValueKey('home-$revision'), api: widget.api, staff: staff),
      staff ? TasksScreen(key: ValueKey('tasks-$revision'), api: widget.api, history: false) : ComplaintList(key: ValueKey('complaints-$revision'), api: widget.api),
      staff ? TasksScreen(key: ValueKey('history-$revision'), api: widget.api, history: true) : NotificationsScreen(api: widget.api),
      ProfileScreen(api: widget.api, logout: widget.onLogout),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('clyra.', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: -1)), actions: [
        IconButton(tooltip: 'Notifications', icon: const Icon(Icons.notifications_none), onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => Scaffold(appBar: AppBar(title: const Text('Notifications')), body: NotificationsScreen(api: widget.api))))),
      ]),
      body: views[index],
      floatingActionButton: !staff && index < 2 ? FloatingActionButton.extended(onPressed: openReport, label: const Text('Report issue'), icon: const Icon(Icons.add)) : null,
      bottomNavigationBar: NavigationBar(selectedIndex: index, onDestinationSelected: (value) => setState(() { index = value; revision++; }), destinations: [
        for (var i = 0; i < tabs.length; i++) NavigationDestination(icon: Icon(i == 0 ? Icons.home_outlined : i == 1 ? (staff ? Icons.assignment_outlined : Icons.description_outlined) : i == 2 ? (staff ? Icons.history : Icons.notifications_outlined) : Icons.person_outline), label: tabs[i]),
      ]),
    );
  }
}
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.api, required this.staff});
  final ClyraApi api;
  final bool staff;
  @override State<HomeScreen> createState() => _HomeScreenState();
}
class _HomeScreenState extends State<HomeScreen> {
  late Future<List<dynamic>> future;
  @override void initState() { super.initState(); refresh(); }
  void refresh() {
    final next = Future.wait([
      widget.api.get(widget.staff ? '/assignments?limit=6&section=active' : '/complaints?limit=6'),
      widget.api.get('/complaints/summary'),
      widget.api.get('/announcements?limit=3'),
    ]);
    setState(() { future = next; });
  }
  @override Widget build(BuildContext context) {
    final first = widget.api.currentUser?['fullName']?.toString().split(' ').first ?? 'Campus member';
    return RefreshIndicator(onRefresh: () async { refresh(); try { await future; } catch (_) {} }, child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(18), children: [
      Container(padding: const EdgeInsets.all(24), decoration: BoxDecoration(gradient: const LinearGradient(colors: [ClyraTheme.navy, ClyraTheme.indigo]), borderRadius: BorderRadius.circular(20)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('YOUR CAMPUS, CONNECTED', style: TextStyle(color: ClyraTheme.teal, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1)),
        const SizedBox(height: 12), Text('Hello, $first', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white)),
        const SizedBox(height: 8), Text(widget.staff ? 'Keep campus moving. Your next task starts here.' : 'Every issue has a clear path to resolution.', style: const TextStyle(color: Colors.white70)),
      ])),
      const SizedBox(height: 20),
      if (widget.api.currentUser?['role'] == 'ADMIN') const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('Administrator workspace: review and assign complaints in the web dashboard. Mobile provides reporting and campus updates.'))),
      FutureBuilder<List<dynamic>>(future: future, builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()));
        if (snapshot.hasError) return AsyncMessage(title: 'Cannot load your workspace', message: snapshot.error.toString(), retry: refresh);
        final records = snapshot.data![0] as List;
        final summary = snapshot.data![1] as Map;
        final announcements = snapshot.data![2] as List;
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            for (final field in ['total', 'active', 'resolved']) Expanded(child: Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(children: [Text('${summary[field] ?? 0}', style: Theme.of(context).textTheme.headlineSmall), Text(displayLabel(field))])))),
          ]),
          const SizedBox(height: 24), Text(widget.staff ? 'Recent active tasks' : 'Recent complaints', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          if (records.isEmpty) const AsyncMessage(title: 'Nothing here yet', message: 'Your campus activity will appear here.'),
          for (final item in records) Builder(builder: (context) {
            final complaint = widget.staff ? item['complaint'] as Map? ?? {} : item as Map;
            return Card(child: ListTile(
              title: Text(complaint['title']?.toString() ?? 'Campus task'),
              subtitle: Text('${complaint['complaintCode'] ?? ''}\n${displayLabel(complaint['status'])}'),
              isThreeLine: true, trailing: const Icon(Icons.chevron_right),
              onTap: () async {
                await Navigator.push(context, MaterialPageRoute(builder: (_) => ComplaintDetail(api: widget.api, complaintId: (widget.staff ? item['complaintId'] : item['_id']).toString())));
                if (mounted) refresh();
              },
            ));
          }),
          const SizedBox(height: 24), Text('Campus announcements', style: Theme.of(context).textTheme.titleLarge), const SizedBox(height: 12),
          if (announcements.isEmpty) const Card(child: Padding(padding: EdgeInsets.all(18), child: Text('No campus announcements right now.'))),
          for (final item in announcements) Card(child: Padding(padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(item['title']?.toString() ?? '', style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 8),
            Text(item['description']?.toString() ?? ''), const SizedBox(height: 8),
            Text(displayDate(item['publishAt']), style: Theme.of(context).textTheme.bodySmall),
          ]))),
          const SizedBox(height: 88),
        ]);
      }),
    ]));
  }
}
