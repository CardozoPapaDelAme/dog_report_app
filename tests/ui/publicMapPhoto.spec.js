import { test, expect } from '@playwright/test';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const counts = (o = {}) => ({ avistamiento_simple: 0, ataque_mascota: 0, ataque_ganado: 0, ataque_humano: 0, perro_lastimado: 0, otro: 0, ...o });
const cluster = { cluster_id: 'c1', report_count: 1, approximate_location: { longitude: -107.64, latitude: 27.75 }, highest_severity: 'ataque_mascota', type_counts: counts({ ataque_mascota: 1 }) };
const report = { report_id: '00000000-0000-4000-8000-0000000000a1', approximate_location: { longitude: -107.64, latitude: 27.75 }, incident_type: 'ataque_mascota', sighting_type: 'solitario', details: {}, dog: { predominant_color: null, size: null, has_collar: null }, has_sanitized_photo: true, occurred_at: '2026-09-27T14:30:00.000Z', has_flags: false };

test.use({ viewport: { width: 390, height: 844 } });

test('tapping the photo of a report opens it full size above the detail and tapping closes it', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/public/clusters**', (route) => route.fulfill({ json: { data: [cluster] } }));
  await page.route('**/public/reports**', (route) => route.fulfill({ json: { data: [report] } }));
  await page.route('**/reports/*/photo', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: png }));
  await page.goto('/?map');
  await page.getByRole('button', { name: /^1 reporte/ }).click();
  await page.getByTestId('cluster-modal').getByRole('button', { name: 'Ver reportes de la zona' }).click();
  await page.getByTestId('zone-sheet').getByRole('button', { name: /Ataque a mascota/ }).click();
  const photo = page.getByRole('button', { name: 'Foto del reporte' });
  await expect(photo).toBeVisible();
  await photo.click();
  const viewer = page.getByRole('button', { name: 'Cerrar', exact: true }).last();
  await expect(viewer).toBeVisible();
  await expect(page.getByRole('img', { name: 'Foto del reporte' }).first()).toBeVisible();
  await page.mouse.click(195, 400);
  await expect(photo).toBeVisible();
  await expect(page.getByTestId('pin-sheet')).toBeVisible();
  expect(errors).toEqual([]);
});
