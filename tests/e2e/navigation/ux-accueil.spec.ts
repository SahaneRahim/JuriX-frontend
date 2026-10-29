/**
 * L'accueil refondu, dans le navigateur : propositions Q1, Q2, Q3, Q5 et P8
 * (data/ux-recherche/propositions/propositions.json du dépôt backend),
 * d'après la maquette accueil-reco.
 *
 * CE QUE CE FICHIER GARDE.
 *  - P8 : sans JavaScript, la recherche de l'accueil part vers /search?q=…
 *    (vrai formulaire GET), et la loupe de l'en-tête est un lien vers
 *    /search ; avec JavaScript, la loupe ouvre toujours la palette.
 *  - Q2 et Q3 : une seule liste de domaines, dans l'ordre provisoire, des
 *    lignes de 64 px au moins (72 sur ordinateur, deux colonnes), toute la
 *    ligne cliquable, le lien sur le nom décrit par ses textes phares, le
 *    contour de focus autour de la ligne, ni compteur ni pied « Consulter les
 *    textes ».
 *  - Q1 et Q5 : un titre de tâche en Literata, 36 puis 56 px, deux lignes au
 *    plus à 360 px, sans badge.
 *  - Restes r3 n° 3 et 42 : la navigation de l'en-tête suit le logo, et le
 *    contenu de l'accueil s'aligne sur lui.
 *
 * DONNÉES. L'accueil est rendu par le serveur, dont `page.route` ne voit pas
 * les appels : il lit la vraie API, et chaque test est sauté quand elle est
 * éteinte, sauf avec E2E_EXIGER_BACKEND=1 (`ouvrirAuServeur`). Les noms des
 * domaines attendus sont ceux des 14 domaines canoniques de la base. Les
 * recherches que lancent les formulaires sont enregistrées auprès de la
 * doublure de l'API (`enregistrerLaRecherche`) : /search, rendue par le
 * serveur, n'appelle jamais le modèle d'embeddings.
 *
 * Lancer : npx playwright test tests/e2e/navigation/ux-accueil.spec.ts --project=chromium
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { AGENT_MOBILE, attendreLeRepos, enregistrerLaRecherche, ouvrirAuServeur, visible } from '../doublures';
import { cliquerJusqualEffet } from '../hydratation';

const TELEPHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: AGENT_MOBILE };
const PETIT_TELEPHONE = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, userAgent: AGENT_MOBILE };
const BUREAU = { viewport: { width: 1440, height: 900 } };

/** Le champ de recherche de l'accueil, par son rôle et son nom (comme responsif.spec.ts). */
const champDeLAccueil = (page: Page): Locator =>
  page.locator('#contenu').getByRole('searchbox', { name: 'Rechercher', exact: true });

/** La liste des domaines et ses lignes. */
const listeDesDomaines = (page: Page): Locator => page.getByTestId('accueil-domaines');
const lignesDesDomaines = (page: Page): Locator => listeDesDomaines(page).locator(':scope > li');

/** La loupe de l'en-tête AVANT le montage : le lien nommé vers /search (pas celui de la navigation). */
const loupeEnLien = (page: Page): Locator =>
  visible(page.locator('[data-testid="site-header"] a[href="/search"][aria-label]'));

/** La même loupe une fois l'en-tête monté : le bouton de la palette. */
const loupeEnBouton = (page: Page): Locator =>
  visible(page.getByTestId('site-header').getByRole('button', { name: /^Recherche et actions rapides/ }));

/**
 * Attend que la page soit hydratée : la loupe de l'en-tête n'est un bouton
 * qu'une fois les composants montés, dans la même passe que le formulaire de
 * l'accueil et son gestionnaire.
 */
