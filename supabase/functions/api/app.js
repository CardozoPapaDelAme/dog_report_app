/**
 * @module app
 * Composes the Hono application for the `api` Supabase Edge Function.
 * Registers global middleware (request id, optional authentication), mounts every route module under
 * the `/api` base path, and maps unmatched routes and uncaught errors to the standard error envelope.
 * Request flow: Routes -> Controllers -> Services -> Repositories, with Presenters shaping responses.
 */
import { Hono } from 'hono';

import { optionalAuth } from './middleware/auth.js';
import { requestId } from './middleware/requestId.js';
import { presentError } from './presenters/error.js';
import { associationRoutes } from './routes/associationRoutes.js';
import { healthRoutes } from './routes/health.js';
import { moderationRoutes } from './routes/moderation.js';
import { photoRoutes } from './routes/photo.js';
import { publicMapRoutes } from './routes/publicMap.js';
import { photoValidationRoutes } from './routes/photoValidation.js';
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
app.route('/', photoRoutes);
app.route('/', publicMapRoutes);
app.route('/', photoValidationRoutes);
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

/**
 * Configured Hono application instance; `index.js` serves its `fetch` handler.
 * @type {import('hono').Hono}
 */
export { app };
