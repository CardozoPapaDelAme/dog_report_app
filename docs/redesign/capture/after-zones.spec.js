import { test } from '@playwright/test';
import { createHash } from 'node:crypto';
const id = '00000000-0000-4000-8000-000000000005';
const geometry = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] };
const canonical = { type: 'MultiPolygon', coordinates: [geometry.coordinates] };
const checksum = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
const zone = { id, environment: 'staging', version: 2, name: 'Zona de prueba', source_uri: 'https://example.test/zona.geojson', source_version: 'v2', source_sha256: checksum, geometry: canonical, status: 'draft' };
const active = { ...zone, id: '00000000-0000-4000-8000-000000000001', version: 1, name: 'Creel centro', status: 'active', association_approval_reference: 'AHC-2026-01' };
const configuration = { id: 'c1', environment: 'staging', version: 1, is_active: true, flag_auto_hide_threshold: 5, duplicate_radius_meters: 150, duplicate_time_window_minutes: 120, trust_high_threshold: 0.8, trust_medium_threshold: 0.5, gps_accuracy_max_meters: 50, report_rate_limit_per_hour: 10, flag_rate_limit_per_hour: 30 };
for (const [lang, locale] of [['es', 'es-MX'], ['en', 'en-US']]) {
  test.describe(lang, () => {
    test.use({ viewport: { width: 390, height: 844 }, locale });
    test(`${lang} zones flow`, async ({ page }) => {
      await page.route('**/admin/configuration', (r) => r.fulfill({ json: { data: { configuration, zone_set: active } } }));
      await page.route('**/admin/zone-sets**', (r) => r.fulfill({ status: r.request().url().endsWith('/activate') ? 200 : 201, json: { data: { zone_set: r.request().url().endsWith('/activate') ? { ...zone, status: 'active', association_approval_reference: 'AHC-TEST-5' } : zone } } }));
      await page.goto('/?zones');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_zones_start.png` });
      await page.getByTestId('zone-content').fill(JSON.stringify(geometry));
      await page.getByTestId('zone-content').press('Tab');
      await page.getByTestId('zone-checksum-preview').waitFor({ state: 'detached', timeout: 500 }).catch(() => {});
      await page.getByRole('button', { name: /Calcular checksum|Calculate checksum/ }).click();
      for (const [k, v] of Object.entries({ name: zone.name, source_uri: zone.source_uri, source_version: 'v2' })) await page.getByTestId(`zone-${k}`).fill(v);
      await page.getByTestId('zone-name').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_zones_prepared.png` });
      await page.getByTestId('zone-create').click();
      await page.getByTestId('zone-draft-status').waitFor();
      await page.getByTestId('zone-association_approval_reference').fill('AHC-TEST-5');
      await page.getByTestId('zone-draft-status').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_zones_draft.png` });
      await page.getByTestId('zone-activate').click();
      await page.getByTestId('zone-activated').waitFor();
      await page.getByTestId('zone-activated').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_zones_activated.png` });
    });
  });
}
