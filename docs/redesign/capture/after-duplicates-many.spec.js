import { test } from '@playwright/test';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const reports = Array.from({ length: 16 }, (_, i) => i + 1).map((n) => ({ id: id(n), status: n === 2 ? 'hidden' : 'visible', incident_type: 'avistamiento_simple', sighting_type: 'solitario', details: {}, dog: { predominant_color: 'café', size: 'mediano', has_collar: false }, location: { latitude: 27.73, longitude: -107.63 }, client_created_at: '2026-09-30T12:00:00Z' }));
const edges = Array.from({ length: 8 }, (_, i) => ({ id: id(100 + i), report_a: id(2 * i + 1), report_b: id(2 * i + 2), status: 'pending', distance_meters: 80, minutes_apart: 3, matched_signals: {} }));
test.use({ viewport: { width: 390, height: 844 }, locale: 'es-MX' });
test('many', async ({ page }) => {
  await page.route('**/admin/duplicate-candidates', (r) => r.fulfill({ json: { data: { reports, candidates: edges } } }));
  await page.route('**/admin/duplicate-groups**', (r) => r.fulfill({ json: { data: { duplicate_groups: [] } } }));
  await page.goto('/?duplicates');
  await page.waitForTimeout(500);
  await page.getByTestId(`duplicate-select-${id(1)}`).click();
  await page.getByTestId(`duplicate-select-${id(2)}`).click();
  await page.getByTestId(`duplicate-canonical-${id(2)}`).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/redesign/after/web/es_duplicates_many_a.png' });
  await page.getByText('Página 1 de 3').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'docs/redesign/after/web/es_duplicates_many_pager.png' });
});
