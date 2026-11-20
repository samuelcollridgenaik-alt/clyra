import 'package:flutter/material.dart';
import '../../core/network/api.dart';
import '../../core/widgets/async_state.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.api, required this.logout});
  final ClyraApi api;
  final VoidCallback logout;
  @override State<ProfileScreen> createState() => _ProfileScreenState();
}
class _ProfileScreenState extends State<ProfileScreen> {
  final form = GlobalKey<FormState>();
  late final TextEditingController name, phone, course, designation;
  bool busy = false;
  String? error;
  @override void initState() {
    super.initState();
    final user = widget.api.currentUser ?? {};
    name = TextEditingController(text: user['fullName']?.toString() ?? '');
    phone = TextEditingController(text: user['phone']?.toString() ?? '');
    course = TextEditingController(text: user['course']?.toString() ?? '');
    designation = TextEditingController(text: user['designation']?.toString() ?? '');
  }
  @override void dispose() { name.dispose(); phone.dispose(); course.dispose(); designation.dispose(); super.dispose(); }
  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    setState(() { busy = true; error = null; });
    try {
      await widget.api.updateProfile({'fullName': name.text.trim(), 'phone': phone.text.trim(), 'course': course.text.trim(), 'designation': designation.text.trim()});
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile saved.')));
    } catch (e) { if (mounted) setState(() => error = e.toString()); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override Widget build(BuildContext context) {
    final user = widget.api.currentUser ?? {};
    return Form(key: form, child: ListView(padding: const EdgeInsets.all(22), children: [
      CircleAvatar(radius: 36, child: Text((user['fullName']?.toString() ?? 'C').substring(0, 1).toUpperCase(), style: const TextStyle(fontSize: 28))),
      const SizedBox(height: 16),
      Text(user['fullName']?.toString() ?? 'Campus member', style: Theme.of(context).textTheme.headlineSmall, textAlign: TextAlign.center),
      Text(user['email']?.toString() ?? '', textAlign: TextAlign.center),
      const SizedBox(height: 8), Center(child: Chip(label: Text(displayLabel(user['role'])))),
      const SizedBox(height: 24), Text('Personal information', style: Theme.of(context).textTheme.titleLarge), const SizedBox(height: 16),
      TextFormField(controller: name, maxLength: 120, decoration: const InputDecoration(labelText: 'Full name'), validator: (v) => (v ?? '').trim().length < 2 ? 'Enter your full name' : null),
      const SizedBox(height: 12), TextFormField(controller: phone, maxLength: 30, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone (optional)')),
      const SizedBox(height: 12), TextFormField(controller: course, maxLength: 120, decoration: const InputDecoration(labelText: 'Course (optional)')),
      const SizedBox(height: 12), TextFormField(controller: designation, maxLength: 120, decoration: const InputDecoration(labelText: 'Designation (optional)')),
      if (error != null) Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
      FilledButton(onPressed: busy ? null : save, child: Text(busy ? 'Saving…' : 'Save profile')),
      const SizedBox(height: 16),
      const Card(child: ListTile(leading: Icon(Icons.verified_user_outlined), title: Text('Campus-managed access'), subtitle: Text('Contact your administrator to change your role, email, department or password.'))),
      const SizedBox(height: 16), OutlinedButton.icon(onPressed: busy ? null : widget.logout, icon: const Icon(Icons.logout), label: const Text('Sign out')),
    ]));
  }
}
