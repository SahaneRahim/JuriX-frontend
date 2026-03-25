import { test, expect } from '@playwright/test';
import { ai } from '@zerostep/playwright';
import { clearStorage, navigateToHome, loginAsAdmin } from '../utils/test-helpers';
import { trackZerostepCall } from '../utils/zerostep-tracker';

const CATEGORY = 'Critical Workflows';

test.describe('Critical User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('complete user journey: search → read → chat → source', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    // Step 1: Search
    await navigateToHome(page);

    await aiHelper('Search for "divorce" in the search bar', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Execute the search', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Step 2: Read
    await aiHelper('Click on the first search result to read the law', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify that the full law content is displayed', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Step 3: Chat
    await aiHelper('Click the "Ask AI" button to open chatbot', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Ask "Quelles sont les conditions pour divorcer?"', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Send the message', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Wait for chatbot response with sources', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Step 4: Source navigation
    await aiHelper('Click on a source citation in the chatbot response', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify navigation to the cited article', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await expect(page).toHaveURL(/\/laws\/\d+|\/articles\/\d+/);

    await page.screenshot({ path: 'screenshots/complete-user-journey.png' });
  });

  test('admin workflow: upload → process → verify → publish', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    // Step 1: Login
    await loginAsAdmin(page, aiHelper);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Step 2: Upload
    await aiHelper('Navigate to document upload page', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Fill document reference and title', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Upload a PDF document', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Wait for language detection', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Submit the upload form', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Step 3: Process
    await aiHelper('Wait for processing to complete', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify processing success message', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Step 4: Verify
    await aiHelper('Navigate to the laws list to verify the uploaded document', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Find and click on the newly uploaded law', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify that all articles are correctly extracted and displayed', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Step 5: Publish
    await aiHelper('Click the publish button to make the law public', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Confirm publication', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify that the law status changed to "Active"', page);
    trackZerostepCall(CATEGORY, testInfo.title);
  });

  test('multilingual workflow: FR → EN → toggle → back', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    // Step 1: Start in French
    await navigateToHome(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    await aiHelper('Verify that the interface is in French', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Step 2: Search in French
    await aiHelper('Search for "impôt" in French', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Execute search', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify that results are in French with French flags', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Step 3: Switch to English
    await aiHelper('Click language switcher', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Select English language', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await aiHelper('Verify interface is now in English', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Step 4: Search in English
    await aiHelper('Search for "tax" in English', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Execute search', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify results are in English with English flags', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Step 5: Toggle show all languages
    await aiHelper('Click the "Show all languages" toggle', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify that both French and English results are now displayed', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Step 6: Toggle off
    await aiHelper('Click toggle again to turn off show all', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify only English results are shown', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Step 7: Back to French
    await aiHelper('Switch language back to French', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    await aiHelper('Verify interface is French again', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify only French results are displayed', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await page.screenshot({ path: 'screenshots/multilingual-workflow.png' });
  });
});
