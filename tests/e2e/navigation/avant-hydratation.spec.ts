/**
 * Ce que les pages garantissent AVANT que leur JavaScript ne s'exécute.
 *
 * Elles arrivent rendues par le serveur : sur un mobile lent, le visiteur voit
 * et touche ce HTML pendant que les scripts se téléchargent. Un contexte sans
 * JavaScript montre exactement cet état.
 */
import { expect, test } from '@playwright/test';

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
});

test.describe('Icône du thème', () => {
  // Les deux icônes sont rendues, et la classe `dark` que pose app.html avant
  // le premier affichage choisit la bonne : un {#if} sur le store dessinait la
  // lune au serveur, puis la remplaçait à l'hydratation.
  for (const { theme, visible, cachee } of [
    { theme: 'dark', visible: 'light_mode', cachee: 'dark_mode' },
    { theme: 'light', visible: 'dark_mode', cachee: 'light_mode' },
  ]) {
    test(`thème ${theme} : ${visible} affichée, ${cachee} masquée`, async ({ page }) => {
      await page.addInitScript((valeur) => localStorage.setItem('jurix-theme', valeur), theme);
      await page.goto('/about');
      const bascule = page.getByTestId('theme-toggle');
      await expect(bascule.getByText(visible, { exact: true })).toBeVisible();
      await expect(bascule.getByText(cachee, { exact: true })).toBeHidden();
    });
  }
});
