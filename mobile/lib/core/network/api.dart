import 'dart:convert';
import 'dart:io';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final String message;final int status;
  ApiException(this.message,this.status);
  @override String toString()=>message;
}
class ClyraApi {
  ClyraApi({String? baseUrl}):base=baseUrl??const String.fromEnvironment('API_BASE_URL',defaultValue:'http://10.0.2.2:4000/api/v1');
  final String base;
  final _storage=const FlutterSecureStorage();
  String? accessToken;
  Map<String,dynamic>? currentUser;
  Future<void> restore() async {
    final refresh=await _storage.read(key:'clyra_refresh');
    if(refresh==null)return;
    try{final data=await post('/auth/refresh',{'refreshToken':refresh},retry:false,headers:{'X-Client':'mobile'});await _applySession(data);}catch(_){await logout(localOnly:true);}
  }
  Future<void> _applySession(dynamic data) async {
    accessToken=data['accessToken'] as String?;
    currentUser=Map<String,dynamic>.from(data['user'] as Map);
    if(data['refreshToken']!=null)await _storage.write(key:'clyra_refresh',value:data['refreshToken'] as String);
  }
  Future<void> login(String email,String password)async{
    final data=await post('/auth/login',{'email':email,'password':password},retry:false,headers:{'X-Client':'mobile'});
    await _applySession(data);
  }
  Future<void> logout({bool localOnly=false})async{
    final refresh=await _storage.read(key:'clyra_refresh');
    if(!localOnly){try{await post('/auth/logout',{'refreshToken':refresh},retry:false);}catch(_){}}
    accessToken=null;currentUser=null;await _storage.delete(key:'clyra_refresh');
  }
  Future<dynamic> get(String path)=>_request('GET',path,null);
  Future<dynamic> post(String path,Map<String,dynamic> data,{bool retry=true,Map<String,String> headers=const {}})=>_request('POST',path,data,retry:retry,headers:headers);
  Future<dynamic> patch(String path,Map<String,dynamic> data)=>_request('PATCH',path,data);
  Future<dynamic> _request(String method,String path,Map<String,dynamic>? body,{bool retry=true,Map<String,String> headers=const {}})async{
    final uri=Uri.parse('$base$path');
    final request=http.Request(method,uri)..headers.addAll({'Content-Type':'application/json',if(accessToken!=null)'Authorization':'Bearer $accessToken',...headers});
    if(body!=null)request.body=jsonEncode(body);
    http.Response response;
    try{response=await http.Response.fromStream(await request.send().timeout(const Duration(seconds:20)));}catch(_){throw ApiException('Unable to reach campus server. Check connection.',0);}
    if(response.statusCode==401&&retry&&path!='/auth/refresh'&&path!='/auth/login'){
      final ref=await _storage.read(key:'clyra_refresh');
      if(ref!=null){try{final refreshed=await post('/auth/refresh',{'refreshToken':ref},retry:false,headers:{'X-Client':'mobile'});await _applySession(refreshed);return _request(method,path,body,retry:false,headers:headers);}catch(_){}}
    }
    Map<String,dynamic> decoded;
    try{decoded=jsonDecode(response.body) as Map<String,dynamic>;}catch(_){throw ApiException('Unexpected server response',response.statusCode);}
    if(response.statusCode>=400||decoded['success']!=true)throw ApiException(decoded['message']?.toString()??'Request failed',response.statusCode);
    return decoded['data'];
  }
  Future<Map<String,dynamic>> uploadImage(File file,{required String complaintId,required String resourceType})async{
    final request=http.MultipartRequest('POST',Uri.parse('$base/media/upload'));
    request.headers['Authorization']='Bearer $accessToken';request.fields['complaintId']=complaintId;request.fields['resourceType']=resourceType;
    request.files.add(await http.MultipartFile.fromPath('file',file.path));
    final response=await http.Response.fromStream(await request.send());
    final body=jsonDecode(response.body) as Map<String,dynamic>;
    if(response.statusCode>=400||body['success']!=true)throw ApiException(body['message']?.toString()??'Image upload failed',response.statusCode);
    return Map<String,dynamic>.from(body['data']);
  }
}
