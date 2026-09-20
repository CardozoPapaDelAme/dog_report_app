import { getCurrentProfile } from '../services/identity-service.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

Deno.test('identity service creates the current profile view', () => {
  const auth = {
    userId: '11111111-1111-1111-1111-111111111111',
    role: 'administrator',
    profile: {
      id: '11111111-1111-1111-1111-111111111111',
      role: 'administrator',
      display_name: 'Test Admin',
      active: true,
    },
  };

  const profile = getCurrentProfile(auth);

  assert(
    profile.user_id === auth.userId,
    'user_id should match the authenticated user',
  );

  assert(
    profile.role === 'administrator',
    'role should match the authenticated role',
  );

  assert(
    profile.display_name === 'Test Admin',
    'display_name should come from the profile',
  );

  assert(
    profile.active === true,
    'active should come from the profile',
  );

  assert(
    profile.id === undefined,
    'database id should not be exposed directly',
  );
});