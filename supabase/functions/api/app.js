import { Hono } from 'hono';

import { optionalAuth } from './middleware/auth.js';
import { requestId } from './middleware/requestId.js';
import { presentError } from './presenters/error.js';
import { associationRoutes } from './routes/associationRoutes.js';
import { healthRoutes } from './routes/health.js';
import { moderationRoutes } from './routes/moderation.js';
import { publicMapRoutes } from './routes/publicMap.js';
import { reportRoutes } from './routes/report.js';
import { retentionRoutes } from './routes/retention.js';
import { configurationRoutes } from './routes/configuration.js';
import { duplicateRoutes } from './routes/duplicateGroups.js';
import { identityRoutes } from './routes/identityRoutes.js';
import { zoneRoutes } from './routes/zoneSets.js';

const app = new Hono().basePath('/api'); // All Hono endpoints use the /api prefix.

app.use('*', requestId);
app.use('*', optionalAuth);

app.route('/', healthRoutes);
app.route('/', reportRoutes);
app.route('/', publicMapRoutes);
app.route('/', moderationRoutes);
app.route('/', retentionRoutes);
app.route('/', configurationRoutes);
app.route('/', identityRoutes);
app.route('/', associationRoutes);
app.route('/', zoneRoutes);
app.route('/', duplicateRoutes);

app.notFound((c) => presentError(c, 404, 'not_found', 'No route matched this request.'));

app.onError((error, c) => {
  console.error(error);
  return presentError(c, 500, 'internal_error', 'The request could not be completed.');
});

export { app };
