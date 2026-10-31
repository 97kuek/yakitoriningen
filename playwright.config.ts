import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4273',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: process.env.CI
      ? 'npm run preview -- --port 4273'
      : 'npm run build && npm run preview -- --port 4273',
    url: 'http://127.0.0.1:4273',
    reuseExistingServer: false,
  },
});
