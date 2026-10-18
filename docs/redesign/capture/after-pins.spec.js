import { test } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, locale: 'es-MX' });
test('pins', async ({ page }) => {
  await page.goto('/?native-map-pins');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/redesign/after/web/es_map_pins.png', clip: { x: 0, y: 0, width: 390, height: 260 } });
});
