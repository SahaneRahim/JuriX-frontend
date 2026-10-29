/**
 * Aucun lien du site ne doit mener nulle part.
 *
 * POURQUOI CE FICHIER EXISTE. Deux cibles mortes étaient rendues en permanence
 * à l'écran — le bouton « S'inscrire » vers `/signup`, qui n'a jamais existé
 * côté backend, et l'entrée « Utilisateurs » de la barre latérale vers
 * `/admin/users`. Aucune relecture manuelle ne les avait attrapées en plusieurs
 * mois. Ce test les attrape en quelques secondes, et attrapera les suivantes.
 *
 * Ce spec est DÉTERMINISTE. Les sept specs qui l'ont précédé reposaient sur
 * `@zerostep/playwright` : chaque assertion passait par un modèle de langage
 * distant, ce qui exigeait une clé d'API absente du dépôt et rendait un verdict
 * variable d'une exécution à l'autre. Ils ne pouvaient pas servir de garde-fou
 * et ont été retirés.
 *
 * Lancer : npm run test:e2e:nav
 */

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { cliquerJusqualEffet } from '../hydratation';
import { NAV_LINKS } from '../../../src/lib/nav';

const API = process.env.VITE_API_URL ?? 'http://localhost:8000';

const EXIGER_BACKEND = process.env.E2E_EXIGER_BACKEND === '1';

/**
 * Condition d'un test qui demande le backend et ses données : sans elle, le
 * test est sauté — sauf avec E2E_EXIGER_BACKEND=1, où c'est un échec. Sans ce
 * réglage, les seules preuves du rendu serveur se sautaient en silence, et une
 * suite verte ne prouvait plus rien.
 */
function exiger(condition: boolean, raison: string): void {
  if (EXIGER_BACKEND) expect(condition, `${raison} (E2E_EXIGER_BACKEND=1)`).toBe(true);
  test.skip(!condition, raison);
}

/**
 * L'API répond-elle avec des données ? Sondée sur une route qui lit la base :
 * /health répond sans la toucher, et une base arrêtée passait pour saine. Un
 * hôte éteint fait REJETER la requête (connexion refusée) : ce n'est pas une
 * réponse en erreur, d'où le catch.
 */
async function apiJoignable(request: APIRequestContext): Promise<boolean> {
  const reponse = await request.get(`${API}/api/v1/categories`, { failOnStatusCode: false }).catch(() => null);
  return reponse?.ok() ?? false;
}

async function exigerBackend(request: APIRequestContext): Promise<void> {
  exiger(await apiJoignable(request), 'API ou base injoignable');
}

/**
 * Un statut d'erreur est-il un lien mort ?
 *
 * API ou base éteinte, l'accueil, /laws et les fiches répondent 503 au rendu
 * serveur, et c'est voulu (src/lib/panne.ts) : ce n'est pas un lien mort. Sans
 * E2E_EXIGER_BACKEND=1, ces 503 sont notés dans le rapport, pas comptés, pour
 * que ce fichier reste utilisable sans base. Une 404 est un lien mort dans tous
 * les cas.
 */
async function lienMort(request: APIRequestContext, statut: number, href: string, depuis: string): Promise<boolean> {
  if (statut < 400) return false;
  if (statut === 503 && !EXIGER_BACKEND && !(await apiJoignable(request))) {
    test.info().annotations.push({ type: 'API indisponible', description: `${depuis} : ${href} en 503` });
    return false;
  }
  return true;
}

