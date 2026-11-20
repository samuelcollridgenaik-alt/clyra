import { v2 as cloudinary } from 'cloudinary';
import crypto from 'node:crypto';
import { HttpError } from '../../middleware/security.js';
export function configured(){return Boolean(process.env.CLOUDINARY_CLOUD_NAME&&process.env.CLOUDINARY_API_KEY&&process.env.CLOUDINARY_API_SECRET);}
export async function uploadImage(buffer,ext){
 if(!configured())throw new HttpError(503,'Cloudinary not configured','NOT_CONFIGURED');
 cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET,secure:true});
 const publicId='clyra/'+crypto.randomUUID();
 const data=`data:image/${ext==='jpg'?'jpeg':ext};base64,${buffer.toString('base64')}`;
 const result=await cloudinary.uploader.upload(data,{public_id:publicId,type:'authenticated',resource_type:'image',overwrite:false});
 return {publicId:result.public_id,url:result.secure_url};
}
export async function deleteImage(publicId){
 if(!configured())throw new HttpError(503,'Cloudinary not configured','NOT_CONFIGURED');
 cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET,secure:true});
 await cloudinary.uploader.destroy(publicId,{type:'authenticated',resource_type:'image'});
}
