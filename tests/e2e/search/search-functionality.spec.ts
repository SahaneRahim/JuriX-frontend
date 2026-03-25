import { test, expect } from '@playwright/test';
import { ai } from '@zerostep/playwright';
import { clearStorage, navigateToHome } from '../utils/test-helpers';
import { trackZerostepCall } from '../utils/zerostep-tracker';

const CATEGORY = 'Search';

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await navigateToHome(page);
  });

  test('simple text search returns relevant results', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    // Perform search
    await aiHelper('Type "divorce" in the search bar', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Click the search button or press Enter', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify results
    await aiHelper('Verify that search results are displayed', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify that results contain laws related to divorce', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Check result count
    await expect(page.locator('.search-results, .law-card')).toHaveCount({ min: 1 });

    await page.screenshot({ path: 'screenshots/search-text-results.png' });
  });

  test('semantic search with filters', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    // Perform semantic search
    await aiHelper('Type "comment créer une entreprise" in the search bar', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Select semantic search mode if available', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Click search button', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Apply filters
    await aiHelper('Open the filters panel', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Select "Droit Commercial" category filter', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Apply the filters', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify filtered results
    await aiHelper('Verify that results are filtered to show only commercial law', page);
    trackZerostepCall(CATEGORY, testInfo.title);
  });

  test('hybrid search mode combines text and semantic', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    // Enable hybrid mode
    await aiHelper('Type "contrat de travail" in search', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Select hybrid search mode', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Execute the search', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify hybrid results
    await aiHelper('Verify that results include both exact matches and semantically similar laws', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify that relevance scores are displayed for results', page);
    trackZerostepCall(CATEGORY, testInfo.title);
  });

  test('search with language filter switches results', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    // Search in French
    await aiHelper('Type "divorce" in the search bar', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Execute search', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify French results
    await aiHelper('Verify that results are in French with French flag indicators', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    const frenchFlags = page.locator('.language-badge:has-text("🇫🇷")');
    await expect(frenchFlags.first()).toBeVisible();

    // Switch to English
    await aiHelper('Click the language switcher', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Select English language', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Wait for reload
    await page.waitForLoadState('networkidle');

    // Search again
    await aiHelper('Type "divorce" in the search bar', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Execute search', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify English results
    await aiHelper('Verify that results are now in English with English flag indicators', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    const englishFlags = page.locator('.language-badge:has-text("🇬🇧")');
    await expect(englishFlags.first()).toBeVisible();
  });
});
