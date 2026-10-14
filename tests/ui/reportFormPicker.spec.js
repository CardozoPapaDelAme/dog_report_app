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
