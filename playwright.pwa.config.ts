import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pwa-e2e',
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-pages-preview.mjs',
    url: 'http://127.0.0.1:4174/prompt-library/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
