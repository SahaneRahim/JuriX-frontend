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
 *
 * LE MOUVEMENT (refonte A, niveau A : docs/refonte/PASSATION.md, E7), à la
 * fin du fichier : la balance pèse pendant l'attente, la grille arrive ligne
 * après ligne (en tableau, A depuis la gauche et B depuis la droite), « Voir
 * le texte » se déroule et son chevron tourne ; en mouvement réduit, rien ne
 * bouge et tout reste là.
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

/** Une grille de huit critères : assez pour voir l'échelonnement cesser de croître. */
const HUIT_LIGNES: ComparisonResponse = {
  ...REPONSE,
  rows: Array.from({ length: 8 }, (_, i) => ({
    criterion: `Critère ${i + 1}`,
    a: { value: `Réponse du premier sujet, ${i + 1}.`, sources: [ART_33] },
    b: { value: `Réponse du second sujet, ${i + 1}.`, sources: [ART_33] },
  })),
};

/** Ce que le style calculé dit de l'arrivée d'une cellule (`mv-comparer`, src/lib/mouvement.css). */
interface Arrivee {
  animation: string;
  delai: string;
  x: string;
  y: string;
}

/** L'arrivée des cellules de chaque ligne de la grille, ligne par ligne. */
async function arriveesDesLignes(page: Page): Promise<Arrivee[][]> {
  return page
    .getByTestId('compare-result')
    .locator('tbody > tr')
    .evaluateAll((lignes) =>
      lignes.map((ligne) =>
        [...ligne.children].map((cellule) => {
          const style = getComputedStyle(cellule);
          return {
            animation: style.animationName,
            delai: style.animationDelay,
            x: style.getPropertyValue('--mv-comparer-x').trim(),
            y: style.getPropertyValue('--mv-comparer-y').trim(),
          };
        }),
      ),
    );
}

/**
 * Note les animations Web que lance la page (`element.animate`) sur un
 * élément muni d'un `data-testid`, avec leur durée. Les transitions de Svelte
 * (`slide`) passent par là ; les animations CSS, non. Posé avant le
 * chargement : la page n'a pas d'autre moyen de le dire.
 */
async function espionnerLesAnimations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const journal: { testid: string | null; duree: unknown }[] = [];
    Object.defineProperty(window, '__animationsDesTests', { value: journal });
    const animer = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
      const options = args[1];
      journal.push({
        testid: this.getAttribute('data-testid'),
        duree: typeof options === 'number' ? options : options?.duration,
      });
      return animer.apply(this, args);
    };
  });
}

