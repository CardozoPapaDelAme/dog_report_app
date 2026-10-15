import { test } from '@playwright/test';
for (const [lang, locale] of [['es', 'es-MX'], ['en', 'en-US']]) {
  test.describe(lang, () => {
    test.use({ viewport: { width: 390, height: 844 }, locale });
    test(`${lang} form`, async ({ page }) => {
      await page.route('**/reports', async (route) => {
        const payload = route.request().postDataJSON();
        await route.fulfill({ status: 201, json: { data: { report_id: payload.id, moderation_status: 'pending_review', photo_expected: false, photo_status_url: `/reports/${payload.id}/photo-status` } } });
      });
      await page.goto('/?report&photo&color');
      await page.waitForTimeout(600);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_form_start.png` });
      await page.getByTestId('report-incident_type-select').click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_form_incident_sheet.png` });
      await page.getByTestId('report-incident_type-ataque_mascota').click();
      await page.getByTestId('report-dog_size-grande').scrollIntoViewIfNeeded();
      await page.getByTestId('report-dog_size-grande').click();
      await page.getByTestId('report-has_collar-si').click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_form_filled.png` });
      await page.getByTestId('report-descripcion').scrollIntoViewIfNeeded();
      await page.getByTestId('report-descripcion').fill('Cerca de la plaza');
      await page.waitForTimeout(200);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_form_description.png` });
      await page.getByTestId('report-tipo_animal').fill('Gato');
      await page.getByTestId('report-submit').click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: `docs/redesign/after/web/${lang}_form_result.png` });
    });
  });
}
