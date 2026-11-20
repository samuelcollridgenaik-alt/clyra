import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import {User, Department, Location} from '../src/models/index.js';

// Never reset users or seed an institutional database. Re-running only inserts missing fixtures.
const uri = process.env.MONGODB_URI || '';
const target = new URL(uri);
if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_DEMO_SEED !== 'true' ||
    target.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost'].includes(target.hostname) ||
    !/^\/clyra_demo(?:_[a-z0-9]+)?$/.test(target.pathname) || target.username || target.password) {
  throw new Error('Demo seed requires explicit development opt-in and a local clyra_demo database.');
}
const password = process.env.DEMO_PASSWORD || '';
if (password.length < 16) throw new Error('Provide a DEMO_PASSWORD of at least 16 characters.');

await mongoose.connect(uri, {serverSelectionTimeoutMS: 10000});
try {
  if (await User.exists({email: {$not: /@clyra-demo\.invalid$/}})) {
    throw new Error('Database contains non-demo users; refusing to seed it.');
  }
  await Promise.all([User.init(), Department.init(), Location.init()]);
  const passwordHash = await bcrypt.hash(password, 12);
  await mongoose.connection.transaction(async session => {
    const department = await Department.findOneAndUpdate({code: 'DEMO-MAINT'}, {$setOnInsert: {
      name: 'Campus Maintenance', code: 'DEMO-MAINT', description: 'Fictional demonstration department',
    }}, {upsert: true, new: true, session});
    let parent = null;
    for (const [code, name, type] of [
      ['DEMO-CAMPUS', 'Clyra Demo Campus', 'CAMPUS'],
      ['DEMO-BLOCK', 'Learning Centre', 'BUILDING'],
      ['DEMO-FLOOR', 'Ground Floor', 'FLOOR'],
      ['DEMO-ROOM', 'Library Reading Room', 'ROOM'],
    ]) {
      parent = await Location.findOneAndUpdate({code}, {$setOnInsert: {
        code, name, type, ...(parent ? {parentLocationId: parent._id} : {}),
      }}, {upsert: true, new: true, session});
    }
    for (const [slug, fullName, role] of [
      ['admin', 'Demo Administrator', 'ADMIN'], ['student', 'Demo Student', 'STUDENT'],
      ['faculty', 'Demo Faculty', 'FACULTY'], ['staff', 'Demo Maintenance Staff', 'STAFF'],
    ]) {
      await User.findOneAndUpdate({email: `${slug}@clyra-demo.invalid`}, {$setOnInsert: {
        fullName, role, passwordHash, ...(role === 'STAFF' ? {departmentId: department._id} : {}),
      }}, {upsert: true, new: true, session});
    }
  });
  console.log('Demo campus, department, room and four role accounts are ready. Existing accounts were preserved.');
} finally {
  await mongoose.disconnect();
}