async function attendreLHydratation(page: Page): Promise<void> {
  await expect(loupeEnBouton(page)).toBeVisible({ timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// P8 : sans JavaScript
// ---------------------------------------------------------------------------

test.describe('Accueil sans JavaScript (P8)', () => {
  test.use({ javaScriptEnabled: false });

  test.describe('téléphone', () => {
    test.use(TELEPHONE);

    test('Entrée dans le champ envoie la recherche vers /search?q=', async ({ page }) => {
      // /search est rendue par le serveur : sa recherche est servie par la
      // doublure de l'API (playwright.config.ts), sans appel au modèle.
      await enregistrerLaRecherche(page.request, ['bail commercial']);
      await ouvrirAuServeur(page, '/');
      const champ = champDeLAccueil(page);
      await champ.fill('bail commercial');
      await champ.press('Enter');
      await expect(page).toHaveURL(/\/search\?q=bail\+commercial$/);
    });

    test('le bouton « Rechercher » envoie le même formulaire', async ({ page }) => {
      await enregistrerLaRecherche(page.request, ['code du travail']);
      await ouvrirAuServeur(page, '/');
      await champDeLAccueil(page).fill('code du travail');
      await page.locator('#contenu').getByRole('button', { name: 'Rechercher', exact: true }).click();
      await expect(page).toHaveURL(/\/search\?q=code\+du\+travail$/);
    });

    test('la loupe de l’en-tête est un lien vers /search', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      const loupe = loupeEnLien(page);
      await expect(loupe).toBeVisible();
      await loupe.click();
      await expect(page).toHaveURL(/\/search$/);
    });

    test('un domaine s’ouvre sans JavaScript', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      await lignesDesDomaines(page).first().getByRole('link').click();
      await expect(page).toHaveURL(/\/categories\/\d+$/);
    });
  });

  test.describe('bureau', () => {
    test.use(BUREAU);

    test('la loupe de l’en-tête est un lien vers /search', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      const loupe = loupeEnLien(page);
      await expect(loupe).toBeVisible();
      await loupe.click();
      await expect(page).toHaveURL(/\/search$/);
    });
  });
});

// ---------------------------------------------------------------------------
// P8 : avec JavaScript, la palette reste
// ---------------------------------------------------------------------------

test.describe('Accueil avec JavaScript', () => {
  test.use(BUREAU);

  test('la loupe de l’en-tête ouvre la palette une fois la page montée', async ({ page }) => {
    await ouvrirAuServeur(page, '/');
    await cliquerJusqualEffet(loupeEnBouton(page), page.getByRole('dialog', { name: 'Palette de commande' }));
  });

  test('une recherche vide ne quitte pas l’accueil', async ({ page }) => {
    await ouvrirAuServeur(page, '/');
    await attendreLHydratation(page);
    const champ = champDeLAccueil(page);
    await champ.fill('   ');
    await champ.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(champ).toBeFocused();
  });

  test('la recherche part sans recharger, espaces des bords retirés', async ({ page }) => {
    await enregistrerLaRecherche(page.request, ['licenciement']);
    await ouvrirAuServeur(page, '/');
    await attendreLHydratation(page);
    // Une marque posée sur `window` : un rechargement complet l'effacerait.
    // SvelteKit traite le formulaire GET comme un lien (navigation côté client).
    await page.evaluate(() => Object.assign(window, { __marqueAccueil: 'meme-document' }));
    const champ = champDeLAccueil(page);
    await champ.fill('  licenciement  ');
    await champ.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=licenciement$/);
    expect(await page.evaluate(() => (window as unknown as { __marqueAccueil?: string }).__marqueAccueil)).toBe(
      'meme-document',
    );
  });
});

// ---------------------------------------------------------------------------
// Q2, Q3 : la liste des domaines
// ---------------------------------------------------------------------------

/** L'ordre provisoire de la proposition Q2, en noms courts (src/lib/categories.ts). */
const ORDRE_PROVISOIRE = [
  'Travail et sécurité sociale',
  'Pénal et procédure pénale',
  'Famille et état civil',
  'Foncier et domaine de l’État',
  'Affaires, banque et OHADA',
  'Civil et procédure civile',
  'Finances publiques et impôts',
  'Constitution et institutions',
  'Administration et collectivités',
  'Fonction publique',
  'Traités et accords',
  'Environnement, mines et forêts',
  'Santé publique',
  'Éducation, culture et médias',
];

