import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/public-e2e',
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4321', headless: true, reducedMotion: 'reduce' },
  webServer: process.env.PUBLIC_PREVIEW_RUNNING
    ? undefined
    : {
        command: 'npm run build:public && npm run preview:public',
        // Use PUBLIC_PREVIEW_RUNNING=1 to test an already running production preview.
        url: 'http://127.0.0.1:4321',
        reuseExistingServer: false,
        timeout: 60000,
      },
});
