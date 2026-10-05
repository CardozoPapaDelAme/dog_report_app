import { test, expect } from '@playwright/test';

const row = (number) => ({
  id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  location: { longitude: -106.08, latitude: 28.63 },
  incident_type: 'avistamiento_simple', sighting_type: 'solitario',
  details: { cantidad_aprox: 1 },
  dog: { predominant_color: null, size: 'mediano', has_collar: false },
  has_sanitized_photo: false,
  occurred_at: '2026-09-01T12:00:00.000Z', accepted_at: '2026-09-02T12:00:00.000Z',
});

test('complete filtered table and downloaded CSV contain exactly the same reports', async ({ page }) => {
  const cursors = [];
  await page.addInitScript(() => {
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : ['2026-10-04T12:00:00'])); }
      static now() { return new RealDate('2026-10-04T12:00:00').valueOf(); }
    }
    window.Date = FixedDate;
  });
  await page.route('**/association/reports?**', async (route) => {
    const url = new URL(route.request().url());
    expect(route.request().headers().authorization).toBe('Bearer test-session-a');
    cursors.push(url.searchParams.get('cursor'));
    if (url.searchParams.get('cursor')) return route.fulfill({ json: { data: { items: [row(2)], next_cursor: null } } });
    return route.fulfill({ json: { data: { items: [row(1)], next_cursor: 'next' } } });
  });
  await page.goto('/?association');
  await expect(page.getByText('2 reportes en este rango')).toBeVisible();
  await page.getByRole('button', { name: 'Personalizado' }).click();
  await page.getByRole('button', { name: '1 de septiembre de 2026', exact: true }).click();
  await expect(page.getByText('Consulta este periodo para actualizar los resultados.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
  await page.getByRole('button', { name: /Hasta:/ }).click();
  await page.getByRole('button', { name: 'Mes anterior' }).click();
  await page.getByRole('button', { name: '3 de septiembre de 2026', exact: true }).click();
  await page.getByRole('button', { name: 'Consultar' }).click();
  await expect(page.getByText('2 reportes en este rango')).toBeVisible();
  expect(cursors).toContain(null);
  expect(cursors).toContain('next');
  const ids = [row(1).id, row(2).id];
  for (const id of ids) await expect(page.getByText(id)).toBeAttached();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('reportes-asociacion_2026-09-01_2026-09-03.csv');
  const fs = await import('node:fs/promises');
  const csv = await fs.readFile(await download.path(), 'utf8');
  expect(csv.trim().split('\r\n')).toHaveLength(ids.length + 1);
  for (const id of ids) expect(csv).toContain(id);
});

test('quick date presets request only the selected period', async ({ page }) => {
  await page.route('**/association/reports?**', (route) => route.fulfill({ json: { data: { items: [], next_cursor: null } } }));
  await page.goto('/?association');
  await expect(page.getByText('No hay resultados en este rango.')).toBeVisible();
  const expected = await page.evaluate(() => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { from: new Date(start.getFullYear(), start.getMonth(), start.getDate()).toISOString(),
      to: new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1).getTime() - 1 };
  });
  const requestPromise = page.waitForRequest('**/association/reports?**');
  await page.getByRole('button', { name: 'Últimos 7 días' }).click();
  const request = await requestPromise;
  const query = new URL(request.url()).searchParams;
  expect(query.get('from')).toBe(expected.from);
  expect(new Date(query.get('to')).getTime()).toBe(expected.to);
});

test('empty range explains the result and keeps export disabled', async ({ page }) => {
  await page.route('**/association/reports?**', (route) => route.fulfill({ json: { data: { items: [], next_cursor: null } } }));
  await page.goto('/?association');
  await expect(page.getByText('No hay resultados en este rango.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
});

test('loading remains visible until the final cursor page completes', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/association/reports?**', async (route) => {
    if (new URL(route.request().url()).searchParams.has('cursor')) {
      await gate;
      return route.fulfill({ json: { data: { items: [row(2)], next_cursor: null } } });
    }
    return route.fulfill({ json: { data: { items: [row(1)], next_cursor: 'next' } } });
  });
  await page.goto('/?association');
  await expect(page.getByText('Cargando todos los reportes del rango…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
  release();
  await expect(page.getByText('2 reportes en este rango')).toBeVisible();
});
