/**
 * Recherche et listes de textes de la refonte UX (P7, P8, P11).
 *
 * CE QUI EST VÉRIFIÉ.
 * - P8 : la recherche part d'un VRAI formulaire GET, même sans JavaScript, sur
 *   /search comme sur la page d'un domaine (avec le domaine en champ caché).
 * - P11 : les listes de textes avancent par lots de 20, « Afficher 20 de
 *   plus » étant un lien vers `?page=N` : sans JavaScript, il ouvre le lot
 *   suivant ; avec, il l'ajoute aux précédents et donne le focus à la première
 *   ligne ajoutée. Aucune cote interne (« PRC-… ») n'est affichée.
 * - P7 (sur demande seulement, voir plus bas) : la page de résultats arrive
 *   rendue par le serveur.
 *
 * AUCUN APPEL AU MODÈLE D'EMBEDDINGS PAR DÉFAUT. /search est rendue par le
 * serveur : `page.route` ne voit plus son appel à l'API, et chaque requête
 * réelle ferait vectoriser la question (recherche hybride). Les tests du
 * formulaire interceptent donc la NAVIGATION vers /search elle-même : seule
 * l'adresse envoyée compte. Les tests qui affichent des résultats les
 * reçoivent de la doublure de l'API côté serveur (playwright.config.ts) ;
 * E2E_RECHERCHE_REELLE=1 les fait porter sur la vraie recherche.
 *
 * Les listes (/laws, /categories/<id>) lisent la vraie API (aucun modèle) :
 * sautées quand elle ne répond pas, échouées avec E2E_EXIGER_BACKEND=1.
 */

import { expect, test, type Page } from '@playwright/test';

import type { Category } from '../../../src/lib/types';
import { attendreLeRepos, enregistrerLaRecherche, exiger, lireListe, ouvrirAuServeur } from '../doublures';

/** Le titre de la page qui remplace /search dans les tests du formulaire. */
const INTERCEPTEE = 'Recherche interceptée';

/**
 * Remplace toute page /search portant une requête par une page vide, et note
 * l'adresse demandée : le formulaire est jugé sur ce qu'il envoie, sans que
 * le serveur ne lance la recherche.
 */
