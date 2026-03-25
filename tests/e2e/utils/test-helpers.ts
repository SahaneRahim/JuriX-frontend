import { Page } from '@playwright/test';

/**
 * Test data constants
 */
export const TEST_DATA = {
  admin: {
    email: 'admin@jurix.cm',
    password: 'SecurePassword123'
  },
  samplePDF: {
    french: './tests/fixtures/sample-law-fr.pdf',
    english: './tests/fixtures/sample-law-en.pdf'
  },
  laws: {
    french: {
      reference: 'LOI-2024-001',
      title: 'Loi sur les sociétés commerciales'
    },
    english: {
      reference: 'LAW-2024-001',
      title: 'Commercial Companies Act'
    }
  }
};

/**
 * Login as admin user
 */
export async function loginAsAdmin(page: Page, aiHelper: any) {
  await aiHelper('Navigate to admin login page at /admin/login', page);
  await aiHelper(`Fill email field with "${TEST_DATA.admin.email}"`, page);
  await aiHelper(`Fill password field with "${TEST_DATA.admin.password}"`, page);
  await aiHelper('Click the login button', page);
  await page.waitForURL('**/admin/**', { timeout: 10000 });
}

/**
 * Wait for processing to complete
 */
export async function waitForProcessing(page: Page, timeout: number = 30000) {
  await page.waitForSelector('.processing-complete, .success-message', { timeout });
}

/**
 * Navigate to home page
 */
export async function navigateToHome(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

/**
 * Clear all storage
 */
export async function clearStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Take screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `screenshots/${name}-${timestamp}.png`,
    fullPage: true
  });
}

/**
 * Wait for network idle
 */
export async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState('networkidle');
}