/** Le <title> d'un HTML servi, déséchappé. */
function titreServi(html: string): string {
  const brut = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
  return brut
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Pages publiques sans paramètre, toujours testables. */
const STATIC_PAGES = [
  '/',
  '/chat',
  '/laws',
  '/about',
  '/search?q=loi',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

/**
 * Un href est-il interne au site ?
 *
 * Sont exclus : les protocoles non http (`mailto:`, `tel:` — trois occurrences
 * dans `about/+page.svelte`), les ancres pures, et tout absolu d'une autre
 * origine, dont le lien de téléchargement qui vise directement l'API
 * (`laws/[id]/+page.svelte`). Les tester reviendrait à tester WhatsApp et le
 * backend, pas la navigation du site.
 */
function isInternal(href: string, origin: string): boolean {
  if (!href || href.startsWith('#')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('http')) return false;
  if (href.startsWith('http')) return href.startsWith(origin);
  return href.startsWith('/');
}

async function internalLinksOf(page: Page): Promise<string[]> {
  const origin = new URL(page.url()).origin;
  const hrefs = await page.$$eval('a[href]', (as) =>
    as.map((a) => a.getAttribute('href') ?? ''),
  );
  const internes = hrefs
    .filter((h) => isInternal(h, origin))
    .map((h) => (h.startsWith('http') ? new URL(h).pathname + new URL(h).search : h));
  return [...new Set(internes)];
}

/**
 * Chaque lien répond-il ?
 *
 * `request.get` plutôt qu'une navigation complète : `playwright.config.ts` fixe
 * `workers: 1` et `timeout: 60000`, un parcours par rendu serait inexploitable.
 */
async function expectAllResolve(page: Page, hrefs: string[], depuis: string) {
  const morts: string[] = [];
  for (const href of hrefs) {
    const res = await page.request.get(href, { failOnStatusCode: false });
    if (await lienMort(page.request, res.status(), href, depuis)) morts.push(`${href} → ${res.status()}`);
  }
  expect(morts, `Liens morts sur ${depuis} :\n  ${morts.join('\n  ')}`).toEqual([]);
}

test.describe('Intégrité des liens', () => {
  for (const chemin of STATIC_PAGES) {
    test(`aucun lien mort sur ${chemin}`, async ({ page }) => {
      await page.goto(chemin);
      await expectAllResolve(page, await internalLinksOf(page), chemin);
    });
  }

  test('aucun lien mort dans la navigation mobile', async ({ page }) => {
    // Le panneau mobile est le SEUL accès à la navigation sous md : ses liens
    // sont invisibles au viewport de bureau et échappaient donc à tout contrôle.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    // Le clic doit attendre l'hydratation : le bouton est dans le HTML rendu
    // par le serveur bien avant que son gestionnaire ne soit attaché, et un
    // clic parti dans cette fenêtre ne déclenche rien. Voir tests/e2e/hydratation.ts.
    await cliquerJusqualEffet(
      page.getByTestId('nav-mobile-toggle'),
      page.getByTestId('nav-mobile-panel'),
    );
    await expectAllResolve(page, await internalLinksOf(page), '/ (mobile)');
  });

  test('le manifeste de navigation est complet et vivant', async ({ page }) => {
    await page.goto('/');
    for (const lien of NAV_LINKS) {
      const res = await page.request.get(lien.href, { failOnStatusCode: false });
      expect(await lienMort(page.request, res.status(), lien.href, 'NAV_LINKS'), `${lien.href} depuis NAV_LINKS`).toBe(
        false,
      );
      // Présent dans le DOM : un lien retiré du header par accident tombe ici.
      await expect(
        page.locator(`[data-testid=site-header] a[href="${lien.href}"]`).first(),
        `${lien.href} absent du header`,
      ).toBeAttached();
    }
  });
});

test.describe('Pages à paramètre', () => {
  // Les identifiants viennent de l'API, jamais codés en dur : un jeu figé
  // pourrit dès la première réingestion du corpus.
  test.beforeEach(async ({ request }) => {
    // `/health` est monté à la racine de l'application FastAPI, pas sous le
    // préfixe /api/v1 qui porte les routeurs métier (app/main.py).
    // Backend éteint : on saute CETTE partie seulement. Faire échouer tout le
    // fichier le rendrait inutilisable en CI sans base, et il finirait désactivé.
    await exigerBackend(request);
  });

  test('une fiche de loi réelle ne montre pas le bloc d’erreur', async ({ page, request }) => {
    const res = await request.get(`${API}/api/v1/laws/?limit=1`, { failOnStatusCode: false });
    exiger(res.ok(), 'aucune loi disponible');
    const corps = await res.json();
    const lois = corps.items ?? corps.laws ?? corps;
    exiger(Array.isArray(lois) && lois.length > 0, 'corpus vide');

    await page.goto(`/laws/${lois[0].id}`);
    await expect(page.getByTestId('law-error')).toHaveCount(0);
    await expectAllResolve(page, await internalLinksOf(page), `/laws/${lois[0].id}`);
  });

  /**
   * Le statut dit la vérité — l'assertion inverse de celle qui vivait ici.
   *
   * CE QUE CE TEST REMPLACE. `/laws/[id]` et `/categories/[id]` chargeaient dans
   * un bloc réactif, sans `load` serveur : le rendu répondait 200 pour
   * n'importe quel identifiant, et ce fichier devait s'en accommoder en
   * cherchant un bloc d'erreur AFFICHÉ plutôt qu'un statut. Le crawler attrapait
   * donc les routes mortes, jamais les enregistrements morts — une fiche
   * supprimée du corpus restait « vivante » pour ce garde-fou, pour un moteur de
   * recherche et pour tout moniteur.
   *
   * Depuis que les `load` de laws/[id]/+page.ts et categories/[id]/+page.server.ts
   * lèvent `error(404)`, le contrôle de statut redevient
   * possible : c'est une assertion plus forte que la précédente, et elle vaut
   * sans exécuter la moindre ligne de JavaScript.
   */
  // Hors de portée du corpus : aucune séquence n'atteint cette valeur. L'API
  // doit répondre pour que la 404 vienne d'elle (les adresses que le front
  // refuse seul sont plus bas, dans « Sans backend »).
  const IDENTIFIANTS_ABSENTS = [
    { chemin: '/laws/999999999', quoi: 'fiche de loi' },
    { chemin: '/categories/999999999', quoi: 'fiche de catégorie' },
  ];

  for (const { chemin, quoi } of IDENTIFIANTS_ABSENTS) {
    test(`${chemin} répond 404 (${quoi})`, async ({ request }) => {
      const res = await request.get(chemin, { failOnStatusCode: false });
      expect(res.status(), `${chemin} devrait répondre 404, pas ${res.status()}`).toBe(404);
    });
  }

  test('la page d’erreur du site reste navigable', async ({ page }) => {
    await page.goto('/laws/999999999');
    // Un 404 doit rester une page du site : en-tête, pied de page et sorties.
    // Sans `+error.svelte`, SvelteKit sert sa page brute, sans le moindre lien —
    // exactement le cul-de-sac que ce fichier existe pour empêcher.
    await expect(page.getByTestId('error-page')).toBeVisible();
    await expectAllResolve(page, await internalLinksOf(page), '/laws/999999999');
  });
});

/**
 * Le contenu indexable est-il RÉELLEMENT dans le HTML servi ?
 *
 * C'est la seule preuve directe du bénéfice de l'étape. Les assertions faites
 * dans un navigateur ne distinguent pas un titre rendu par le serveur d'un titre
 * écrit par le JavaScript après hydratation : les deux sont visibles à l'écran,
 * et un seul est indexable. `request.get` n'exécute aucun script — ce qu'il voit
 * est ce que voit un moteur qui ne rend pas les pages, et ce que voit l'aperçu
 * d'un lien partagé.
 */
test.describe('Contenu rendu par le serveur', () => {
  test.beforeEach(async ({ request }) => {
    await exigerBackend(request);
  });

  // Marqueurs des blocs d'erreur. Au rendu serveur, une panne de l'API donne un
  // 503 ; un de ces marqueurs dans un HTML en 200 voudrait dire que le lien
  // entre le serveur du front et l'API est cassé (ORIGIN, API_INTERNE) sans que
  // le statut le dise.
  const MARQUEURS_D_ERREUR = ['home-retry', 'laws-retry', 'law-error', 'category-retry', 'error-page'];

  async function htmlSansErreur(request: APIRequestContext, chemin: string): Promise<string> {
    const res = await request.get(chemin);
    expect(res.status(), `${chemin} : statut`).toBe(200);
    const html = await res.text();
    for (const marqueur of MARQUEURS_D_ERREUR) {
      expect(html, `${chemin} : bloc d'erreur ${marqueur} dans le HTML servi`).not.toContain(marqueur);
    }
    return html;
  }

  test("le HTML de l'accueil, de /laws et de /about porte leur contenu", async ({ request }) => {
    // Accueil : la grille des catégories, seul chemin vers /categories/<id>.
    expect(await htmlSansErreur(request, '/'), "pas de lien de catégorie sur l'accueil").toMatch(
      /href="\/categories\/\d+"/,
    );
    // Liste : des liens vers les fiches, ce par quoi un robot les découvre.
    expect(await htmlSansErreur(request, '/laws'), 'pas de lien de fiche dans /laws').toMatch(/href="\/laws\/\d+"/);
    expect(await htmlSansErreur(request, '/about'), 'pas de <h1> dans /about').toMatch(/<h1[^>]*>[\s\S]*?\S[\s\S]*?<\/h1>/);
  });

  test("le HTML d'une catégorie porte son nom et reste léger", async ({ request }) => {
    const res = await request.get(`${API}/api/v1/categories`, { failOnStatusCode: false });
    exiger(res.ok(), 'catégories indisponibles');
    const categories: { id: number; name: string }[] = await res.json();
    exiger(categories.length > 0, 'aucune catégorie');

    const categorie = categories[0];
    const html = await htmlSansErreur(request, `/categories/${categorie.id}`);
    // Sur le <title> RENDU, et non sur la page entière : les données du `load`
    // sont aussi incrustées dans un <script>, et y trouveraient le nom même si
    // l'en-tête de la page ne rendait rien. Le rendu serveur est en français :
    // le titre de l'onglet garde le nom complet, tel qu'en base
    // (`nomCompletCategorie`), mieux cherché par les moteurs ; seul le titre de
    // la page prend le nom court de l'accueil (Q2, `nomCategorie`).
    expect(titreServi(html), 'titre de la catégorie absent du HTML servi').toBe(`${categorie.name} — JuriX`);
    // Les textes entiers incrustés dans la page la portaient à 1,6 Mo : le load
    // serveur n'en envoie plus aucun (P11 : repères et objet, par lots de 20).
    expect(html.length, 'HTML de la catégorie trop lourd').toBeLessThan(200_000);
  });

  test('le HTML de /laws/[id] porte le titre du document sans JavaScript', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/laws/?limit=1`, { failOnStatusCode: false });
    exiger(res.ok(), 'aucune loi disponible');
    const lois = await res.json();
    exiger(Array.isArray(lois) && lois.length > 0, 'corpus vide');

    const loi = lois[0];
    const html = await (await request.get(`/laws/${loi.id}`)).text();

    /**
     * Comparaison sur le <title> DÉSÉCHAPPÉ, et non sur un fragment cherché
     * dans la page.
     *
     * Première version de cette assertion : prendre les trois premiers mots
     * longs du titre et les chercher dans le HTML. Elle échouait sur un
     * document parfaitement rendu, parce que ces trois mots ne sont pas
     * ADJACENTS dans le titre — les joindre par une espace fabriquait une
     * chaîne qui n'existe nulle part. L'assertion mentait sur le code.
     *
     * Le titre entier, déséchappé, est à la fois plus simple et plus fort : il
     * vérifie aussi la politique de titre du site (`$lib/seo.titreDePage`).
     */
    expect(titreServi(html), 'le <title> servi ne porte pas le titre du document').toBe(
      `${loi.title} — JuriX`,
    );

    // Métadonnées : c'est ce qui alimente l'aperçu d'un lien partagé.
    expect(html, 'meta description absente').toMatch(/<meta[^>]+name="description"/);
    expect(html, 'canonique absente').toMatch(/<link[^>]+rel="canonical"/);
    expect(html, 'og:type absent').toMatch(/<meta[^>]+property="og:type"[^>]+content="article"/);

    // La description doit porter du CONTENU, pas une chaîne vide : c'est le
    // texte du document, nettoyé de ses marqueurs de page et de son markdown.
    const description = html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/)?.[1] ?? '';
    expect(description.length, 'meta description vide').toBeGreaterThan(20);
    expect(description, 'marqueurs de page non nettoyés').not.toContain('PAGE:');
  });

  test('les pages sans valeur d’index portent noindex, et les autres non', async ({ request }) => {
    for (const chemin of ['/search?q=loi', '/chat', '/login', '/signup', '/admin']) {
      const html = await (await request.get(chemin)).text();
      expect(html, `${chemin} devrait être en noindex`).toMatch(
        /<meta[^>]+name="robots"[^>]+content="noindex, follow"/,
      );
    }
    for (const chemin of ['/', '/laws', '/about']) {
      const html = await (await request.get(chemin)).text();
      expect(html, `${chemin} ne doit PAS être en noindex`).not.toMatch(/name="robots"/);
    }
  });

  test('une liste filtrée sort de l’index mais garde sa canonique', async ({ request }) => {
    // Chaque combinaison de filtres est une page de contenu quasi dupliqué :
    // l'indexer disperserait l'autorité de /laws sur des dizaines d'adresses.
    const html = await (await request.get('/laws?lang=fr')).text();
    expect(html).toMatch(/<meta[^>]+name="robots"[^>]+content="noindex, follow"/);
    // La canonique désigne la liste nue, sans la chaîne de requête.
    expect(html).toMatch(/<link[^>]+rel="canonical"[^>]+href="[^"]*\/laws"/);
  });
});

/**
 * Ce que le serveur du front décide seul, sans appeler l'API : jamais sauté,
 * même backend éteint.
 */
test.describe('Sans backend', () => {
  // Refusées avant tout appel ($lib/identifiant) : l'API répondait 500 à un
  // identifiant non numérique, là où la bonne réponse est 404. Les autres
  // formes refusées (négatif, zéro initial, hors bornes) prennent la même
  // branche : src/lib/identifiant.test.ts les vérifie une à une.
  for (const { chemin, quoi } of [
    { chemin: '/laws/abc', quoi: 'identifiant non numérique' },
    { chemin: '/categories/abc', quoi: 'identifiant non numérique' },
  ]) {
    test(`${chemin} répond 404 (${quoi})`, async ({ request }) => {
      const res = await request.get(chemin, { failOnStatusCode: false });
      expect(res.status(), `${chemin} devrait répondre 404, pas ${res.status()}`).toBe(404);
    });
  }

  test('robots.txt est du texte et ferme /admin', async ({ request }) => {
    // Avant, la page de repli de l'application répondait à sa place, en HTML.
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/plain');
    expect(await res.text()).toContain('Disallow: /admin');
  });

  test('les pages rendues dans le navigateur portent noindex dans leur en-tête', async ({ request }) => {
    // Le serveur n'en sert qu'une coquille : l'en-tête X-Robots-Tag vaut pour
    // les robots qui ne lisent pas le HTML.
    for (const chemin of ['/admin', '/chat']) {
      const res = await request.get(chemin);
      expect(res.headers()['x-robots-tag'], `${chemin} : X-Robots-Tag`).toBe('noindex, follow');
    }
  });
});
