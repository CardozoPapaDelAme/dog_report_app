import { Hono } from 'hono';

import { identityRoutes } from '../routes/identity-routes.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

Deno.test('GET /me without authorization returns 401', async () => {
  const app = new Hono();

  app.route('/', identityRoutes);

  const response = await app.request('/me');

  const body = await response.json();

  assert(
    response.status === 401,
    'GET /me without JWT should return 401',
  );

  assert(
    body.error.code === 'authentication_required',
    'missing JWT should return authentication_required',
  );
});