import { test, expect } from '@playwright/test';

const row = (number) => ({
  id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  location: { longitude: -106.08, latitude: 28.63 },
  incident_type: 'avistamiento_simple', sighting_type: 'solitario',
  details: { cantidad_aprox: 1 },
  dog: { predominant_color: null, size: 'mediano', has_collar: false },
  has_sanitized_photo: false,
  occurred_at: '2026-09-01T12:00:00.000Z',
  accepted_at: number === 2 ? '2026-09-29T12:00:00.000Z' : '2026-09-28T12:00:00.000Z',
});

async function freezeToday(page) {
  await page.addInitScript(() => {
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : ['2026-10-04T12:00:00'])); }
      static now() { return new RealDate('2026-10-04T12:00:00').valueOf(); }
    }
    window.Date = FixedDate;
  });
}

test('mobile cards and downloaded CSV contain the same complete filtered reports', async ({ page }, info) => {
  const cursors = [];
  await freezeToday(page);
  await page.route('**/association/reports?**', async (route) => {
    const url = new URL(route.request().url());
    expect(route.request().headers().authorization).toBe('Bearer test-session-a');
    cursors.push(url.searchParams.get('cursor'));
    if (url.searchParams.get('cursor')) return route.fulfill({ json: { data: { items: [row(2)], next_cursor: null } } });
    return route.fulfill({ json: { data: { items: [row(1)], next_cursor: 'next' } } });
  });
  await page.goto('/?association');
  await expect(page.getByText('2 reportes en este rango')).toBeVisible();
  await expect(page.getByTestId('association-report-card')).toHaveCount(2);
  await expect(page.getByTestId('association-report-table')).toHaveCount(0);
  await expect(page.getByTestId('association-total')).toHaveText('2');
  await expect(page.getByText('Por día')).toBeVisible();
  await expect(page.getByRole('button', { name: '28 de septiembre de 2026: 1 reporte aceptado' })).toBeInViewport();
  await expect(page.getByRole('button', { name: '29 de septiembre de 2026: 1 reporte aceptado' })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('association-summary-mobile.png'), fullPage: true });
  await page.getByTestId('association-report-card').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('association-cards-mobile.png') });
  await page.getByRole('button', { name: '28 de septiembre de 2026: 1 reporte aceptado' }).click();
  await expect(page.getByText('28 de septiembre de 2026 · 1 reporte aceptado')).toBeVisible();
  await page.getByRole('button', { name: 'Personalizado' }).click();
  await page.getByRole('button', { name: '28 de septiembre de 2026', exact: true }).click();
  await expect(page.getByText('Consulta este periodo para actualizar los resultados.')).toBeVisible();
  await expect(page.getByTestId('association-total')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'XLSX', exact: true })).toBeDisabled();
  // Picking the start date opens the end date calendar automatically.
  await page.getByRole('button', { name: 'Mes anterior' }).click();
  await page.getByRole('button', { name: '29 de septiembre de 2026', exact: true }).click();
  await page.getByRole('button', { name: 'Consultar' }).click();
  await expect(page.getByText('2 reportes en este rango')).toBeVisible();
  await expect(page.getByTestId('association-total')).toHaveText('2');
  expect(cursors).toContain(null);
  expect(cursors).toContain('next');
  const ids = [row(1).id, row(2).id];
  for (const id of ids) await expect(page.getByText(id)).toBeAttached();
  await expect(page.getByText('Cantidad aproximada de perros').first()).toBeAttached();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('reportes-asociacion_2026-09-28_2026-09-29.csv');
  const fs = await import('node:fs/promises');
  const csv = await fs.readFile(await download.path(), 'utf8');
  expect(csv.trim().split('\r\n')).toHaveLength(ids.length + 1);
  for (const id of ids) expect(csv).toContain(id);
  const xlsxDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'XLSX', exact: true }).click();
  const xlsxDownload = await xlsxDownloadPromise;
  expect(xlsxDownload.suggestedFilename()).toBe('reportes-asociacion_2026-09-28_2026-09-29.xlsx');
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await fs.readFile(await xlsxDownload.path()), { type: 'buffer' });
  const exportedRows = XLSX.utils.sheet_to_json(workbook.Sheets.Reportes, { header: 1 });
  expect(exportedRows).toHaveLength(ids.length + 1);
  expect(exportedRows.slice(1).map((values) => values[0])).toEqual(ids);
  expect(exportedRows[0][0]).toBe('id');
});

test('wide screens keep the report table instead of mobile cards', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('**/association/reports?**', (route) => route.fulfill({ json: { data: { items: [row(1)], next_cursor: null } } }));
  await page.goto('/?association');
  await expect(page.getByTestId('association-report-table')).toBeVisible();
  await expect(page.getByTestId('association-report-card')).toHaveCount(0);
  await expect(page.getByText(row(1).id)).toBeAttached();
  await expect(page.getByText('Cantidad aproximada de perros: 1')).toBeVisible();
  await expect(page.getByText('{"cantidad_aprox":1}')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('association-table-desktop.png') });
});

test('long date ranges show monthly bars from the accepted reports', async ({ page }) => {
  await freezeToday(page);
  await page.route('**/association/reports?**', (route) => route.fulfill({ json: { data: { items: [row(1), row(2)], next_cursor: null } } }));
  await page.goto('/?association');
  await expect(page.getByTestId('association-total')).toHaveText('2');
  await page.getByRole('button', { name: 'Personalizado' }).click();
  await page.getByRole('button', { name: 'Mes anterior' }).click();
  await page.getByRole('button', { name: '1 de agosto de 2026', exact: true }).click();
  // The end date calendar opens right after the start date.
  await page.getByRole('button', { name: '4 de octubre de 2026', exact: true }).click();
  await page.getByRole('button', { name: 'Consultar' }).click();
  await expect(page.getByText('Por mes')).toBeVisible();
  await page.getByRole('button', { name: 'septiembre de 2026: 2 reportes aceptados' }).click();
  await expect(page.getByText('septiembre de 2026 · 2 reportes aceptados')).toBeVisible();
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
  await expect(page.getByTestId('association-total')).toHaveText('0');
  await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'XLSX', exact: true })).toBeDisabled();
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
  await expect(page.getByTestId('association-total')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'XLSX', exact: true })).toBeDisabled();
  release();
  await expect(page.getByText('2 reportes en este rango')).toBeVisible();
  await expect(page.getByTestId('association-total')).toHaveText('2');
});
