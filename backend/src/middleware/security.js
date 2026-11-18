import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/index.js';
export class HttpError extends Error {constructor(status,message,code='REQUEST_ERROR'){super(message);this.status=status;this.code=code;}}
export const asyncRoute = fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export function requestId(req,res,next){req.id=crypto.randomUUID();res.setHeader('X-Request-ID',req.id);next();}
export function requireAuth(req,res,next){
  const token=req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  if(!token)return next(new HttpError(401,'Authentication required','UNAUTHENTICATED'));
  try{req.claims=jwt.verify(token,config.jwtSecret,{algorithms:['HS256'],issuer:config.issuer,audience:config.audience});}
  catch{return next(new HttpError(401,'Invalid or expired access token','INVALID_TOKEN'));}
  User.findById(req.claims.sub).then(user=>{
    if(!user||!user.isActive)throw new HttpError(401,'Account inactive or unavailable','ACCOUNT_DISABLED');
    req.user=user;next();
  }).catch(next);
}
export const role=(...allowed)=>(req,res,next)=>allowed.includes(req.user?.role)?next():next(new HttpError(403,'Not permitted','FORBIDDEN'));
export function failUnknown(req,res,next){next(new HttpError(404,'Route not found','NOT_FOUND'));}
export function handleError(error,req,res,next){
  if(error?.code===11000)error=new HttpError(409,'Record already exists','CONFLICT');
  else if(error?.name==='CastError')error=new HttpError(400,'Invalid identifier','VALIDATION_ERROR');
  else if(error?.name==='ValidationError')error=new HttpError(400,'Invalid data','VALIDATION_ERROR');
  else if(error?.name==='ZodError')error=new HttpError(400,'Validation failed','VALIDATION_ERROR');
  const status=error.status||500;
  if(status===500)console.error(JSON.stringify({requestId:req.id,code:'INTERNAL_ERROR',error:error.message}));
  return res.status(status).json({success:false,message:status===500?'Internal server error':error.message,code:error.code||'INTERNAL_ERROR',errors:status===400&&error.issues?error.issues.map(i=>({path:i.path,message:i.message})):[],requestId:req.id});
}
export function validate(schema,location='body'){return (req,res,next)=>{try{req[location]=schema.parse(req[location]);next();}catch(e){next(e);}};}
export const success=(res,data,message='OK',meta={})=>res.json({success:true,message,data,meta});
