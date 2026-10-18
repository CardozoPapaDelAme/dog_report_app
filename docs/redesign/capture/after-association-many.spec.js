import { test } from '@playwright/test';
const row = (n) => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, location: { longitude: -106.08, latitude: 28.63 }, incident_type: 'avistamiento_simple', sighting_type: 'solitario', details: { cantidad_aprox: 1 }, dog: { predominant_color: 'negro', size: 'mediano', has_collar: false }, has_sanitized_photo: false, occurred_at: '2026-09-01T12:00:00.000Z', accepted_at: '2026-09-28T12:00:00.000Z' });
test.use({ viewport: { width: 390, height: 844 }, locale: 'es-MX' });
test('many', async ({ page }) => {
  await page.route('**/association/reports?**', (r) => r.fulfill({ json: { data: { items: Array.from({ length: 25 }, (_, i) => row(i + 1)), next_cursor: null } } }));
  await page.goto('/?association');
  await page.waitForTimeout(700);
  await page.getByText('Página 1 de 5').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/redesign/after/web/es_association_pager.png' });
});
