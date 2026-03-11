import { test, expect } from '@playwright/test';
import { loginUser, SELECTORS, EMAIL, PASSWORD } from './helpers/auth.js';

test.describe('Matching feature', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_EMAIL / E2E_PASSWORD not set');

  test.beforeEach(async ({ page }) => {
    await loginUser(page, EMAIL, PASSWORD);
  });

  test('match results show at least one candidate card', async ({ page }) => {
    // Navigate to the matches / jobs page (adjust path if needed)
    await page.goto('/matches');

    // Wait for at least one candidate card to appear
    const candidateCard = page.locator(SELECTORS.candidateCard).first();
    await expect(candidateCard).toBeVisible({ timeout: 15000 });
  });
});
