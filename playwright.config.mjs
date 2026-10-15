import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '*.spec.mjs', workers: 1, timeout: 40000,
  globalSetup:'./tests/browser-setup.mjs',
  use: { baseURL: 'http://127.0.0.1:4173/repository-name/', trace: 'retain-on-failure' },
  webServer: { command: 'node tests/serve.mjs', port: 4173, reuseExistingServer: true },
});
