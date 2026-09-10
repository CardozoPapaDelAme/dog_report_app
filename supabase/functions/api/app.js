import { Hono } from 'hono';

import { optionalAuth } from './middleware/auth.js';
import { requestId } from './middleware/request-id.js';
import { presentError } from './presenters/error.js';
import { healthRoutes } from './routes/health.js';
import { moderationRoutes } from './routes/moderation.js';
import { retentionRoutes } from './routes/retention.js';
import { identityRoutes } from './routes/identity-routes.js';

const app = new Hono().basePath('/api');

app.use('*', requestId);
app.use('*', optionalAuth);

app.route('/', healthRoutes);
app.route('/', moderationRoutes);
app.route('/', retentionRoutes);
app.route('/', identityRoutes);

app.notFound((c) => presentError(c, 404, 'not_found', 'No route matched this request.'));

app.onError((error, c) => {
  console.error(error);
  return presentError(c, 500, 'internal_error', 'The request could not be completed.');
});

export { app };
