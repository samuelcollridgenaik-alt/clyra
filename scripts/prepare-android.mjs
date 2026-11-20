import {existsSync, mkdirSync, cpSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, 'mobile/android');
if (existsSync(destination)) {
  console.log('Existing Android platform preserved.');
  process.exit(0);
}
const shell = resolve(root, '.local/android-shell');
mkdirSync(dirname(shell), {recursive: true});
const result = spawnSync('flutter', ['create', '--platforms=android', '--project-name', 'clyra', shell], {stdio: 'inherit'});
if (result.status !== 0) process.exit(result.status || 1);
cpSync(resolve(shell, 'android'), destination, {recursive: true, errorOnExist: true, force: false});
const manifest = resolve(destination, 'app/src/main/AndroidManifest.xml');
writeFileSync(manifest, readFileSync(manifest, 'utf8').replace('<application',
  '<uses-permission android:name="android.permission.INTERNET" />\n    <application'));
writeFileSync(resolve(destination, 'app/src/debug/AndroidManifest.xml'),
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n' +
  '    <uses-permission android:name="android.permission.INTERNET" />\n' +
  '    <application android:usesCleartextTraffic="true" />\n</manifest>\n');
console.log('Android generated without touching Dart sources. HTTP is allowed only in debug builds.');