test.describe('Liste des domaines (Q2 A, Q3 A)', () => {
  test.describe('téléphone', () => {
    test.use(TELEPHONE);

    test('les domaines dans l’ordre provisoire, puis « Tous les textes »', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      const noms = await lignesDesDomaines(page).locator('h3').allInnerTexts();
      expect(noms.slice(0, ORDRE_PROVISOIRE.length)).toEqual(ORDRE_PROVISOIRE);
      expect(noms.at(-1)).toBe('Tous les textes');
    });

    test('un lien par ligne, décrit par ses textes phares, toute la ligne cliquable', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      const lignes = lignesDesDomaines(page);
      const total = await lignes.count();
      for (let i = 0; i < total; i++) await expect(lignes.nth(i).getByRole('link')).toHaveCount(1);

      const premiere = lignes.first();
      await expect(premiere.getByRole('link')).toHaveAccessibleName('Travail et sécurité sociale');
      await expect(premiere.getByRole('link')).toHaveAccessibleDescription(/Code du travail/);

      // Un appui près du chevron, loin du nom : le lien étendu le reçoit.
      const boite = await premiere.boundingBox();
      expect(boite).not.toBeNull();
      await premiere.click({ position: { x: boite!.width - 12, y: boite!.height / 2 } });
      await expect(page).toHaveURL(/\/categories\/\d+$/);
    });

    test('des lignes de 64 px au moins, sur une colonne', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      const boites = await lignesDesDomaines(page).evaluateAll((lis) =>
        lis.map((li) => {
          const r = li.getBoundingClientRect();
          return { x: r.x, hauteur: r.height };
        }),
      );
      for (const { hauteur } of boites) expect(hauteur).toBeGreaterThanOrEqual(63.5);
      expect(new Set(boites.map((b) => Math.round(b.x))).size).toBe(1);
    });

    test('ni compteur ni pied « Consulter les textes »', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      await expect(page.getByText('Consulter les textes')).toHaveCount(0);
      // « 1 277 textes » (fonction publique) se lisait comme une couverture.
      await expect(listeDesDomaines(page)).not.toContainText(/\d[\d\s\u202f\u00a0]*\stextes?\b(?! officiels)/);
    });
  });

  test.describe('bureau', () => {
    test.use(BUREAU);

    test('deux colonnes de lignes de 72 px, « Tous les textes » sur toute la largeur', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      const lignes = lignesDesDomaines(page);
      const boites = await lignes.evaluateAll((lis) =>
        lis.map((li) => {
          const r = li.getBoundingClientRect();
          return { x: r.x, y: r.y, largeur: r.width, hauteur: r.height };
        }),
      );
      for (const { hauteur } of boites) expect(hauteur).toBeGreaterThanOrEqual(71.5);
      // Deux colonnes : la deuxième ligne à droite de la première, à la même hauteur.
      expect(Math.round(boites[1].y)).toBe(Math.round(boites[0].y));
      expect(boites[1].x).toBeGreaterThan(boites[0].x);
      // Avec un nombre pair de domaines, « Tous les textes » prend la rangée entière.
      const liste = await listeDesDomaines(page).boundingBox();
      const derniere = boites.at(-1)!;
      if ((boites.length - 1) % 2 === 0) expect(derniere.largeur).toBeGreaterThan(liste!.width - 4);
    });

    test('au clavier, le contour de focus entoure la ligne', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      await attendreLeRepos(page);
      await attendreLHydratation(page);
      const lien = lignesDesDomaines(page).first().getByRole('link');
      // Un aller-retour au clavier : le focus est alors « visible » (:focus-visible).
      await lien.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(lien).toBeFocused();
      const contour = await lien.evaluate((a) => {
        const apres = getComputedStyle(a, '::after');
        return { style: apres.outlineStyle, largeur: apres.outlineWidth, position: apres.position };
      });
      expect(contour.style).toBe('solid');
      expect(contour.largeur).toBe('2px');
      expect(contour.position).toBe('absolute');
    });

    test('les noms suivent la langue', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      await cliquerJusqualEffet(page.getByTestId('lang-en'), page.locator('html[lang="en"]'));
      await expect(lignesDesDomaines(page).first().locator('h3')).toHaveText('Labour and social security');
      await expect(lignesDesDomaines(page).first().getByRole('link')).toHaveAccessibleDescription(/Labour Code/);
    });
  });
});

