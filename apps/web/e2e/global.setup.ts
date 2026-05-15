import { chromium, FullConfig } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const OPERATOR_EMAIL = process.env.E2E_OPERATOR_EMAIL ?? 'operator@test.com';
const OPERATOR_PASSWORD = process.env.E2E_OPERATOR_PASSWORD ?? 'Test@123456';

async function globalSetup(_config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE_URL}/login`);

  await page.getByLabel(/email/i).fill(OPERATOR_EMAIL);
  await page.getByLabel(/password/i).fill(OPERATOR_PASSWORD);
  await page.getByRole('button', { name: /sign in|login/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL(/dashboard/, { timeout: 15_000 });

  // Save auth state for reuse across tests
  await page.context().storageState({ path: 'e2e/.auth/operator.json' });

  await browser.close();
}

export default globalSetup;
