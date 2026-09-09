import {
  allowedCommands,
  assertTransition,
  canTransition,
  nextStatus,
} from './report-moderation.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test('approve allows pending and hidden reports to become visible', () => {
  for (const status of ['pending_review', 'hidden']) {
    assert(canTransition('approve', status), `approve should allow ${status}`);
    assert(assertTransition('approve', status) === 'visible', `${status} should become visible`);
  }
  assert(nextStatus('approve') === 'visible', 'approve should target visible');
});

Deno.test('approve rejects visible and deleted reports', () => {
  for (const status of ['visible', 'deleted']) {
    assert(!canTransition('approve', status), `approve should reject ${status}`);
    try {
      assertTransition('approve', status);
      throw new Error(`approve unexpectedly allowed ${status}`);
    } catch (error) {
      assert(
        error.code === 'invalid_approve_transition',
        `approve should return a typed conflict for ${status}`,
      );
    }
  }
});

Deno.test('visible reports expose only hide and delete moderation commands', () => {
  const commands = allowedCommands('visible');
  assert(commands.length === 2, 'visible should expose two commands');
  assert(commands.includes('hide'), 'visible should allow hide');
  assert(commands.includes('delete'), 'visible should allow delete');
});
