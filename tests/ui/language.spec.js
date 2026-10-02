import { test, expect } from '@playwright/test';

test.describe('English device locale', () => {
  test.use({ locale: 'en-US' });
  test('Asociación dashboard renders in English with labelled inputs', async ({ page }) => {
    await page.route('**/association/reports?**', (route) => route.fulfill({ json: { data: { items: [], next_cursor: null } } }));
    await page.goto('/?association');
    await expect(page.getByRole('textbox', { name: 'From' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'To' })).toHaveAttribute('placeholder', 'YYYY-MM-DD');
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  });
});
