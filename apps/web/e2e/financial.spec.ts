import { test, expect } from '@playwright/test';

test.describe('Financial — Collections', () => {
  test('payments / collections page loads', async ({ page }) => {
    await page.goto('/dashboard/payments');

    await expect(page.locator('body')).not.toContainText(/500|internal server error/i);
  });

  test('overdue list page loads if it exists', async ({ page }) => {
    const res = await page.goto('/dashboard/overdue');
    // Accept 200 or redirect — just must not 500
    if (res) {
      expect(res.status()).not.toBe(500);
    }
  });

  test('settlements page loads', async ({ page }) => {
    const res = await page.goto('/dashboard/settlements');
    if (res) {
      expect(res.status()).not.toBe(500);
    }
    await expect(page.locator('body')).not.toContainText(/internal server error/i);
  });

  test('receipts page loads', async ({ page }) => {
    const res = await page.goto('/dashboard/receipts');
    if (res) {
      expect(res.status()).not.toBe(500);
    }
  });
});

test.describe('Financial — Audit Logs', () => {
  test('audit logs page loads', async ({ page }) => {
    const res = await page.goto('/dashboard/audit-logs');
    if (res) {
      expect(res.status()).not.toBe(500);
    }
    await expect(page.locator('body')).not.toContainText(/internal server error/i);
  });
});
