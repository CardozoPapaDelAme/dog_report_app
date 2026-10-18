import { test } from '@playwright/test';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const reports = [1,2,3,4,5].map((n) => ({ id: id(n), status: n === 2 ? 'hidden' : 'visible', incident_type: 'avistamiento_simple', sighting_type: 'solitario', details: { descripcion: `Evidencia original ${n}` }, dog: { predominant_color: 'café', size: 'mediano', has_collar: false }, location: { latitude: 27.73, longitude: -107.63 }, client_created_at: '2026-09-30T12:00:00Z' }));
const edges = [[1,2],[2,3],[4,5]].map(([a,b], i) => ({ id: id(10+i), report_a: id(a), report_b: id(b), status: 'pending', distance_meters: 100, minutes_apart: 2, matched_signals: {} }));
const group = { id: id(200), canonical_report_id: id(2), report_ids: [id(1), id(2), id(3)], status: 'active', resolution_version: 1, resolved_at: '2026-09-30T12:00:00Z', reversed_at: null };
for (const [lang, locale] of [['es', 'es-MX'], ['en', 'en-US']]) {
  test.describe(lang, () => {
    test.use({ viewport: { width: 390, height: 844 }, locale });
    test(`${lang} duplicates`, async ({ page }) => {
      let groups = [];
      await page.route('**/admin/duplicate-candidates', (r) => r.fulfill({ json: { data: { reports, candidates: edges } } }));
      await page.route('**/admin/duplicate-groups**', (r) => r.fulfill({ json: { data: { duplicate_groups: groups } } }));
      await page.goto('/?duplicates');
      await page.waitForTimeout(600);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_duplicates_start.png` });
      for (const n of [1, 2, 3]) await page.getByTestId(`duplicate-select-${id(n)}`).click();
      await page.getByTestId(`duplicate-canonical-${id(2)}`).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_duplicates_selected.png` });
      await page.getByTestId('duplicate-selection-summary').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_duplicates_decision.png` });
    });
  });
}
