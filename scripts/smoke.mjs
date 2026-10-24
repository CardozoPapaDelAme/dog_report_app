#!/usr/bin/env node
/**
 * Post-deploy smoke check of a deployed environment (Stage 5, infrastructure validation).
 *
 * Usage: `npm run smoke` (or `node --env-file=.env scripts/smoke.mjs`). Reads
 * `API_BASE_URL` (falls back to `EXPO_PUBLIC_API_BASE_URL`) and, for the signup
 * check, `SUPABASE_PUBLISHABLE_KEY` (falls back to `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
 * Only public endpoints and the publishable client key are used; no server secret is
 * needed. Prints one line per check with its latency in ms and exits with 1 when any
 * check fails.
 *
 * @module scripts/smoke
 */
import { pathToFileURL } from 'node:url';

const API_SUFFIX = /\/functions\/v1\/api\/?$/;

/**
 * Resolves the smoke configuration from environment variables.
 *
 * @param {Record<string, string|undefined>} env Environment variables.
 * @returns {{apiBaseUrl: string, supabaseUrl: string, publishableKey: string}}
 */
export function resolveConfig(env) {
  const apiBaseUrl = (env.API_BASE_URL || env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
  const supabaseUrl = (env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL || apiBaseUrl.replace(API_SUFFIX, ''))
    .replace(/\/+$/, '');
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  return { apiBaseUrl, supabaseUrl, publishableKey };
}

/**
 * Checks run in order. `expect` returns an error detail, or '' when the response is healthy.
 *
 * @param {{apiBaseUrl: string, supabaseUrl: string, publishableKey: string}} config
 */
function buildChecks({ apiBaseUrl, supabaseUrl, publishableKey }) {
  return [
    {
      name: 'GET /health',
      url: `${apiBaseUrl}/health`,
      expect: (status, body) => {
        if (status !== 200) return `expected 200, got ${status}`;
        return body?.data?.database === 'up' ? '' : `database is "${body?.data?.database}", expected "up"`;
      },
    },
    {
      name: 'GET /public/clusters',
      url: `${apiBaseUrl}/public/clusters?zoom=10&limit=5`,
      expect: (status, body) => (status === 200 && Array.isArray(body?.data) ? '' : `expected 200 with a list, got ${status}`),
    },
    {
      name: 'GET /public/reports',
      url: `${apiBaseUrl}/public/reports?limit=5`,
      expect: (status, body) => (status === 200 && Array.isArray(body?.data) ? '' : `expected 200 with a list, got ${status}`),
    },
    {
      name: 'POST /auth/v1/signup',
      url: `${supabaseUrl}/auth/v1/signup`,
      skip: publishableKey ? '' : 'sin SUPABASE_PUBLISHABLE_KEY',
      init: {
        method: 'POST',
        headers: { apikey: publishableKey, 'content-type': 'application/json' },
        // Signup must be disabled; this address can never receive mail (RFC 2606).
        body: JSON.stringify({ email: 'smoke-check@example.invalid', password: 'smoke-check-not-a-user' }),
      },
      expect: (status, body) =>
        status === 422 && body?.error_code === 'signup_disabled'
          ? ''
          : `expected 422 signup_disabled, got ${status} ${body?.error_code ?? ''}`.trim(),
    },
  ];
}

/**
 * Runs every check and measures each call's latency.
 *
 * @param {{apiBaseUrl: string, supabaseUrl: string, publishableKey: string,
 *   fetch?: typeof fetch, now?: () => number}} options
 * @returns {Promise<{ok: boolean, results: Array<{name: string, ok: boolean, skipped?: boolean,
 *   status: number|null, latency_ms: number|null, detail: string}>}>}
 */
export async function runSmoke({ fetch: fetchImpl = globalThis.fetch, now = () => performance.now(), ...config }) {
  const results = [];
  for (const check of buildChecks(config)) {
    if (check.skip) {
      results.push({ name: check.name, ok: true, skipped: true, status: null, latency_ms: null, detail: check.skip });
      continue;
    }
    const started = now();
    try {
      const response = await fetchImpl(check.url, check.init ?? {});
      const latency = Math.round(now() - started);
      const body = await response.json().catch(() => null);
      const detail = check.expect(response.status, body);
      results.push({ name: check.name, ok: !detail, status: response.status, latency_ms: latency, detail });
    } catch (error) {
      results.push({ name: check.name, ok: false, status: null, latency_ms: null, detail: error.message });
    }
  }
  return { ok: results.every((r) => r.ok), results };
}

/**
 * Formats a smoke report as plain text, one line per check plus a verdict line.
 *
 * @param {{ok: boolean, results: Array<{name: string, ok: boolean, skipped?: boolean,
 *   status: number|null, latency_ms: number|null, detail: string}>}} report
 * @returns {string}
 */
export function formatResults(report) {
  const lines = report.results.map((r) => {
    const mark = r.skipped ? 'OMITIDO' : r.ok ? 'OK' : 'FALLA';
    const status = r.status ?? '-';
    const latency = r.latency_ms === null ? '-' : `${r.latency_ms} ms`;
    return `${mark.padEnd(8)} ${r.name.padEnd(22)} ${String(status).padEnd(4)} ${latency}${r.detail ? `  ${r.detail}` : ''}`;
  });
  lines.push(report.ok ? 'Resultado: OK' : 'Resultado: FALLÓ');
  return lines.join('\n');
}

const isMain = typeof process !== 'undefined' && process.argv?.[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const config = resolveConfig(process.env);
  if (!config.apiBaseUrl) {
    console.error('Falta API_BASE_URL (por ejemplo https://<ref>.supabase.co/functions/v1/api).');
    process.exit(2);
  }
  console.log(`Smoke check: ${config.apiBaseUrl}  (${new Date().toISOString()})`);
  const report = await runSmoke(config);
  console.log(formatResults(report));
  process.exit(report.ok ? 0 : 1);
}
