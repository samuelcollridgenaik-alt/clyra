import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/network/api.dart';
import '../../core/theme/app_theme.dart';

class ComplaintList extends StatefulWidget {
  const ComplaintList({super.key, required this.api});
  final ClyraApi api;
  @override State<ComplaintList> createState() => _ComplaintListState();
}
class _ComplaintListState extends State<ComplaintList> {
  late Future<dynamic> future;
  String search = '';
  String status = 'ALL';

  @override void initState() { super.initState(); refresh(); }
  void refresh() => setState(() => future = widget.api.get('/complaints?limit=100'));
  Future<void> pullRefresh() async {
    final next = widget.api.get('/complaints?limit=100');
    setState(() => future = next);
    await next;
  }

  Color statusColor(String value) {
    switch (value) {
      case 'RESOLVED': case 'CLOSED': return const Color(0xFF047857);
      case 'REJECTED': return const Color(0xFFB91C1C);
      case 'IN_PROGRESS': case 'ASSIGNED': case 'ACCEPTED': return ClyraTheme.indigo;
      default: return const Color(0xFF9A6700);
    }
  }

  @override Widget build(BuildContext context) => FutureBuilder<dynamic>(
    future: future,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Center(child: CircularProgressIndicator());
      }
      if (snapshot.hasError) {
        return Center(child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.wifi_off_outlined, size: 40, color: ClyraTheme.indigo),
            const SizedBox(height: 12),
            const Text('Unable to load complaints', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 8),
            Text(snapshot.error.toString(), textAlign: TextAlign.center),
            const SizedBox(height: 16),
            OutlinedButton.icon(onPressed: refresh, icon: const Icon(Icons.refresh), label: const Text('Try again')),
          ]),
        ));
      }
      final records = (snapshot.data as List?) ?? [];
      final filtered = records.where((record) {
        final item = record as Map;
        final query = search.trim().toLowerCase();
        final matchesText = query.isEmpty ||
          (item['title']?.toString().toLowerCase().contains(query) ?? false) ||
          (item['complaintCode']?.toString().toLowerCase().contains(query) ?? false);
        return matchesText && (status == 'ALL' || item['status'] == status);
      }).toList();

      return RefreshIndicator(
        onRefresh: pullRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            Text('My complaints', style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: ClyraTheme.navy, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text('${records.length} reports in your workspace', style: const TextStyle(color: Colors.black54)),
            const SizedBox(height: 20),
            TextField(
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search ID or issue title'),
              onChanged: (value) => setState(() => search = value),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: status,
              decoration: const InputDecoration(labelText: 'Status'),
              items: const [
                DropdownMenuItem(value: 'ALL', child: Text('All statuses')),
                DropdownMenuItem(value: 'SUBMITTED', child: Text('Submitted')),
                DropdownMenuItem(value: 'UNDER_REVIEW', child: Text('Under review')),
                DropdownMenuItem(value: 'ASSIGNED', child: Text('Assigned')),
                DropdownMenuItem(value: 'IN_PROGRESS', child: Text('In progress')),
                DropdownMenuItem(value: 'RESOLVED', child: Text('Resolved')),
                DropdownMenuItem(value: 'REJECTED', child: Text('Rejected')),
              ],
              onChanged: (value) => setState(() => status = value ?? 'ALL'),
            ),
            const SizedBox(height: 18),
            if (filtered.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 48),
                child: Column(children: [
                  const Icon(Icons.inbox_outlined, size: 48, color: ClyraTheme.indigo),
                  const SizedBox(height: 12),
                  Text(records.isEmpty ? 'No complaints yet' : 'No matching complaints',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                  const SizedBox(height: 6),
                  Text(records.isEmpty ? 'Submitted campus issues will appear here.' : 'Try another search or status.',
                    textAlign: TextAlign.center),
                ]),
              ),
            for (final record in filtered)
              Builder(builder: (context) {
                final item = record as Map;
                final state = (item['status'] ?? 'SUBMITTED').toString();
                final color = statusColor(state);
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () async {
                      await Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => ComplaintDetail(api: widget.api, complaintId: item['_id'].toString())));
                      if (mounted) refresh();
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(child: Text(item['complaintCode']?.toString() ?? 'Report',
                            style: const TextStyle(color: ClyraTheme.indigo, fontSize: 12, fontWeight: FontWeight.bold))),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(color: color.withOpacity(0.09), borderRadius: BorderRadius.circular(20)),
                            child: Text(state.replaceAll('_', ' '),
                              style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold))),
                        ]),
                        const SizedBox(height: 12),
                        Text(item['title']?.toString() ?? 'Campus issue',
                          style: const TextStyle(fontSize: 16, color: ClyraTheme.navy, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 9),
                        Row(children: [
                          const Icon(Icons.category_outlined, size: 15, color: Colors.black45),
                          const SizedBox(width: 5),
                          Expanded(child: Text(item['category']?.toString() ?? 'Other',
                            style: const TextStyle(fontSize: 12, color: Colors.black54))),
                          const Icon(Icons.chevron_right, color: ClyraTheme.indigo),
                        ]),
                      ]),
                    ),
                  ),
                );
              }),
            const SizedBox(height: 24),
          ],
        ),
      );
    },
  );
}
class ComplaintDetail extends StatefulWidget{const ComplaintDetail({super.key,required this.api,required this.complaintId});final ClyraApi api;final String complaintId;@override State<ComplaintDetail> createState()=>_ComplaintDetailState();}
class _ComplaintDetailState extends State<ComplaintDetail>{late Future<dynamic> future;@override void initState(){super.initState();future=Future.wait([widget.api.get('/complaints/${widget.complaintId}'),widget.api.get('/complaints/${widget.complaintId}/history')]);}
 @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Complaint detail')),body:FutureBuilder<dynamic>(future:future,builder:(context,s){if(!s.hasData)return Center(child:Text(s.hasError?'Error: ${s.error}':'Loading…'));final all=s.data as List;final c=all[0] as Map,history=all[1] as List;return ListView(padding:const EdgeInsets.all(20),children:[Text(c['complaintCode'].toString(),style:const TextStyle(color:ClyraTheme.indigo,fontWeight:FontWeight.bold)),const SizedBox(height:8),Text(c['title'].toString(),style:Theme.of(context).textTheme.headlineSmall),const SizedBox(height:14),Text(c['description'].toString()),const SizedBox(height:18),Wrap(spacing:8,children:[Chip(label:Text('${c['status']}')),Chip(label:Text('${c['priority']}')),Chip(label:Text('${c['category']}'))]),const SizedBox(height:24),const Text('Progress timeline',style:TextStyle(fontSize:18,fontWeight:FontWeight.bold)),for(final h in history)ListTile(leading:const Icon(Icons.check_circle_outline,color:ClyraTheme.indigo),title:Text('${h['newStatus']}'),subtitle:Text('${h['remarks']??''}'))]);}));}
class ReportScreen extends StatefulWidget{const ReportScreen({super.key,required this.api});final ClyraApi api;@override State<ReportScreen> createState()=>_ReportScreenState();}
class _ReportScreenState extends State<ReportScreen>{final form=GlobalKey<FormState>();final title=TextEditingController(),description=TextEditingController();String? location,category;List<dynamic> locations=[];List<File> photos=[];bool saving=false;String? message;
 @override void initState(){super.initState();widget.api.get('/locations?limit=100').then((x){if(mounted)setState(()=>locations=x as List);}).catchError((Object e){if(mounted)setState(()=>message=e.toString());});}
 @override void dispose(){title.dispose();description.dispose();super.dispose();}
 Future<void> pick()async{final imgs=await ImagePicker().pickMultiImage(imageQuality:85);if(imgs.isNotEmpty)setState(()=>photos=imgs.take(5).map((x)=>File(x.path)).toList());}
 Future<void> save()async{if(!form.currentState!.validate()||location==null)return;setState((){saving=true;message=null;});try{final c=await widget.api.post('/complaints',{'title':title.text,'description':description.text,'locationId':location,if(category!=null)'category':category}) as Map;int failed=0;for(final img in photos){try{await widget.api.uploadImage(img,complaintId:c['_id'].toString(),resourceType:'COMPLAINT');}catch(_){failed++;}}if(!mounted)return;ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(failed==0?'Complaint submitted.':'Complaint submitted, but $failed image uploads failed.')));Navigator.of(context).pop();}catch(e){if(mounted)setState(()=>message=e.toString());}finally{if(mounted)setState(()=>saving=false);}}
 @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Report an issue')),body:Form(key:form,child:ListView(padding:const EdgeInsets.all(20),children:[const Text('Tell us what needs attention.',style:TextStyle(fontSize:22,fontWeight:FontWeight.bold)),const SizedBox(height:20),TextFormField(controller:title,maxLength:160,decoration:const InputDecoration(labelText:'Issue title'),validator:(s)=>(s??'').length>=5?null:'Enter at least 5 characters'),const SizedBox(height:14),TextFormField(controller:description,maxLength:5000,minLines:4,maxLines:7,decoration:const InputDecoration(labelText:'Description'),validator:(s)=>(s??'').length>=10?null:'Please describe the issue'),const SizedBox(height:14),DropdownButtonFormField<String>(value:location,decoration:const InputDecoration(labelText:'Campus location'),items:[for(final x in locations)DropdownMenuItem(value:x['_id'].toString(),child:Text('${x['name']} (${x['type']})'))],onChanged:(v)=>setState(()=>location=v),validator:(v)=>v==null?'Choose a location':null),const SizedBox(height:14),DropdownButtonFormField<String>(value:category,decoration:const InputDecoration(labelText:'Optional category'),items:[for(final s in ['Electrical','Plumbing','Cleaning and Sanitation','Classroom Maintenance','Furniture','Internet and Networking','Security','Infrastructure','Other'])DropdownMenuItem(value:s,child:Text(s))],onChanged:(v)=>setState(()=>category=v)),const SizedBox(height:16),OutlinedButton.icon(onPressed:pick,icon:const Icon(Icons.add_photo_alternate_outlined),label:Text(photos.isEmpty?'Add photos':'${photos.length} photos selected')),const SizedBox(height:16),const Text('AI suggestions are advisory only. An administrator reviews official category, priority and assignment.',style:TextStyle(color:Colors.black54,fontSize:12)),if(message!=null)Padding(padding:const EdgeInsets.all(12),child:Text(message!,style:const TextStyle(color:Colors.red))),const SizedBox(height:20),ElevatedButton(onPressed:saving?null:save,child:Text(saving?'Submitting…':'Submit complaint'))])));
}
