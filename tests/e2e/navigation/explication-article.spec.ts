/**
 * Le bouton « Expliquer l'article » rend sa réponse SUR LA PAGE.
 *
 * POURQUOI CE FICHIER EXISTE. Le bouton menait auparavant vers `/chat` avec une
 * question pré-remplie : le lecteur changeait de page, perdait de vue l'article
 * expliqué, et devait encore envoyer la question lui-même. L'exigence tient en
 * une assertion — après le clic, l'adresse est toujours celle du document.
 *
 * L'appel Gemini est INTERCEPTÉ. Le POST part toujours du navigateur, donc
 * `page.route` l'atteint — contrairement au `load` de `GET /laws/{id}`, qui
 * s'exécute côté serveur de preview et resterait hors de portée. Aucun quota
 * n'est dépensé, et les chemins d'erreur deviennent testables : sur le palier
 * gratuit, provoquer un vrai 429 coûterait la journée de génération.
 *
 * Lancer : npx playwright test tests/e2e/navigation/explication-article.spec.ts
 */

import { expect, test, type Page } from '@playwright/test';
import { cliquerJusqualEffet } from '../hydratation';

const API = process.env.VITE_API_URL ?? 'http://localhost:8000';
const ROUTE_EXPLICATION = '**/api/v1/laws/*/explain-article';

const REPONSE = {
  law_id: 1,
  article_id: 42,
  number: '1',
  explanation: '**En clair**\n\nPremier paragraphe.\n\nSecond paragraphe.',
  language: 'fr',
  persona: 'citoyen',
  resolved_from: 'database',
  generation_time_ms: 1234,
};

/** Identifiant d'un document réel : un jeu figé pourrit à la réingestion. */
async function premiereLoi(page: Page): Promise<number | null> {
  const res = await page.request.get(`${API}/api/v1/laws/?limit=1`, { failOnStatusCode: false });
  if (!res.ok()) return null;
  const corps = await res.json();
  const lois = corps.items ?? corps.laws ?? corps;
  if (!Array.isArray(lois) || lois.length === 0) return null;
  return lois[0].id;
}

/** Répond à la place de Gemini, éventuellement après un délai. */
async function interceptes(
  page: Page,
  { statut = 200, corps = REPONSE, delaiMs = 0 } = {},
): Promise<void> {
  await page.route(ROUTE_EXPLICATION, async (route) => {
    if (delaiMs) await new Promise((r) => setTimeout(r, delaiMs));
    await route.fulfill({
      status: statut,
      contentType: 'application/json',
      body: JSON.stringify(statut === 200 ? corps : { detail: 'Simulé.' }),
    });
  });
}

