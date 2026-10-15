import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('a rejection notice disappears by itself after five seconds', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?camera&rejected');
  const notice = page.getByRole('button', { name: /No detectamos un perro en la foto/ });
  await expect(notice).toBeVisible();
  await page.clock.fastForward(4000);
  await expect(notice).toBeVisible();
  await page.clock.fastForward(1500);
  await expect(notice).toHaveCount(0);
});

test('tapping the notice dismisses it before the timer', async ({ page }) => {
  await page.goto('/?camera&rejected');
  const notice = page.getByRole('button', { name: /No detectamos un perro en la foto/ });
  await notice.click();
  await expect(notice).toHaveCount(0);
});
