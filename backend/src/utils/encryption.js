import crypto from 'node:crypto';
import {HttpError} from '../middleware/security.js';
const key=()=>{
 const raw=process.env.DEVICE_ENCRYPTION_KEY;
 if(!raw||!/^[a-fA-F0-9]{64}$/.test(raw))throw new HttpError(503,'Device encryption key not configured','NOT_CONFIGURED');
 return Buffer.from(raw,'hex');
};
export const hashToken=t=>crypto.createHash('sha256').update(t).digest('hex');
export function encryptToken(s){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);const encrypted=Buffer.concat([cipher.update(s,'utf8'),cipher.final()]);return `${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${encrypted.toString('hex')}`;}
export function decryptToken(value){const [iv,tag,data]=value.split('.');const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'hex'));decipher.setAuthTag(Buffer.from(tag,'hex'));return Buffer.concat([decipher.update(Buffer.from(data,'hex')),decipher.final()]).toString('utf8');}
