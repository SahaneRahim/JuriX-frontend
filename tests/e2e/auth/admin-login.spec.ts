import { test, expect } from '@playwright/test';
import { ai } from '@zerostep/playwright';
import { loginAsAdmin, clearStorage, TEST_DATA } from '../utils/test-helpers';
import { trackZerostepCall } from '../utils/zerostep-tracker';

const CATEGORY = 'Auth & Admin';

test.describe('Admin Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('admin can login successfully', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    // Navigate to login
    await aiHelper('Navigate to the admin login page', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Fill credentials
    await aiHelper(`Fill the email field with "${TEST_DATA.admin.email}"`, page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper(`Fill the password field with "${TEST_DATA.admin.password}"`, page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Submit
    await aiHelper('Click the login button to submit the form', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify redirect to dashboard
    await expect(page).toHaveURL(/\/admin/);
    await aiHelper('Verify that the dashboard is displayed with admin navigation', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/admin-login-success.png' });
  });

  test('admin login fails with invalid credentials', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    await aiHelper('Navigate to the admin login page', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Fill email with "wrong@email.com"', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Fill password with "wrongpassword"', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Click the login button', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify error message
    await aiHelper('Verify that an error message is displayed indicating invalid credentials', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Should still be on login page
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('admin can logout', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    // Login first
    await loginAsAdmin(page, aiHelper);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Logout
    await aiHelper('Click the logout button in the admin navigation', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify redirect to login
    await expect(page).toHaveURL(/\/admin\/login/);

    await aiHelper('Verify that the login form is displayed', page);
    trackZerostepCall(CATEGORY, testInfo.title);
  });

  test('admin dashboard is accessible after login', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    // Login
    await loginAsAdmin(page, aiHelper);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Navigate to dashboard
    await aiHelper('Navigate to the admin dashboard', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify dashboard elements
    await aiHelper('Verify that dashboard statistics and navigation menu are visible', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await expect(page.locator('h1, h2')).toContainText(/Dashboard|Tableau de bord/i);
  });

  test('unauthorized access redirects to login', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    // Try to access admin page without login
    await page.goto('/admin/dashboard');

    // Should redirect to login
    await page.waitForURL(/\/admin\/login/, { timeout: 5000 });

    await aiHelper('Verify that the login form is displayed', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
