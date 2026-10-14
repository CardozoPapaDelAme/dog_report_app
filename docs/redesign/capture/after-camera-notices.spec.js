import { test } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, locale: 'es-MX' });
for (const flag of ['rejected', 'blurry', 'validating']) {
  test(flag, async ({ page }) => {
    await page.goto(`/?camera&${flag}`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `docs/redesign/after/web/es_camera_${flag}.png` });
  });
}
