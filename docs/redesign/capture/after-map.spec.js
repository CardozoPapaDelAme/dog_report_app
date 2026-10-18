import { test } from '@playwright/test';
const counts = (o = {}) => ({ avistamiento_simple: 0, ataque_mascota: 0, ataque_ganado: 0, ataque_humano: 0, perro_lastimado: 0, otro: 0, ...o });
const clusters = [
  { cluster_id: 'c1', report_count: 7, approximate_location: { longitude: -107.64, latitude: 27.75 }, highest_severity: 'ataque_humano', type_counts: counts({ avistamiento_simple: 3, ataque_mascota: 1, ataque_ganado: 1, ataque_humano: 1, perro_lastimado: 1 }) },
  { cluster_id: 'c2', report_count: 2, approximate_location: { longitude: -107.7, latitude: 27.8 }, highest_severity: 'avistamiento_simple', type_counts: counts({ avistamiento_simple: 2 }) },
];
const reports = [
  { report_id: '00000000-0000-4000-8000-0000000000a1', approximate_location: { longitude: -107.64, latitude: 27.75 }, incident_type: 'ataque_mascota', sighting_type: 'manada', details: { cantidad_aprox: 3, descripcion: 'Cerca del mercado' }, dog: { predominant_color: 'negro', size: 'grande', has_collar: true }, has_sanitized_photo: false, occurred_at: '2026-09-27T14:30:00.000Z', has_flags: true },
  { report_id: '00000000-0000-4000-8000-0000000000a2', approximate_location: { longitude: -107.65, latitude: 27.76 }, incident_type: 'avistamiento_simple', sighting_type: 'solitario', details: {}, dog: { predominant_color: null, size: null, has_collar: null }, has_sanitized_photo: false, occurred_at: '2026-09-28T10:00:00.000Z', has_flags: false },
];
for (const [lang, locale] of [['es', 'es-MX'], ['en', 'en-US']]) {
  test.describe(lang, () => {
    test.use({ viewport: { width: 390, height: 844 }, locale });
    test(`${lang} map`, async ({ page }) => {
      await page.route('**/public/clusters**', (r) => r.fulfill({ json: { data: clusters } }));
      await page.route('**/public/reports**', (r) => r.fulfill({ json: { data: reports } }));
      await page.goto('/?map');
      await page.waitForTimeout(600);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_map_start.png` });
      await page.getByRole('button', { name: /^7 /u }).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_map_cluster.png` });
      await page.getByTestId('cluster-modal').getByRole('button', { name: /Ver reportes|View area/ }).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_map_zone.png` });
      await page.getByTestId('zone-sheet').getByRole('button', { name: /Ataque a mascota|Pet attack/ }).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_map_pin.png` });
      await page.getByTestId('pin-sheet').getByRole('button', { name: /Denunciar|Report/ }).first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_map_flag.png` });
    });
    test(`${lang} map offline + clusters`, async ({ page }) => {
      await page.route('**/public/clusters**', (r) => r.abort('failed'));
      await page.route('**/public/reports**', (r) => r.abort('failed'));
      await page.goto('/?map');
      await page.waitForTimeout(800);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_map_offline.png` });
      await page.goto('/?native-map-clusters');
      await page.waitForTimeout(600);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_map_markers.png` });
    });
  });
}
