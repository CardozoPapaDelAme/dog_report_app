import { test } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, locale: 'es-MX' });
for (const [name, q] of [['login_default', '?login'], ['login_pending', '?login&pending'], ['login_loading', '?login&loading']]) {
  test(name, async ({ page }) => {
    await page.goto('/' + q);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `docs/redesign/after/web/${name}.png` });
  });
}
test('login_keyboard_small', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto('/?login');
  await page.screenshot({ path: 'docs/redesign/after/web/login_short_viewport.png' });
});
