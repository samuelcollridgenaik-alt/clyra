import 'package:flutter/material.dart';
import '../../core/network/api.dart';
import '../../core/theme/app_theme.dart';
class LoginScreen extends StatefulWidget{
 const LoginScreen({super.key,required this.api,required this.onLogin});
 final ClyraApi api;final VoidCallback onLogin;
 @override State<LoginScreen> createState()=>_LoginScreenState();
}
class _LoginScreenState extends State<LoginScreen>{
 final _form=GlobalKey<FormState>();final email=TextEditingController(),password=TextEditingController();bool busy=false,hidden=true;String? error;
 @override void dispose(){email.dispose();password.dispose();super.dispose();}
 Future<void> submit()async{if(!_form.currentState!.validate())return;setState((){busy=true;error=null;});try{await widget.api.login(email.text.trim(),password.text);if(!mounted)return;widget.onLogin();}catch(e){if(mounted)setState(()=>error=e.toString());}finally{if(mounted)setState(()=>busy=false);}}
 @override Widget build(BuildContext context)=>Scaffold(body:SafeArea(child:Center(child:SingleChildScrollView(padding:const EdgeInsets.all(26),child:ConstrainedBox(constraints:const BoxConstraints(maxWidth:480),child:Form(key:_form,child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
  Row(children:[Image.asset('assets/branding/clyra-mark.png',width:52,height:52,excludeFromSemantics:true),const SizedBox(width:12),const Text('clyra.',style:TextStyle(fontSize:30,color:ClyraTheme.navy,fontWeight:FontWeight.w800))]),
  const SizedBox(height:64),const Text('Welcome back.',style:TextStyle(fontSize:32,color:ClyraTheme.navy,fontWeight:FontWeight.w800)),const SizedBox(height:12),const Text('Your campus issues and resolutions, all in one place.'),const SizedBox(height:32),
  TextFormField(controller:email,keyboardType:TextInputType.emailAddress,decoration:const InputDecoration(labelText:'Campus email'),validator:(v)=>(v??'').contains('@')?null:'Enter a valid email'),const SizedBox(height:16),
  TextFormField(controller:password,obscureText:hidden,decoration:InputDecoration(labelText:'Password',suffixIcon:IconButton(onPressed:()=>setState(()=>hidden=!hidden),icon:Icon(hidden?Icons.visibility:Icons.visibility_off))),validator:(v)=>(v??'').isNotEmpty?null:'Enter password'),const SizedBox(height:20),
  if(error!=null)...[Text(error!,style:const TextStyle(color:Colors.red)),const SizedBox(height:12)],
  ElevatedButton(onPressed:busy?null:submit,child:Text(busy?'Signing in…':'Sign in to Clyra')),const SizedBox(height:22),const Text('Accounts are managed according to your campus enrollment policy.',textAlign:TextAlign.center,style:TextStyle(color:Colors.black54,fontSize:12)),
 ])))))));
}
