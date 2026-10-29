/**
 * La page d'un texte après la refonte UX : statut prouvé et daté (P1),
 * adresse et références propres pour chaque article (P2), lecture du texte
 * entier (P10), titres et texte officiel en Literata (Q5).
 *
 * POURQUOI CE FICHIER EXISTE. Chacune de ces propositions corrige une erreur
 * que rien n'attrapait : une pastille « EN VIGUEUR » affichée sur tous les
 * textes, abrogés compris ; « Mis à jour le » qui datait une écriture en base,
 * lue comme une modification de la loi ; un « Partager » qui envoyait
 * l'article de DÉPART après trois « Suivant » ; une citation copiée avec la
 * cote interne (« PRC-9153 »).
 *
 * DONNÉES. La page d'un texte se charge sur le SERVEUR (ISR) : `page.route`
 * n'en voit pas l'appel. Les textes viennent donc de la vraie API, jamais
 * d'un identifiant codé en dur, et le fichier est sauté quand elle est
 * éteinte (sauf avec E2E_EXIGER_BACKEND=1). L'onglet « Historique » ne se
 * vérifie que sur la nouvelle API (`statut` des lignes de `GET /laws/`).
 *
 * Lancer : npx playwright test tests/e2e/navigation/ux-lecteur.spec.ts
 */

import { expect, test, type Page } from '@playwright/test';

import { API, attendreLeRepos, exiger, lireListe, ouvrirAuServeur } from '../doublures';
import { cliquerJusqualEffet } from '../hydratation';
import { loiAvecArticles } from '../pages-du-site';

/** Le numéro `?article=` de l'adresse affichée, ou null. */
function articleDeLAdresse(page: Page): string | null {
  return new URL(page.url()).searchParams.get('article');
}

/**
 * « Suivant », répété tant que Svelte n'a pas la main (tests/e2e/hydratation.ts) :
 * l'effet attendu est l'adresse, que la page met à jour au premier clic utile.
 */
