import 'package:flutter/material.dart';
import '../../core/network/api.dart';
import '../../core/widgets/async_state.dart';
import '../complaints/complaint_screens.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, required this.api});
  final ClyraApi api;
  @override State<NotificationsScreen> createState() => _NotificationsScreenState();
}
class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<dynamic> future;
  bool busy = false;
  int page = 1;
  @override void initState() { super.initState(); reload(); }
  void reload() {
    final next = widget.api.getPage('/notifications?limit=20&page=$page');
    setState(() { future = next; });
  }
  Future<void> markRead([Map? item]) async {
    setState(() => busy = true);
    try {
      await widget.api.patch(item == null ? '/notifications/read-all' : '/notifications/${item['_id']}/read', {});
      if (!mounted) return;
      reload();
      if (item?['complaintId'] != null) {
        await Navigator.push(context, MaterialPageRoute(builder: (_) => ComplaintDetail(api: widget.api, complaintId: item!['complaintId'].toString())));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally { if (mounted) setState(() => busy = false); }
  }
  @override Widget build(BuildContext context) => FutureBuilder<dynamic>(future: future, builder: (context, snapshot) {
    if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snapshot.hasError) return Center(child: AsyncMessage(title: 'Cannot load updates', message: snapshot.error.toString(), retry: reload, icon: Icons.wifi_off_outlined));
    final data = snapshot.data as Map;
    final notifications = data['data'] as List;
    final total = (data['meta'] as Map?)?['total'] as num? ?? 0;
    return RefreshIndicator(onRefresh: () async { reload(); try { await future; } catch (_) {} }, child: ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(18), children: [
      Text('Campus updates', style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height: 6), const Text('Your complaint progress and campus announcements.'),
      Align(alignment: Alignment.centerRight, child: TextButton.icon(onPressed: busy || notifications.isEmpty ? null : () => markRead(), icon: const Icon(Icons.done_all), label: const Text('Mark all read'))),
      if (notifications.isEmpty) const AsyncMessage(title: 'No notifications yet', message: 'Updates will appear as your campus team reviews and resolves issues.', icon: Icons.notifications_none),
      for (final item in notifications) Card(
        color: item['isRead'] == true ? null : Theme.of(context).colorScheme.primaryContainer.withOpacity(0.35),
        child: ListTile(contentPadding: const EdgeInsets.all(16),
          leading: Icon(item['isRead'] == true ? Icons.notifications_none : Icons.notifications_active_outlined, color: Theme.of(context).colorScheme.primary),
          title: Text(item['title']?.toString() ?? 'Campus update', style: TextStyle(fontWeight: item['isRead'] == true ? FontWeight.w500 : FontWeight.bold)),
          subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 6), Text(item['message']?.toString() ?? ''),
            const SizedBox(height: 8), Text(displayDate(item['createdAt']), style: Theme.of(context).textTheme.bodySmall),
          ]),
          trailing: item['complaintId'] != null ? const Icon(Icons.chevron_right) : null,
          onTap: busy ? null : () => markRead(item as Map),
        )),
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        TextButton(onPressed: page > 1 ? () { page--; reload(); } : null, child: const Text('Previous')),
        Text('Page $page'),
        TextButton(onPressed: page * 20 < total ? () { page++; reload(); } : null, child: const Text('Next')),
      ]),
    ]));
  });
}
