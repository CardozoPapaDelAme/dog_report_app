import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui', testMatch: '**/*.spec.js', fullyParallel: false, workers: 1,
  use: { locale: 'es-MX', baseURL: 'http://127.0.0.1:4174', viewport: {width:390,height:844}, headless:true },
  webServer: { command:'node tests/ui/serve-configuration.mjs', url:'http://127.0.0.1:4174', reuseExistingServer:false, gracefulShutdown:{signal:'SIGINT',timeout:500} },
});
