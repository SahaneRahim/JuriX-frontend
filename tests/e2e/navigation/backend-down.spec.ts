/**
 * Un backend injoignable doit se voir, pas se déguiser.
 *
 * POURQUOI CE FICHIER EXISTE. Trois pages présentaient une panne comme un
 * résultat normal, ce qu'aucune relecture n'avait attrapé parce qu'il faut
 * couper le réseau pour le constater :
 *
 *  - `/admin` déclarait `loading` et ne le lisait jamais : la page affichait
 *    « 0 documents, 0 recherches, 0 utilisateurs » comme des chiffres mesurés.
 *  - `/search` vidait `results` en posant `errorMessage`, ce qui faisait tomber
 *    le rendu dans la branche « Aucun résultat trouvé », affichée en grand,
 *    tandis que la vraie erreur restait une ligne rouge discrète. L'utilisateur
 *    reformulait sa requête pour une panne de serveur.
 *  - `/chat` fabriquait un message de type `assistant` — donc une bulle de
 *    réponse d'IA — et, sur un 5xx, affichait « Je traite votre question.
 *    Veuillez patienter… », c'est-à-dire une erreur présentée comme un succès
 *    en cours.
 *
 * Aucune infrastructure nouvelle : `page.route` suffit à couper l'API.
 */

import { expect, test } from '@playwright/test';

/** Coupe tout appel à l'API, en laissant passer le reste (JS, CSS, polices). */
async function couperApi(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/**', (route) => route.abort());
}

test.describe('Backend injoignable', () => {
  test.beforeEach(async ({ page }) => {
    await couperApi(page);
  });

  test("/admin ne présente pas des zéros comme des faits", async ({ page }) => {
    await page.goto('/admin');

    // Deux issues sont correctes, et laquelle survient dépend de la session :
    // soit la garde du layout redirige vers /login, soit le tableau de bord
    // s'affiche et doit alors montrer son état d'erreur. Ce qui est FAUX, dans
    // les deux cas, c'est d'afficher la grille de statistiques remplie de zéros.
    //
    // La garde vit dans `onMount` : attendre l'un ou l'autre plutôt que de lire
    // l'URL immédiatement, qui n'a pas encore changé au retour de `goto`.
    await Promise.race([
      page.waitForURL('**/login**', { timeout: 10000 }).catch(() => null),
      page.getByTestId('admin-error').waitFor({ timeout: 10000 }).catch(() => null),
    ]);

    if (new URL(page.url()).pathname.startsWith('/login')) {
      // Session absente : la garde a fait son travail, il n'y a rien de plus à
      // vérifier ici.
      return;
    }

    await expect(page.getByTestId('admin-error')).toBeVisible();
    await expect(page.getByTestId('admin-retry')).toBeVisible();
    // Le symptôme d'origine : la carte « documents » affichait 0 sans rien dire.
    await expect(page.getByTestId('admin-loading')).toHaveCount(0);
  });

  test("/search affiche l'erreur et non « aucun résultat »", async ({ page }) => {
    await page.goto('/search?q=loi');

    await expect(page.getByTestId('search-error')).toBeVisible();
    // Le point qui compte : la panne ne doit PAS se lire comme une recherche
    // infructueuse, sinon l'utilisateur change sa requête au lieu de réessayer.
    await expect(page.getByText(/aucun résultat|no results/i)).toHaveCount(0);
    await expect(page.getByTestId('search-retry')).toBeVisible();
  });

  test('/chat ne fabrique pas de réponse d’assistant', async ({ page }) => {
    await page.goto('/chat');

    const champ = page.locator('input[type="text"], textarea').first();
    await champ.fill('Quelles sont les conditions de nationalité ?');
    await champ.press('Enter');

    // Le message d'échec porte son propre type, avec role="alert" : il ne peut
    // plus être confondu avec une réponse du modèle.
    const erreur = page.getByTestId('chat-error');
    await expect(erreur).toBeVisible({ timeout: 15000 });
    await expect(erreur).toHaveAttribute('role', 'alert');
    await expect(page.getByText(/veuillez patienter|please wait/i)).toHaveCount(0);
  });
});
