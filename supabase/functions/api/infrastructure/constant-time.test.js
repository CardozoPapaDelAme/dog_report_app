import { constantTimeEqual } from './constant-time.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test('constant-time comparison accepts only equal secrets', async () => {
  assert(await constantTimeEqual('scheduler-secret', 'scheduler-secret'), 'equal secrets should match');
  assert(!(await constantTimeEqual('scheduler-secret', 'scheduler-secreu')), 'different secrets should fail');
  assert(!(await constantTimeEqual('short', 'a-much-longer-secret')), 'different lengths should fail');
});
