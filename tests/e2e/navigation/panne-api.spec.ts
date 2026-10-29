/**
 * API en panne : ce que reçoivent un robot et un visiteur.
 *
 * Le serveur de :4174 (playwright.config.ts) sert le même build que :4173, avec
 * une API injoignable (API_INTERNE vers un nom qui ne se résout pas). Ses appels partent du
 * serveur : seul ce montage les fait échouer, et il prouve en passant que la
 * réécriture de src/hooks.server.ts est bien appliquée.
 *
 * Attendu ($lib/panne) : 503 au rendu serveur des pages qui dépendent de
 * l'API, avec un lien « Réessayer » ; les pages sans API restent en 200. En
 * navigation dans le navigateur aussi, 503 et la page d'erreur du site : ces
 * pages sont mises en cache par Vercel (ISR), `__data.json` compris, et une
 * réponse en 200 portant un message d'erreur y serait gardée et servie à tous
 * (src/hooks.server.ts fait passer le statut dans la réponse HTTP).
 */
import { expect, test } from '@playwright/test';
import { cliquerJusqualEffet } from '../hydratation';

const EN_PANNE = 'http://localhost:4174';

test.describe('Rendu serveur, API injoignable', () => {
  for (const chemin of ['/', '/laws', '/laws?lang=fr', '/laws/1', '/categories/1']) {
    test(`${chemin} répond 503, avec un lien pour réessayer`, async ({ request }) => {
      const res = await request.get(`${EN_PANNE}${chemin}`, { failOnStatusCode: false });
      expect(res.status()).toBe(503);
      const html = await res.text();
      expect(html).toContain('<title>Service momentanément indisponible — JuriX</title>');
      // Un lien et non un bouton : il marche avant le JavaScript, et
      // data-sveltekit-reload redemande la page au serveur.
      const lien = html.match(/<a[^>]*data-testid="error-retry"[^>]*>/)?.[0] ?? '';
      expect(lien, 'lien Réessayer absent').not.toBe('');
      expect(lien).toContain(`href="${chemin.replace(/&/g, '&amp;')}"`);
      expect(lien).toContain('data-sveltekit-reload');
    });
  }

  test('/search affiche l’erreur et non « aucun résultat », sans JavaScript', async ({ request }) => {
    // Rendue par le serveur depuis P8, et JAMAIS mise en cache : la page
    // garde son état d'erreur (200), avec sa barre de recherche, plutôt que la
    // page d'erreur du site. Le point qui compte : la panne ne se lit pas
    // comme une recherche infructueuse, sinon le lecteur change sa requête au
    // lieu de réessayer.
    const res = await request.get(`${EN_PANNE}/search?q=loi`, { failOnStatusCode: false });
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('data-testid="search-error"');
    expect(html).not.toMatch(/aucun résultat|aucun texte ne contient/i);
    // « Réessayer » est un lien vers la même recherche : il marche avant le
    // JavaScript.
    const lien = html.match(/<a[^>]*data-testid="search-retry"[^>]*>/)?.[0] ?? '';
    expect(lien, 'lien Réessayer absent').not.toBe('');
    expect(lien).toMatch(/href="\/search\?q=loi"/);
  });

  test('les pages sans API restent en 200', async ({ request }) => {
    for (const chemin of ['/about', '/robots.txt', '/login']) {
      const res = await request.get(`${EN_PANNE}${chemin}`, { failOnStatusCode: false });
      expect(res.status(), chemin).toBe(200);
    }
  });

  test('une requête de données répond 503 elle aussi, jamais un 200 que Vercel garderait', async ({ request }) => {
    // Navigation dans le navigateur : la page arrive par __data.json. SvelteKit
    // y range l'erreur d'un `load` dans un corps en 200, que le cache de
    // Vercel prendrait pour une version valide.
    for (const chemin of ['/', '/laws', '/laws/1', '/categories/1']) {
      const donnees = `${chemin === '/' ? '' : chemin}/__data.json`;
      const res = await request.get(`${EN_PANNE}${donnees}`, { failOnStatusCode: false });
      expect(res.status(), donnees).toBe(503);
      expect(res.headers()['content-type'], donnees).toContain('application/json');
      expect(await res.json(), donnees).toEqual({ message: 'Service momentanément indisponible' });
    }
  });
});

test.describe('Navigation dans le navigateur, API coupée', () => {
  test('/search affiche l’erreur et sa reprise, jamais « aucun résultat »', async ({ page }) => {
    await page.goto(`${EN_PANNE}/search?q=loi`);

    await expect(page.getByTestId('search-error')).toBeVisible();
    await expect(page.getByText(/aucun résultat|aucun texte ne contient|no results|no text contains/i)).toHaveCount(0);
    await expect(page.getByTestId('search-retry')).toBeVisible();
    // La barre de recherche reste là : le lecteur peut réessayer ou reformuler.
    await expect(page.locator('#contenu form[role="search"]')).toBeVisible();
  });

  test('une liste ouverte depuis le menu affiche la page d’erreur et sa reprise', async ({ page }) => {
    // Les `load` des pages publiques tournent sur le serveur : seul le serveur
    // de :4174, dont l'API est injoignable, peut les faire échouer pendant une
    // navigation. page.route ne verrait rien.
    //
    // Aucun profil posé (le storageState de playwright.config.ts ne vaut que
    // pour :4173) : depuis P5, la question du profil ne s'ouvre plus à
    // l'arrivée, et rien ne rend la page inerte.
    await page.goto(`${EN_PANNE}/about`);
    // Attendre que Svelte ait pris la main : un clic parti avant ferait une
    // navigation complète, rendue par le serveur, au lieu d'une requête de
    // données.
    await cliquerJusqualEffet(page.getByTestId('lang-en'), page.locator('html[lang="en"]'));

    const donnees = page.waitForResponse((r) => r.url().includes('/laws/__data.json'));
    await page.getByTestId('site-header').locator('a[href="/laws"]').first().click();
    expect((await donnees).status()).toBe(503);

    await expect(page).toHaveURL(`${EN_PANNE}/laws`);
    await expect(page.getByTestId('error-page')).toBeVisible();
    await expect(page.getByTestId('error-retry')).toBeVisible();
    await expect(page.getByTestId('error-retry')).toHaveAttribute('href', '/laws');
  });
});
