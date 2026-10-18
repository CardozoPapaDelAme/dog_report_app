#!/usr/bin/env node
/**
 * Uploads the bundled demo photos (assets/demo/photos) to the eight demo reports created by
 * scripts/demo-seed.sql, through the public API exactly like the mobile app does:
 * `POST <DEMO_API_URL>/reports/<report_id>/photo` with the demo `X-Device-Fingerprint` and a
 * multipart body that holds a single `photo` part. The API sanitizes, stores and approves each photo.
 *
 * Environment:
 *   DEMO_API_URL  required, e.g. https://<project-ref>.supabase.co/functions/v1/api
 *   DEMO_API_KEY  optional publishable key, sent only as the `apikey` header (never as Authorization)
 *
 * Usage: node scripts/demo-photos.mjs [--dry-run]
 * Idempotent: a photo the API already holds answers 200 and counts as success. Exits with 1 when any
 * upload fails and 2 on configuration errors. See docs/DEMO_DATA.md.
 *
 * @module scripts/demo-photos
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Fixed demo device fingerprint; demo-seed.sql stores sha256 of this exact string. */
export const DEMO_FINGERPRINT = 'demo-creel-photo-uploader-2026';

const PHOTOS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'demo', 'photos');

/** Demo report number -> bundled photo file. Keep in sync with demo-seed.sql and CREDITS.md. */
const PHOTOS = [
  [1, 'report-01-perro-cafe-calle.jpg'],
  [6, 'report-06-perrito-blanco-banqueta.jpg'],
  [10, 'report-10-perrita-flaca-barda.jpg'],
  [16, 'report-16-dos-perros-empedrado.jpg'],
  [17, 'report-17-perro-blanco-callejon.jpg'],
  [19, 'report-19-perro-gris-collar.jpg'],
  [21, 'report-21-cachorro-hojas.jpg'],
  [25, 'report-25-manada-mirador.jpg'],
];

/** Builds the demo report id for report number `n`. */
function demoReportId(n) {
  return `de300000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** Uploads one photo and returns a printable result line plus success flag. */
async function uploadOne(baseUrl, apiKey, n, file) {
  const reportId = demoReportId(n);
  const bytes = await readFile(join(PHOTOS_DIR, file));
  const form = new FormData();
  form.append('photo', new Blob([bytes], { type: 'image/jpeg' }), file);

  const headers = { 'X-Device-Fingerprint': DEMO_FINGERPRINT, Accept: 'application/json' };
  if (apiKey) headers.apikey = apiKey;

  let response;
  try {
    response = await fetch(`${baseUrl}/reports/${reportId}/photo`, {
      method: 'POST',
      headers,
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    return { ok: false, line: `FAIL  ${reportId}  ${file}  network: ${error.message}` };
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON body; the status code is reported below.
  }
  if (response.status === 201 || response.status === 200) {
    const label = response.status === 201 ? 'OK   ' : 'SAME ';
    const state = payload?.data?.state ?? 'unknown';
    return { ok: true, line: `${label} ${reportId}  ${file}  HTTP ${response.status} (${state})` };
  }
  const code = payload?.error?.code ?? 'unknown_error';
  const requestId = payload?.error?.request_id ?? response.headers.get('X-Request-Id') ?? '-';
  return {
    ok: false,
    line: `FAIL  ${reportId}  ${file}  HTTP ${response.status} ${code} (request ${requestId})`,
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    for (const [n, file] of PHOTOS) {
      const size = (await readFile(join(PHOTOS_DIR, file))).length;
      console.log(`DRY   ${demoReportId(n)}  ${file}  ${size} bytes`);
    }
    return 0;
  }

  const baseUrl = (process.env.DEMO_API_URL ?? '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(baseUrl)) {
    console.error('DEMO_API_URL is required, e.g. https://<project-ref>.supabase.co/functions/v1/api');
    return 2;
  }
  const apiKey = (process.env.DEMO_API_KEY ?? '').trim();

  let failures = 0;
  for (const [n, file] of PHOTOS) {
    const result = await uploadOne(baseUrl, apiKey, n, file);
    console.log(result.line);
    if (!result.ok) failures += 1;
  }
  console.log(`\n${PHOTOS.length - failures}/${PHOTOS.length} demo photos available.`);
  return failures ? 1 : 0;
}

process.exitCode = await main();
