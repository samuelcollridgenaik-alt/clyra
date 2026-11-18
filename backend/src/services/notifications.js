import {Device} from '../models/index.js';
import {decryptToken} from '../utils/encryption.js';
import {sendPush} from '../integrations/firebase/client.js';
/** Best-effort push: never throws into business transaction. */
export async function pushToUser(userId,title,message){
 try{const devices=await Device.find({userId}).select('+tokenEncrypted');
  const results=[];
  for(const device of devices){results.push(await sendPush(decryptToken(device.tokenEncrypted),title,message));}
  return results;
 }catch(error){console.warn('FCM delivery unavailable:',error.code||'NOT_CONFIGURED');return [];} 
}
