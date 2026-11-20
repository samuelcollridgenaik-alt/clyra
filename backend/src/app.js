import express from 'express';import helmet from 'helmet';import cors from 'cors';import cookieParser from 'cookie-parser';import rateLimit from 'express-rate-limit';
import router from './routes/index.js';import { requestId,failUnknown,handleError } from './middleware/security.js';import { config } from './config/env.js';
import mongoose from 'mongoose';
const app=express();app.disable('x-powered-by');app.use(helmet());
app.use(requestId);
app.use(cors({origin:(origin,callback)=>!origin||config.corsOrigins.includes(origin)?callback(null,true):callback(new Error('Origin not allowed')),credentials:true}));
app.use(express.json({limit:'128kb'}));app.use(cookieParser());
app.get('/health',(req,res)=>res.json({status:'ok',service:'clyra-api'}));
app.get('/health/ready',async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 try{
  if(mongoose.connection.readyState!==1)throw new Error('Database unavailable');
  await mongoose.connection.db.admin().ping({timeoutMS:1500});
  res.json({status:'ready',service:'clyra-api',database:'connected'});
 }catch{
  res.status(503).json({status:'not_ready',service:'clyra-api',database:'unavailable'});
 }
});
app.use('/api/v1/auth',rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:'draft-7',legacyHeaders:false}));
app.use('/api/v1',router);app.use(failUnknown);app.use(handleError);
export default app;
