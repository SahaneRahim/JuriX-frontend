/**
 * Inscription publique et connexion.
 *
 * CE QUE CE FICHIER PROTÈGE EN PRIORITÉ : le corps envoyé par la page ne porte
 * QUE `full_name`, `email` et `password`. Le schéma serveur refuse déjà `role`
 * — il produirait un 422 — mais l'assertion tient des deux côtés : le jour où
 * quelqu'un ajoutera un champ « par commodité », ce test le dira.
 *
 * Les appels sont interceptés : aucun compte n'est créé, aucune base n'est
 * requise, et les chemins d'erreur deviennent testables.
 */

import { expect, test, type Page } from '@playwright/test';
import { cliquerJusqualEffet } from '../hydratation';

const ROUTE_SIGNUP = '**/api/v1/auth/signup';

const COMPTE = {
  id: 7,
  email: 'rahim@jurix.cm',
  username: 'rahim',
  full_name: 'Rahim Sahane',
  role: 'user',
  is_active: true,
  is_verified: false,
  created_at: '2026-09-07T10:00:00',
  last_login_at: null,
  access_token: 'jeton-de-test',
  token_type: 'bearer',
};

async function remplir(page: Page) {
  await page.getByTestId('signup-name').fill('Rahim Sahane');
  await page.getByTestId('signup-email').fill('rahim@jurix.cm');
  await page.getByTestId('signup-password').fill('MotDePasse1');
}

test.describe('Inscription', () => {
  test('le corps envoyé ne porte que les trois champs attendus', async ({ page }) => {
    let corps: Record<string, unknown> | null = null;
    await page.route(ROUTE_SIGNUP, async (route) => {
      corps = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(COMPTE),
      });
    });

    await page.goto('/signup');
    await remplir(page);
    await cliquerJusqualEffet(
      page.getByTestId('signup-submit'),
      page.getByTestId('user-name'),
    );

    // L'assertion centrale : pas de `role`, pas d'`is_active`, rien d'autre.
    expect(Object.keys(corps ?? {}).sort()).toEqual(['email', 'full_name', 'password']);
  });

  test('une inscription réussie ouvre la session et ramène à l’accueil', async ({ page }) => {
    await page.route(ROUTE_SIGNUP, (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(COMPTE),
      }),
    );

    await page.goto('/signup');
    await remplir(page);
    await cliquerJusqualEffet(
      page.getByTestId('signup-submit'),
      page.getByTestId('user-name'),
    );

    await expect(page.getByTestId('user-name')).toHaveText('Rahim Sahane');
    // `waitForURL` et non une lecture immédiate de `page.url()` : le nom
    // apparaît dès que le store est renseigné, or `goto('/')` est asynchrone.
    // Lire l'adresse à cet instant est une course — observée une fois.
    await page.waitForURL('**/');
    expect(new URL(page.url()).pathname).toBe('/');
    const jeton = await page.evaluate(() => localStorage.getItem('jurix-auth-token'));
    expect(jeton).toBe('jeton-de-test');
  });

  test('une adresse déjà prise a son propre message', async ({ page }) => {
    await page.route(ROUTE_SIGNUP, (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Un compte existe déjà avec cette adresse' }),
      }),
    );

    await page.goto('/signup');
    await remplir(page);
    await cliquerJusqualEffet(
      page.getByTestId('signup-submit'),
      page.getByTestId('signup-error'),
    );

    await expect(page.getByTestId('signup-error')).toHaveAttribute('role', 'alert');
    // Le message ne doit jamais révéler que le compte utilise Google.
    await expect(page.getByTestId('signup-error')).not.toContainText('Google');
  });

  test('un serveur injoignable est distingué de données refusées', async ({ page }) => {
    await page.route(ROUTE_SIGNUP, (route) => route.abort());

    await page.goto('/signup');
    await remplir(page);
    await cliquerJusqualEffet(
      page.getByTestId('signup-submit'),
      page.getByTestId('signup-error'),
    );

    await expect(page.getByTestId('signup-error')).toContainText(/serveur|server/i);
  });

  test('les deux pages se renvoient l’une à l’autre', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-to-signup')).toHaveAttribute('href', '/signup');

    await page.goto('/signup');
    await expect(page.getByRole('link', { name: /Se connecter|Sign in/ }).first()).toBeVisible();
  });

  test('l’en-tête propose la création de compte à un visiteur anonyme', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('nav-signup')).toHaveAttribute('href', '/signup');
    await expect(page.getByTestId('user-name')).toHaveCount(0);
  });

  test('le bouton Google n’est pas rendu sans identifiant client', async ({ page }) => {
    // `VITE_GOOGLE_CLIENT_ID` est vide en CI : la page doit rester entièrement
    // fonctionnelle, et l'iframe Google ne doit jamais entrer dans le balayage
    // d'accessibilité.
    await page.goto('/signup');

    await expect(page.getByTestId('google-button-container')).toHaveCount(0);
    await expect(page.getByTestId('signup-submit')).toBeVisible();
  });
});
