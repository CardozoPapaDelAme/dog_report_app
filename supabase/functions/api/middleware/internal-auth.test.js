import { isInternalSecretValid } from './internal-auth.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test('internal authentication rejects absent or incorrect secrets', async () => {
  assert(!(await isInternalSecretValid('', 'configured')), 'absent secret should fail');
  assert(!(await isInternalSecretValid('incorrect', 'configured')), 'incorrect secret should fail');
  assert(!(await isInternalSecretValid('configured', '')), 'missing server configuration should fail');
  assert(await isInternalSecretValid('configured', 'configured'), 'matching secret should pass');
});
