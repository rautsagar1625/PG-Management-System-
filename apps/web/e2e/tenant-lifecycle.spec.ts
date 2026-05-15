import { test, expect } from '@playwright/test';

/**
 * Tenant lifecycle E2E tests.
 * These tests require seed data: at least one property with available beds.
 * Run after seeding: pnpm db:seed
 */
test.describe('Tenant Lifecycle', () => {
  test('tenants list page loads', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to tenants
    const tenantsLink = page.getByRole('link', { name: /tenants/i }).first();
    await expect(tenantsLink).toBeVisible({ timeout: 8_000 });
    await tenantsLink.click();
    await page.waitForURL(/tenants/, { timeout: 10_000 });

    // Page content loads
    await expect(page.getByRole('heading', { name: /tenants/i })).toBeVisible({ timeout: 8_000 });
  });

  test('can search tenants', async ({ page }) => {
    await page.goto('/dashboard/tenants');

    const searchInput = page.getByPlaceholder(/search|name|phone/i);
    await expect(searchInput).toBeVisible({ timeout: 8_000 });

    await searchInput.fill('test');
    // Results update or "no results" shown
    await page.waitForTimeout(500); // debounce
    // Page should not error
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i);
  });

  test('properties list shows available properties', async ({ page }) => {
    await page.goto('/dashboard/properties');

    await expect(page.getByRole('heading', { name: /properties/i })).toBeVisible({ timeout: 8_000 });
    // Property cards or table visible
    await expect(page.locator('body')).not.toContainText(/error|failed to load/i);
  });
});

test.describe('Complaints', () => {
  test('complaints page loads', async ({ page }) => {
    await page.goto('/dashboard/complaints');

    await expect(page.getByRole('heading', { name: /complaints/i })).toBeVisible({ timeout: 10_000 });
  });

  test('complaints list renders without errors', async ({ page }) => {
    await page.goto('/dashboard/complaints');

    await expect(page.locator('body')).not.toContainText(/500|internal server error/i);
  });
});
