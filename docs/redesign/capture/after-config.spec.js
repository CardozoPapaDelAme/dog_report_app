import { test } from '@playwright/test';
const cfg = { id:'c1',environment:'staging',version:3,is_active:true,flag_auto_hide_threshold:5,duplicate_radius_meters:150,duplicate_time_window_minutes:120,trust_high_threshold:0.8,trust_medium_threshold:0.5,gps_accuracy_max_meters:50,report_rate_limit_per_hour:10,flag_rate_limit_per_hour:30,change_note:'Ajuste tras revisar la zona' };
for (const [lang, locale] of [['es', 'es-MX'], ['en', 'en-US']]) {
  test.describe(lang, () => {
    test.use({ viewport: { width: 390, height: 844 }, locale });
    test(`${lang} config loaded + error`, async ({ page }) => {
      await page.route('**/admin/configuration', (r) => r.fulfill({ json: { data: { configuration: cfg, zone_set: null } } }));
      await page.goto('/');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_configuration_loaded.png` });
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_configuration_full.png`, fullPage: true });
      if (lang === 'es') {
        await page.getByTestId('configuration-gps_accuracy_max_meters').fill('501');
        await page.getByTestId('configuration-change_note').fill('x');
        await page.getByTestId('configuration-save').click();
        await page.waitForTimeout(700);
        await page.screenshot({ path: `docs/redesign/after/web/${lang}_configuration_field_error.png` });
        await page.setViewportSize({ width: 1200, height: 900 });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `docs/redesign/after/web/${lang}_configuration_desktop.png`, fullPage: true });
      }
    });
    test(`${lang} config forbidden`, async ({ page }) => {
      await page.route('**/admin/configuration', (r) => r.fulfill({ status: 403, json: { error: { code: 'forbidden' } } }));
      await page.goto('/');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_configuration_forbidden.png` });
    });
  });
}
