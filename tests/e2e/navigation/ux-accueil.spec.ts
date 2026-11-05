/**
 * L'accueil refondu, dans le navigateur : propositions Q1, Q2, Q3, Q5 et P8
 * (data/ux-recherche/propositions/propositions.json du dépôt backend), puis
 * la refonte A, étape E3 (docs/refonte/PASSATION.md : le champ unique, les
 * questions fréquentes, les domaines en tuiles et en pastilles, « Ce que
 * JuriX vous montre », la barre d'onglets du bas).
 *
 * CE QUE CE FICHIER GARDE.
 *  - P8, H10, H12 : sans JavaScript, la zone de texte de l'accueil part vers
 *    /search?q=… par le bouton d'envoi, nommé « Rechercher » (vrai
 *    formulaire GET ; Entrée y va à la ligne), et la loupe de l'en-tête est
 *    un lien vers /search ; avec JavaScript, en mode « Recherche », la
 *    recherche part sans recharger, et une recherche vide reste sur
 *    l'accueil ; en mode « Assistant IA », la question part une seule fois
 *    vers l'assistant, et l'adresse est nettoyée (H1). La loupe qui ouvre la
 *    palette, une fois la page montée, se vérifie dans palette.spec.ts.
 *  - H2, P5 : aucun profil choisi à l'arrivée ; un profil choisi sur
 *    l'accueil est celui du chat, qui ne repose pas la question ; « Sans
 *    profil » vaut pour la visite.
 *  - H9, H11 : l'exemple tapé s'arrête au focus et repart à zéro au blur ;
 *    en mouvement réduit, rien ne bouge et tout se lit.
 *  - Q2 et Q3 : les domaines, dans l'ordre provisoire, en tuiles (quatre
 *    colonnes au bureau, « Tous les textes » sur deux) et en pastilles de
 *    44 px qui défilent au téléphone ; toute la tuile cliquable, le lien sur
 *    le nom décrit par ses textes phares, le contour de focus autour de la
 *    tuile ; au survol, l'icône joue son geste. Ni compteur ni pied
 *    « Consulter les textes » : au rendu serveur, dans accueil.serveur.test.ts.
 *  - Q1 et Q5 : un titre de tâche en Literata, 36 puis 56 px, deux lignes au
 *    plus à 360 px, sans badge.
 *  - 390 × 844 : le champ dans le premier écran, la barre d'onglets du bas
 *    (trois onglets de 44 px au moins), absente sur /chat, sur les pages de
 *    compte et au-dessus de md.
 *  - Restes r3 n° 3 et 42 : la navigation de l'en-tête suit le logo, et le
 *    contenu de l'accueil s'aligne sur lui.
 *  - Refonte A, E2 : l'introduction du logo ne rejoue pas à la navigation
 *    interne, ni à l'aller-retour entre l'accueil et l'assistant sur un
 *    téléphone, réseau lent compris.
 *
 * DONNÉES. L'accueil est rendu par le serveur, dont `page.route` ne voit pas
 * les appels : il lit la vraie API, et chaque test est sauté quand elle est
 * éteinte, sauf avec E2E_EXIGER_BACKEND=1 (`ouvrirAuServeur`). Les noms des
 * domaines attendus sont ceux des 14 domaines canoniques de la base. Les
 * recherches que lancent les formulaires sont enregistrées auprès de la
 * doublure de l'API (`enregistrerLaRecherche`) : /search, rendue par le
 * serveur, n'appelle jamais le modèle d'embeddings. Le chat est simulé
 * (`intercepterLApi`) : aucun appel au modèle.
 *
 * Lancer : npx playwright test tests/e2e/navigation/ux-accueil.spec.ts --project=chromium
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import { SUGGESTIONS, questionAffichee } from '../../../src/lib/suggestions';
import {
  AGENT_MOBILE,
  attendreLeRepos,
  enregistrerLaRecherche,
  exiger,
  intercepterLApi,
  ouvrirAuServeur,
  visible,
} from '../doublures';
import { cliquerJusqualEffet } from '../hydratation';

const TELEPHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: AGENT_MOBILE };
const PETIT_TELEPHONE = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, userAgent: AGENT_MOBILE };
const BUREAU = { viewport: { width: 1440, height: 900 } };

/**
 * La zone de texte du champ unique, par son rôle et son nom : une <textarea>
 * a le rôle `textbox` (refonte A, H12).
 */
