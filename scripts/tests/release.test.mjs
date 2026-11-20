import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRelease, isApiReady} from '../release-android.mjs';

test('release requires an approved ID and public HTTPS API', () => {
  const valid = {applicationId: 'org.campus.clyra', apiBaseUrl: 'https://api.campus.edu/api/v1'};
  assert.deepEqual(validateRelease(valid), valid);
  for (const applicationId of ['', 'com.example.clyra', 'two.parts', 'invalid-id']) {
    assert.throws(() => validateRelease({...valid, applicationId}));
  }
  for (const apiBaseUrl of ['', 'http://api.campus.edu/api/v1', 'https://localhost/api/v1',
    'https://10.0.2.2/api/v1', 'https://192.168.1.1/api/v1', 'https://server.local/api/v1',
    'https://example.com/api/v1', 'https://user:secret@api.campus.edu/api/v1',
    'https://api.campus.edu/api/v1?token=secret', 'https://api.campus.edu/wrong']) {
    assert.throws(() => validateRelease({...valid, apiBaseUrl}));
  }
});

test('release readiness matches the API contract and rejects liveness-only responses', () => {
  const ready = {status: 'ready', service: 'clyra-api', database: 'connected'};
  assert.equal(isApiReady(true, ready), true);
  assert.equal(isApiReady(false, ready), false);
  assert.equal(isApiReady(true, {status: 'ok', service: 'clyra-api'}), false);
  assert.equal(isApiReady(true, {status: 'not_ready', service: 'clyra-api', database: 'unavailable'}), false);
  assert.equal(isApiReady(true, null), false);
});