test.describe('Explication d’un article', () => {
  let lawId: number;

  test.beforeEach(async ({ page, request }) => {
    const sante = await request.get(`${API}/health`, { failOnStatusCode: false });
    // Backend éteint : ce fichier n'a plus de document à ouvrir. Le sauter
    // plutôt que l'échouer, sans quoi il serait désactivé en CI sans base.
    test.skip(!sante.ok(), 'backend injoignable');

    const identifiant = await premiereLoi(page);
    test.skip(identifiant === null, 'corpus vide');
    lawId = identifiant as number;
  });

  /**
   * Regression : le corps de l'article doit etre la SANS aucun clic.
   *
   * Il ne l'etait pas. `$: currentArticle = flatArticles[index]` etait declaree
   * avant le bloc qui remplit `flatArticles` : Svelte 4 triait les blocs `$:`
   * par dependances, Svelte 5 en mode legacy les execute dans l'ordre du
   * source. La page rendait donc « Chargement... » a la place du texte, avec un
   * sommaire et un compteur « 1 / 199 » parfaitement corrects a cote. Le
   * premier clic sur « Suivant » reaffectait `currentArticleIndex` et tout
   * apparaissait — ce qui rendait le defaut invisible des qu'on paginait, et
   * l'a laisse passer.
   */
  test('le texte de l’article s’affiche des le premier chargement', async ({ page }) => {
    await page.goto(`/laws/${lawId}`);

    await expect(page.getByTestId('law-explain')).toBeVisible();
    await expect(page.getByText('Chargement...')).toHaveCount(0);
  });

  test('la réponse s’affiche sur la page, sans quitter le document', async ({ page }) => {
    await interceptes(page);
    await page.goto(`/laws/${lawId}`);

    await cliquerJusqualEffet(
      page.getByTestId('law-explain'),
      page.getByTestId('law-explain-answer'),
    );

    const reponse = page.getByTestId('law-explain-answer');
    await expect(reponse).toContainText('Premier paragraphe.');
    await expect(reponse).toContainText('Second paragraphe.');
    // L'exigence : on est toujours sur la fiche, pas dans le chat.
    expect(new URL(page.url()).pathname).toBe(`/laws/${lawId}`);
    await expect(page.getByTestId('law-explain-disclaimer')).toBeVisible();
  });

  test('le markdown du modèle est rendu, pas affiché tel quel', async ({ page }) => {
    // Le prompt système « citoyen » du backend DEMANDE des titres en gras.
    // Les voir en clair serait du bruit ; les interpréter par `{@html}` serait
    // une faille. Ils deviennent des nœuds de texte dans un titre.
    await interceptes(page);
    await page.goto(`/laws/${lawId}`);

    await cliquerJusqualEffet(
      page.getByTestId('law-explain'),
      page.getByTestId('law-explain-answer'),
    );

    const reponse = page.getByTestId('law-explain-answer');
    await expect(reponse).toContainText('En clair');
    await expect(reponse).not.toContainText('**');
  });

  test('l’attente est annoncée avant l’arrivée de la réponse', async ({ page }) => {
    await interceptes(page, { delaiMs: 3_000 });
    await page.goto(`/laws/${lawId}`);

    await cliquerJusqualEffet(
      page.getByTestId('law-explain'),
      page.getByTestId('law-explain-loading'),
    );

    await expect(page.getByTestId('law-explain-loading')).toHaveAttribute('role', 'status');
    await expect(page.getByTestId('law-explain-answer')).toBeVisible({ timeout: 10_000 });
  });

  test('un quota épuisé est annoncé, pas avalé', async ({ page }) => {
    await interceptes(page, { statut: 429 });
    await page.goto(`/laws/${lawId}`);

    await cliquerJusqualEffet(
      page.getByTestId('law-explain'),
      page.getByTestId('law-explain-error'),
    );

    await expect(page.getByTestId('law-explain-error')).toHaveAttribute('role', 'alert');
    await expect(page.getByTestId('law-explain-answer')).toHaveCount(0);
    await expect(page.getByTestId('law-explain-retry')).toBeVisible();
  });

  test('un article introuvable a son propre message', async ({ page }) => {
    await interceptes(page, { statut: 404 });
    await page.goto(`/laws/${lawId}`);

    await cliquerJusqualEffet(
      page.getByTestId('law-explain'),
      page.getByTestId('law-explain-error'),
    );

    // Distinct du message de quota : le lecteur doit savoir que réessayer ne
    // servira à rien.
    await expect(page.getByTestId('law-explain-error')).toContainText('retrouvé');
  });

  test('changer d’article efface l’explication précédente', async ({ page }) => {
    // Le bloc ne se démonte pas d'un article à l'autre : sans remise à zéro,
    // l'explication de l'article 1 resterait affichée sous le texte du 2.
    await interceptes(page);
    await page.goto(`/laws/${lawId}`);

    await cliquerJusqualEffet(
      page.getByTestId('law-explain'),
      page.getByTestId('law-explain-answer'),
    );

    const suivant = page.getByRole('button', { name: /suivant|next/i }).first();
    test.skip(!(await suivant.isEnabled()), 'document à un seul article');
    await cliquerJusqualEffet(suivant, page.getByTestId('law-explain'));

    await expect(page.getByTestId('law-explain-answer')).toHaveCount(0);
  });

  test('une réponse périmée n’atterrit pas sur le nouvel article', async ({ page }) => {
    // Le cas invisible au test manuel : cliquer, puis paginer pendant la
    // génération. La réponse concerne l'article précédent et doit être jetée.
    await interceptes(page, { delaiMs: 3_000 });
    await page.goto(`/laws/${lawId}`);

    await cliquerJusqualEffet(
      page.getByTestId('law-explain'),
      page.getByTestId('law-explain-loading'),
    );

    const suivant = page.getByRole('button', { name: /suivant|next/i }).first();
    test.skip(!(await suivant.isEnabled()), 'document à un seul article');
    await suivant.click();

    // Bien au-delà des 3 s de la réponse retardée.
    await page.waitForTimeout(5_000);
    await expect(page.getByTestId('law-explain-answer')).toHaveCount(0);
    await expect(page.getByTestId('law-explain-loading')).toHaveCount(0);
  });
});
