/**
 * Playwright configuration for the redesign "before" screenshots.
 *
 * Run: npx playwright test -c docs/redesign/capture/playwright.capture.config.mjs
 * Reuses the test fixture server (tests/ui/serve-configuration.mjs) and its stubs without
 * modifying tests/ui or the main playwright config. Writes PNGs to docs/redesign/before/web/.
 *
 * @module docs/redesign/capture/playwright.capture.config
 */
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: process.env.CAPTURE_SPEC ?? 'capture.spec.js', fullyParallel: false, workers: 1,
  outputDir: '../../../test-results/redesign-capture',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4174', viewport: { width: 390, height: 844 }, headless: true },
  webServer: { command: 'node tests/ui/serve-configuration.mjs', cwd: '../../..', url: 'http://127.0.0.1:4174', reuseExistingServer: false, gracefulShutdown: { signal: 'SIGINT', timeout: 500 } },
});
