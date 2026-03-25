import { test, expect } from '@playwright/test';
import { ai } from '@zerostep/playwright';
import { clearStorage, navigateToHome } from '../utils/test-helpers';
import { trackZerostepCall } from '../utils/zerostep-tracker';

const CATEGORY = 'Chatbot';

test.describe('Chatbot Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('ask simple question and get response with sources', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    await navigateToHome(page);

    // Navigate to chatbot
    await aiHelper('Navigate to the chatbot page or open the chatbot interface', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Ask question
    await aiHelper('Type "Comment créer une SARL?" in the chat input field', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Send the message by clicking the send button', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Wait for response
    await aiHelper('Wait for the chatbot to respond with an answer', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify response has sources
    await aiHelper('Verify that the response includes source citations with law references', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await expect(page.locator('.source-card, .citation, .sources')).toHaveCount({ min: 1 });

    await page.screenshot({ path: 'screenshots/chatbot-simple-question.png' });
  });

  test('ask complex multi-document question', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    await navigateToHome(page);

    await aiHelper('Open the chatbot', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Complex question requiring multiple sources
    await aiHelper('Ask "Quelles sont les différences entre SARL et SA en termes de capital et de responsabilité?"', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Send the message', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Wait for the comprehensive response', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify multiple sources
    await aiHelper('Verify that the response cites multiple law articles from different documents', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await expect(page.locator('.source-card, .citation')).toHaveCount({ min: 2 });
  });

  test('streaming response displays progressively', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    await navigateToHome(page);

    await aiHelper('Open chatbot', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Ask a question about legal procedures', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Send the message', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify streaming indicator
    await aiHelper('Verify that a typing indicator or streaming animation is shown while the response is being generated', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify that the response text appears progressively as it streams', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Wait for the complete response to finish streaming', page);
    trackZerostepCall(CATEGORY, testInfo.title);
  });

  test('citation links navigate to correct article', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    await navigateToHome(page);

    await aiHelper('Open chatbot', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Ask "Comment créer une SARL?"', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Send message', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Wait for response with sources', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Click first source
    await aiHelper('Click on the first source citation link', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify navigation to article
    await expect(page).toHaveURL(/\/laws\/\d+|\/articles\/\d+/);

    await aiHelper('Verify that the full article content is displayed on the page', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await page.screenshot({ path: 'screenshots/chatbot-source-navigation.png' });
  });
});
