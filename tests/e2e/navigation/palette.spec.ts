/**
 * La palette de commande (Ctrl K) dans le navigateur, pour ce que jsdom ne
 * sait pas montrer : `inert` et la tabulation
 * (src/lib/components/CommandPalette.test.ts, src/routes/layout.test.ts).
 *
 * CE QUE CE FICHIER GARDE. Ouverte, la palette se dit modale (`aria-modal`),
 * et la page derrière elle est inerte (src/routes/+layout.svelte). Maj+Tab
 * menait de son champ à la page cachée sous le fond, où Entrée activait un
 * contrôle invisible : sur /chat, l'envoi d'un brouillon à l'assistant. Une
 * fois la palette fermée, la page redevient active, et le focus revient à la
 * loupe qui l'a ouverte.
 *
 * Ouverte pendant un lien lent, la palette garde le focus à l'arrivée de la
 * page : SvelteKit le remet sur <body> (`reset_focus`) juste avant les
 * rappels `afterNavigate`, et la suite de la frappe n'allait nulle part.
 *
 * DONNÉES. L'accueil est rendu par le serveur, qui lit la vraie API : le test
 * est sauté quand elle est éteinte, sauf avec E2E_EXIGER_BACKEND=1
 * (`ouvrirAuServeur`).
 *
 * Lancer : npx playwright test tests/e2e/navigation/palette.spec.ts --project=chromium
 */

import { expect, test, type Page } from '@playwright/test';

import { ouvrirAuServeur, visible } from '../doublures';
import { cliquerJusqualEffet } from '../hydratation';

test.use({ viewport: { width: 1440, height: 900 } });

/** Où est le focus : dans la palette, dans la page derrière elle, ou sur <body>. */
const ouEstLeFocus = (page: Page): Promise<'palette' | 'page' | 'nulle part'> =>
  page.evaluate(() => {
    const actif = document.activeElement;
    if (!actif || actif === document.body) return 'nulle part';
    return actif.closest('[role="dialog"]') ? 'palette' : 'page';
  });

/** Le contenu de la page est-il inerte ? */
const pageInerte = (page: Page): Promise<boolean> =>
  page.evaluate(() => Boolean(document.getElementById('contenu')?.closest('[inert]')));

test('ouverte, la palette rend la page inerte ; Échap rend le focus à la loupe', async ({ page }) => {
  await ouvrirAuServeur(page, '/');
  const loupe = visible(page.getByTestId('site-header').getByRole('button', { name: /^Recherche et actions rapides/ }));
  const palette = page.getByRole('dialog', { name: 'Palette de commande' });
  await cliquerJusqualEffet(loupe, palette);
  await expect(palette.getByRole('textbox')).toBeFocused();
  expect(await pageInerte(page)).toBe(true);

  // Maj+Tab depuis le champ ne mène plus à la page cachée sous le fond : le
  // focus reste dans la palette, ou quitte le document, selon le navigateur…
  await page.keyboard.press('Shift+Tab');
  expect(await ouEstLeFocus(page)).not.toBe('page');
  // … et la page refuse le focus qu'on lui donne.
  await page.locator('#contenu').getByRole('searchbox', { name: 'Rechercher', exact: true }).focus();
  expect(await ouEstLeFocus(page)).not.toBe('page');

  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
  await expect(loupe).toBeFocused();
  expect(await pageInerte(page)).toBe(false);
});

test('ouverte pendant un lien lent, la palette garde la frappe à l’arrivée de la page', async ({ page }) => {
  await ouvrirAuServeur(page, '/');
  const loupe = visible(page.getByTestId('site-header').getByRole('button', { name: /^Recherche et actions rapides/ }));
  const palette = page.getByRole('dialog', { name: 'Palette de commande' });
  const champ = palette.getByRole('textbox');
  // Hydratée : la loupe ouvre la palette, Échap la referme.
  await cliquerJusqualEffet(loupe, palette);
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();

  // Les suggestions de la saisie n'importent pas ici : rien ne part vers l'API.
  await page.route('**/api/v1/search/suggest**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ suggestions: [] }) }),
  );
  // Les données de /laws n'arrivent que sur demande, comme sur un réseau lent.
  let laisserPasser!: () => void;
  const feu = new Promise<void>((resolve) => (laisserPasser = resolve));
  await page.route(
    (url) => url.pathname === '/laws/__data.json',
    async (route) => {
      await feu;
      await route.continue();
    },
  );

  await visible(page.getByTestId('site-header').locator('a[href="/laws"]')).click();
  // Pendant l'attente : Ctrl K, puis le début de la saisie.
  await page.keyboard.press('Control+k');
  await expect(champ).toBeFocused();
  await page.keyboard.type('code du');

  laisserPasser();
  await expect(page).toHaveURL(/\/laws$/, { timeout: 15_000 });
  await expect(palette).toBeVisible();
  await expect(champ).toBeFocused();
  await page.keyboard.type(' travail');
  await expect(champ).toHaveValue('code du travail');
});
