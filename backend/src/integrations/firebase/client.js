/** Optional FCM delivery. In-app notifications remain the source of truth. */
import { initializeApp,cert,getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
let client;
export function messaging(){
 if(client)return client;
 const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
 if(!raw)return null;
 const account=JSON.parse(raw);
 if(!getApps().length)initializeApp({credential:cert(account)});
 client=getMessaging();return client;
}
export async function sendPush(token,title,body){
 const service=messaging();if(!service)return {delivered:false,reason:'NOT_CONFIGURED'};
 try{const messageId=await service.send({token,notification:{title,body}});return {delivered:true,messageId};}
 catch(error){return {delivered:false,reason:error.code||'DELIVERY_FAILED'};}
}
