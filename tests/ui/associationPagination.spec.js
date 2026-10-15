import { test, expect } from '@playwright/test';
const row = (number) => ({
  id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  location: { longitude: -106.08, latitude: 28.63 },
  incident_type: 'avistamiento_simple', sighting_type: 'solitario',
  details: { cantidad_aprox: 1 },
  dog: { predominant_color: null, size: 'mediano', has_collar: false },
  has_sanitized_photo: false,
  occurred_at: '2026-09-01T12:00:00.000Z',
  accepted_at: '2026-09-28T12:00:00.000Z',
});
const errors = new WeakMap();
test.beforeEach(({ page }) => { const list = []; errors.set(page, list); page.on('pageerror', (e) => list.push(e.message)); });
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

async function open(page, count) {
  await page.route('**/association/reports?**', (route) => route.fulfill({ json: { data: { items: Array.from({ length: count }, (_, i) => row(i + 1)), next_cursor: null } } }));
  await page.goto('/?association');
  await expect(page.getByText(`${count} reportes en este rango`)).toBeVisible();
}

test('mobile list shows five reports per page and the total stays complete', async ({ page }) => {
  await open(page, 25);
  await expect(page.getByTestId('association-total')).toHaveText('25');
  await expect(page.getByTestId('association-report-card')).toHaveCount(5);
  await expect(page.getByText('Página 1 de 5', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByText('Página 2 de 5', { exact: true })).toBeVisible();
  await expect(page.getByText(row(6).id)).toBeAttached();
  await expect(page.getByText(row(1).id)).toHaveCount(0);
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByText('Página 5 de 5', { exact: true })).toBeVisible();
  await expect(page.getByTestId('association-report-card')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Siguiente', exact: true })).toBeDisabled();
});

test('few reports show no pager and export stays enabled', async ({ page }) => {
  await open(page, 4);
  await expect(page.getByTestId('association-report-card')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Siguiente', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeEnabled();
});

test('choosing the start date opens the end date calendar automatically', async ({ page }) => {
  await open(page, 3);
  await page.getByRole('button', { name: 'Personalizado' }).click();
  await expect(page.getByText('Elige la fecha inicial', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mes anterior' }).click();
  await page.getByRole('button', { name: /^1 de .* de 20\d\d$/ }).first().click();
  await expect(page.getByText('Elige la fecha final', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByText('Elige la fecha final', { exact: true })).toHaveCount(0);
});
