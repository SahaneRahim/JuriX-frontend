import { test, expect } from '@playwright/test';
import { ai } from '@zerostep/playwright';
import { clearStorage, navigateToHome } from '../utils/test-helpers';
import { trackZerostepCall } from '../utils/zerostep-tracker';

const CATEGORY = 'Language Filtering';

test.describe('Language Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('switch french to english reloads and filters content', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    // Navigate to homepage
    await navigateToHome(page);

    // Verify French is default
    await aiHelper('Verify that the page is displayed in French', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    // Check stats show French count
    await aiHelper('Verify that law statistics show French content count', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Switch to English
    await aiHelper('Click the language switcher button', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Select English from the language options', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Wait for page reload
    await page.waitForLoadState('networkidle');

    // Verify English now
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await aiHelper('Verify that the page is now displayed in English', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify that law cards show English flag indicators', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Take screenshot
    await page.screenshot({ path: 'screenshots/language-switch-en.png' });
  });

  test('toggle show all languages displays both FR and EN', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    await navigateToHome(page);

    // Verify only French content initially
    await aiHelper('Verify that only French content is displayed', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Toggle show all languages
    await aiHelper('Click the "Show all languages" toggle switch', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify both languages now visible
    await aiHelper('Verify that both French and English content are now displayed together', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify that law cards show both French and English flags', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Toggle off
    await aiHelper('Click the toggle switch again to turn off show all languages', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify back to French only
    await aiHelper('Verify that only French content is displayed again', page);
    trackZerostepCall(CATEGORY, testInfo.title);
  });

  test('language preference persists after page reload', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    await navigateToHome(page);

    // Switch to English
    await aiHelper('Click the language switcher and select English', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await page.waitForLoadState('networkidle');

    // Verify English
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify still English
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await aiHelper('Verify that the page is still in English after reload', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Navigate to different page
    await aiHelper('Navigate to the search page', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify still English
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await aiHelper('Verify that the search page is also in English', page);
    trackZerostepCall(CATEGORY, testInfo.title);
  });
});
