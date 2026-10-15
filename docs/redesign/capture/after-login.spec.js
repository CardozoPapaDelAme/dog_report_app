import { test } from '@playwright/test';
for (const [lang, locale] of [['es', 'es-MX'], ['en', 'en-US']]) {
  test.describe(lang, () => {
    test.use({ viewport: { width: 390, height: 844 }, locale });
    for (const [name, q] of [['login_default', '?login'], ['login_pending', '?login&pending'], ['login_loading', '?login&loading']]) {
      test(`${lang} ${name}`, async ({ page }) => {
        await page.goto('/' + q);
        await page.waitForTimeout(300);
        await page.screenshot({ path: `docs/redesign/after/web/${lang}_${name}.png` });
      });
    }
  });
}
