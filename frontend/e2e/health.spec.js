import { test, expect } from '@playwright/test';

test('app loads at root route', async ({ page }) => {
  await page.goto('/');
  // The page should not be a blank error — some visible content should exist
  await expect(page.locator('body')).not.toBeEmpty();
  // Title should be present
  await expect(page).toHaveTitle(/.+/);
});
