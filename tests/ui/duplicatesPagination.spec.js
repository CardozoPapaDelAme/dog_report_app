import { test, expect } from '@playwright/test';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const reports = Array.from({ length: 16 }, (_, i) => i + 1).map((n) => ({ id: id(n), status: 'visible', incident_type: 'avistamiento_simple', sighting_type: 'solitario', details: {}, dog: { predominant_color: 'café', size: 'mediano', has_collar: false }, location: { latitude: 27.73, longitude: -107.63 }, client_created_at: '2026-09-30T12:00:00Z' }));
const edges = Array.from({ length: 8 }, (_, i) => ({ id: id(100 + i), report_a: id(2 * i + 1), report_b: id(2 * i + 2), status: 'pending', distance_meters: 80, minutes_apart: 3, matched_signals: {} }));
const errors = new WeakMap();
test.beforeEach(({ page }) => { const list = []; errors.set(page, list); page.on('pageerror', (e) => list.push(e.message)); });
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

async function open(page) {
  await page.route('**/admin/duplicate-candidates', (route) => route.fulfill({ json: { data: { reports, candidates: edges } } }));
  await page.route('**/admin/duplicate-groups**', (route) => route.fulfill({ json: { data: { duplicate_groups: [] } } }));
  await page.goto('/?duplicates');
  await expect(page.getByText('Candidatos pendientes', { exact: true })).toBeVisible();
}

test('suggestions are paginated three at a time and the selection survives changing page', async ({ page }) => {
  await open(page);
  await expect(page.getByText('Sugerencia 1 · 2 reportes conectados', { exact: true })).toBeVisible();
  await expect(page.getByText('Sugerencia 3 · 2 reportes conectados', { exact: true })).toBeAttached();
  await expect(page.getByText('Sugerencia 4 · 2 reportes conectados', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Página 1 de 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
  await page.getByTestId(`duplicate-select-${id(1)}`).click();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByText('Página 2 de 3', { exact: true })).toBeVisible();
  await expect(page.getByText('Sugerencia 4 · 2 reportes conectados', { exact: true })).toBeAttached();
  await expect(page.getByText('Sugerencia 1 · 2 reportes conectados', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  await expect(page.getByTestId(`duplicate-select-${id(1)}`)).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByText('Página 3 de 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Siguiente', exact: true })).toBeDisabled();
});

test('the canonical control shows its own word and a single page shows no pager', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId(`duplicate-canonical-${id(1)}`)).toContainText('Canónico');
  await page.unroute('**/admin/duplicate-candidates');
  await page.route('**/admin/duplicate-candidates', (route) => route.fulfill({ json: { data: { reports: reports.slice(0, 4), candidates: edges.slice(0, 2) } } }));
  await page.getByRole('button', { name: 'Actualizar candidatos y grupos', exact: true }).click();
  await expect(page.getByText('Sugerencia 2 · 2 reportes conectados', { exact: true })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Siguiente', exact: true })).toHaveCount(0);
});
