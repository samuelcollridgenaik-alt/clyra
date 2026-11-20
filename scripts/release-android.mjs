import {existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

export function validateRelease({applicationId, apiBaseUrl}) {
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(applicationId || '') || applicationId.startsWith('com.example.')) {
    throw new Error('Set CLYRA_ANDROID_APPLICATION_ID to your approved, permanent Play Store ID.');
  }
  let url;
  try { url = new URL(apiBaseUrl); } catch { throw new Error('Set API_BASE_URL to the public HTTPS API ending /api/v1.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !url.pathname.endsWith('/api/v1') || host === 'localhost' || !host.includes('.') ||
      /\.(localhost|local|invalid|test|example)$/.test(host) || host === 'example.com' || host.endsWith('.example.com') ||
      /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/.test(host)) {
    throw new Error('API_BASE_URL must be a public HTTPS API, not localhost, an emulator, a private network or a placeholder.');
  }
  return {applicationId, apiBaseUrl: url.href};
}

export function isApiReady(responseOk, health) {
  return responseOk && health?.status === 'ready' && health?.service === 'clyra-api' && health?.database === 'connected';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const mobile = resolve(dirname(fileURLToPath(import.meta.url)), '../mobile');
    if (process.argv.includes('--local-demo')) {
      const result = spawnSync('flutter', ['build', 'apk', '--release', '--dart-define=API_BASE_URL=http://127.0.0.1:4001/api/v1'], {
        cwd: mobile, stdio: 'inherit', env: {...process.env, CLYRA_LOCAL_DEMO_APK: 'true', CLYRA_ANDROID_APPLICATION_ID: 'com.example.clyra'},
      });
      if (result.status !== 0) process.exit(result.status || 1);
      console.log('Local-demo APK: mobile/build/app/outputs/flutter-apk/app-release.apk (development-signed, not for Play Store).');
      console.log('Connect Android by USB and run: adb reverse tcp:4001 tcp:4001. Keep node scripts/demo.mjs start running.');
      process.exit(0);
    }
    const {apiBaseUrl} = validateRelease({applicationId: process.env.CLYRA_ANDROID_APPLICATION_ID, apiBaseUrl: process.env.API_BASE_URL});
    if (!existsSync(resolve(mobile, 'android/key.properties'))) {
      throw new Error('Create private mobile/android/key.properties; never commit signing passwords or keys.');
    }
    const response = await fetch(new URL('/health/ready', apiBaseUrl), {signal: AbortSignal.timeout(10000)});
    const health = await response.json();
    if (!isApiReady(response.ok, health)) {
      throw new Error('Public API readiness check failed; release was not built.');
    }
    for (const kind of process.argv.includes('--appbundle') ? ['appbundle', 'apk'] : ['apk']) {
      const result = spawnSync('flutter', ['build', kind, '--release', `--dart-define=API_BASE_URL=${apiBaseUrl}`], {cwd: mobile, stdio: 'inherit'});
      if (result.status !== 0) process.exit(result.status || 1);
    }
    console.log('Signed release builds are in mobile/build/app/outputs/. Validate the signing certificate and test in Play internal testing before publishing.');
  } catch (error) {
    console.error(`Release blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
