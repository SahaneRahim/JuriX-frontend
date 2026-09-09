/**
 * Récupération de compte : mot de passe oublié, réinitialisation, vérification.
 *
 * CE QUE CE FICHIER PROTÈGE EN PRIORITÉ. Le backend répond délibérément la même
 * chose pour une adresse connue et une adresse inconnue, afin que la route ne
 * devienne pas un moyen de savoir qui possède un compte. **Le front peut
 * trahir cette protection sans que le back change d'une ligne** — un « compte
 * trouvé », une redirection différente, un délai visible. Le premier test
 * compare donc le texte rendu dans les deux cas, octet pour octet.
 *
 * Les trois autres invariants :
 *  - un jeton refusé doit offrir une SORTIE, jamais un cul-de-sac ;
 *  - le jeton ne doit JAMAIS s'afficher, ni rester dans la barre d'adresse ;
 *  - `/verify-email` avec l'API coupée ne doit pas rester bloquée sur
 *    « vérification en cours » — c'est exactement le défaut que backend-down
 *    existe pour interdire.
 *
 * Les appels sont interceptés : aucun compte n'est touché, aucune base n'est
 * requise, et les chemins d'erreur deviennent testables.
 */

import { expect, test, type Page } from '@playwright/test';
import { cliquerJusqualEffet } from '../hydratation';

const ROUTE_FORGOT = '**/api/v1/auth/password/forgot';
const ROUTE_RESET = '**/api/v1/auth/password/reset';
const ROUTE_VERIFY = '**/api/v1/auth/verify-email';

/** La réponse unique du serveur, identique quelle que soit la branche. */
const ACCUSE = {
  message:
    "Si un compte existe pour cette adresse, un lien vient d'être envoyé. " +
    'Pensez à vérifier vos courriers indésirables.',
};

const JETON = 'jeton-de-test-suffisamment-long-pour-passer';

async function demander(page: Page, adresse: string): Promise<string> {
  await page.route(ROUTE_FORGOT, (route) =>
    route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify(ACCUSE),
    }),
  );
  await page.goto('/forgot-password');
  await page.getByTestId('forgot-email').fill(adresse);
  await cliquerJusqualEffet(page.getByTestId('forgot-submit'), page.getByTestId('forgot-sent'));
  return ((await page.locator('main').textContent()) ?? '').replace(/\s+/g, ' ').trim();
}

