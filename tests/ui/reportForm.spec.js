import { test, expect } from '@playwright/test';

const pageErrors = new WeakMap();

test.beforeEach(({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});

test.afterEach(({ page }) => expect(pageErrors.get(page)).toEqual([]));
async function openReport(page, routeHandler, query = '?report') {
  await page.route('**/reports', routeHandler);
  await page.goto(`/${query}`);
  await expect(page.getByText('Nuevo Reporte')).toBeVisible();
}

async function chooseIncident(page, value) {
  await page.getByTestId('report-incident_type-select').click();
  await page.getByTestId(`report-incident_type-${value}`).click();
}

test('shows only the conditional questions allowed for the selected incident', async ({ page }) => {
  await openReport(page, (route) => route.fulfill({ status: 500 }));

  const sightingOption = page.getByTestId('report-sighting_type-solitario');
  await expect(sightingOption).toBeVisible();
  const sightingPosition = await sightingOption.boundingBox();
  expect(sightingPosition).not.toBeNull();
  await page.getByTestId('report-incident_type-select').click();
  await expect(page.getByTestId('report-incident_type-ataque_humano')).toBeVisible();
  const sightingPositionAfterOpen = await sightingOption.boundingBox();
  expect(sightingPositionAfterOpen).not.toBeNull();
  expect(Math.round(sightingPositionAfterOpen.y)).toBe(Math.round(sightingPosition.y));
  await page.getByTestId('report-incident_type-avistamiento_simple').click();

  await expect(page.getByTestId('report-cantidad_aprox')).toHaveCount(0);
  await page.getByTestId('report-sighting_type-manada').click();
  await expect(page.getByTestId('report-cantidad_aprox')).toBeVisible();

  await chooseIncident(page, 'ataque_humano');
  await expect(page.getByTestId('report-hubo_mordida-si')).toBeVisible();
  await expect(page.getByTestId('report-cantidad_aprox')).toHaveCount(0);
  await expect(page.getByTestId('report-tipo_animal')).toHaveCount(0);

  await chooseIncident(page, 'ataque_mascota');
  await expect(page.getByTestId('report-tipo_animal')).toBeVisible();
  await expect(page.getByTestId('report-resulto_herido-si')).toBeVisible();
  await expect(page.getByTestId('report-cantidad_afectada')).toHaveCount(0);

  await chooseIncident(page, 'ataque_ganado');
  await expect(page.getByTestId('report-tipo_animal')).toBeVisible();
  await expect(page.getByTestId('report-cantidad_afectada')).toBeVisible();
  await expect(page.getByTestId('report-resulto_herido-si')).toHaveCount(0);

  await chooseIncident(page, 'perro_lastimado');
  await expect(page.getByTestId('report-situacion-atrapado')).toBeVisible();
  await expect(page.getByTestId('report-tipo_animal')).toHaveCount(0);

  await chooseIncident(page, 'otro');
  await expect(page.getByText('Para esta categoría no hay preguntas adicionales.')).toBeVisible();
  await expect(page.getByTestId('report-situacion-atrapado')).toHaveCount(0);
  await expect(page.getByTestId('report-dog_size-no_se')).toHaveCount(0);
  await expect(page.getByTestId('report-dog_size-chico')).toBeVisible();
});

test('submits one frozen payload with raw fingerprint and no duplicate POST on double tap', async ({ page }) => {
  const posts = [];
  await openReport(page, async (route) => {
    const payload = route.request().postDataJSON();
    posts.push(payload);
    await route.fulfill({
      status: 201,
      json: {
        data: {
          report_id: payload.id,
          moderation_status: 'pending_review',
          photo_expected: false,
          photo_status_url: `/reports/${payload.id}/photo-status`,
        },
      },
    });
  });

  await page.getByTestId('report-sighting_type-manada').click();
  await page.getByTestId('report-cantidad_aprox').fill('4');
  await page.getByTestId('report-descripcion').fill('Cerca de la plaza');
  await page.getByTestId('report-dog_size-grande').click();
  await page.getByTestId('report-has_collar-si').click();
  await page.getByTestId('report-submit').evaluate((button) => {
    button.click();
    button.click();
  });

  await expect(page.getByTestId('report-success')).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0].id).toBe('00000000-0000-4000-8000-000000000006');
  expect(posts[0].incident_type).toBe('avistamiento_simple');
  expect(posts[0].sighting_type).toBe('manada');
  expect(posts[0].details).toEqual({ descripcion: 'Cerca de la plaza', cantidad_aprox: 4 });
  expect(posts[0].dog).toEqual({ predominant_color: null, size: 'grande', has_collar: true });
  expect(posts[0].anti_abuse.device_fingerprint).toBe('  raw-device-fingerprint-001  ');
  expect(posts[0].anti_abuse.honeypot_filled).toBe(false);
  await expect(page.getByTestId('report-submit')).toBeDisabled();
});

test('shows distinct catalogued error messages', async ({ page }) => {
  let code = 'invalid_details';
  await openReport(page, (route) => route.fulfill({
    status: code === 'invalid_details' ? 400 : 503,
    json: { error: { code, message: code, request_id: 'request-1' } },
  }));

  await page.getByTestId('report-submit').click();
  await expect(page.getByText('Las respuestas no coinciden con las preguntas permitidas para este tipo de incidente.')).toBeVisible();

  code = 'geofence_not_configured';
  await page.goto('/?report');
  await page.getByTestId('report-submit').click();
  await expect(page.getByText('La zona activa de Creel no está configurada. El reporte queda pendiente.')).toBeVisible();
});

test('sets honeypot signal when a hidden field is filled and surfaces pending photo state', async ({ page }) => {
  const posts = [];
  await openReport(page, async (route) => {
    const payload = route.request().postDataJSON();
    posts.push(payload);
    await route.fulfill({
      status: 201,
      json: {
        data: {
          report_id: payload.id,
          moderation_status: 'pending_review',
          photo_expected: true,
          photo_status_url: `/reports/${payload.id}/photo-status`,
        },
      },
    });
  }, '?report&photo');

  await expect(page.getByText('Foto adjunta')).toHaveCount(0);
  await page.getByTestId('report-honeypot-contact').fill('bot@example.test', { force: true });
  await page.getByTestId('report-submit').click();
  await expect(page.getByTestId('report-photo-pending')).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0].photo.expected).toBe(true);
  expect(posts[0].anti_abuse.honeypot_filled).toBe(true);
});