/** Les durées des animations Web lancées sur l'élément `testid`, dans l'ordre. */
async function animationsDe(page: Page, testid: string): Promise<unknown[]> {
  return page.evaluate(
    (id) =>
      (window as unknown as { __animationsDesTests: { testid: string | null; duree: unknown }[] }).__animationsDesTests
        .filter((animation) => animation.testid === id)
        .map((animation) => animation.duree),
    testid,
  );
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
    // La puce porte le NOM de la loi, pas seulement le numéro : quand trois
    // lois différentes ont un « article 1 », trois puces « Art. 1 »
    // identiques pointeraient vers trois documents sans que rien ne les
    // distingue. Son nom, et non sa cote interne (« LOI-2016-017 »), que P2
    // et P11 retirent de tout écran.
    await expect(
      page.getByRole('link', { name: 'Loi portant Code Minier · art. 33' }),
    ).toHaveAttribute('href', '/laws/16?article=33');
    await expect(page.getByTestId('compare-result')).not.toContainText('LOI-2016-017');
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
    // L'extrait se nomme comme la puce, sans la cote.
    await expect(page.getByTestId('compare-source-0-a')).toContainText('Loi portant Code Minier — Art. 33');
    await expect(page.getByTestId('compare-source-0-a')).not.toContainText('LOI-2016-017');
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

test.describe('Mode comparaison : le mouvement (refonte A, niveau A)', () => {
  test('pendant l’attente, la balance pèse à la place des trois points, et s’arrête avec elle', async ({ page }) => {
    await intercepte(page, { delaiMs: 3_000 });
    await page.goto('/compare');
    await lancer(page);

    await cliquerJusqualEffet(
      page.getByTestId('compare-submit'),
      page.getByTestId('compare-loading'),
    );

    const attente = page.getByTestId('compare-loading');
    // La région d'annonce et son libellé ne changent pas.
    await expect(attente).toHaveAttribute('role', 'status');
    await expect(attente).toContainText('Comparaison en cours');
    // La balance, décorative : ni rôle ni nom, le libellé dit l'attente.
    const balance = attente.locator('svg.mv-balance');
    await expect(balance).toHaveCount(1);
    await expect(balance).toHaveClass(/\bmv-balance--attente\b/);
    await expect(balance).toHaveAttribute('aria-hidden', 'true');
    expect(await balance.getAttribute('role')).toBeNull();
    await expect(attente.locator('[class*="animate-bounce"]')).toHaveCount(0);
    // Elle pèse vraiment : son fléau est animé tant que l'attente dure.
    expect(await balance.locator('.mv-balance__fleau').evaluate((fleau) => fleau.getAnimations().length)).toBeGreaterThan(0);

    await expect(page.getByTestId('compare-result')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('compare-loading')).toHaveCount(0);
  });

  test('en tableau, la grille arrive ligne après ligne : A vient de la gauche, B de la droite, jamais après une seconde', async ({
    page,
  }) => {
    // Bureau (1 280 px de large) : au-delà de lg, la grille est un tableau.
    await intercepte(page, { corps: HUIT_LIGNES });
    await page.goto('/compare');
    await lancer(page);
    await cliquerJusqualEffet(
      page.getByTestId('compare-submit'),
      page.getByTestId('compare-result'),
    );

    const lignes = await arriveesDesLignes(page);
    expect(lignes).toHaveLength(8);
    // Le critère apparaît sur place ; A de 48 px à gauche, B de 48 px à droite.
    expect(lignes[0]).toEqual([
      { animation: 'mv-comparer', delai: '0.15s', x: '0px', y: '0px' },
      { animation: 'mv-comparer', delai: '0.15s', x: '-48px', y: '0px' },
      { animation: 'mv-comparer', delai: '0.15s', x: '48px', y: '0px' },
    ]);
    // Les trois cellules d'une ligne partent ensemble ; les lignes, de 160 ms
    // en 160 ms, jusqu'au sixième rang (aucun délai au-delà d'une seconde : D9).
    for (const ligne of lignes) expect(new Set(ligne.map((cellule) => cellule.delai)).size).toBe(1);
    expect(lignes.map((ligne) => ligne[0].delai)).toEqual([
      '0.15s', '0.31s', '0.47s', '0.63s', '0.79s', '0.95s', '0.95s', '0.95s',
    ]);
    // Ce qu'on tire de la grille la suit, en fondu, au plus tard à 1 s.
    const suite = page.getByTestId('compare-blindspots');
    await expect(suite).toHaveCSS('animation-name', 'mv-fondre');
    await expect(suite).toHaveCSS('animation-delay', '1s');
  });

  test('en cartes (sous lg), les cellules montent dans leur carte, sans venir de côté', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await intercepte(page);
    await page.goto('/compare');
    await lancer(page);
    await cliquerJusqualEffet(
      page.getByTestId('compare-submit'),
      page.getByTestId('compare-result'),
    );

    const [ligne] = await arriveesDesLignes(page);
    expect(ligne).toEqual([
      { animation: 'mv-comparer', delai: '0.15s', x: '0px', y: '14px' },
      { animation: 'mv-comparer', delai: '0.15s', x: '0px', y: '14px' },
      { animation: 'mv-comparer', delai: '0.15s', x: '0px', y: '14px' },
    ]);
    // Pendant l'arrivée comme après, la page ne glisse pas de côté.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test('« Voir le texte » se déroule et se replie en place, son chevron tourne, le texte cité est en Literata', async ({
    page,
  }) => {
    await espionnerLesAnimations(page);
    await intercepte(page);
    await page.goto('/compare');
    await lancer(page);
    await cliquerJusqualEffet(
      page.getByTestId('compare-submit'),
      page.getByTestId('compare-result'),
    );

    const bascule = page.getByTestId('compare-toggle-0-a');
    const chevron = bascule.locator('svg[data-icone="chevron-down"]');
    const texte = page.getByTestId('compare-source-0-a');
    await expect(chevron).toHaveAttribute('aria-hidden', 'true');
    await expect(chevron).toHaveCSS('transform', 'none');
    await expect(texte).toHaveCount(0);

    await cliquerJusqualEffet(bascule, texte);
    await expect(bascule).toHaveAttribute('aria-expanded', 'true');
    // Un demi-tour : matrix(-1, 0, 0, -1, 0, 0), aux arrondis près.
    await expect(chevron).toHaveCSS('transform', /^matrix\(-1, /);
    // Déroulé par `slide` en 500 ms, et non posé d'un coup.
    expect(await animationsDe(page, 'compare-source-0-a')).toContain(500);
    // Le texte officiel, cité mot pour mot : Literata Texte (`font-texte`).
    await expect(texte.getByText('durée initiale maximale')).toHaveCSS('font-family', /Literata Texte/);

    // Replié : le texte quitte la page (le {#if} est gardé), le chevron revient.
    await bascule.click();
    await expect(bascule).toHaveAttribute('aria-expanded', 'false');
    await expect(texte).toHaveCount(0);
    await expect(chevron).toHaveCSS('transform', 'none');
  });

  test('en mouvement réduit, rien ne bouge : balance droite, grille d’un coup, texte déplié sans glisser', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await espionnerLesAnimations(page);
    await intercepte(page, { delaiMs: 1_500 });
    await page.goto('/compare');
    await lancer(page);

    await cliquerJusqualEffet(
      page.getByTestId('compare-submit'),
      page.getByTestId('compare-loading'),
    );
    const fleau = page.getByTestId('compare-loading').locator('.mv-balance__fleau');
    expect(await fleau.evaluate((groupe) => groupe.getAnimations().length)).toBe(0);

    await expect(page.getByTestId('compare-result')).toBeVisible({ timeout: 10_000 });
    const cellules = (await arriveesDesLignes(page)).flat();
    expect(cellules.map((cellule) => cellule.animation)).toEqual(['none', 'none', 'none']);
    await expect(page.getByTestId('compare-blindspots')).toHaveCSS('animation-name', 'none');

    const bascule = page.getByTestId('compare-toggle-0-a');
    await cliquerJusqualEffet(bascule, page.getByTestId('compare-source-0-a'));
    // Aucune animation Web : le texte est là d'un coup (durée 0, `duree`).
    expect(await animationsDe(page, 'compare-source-0-a')).toEqual([]);
    // Le chevron est retourné, sans transition.
    const chevron = bascule.locator('svg[data-icone="chevron-down"]');
    await expect(chevron).toHaveCSS('transition-duration', '0s');
    await expect(chevron).toHaveCSS('transform', /^matrix\(-1, /);
  });
});

