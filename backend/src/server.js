import mongoose from 'mongoose';import app from './app.js';import {config,assertConfig} from './config/env.js';
assertConfig();
try{await mongoose.connect(config.mongoUri,{serverSelectionTimeoutMS:8000});app.listen(config.port,()=>console.log(`Clyra API listening on ${config.port}`));}
catch(e){console.error('Database connection failed:',e.message);process.exit(1);}