async function suivantJusqualAdresse(page: Page): Promise<void> {
  const suivant = page.locator('.article-navigation button').last();
  await expect(async () => {
    await suivant.click();
    await expect(page).toHaveURL(/[?&]article=/, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/**
 * Attend la fin d'un défilement doux : quinze images de suite sans bouger.
 *
 * POURQUOI. Un saut du sommaire en texte entier fait défiler la page en
 * douceur, et l'article « lu » suit le défilement (TexteEntier.svelte,
 * `mesurer`) : tant que le défilement passe sur l'article d'avant, c'est lui
 * qui est lu. `toBeInViewport()` est vrai dès la première image quand cet
 * article d'avant est court, et une bascule partie aussitôt revenait à
 * l'article 1 (vérification r1 du 29/10). Un lecteur bascule après avoir lu :
 * le défilement est fini.
 */
async function attendreLaFinDuDefilement(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((fini) => {
        let position = window.scrollY;
        let immobile = 0;
        const image = () => {
          if (window.scrollY === position) immobile += 1;
          else [position, immobile] = [window.scrollY, 0];
          if (immobile >= 15) fini();
          else requestAnimationFrame(image);
        };
        requestAnimationFrame(image);
      }),
  );
}

test.describe('Page d’un texte', () => {
  let id: number;

  test.beforeEach(async ({ request }) => {
    const trouve = await loiAvecArticles(request);
    exiger(trouve, 'aucune loi avec des articles : API injoignable ou corpus vide');
    id = trouve as number;
  });

  test('P1 : un statut neutre et daté, jamais « En vigueur » ni « Mis à jour le »', async ({ page }) => {
    await ouvrirAuServeur(page, `/laws/${id}`);
    const statut = page.getByTestId('law-status');
    await expect(statut).toBeVisible();
    // Ancienne API : « Version d'origine, non consolidée » sans date ; nouvelle
    // API : l'état du relevé. Jamais un état que le relevé ne prouve pas.
    expect(['inconnu', 'origine', 'modifie', 'consolide', 'abroge', 'remplace']).toContain(
      await statut.getAttribute('data-etat'),
    );
    await expect(statut.getByRole('link', { name: 'Signaler' })).toHaveAttribute('href', /^mailto:/);
    const contenu = page.locator('#contenu');
    await expect(contenu).not.toContainText(/en vigueur/i);
    await expect(contenu).not.toContainText('Mis à jour le');
    await expect(page.getByTestId('law-added')).toContainText('Ajouté à JuriX le');
    // P2 : la cote interne n'est plus affichée, ni en tête ni ailleurs.
    await expect(contenu).not.toContainText(/\bPRC-\d+/);
  });

  test('P2 : l’adresse suit l’article lu ; « Suivant » remplace, le sommaire ajoute', async ({ page }) => {
    await ouvrirAuServeur(page, `/laws/${id}`);
    await suivantJusqualAdresse(page);
    const deuxieme = articleDeLAdresse(page);
    exiger(deuxieme, 'pas de deuxième article');
    await expect(page.locator('article.article h2')).toContainText(`Article ${deuxieme}`);

    // Un saut du sommaire (colonne visible à 1 280 px) ajoute une entrée :
    // le retour arrière ramène à l'article d'avant, sans quitter le texte.
    const liens = page.getByTestId('law-toc').getByRole('link');
    test.skip((await liens.count()) < 3, 'texte de moins de trois articles');
    await liens.nth(2).click();
    await expect(page).not.toHaveURL(new RegExp(`[?&]article=${deuxieme}(?:&|#|$)`));
    const troisieme = articleDeLAdresse(page);
    await expect(page.locator('article.article h2')).toContainText(`Article ${troisieme}`);
    await expect(liens.nth(2)).toHaveAttribute('aria-current', 'location');

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/laws/${id}\\?article=${deuxieme}(?:&|#|$)`));
    await expect(page.locator('article.article h2')).toContainText(`Article ${deuxieme}`);
  });

  // Le lien d'évitement de l'en-tête (`#contenu`), suivi par le navigateur
  // sans la page, ajoutait une entrée sans état de lecture : « Retour »
  // s'arrêtait une entrée trop tôt, sur le texte, et le retour arrière puis
  // avant vers elle rouvrait la lecture article par article (revue du 29/10).
  test('P2 : le lien d’évitement ne fait perdre ni le texte entier ni « Retour »', async ({ page }) => {
    await ouvrirAuServeur(page, `/laws/${id}`);
    // Un effet du client : la page a repris la main, et les navigations qui
    // suivent restent dans l'application (tests/e2e/hydratation.ts).
    await cliquerJusqualEffet(page.getByTestId('law-mode-texte'), page.getByTestId('law-full-text'));

    await page.locator('a[href="#contenu"]').first().focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#contenu$/);
    await page.goBack();
    await page.goForward();
    await expect(page).toHaveURL(/#contenu$/);
    await expect(page.getByTestId('law-mode-texte')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('law-full-text')).toBeVisible();

    // Venu de la liste : « Retour » y ramène, l'entrée `#contenu` comprise.
    const filDAriane = page.locator('.breadcrumb');
    await filDAriane.getByRole('link', { name: 'Documents', exact: true }).click();
    await expect(page).toHaveURL(/\/laws(\?[^#]*)?$/);
    await page.locator('#contenu a[href^="/laws/"]').first().click();
    await expect(filDAriane.getByRole('link', { name: 'Retour', exact: true })).toBeVisible();
    await page.locator('a[href="#contenu"]').first().focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/laws\/\d+[^#]*#contenu$/);
    await filDAriane.getByRole('link', { name: 'Retour', exact: true }).click();
    await expect(page).toHaveURL(/\/laws(\?[^#]*)?$/);
  });

  // Une ancre tapée dans la barre d'adresse (`page.goto` vers la même page :
  // aucun clic de lien) ajoute une entrée que SvelteKit ne numérote pas. La
  // page l'adoptait quand même, avec l'index de l'entrée d'avant : au retour
  // arrière, SvelteKit, qui se croyait déjà sur cette entrée, gardait l'état
  // adopté, une profondeur de trop, et « Retour » remontait au-delà de la
  // liste (revue du 29/10).
  test('P2 : une ancre tapée dans la barre d’adresse ne fait pas remonter « Retour » trop loin', async ({ page }) => {
    await ouvrirAuServeur(page, `/laws/${id}`);
    // Un effet du client : la page a repris la main, et les navigations qui
    // suivent restent dans l'application (tests/e2e/hydratation.ts).
    await cliquerJusqualEffet(page.getByTestId('law-mode-texte'), page.getByTestId('law-full-text'));
    const filDAriane = page.locator('.breadcrumb');
    await filDAriane.getByRole('link', { name: 'Documents', exact: true }).click();
    await expect(page).toHaveURL(/\/laws(\?[^#]*)?$/);
    await page.locator('#contenu a[href^="/laws/"]').first().click();
    await expect(page).toHaveURL(/\/laws\/\d+/);
    await expect(filDAriane.getByRole('link', { name: 'Retour', exact: true })).toBeVisible();
    const texte = page.url();

    await page.goto(`${texte.split('#')[0]}#contenu`);
    await expect(page).toHaveURL(/#contenu$/);
    await page.goBack();
    await expect(page).toHaveURL(texte);
    await filDAriane.getByRole('link', { name: 'Retour', exact: true }).click();
    await expect(page).toHaveURL(/\/laws(\?[^#]*)?$/);
  });

  test('P2 : un lien profond `?article=` ou `#art-N` ouvre l’article', async ({ page, request }) => {
    const reponse = await request.get(`${API}/api/v1/laws/${id}`, { failOnStatusCode: false });
    exiger(reponse.ok(), 'texte illisible');
    await ouvrirAuServeur(page, `/laws/${id}`);
    const liens = page.getByTestId('law-toc').getByRole('link');
    test.skip((await liens.count()) < 2, 'texte d’un seul article');
    const ancre = (await liens.nth(1).getAttribute('href')) ?? '';
    const numero = /^#art-(\d+)/.exec(ancre)?.[1];
    exiger(numero, `ancre de sommaire inattendue : ${ancre}`);

    // Un vrai chargement, comme un lien ouvert ailleurs : depuis la page
    // même, `goto` vers une ancre ne ferait que changer l'ancre.
    await page.goto('about:blank');
    await page.goto(`/laws/${id}${ancre}`);
    await expect(page.locator('article.article h2')).toContainText(`Article ${numero}`, { timeout: 15_000 });

    await page.goto(`/laws/${id}?article=${numero}`);
    await expect(page.locator('article.article h2')).toContainText(`Article ${numero}`, { timeout: 15_000 });
  });

  test('P2 : « Copier la référence » donne la référence et le lien de l’article, sans cote', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await ouvrirAuServeur(page, `/laws/${id}`);
    await suivantJusqualAdresse(page);
    const numero = articleDeLAdresse(page);

    await page.getByTestId('law-copy-reference').click();
    await expect(page.getByRole('status').filter({ hasText: 'Référence copiée' })).toHaveCount(1);
    const copie = await page.evaluate(() => navigator.clipboard.readText());
    expect(copie).toMatch(/^Art\. /);
    expect(copie).toContain(`/laws/${id}?article=${numero}`);
    expect(copie).not.toMatch(/\bPRC-\d+/);

    await page.getByTestId('law-copy-text').click();
    const texte = await page.evaluate(() => navigator.clipboard.readText());
    expect(texte).toContain('Seul le texte publié au Journal officiel fait foi.');
    expect(texte).not.toMatch(/\bPRC-\d+/);

    // Le troisième bouton, le lien de l'article. Sur ordinateur (pointeur
    // fin), « Copier le lien » copie l'adresse de l'article LU ; la feuille de
    // partage du système ne sert qu'au doigt (ActionsDeLArticle.svelte).
    // Jusqu'aux corrections qui ont suivi la vérification r1 du 29/10, c'était
    // un lien wa.me (`law-share-article`), qui ouvrait WhatsApp Web sur un
    // ordinateur, comme le « Partager » du texte en tête.
    await page.getByTestId('law-copy-link').click();
    const lien = await page.evaluate(() => navigator.clipboard.readText());
    expect(lien).toMatch(new RegExp(`^https?://[^/]+/laws/${id}\\?article=${numero}(#.*)?$`));
  });

  test('P10 : texte entier, ancres et retour à l’article lu', async ({ page }) => {
    await ouvrirAuServeur(page, `/laws/${id}`);
    const texteEntier = page.getByTestId('law-mode-texte');
    await cliquerJusqualEffet(texteEntier, page.getByTestId('law-full-text'));
    await expect(texteEntier).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('law-mode-article')).toHaveAttribute('aria-pressed', 'false');
    // L'adresse est celle du texte : plus de `?article=`.
    expect(articleDeLAdresse(page)).toBeNull();

    const articles = page.getByTestId('law-full-text').locator('article[id^="art-"]');
    expect(await articles.count()).toBeGreaterThan(1);
    // Chaque article a son titre et son lien direct vers sa propre ancre.
    const premier = articles.first();
    const ancre = await premier.getAttribute('id');
    await expect(premier.locator(`a[href="#${ancre}"]`)).toHaveCount(1);

    // Un saut du sommaire en texte entier : l'ancre dans l'adresse.
    const liens = page.getByTestId('law-toc').getByRole('link');
    test.skip((await liens.count()) < 2, 'texte d’un seul article');
    await liens.nth(1).click();
    const cible = (await liens.nth(1).getAttribute('href')) ?? '';
    await expect(page).toHaveURL(new RegExp(`${cible}$`));
    await expect(page.locator(cible)).toBeInViewport();
    await attendreLaFinDuDefilement(page);

    // Retour à la lecture article par article, sur l'article lu.
    await page.getByTestId('law-mode-article').click();
    await expect(page.locator('article.article h2')).toContainText(`Article ${cible.replace(/^#art-(\d+).*$/, '$1')}`);
    await expect(page).toHaveURL(/[?&]article=/);
  });

  test('Q5 : titres et texte officiel en Literata, l’explication de l’IA en Inter', async ({ page }) => {
    await ouvrirAuServeur(page, `/laws/${id}`);
    const police = (selecteur: string) =>
      page.locator(selecteur).first().evaluate((element) => getComputedStyle(element).fontFamily);
    expect(await police('h1')).toContain('Literata Titre');
    expect(await police('article.article h2')).toContain('Literata Titre');
    expect(await police('article.article .article-content')).toContain('Literata Texte');
    expect(await police('.ai-explanation')).not.toContain('Literata');
  });
});

test.describe('Page d’un texte sur téléphone (320 px)', () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });

  test('les trois actions tiennent sur une rangée, rien ne dépasse', async ({ page, request }) => {
    const id = await loiAvecArticles(request);
    exiger(id, 'aucune loi avec des articles : API injoignable ou corpus vide');
    await ouvrirAuServeur(page, `/laws/${id}`);
    await attendreLeRepos(page);

    for (const rangee of [page.locator('.document-actions'), page.getByTestId('law-article-actions')]) {
      const boites = await rangee.locator(':scope > *').evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect()).map(({ top, right }) => ({ top, right })),
      );
      expect(boites.length).toBeGreaterThanOrEqual(2);
      // Une seule rangée : même haut pour chaque action.
      expect(Math.max(...boites.map((b) => b.top)) - Math.min(...boites.map((b) => b.top))).toBeLessThanOrEqual(1);
      expect(Math.max(...boites.map((b) => b.right))).toBeLessThanOrEqual(320);
    }
    const largeurs = await page.evaluate(() => ({ contenu: document.documentElement.scrollWidth, ecran: innerWidth }));
    expect(largeurs.contenu).toBeLessThanOrEqual(largeurs.ecran + 1);
  });
});

test.describe('Historique d’un texte modifié (nouvelle API)', () => {
  test('« Historique (N) » montre la chaîne, et l’article touché le dit', async ({ page, request }) => {
    // Les lignes de la nouvelle API portent un statut en bref ; l'ancienne
    // n'en a pas, et la page n'a alors pas d'onglet.
    // `content_max_chars=0` : l'ancienne API rendrait sinon le texte entier de chaque ligne.
    // `sort=date_asc` : les textes modifiés du relevé sont anciens. Dans
    // l'ordre par défaut (du plus récent au plus ancien), les 100 premiers
    // n'en comptaient aucun, et ce test était toujours sauté (vérification r1
    // du 29/10) ; les 100 plus anciens en comptent 16. L'ancienne API ignore
    // `sort`, sans erreur.
    const lignes = await lireListe<{ id: number; statut?: unknown }>(
      request,
      '/laws/?page=1&page_size=100&limit=100&content_max_chars=0&sort=date_asc',
    );
    const modifie = lignes.find((ligne) => ligne.statut);
    test.skip(!modifie, 'pas de texte modifié dans le premier lot, ou ancienne API');
    await ouvrirAuServeur(page, `/laws/${modifie?.id}`);

    const onglet = page.getByTestId('law-tab-historique');
    await expect(onglet).toHaveText(/\(\d+\)/);
    await expect(page.getByTestId('law-tab-texte')).toHaveAttribute('aria-selected', 'true');
    await cliquerJusqualEffet(onglet, page.getByTestId('law-history'));
    await expect(onglet).toHaveAttribute('aria-selected', 'true');
    expect(await page.getByTestId('law-history').locator('h3').count()).toBeGreaterThan(0);
    // Jamais de rouge pour un statut : ce n'est pas une erreur de l'interface.
    const couleurs = await page
      .getByTestId('law-history')
      .evaluate((element) => [...element.querySelectorAll('*')].map((e) => getComputedStyle(e).color));
    expect(couleurs.filter((c) => /rgb\((2[0-9]{2}), ([0-9]{1,2}), ([0-9]{1,2})\)/.test(c))).toEqual([]);

    // Retour au texte au clavier (motif d'onglets ARIA).
    await onglet.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('law-tab-texte')).toHaveAttribute('aria-selected', 'true');
  });
});
