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

test('back button is hidden while the session is being checked', async ({ page }) => {
  await page.goto('/?login&loading');
  await expect(page.getByText('Comprobando sesión…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Volver a cámara' })).toHaveCount(0);
});

test('back button is hidden when no back handler is provided', async ({ page }) => {
  await page.goto('/?login&no-back');
  await expect(page.getByText('Inicia sesión')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Volver a cámara' })).toHaveCount(0);
});

test('back button is disabled while sign-in is pending', async ({ page }) => {
  await page.goto('/?login&pending');
  const back = page.getByRole('button', { name: 'Volver a cámara' });
  await expect(back).toBeDisabled();
  await back.click({ force: true });
  await expect(page.getByText('Cámara de prueba')).toHaveCount(0);
});
