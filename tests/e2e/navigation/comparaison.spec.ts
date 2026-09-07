/**
 * Le mode comparaison rend une grille dont chaque cellule est vérifiable.
 *
 * CE QUE CE FICHIER PROTÈGE, dans l'ordre :
 *
 *   1. Le texte intégral de l'article cité se déplie sous la cellule. C'est le
 *      seul mécanisme qui attrape une citation SURNUMÉRAIRE — un article réel,
 *      correctement cité ailleurs, mais qui ne dit pas ce que la cellule
 *      affirme. Mesuré une fois sur treize lors du premier essai réel.
 *   2. Une citation sans article correspondant est affichée en avertissement,
 *      pas avalée en silence.
 *   3. Une cellule sans source montre l'absence au lieu de la combler.
 *
 * L'appel Gemini est INTERCEPTÉ : le POST part du navigateur, donc `page.route`
 * l'atteint. Aucun quota dépensé, et les chemins d'erreur deviennent testables.
 */

import { expect, test, type Page } from '@playwright/test';
import type { ComparisonResponse } from '../../../src/lib/types';
import { cliquerJusqualEffet } from '../hydratation';

const ROUTE = '**/api/v1/compare';

const ART_33 = {
  article_id: 7,
  law_id: 16,
  law_title: 'Loi portant Code Minier',
  reference: 'LOI-2016-017',
  number: '33',
  article_title: null,
  page_number: 9,
  content: "Le permis de recherche est délivré pour une durée initiale maximale de trois ans.",
};

// Typee : `unmatched_citations: []` etait infere `never[]`, ce qui faisait
// echouer `npm run check` sur la surcharge `['9999']`. Le type verifie en
// prime que la doublure respecte le contrat du backend.
const REPONSE: ComparisonResponse = {
  subject_a: 'permis de recherche',
  subject_b: "permis d'exploitation",
  language: 'fr',
  rows: [
    {
      criterion: 'Durée et renouvellement',
      a: { value: 'Trois ans, renouvelable.', sources: [ART_33] },
      b: { value: 'Non trouvé dans les textes consultés', sources: [] },
    },
  ],
  key_differences: ['La durée diffère du simple au sextuple.'],
  blind_spots: ["Les motifs de retrait ne figurent pas dans les textes consultés."],
  articles_a: [ART_33],
  articles_b: [],
  unmatched_citations: [],
  retrieval_time_ms: 120,
  generation_time_ms: 4300,
};

async function intercepte(page: Page, { statut = 200, corps = REPONSE, delaiMs = 0 } = {}) {
  await page.route(ROUTE, async (route) => {
    if (delaiMs) await new Promise((r) => setTimeout(r, delaiMs));
    await route.fulfill({
      status: statut,
      contentType: 'application/json',
      body: JSON.stringify(statut === 200 ? corps : { detail: 'Simulé.' }),
    });
  });
}

async function lancer(page: Page) {
  await page.getByTestId('compare-a').fill('permis de recherche');
  await page.getByTestId('compare-b').fill("permis d'exploitation");
}

