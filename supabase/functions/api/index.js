/**
 * @module index
 * Supabase Edge Function entry point: serves the Hono application through `Deno.serve`.
 */
import { app } from './app.js';

Deno.serve(app.fetch);
