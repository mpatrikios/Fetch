import { expect } from '@playwright/test';

export const EMAIL = process.env.E2E_EMAIL ?? '';
export const PASSWORD = process.env.E2E_PASSWORD ?? '';

export const SELECTORS = {
  emailInput: 'input[type="email"], input[name="email"]',
  passwordInput: 'input[type="password"]',
  submitButton: 'button[type="submit"]',
  errorAlert: '[role="alert"], .error, [data-testid="error"]',
  candidateCard: '[data-testid="candidate-card"], .candidate-card',
};

export async function loginUser(page, email, password) {
  await page.goto('/login');
  await page.locator(SELECTORS.emailInput).fill(email);
  await page.locator(SELECTORS.passwordInput).fill(password);
  await page.locator(SELECTORS.submitButton).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
}
