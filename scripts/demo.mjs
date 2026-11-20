import {mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const local = resolve(root, '.local');
const configPath = resolve(local, 'demo-config.json');
const command = process.argv[2];
if (!['setup', 'start', 'credentials'].includes(command)) {
  console.log('Install dependencies with npm ci in backend/ and web/, then:');
  console.log('node scripts/demo.mjs setup       # persistent local MongoDB + fictional accounts');
  console.log('node scripts/demo.mjs start       # API :4001 + web :5174');
  console.log('node scripts/demo.mjs credentials # show local demo sign-in details');
  process.exit(0);
}

if (command === 'setup') {
  mkdirSync(local, {recursive: true, mode: 0o700});
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify({
      JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
      DEMO_PASSWORD: randomBytes(18).toString('base64url'),
    }, null, 2), {flag: 'wx', mode: 0o600});
  }
  chmodSync(configPath, 0o600);
}
if (!existsSync(configPath)) throw new Error('Run node scripts/demo.mjs setup first.');
const secrets = JSON.parse(readFileSync(configPath, 'utf8'));
const env = {...process.env, ...secrets, NODE_ENV: 'development', PORT: '4001',
  MONGODB_URI: 'mongodb://127.0.0.1:27019/clyra_demo?replicaSet=clyra-dev',
  CORS_ORIGINS: 'http://localhost:5174,http://127.0.0.1:5174',
  ALLOW_DEMO_SEED: 'true', ALLOW_TEXT_ONLY_RESOLUTION: 'true',
  ALLOW_STUDENT_REGISTRATION: 'false', AI_SHARED_SECRET: '',
  CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '',
  FIREBASE_SERVICE_ACCOUNT_JSON: '', DEVICE_ENCRYPTION_KEY: '',
};
function credentials() {
  console.log('Fictional local accounts: admin, student, faculty, staff @clyra-demo.invalid');
  console.log(`Shared demo password: ${secrets.DEMO_PASSWORD}`);
  console.log('Private configuration: .local/demo-config.json (ignored by Git).');
}

if (command === 'setup') {
  const require = createRequire(resolve(root, 'backend/package.json'));
  const {MongoClient} = require('mongoose').mongo;
  const directUri = 'mongodb://127.0.0.1:27019/admin?directConnection=true';
  let client = new MongoClient(directUri, {serverSelectionTimeoutMS: 2000});
  let started = false;
  try { await client.connect(); }
  catch {
    await client.close();
    mkdirSync(resolve(local, 'mongodb'), {recursive: true});
    const result = spawnSync('mongod', ['--dbpath', resolve(local, 'mongodb'), '--port', '27019',
      '--bind_ip', '127.0.0.1', '--replSet', 'clyra-dev', '--nounixsocket',
      '--logpath', resolve(local, 'mongodb.log'), '--fork'], {stdio: 'inherit'});
    if (result.status !== 0) throw new Error('Could not start mongod. Install MongoDB and check .local/mongodb.log.');
    started = true;
    client = new MongoClient(directUri, {serverSelectionTimeoutMS: 10000});
    await client.connect();
  }
  try {
    const admin = client.db('admin');
    const hello = await admin.command({hello: 1});
    if (!hello.setName && started) {
      await admin.command({replSetInitiate: {_id: 'clyra-dev', members: [{_id: 0, host: '127.0.0.1:27019'}]}});
    } else if (hello.setName !== 'clyra-dev') {
      throw new Error('Port 27019 belongs to another database. Refusing to change its configuration.');
    }
  } finally { await client.close(); }
  const ready = new MongoClient(env.MONGODB_URI, {serverSelectionTimeoutMS: 30000});
  try { await ready.connect(); await ready.db().command({ping: 1}); }
  finally { await ready.close(); }
  const seed = spawnSync(process.execPath, ['scripts/seedDemo.js'], {cwd: resolve(root, 'backend'), env, stdio: 'inherit'});
  if (seed.status !== 0) process.exit(seed.status || 1);
  credentials();
  console.log('Setup complete. Start with node scripts/demo.mjs start');
} else if (command === 'credentials') {
  credentials();
} else {
  const api = spawn(process.execPath, ['src/server.js'], {cwd: resolve(root, 'backend'), env, stdio: 'inherit'});
  const web = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'],
    {cwd: resolve(root, 'web'), env: {...env, VITE_API_BASE_URL: 'http://localhost:4001/api/v1'}, stdio: 'inherit'});
  let stopping = false;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    api.kill('SIGTERM'); web.kill('SIGTERM');
    process.exitCode = code;
  }
  for (const child of [api, web]) {
    child.on('error', error => {console.error(error.message); stop(1);});
    child.on('exit', code => stop(code || 0));
  }
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
  console.log('Demo web http://localhost:5174 | API http://localhost:4001 | MongoDB :27019');
  console.log('Ctrl+C stops the API and web. MongoDB remains running and data persists in .local/mongodb.');
}
