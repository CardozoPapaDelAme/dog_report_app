import { getCurrentProfileController } from '../controllers/identity-controller.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

Deno.test('identity controller returns authenticated profile', async () => {
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

  const context = {
    get(key) {
      if (key === 'auth') {
        return auth;
      }

      if (key === 'requestId') {
        return 'controller-test-request-id';
      }

      return undefined;
    },

    header(name, value) {
      this.headers ??= {};
      this.headers[name] = value;
    },

    json(body) {
      return Response.json(body);
    },
  };

  const response = await getCurrentProfileController(context);

  const body = await response.json();

  assert(
    body.data.user_id === auth.userId,
    'controller should return the authenticated user id',
  );

  assert(
    body.data.role === 'administrator',
    'controller should return the authenticated role',
  );

  assert(
    body.data.display_name === 'Test Admin',
    'controller should return display_name',
  );

  assert(
    body.data.active === true,
    'controller should return active status',
  );
});