async function intercepterLaRecherche(page: Page): Promise<URL[]> {
  const adresses: URL[] = [];
  await page.route(
    (url) => url.pathname === '/search' && url.searchParams.has('q'),
    (route) => {
      adresses.push(new URL(route.request().url()));
      return route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html lang="fr"><title>${INTERCEPTEE}</title><h1>${INTERCEPTEE}</h1></html>`,
      });
    },
  );
  return adresses;
}

/** Les lignes d'une liste de textes ou de résultats (une liste à filets, `role="list"`). */
const lignes = (page: Page) => page.locator('#contenu ul[role="list"] > li');

test.describe('Sans JavaScript : le formulaire de recherche part (P8)', () => {
  test.use({ javaScriptEnabled: false });

  test('/search : Entrée envoie q en GET', async ({ page }) => {
    const adresses = await intercepterLaRecherche(page);
    await page.goto('/search');
    // La page d'accueil de la recherche ne demande rien à l'API.
    await expect(page.getByRole('heading', { name: 'Commencez votre recherche' })).toBeVisible();

    const champ = page.locator('#contenu').getByRole('combobox', { name: 'Rechercher', exact: true });
    await champ.fill('bail commercial');
    await champ.press('Enter');

    await expect(page.getByRole('heading', { name: INTERCEPTEE })).toBeVisible();
    expect(adresses.at(-1)?.searchParams.get('q')).toBe('bail commercial');
  });

  test('/search : le bouton « Rechercher » envoie aussi, et n’est jamais inactif', async ({ page }) => {
    const adresses = await intercepterLaRecherche(page);
    await page.goto('/search');
    const formulaire = page.locator('#contenu form[role="search"]');
    await expect(formulaire).toHaveAttribute('method', 'get');
    await expect(formulaire).toHaveAttribute('action', '/search');

    const envoi = formulaire.getByRole('button', { name: 'Rechercher', exact: true });
    // Inactif au rendu, il bloquerait aussi l'envoi par Entrée.
    await expect(envoi).toBeEnabled();
    await formulaire.getByRole('combobox').fill('congé de maternité');
    await envoi.click();

    await expect(page.getByRole('heading', { name: INTERCEPTEE })).toBeVisible();
    expect(adresses.at(-1)?.searchParams.get('q')).toBe('congé de maternité');
  });

  test('/categories/<id> : la recherche part avec le domaine en champ caché', async ({ page, request }) => {
    const categories = await lireListe<Category>(request, '/categories');
    exiger(categories.length > 0, 'catégories indisponibles : API injoignable');
    const [categorie] = categories;
    const adresses = await intercepterLaRecherche(page);
    await ouvrirAuServeur(page, `/categories/${categorie.id}`);

    const formulaire = page.locator('#contenu form[role="search"]');
    await expect(formulaire).toHaveAttribute('action', '/search');
    await formulaire.locator('input[name="q"]').fill('nomination');
    // La loupe EST le bouton d'envoi.
    await formulaire.getByRole('button', { name: 'Rechercher', exact: true }).click();

    await expect(page.getByRole('heading', { name: INTERCEPTEE })).toBeVisible();
    const adresse = adresses.at(-1);
    expect(adresse?.searchParams.get('q')).toBe('nomination');
    // `perimetre` : /search cherche DANS le domaine (`filters`, en SQL).
    // `categorie` est une case de la colonne, qui n'affine que ce que la
    // recherche a trouvé dans tout le corpus.
    expect(adresse?.searchParams.getAll('perimetre')).toEqual([String(categorie.id)]);
    expect(adresse?.searchParams.getAll('categorie')).toEqual([]);
  });

  test('/laws : les filtres partent par le bouton du <noscript>', async ({ page, request }) => {
    exiger((await lireListe(request, '/categories')).length > 0, 'API injoignable');
    await ouvrirAuServeur(page, '/laws');
    await page.getByRole('combobox', { name: 'Filtrer par langue' }).selectOption('fr');
    await page.getByRole('button', { name: 'Filtrer', exact: true }).click();
    await expect(page).toHaveURL(/[?&]lang=fr(&|$)/);
  });
});

test.describe('Listes par lots de 20 (P11)', () => {
  /** Au moins 21 textes publiés : sans eux, pas de second lot. */
  async function exigerDeuxLots(request: Parameters<typeof lireListe>[0]) {
    const lois = await lireListe(request, '/laws/?limit=21&content_max_chars=0');
    exiger(lois.length > 20, 'moins de 21 textes publiés, ou API injoignable : pas de second lot');
  }

  test.describe('sans JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('/laws : « Afficher 20 de plus » ouvre ?page=2, qui renvoie au lot précédent', async ({ page, request }) => {
      await exigerDeuxLots(request);
      await ouvrirAuServeur(page, '/laws');
      await expect(lignes(page)).toHaveCount(20);

      const plus = page.getByRole('link', { name: /^Afficher \d+ de plus$/ });
      await expect(plus).toHaveAttribute('href', '/laws?page=2');
      await plus.click();

      await expect(page).toHaveURL(/\/laws\?page=2$/);
      await expect(page.getByRole('link', { name: /textes précédents$/ })).toHaveAttribute('href', '/laws');
      expect(await lignes(page).count()).toBeGreaterThan(0);
    });
  });

  test('/laws : avec JavaScript, le lot suivant s’ajoute et reçoit le focus', async ({ page, request }) => {
    await exigerDeuxLots(request);
    await ouvrirAuServeur(page, '/laws');
    await expect(lignes(page)).toHaveCount(20);
    // Un seul clic, après l'hydratation : avant elle, le lien ouvrirait le lot
    // 2 SEUL, par une navigation complète (le comportement sans JavaScript,
    // vérifié plus haut), et un second clic mènerait au lot 3.
    await attendreLeRepos(page);

    await page.getByRole('link', { name: /^Afficher \d+ de plus$/ }).click();

    await expect(lignes(page).nth(20)).toBeVisible();
    await expect(page).toHaveURL(/\/laws\?page=2$/);
    // Les 20 premières lignes sont restées : pas de lien vers le lot précédent.
    await expect(page.getByRole('link', { name: /textes précédents$/ })).toHaveCount(0);
    // Au clavier, la lecture reprend à la première ligne ajoutée.
    await expect(lignes(page).nth(20).locator('a')).toBeFocused();
  });

  test('/laws et /categories/<id> : une ligne par texte, sans cote interne', async ({ page, request }) => {
    const categories = await lireListe<Category>(request, '/categories');
    exiger(categories.length > 0, 'catégories indisponibles : API injoignable');
    const [categorie] = [...categories].sort((a, b) => (b.law_count ?? 0) - (a.law_count ?? 0));
    for (const chemin of ['/laws', `/categories/${categorie.id}`]) {
      await ouvrirAuServeur(page, chemin);
      expect(await lignes(page).count(), `${chemin} : aucune ligne`).toBeGreaterThan(0);
      // Toute la ligne est le lien du texte.
      await expect(lignes(page).first().locator('a')).toHaveAttribute('href', /^\/laws\/\d+$/);
      await expect(page.locator('#contenu'), `${chemin} : cote interne affichée`).not.toContainText(/\bPRC-\d+/);
    }
  });
});

test.describe('Résultats rendus par le serveur (P7, P8)', () => {
  // Une vraie recherche fait vectoriser la question par le backend : par
  // défaut, la question est servie par la doublure de l'API côté serveur
  // (REPONSE_RECHERCHE : 20 résultats sur 137, forme de la nouvelle API, cotes
  // PRC dans `reference`), sans appel au modèle. E2E_RECHERCHE_REELLE=1 lance
  // les mêmes vérifications sur la vraie recherche.
  test.beforeEach(async ({ request }) => {
    if (process.env.E2E_RECHERCHE_REELLE !== '1') await enregistrerLaRecherche(request, ['licenciement']);
  });
  test.use({ javaScriptEnabled: false });

  test('/search?q=… arrive complète, sans JavaScript', async ({ page }) => {
    await page.goto('/search?q=licenciement');
    await expect(page.getByTestId('search-status')).toHaveText(/\d/);
    expect(await lignes(page).count()).toBeGreaterThan(0);
    // Le lien du titre mène au texte ; les puces, à l'article.
    await expect(lignes(page).first().locator('h2 a')).toHaveAttribute('href', /^\/laws\/\d+$/);
    await expect(page.locator('#contenu')).not.toContainText(/\bPRC-\d+/);
    await expect(page.getByRole('link', { name: 'Poser cette question à l’assistant' })).toHaveAttribute(
      'href',
      '/chat?q=licenciement',
    );
  });

  test('sans JavaScript, la colonne de filtres s’ouvre par son ancre (nouvelle API)', async ({ page }) => {
    await page.goto('/search?q=licenciement');
    const bascule = page.getByTestId('search-filters-toggle');
    // L'ancienne API ne calcule pas d'effectifs : ni onglets ni colonne.
    test.skip((await bascule.count()) === 0, 'ancienne API : pas de filtres affinés');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#filtres-recherche')).toBeHidden();
    await bascule.click();
    await expect(page.locator('#filtres-recherche')).toBeVisible();
    await expect(page.getByTestId('search-filters-done')).toHaveAttribute('type', 'submit');
  });
});
