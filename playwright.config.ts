import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4320', headless: true },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://127.0.0.1:4320',
    reuseExistingServer: false,
    env: { PORT: '4320', DATA_DIR: './data/e2e' },
    timeout: 60000,
  },
});
