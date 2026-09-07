/**
 * Panneau des conversations — la raison d'être du compte.
 *
 * DÉTAIL PRATIQUE INDISPENSABLE : le faux jeton posé par `addInitScript` doit
 * être un vrai triplet base64 dont la charge porte un `exp` lointain.
 * `jetonExpire()` (src/lib/stores/auth.ts) décode `token.split('.')[1]` par
 * `atob` et compare `exp` : un jeton bidon serait jugé périmé, l'état
 * réhydraté serait anonyme, et la page ne montrerait jamais le panneau.
 *
 * Les appels sont interceptés : aucun backend requis, aucun quota dépensé.
 */

import { expect, test, type Page } from '@playwright/test';
import { cliquerJusqualEffet } from '../hydratation';

/** Un JWT dont seule la charge compte : la signature n'est jamais vérifiée côté client. */
function jetonValide(): string {
  const charge = { sub: 'rahim@jurix.cm', exp: Math.floor(Date.now() / 1000) + 86_400 };
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(charge)}.signature-non-verifiee`;
}

const UTILISATEUR = { id: 7, email: 'rahim@jurix.cm', role: 'user', name: 'Rahim Sahane' };

const CONVERSATIONS = [
  {
    session_id: 'sid-1',
    title: 'Conditions du permis de recherche',
    persona: 'citoyen',
    language: 'fr',
    created_at: '2026-09-07T10:00:00',
    updated_at: '2026-09-07T12:00:00',
  },
  {
    session_id: 'sid-2',
    title: null,
    persona: 'citoyen',
    language: 'fr',
    created_at: '2026-09-06T10:00:00',
    updated_at: '2026-09-06T11:00:00',
  },
];

const DETAIL = {
  ...CONVERSATIONS[0],
  messages: [
    { id: 1, role: 'user', content: 'Quelles sont les conditions ?', created_at: '2026-09-07T10:00:00' },
    { id: 2, role: 'assistant', content: 'Selon l’article 33 du Code Minier…', created_at: '2026-09-07T10:00:05' },
  ],
};

async function connecter(page: Page) {
  await page.addInitScript(
    ([jeton, utilisateur]) => {
      localStorage.setItem('jurix-auth-token', jeton as string);
      localStorage.setItem('jurix-auth-user', JSON.stringify(utilisateur));
    },
    [jetonValide(), UTILISATEUR] as const,
  );
}

async function intercepter(page: Page) {
  await page.route('**/api/v1/rag/conversations', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CONVERSATIONS),
    }),
  );
  await page.route('**/api/v1/rag/conversations/sid-1', (route) =>
    route.request().method() === 'DELETE'
      ? route.fulfill({ status: 204, body: '' })
      : route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(DETAIL),
        }),
  );
  await page.route('**/api/v1/rag/conversations/sid-2', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
}

test.describe('Conversations', () => {
  test('la liste s’affiche pour un compte connecté', async ({ page }) => {
    await connecter(page);
    await intercepter(page);

    await page.goto('/chat');

    await expect(page.getByTestId('conversations-panel')).toBeVisible();
    await expect(page.getByTestId('conversation-item').first()).toContainText(
      'Conditions du permis de recherche',
    );
    // Une conversation sans titre affiche un repli, pas un vide.
    await expect(page.getByTestId('conversation-item').nth(1)).not.toBeEmpty();
  });

  test('le panneau n’existe pas pour un visiteur anonyme', async ({ page }) => {
    await intercepter(page);

    await page.goto('/chat');

    await expect(page.getByTestId('conversations-panel')).toHaveCount(0);
    // Et le chat reste utilisable : le compte n'ajoute que la mémoire.
    await expect(page.locator('input[type="text"], textarea').first()).toBeVisible();
    await expect(page.getByTestId('chat-signup-link')).toBeVisible();
  });

  test('cliquer sur une conversation la rouvre', async ({ page }) => {
    await connecter(page);
    await intercepter(page);
    await page.goto('/chat');

    await cliquerJusqualEffet(
      page.getByTestId('conversation-item').first(),
      page.getByText('Selon l’article 33 du Code Minier…'),
    );

    await expect(page.getByText('Quelles sont les conditions ?')).toBeVisible();
    // Le fil est mémorisé pour le prochain chargement.
    const session = await page.evaluate(() => localStorage.getItem('jurix-chat-session'));
    expect(session).toBe('sid-1');
  });

  test('supprimer retire la conversation de la liste', async ({ page }) => {
    await connecter(page);
    await intercepter(page);
    await page.goto('/chat');
    await expect(page.getByTestId('conversation-item')).toHaveCount(2);

    await page.getByTestId('conversation-delete').first().click();

    await expect(page.getByTestId('conversation-item')).toHaveCount(1);
  });

  test('« Nouvelle conversation » oublie le fil courant', async ({ page }) => {
    await connecter(page);
    await intercepter(page);
    await page.goto('/chat');
    await cliquerJusqualEffet(
      page.getByTestId('conversation-item').first(),
      page.getByText('Selon l’article 33 du Code Minier…'),
    );

    await page.getByTestId('chat-new').click();

    const session = await page.evaluate(() => localStorage.getItem('jurix-chat-session'));
    expect(session).toBeNull();
    await expect(page.getByText('Selon l’article 33 du Code Minier…')).toHaveCount(0);
  });

  test('une liste inaccessible s’annonce et se réessaie', async ({ page }) => {
    await connecter(page);
    await page.route('**/api/v1/rag/conversations', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    );

    await page.goto('/chat');

    const erreur = page.getByTestId('conversations-error');
    await expect(erreur).toHaveAttribute('role', 'alert');
    await expect(page.getByTestId('conversations-retry')).toBeVisible();
  });
});
