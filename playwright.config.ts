import { defineConfig, devices } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:1420/economy/',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/mobile-critical-smoke.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
    {
      name: 'mobile-chromium',
      testMatch: '**/mobile-critical-smoke.spec.ts',
      use: {
        ...devices['Pixel 7'],
        launchOptions: executablePath ? { executablePath } : undefined,
      },
    },
    {
      name: 'mobile-webkit',
      testMatch: '**/mobile-critical-smoke.spec.ts',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:1420/economy/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
