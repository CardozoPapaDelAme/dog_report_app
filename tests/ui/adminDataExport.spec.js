import { test, expect } from '@playwright/test';

// Clarification #27: the Administrator has its own export page in the Command Center. It reads the
// same accepted projection as the Asociación over intercepted HTTP; no real session or backend.
const row = {
  id: '00000000-0000-4000-8000-000000000001',
  location: { longitude: -106.08, latitude: 28.63 },
  incident_type: 'avistamiento_simple', sighting_type: 'solitario',
  details: { cantidad_aprox: 1 },
  dog: { predominant_color: null, size: 'mediano', has_collar: false },
  has_sanitized_photo: false,
  occurred_at: '2026-09-01T12:00:00.000Z',
  accepted_at: '2026-09-28T12:00:00.000Z',
};

test.use({ viewport: { width: 390, height: 844 } });

test('the Command Center offers the export tile only when it is wired', async ({ page }) => {
  await page.route('**/admin/moderation-queue**', (route) => route.fulfill({ json: { data: { items: [], next_cursor: null } } }));
  await page.goto('/?command-center&tools');
  await expect(page.getByRole('button', { name: 'Exportar datos' })).toBeVisible();
});

test('the Administrator export page queries the projection, downloads CSV and goes back', async ({ page }) => {
  const seen = [];
  await page.route('**/association/reports?**', async (route) => {
    seen.push(route.request().headers().authorization);
    await route.fulfill({ json: { data: { items: [row], next_cursor: null } } });
  });
  await page.goto('/?admin-export');
  await expect(page.getByRole('heading', { name: 'Exportar datos' })).toBeVisible();
  await expect(page.getByText('1 reporte en este rango')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Panel de la Asociación' })).toHaveCount(0);
  expect(seen[0]).toBe('Bearer test-session-a');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^reportes-aceptados_.*\.csv$/);
  await page.getByRole('button', { name: 'Volver a moderación' }).click();
  await expect(page.getByText('Formulario cerrado')).toBeVisible();
});
