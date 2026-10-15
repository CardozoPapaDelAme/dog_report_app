import { test, expect } from '@playwright/test';

const counts = (o = {}) => ({ avistamiento_simple: 0, ataque_mascota: 0, ataque_ganado: 0, ataque_humano: 0, perro_lastimado: 0, otro: 0, ...o });
const clusters = [
  { cluster_id: 'cluster-high', report_count: 7, approximate_location: { longitude: -107.64, latitude: 27.75 }, highest_severity: 'ataque_humano', type_counts: counts({ avistamiento_simple: 6, ataque_humano: 1 }) },
];

test.use({ viewport: { width: 390, height: 844 } });

test('tapping a cluster focuses it on the next clustering band and shows a compact card without a zoom button', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/public/clusters**', (route) => route.fulfill({ json: { data: clusters } }));
  await page.route('**/public/reports**', (route) => route.fulfill({ json: { data: [] } }));
  await page.goto('/?map');
  await expect(page.getByText('Zoom 13')).toBeVisible();
  await page.getByRole('button', { name: '7 reportes, gravedad alta' }).click();
  // 13 is in the 12-14 band; the next band starts at 15, where the server clusters with a smaller radius.
  await expect(page.getByText('Zoom 15')).toBeVisible();
  const card = page.getByTestId('cluster-modal');
  await expect(card.getByText('7 reportes en esta zona')).toBeVisible();
  const box = await card.boundingBox();
  expect(box.height).toBeLessThan(300);
  await expect(card.getByRole('button', { name: 'Acercar', exact: true })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Ver reportes de la zona' })).toBeVisible();
  await card.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.getByTestId('cluster-modal')).toHaveCount(0);
  expect(errors).toEqual([]);
});