test.describe('Mode comparaison', () => {
  test('la grille affiche les cellules et leurs sources', async ({ page }) => {
    await intercepte(page);
    await page.goto('/compare');
    await lancer(page);

    await cliquerJusqualEffet(
      page.getByTestId('compare-submit'),
      page.getByTestId('compare-result'),
    );

    await expect(page.getByRole('cell', { name: /Trois ans/ })).toBeVisible();
    // La puce porte la RÉFÉRENCE de la loi, pas seulement le numéro : quand
    // trois lois différentes ont un « article 1 », trois puces « Art. 1 »
    // identiques pointeraient vers trois documents sans que rien ne les
    // distingue.
    await expect(
      page.getByRole('link', { name: 'LOI-2016-017 · art. 33' }),
    ).toHaveAttribute('href', '/laws/16?article=33');
  });

  test('le texte de l’article se déplie sous la cellule', async ({ page }) => {
    // L'exigence centrale : sans ce texte à l'écran, une citation
    // surnuméraire reste invisible.
    await intercepte(page);
    await page.goto('/compare');
    await lancer(page);

    await cliquerJusqualEffet(
      page.getByTestId('compare-submit'),
      page.getByTestId('compare-result'),
    );

    await expect(page.getByTestId('compare-source-0-a')).toHaveCount(0);
    await cliquerJusqualEffet(
      page.getByTestId('compare-toggle-0-a'),
      page.getByTestId('compare-source-0-a'),
    );
    await expect(page.getByTestId('compare-source-0-a')).toContainText(
      'durée initiale maximale de trois ans',
    );
    // Disclosure correctement annoncé aux lecteurs d'écran.
    await expect(page.getByTestId('compare-toggle-0-a')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  test('une cellule sans source montre l’absence', async ({ page }) => {
    await intercepte(page);
    await page.goto('/compare');
    await lancer(page);

    await cliquerJusqualEffet(
      page.getByTestId('compare-submit'),
      page.getByTestId('compare-result'),
    );

    await expect(page.getByRole('cell', { name: /Non trouvé/ })).toBeVisible();
    // Pas de bouton « voir le texte » là où il n'y a rien à voir.
    await expect(page.getByTestId('compare-toggle-0-b')).toHaveCount(0);
  });

  test('une citation orpheline est signalée avant la grille', async ({ page }) => {
    await intercepte(page, {
      corps: { ...REPONSE, unmatched_citations: ['9999'] },
    });
    await page.goto('/compare');
    await lancer(page);

    await cliquerJusqualEffet(
      page.getByTestId('compare-submit'),
      page.getByTestId('compare-unmatched'),
    );

    const alerte = page.getByTestId('compare-unmatched');
    await expect(alerte).toHaveAttribute('role', 'alert');
    await expect(alerte).toContainText('9999');
  });

  test('les angles morts sont affichés', async ({ page }) => {
    await intercepte(page);
    await page.goto('/compare');
    await lancer(page);

    await cliquerJusqualEffet(
      page.getByTestId('compare-submit'),
      page.getByTestId('compare-result'),
    );

    await expect(page.getByTestId('compare-blindspots')).toContainText('retrait');
  });

  test('l’attente est annoncée', async ({ page }) => {
    await intercepte(page, { delaiMs: 3_000 });
    await page.goto('/compare');
    await lancer(page);

    await cliquerJusqualEffet(
      page.getByTestId('compare-submit'),
      page.getByTestId('compare-loading'),
    );

    await expect(page.getByTestId('compare-loading')).toHaveAttribute('role', 'status');
    await expect(page.getByTestId('compare-result')).toBeVisible({ timeout: 10_000 });
  });

  test('un quota épuisé est annoncé, pas avalé', async ({ page }) => {
    await intercepte(page, { statut: 429 });
    await page.goto('/compare');
    await lancer(page);

    await cliquerJusqualEffet(
      page.getByTestId('compare-submit'),
      page.getByTestId('compare-error'),
    );

    await expect(page.getByTestId('compare-error')).toHaveAttribute('role', 'alert');
    await expect(page.getByTestId('compare-result')).toHaveCount(0);
    await expect(page.getByTestId('compare-retry')).toBeVisible();
  });

  test('un sujet absent du corpus a son propre message', async ({ page }) => {
    await intercepte(page, { statut: 404 });
    await page.goto('/compare');
    await lancer(page);

    await cliquerJusqualEffet(
      page.getByTestId('compare-submit'),
      page.getByTestId('compare-error'),
    );

    await expect(page.getByTestId('compare-error')).toContainText('Aucun texte');
  });

  test('les deux sujets sont exigés, sans appel réseau', async ({ page }) => {
    let appels = 0;
    await page.route(ROUTE, async (route) => {
      appels += 1;
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(REPONSE) });
    });
    await page.goto('/compare');
    await page.getByTestId('compare-a').fill('permis de recherche');

    await cliquerJusqualEffet(
      page.getByTestId('compare-submit'),
      page.getByTestId('compare-error'),
    );

    expect(appels).toBe(0);
  });
});
