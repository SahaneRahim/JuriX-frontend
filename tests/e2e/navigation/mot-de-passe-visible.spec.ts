/**
 * Mot de passe affiché à la demande, et chemin vers la réinitialisation.
 *
 * CE QUE CE FICHIER PROTÈGE. Le bouton « Afficher le mot de passe » est posé
 * DANS des formulaires d'envoi (connexion, inscription, réinitialisation) :
 * il ne doit jamais rien envoyer, ni voler le focus du champ (le clavier du
 * téléphone se refermerait), ni changer ce que lisent les gestionnaires de
 * mots de passe (`autocomplete`) et le libellé (`<label for>`).
 *
 * Et la réinitialisation doit se trouver : un lien près du champ du mot de
 * passe, une invitation après un refus des identifiants, une erreur claire
 * sur une adresse mal écrite. Le propriétaire ne l'avait pas trouvée.
 *
 * Les appels sont interceptés : aucun compte n'est touché, aucun courriel ne
 * part, et une requête autre qu'une lecture serait relevée.
 */

import { expect, test, type Page } from '@playwright/test';

const JETON = 'jeton-de-test-suffisamment-long-pour-passer';

/** Chaque champ de mot de passe des pages publiques, et son bouton d'envoi. */
const PAGES = [
  { chemin: '/login', envoi: 'login-submit', champs: [{ id: 'password', testid: 'login-password', autocomplete: 'current-password' }] },
  { chemin: '/signup', envoi: 'signup-submit', champs: [{ id: 'signup-password', testid: 'signup-password', autocomplete: 'new-password' }] },
  {
    chemin: `/reset-password/${JETON}`,
    envoi: 'reset-submit',
    champs: [
      { id: 'reset-password', testid: 'reset-password', autocomplete: 'new-password' },
      { id: 'reset-confirm', testid: 'reset-confirm', autocomplete: 'new-password' },
    ],
  },
];

/** Relève toute requête qui n'est pas une lecture : un envoi de formulaire. */
function relever(page: Page): string[] {
  const envois: string[] = [];
  page.on('request', (requete) => {
    if (requete.method() !== 'GET') envois.push(`${requete.method()} ${requete.url()}`);
  });
  return envois;
}

