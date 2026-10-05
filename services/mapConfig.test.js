import { DEFAULT_MAP_STYLE_URL, getMapStyleUrl } from './mapConfig.js';

function assertEquals(actual, expected) {
  if (actual !== expected) throw new Error(`expected ${expected}, got ${actual}`);
}

Deno.test('getMapStyleUrl falls back to OpenFreeMap for unset or blank values', () => {
  assertEquals(getMapStyleUrl(null), DEFAULT_MAP_STYLE_URL);
  assertEquals(getMapStyleUrl('   '), DEFAULT_MAP_STYLE_URL);
  assertEquals(DEFAULT_MAP_STYLE_URL, 'https://tiles.openfreemap.org/styles/liberty');
});

Deno.test('getMapStyleUrl uses a trimmed override', () => {
  assertEquals(getMapStyleUrl(' https://example.test/style.json '), 'https://example.test/style.json');
});
