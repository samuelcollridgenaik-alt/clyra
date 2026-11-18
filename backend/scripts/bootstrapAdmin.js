import 'dotenv/config';import mongoose from 'mongoose';import bcrypt from 'bcrypt';import {User} from '../src/models/index.js';
const email=process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase().trim();const pw=process.env.BOOTSTRAP_ADMIN_PASSWORD;
if(!email||!pw||pw.length<12){console.error('Provide BOOTSTRAP_ADMIN_EMAIL and a 12+ character BOOTSTRAP_ADMIN_PASSWORD');process.exit(1);}
try{await mongoose.connect(process.env.MONGODB_URI||'mongodb://127.0.0.1:27017/clyra_db');
 if(await User.exists({role:'ADMIN'}))throw new Error('An administrator already exists; use an authenticated admin workflow');
 const account=await User.create({email,fullName:'Campus Administrator',role:'ADMIN',passwordHash:await bcrypt.hash(pw,12)});
 console.log('Administrator created:',String(account._id),'Remove bootstrap credentials from .env');}
catch(e){console.error(e.message);process.exitCode=1;}finally{await mongoose.disconnect();}
