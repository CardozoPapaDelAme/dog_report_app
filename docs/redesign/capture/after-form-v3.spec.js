import { test } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, locale: 'es-MX' });
test('form v3', async ({ page }) => {
  await page.goto('/?report&photo=sample&color');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/redesign/after/web/es_form_v3_start.png' });
  await page.getByTestId('report-dog_size-grande').scrollIntoViewIfNeeded();
  await page.getByTestId('report-dog_size-grande').click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'docs/redesign/after/web/es_form_v3_dog.png' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Vista previa de la foto del reporte' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/redesign/after/web/es_form_v3_photo.png' });
});
