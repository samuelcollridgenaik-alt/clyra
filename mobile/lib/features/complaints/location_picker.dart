import 'package:flutter/material.dart';
import '../../core/network/api.dart';

/// Loads the complete authenticated catalog, not the first page of locations.
class CampusLocationField extends StatefulWidget {
  const CampusLocationField({
    super.key,
    required this.api,
    required this.onChanged,
    this.enabled = true,
  });

  final ClyraApi api;
  final ValueChanged<String?> onChanged;
  final bool enabled;

  @override
  State<CampusLocationField> createState() => _CampusLocationFieldState();
}

class _CampusLocationFieldState extends State<CampusLocationField> {
  List<Map<String, dynamic>> _locations = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await widget.api.get('/locations/catalog');
      if (data is! List) {
        throw ApiException(
            'Unable to read campus locations. Please retry.', 502);
      }
      final locations = data
          .map((item) => Map<String, dynamic>.from(item as Map))
          .where((item) =>
              item['isActive'] != false && item['isAvailable'] != false)
          .toList();
      if (!mounted) return;
      setState(() {
        _locations = locations;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  Future<void> _choose(FormFieldState<String> field) async {
    final id = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _LocationSearchSheet(locations: _locations),
    );
    if (!mounted || id == null || !field.mounted) return;
    field.didChange(id);
    widget.onChanged(id);
  }

  @override
  Widget build(BuildContext context) => FormField<String>(
        validator: (value) => value == null ? 'Choose a campus location' : null,
        builder: (field) {
          final selected =
              _locations.where((item) => item['_id'] == field.value);
          final canChoose = widget.enabled &&
              !_loading &&
              _error == null &&
              _locations.isNotEmpty;
          return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                InkWell(
                  key: const Key('campus-location-field'),
                  onTap: canChoose
                      ? () {
                          _choose(field);
                        }
                      : null,
                  borderRadius: BorderRadius.circular(12),
                  child: InputDecorator(
                    decoration: InputDecoration(
                      labelText: 'Campus location',
                      enabled: canChoose,
                      errorText: field.errorText,
                      prefixIcon: const Icon(Icons.location_on_outlined),
                      suffixIcon: _loading
                          ? const Padding(
                              padding: EdgeInsets.all(16),
                              child: SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2)))
                          : const Icon(Icons.search),
                    ),
                    child: Text(selected.isNotEmpty
                        ? locationPath(selected.first)
                        : _loading
                            ? 'Loading campus locations…'
                            : 'Choose a block, floor or other location'),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(_error!,
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.error)),
                  TextButton.icon(
                      onPressed: widget.enabled ? _load : null,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry locations')),
                ] else if (!_loading && _locations.isEmpty) ...[
                  const SizedBox(height: 8),
                  const Text(
                      'No active locations yet. Ask an administrator to add campus locations in Facilities.'),
                  TextButton.icon(
                      onPressed: widget.enabled ? _load : null,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Reload locations')),
                ] else ...[
                  const SizedBox(height: 8),
                  const Text(
                      'Search your block and floor, or a manually added campus area.',
                      style: TextStyle(fontSize: 12, color: Colors.black54)),
                ],
              ]);
        },
      );
}

String locationPath(Map<String, dynamic> location) =>
    (location['pathName'] ?? location['name'] ?? 'Campus location').toString();

class _LocationSearchSheet extends StatefulWidget {
  const _LocationSearchSheet({required this.locations});
  final List<Map<String, dynamic>> locations;

  @override
  State<_LocationSearchSheet> createState() => _LocationSearchSheetState();
}

class _LocationSearchSheetState extends State<_LocationSearchSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final words = _query.trim().toLowerCase().split(RegExp(r'\s+'));
    final matches = widget.locations.where((item) {
      final text = '${locationPath(item)} ${item['code'] ?? ''}'.toLowerCase();
      return words.every(text.contains);
    }).toList();
    return FractionallySizedBox(
      heightFactor: 0.9,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 12, 20, MediaQuery.viewInsetsOf(context).bottom),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
                child: Text('Choose campus location',
                    style: Theme.of(context).textTheme.titleLarge)),
            IconButton(
                onPressed: () {
                  Navigator.of(context).pop();
                },
                tooltip: 'Close locations',
                icon: const Icon(Icons.close)),
          ]),
          const SizedBox(height: 8),
          TextField(
            key: const Key('campus-location-search'),
            decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Search block, floor, room or area'),
            onChanged: (value) {
              setState(() {
                _query = value;
              });
            },
          ),
          Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                  '${matches.length} of ${widget.locations.length} locations',
                  style: Theme.of(context).textTheme.bodySmall)),
          Expanded(
              child: matches.isEmpty
                  ? const Center(
                      child: Text(
                          'No matching locations. Try a block name or room number.',
                          textAlign: TextAlign.center))
                  : ListView.separated(
                      itemCount: matches.length,
                      separatorBuilder: (_, index) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final item = matches[index];
                        return ListTile(
                          key: ValueKey('location-${item['_id']}'),
                          contentPadding:
                              const EdgeInsets.symmetric(vertical: 6),
                          leading: const Icon(Icons.place_outlined),
                          title: Text(locationPath(item)),
                          subtitle: Text((item['type'] ?? '')
                              .toString()
                              .replaceAll('_', ' ')
                              .toLowerCase()),
                          onTap: () {
                            Navigator.of(context).pop(item['_id'].toString());
                          },
                        );
                      },
                    )),
          const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text(
                  'Missing a location? A campus administrator can add rooms and other areas in Facilities.',
                  style: TextStyle(fontSize: 12, color: Colors.black54))),
        ]),
      ),
    );
  }
}
