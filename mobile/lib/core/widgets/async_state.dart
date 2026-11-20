import 'package:flutter/material.dart';

String displayLabel(dynamic value) => (value ?? '').toString().split('_').map((word) => word.isEmpty ? '' : '${word[0]}${word.substring(1).toLowerCase()}').join(' ');
String displayDate(dynamic value) {
  final date = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
  if (date == null) return '';
  return '${date.day}/${date.month}/${date.year} · ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
}

class AsyncMessage extends StatelessWidget {
  const AsyncMessage({super.key, required this.title, required this.message, this.retry, this.icon = Icons.inbox_outlined});
  final String title, message;
  final VoidCallback? retry;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.all(28), child: Column(mainAxisSize: MainAxisSize.min, children: [
    Icon(icon, size: 44, color: Theme.of(context).colorScheme.primary), const SizedBox(height: 16),
    Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge), const SizedBox(height: 8),
    Text(message, textAlign: TextAlign.center),
    if (retry != null) Padding(padding: const EdgeInsets.only(top: 16), child: OutlinedButton.icon(onPressed: retry, icon: const Icon(Icons.refresh), label: const Text('Try again'))),
  ]));
}
