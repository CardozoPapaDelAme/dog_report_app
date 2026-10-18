import { test } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, locale: 'es-MX' });
test('result', async ({ page }) => {
  let mode = 'ok';
  await page.route('**/reports', async (route) => {
    const payload = route.request().postDataJSON();
    if (mode === 'error') return route.fulfill({ status: 500, json: { error: { code: 'internal_error' } } });
    await route.fulfill({ status: 201, json: { data: { report_id: payload.id, moderation_status: 'pending_review', photo_expected: false, photo_status_url: `/reports/${payload.id}/photo-status` } } });
  });
  await page.goto('/?report');
  await page.waitForTimeout(500);
  await page.getByTestId('report-submit').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/redesign/after/web/es_form_success.png' });
  mode = 'error';
  await page.goto('/?report');
  await page.waitForTimeout(500);
  await page.getByTestId('report-submit').click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/redesign/after/web/es_form_error.png' });
});
