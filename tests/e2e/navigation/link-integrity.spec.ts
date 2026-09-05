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
    // Ni /laws/[id] ni /categories/[id] n'ont de `load` serveur : ils chargent
    // dans onMount, donc le rendu serveur répond 200 même pour un identifiant
    // inexistant. Un contrôle de statut ne prouverait rien ici — seul le bloc
    // d'erreur affiché distingue une fiche réelle d'une fiche vide.
    await expect(page.getByTestId('law-error')).toHaveCount(0);
    await expectAllResolve(page, await internalLinksOf(page), `/laws/${lois[0].id}`);
  });
});
