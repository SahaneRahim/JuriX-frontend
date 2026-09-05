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

import { expect, test, type Page } from '@playwright/test';
import { NAV_LINKS } from '../../../src/lib/nav';

const API = process.env.VITE_API_URL ?? 'http://localhost:8000';

/** Pages publiques sans paramètre, toujours testables. */
const STATIC_PAGES = ['/', '/chat', '/laws', '/about', '/search?q=loi', '/login'];

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
    if (res.status() >= 400) morts.push(`${href} → ${res.status()}`);
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
    await page.getByTestId('nav-mobile-toggle').click();
    await expect(page.getByTestId('nav-mobile-panel')).toBeVisible();
    await expectAllResolve(page, await internalLinksOf(page), '/ (mobile)');
  });

  test('le manifeste de navigation est complet et vivant', async ({ page }) => {
    await page.goto('/');
    for (const lien of NAV_LINKS) {
      const res = await page.request.get(lien.href, { failOnStatusCode: false });
      expect(res.status(), `${lien.href} depuis NAV_LINKS`).toBeLessThan(400);
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
    const sante = await request.get(`${API}/health`, { failOnStatusCode: false });
    // Backend éteint : on saute CETTE partie seulement. Faire échouer tout le
    // fichier le rendrait inutilisable en CI sans base, et il finirait désactivé.
    test.skip(!sante.ok(), 'backend injoignable');
  });

  test('une fiche de loi réelle ne montre pas le bloc d’erreur', async ({ page, request }) => {
    const res = await request.get(`${API}/api/v1/laws/?limit=1`, { failOnStatusCode: false });
    test.skip(!res.ok(), 'aucune loi disponible');
    const corps = await res.json();
    const lois = corps.items ?? corps.laws ?? corps;
    test.skip(!Array.isArray(lois) || lois.length === 0, 'corpus vide');

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
   * Depuis que `+page.ts` lève `error(404)`, le contrôle de statut redevient
   * possible : c'est une assertion plus forte que la précédente, et elle vaut
   * sans exécuter la moindre ligne de JavaScript.
   */
  const IDENTIFIANTS_ABSENTS = [
    // Hors de portée du corpus : aucune séquence n'atteint cette valeur.
    { chemin: '/laws/999999999', quoi: 'fiche de loi' },
    { chemin: '/categories/999999999', quoi: 'fiche de catégorie' },
    // Non numérique : l'API type l'identifiant en entier et pose une assertion
    // dessus. Sans contrôle côté front, ces adresses produisaient une 500 côté
    // API là où la bonne réponse est 404.
    { chemin: '/laws/abc', quoi: 'identifiant non numérique' },
    { chemin: '/categories/abc', quoi: 'identifiant non numérique' },
    { chemin: '/laws/-1', quoi: 'identifiant négatif' },
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
    const sante = await request.get(`${API}/health`, { failOnStatusCode: false });
    test.skip(!sante.ok(), 'backend injoignable');
  });

  test('le HTML de /laws/[id] porte le titre du document sans JavaScript', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/laws/?limit=1`, { failOnStatusCode: false });
    test.skip(!res.ok(), 'aucune loi disponible');
    const lois = await res.json();
    test.skip(!Array.isArray(lois) || lois.length === 0, 'corpus vide');

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
    const brut = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
    const titre = brut
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');

    expect(titre, 'le <title> servi ne porte pas le titre du document').toBe(
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
    for (const chemin of ['/search?q=loi', '/chat', '/login', '/admin']) {
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