// ---------------------------------------------------------------------------
// Q1, Q5 : le hero
// ---------------------------------------------------------------------------

test.describe('Hero (Q1 A, Q5 A)', () => {
  test.describe('bureau', () => {
    test.use(BUREAU);

    test('un titre de tâche en Literata 600, 56 px, sans badge', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      const titre = page.locator('h1');
      await expect(titre).toHaveCount(1);
      await expect(titre).toHaveText(/^Que dit la loi camerounaise\s?\?$/);
      const style = await titre.evaluate((h1) => {
        const s = getComputedStyle(h1);
        return { famille: s.fontFamily, graisse: s.fontWeight, taille: s.fontSize, interlettrage: s.letterSpacing };
      });
      expect(style.famille).toContain('Literata Titre');
      expect(style.graisse).toBe('600');
      expect(style.taille).toBe('56px');
      expect(['normal', '0px']).toContain(style.interlettrage);
      await expect(page.getByText('IA Juridique Camerounaise')).toHaveCount(0);
      // Les deux onglets restent.
      await expect(page.locator('#contenu').getByRole('link', { name: 'Assistant IA' })).toBeVisible();
    });
  });

  test.describe('petit téléphone', () => {
    test.use(PETIT_TELEPHONE);

    test('36 px, deux lignes au plus à 360 px', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      const mesure = await page.locator('h1').evaluate((h1) => {
        const s = getComputedStyle(h1);
        return { taille: parseFloat(s.fontSize), interligne: parseFloat(s.lineHeight), hauteur: h1.getBoundingClientRect().height };
      });
      expect(mesure.taille).toBe(36);
      expect(mesure.hauteur).toBeLessThanOrEqual(2 * mesure.interligne + 1);
    });
  });
});

// ---------------------------------------------------------------------------
// Restes r3 n° 3 et 42 : en-tête et marges
// ---------------------------------------------------------------------------

test.describe('En-tête et marges (restes r3)', () => {
  for (const largeur of [1024, 1440]) {
    test.describe(`${largeur} px`, () => {
      test.use({ viewport: { width: largeur, height: 800 } });

      test('la navigation suit le logo, au lieu de se coller aux réglages', async ({ page }) => {
        await ouvrirAuServeur(page, '/');
        const logo = await page.getByTestId('site-logo').boundingBox();
        const nav = await page.locator('[data-testid="site-header"] nav').boundingBox();
        expect(logo && nav).toBeTruthy();
        const ecart = nav!.x - (logo!.x + logo!.width);
        expect(ecart).toBeGreaterThanOrEqual(24);
        expect(ecart).toBeLessThanOrEqual(40);
      });
    });
  }

  for (const largeur of [768, 1024]) {
    test.describe(`${largeur} px`, () => {
      test.use({ viewport: { width: largeur, height: 1024 } });

      test('la liste des domaines commence sous le logo', async ({ page }) => {
        await ouvrirAuServeur(page, '/');
        const logo = await page.getByTestId('site-logo').boundingBox();
        const liste = await listeDesDomaines(page).boundingBox();
        expect(Math.abs(liste!.x - logo!.x)).toBeLessThanOrEqual(1);
      });
    });
  }
});
