import { test, expect } from '@playwright/test';
import { ai } from '@zerostep/playwright';
import { clearStorage, navigateToHome } from '../utils/test-helpers';
import { trackZerostepCall } from '../utils/zerostep-tracker';

const CATEGORY = 'Personas';

test.describe('Persona Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('citizen persona full workflow with simplified language', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    await navigateToHome(page);

    // Select citizen persona
    await aiHelper('Click on the persona selection button or modal', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Select the "Citoyen" (Citizen) persona option', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Search with citizen context
    await aiHelper('Search for "divorce" in the search bar', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Execute the search', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify simplified results
    await aiHelper('Verify that search results use simple, non-technical language suitable for citizens', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Open first result
    await aiHelper('Click on the first search result to view details', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify that the article is displayed with simplified explanations', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Ask chatbot question
    await aiHelper('Click the "Ask AI" or chatbot button', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Ask "Comment faire une demande de divorce?"', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Send the message', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify citizen-friendly response
    await aiHelper('Verify that the response uses simple language and includes practical steps', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify that sources are cited with explanations', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await page.screenshot({ path: 'screenshots/persona-citizen-workflow.png' });
  });

  test('lawyer persona technical workflow with legal terminology', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    await navigateToHome(page);

    // Select lawyer persona
    await aiHelper('Open persona selection', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Select "Avocat / Juriste" (Lawyer) persona', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Search with lawyer context
    await aiHelper('Search for "prescription acquisitive"', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Execute search', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify technical results
    await aiHelper('Verify that results include technical legal terminology and precise references', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Ask technical question
    await aiHelper('Open chatbot and ask a technical legal question about jurisprudence', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify that the response uses professional legal language and cites specific articles', page);
    trackZerostepCall(CATEGORY, testInfo.title);
  });

  test('entrepreneur persona practical workflow with actionable steps', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    await navigateToHome(page);

    // Select entrepreneur persona
    await aiHelper('Select persona', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Choose "Entrepreneur" persona', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Search business-related topic
    await aiHelper('Search for "créer une entreprise"', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Execute search', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify practical results
    await aiHelper('Verify that results focus on practical business applications and actionable steps', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Ask practical question
    await aiHelper('Ask chatbot "Quelles sont les étapes pour créer une SARL?"', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify response includes step-by-step practical guidance', page);
    trackZerostepCall(CATEGORY, testInfo.title);
  });

  test('student persona educational workflow with pedagogical content', async ({ page }, testInfo) => {
    const aiHelper = ai(testInfo);

    await navigateToHome(page);

    // Select student persona
    await aiHelper('Open persona selection', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Select "Étudiant" (Student) persona', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Search educational topic
    await aiHelper('Search for "droit des contrats"', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Execute search', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Verify educational content
    await aiHelper('Verify that results include educational explanations and context', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    // Ask learning question
    await aiHelper('Ask chatbot to explain a legal concept in detail', page);
    trackZerostepCall(CATEGORY, testInfo.title);

    await aiHelper('Verify response includes pedagogical explanations with examples', page);
    trackZerostepCall(CATEGORY, testInfo.title);
  });
});
