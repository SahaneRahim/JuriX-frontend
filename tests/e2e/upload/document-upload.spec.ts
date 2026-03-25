import { test, expect } from '@playwright/test';
import { ai } from '@zerostep/playwright';
import { loginAsAdmin, waitForProcessing, TEST_DATA } from '../utils/test-helpers';
import { trackZerostepCall } from '../utils/zerostep-tracker';

const CATEGORY = 'Upload & Detection';

test.describe('Document Upload and Language Detection', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin before each test
    const aiHelper = ai({} as any);
    await loginAsAdmin(page, aiHelper);
  });

  test('upload french PDF and verify automatic language detection', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    // Navigate to upload page
    await aiHelper('Navigate to the document upload page', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Fill form
    await aiHelper('Fill the reference field with "LOI-2024-015"', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Fill the title field with "Loi sur le divorce"', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Upload file (simulated - would need actual file in real test)
    await aiHelper('Click the file upload button and select a French PDF document', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Wait for language detection
    await aiHelper('Wait for automatic language detection to complete', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify French detected
    await aiHelper('Verify that the detected language is French with a French flag indicator', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await expect(page.locator('.language-badge, .detected-language')).toContainText(/Français|French|🇫🇷/);

    // Verify category suggestion
    await aiHelper('Verify that a category suggestion is displayed based on the document content', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Submit form
    await aiHelper('Click the submit button to upload the document', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Wait for processing
    await aiHelper('Wait for the processing progress modal to appear', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify success
    await aiHelper('Verify that a success message is displayed when processing completes', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await page.screenshot({ path: 'screenshots/upload-french-success.png' });
  });

  test('upload english document and verify detection', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    await aiHelper('Navigate to the upload page', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Fill reference with "LAW-2024-016"', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Fill title with "Commercial Companies Act"', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Upload an English PDF document', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Wait for language detection', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify English detected
    await aiHelper('Verify that English is detected with an English flag', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await expect(page.locator('.language-badge, .detected-language')).toContainText(/English|Anglais|🇬🇧/);

    await aiHelper('Submit the upload form', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify successful upload', page);
    trackZerostepCall(CATEGORY, testInfo.title);
  });

  test('upload with OCR required for scanned document', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    await aiHelper('Navigate to upload page', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Fill document reference and title', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Upload scanned PDF
    await aiHelper('Upload a scanned PDF that requires OCR processing', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify OCR indicator
    await aiHelper('Verify that an OCR processing indicator is shown', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Submit the form', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Wait for OCR processing (longer timeout)
    await aiHelper('Wait for OCR processing to complete, which may take longer', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify completion
    await aiHelper('Verify that OCR processing completed successfully', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify that text was extracted and language was detected', page);
    trackZerostepCall(CATEGORY, testInfo.title);
  });
});
