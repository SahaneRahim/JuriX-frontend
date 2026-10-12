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

/**
 * Le chat lit la réponse EN FLUX (`/rag/ask/stream`, événements SSE) : le
 * texte arrive en plusieurs morceaux, le dernier événement porte les sources.
 */
async function repondre(page: Page, corps: Record<string, unknown>) {
  const { answer, sources, intent } = corps as { answer: string; sources: unknown[]; intent: string };
  const moitie = Math.floor(answer.length / 2);
  const evenements = [
    { chunk: answer.slice(0, moitie), done: false },
    { chunk: answer.slice(moitie), done: false },
    { chunk: '', done: true, sources, intent, confidence: 1, session_id: 'sid-rendu' },
  ];
  await page.route('**/api/v1/rag/ask/stream', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: evenements.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
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

  test('les listes numérotées gardent leur numéro', async ({ page }) => {
    // Profils avocat et étudiant : l'ordre des étapes compte.
    await repondre(page, {
      answer: '1. premier point\n2. second point',
      sources: [],
      intent: 'juridique',
    });

    await poser(page, 'quelles sont les étapes ?');

    const journal = page.getByRole('log');
    await expect(journal.getByText('second point')).toBeVisible();
    await expect(journal).toContainText('2.');
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
    });

    await poser(page, 'quelle est la durée du permis de recherche ?');

    const journal = page.getByRole('log');
    await expect(journal.getByText('Sources', { exact: true })).toBeVisible();
    await expect(journal.locator('a[href*="/laws/42"]')).toBeVisible();
  });

  test('une source dit quel article de quel texte, et ouvre CET article', async ({ page }) => {
    // Le texte ouvert par le lien : l'article 33 n'est pas le premier.
    await page.route('**/api/v1/laws/42', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 42, reference: 'PRC-9001', type: 'loi', language: 'fr', category_id: null,
          status: 'published', publication_date: null, articles: [], article_count: 3,
          detected_language: null, language_confidence: null, suggested_categories: null,
          category_confidence: null, file_id: null, original_filename: null,
          title: 'Loi N°2023/014 du 19 décembre 2023 portant Code Minier',
          content: [
            'ARTICLE 1.- Objet', 'La présente loi régit les activités minières.',
            'ARTICLE 2.- Définitions', 'Au sens de la présente loi, on entend par mine…',
            'ARTICLE 33.- Durée du permis', 'Le permis de recherche est accordé pour trois ans.',
            'ARTICLE 34.- Renouvellement', 'Le permis est renouvelable deux fois.',
          ].join('\n\n'),
        }),
      }),
    );
    await repondre(page, {
      answer: 'Selon l’article 33 du Code Minier, le permis est accordé pour trois ans.',
      sources: [{
        law_id: 42, law_reference: 'PRC-9001',
        law_title: 'Loi N°2023/014 du 19 décembre 2023 portant Code Minier',
        article_number: '33', article_id: 900,
        excerpt: 'Le permis de recherche est accordé pour trois ans.', relevance_score: 0.91,
      }],
      intent: 'juridique',
    });

    await poser(page, 'quelle est la durée du permis de recherche ?');

    // Le nom du texte, jamais sa cote interne.
    const source = page.getByTestId('chat-source');
    await expect(source).toContainText('Article 33 — Code Minier');
    await expect(source).not.toContainText('PRC-9001');

    await source.click();

    await expect(page).toHaveURL(/\/laws\/42\?article=33$/);
    await expect(page.locator('article.article')).toContainText('trois ans');
    await expect(page.locator('article.article')).not.toContainText('activités minières');

    // « Suivant » avance : le lien ne ramène pas le lecteur à l'article 33.
    await page.locator('.article-navigation button').last().click();
    await expect(page.locator('article.article')).toContainText('renouvelable');
  });

  test('une panne en cours de flux s’affiche en erreur, sans fausse réponse', async ({ page }) => {
    await page.route('**/api/v1/rag/ask/stream', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `data: ${JSON.stringify({ chunk: '', done: true, error: 'quota', error_code: 'quota' })}\n\n`,
      }),
    );

    await poser(page, 'quelle est la durée du permis de recherche ?');

    await expect(page.getByTestId('chat-error')).toBeVisible();
    await expect(page.getByTestId('chat-error')).toContainText('quota');
  });
});
