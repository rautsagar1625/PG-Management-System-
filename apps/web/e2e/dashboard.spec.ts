import { test, expect } from '@playwright/test';

test.describe('Operator Dashboard', () => {
  test('loads dashboard with summary stats', async ({ page }) => {
    await page.goto('/dashboard');

    // Key metric cards must be visible
    await expect(page.getByText(/total properties|properties/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('dashboard navigation links are visible', async ({ page }) => {
    await page.goto('/dashboard');

    // Sidebar navigation items
    const nav = page.locator('nav, [data-testid="sidebar"]');
    await expect(nav).toBeVisible({ timeout: 10_000 });
  });

  test('can navigate to properties list', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /properties/i }).first().click();
    await page.waitForURL(/properties/, { timeout: 10_000 });
    await expect(page).toHaveURL(/properties/);
  });

  test('can navigate to collections', async ({ page }) => {
    await page.goto('/dashboard');
    const collectionsLink = page.getByRole('link', { name: /collections|payments/i }).first();
    await expect(collectionsLink).toBeVisible({ timeout: 8_000 });
    await collectionsLink.click();
    await page.waitForURL(/collections|payments/, { timeout: 10_000 });
  });

  test('can navigate to complaints', async ({ page }) => {
    await page.goto('/dashboard');
    const complaintsLink = page.getByRole('link', { name: /complaints/i }).first();
    await expect(complaintsLink).toBeVisible({ timeout: 8_000 });
    await complaintsLink.click();
    await page.waitForURL(/complaints/, { timeout: 10_000 });
  });
});
