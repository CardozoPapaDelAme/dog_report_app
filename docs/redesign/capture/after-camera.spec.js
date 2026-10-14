import { test } from '@playwright/test';
for (const [lang, locale] of [['es', 'es-MX'], ['en', 'en-US']]) {
  test.describe(lang, () => {
    test.use({ viewport: { width: 390, height: 844 }, locale });
    test(`${lang} camera`, async ({ page }) => {
      await page.goto('/?camera');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_camera_live.png` });
      await page.goto('/?camera&no-permission');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_camera_permission.png` });
    });
  });
}
