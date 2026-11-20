import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/network/api.dart';
import '../../core/widgets/async_state.dart';
import '../complaints/complaint_screens.dart';

class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key, required this.api, required this.history});
  final ClyraApi api;
  final bool history;
  @override State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  late Future<dynamic> future;
  int page = 1;
  String? busyId;
  @override void initState() { super.initState(); refresh(); }
  void refresh() {
    final next = widget.api.getPage('/assignments?limit=20&page=$page&section=${widget.history ? 'history' : 'active'}');
    setState(() { future = next; });
  }
  Future<void> act(Map task, String action) async {
    if (busyId != null) return;
    setState(() => busyId = task['_id'].toString());
    final reason = TextEditingController();
    final files = <File>[];
    try {
      var textOnly = false;
      var media = true;
      if (action == 'submit-resolution') {
        final capabilities = await widget.api.get('/capabilities') as Map;
        textOnly = capabilities['textOnlyResolution'] == true;
        media = capabilities['mediaUploads'] == true;
      }
      if (!mounted) return;
      if (action == 'hold' || action == 'submit-resolution') {
        final form = GlobalKey<FormState>();
        final confirmed = await showDialog<bool>(context: context, builder: (dialogContext) => StatefulBuilder(builder: (context, update) => AlertDialog(
          title: Text(action == 'hold' ? 'Pause this task' : 'Submit for verification'),
          content: SingleChildScrollView(child: Form(key: form, child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(action == 'hold' ? 'Let the campus team know why work is paused.' : 'Describe the work completed. An administrator must verify the resolution.'),
            const SizedBox(height: 16),
            TextFormField(controller: reason, minLines: 3, maxLines: 6, maxLength: 2000, decoration: InputDecoration(labelText: action == 'hold' ? 'Reason for hold' : 'Completion note'),
              validator: (value) => (value ?? '').trim().length < (action == 'hold' ? 4 : 20) ? 'Enter at least ${action == 'hold' ? 4 : 20} characters.' : null),
            if (action == 'submit-resolution') ...[
              if (textOnly) const Text('Demo mode: a detailed written note is accepted without photos.'),
              if (!media && !textOnly) const Text('Image storage is not configured. Contact the administrator before submitting completion.'),
              if (media) OutlinedButton.icon(onPressed: () async {
                try {
                  final images = await ImagePicker().pickMultiImage(imageQuality: 85);
                  if (context.mounted) update(() => files.addAll(images.take(5 - files.length).map((x) => File(x.path))));
                } catch (e) {
                  if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not open gallery: $e')));
                }
              }, icon: const Icon(Icons.add_photo_alternate_outlined), label: Text('Evidence photos (${files.length}/5)')),
            ],
          ]))),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
            FilledButton(onPressed: () {
              if (!form.currentState!.validate()) return;
              if (action == 'submit-resolution' && files.isEmpty && !textOnly) {
                ScaffoldMessenger.of(dialogContext).showSnackBar(const SnackBar(content: Text('Add an evidence photo before submitting.')));
                return;
              }
              Navigator.pop(dialogContext, true);
            }, child: const Text('Confirm')),
          ],
        )));
        if (confirmed != true) return;
      }
      final id = task['_id'];
      if (action == 'submit-resolution') {
        final urls = <String>[];
        for (final file in files) {
          final image = await widget.api.uploadImage(file, complaintId: task['complaintId'].toString(), resourceType: 'EVIDENCE');
          urls.add(image['url'].toString());
        }
        await widget.api.post('/assignments/$id/submit-resolution', {'evidenceUrls': urls, 'remarks': reason.text.trim()});
      } else {
        await widget.api.post('/assignments/$id/$action', action == 'hold' ? {'reason': reason.text.trim()} : {});
      }
      if (!mounted) return;
      refresh();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(action == 'submit-resolution' ? 'Completion submitted for administrator verification.' : 'Task updated.')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      // The dialog route may still be animating with this controller.
      if (mounted) setState(() => busyId = null);
    }
  }

  @override Widget build(BuildContext context) => FutureBuilder<dynamic>(future: future, builder: (context, snapshot) {
    if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
    if (snapshot.hasError) return Center(child: AsyncMessage(title: 'Tasks are unavailable', message: snapshot.error.toString(), retry: refresh, icon: Icons.wifi_off_outlined));
    final data = snapshot.data as Map;
    final tasks = data['data'] as List;
    final meta = data['meta'] as Map? ?? {};
    return RefreshIndicator(onRefresh: () async { refresh(); try { await future; } catch (_) {} }, child: ListView(
      physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(18), children: [
        Text(widget.history ? 'Work history' : 'Assigned to you', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 6),
        Text(widget.history ? 'Completed and reassigned work, with a preserved timeline.' : 'Accept work, share progress, and submit a resolution for review.'),
        const SizedBox(height: 20),
        if (tasks.isEmpty) AsyncMessage(title: widget.history ? 'No work history yet' : 'You are all caught up', message: widget.history ? 'Completed assignments appear here.' : 'New assignments will appear here. Pull down to refresh.'),
        for (final raw in tasks) Builder(builder: (context) {
          final task = raw as Map;
          final complaint = task['complaint'] as Map? ?? {};
          final state = task['assignmentStatus'];
          return Card(margin: const EdgeInsets.only(bottom: 16), child: Padding(padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(complaint['complaintCode']?.toString() ?? 'Campus task', style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(complaint['title']?.toString() ?? 'Assigned campus issue', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text([complaint['locationName'], task['departmentName']].where((v) => v != null && v.toString().isNotEmpty).join(' · ')),
            Wrap(spacing: 8, children: [Chip(label: Text(displayLabel(state))), if (complaint['priority'] != null) Chip(label: Text('${complaint['priority']} priority'))]),
            if (task['remarks']?.toString().isNotEmpty == true) Text(task['remarks'].toString()),
            Text('Assigned ${displayDate(task['assignedAt'])}', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            TextButton.icon(onPressed: () async {
              await Navigator.push(context, MaterialPageRoute(builder: (_) => ComplaintDetail(api: widget.api, complaintId: task['complaintId'].toString())));
              if (mounted) refresh();
            }, icon: const Icon(Icons.timeline), label: const Text('Complaint & timeline')),
            if (!widget.history) Wrap(spacing: 8, runSpacing: 8, children: [
              if (state == 'PENDING') FilledButton(onPressed: busyId != null ? null : () => act(task, 'accept'), child: const Text('Accept task')),
              if (state == 'ACCEPTED') FilledButton(onPressed: busyId != null ? null : () => act(task, 'start'), child: const Text('Start work')),
              if (state == 'IN_PROGRESS') ...[
                OutlinedButton(onPressed: busyId != null ? null : () => act(task, 'hold'), child: const Text('Put on hold')),
                FilledButton(onPressed: busyId != null ? null : () => act(task, 'submit-resolution'), child: const Text('Submit completion')),
              ],
              if (state == 'ON_HOLD') FilledButton(onPressed: busyId != null ? null : () => act(task, 'resume'), child: const Text('Resume work')),
            ]),
            if (busyId == task['_id']) const Padding(padding: EdgeInsets.only(top: 12), child: LinearProgressIndicator()),
          ])));
        }),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          TextButton(onPressed: page > 1 ? () { page--; refresh(); } : null, child: const Text('Previous')),
          Text('Page $page'),
          TextButton(onPressed: page * 20 < (meta['total'] as num? ?? 0) ? () { page++; refresh(); } : null, child: const Text('Next')),
        ]),
      ],
    ));
  });
}
