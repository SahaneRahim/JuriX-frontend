/**
 * Ce que les pages garantissent AVANT que leur JavaScript ne s'exécute.
 *
 * Elles arrivent rendues par le serveur : sur un mobile lent, le visiteur voit
 * et touche ce HTML pendant que les scripts se téléchargent. Un contexte sans
 * JavaScript montre exactement cet état.
 */
import { expect, test } from '@playwright/test';

import { exiger } from '../doublures';

test.describe('Sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const { chemin, bouton } of [
    { chemin: '/login', bouton: 'login-submit' },
    { chemin: '/signup', bouton: 'signup-submit' },
    { chemin: '/forgot-password', bouton: 'forgot-submit' },
    { chemin: '/reset-password/jeton-de-test', bouton: 'reset-submit' },
    { chemin: '/compare', bouton: 'compare-submit' },
  ]) {
    test(`${chemin} : l’envoi reste inactif`, async ({ page }) => {
      // Actif, un Entrée envoyait le formulaire en GET, faute de gestionnaire :
      // la page se rechargeait et la saisie était perdue. Un bouton d'envoi
      // inactif bloque aussi l'envoi implicite par Entrée.
      await page.goto(chemin);
      await expect(page.getByTestId(bouton)).toBeDisabled();
    });
  }

  // L'inverse sur l'accueil (refonte A, H10) : son formulaire GET marche sans
  // JavaScript. Le bouton d'envoi y est donc actif, et nommé pour ce qu'il
  // fait alors : « Rechercher ».
  test('/ : l’envoi du champ unique reste actif, et cherche', async ({ page }) => {
    const statut = (await page.goto('/'))?.status() ?? 0;
    exiger(statut !== 503, '/ : API indisponible (503)');
    const envoi = page.locator('#contenu form[role="search"][action="/search"] button[type="submit"]');
    await expect(envoi).toBeEnabled();
    await expect(envoi).toHaveAccessibleName('Rechercher');
    await expect(page.locator('#contenu textarea[name="q"]')).toBeEditable();
  });
});

test.describe('Icône du thème', () => {
  // Les deux icônes sont rendues, et la classe `dark` que pose app.html avant
  // le premier affichage choisit la bonne : un {#if} sur le store dessinait la
  // lune au serveur, puis la remplaçait à l'hydratation.
  // Les icônes sont des SVG (src/lib/components/Icone.svelte), repérés par
  // leur `data-icone` : le soleil propose le thème clair, la lune le sombre.
  for (const { theme, visible, cachee } of [
    { theme: 'dark', visible: 'sun', cachee: 'moon' },
    { theme: 'light', visible: 'moon', cachee: 'sun' },
  ]) {
    test(`thème ${theme} : ${visible} affichée, ${cachee} masquée`, async ({ page }) => {
      await page.addInitScript((valeur) => localStorage.setItem('jurix-theme', valeur), theme);
      await page.goto('/about');
      const bascule = page.getByTestId('theme-toggle');
      await expect(bascule.locator(`[data-icone="${visible}"]`)).toBeVisible();
      await expect(bascule.locator(`[data-icone="${cachee}"]`)).toBeHidden();
    });
  }
});
