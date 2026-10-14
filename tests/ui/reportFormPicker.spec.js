import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('the incident sheet closes when tapping outside and keeps the current choice', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?report');
  await page.getByTestId('report-incident_type-select').click();
  await expect(page.getByTestId('report-incident_type-ataque_humano')).toBeVisible();
  await page.mouse.click(195, 250);
  await expect(page.getByTestId('report-incident_type-ataque_humano')).toHaveCount(0);
  await expect(page.getByTestId('report-incident_type-select')).toContainText('Avistamiento');
  expect(errors).toEqual([]);
});

test('choosing an option in the sheet closes it and updates the field', async ({ page }) => {
  await page.goto('/?report');
  await page.getByTestId('report-incident_type-select').click();
  await page.getByTestId('report-incident_type-perro_lastimado').click();
  await expect(page.getByTestId('report-incident_type-ataque_humano')).toHaveCount(0);
  await expect(page.getByTestId('report-incident_type-select')).toContainText('Perro lastimado');
  await expect(page.getByTestId('report-situacion-atrapado')).toBeVisible();
});

test('the photo thumbnail opens the full photo above the form and tapping closes it', async ({ page }) => {
  await page.goto('/?report&photo=sample');
  const thumbnail = page.getByRole('button', { name: 'Vista previa de la foto del reporte' });
  await expect(thumbnail).toBeVisible();
  await expect(page.getByText('Toca la foto para verla')).toBeVisible();
  await thumbnail.click();
  const full = page.getByRole('img', { name: 'Vista previa de la foto del reporte' }).first();
  await expect(full).toBeVisible();
  await expect(page.getByTestId('report-submit')).toBeVisible();
  await page.mouse.click(195, 400);
  await expect(full).toHaveCount(0);
  await expect(thumbnail).toBeVisible();
});

test('without a photo the header shows an empty tile and no viewer', async ({ page }) => {
  await page.goto('/?report');
  await expect(page.getByTestId('report-no-photo')).toBeVisible();
  await expect(page.getByText('Toca la foto para verla')).toHaveCount(0);
});
