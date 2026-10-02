import { test, expect } from '@playwright/test';

const counts = (overrides = {}) => ({
  avistamiento_simple: 0, ataque_mascota: 0, ataque_ganado: 0, ataque_humano: 0, perro_lastimado: 0, otro: 0, ...overrides,
});
const clusters = [
  { cluster_id: 'cluster-high', report_count: 7, approximate_location: { longitude: -107.64, latitude: 27.75 }, highest_severity: 'ataque_humano',
    type_counts: counts({ avistamiento_simple: 3, ataque_mascota: 1, ataque_ganado: 1, ataque_humano: 1, perro_lastimado: 1 }) },
  { cluster_id: 'cluster-low', report_count: 2, approximate_location: { longitude: -107.7, latitude: 27.8 }, highest_severity: 'avistamiento_simple',
    type_counts: counts({ avistamiento_simple: 2 }) },
];
const reports = [
  { report_id: '00000000-0000-4000-8000-0000000000a1', approximate_location: { longitude: -107.64, latitude: 27.75 }, incident_type: 'ataque_mascota',
    sighting_type: 'manada', details: { cantidad_aprox: 3, descripcion: 'Cerca del mercado' }, dog: { predominant_color: 'negro', size: 'grande', has_collar: true },
    has_sanitized_photo: false, occurred_at: '2026-09-27T14:30:00.000Z', has_flags: true },
  { report_id: '00000000-0000-4000-8000-0000000000a2', approximate_location: { longitude: -107.65, latitude: 27.76 }, incident_type: 'avistamiento_simple',
    sighting_type: 'solitario', details: {}, dog: { predominant_color: null, size: null, has_collar: null },
    has_sanitized_photo: false, occurred_at: '2026-09-28T10:00:00.000Z', has_flags: false },
];

