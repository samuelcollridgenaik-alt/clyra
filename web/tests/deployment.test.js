import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiClient} from '../src/lib/api.js';

test('unconfigured hosted frontend does not send credentials to localhost', async () => {
  let called = false;
  const {authApi} = createApiClient(null, () => { called = true; });
  await assert.rejects(authApi.login('user@example.invalid', 'test-only'), /backend is not connected/);
  assert.equal(called, false);
});
