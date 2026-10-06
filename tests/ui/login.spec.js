import { test, expect } from '@playwright/test';

const pageErrors = new WeakMap();
test.beforeEach(({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(({ page }) => expect(pageErrors.get(page)).toEqual([]));

test('login screen offers a way back to the camera', async ({ page }) => {
  await page.goto('/?login');
  await expect(page.getByText('Inicia sesión')).toBeVisible();
  await page.getByRole('button', { name: 'Volver a cámara' }).click();
  await expect(page.getByText('Cámara de prueba')).toBeVisible();
});