const pageErrors = new WeakMap();
test.beforeEach(({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(({ page }) => expect(pageErrors.get(page)).toEqual([]));

// Records every public request; `handlers` may override the response per path.
async function mockPublic(page, { clusterHandler, reportHandler } = {}) {
  const seen = { clusters: [], reports: [] };
  await page.route('**/public/clusters**', async (route) => {
    seen.clusters.push({ url: new URL(route.request().url()), headers: route.request().headers() });
    if (clusterHandler) return clusterHandler(route, seen.clusters.length);
    return route.fulfill({ json: { data: clusters } });
  });
  await page.route('**/public/reports**', async (route) => {
    seen.reports.push({ url: new URL(route.request().url()), headers: route.request().headers() });
    if (reportHandler) return reportHandler(route, seen.reports.length);
    return route.fulfill({ json: { data: reports } });
  });
  return seen;
}

const open = (page) => page.goto('/?map');
const zoomIn = (page) => page.getByRole('button', { name: 'Acercar', exact: true });

test('renders clusters with counts and severity, and sends no Authorization header', async ({ page }) => {
  const seen = await mockPublic(page);
  await open(page);
  await expect(page.getByRole('button', { name: '7 reportes, gravedad alta' })).toBeVisible();
  await expect(page.getByRole('button', { name: '2 reportes, gravedad baja' })).toBeVisible();
  await expect(page.getByText('© OpenMapTiles © OpenStreetMap contributors')).toBeVisible();
  expect(seen.reports).toHaveLength(0);
  for (const request of seen.clusters) expect(request.headers.authorization).toBeUndefined();
});

test('sends zoom and all four viewport params together', async ({ page }) => {
  const seen = await mockPublic(page);
  await open(page);
  await expect(page.getByRole('button', { name: '7 reportes, gravedad alta' })).toBeVisible();
  const params = seen.clusters.at(-1).url.searchParams;
  expect(params.get('zoom')).toBe('13');
  const viewport = ['min_longitude', 'min_latitude', 'max_longitude', 'max_latitude'].map((key) => params.has(key));
  expect(viewport).toEqual([true, true, true, true]);
  for (const request of seen.clusters) {
    const present = ['min_longitude', 'min_latitude', 'max_longitude', 'max_latitude'].filter((key) => request.url.searchParams.has(key));
    expect([0, 4]).toContain(present.length);
  }
});

test('tapping a cluster shows the six type counts', async ({ page }) => {
  await mockPublic(page);
  await open(page);
  await page.getByRole('button', { name: '7 reportes, gravedad alta' }).click();
  const modal = page.getByTestId('cluster-modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('7 reportes en esta zona')).toBeVisible();
  await expect(modal.getByText('Mayor gravedad: Ataque a persona')).toBeVisible();
  const expected = [['Avistamiento', '3'], ['Ataque a mascota', '1'], ['Ataque a ganado', '1'], ['Ataque a persona', '1'], ['Perro lastimado', '1'], ['Otro', '0']];
  for (const [label, value] of expected) {
    const row = modal.locator('div', { has: page.getByText(label, { exact: true }) }).filter({ hasText: new RegExp(`^${label}${value}$`) });
    await expect(row.first()).toBeVisible();
  }
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(modal).toHaveCount(0);
});

test('zooming in to 17 switches to pins and a flagged pin shows details and notice', async ({ page }) => {
  const seen = await mockPublic(page);
  await open(page);
  await expect(page.getByRole('button', { name: '7 reportes, gravedad alta' })).toBeVisible();
  for (let level = 14; level <= 16; level++) {
    await zoomIn(page).click();
    await expect(page.getByText(`Zoom ${level}`)).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /Reporte:/ })).toHaveCount(0);
  expect(seen.reports).toHaveLength(0);
  await zoomIn(page).click();
  await expect(page.getByText('Zoom 17')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reporte: Ataque a mascota' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reporte: Avistamiento' })).toBeVisible();
  await expect(page.getByRole('button', { name: /gravedad/ })).toHaveCount(0);
  expect(seen.reports.length).toBeGreaterThan(0);
  expect(seen.reports[0].headers.authorization).toBeUndefined();

  await page.getByRole('button', { name: 'Reporte: Ataque a mascota' }).click();
  const sheet = page.getByTestId('pin-sheet');
  await expect(sheet.getByText('La comunidad marcó este reporte')).toBeVisible();
  await expect(sheet.getByText('Manada', { exact: true })).toBeVisible();
  await expect(sheet.getByText('negro', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Cerca del mercado')).toBeVisible();
  await sheet.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await page.getByRole('button', { name: 'Reporte: Avistamiento' }).click();
  await expect(page.getByTestId('pin-sheet')).toBeVisible();
  await expect(page.getByText('La comunidad marcó este reporte')).toHaveCount(0);
});

test('shows the empty state when the server returns no clusters', async ({ page }) => {
  await mockPublic(page, { clusterHandler: (route) => route.fulfill({ json: { data: [] } }) });
  await open(page);
  await expect(page.getByText('No hay reportes en esta zona')).toBeVisible();
});

test('shows an error and recovers on retry (500 then 200)', async ({ page }) => {
  await mockPublic(page, {
    clusterHandler: (route, call) => (call === 1
      ? route.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'Boom' } } })
      : route.fulfill({ json: { data: clusters } })),
  });
  await open(page);
  await expect(page.getByText('No pudimos cargar el mapa.')).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('button', { name: '7 reportes, gravedad alta' })).toBeVisible();
  await expect(page.getByText('No pudimos cargar el mapa.')).toHaveCount(0);
});

test('shows the offline message with the reporting hint and recovers on retry', async ({ page }) => {
  let online = false;
  await mockPublic(page, {
    clusterHandler: (route) => (online ? route.fulfill({ json: { data: clusters } }) : route.abort('internetdisconnected')),
  });
  await open(page);
  await expect(page.getByText('El mapa no está disponible sin conexión')).toBeVisible();
  await expect(page.getByText('Puedes seguir creando reportes; se enviarán cuando haya conexión.')).toBeVisible();
  online = true;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('button', { name: '7 reportes, gravedad alta' })).toBeVisible();
});