const champDeLAccueil = (page: Page): Locator =>
  page.locator('#contenu').getByRole('textbox', { name: 'Votre question ou votre recherche', exact: true });

/**
 * Le bouton d'envoi du champ unique, par son type : il s'appelle
 * « Rechercher » avant l'hydratation, « Poser la question » ensuite en mode
 * « Assistant IA » (H10).
 */
const envoiDeLAccueil = (page: Page): Locator => page.locator('#contenu form[role="search"] button[type="submit"]');

/** L'exemple tapé, superposé à la zone de texte. */
const exempleTape = (page: Page): Locator => page.getByTestId('accueil-exemple');

/** Son texte, préfixe compris, blancs réduits. */
const texteDeLExemple = (page: Page): Promise<string> =>
  // Blancs ASCII seuls : l'espace fine insécable de « Exemple : » est gardée.
  exempleTape(page).evaluate((el) => (el.textContent ?? '').replace(/[ \t\n\r\f]+/g, ' ').trim());

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

test.describe('Accueil sans JavaScript (P8, H10, H12)', () => {
  test.use({ javaScriptEnabled: false });

  test.describe('téléphone', () => {
    test.use(TELEPHONE);

    // Jusqu'aux résultats : ux-complements.spec.ts.
    test('le bouton « Rechercher » envoie la zone de texte à /search', async ({ page }) => {
      // /search est rendue par le serveur : sa recherche est servie par la
      // doublure de l'API (playwright.config.ts), sans appel au modèle.
      await enregistrerLaRecherche(page.request, ['code du travail']);
      await ouvrirAuServeur(page, '/');
      await champDeLAccueil(page).fill('code du travail');
      await page.locator('#contenu').getByRole('button', { name: 'Rechercher', exact: true }).click();
      await expect(page).toHaveURL(/\/search\?q=code\+du\+travail$/);
    });

    test('Entrée va à la ligne, sans rien envoyer : une zone de texte n’a pas d’envoi implicite (H12)', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      const champ = champDeLAccueil(page);
      await champ.fill('code du travail');
      await champ.press('Enter');
      await expect(page).toHaveURL(/\/$/);
      await expect(champ).toHaveValue('code du travail\n');
    });

    test('le premier exemple est écrit, sans curseur ; les démonstrations sont finies (H9, H11)', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      await expect(exempleTape(page)).toBeVisible();
      expect(await texteDeLExemple(page)).toBe(`Exemple\u202f: ${questionAffichee(SUGGESTIONS.fr.general[0])}`);
      await expect(exempleTape(page).locator('.mv-curseur')).toHaveCount(0);
      const preuves = page.getByTestId('accueil-preuves');
      await expect(preuves.locator('[data-etat]')).toHaveAttribute('data-etat', 'repos');
      await expect(preuves.getByText('Art.\u00a037', { exact: true })).toBeVisible();
      await expect(preuves.locator('mark')).toHaveText('indemnité de licenciement');
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
// P8 : avec JavaScript, la recherche part sans recharger
// ---------------------------------------------------------------------------

test.describe('Accueil avec JavaScript', () => {
  test.use(BUREAU);

  test('une recherche vide ne quitte pas l’accueil', async ({ page }) => {
    await ouvrirAuServeur(page, '/');
    await attendreLHydratation(page);
    const champ = champDeLAccueil(page);
    await champ.fill('   ');
    await champ.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    await expect(champ).toBeFocused();
  });

  test('en mode « Recherche », la recherche part sans recharger, espaces des bords retirés', async ({ page }) => {
    await enregistrerLaRecherche(page.request, ['licenciement']);
    await ouvrirAuServeur(page, '/');
    await attendreLHydratation(page);
    // Une marque posée sur `window` : un rechargement complet l'effacerait.
    // SvelteKit traite le formulaire GET comme un lien (navigation côté client).
    await page.evaluate(() => Object.assign(window, { __marqueAccueil: 'meme-document' }));
    const recherche = page.getByTestId('accueil-mode-recherche');
    await recherche.click();
    await expect(recherche).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('accueil-mode-assistant')).toHaveAttribute('aria-pressed', 'false');
    // En mode « Recherche », l'envoi garde son nom (R4).
    await expect(envoiDeLAccueil(page)).toHaveAccessibleName('Rechercher');
    const champ = champDeLAccueil(page);
    await champ.fill('  licenciement  ');
    await champ.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=licenciement$/);
    expect(await page.evaluate(() => (window as unknown as { __marqueAccueil?: string }).__marqueAccueil)).toBe(
      'meme-document',
    );
  });

  test('en mode « Assistant IA », la question part une fois vers l’assistant, et l’adresse est nettoyée (H1)', async ({
    page,
  }) => {
    const envois: string[] = [];
    await intercepterLApi(page, (methode, chemin) => {
      if (chemin === '/rag/ask/stream') {
        envois.push(chemin);
        return { flux: [{ chunk: 'Réponse simulée.', done: false }, { chunk: '', done: true, sources: [] }] };
      }
      return undefined;
    });
    await ouvrirAuServeur(page, '/');
    await attendreLHydratation(page);
    await expect(page.getByTestId('accueil-mode-assistant')).toHaveAttribute('aria-pressed', 'true');
    await expect(envoiDeLAccueil(page)).toHaveAccessibleName('Poser la question');
    // Maj+Entrée va à la ligne ; le saut de ligne devient une espace à l'envoi.
    const champ = champDeLAccueil(page);
    await champ.fill('Quelles indemnités en cas de');
    await champ.press('Shift+Enter');
    await champ.pressSequentially('licenciement économique ?');
    await expect(champ).toHaveValue('Quelles indemnités en cas de\nlicenciement économique ?');
    await envoiDeLAccueil(page).click();

    await page.waitForURL((adresse) => adresse.pathname === '/chat');
    await expect(page.getByRole('log')).toContainText('Quelles indemnités en cas de licenciement économique ?');
    await expect.poll(() => envois.length).toBe(1);
    // `q` et `envoyer` ont quitté l'adresse : un rechargement ne renvoie rien.
    await expect(page).toHaveURL(/\/chat$/);
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(envois).toHaveLength(1);
  });

  test('l’exemple tapé s’arrête au focus, et repart à zéro quand le champ est quitté vide (H9)', async ({ page }) => {
    await ouvrirAuServeur(page, '/');
    await attendreLHydratation(page);
    const premier = await texteDeLExemple(page);
    // La boucle tourne : 2,2 s plus tard, l'exemple s'efface.
    await expect.poll(() => texteDeLExemple(page), { timeout: 6_000 }).not.toBe(premier);

    const champ = champDeLAccueil(page);
    await champ.focus();
    await expect(exempleTape(page)).toHaveCSS('opacity', '0');
    const fige = await texteDeLExemple(page);
    await page.waitForTimeout(800);
    expect(await texteDeLExemple(page)).toBe(fige);

    // Quitté vide : l'exemple revient, et la frappe repart de sa première lettre.
    await page.keyboard.press('Tab');
    await expect(exempleTape(page)).toHaveCSS('opacity', '1');
    await expect.poll(() => texteDeLExemple(page), { timeout: 2_000 }).toMatch(/^Exemple\s*:\s?[^]{0,3}$/);
    await expect.poll(() => texteDeLExemple(page), { timeout: 6_000 }).toMatch(/^Exemple\s*:\s?\S{4,}/);

    // Une saisie cache l'exemple, focus ou non.
    await champ.fill('garde à vue');
    await champ.blur();
    await expect(exempleTape(page)).toHaveCSS('opacity', '0');
  });
});

test.describe('Mouvement réduit : tout se lit, rien ne bouge (A2 § 2.1)', () => {
  test.use(BUREAU);

  test('exemple statique, démonstrations finies, aucune animation en cours', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ouvrirAuServeur(page, '/');
    await attendreLHydratation(page);
    const premier = await texteDeLExemple(page);
    expect(premier).toMatch(/^Exemple\s*: \S/);
    await page.waitForTimeout(3_000);
    expect(await texteDeLExemple(page)).toBe(premier);
    await expect(exempleTape(page).locator('.mv-curseur')).toHaveCount(0);

    const preuves = page.getByTestId('accueil-preuves');
    await preuves.scrollIntoViewIfNeeded();
    await expect(preuves.locator('[data-etat]')).toHaveAttribute('data-etat', 'repos');
    // Le passage cité, fond et trait, entiers.
    await expect(preuves.locator('mark')).toHaveCSS('background-size', /^100% [\d.]+px, 100% 2px$/);
    for (const statut of await preuves.locator('li').all()) await expect(statut).toHaveCSS('opacity', '1');

    // Un changement de mode change l'exemple, sans frappe.
    await page.getByTestId('accueil-mode-recherche').click();
    await expect.poll(() => texteDeLExemple(page)).toBe('Exemple\u202f: Code du travail');

    const enCours = await page.evaluate(
      () => document.getAnimations().filter((animation) => animation.playState === 'running').length,
    );
    expect(enCours).toBe(0);
  });
});

test.describe('Ce que JuriX vous montre, avec le mouvement (H11)', () => {
  test.use(BUREAU);

  test('armées sous l’écran, jouées une fois à l’arrivée, puis finies et lisibles', async ({ page }) => {
    await ouvrirAuServeur(page, '/');
    await attendreLHydratation(page);
    const preuves = page.getByTestId('accueil-preuves');
    const grille = preuves.locator('[data-etat]');
    await expect(grille).toHaveAttribute('data-etat', 'arme');

    await grille.scrollIntoViewIfNeeded();
    await expect(grille).toHaveAttribute('data-etat', 'repos');
    await expect(preuves.getByText('Art.\u00a037', { exact: true })).toHaveCSS('opacity', '1');
    for (const statut of await preuves.locator('li').all()) await expect(statut).toHaveCSS('opacity', '1');
    await expect(preuves.locator('mark')).toHaveCSS('background-size', /^100% [\d.]+px, 100% 2px$/);
  });
});

test.describe('Le profil choisi sur l’accueil est celui du chat (H2, P5)', () => {
  // Un navigateur VIDE : aucun profil choisi, comme à la première visite.
  test.use({ ...BUREAU, storageState: { cookies: [], origins: [] } });

  /** Répond en flux à chaque question, et garde le corps des requêtes. */
  async function repondre(page: Page): Promise<Record<string, unknown>[]> {
    const corps: Record<string, unknown>[] = [];
    await page.route('**/api/v1/rag/ask/stream', (route) => {
      const demande = route.request().postDataJSON() as Record<string, unknown>;
      corps.push(demande);
      const evenements = [
        { chunk: 'Selon les textes, voici la réponse.', done: false },
        { chunk: '', done: true, sources: [], session_id: 'sid-accueil', persona: demande.persona ?? 'general' },
      ];
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: evenements.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
      });
    });
    return corps;
  }

  test('aucun profil à l’arrivée ; « Étudiant en droit » choisi ici part avec la question, sans la question du profil', async ({
    page,
  }) => {
    const corps = await repondre(page);
    await ouvrirAuServeur(page, '/');
    await attendreLHydratation(page);
    const profils = page.getByRole('group', { name: 'Je suis' });
    await expect(profils.locator('button[aria-pressed="true"]')).toHaveCount(0);
    await expect(page.getByTestId('persona-dialog')).toHaveCount(0);

    await profils.getByRole('button', { name: 'Étudiant en droit' }).click();
    await expect(profils.getByRole('button', { name: 'Étudiant en droit' })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('jurix-persona'))).toBe('étudiant');
    // Les questions fréquentes sont celles du profil.
    const questions = page.getByTestId('accueil-faq').getByRole('link');
    await expect(questions.first()).toHaveText(SUGGESTIONS.fr['étudiant'][0]);

    await questions.first().click();
    await page.waitForURL((adresse) => adresse.pathname === '/chat');
    await expect(page.getByRole('log')).toContainText('voici la réponse');
    await expect(page.getByTestId('chat-profile-question')).toHaveCount(0);
    expect(corps).toHaveLength(1);
    expect(corps[0]).toMatchObject({ question: SUGGESTIONS.fr['étudiant'][0], persona: 'étudiant' });
  });

  test('« Sans profil » vaut pour la visite : le cookie de refus, et le chat ne demande rien', async ({ page }) => {
    const corps = await repondre(page);
    await ouvrirAuServeur(page, '/');
    await attendreLHydratation(page);
    const sans = page.getByTestId('accueil-profil-sans');
    await sans.click();
    await expect(sans).toHaveAttribute('aria-pressed', 'true');
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'jurix-persona-refus')?.value).toBe('1');
    expect(await page.evaluate(() => localStorage.getItem('jurix-persona'))).toBeNull();

    await page.getByTestId('accueil-faq').getByRole('link').first().click();
    await page.waitForURL((adresse) => adresse.pathname === '/chat');
    await expect(page.getByRole('log')).toContainText('voici la réponse');
    await expect(page.getByTestId('chat-profile-question')).toHaveCount(0);
    expect(corps).toHaveLength(1);
    expect('persona' in corps[0]).toBe(false);
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

