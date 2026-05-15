import { test, expect } from '@playwright/test';

const OPERATOR_EMAIL = process.env.E2E_OPERATOR_EMAIL ?? 'operator@test.com';
const OPERATOR_PASSWORD = process.env.E2E_OPERATOR_PASSWORD ?? 'Test@123456';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('shows login form', async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible();
  });

  test('rejects invalid credentials', async ({ page }) => {
    await page.getByLabel(/email/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|login/i }).click();

    await expect(page.getByText(/invalid|incorrect|unauthorized/i)).toBeVisible({ timeout: 8_000 });
    // Must still be on login page
    await expect(page).toHaveURL(/login/);
  });

  test('logs in with valid credentials and redirects to dashboard', async ({ page }) => {
    await page.getByLabel(/email/i).fill(OPERATOR_EMAIL);
    await page.getByLabel(/password/i).fill(OPERATOR_PASSWORD);
    await page.getByRole('button', { name: /sign in|login/i }).click();

    await page.waitForURL(/dashboard/, { timeout: 15_000 });
    await expect(page).toHaveURL(/dashboard/);
  });

  test('redirects unauthenticated users to login', async ({ page }) => {
    // Clear cookies so no auth state
    await page.context().clearCookies();
    // Clear localStorage
    await page.evaluate(() => localStorage.clear());

    await page.goto('/dashboard');
    await page.waitForURL(/login/, { timeout: 10_000 });
    await expect(page).toHaveURL(/login/);
  });

  test('shows register link on login page', async ({ page }) => {
    await expect(page.getByRole('link', { name: /register|sign up|create account/i })).toBeVisible();
  });
});
