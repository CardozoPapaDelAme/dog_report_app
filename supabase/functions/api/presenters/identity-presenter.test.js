import { presentIdentity } from '../presenters/identify-presenter.js   ';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

Deno.test('identity presenter returns profile inside data', async () => {
  const profile = {
    user_id: '11111111-1111-1111-1111-111111111111',
    role: 'administrator',
    display_name: 'Test Admin',
    active: true,
  };

  const context = {
    get(key) {
      if (key === 'requestId') {
        return 'test-request-id';
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

  const response = presentIdentity(context, profile);

  const body = await response.json();

  assert(
    body.data.user_id === profile.user_id,
    'presenter should wrap profile inside data',
  );

  assert(
    body.data.role === 'administrator',
    'presenter should preserve the profile role',
  );

  assert(
    body.data.display_name === 'Test Admin',
    'presenter should preserve display_name',
  );

  assert(
    body.data.active === true,
    'presenter should preserve active',
  );

  assert(
    context.headers['X-Request-Id'] === 'test-request-id',
    'presenter should include X-Request-Id',
  );
});