import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// React Native 0.86 has no `StyleSheet.absoluteFillObject` (only `absoluteFill`), but react-native-web still
// does, so the web fixtures cannot catch it: spreading `undefined` leaves a style that is NOT absolute and
// overlays fall into normal layout flow on the phone. Keep it out of the app code.
const roots = ['screens', 'components', 'theme', 'navigation'];
const files = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return files(path);
  return /\.(js|jsx)$/.test(name) ? [path] : [];
});

test('app code never uses StyleSheet.absoluteFillObject', () => {
  const offenders = [
    ...roots.flatMap((root) => { try { return files(root); } catch { return []; } }),
    'App.js',
  ].filter((path) => readFileSync(path, 'utf8').includes('absoluteFillObject'));
  expect(offenders).toEqual([]);
});