test.describe('Mode comparaison : le gréement (refonte A, niveau B)', () => {
  const decor = (page: Page) => page.getByTestId('compare-greement');

  for (const largeur of [768, 1023, 1024, 1440]) {
    test(`à ${largeur} px, deux cartes suspendues côte à côte, le bouton dessous, sans débordement`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await page.goto('/compare');
      await expect(decor(page)).toBeVisible();

      const a = (await page.getByTestId('compare-a').boundingBox())!;
      const b = (await page.getByTestId('compare-b').boundingBox())!;
      const bouton = (await page.getByTestId('compare-submit').boundingBox())!;
      expect(a.y).toBe(b.y);
      expect(a.x + a.width).toBeLessThan(b.x);
      expect(bouton.y).toBeGreaterThan(a.y + a.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }

  test('sous 640 px, le décor disparaît et les champs s’empilent', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/compare');
    await expect(decor(page)).toBeHidden();
    const a = (await page.getByTestId('compare-a').boundingBox())!;
    const b = (await page.getByTestId('compare-b').boundingBox())!;
    expect(b.y).toBeGreaterThan(a.y + a.height);
  });

  test('sur un écran court, le formulaire reste sur une ligne, sans décor', async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await page.goto('/compare');
    await expect(decor(page)).toBeHidden();
    const bouton = (await page.getByTestId('compare-submit').boundingBox())!;
    expect(bouton.y + bouton.height).toBeLessThanOrEqual(360);
  });

  test('seul le décor s’anime, sans délai au-delà d’une seconde, et les champs servent aussitôt', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/compare');
    const delais = await decor(page).evaluate((racine) =>
      [...racine.children].map((el) => parseFloat(getComputedStyle(el).animationDelay)),
    );
    expect(delais).toHaveLength(5);
    expect(Math.max(...delais)).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('compare-a')).toHaveCSS('animation-name', 'none');
    await expect(page.getByTestId('compare-submit')).toHaveCSS('animation-name', 'none');
    const carte = page.getByTestId('compare-a').locator('xpath=ancestor::label');
    await expect(carte).toHaveCSS('animation-name', 'none');
  });

  test('en mouvement réduit, le gréement est là, immobile', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/compare');
    await expect(decor(page)).toBeVisible();
    const noms = await decor(page).evaluate((racine) =>
      [...racine.children].map((el) => getComputedStyle(el).animationName),
    );
    expect(noms).toEqual(Array(5).fill('none'));
  });
});