test.describe('Afficher le mot de passe', () => {
  for (const { chemin, envoi, champs } of PAGES) {
    for (const { id, testid, autocomplete } of champs) {
      test(`${chemin} #${id} : affiche la saisie sans rien envoyer ni perdre le focus`, async ({ page }) => {
        const envois = relever(page);
        await page.goto(chemin);
        // Le bouton d'envoi s'active au montage : la page est hydratée, le
        // bouton d'affichage a son gestionnaire.
        await expect(page.getByTestId(envoi)).toBeEnabled();

        const champ = page.getByTestId(testid);
        const bouton = page.getByTestId(`${id}-afficher`);
        await expect(champ).toHaveAttribute('type', 'password');
        await expect(bouton).toHaveAttribute('aria-pressed', 'false');
        await expect(bouton).toHaveAttribute('type', 'button');

        await champ.fill('MotDePasse1');
        await champ.evaluate((c: HTMLInputElement) => c.setSelectionRange(2, 5));
        await bouton.click();

        await expect(champ).toHaveAttribute('type', 'text');
        await expect(bouton).toHaveAttribute('aria-pressed', 'true');
        await expect(bouton).toHaveAccessibleName(/Masquer le mot de passe|Hide password/);
        // Le focus et la sélection sont restés dans le champ.
        await expect(champ).toBeFocused();
        expect(await champ.evaluate((c: HTMLInputElement) => [c.selectionStart, c.selectionEnd])).toEqual([2, 5]);
        // Rien de ce que lisent le libellé et les gestionnaires n'a bougé.
        await expect(champ).toHaveValue('MotDePasse1');
        await expect(champ).toHaveAttribute('autocomplete', autocomplete);
        await expect(champ).toHaveAttribute('id', id);
        await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);

        await bouton.click();
        await expect(champ).toHaveAttribute('type', 'password');
        await expect(bouton).toHaveAccessibleName(/Afficher le mot de passe|Show password/);

        expect(envois, 'le bouton a envoyé le formulaire').toEqual([]);
      });
    }
  }

  test('la saisie est masquée de nouveau à l’envoi', async ({ page }) => {
    await page.route('**/api/v1/auth/login/json', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'x' }) }),
    );
    await page.goto('/login');
    await expect(page.getByTestId('login-submit')).toBeEnabled();
    await page.getByTestId('login-email').fill('rahim@jurix.cm');
    await page.getByTestId('login-password').fill('MotDePasse1');
    await page.getByTestId('password-afficher').click();
    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'text');

    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    // Un mot de passe resté en clair s'afficherait sous l'erreur.
    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'password');
    await expect(page.getByTestId('password-afficher')).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('Trouver la réinitialisation', () => {
  test('le lien « Mot de passe oublié ? » est collé au champ du mot de passe', async ({ page }) => {
    await page.goto('/login');
    const lien = page.getByTestId('login-to-forgot');
    await expect(lien).toBeVisible();
    await expect(lien).toHaveAttribute('href', '/forgot-password');

    // Sur la ligne du libellé, juste au-dessus du champ : sous le bouton
    // d'envoi, le propriétaire ne l'avait pas vu.
    const boiteLien = (await lien.boundingBox())!;
    const boiteChamp = (await page.getByTestId('login-password').boundingBox())!;
    const boiteEnvoi = (await page.getByTestId('login-submit').boundingBox())!;
    expect(boiteLien.y + boiteLien.height).toBeLessThanOrEqual(boiteChamp.y + 1);
    expect(boiteChamp.y - (boiteLien.y + boiteLien.height)).toBeLessThan(24);
    expect(boiteLien.y).toBeLessThan(boiteEnvoi.y);
  });

  test('un refus des identifiants propose la réinitialisation', async ({ page }) => {
    await page.route('**/api/v1/auth/login/json', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'x' }) }),
    );
    await page.goto('/login');
    await expect(page.getByTestId('login-submit')).toBeEnabled();
    await page.getByTestId('login-email').fill('rahim@jurix.cm');
    await page.getByTestId('login-password').fill('MotDePasse1');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page.getByTestId('login-reset-hint')).toBeVisible();
    const lien = page.getByTestId('login-error-to-forgot');
    await expect(lien).toHaveAttribute('href', '/forgot-password');
    // Hors de la région `role="alert"`, où un lien n'est pas toujours exposé.
    await expect(page.getByTestId('login-error').getByRole('link')).toHaveCount(0);

    await lien.click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByTestId('forgot-email')).toBeVisible();
  });

  test('un compte désactivé ne reçoit pas cette invitation', async ({ page }) => {
    await page.route('**/api/v1/auth/login/json', (route) =>
      route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ detail: 'x' }) }),
    );
    await page.goto('/login');
    await expect(page.getByTestId('login-submit')).toBeEnabled();
    await page.getByTestId('login-email').fill('rahim@jurix.cm');
    await page.getByTestId('login-password').fill('MotDePasse1');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page.getByTestId('login-reset-hint')).toHaveCount(0);
  });

  test('une adresse mal écrite est signalée sans appel au serveur', async ({ page }) => {
    let appels = 0;
    await page.route('**/api/v1/auth/password/forgot', (route) => {
      appels += 1;
      return route.fulfill({ status: 202, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/forgot-password');
    await expect(page.getByTestId('forgot-submit')).toBeEnabled();
    await page.getByTestId('forgot-email').fill('rahim@jurix');
    await page.getByTestId('forgot-submit').click();

    await expect(page.getByTestId('forgot-error')).toBeVisible();
    await expect(page.getByTestId('forgot-error')).toContainText(/adresse email valide|valid email address/i);
    await expect(page.getByTestId('forgot-email')).toHaveAttribute('aria-invalid', 'true');
    expect(appels, 'un appel est parti malgré la vérification locale').toBe(0);
  });

  test('un 422 du serveur dit « adresse invalide », pas « réessayez »', async ({ page }) => {
    await page.route('**/api/v1/auth/password/forgot', (route) =>
      route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ detail: [] }) }),
    );
    await page.goto('/forgot-password');
    await expect(page.getByTestId('forgot-submit')).toBeEnabled();
    await page.getByTestId('forgot-email').fill('rahim@jurix.cm');
    await page.getByTestId('forgot-submit').click();

    await expect(page.getByTestId('forgot-error')).toContainText(/adresse email valide|valid email address/i);
    await expect(page.getByTestId('forgot-email')).toBeVisible();
  });

  test('après un changement réussi, un bouton mène à la connexion', async ({ page }) => {
    await page.route('**/api/v1/auth/password/reset', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'ok' }) }),
    );
    await page.goto(`/reset-password/${JETON}`);
    await expect(page.getByTestId('reset-submit')).toBeEnabled();
    await page.getByTestId('reset-password').fill('MotDePasse1');
    await page.getByTestId('reset-confirm').fill('MotDePasse1');
    await page.getByTestId('reset-submit').click();

    await expect(page.getByTestId('reset-success')).toBeVisible();
    const suite = page.getByTestId('reset-to-login');
    await expect(suite).toHaveAttribute('href', '/login');
    await suite.click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