test.describe('Les domaines (Q2 A, Q3 A, refonte A)', () => {
  test.describe('téléphone', () => {
    test.use(TELEPHONE);

    test('les domaines dans l’ordre provisoire, puis « Tous les textes », en pastilles aux noms très courts', async ({
      page,
    }) => {
      await ouvrirAuServeur(page, '/');
      // Le nom du lien : le nom court entier, réservé aux lecteurs d'écran au
      // téléphone ; à l'écran, le nom très court de la pastille.
      const noms = await lignesDesDomaines(page).locator('[data-nom="court"]').allTextContents();
      expect(noms.slice(0, ORDRE_PROVISOIRE.length)).toEqual(ORDRE_PROVISOIRE);
      await expect(lignesDesDomaines(page).last().getByRole('link')).toHaveAccessibleName('Tous les textes');
      const pastilles = await lignesDesDomaines(page).locator('[data-nom="puce"]').allInnerTexts();
      expect(pastilles.slice(0, 6)).toEqual(['Travail', 'Pénal', 'Famille', 'Foncier', 'Affaires', 'Civil']);
    });

    test('un lien par pastille, nommé et décrit, toute la pastille cliquable', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      const lignes = lignesDesDomaines(page);
      const total = await lignes.count();
      for (let i = 0; i < total; i++) await expect(lignes.nth(i).getByRole('link')).toHaveCount(1);

      const premiere = lignes.first();
      await expect(premiere.getByRole('link')).toHaveAccessibleName('Travail et sécurité sociale');
      await expect(premiere.getByRole('link')).toHaveAccessibleDescription(/Code du travail/);

      // Un appui au bord droit de la pastille, loin du nom : le lien étendu le reçoit.
      const boite = await premiere.boundingBox();
      expect(boite).not.toBeNull();
      await premiere.click({ position: { x: boite!.width - 8, y: boite!.height / 2 } });
      await expect(page).toHaveURL(/\/categories\/\d+$/);
    });

    test('une rangée de pastilles de 44 px qui défile de côté, « Tous les textes » en tête, la page immobile', async ({
      page,
    }) => {
      await ouvrirAuServeur(page, '/');
      // Au repos : la cascade d'entrée fait monter chaque pastille de 14 px.
      await attendreLeRepos(page);
      const liste = listeDesDomaines(page);
      const mesure = await liste.evaluate((ul) => ({
        defile: ul.scrollWidth > ul.clientWidth + 1,
        debordement: getComputedStyle(ul).overflowX,
        page: document.documentElement.scrollWidth,
        ecran: window.innerWidth,
      }));
      expect(mesure.defile).toBe(true);
      expect(mesure.debordement).toBe('auto');
      expect(mesure.page).toBeLessThanOrEqual(mesure.ecran + 1);

      const boites = await lignesDesDomaines(page).evaluateAll((lis) =>
        lis.map((li) => {
          const r = li.getBoundingClientRect();
          return { x: r.x, y: r.y, hauteur: r.height };
        }),
      );
      for (const { hauteur } of boites) expect(hauteur).toBeGreaterThanOrEqual(43.5);
      // Une seule rangée.
      expect(new Set(boites.map((b) => Math.round(b.y))).size).toBe(1);
      // « Tous les textes », dernier du DOM, est la première pastille à l'écran.
      expect(boites.at(-1)!.x).toBeLessThan(boites[0].x);

      // La rangée défile pour de vrai : la dernière pastille vient à l'écran.
      await liste.evaluate((ul) => ul.scrollTo({ left: ul.scrollWidth }));
      await expect(lignesDesDomaines(page).nth(13)).toBeInViewport();
      expect(await page.evaluate(() => window.scrollX)).toBe(0);
    });
  });

  test.describe('bureau', () => {
    test.use(BUREAU);

    test('quatre colonnes de tuiles de 148 px, « Tous les textes » sur deux', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      // Au repos : la cascade d'entrée fait monter chaque tuile de 14 px.
      await attendreLeRepos(page);
      const boites = await lignesDesDomaines(page).evaluateAll((lis) =>
        lis.map((li) => {
          const r = li.getBoundingClientRect();
          return { x: r.x, y: r.y, largeur: r.width, hauteur: r.height };
        }),
      );
      for (const { hauteur } of boites) expect(hauteur).toBeGreaterThanOrEqual(147.5);
      // Quatre tuiles par rangée, la cinquième en dessous.
      expect(new Set(boites.slice(0, 4).map((b) => Math.round(b.y))).size).toBe(1);
      expect(boites[4].y).toBeGreaterThan(boites[0].y);
      expect(Math.round(boites[4].x)).toBe(Math.round(boites[0].x));
      // Quatorze domaines : « Tous les textes » prend les deux cases restantes.
      const derniere = boites.at(-1)!;
      if ((boites.length - 1) % 4 === 2) expect(derniere.largeur).toBeGreaterThan(2 * boites[0].largeur);
    });

    test('au survol, la tuile monte et son icône joue son geste ; pas en mouvement réduit', async ({ page }) => {
      await ouvrirAuServeur(page, '/');
      await attendreLeRepos(page);
      const travail = lignesDesDomaines(page).first();
      const icone = travail.locator('.mv-geste__icone');
      await travail.hover();
      await expect.poll(() => icone.evaluate((el) => getComputedStyle(el).animationName)).toBe('mv-icone-tilt');

      await page.mouse.move(0, 0);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await travail.hover();
      expect(await icone.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
      expect(await travail.evaluate((li) => getComputedStyle(li).transform)).toBe('none');
    });

    test('au clavier, le contour de focus entoure la tuile', async ({ page }) => {
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
      await expect(lignesDesDomaines(page).first().getByRole('link')).toHaveAccessibleName('Labour and social security');
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
      // Plus d'onglets « Recherche | Assistant IA » sous le titre : le mode
      // est une bascule du champ unique (refonte A).
      await expect(page.locator('#contenu').getByRole('link', { name: 'Assistant IA' })).toHaveCount(0);
      await expect(page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Assistant IA' })).toBeVisible();
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
// Refonte A, E3 : le premier écran du téléphone et la barre d'onglets du bas
// ---------------------------------------------------------------------------

test.describe('Téléphone : le premier écran et la barre d’onglets du bas (H6)', () => {
  test.use(TELEPHONE);

  test('390 × 844 : le champ et son envoi dans le premier écran, au-dessus de la barre du bas', async ({ page }) => {
    await ouvrirAuServeur(page, '/');
    await attendreLHydratation(page);
    const barre = page.getByTestId('barre-onglets');
    await expect(barre).toBeVisible();
    const hautDeLaBarre = (await barre.boundingBox())!.y;
    for (const cible of [champDeLAccueil(page), envoiDeLAccueil(page)]) {
      const boite = await cible.boundingBox();
      expect(boite).not.toBeNull();
      expect(boite!.y).toBeGreaterThanOrEqual(0);
      expect(boite!.y + boite!.height).toBeLessThanOrEqual(hautDeLaBarre);
    }
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('trois onglets de 44 px au moins, l’accueil courant ; « Parcourir » mène aux textes', async ({ page }) => {
    await ouvrirAuServeur(page, '/');
    await attendreLHydratation(page);
    const barre = page.getByRole('navigation', { name: 'Navigation' });
    const onglets = barre.getByRole('link');
    await expect(onglets).toHaveText(['Accueil', 'Assistant IA', 'Parcourir']);
    for (const onglet of await onglets.all()) {
      const boite = (await onglet.boundingBox())!;
      expect(boite.height).toBeGreaterThanOrEqual(44);
      expect(boite.width).toBeGreaterThanOrEqual(44);
    }
    await expect(onglets.first()).toHaveAttribute('aria-current', 'page');
    // Le bouton flottant de l'assistant n'est plus là : l'onglet le remplace.
    await expect(page.getByTestId('chat-fab')).toBeHidden();

    await onglets.nth(2).click();
    await page.waitForURL((adresse) => adresse.pathname === '/laws');
    await expect(page.getByRole('navigation', { name: 'Navigation' }).getByRole('link', { name: 'Parcourir' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('absente sur /chat, dans l’administration et sur les pages de compte ; présente sur /about', async ({ page }) => {
    for (const chemin of ['/chat', '/admin', '/login', '/signup']) {
      await page.goto(chemin);
      await expect(page.getByTestId('barre-onglets'), chemin).toHaveCount(0);
    }
    await page.goto('/about');
    await expect(page.getByTestId('barre-onglets')).toBeVisible();
    await expect(page.getByTestId('barre-onglets').locator('[aria-current]')).toHaveCount(0);
  });

  test('présente sur la page d’erreur : le retour le plus proche du pouce', async ({ page }) => {
    const reponse = await page.goto('/page-qui-n-existe-pas');
    expect(reponse?.status()).toBe(404);
    await expect(page.getByTestId('barre-onglets')).toBeVisible();
    await expect(page.getByTestId('barre-onglets').getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/');
  });

  test('un champ qui a le focus retire la barre : le clavier la ferait flotter sur la saisie', async ({ page }) => {
    await ouvrirAuServeur(page, '/');
    await attendreLHydratation(page);
    const barre = page.getByTestId('barre-onglets');
    await expect(barre).toBeVisible();
    await champDeLAccueil(page).focus();
    await expect(champDeLAccueil(page)).toBeFocused();
    await expect(barre).toBeHidden();
    await champDeLAccueil(page).blur();
    await expect(barre).toBeVisible();
  });

  test('au-dessus de md, plus de barre du bas', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/about');
    await expect(page.getByTestId('barre-onglets')).toBeHidden();
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

// ---------------------------------------------------------------------------
// Refonte A, E2 : l'introduction du logo, une fois par chargement du document
// ---------------------------------------------------------------------------

/**
 * Les animations en cours dans la balance du logo de l'en-tête, par leur nom.
 * Une animation dans son délai (0,35 s) en fait déjà partie.
 */
const animationsDuLogo = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const balance = document.querySelector('[data-testid="site-logo"] svg');
    if (!balance) return ['pas de balance'];
    return document
      .getAnimations()
      .filter((animation) => {
        const cible = (animation.effect as KeyframeEffect | null)?.target;
        return cible instanceof Node && balance.contains(cible);
      })
      .map((animation) => (animation as CSSAnimation).animationName);
  });

/**
 * Accueil → assistant (par le menu du site) → retour arrière, puis assistant
 * → accueil (par le menu du chat) : à chaque retour sur l'accueil, le logo
 * est de nouveau affiché, et rien ne doit y jouer. Contrôlé dès que le logo
 * se montre : une introduction rejouée y serait en cours pendant 2,25 s.
 */
async function allerRetourParLAssistant(page: Page): Promise<void> {
  await cliquerJusqualEffet(page.getByTestId('nav-mobile-toggle'), page.getByTestId('nav-mobile-panel'));
  await page.locator('[data-testid=nav-mobile-panel] a[href="/chat"]').click();
  await page.waitForURL((adresse) => adresse.pathname === '/chat');
  await expect(page.getByTestId('site-logo')).toBeHidden();
  await page.goBack();
  await page.waitForURL((adresse) => adresse.pathname === '/');
  await expect(page.getByTestId('site-logo')).toBeVisible();
  expect(await animationsDuLogo(page), 'retour arrière sur l’accueil').toEqual([]);

  await page.goForward();
  await page.waitForURL((adresse) => adresse.pathname === '/chat');
  await cliquerJusqualEffet(page.getByTestId('chat-menu-toggle'), page.getByTestId('chat-menu'));
  await page.locator('#chat-menu a[href="/"]').click();
  await page.waitForURL((adresse) => adresse.pathname === '/');
  await expect(page.getByTestId('site-logo')).toBeVisible();
  expect(await animationsDuLogo(page), '« Accueil » du menu du chat').toEqual([]);
}

test.describe('Logo de l’en-tête : une introduction par chargement (refonte A, E2)', () => {
  // Sous lg : l'en-tête du layout (main), commun à / et à /chat, n'est pas
  // recréé entre les deux pages ; sur /chat, il est seulement masqué, et une
  // animation CSS repart chaque fois que son élément sort de `display: none`.
  // La balance pesait donc de nouveau à chaque retour sur l'accueil
  // (BalanceAnimee.svelte, `introTerminee`).
  test.use(TELEPHONE);

  test('l’aller-retour entre l’accueil et l’assistant ne rejoue pas l’introduction', async ({ page }) => {
    await ouvrirAuServeur(page, '/');
    await attendreLHydratation(page);
    // L'introduction du chargement joue, puis s'arrête (2,25 s).
    await expect.poll(() => animationsDuLogo(page), { timeout: 5_000 }).toEqual([]);
    await allerRetourParLAssistant(page);
  });

  test('ni quand le JavaScript arrive après la fin de l’introduction (réseau lent)', async ({ page }) => {
    // L'introduction part avec le HTML du serveur, sans attendre le
    // JavaScript. Sur un réseau lent, elle est finie quand le composant est
    // monté : sa fin est passée avant tout écouteur, et c'est le montage qui
    // doit la constater. Les scripts de la page sont retenus jusqu'à la fin
    // de l'introduction, puis rendus : aucune durée à deviner.
    let rendreLesScripts!: () => void;
    const scriptsRendus = new Promise<void>((fin) => (rendreLesScripts = fin));
    await page.route('**/_app/immutable/**/*.js', async (route) => {
      await scriptsRendus;
      await route.continue();
    });
    // Sans attendre l'événement `load`, que les scripts retenus bloquent.
    const statut = (await page.goto('/', { waitUntil: 'commit' }))?.status() ?? 0;
    exiger(statut !== 503, '/ : API indisponible (503)');
    expect(statut, '/ : statut').toBeLessThan(400);
    await page.waitForSelector('[data-testid="site-logo"] svg', { state: 'attached' });
    // L'introduction joue sans JavaScript, puis s'arrête.
    await expect.poll(() => animationsDuLogo(page), { timeout: 5_000 }).not.toEqual([]);
    await expect.poll(() => animationsDuLogo(page), { timeout: 5_000 }).toEqual([]);
    rendreLesScripts();
    await attendreLHydratation(page);
    expect(await animationsDuLogo(page), 'au montage').toEqual([]);
    await allerRetourParLAssistant(page);
  });
});
