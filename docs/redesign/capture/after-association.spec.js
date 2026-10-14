import { test } from '@playwright/test';
const row = (number) => ({ id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`, location: { longitude: -106.08, latitude: 28.63 }, incident_type: number === 2 ? 'ataque_mascota' : 'avistamiento_simple', sighting_type: number === 2 ? 'manada' : 'solitario', details: { cantidad_aprox: number }, dog: { predominant_color: 'negro', size: 'mediano', has_collar: false }, has_sanitized_photo: number === 2, occurred_at: '2026-09-01T12:00:00.000Z', accepted_at: `2026-09-${20 + number}T12:00:00.000Z` });
const items = [1, 2, 3, 4, 5, 6].map(row);
async function freeze(page) {
  await page.addInitScript(() => { const R = Date; class F extends R { constructor(...a) { super(...(a.length ? a : ['2026-10-04T12:00:00'])); } static now() { return new R('2026-10-04T12:00:00').valueOf(); } } window.Date = F; });
}
for (const [lang, locale] of [['es', 'es-MX'], ['en', 'en-US']]) {
  test.describe(lang, () => {
    test.use({ viewport: { width: 390, height: 844 }, locale });
    test(`${lang} association`, async ({ page }) => {
      await freeze(page);
      await page.route('**/association/reports?**', (r) => r.fulfill({ json: { data: { items, next_cursor: null } } }));
      await page.goto('/?association');
      await page.waitForTimeout(800);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_association_start.png` });
      await page.getByTestId('association-report-card').first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_association_list.png` });
      if (lang === 'es') {
        await page.getByRole('button', { name: 'Personalizado' }).click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `docs/redesign/after/web/${lang}_association_calendar.png` });
        await page.getByRole('button', { name: 'Cancelar' }).click();
        await page.waitForTimeout(300);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `docs/redesign/after/web/${lang}_association_custom.png` });
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `docs/redesign/after/web/${lang}_association_desktop.png` });
      }
    });
  });
}
