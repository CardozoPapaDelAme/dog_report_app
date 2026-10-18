import { test, expect } from '@playwright/test';

// RF12 / HU-12: cluster marker size grows with report_count inside fixed bounds.
// The fixture renders components/PublicMapView.js (the device map component) with
// MapLibre replaced by tests/ui/maplibre-stub.js, so only the marker the component
// builds is measured; real map tiles and projection are out of scope (T7 device).
// Bounds come from models/publicMap.js: CLUSTER_RADIUS_MIN_PX = 18,
// CLUSTER_RADIUS_MAX_PX = 48, saturation at 1000 reports (log scale).
const MIN_DIAMETER = 36;
const MAX_DIAMETER = 96;
const expectedDiameter = (count) => (count <= 1
  ? MIN_DIAMETER
  : 2 * (18 + 30 * Math.min(1, Math.log(count) / Math.log(1000))));

const errors = new WeakMap();
test.beforeEach(({ page }) => {
  const list = [];
  errors.set(page, list);
  page.on('pageerror', (error) => list.push(error.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

async function markerSize(page, count) {
  const marker = page.getByTestId(`cluster-count-${count}`)
    .getByRole('button', { name: `${count} reportes, gravedad baja`, exact: true });
  await expect(marker).toBeVisible();
  await expect(marker).toHaveText(String(count));
  // Markers scale in when they appear (components/ui/FadeIn.js): measure once the size stops changing.
  let previous = null;
  await expect.poll(async () => {
    const box = await marker.boundingBox();
    const settled = previous !== null && Math.abs(box.width - previous) < 0.01;
    previous = box.width;
    return settled;
  }, { intervals: [200], timeout: 5000 }).toBe(true);
  const box = await marker.boundingBox();
  return { width: box.width, height: box.height };
}

test('cluster markers grow with report_count between the minimum and maximum diameter', async ({ page }, info) => {
  await page.route(/\/(admin|association|public)\//, (route) => route.abort());
  await page.goto('/?native-map-clusters');
  const sizes = {};
  for (const count of [1, 2, 7, 100, 1000, 5000]) {
    sizes[count] = await markerSize(page, count);
    expect(sizes[count].width).toBeCloseTo(sizes[count].height, 0);
    expect(sizes[count].width).toBeCloseTo(expectedDiameter(count), 0);
  }
  // Minimum: a single report uses the smallest marker.
  expect(sizes[1].width).toBeCloseTo(MIN_DIAMETER, 0);
  // Average values grow strictly between the bounds.
  expect(sizes[2].width).toBeGreaterThan(sizes[1].width);
  expect(sizes[7].width).toBeGreaterThan(sizes[2].width);
  expect(sizes[100].width).toBeGreaterThan(sizes[7].width);
  expect(sizes[100].width).toBeLessThan(MAX_DIAMETER);
  // Maximum: 1000 reports saturate and larger counts never exceed the bound.
  expect(sizes[1000].width).toBeCloseTo(MAX_DIAMETER, 0);
  expect(sizes[5000].width).toBeCloseTo(MAX_DIAMETER, 0);
  await page.screenshot({ path: info.outputPath('cluster-size-bounds.png'), fullPage: true, animations: 'disabled' });
});
