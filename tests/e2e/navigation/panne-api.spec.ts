/**
 * API en panne : ce que reçoivent un robot et un visiteur.
 *
 * Le serveur de :4174 (playwright.config.ts) sert le même build que :4173, avec
 * une API injoignable (API_INTERNE vers un nom qui ne se résout pas). Ses appels partent du
 * serveur : seul ce montage les fait échouer, et il prouve en passant que la
 * réécriture de src/hooks.server.ts est bien appliquée.
 *
 * Attendu ($lib/panne) : 503 au rendu serveur des pages qui dépendent de
 * l'API, avec un lien « Réessayer » ; les pages sans API restent en 200 ; en
 * navigation dans le navigateur, le message et la reprise de la page.
 */
import { expect, test } from '@playwright/test';
import { cliquerJusqualEffet } from '../hydratation';

const EN_PANNE = 'http://localhost:4174';
const API = process.env.VITE_API_URL ?? 'http://localhost:8000';

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

  test('les pages sans API restent en 200', async ({ request }) => {
    for (const chemin of ['/about', '/robots.txt', '/login']) {
      const res = await request.get(`${EN_PANNE}${chemin}`, { failOnStatusCode: false });
      expect(res.status(), chemin).toBe(200);
    }
  });

  test('une requête de données du navigateur garde le message de la page', async ({ request }) => {
    // Navigation dans le navigateur : la liste arrive par __data.json, et la
    // page affiche son bloc d'erreur et sa reprise au lieu d'une page d'erreur.
    const res = await request.get(`${EN_PANNE}/laws/__data.json`, { failOnStatusCode: false });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('laws.errorLoad');
  });
});

test.describe('Navigation dans le navigateur, API coupée', () => {
  test('une fiche ouverte depuis la liste montre son erreur et sa reprise', async ({ page, request }) => {
    const lois = await request.get(`${API}/api/v1/laws/?limit=1`, { failOnStatusCode: false }).catch(() => null);
    const joignable = lois?.ok() ?? false;
    if (process.env.E2E_EXIGER_BACKEND === '1') expect(joignable, 'API injoignable (E2E_EXIGER_BACKEND=1)').toBe(true);
    test.skip(!joignable, 'API injoignable');

    await page.goto('/laws');
    // Attendre que Svelte ait pris la main : un clic parti avant ferait une
    // navigation complète, rendue par le serveur, que page.route ne voit pas.
    await cliquerJusqualEffet(page.getByTestId('lang-en'), page.locator('html[lang="en"]'));

    const lien = page.locator('a[href^="/laws/"]').first();
    const href = (await lien.getAttribute('href')) ?? '';
    await page.route(`**/api/v1/laws/${href.split('/').pop()}`, (route) => route.abort());
    await lien.click();

    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByTestId('law-error')).toBeVisible();
    await expect(page.getByTestId('law-retry')).toBeVisible();
  });
});
