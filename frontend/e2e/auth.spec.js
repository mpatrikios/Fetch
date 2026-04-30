import { test, expect } from '@playwright/test';
import { loginUser, SELECTORS, EMAIL, PASSWORD } from './helpers/auth.js';

test.describe('Login flow', () => {
  test('login page renders email and password inputs', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator(SELECTORS.emailInput)).toBeVisible();
    await expect(page.locator(SELECTORS.passwordInput)).toBeVisible();
  });

  test('valid credentials redirect to dashboard', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'E2E_EMAIL / E2E_PASSWORD not set');

    await loginUser(page, EMAIL, PASSWORD);
  });

  test('wrong credentials show an error message', async ({ page }) => {
    await page.goto('/login');
    await page.locator(SELECTORS.emailInput).fill('wrong@example.com');
    await page.locator(SELECTORS.passwordInput).fill('wrongpassword');
    await page.locator(SELECTORS.submitButton).click();

    // An error/alert element should become visible
    const error = page.locator(SELECTORS.errorAlert);
    await expect(error.first()).toBeVisible({ timeout: 5000 });
  });
});
