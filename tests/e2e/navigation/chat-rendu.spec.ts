/**
 * Rendu d'une réponse du chat.
 *
 * CE QUE CE FICHIER PROTÈGE. La réponse arrive balisée en markdown — le prompt
 * système du backend le demande — et la page l'interpolait telle quelle. Le
 * lecteur voyait donc `**Réponse directe**`, astérisques comprises. Le rendu
 * passe désormais par `blocsDeReponse` ($lib/texte), en nœuds Svelte, donc
 * échappés : le dépôt s'interdit `{@html}`.
 *
 * Le second invariant est celui du routage d'intention : une réponse
 * conversationnelle arrive avec `sources: []`, et le bloc « Sources » ne doit
 * alors pas s'afficher du tout — c'est ce qui fait disparaître l'article du
 * Code Minier affiché sous « comment vas-tu ? ».
 *
 * Les appels sont interceptés : aucun backend requis, aucun quota dépensé.
 */

import { expect, test, type Page } from '@playwright/test';

const REPONSE_DE_BASE = {
  session_id: 'sid-rendu',
  confidence: 1,
  retrieval_time_ms: 0,
  generation_time_ms: 10,
  total_time_ms: 10,
  persona: 'citoyen',
};

async function repondre(page: Page, corps: Record<string, unknown>) {
  await page.route('**/api/v1/rag/ask', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...REPONSE_DE_BASE, ...corps }),
    }),
  );
}

async function poser(page: Page, question: string) {
  await page.goto('/chat');
  const champ = page.getByRole('textbox').first();
  await champ.fill(question);
  await champ.press('Enter');
}

test.describe('Rendu des réponses du chat', () => {
  test('le markdown est rendu, pas affiché', async ({ page }) => {
    await repondre(page, {
      answer:
        '**Ce qui change**\n\nLa réponse suit la question.\n\n- premier point\n- second point',
      sources: [],
      intent: 'juridique',
    });

    await poser(page, 'quelles sont les conditions du permis ?');

    const journal = page.getByRole('log');
    await expect(journal.getByText('Ce qui change')).toBeVisible();
    // L'invariant qui compte : plus une seule astérisque à l'écran.
    await expect(journal).not.toContainText('**');
    await expect(journal.getByText('premier point')).toBeVisible();
  });

  test('une réponse conversationnelle n’affiche aucune source', async ({ page }) => {
    await repondre(page, {
      answer:
        'Je vais bien, merci — je suis un programme. Je suis là pour vos questions sur le droit camerounais.',
      sources: [],
      intent: 'smalltalk',
    });

    await poser(page, 'comment vas-tu ?');

    await expect(page.getByRole('log')).toContainText('Je vais bien');
    // `sources: []` masque le bloc entier : ni titre, ni liste vide.
    await expect(page.getByRole('log').getByText('Sources', { exact: true })).toHaveCount(0);
  });

  test('une réponse juridique affiche ses sources', async ({ page }) => {
    await repondre(page, {
      answer: 'Selon l’article 33 du Code Minier, le permis est accordé pour trois ans.',
      sources: [
        {
          law_id: 42,
          law_reference: 'LOI-2023-014',
          law_title: 'Code Minier',
          article_number: '33',
          article_id: 900,
          excerpt: 'Le permis de recherche est accordé pour trois ans.',
          relevance_score: 0.91,
        },
      ],
      intent: 'juridique',
      retrieval_time_ms: 180,
    });

    await poser(page, 'quelle est la durée du permis de recherche ?');

    const journal = page.getByRole('log');
    await expect(journal.getByText('Sources', { exact: true })).toBeVisible();
    await expect(journal.locator('a[href*="/laws/42"]')).toBeVisible();
  });
});
