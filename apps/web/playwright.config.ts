import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Setup: create authenticated storage state
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/operator.json',
      },
      dependencies: ['setup'],
    },
    // Auth tests run without stored login state
    {
      name: 'auth-tests',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },

  // Expose to test files via process.env
  globalSetup: './e2e/global.setup.ts',
});

export { API_URL };
