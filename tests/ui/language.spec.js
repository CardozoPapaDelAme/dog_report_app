import { test, expect } from '@playwright/test';

test.describe('English device locale', () => {
  test.use({ locale: 'en-US' });
  test('Asociación dashboard renders in English with labelled date controls', async ({ page }) => {
    await page.route('**/association/reports?**', (route) => route.fulfill({ json: { data: { items: [], next_cursor: null } } }));
    await page.goto('/?association');
    await expect(page.getByText('Report period')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Last 7 days' })).toBeVisible();
    await page.getByRole('button', { name: 'Custom' }).click();
    await expect(page.getByRole('button', { name: /^From:/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^To:/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  });
});
