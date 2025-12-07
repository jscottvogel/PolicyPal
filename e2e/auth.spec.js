import { test, expect } from '@playwright/test';

test('shows login screen by default', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PolicyPal/);
    // Authenticator should be visible
    // The specific selector depends on Amplify UI structure, but "Sign In" text usually appears
    await expect(page.getByText('Sign In').first()).toBeVisible();
});