test.describe('Mot de passe oublié', () => {
  test('le lien depuis /login mène à la page', async ({ page }) => {
    await page.goto('/login');

    await cliquerJusqualEffet(
      page.getByTestId('login-to-forgot'),
      page.getByTestId('forgot-email'),
    );

    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('une adresse connue et une adresse inconnue produisent le même écran', async ({
    page,
  }) => {
    // L'ASSERTION CENTRALE DU FICHIER. Voir le docstring : le backend protège
    // l'existence des comptes, le front ne doit pas la révéler.
    const connue = await demander(page, 'rahim@jurix.cm');
    const inconnue = await demander(page, 'personne-du-tout@jurix.cm');

    expect(inconnue).toBe(connue);
  });

  test("l'écran de confirmation prévient pour les indésirables", async ({ page }) => {
    // Sans nom de domaine, l'expéditeur affiché est réécrit et le message part
    // souvent en indésirables. Le taire ferait conclure que le service est
    // cassé.
    await demander(page, 'rahim@jurix.cm');

    await expect(page.getByTestId('forgot-sent')).toContainText(/indésirable/i);
  });

  test('un serveur injoignable garde le formulaire et le dit', async ({ page }) => {
    await page.route(ROUTE_FORGOT, (route) => route.abort());

    await page.goto('/forgot-password');
    await page.getByTestId('forgot-email').fill('rahim@jurix.cm');
    await cliquerJusqualEffet(
      page.getByTestId('forgot-submit'),
      page.getByTestId('forgot-error'),
    );

    // Le formulaire reste utilisable : l'utilisateur doit pouvoir réessayer.
    await expect(page.getByTestId('forgot-email')).toBeVisible();
  });
});

test.describe('Réinitialisation', () => {
  test('la page n’affiche jamais le jeton', async ({ page }) => {
    await page.goto(`/reset-password/${JETON}`);
    await expect(page.getByTestId('reset-password')).toBeVisible();

    const texte = (await page.locator('body').textContent()) ?? '';

    expect(texte).not.toContain(JETON);
    // Et il ne reste pas non plus dans la barre d'adresse, donc pas dans
    // l'historique du navigateur ni dans un éventuel partage d'écran.
    expect(page.url()).not.toContain(JETON);
  });

  test('deux mots de passe différents sont refusés sans appeler le réseau', async ({
    page,
  }) => {
    let appels = 0;
    await page.route(ROUTE_RESET, (route) => {
      appels += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto(`/reset-password/${JETON}`);
    await page.getByTestId('reset-password').fill('MotDePasse1');
    await page.getByTestId('reset-confirm').fill('MotDePasse2');
    await cliquerJusqualEffet(page.getByTestId('reset-submit'), page.getByTestId('reset-error'));

    expect(appels, 'un appel réseau est parti malgré la validation locale').toBe(0);
  });

  test('un jeton refusé affiche une sortie, pas un cul-de-sac', async ({ page }) => {
    await page.route(ROUTE_RESET, (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: "Ce lien n'est plus valide." }),
      }),
    );

    await page.goto(`/reset-password/${JETON}`);
    await page.getByTestId('reset-password').fill('MotDePasse1');
    await page.getByTestId('reset-confirm').fill('MotDePasse1');
    await cliquerJusqualEffet(page.getByTestId('reset-submit'), page.getByTestId('reset-error'));

    // Deux portes de sortie : sinon l'utilisateur est bloqué sur un message
    // sans savoir quoi faire. Ciblées par identifiant et non par `href` — un
    // sélecteur d'attribut attrape aussi les liens des autres états et fait
    // échouer le mode strict de Playwright pour une raison sans rapport.
    await expect(page.getByTestId('reset-ask-new-link')).toBeVisible();
    await expect(page.getByTestId('reset-to-login')).toBeVisible();

    // Et le formulaire a disparu : recliquer « Changer mon mot de passe » ne
    // pourrait produire qu'un second refus.
    await expect(page.getByTestId('reset-submit')).toHaveCount(0);
  });

  test('un changement réussi renvoie vers la connexion', async ({ page }) => {
    await page.route(ROUTE_RESET, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Mot de passe modifié.' }),
      }),
    );

    await page.goto(`/reset-password/${JETON}`);
    await page.getByTestId('reset-password').fill('MotDePasse1');
    await page.getByTestId('reset-confirm').fill('MotDePasse1');
    await cliquerJusqualEffet(page.getByTestId('reset-submit'), page.getByTestId('reset-success'));

    await expect(page.getByTestId('reset-to-login')).toBeVisible();
  });
});

test.describe("Vérification d'adresse", () => {
  test('un jeton valide confirme et propose une suite', async ({ page }) => {
    await page.route(ROUTE_VERIFY, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Adresse confirmée.' }),
      }),
    );

    await page.goto(`/verify-email/${JETON}`);

    await expect(page.getByTestId('verify-success')).toBeVisible();
    await expect(page.getByTestId('verify-to-home')).toBeVisible();
  });

  test("l'API coupée n'enferme pas dans « vérification en cours »", async ({ page }) => {
    // LE DÉFAUT QUE CE TEST INTERDIT : un état « en cours » perpétuel, qui ne
    // dit rien et n'offre aucune issue. C'est la raison d'être de backend-down.
    await page.route(ROUTE_VERIFY, (route) => route.abort());

    await page.goto(`/verify-email/${JETON}`);

    await expect(page.getByTestId('verify-error')).toBeVisible();
    await expect(page.getByTestId('verify-pending')).toHaveCount(0);
    await expect(page.getByTestId('verify-to-login')).toBeVisible();
  });

  test('un jeton refusé le dit et laisse une sortie', async ({ page }) => {
    await page.route(ROUTE_VERIFY, (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: "Ce lien n'est plus valide." }),
      }),
    );

    await page.goto(`/verify-email/${JETON}`);

    await expect(page.getByTestId('verify-error')).toBeVisible();
    await expect(page.getByTestId('verify-to-login')).toBeVisible();
  });

  test('la page n’affiche jamais le jeton', async ({ page }) => {
    await page.route(ROUTE_VERIFY, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );

    await page.goto(`/verify-email/${JETON}`);
    await expect(page.getByTestId('verify-success')).toBeVisible();

    expect((await page.locator('body').textContent()) ?? '').not.toContain(JETON);
    expect(page.url()).not.toContain(JETON);
  });
});
