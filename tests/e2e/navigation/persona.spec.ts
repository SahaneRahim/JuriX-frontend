/**
 * Le profil (persona) : ce que le chat envoie, et ce qu'il propose.
 *
 * CE QUE CE FICHIER PROTÈGE.
 * - Le chat envoyait `persona: "citoyen"` en dur : il ne répondait qu'aux
 *   citoyens. Il envoie désormais le profil de la conversation, et l'omet en
 *   profil général.
 * - Les suggestions étaient figées (« Licenciement abusif »…), dans la
 *   première langue chargée. Elles suivent le profil ET la langue, et un clic
 *   les envoie.
 * - Une conversation rouverte continue avec SON profil.
 *
 * Tout est intercepté : aucun backend requis, aucun quota dépensé. Le profil
 * est posé dans le stockage avant le chargement de la page.
 */

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { SUGGESTIONS } from '../../../src/lib/suggestions';

// Ce fichier part d'un navigateur VIDE : la graine commune de
// playwright.config.ts (un profil citoyen déjà choisi) fausserait ses cas.
test.use({ storageState: { cookies: [], origins: [] } });

/** Le profil choisi, posé avant chaque chargement de page. */
async function profil(page: Page, persona: string) {
  await page.addInitScript((p) => {
    if (!localStorage.getItem('jurix-persona')) localStorage.setItem('jurix-persona', p);
  }, persona);
}

/** « Ne pas répondre » pour cette visite : le profil général, sans question. */
async function profilGeneral(context: BrowserContext) {
  await context.addCookies([{ name: 'jurix-persona-refus', value: '1', url: 'http://localhost:4173' }]);
}

/** Répond en flux et garde le corps de chaque requête. */
async function repondre(page: Page, final: Record<string, unknown> = {}) {
  const corps: Record<string, unknown>[] = [];
  await page.route('**/api/v1/rag/ask/stream', (route) => {
    corps.push(route.request().postDataJSON());
    const evenements = [
      { chunk: 'Selon les textes, ', done: false },
      { chunk: 'voici la réponse.', done: false },
      { chunk: '', done: true, sources: [], confidence: 1, session_id: 'sid-profil', ...final },
    ];
    return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: evenements.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
    });
  });
  return corps;
}

test.describe('Le chat suit le profil', () => {
  test('les suggestions du profil, et un clic les envoie avec le profil', async ({ page }) => {
    await profil(page, 'avocat');
    const corps = await repondre(page, { persona: 'avocat' });

    await page.goto('/chat');
    const puces = page.getByTestId('chat-suggestion');
    await expect(puces.first()).toHaveText(SUGGESTIONS.fr.avocat[0]);
    await expect(page.getByTestId('chat-persona')).toHaveAttribute('data-persona', 'avocat');

    await puces.first().click();

    await expect(page.getByRole('log')).toContainText('voici la réponse');
    expect(corps[0].persona).toBe('avocat');
    expect(corps[0].question).toBe(SUGGESTIONS.fr.avocat[0]);
  });

  test('« étudiant » part en NFC, la forme que le serveur attend', async ({ page }) => {
    await profil(page, 'étudiant');
    const corps = await repondre(page, { persona: 'étudiant' });

    await page.goto('/chat');
    await page.getByTestId('chat-suggestion').first().click();

    await expect(page.getByRole('log')).toContainText('voici la réponse');
    expect(corps[0].persona).toBe('étudiant'.normalize('NFC'));
  });

  test('en profil général, le profil est omis', async ({ page, context }) => {
    await profilGeneral(context);
    const corps = await repondre(page, { persona: 'general' });

    await page.goto('/chat');
    await expect(page.getByTestId('chat-persona')).toHaveAttribute('data-persona', 'general');
    await page.getByTestId('chat-suggestion').first().click();

    await expect(page.getByRole('log')).toContainText('voici la réponse');
    expect('persona' in corps[0]).toBe(false);
  });

  test('les suggestions suivent la langue (l accueil était figé)', async ({ page }) => {
    await profil(page, 'entrepreneur');

    await page.goto('/chat');
    await expect(page.getByTestId('chat-suggestion').first()).toHaveText(SUGGESTIONS.fr.entrepreneur[0]);

    await page.getByTestId('lang-en').click();

    await expect(page.getByTestId('chat-suggestion').first()).toHaveText(SUGGESTIONS.en.entrepreneur[0]);
  });

  test('un refus du profil par le serveur a son propre message', async ({ page }) => {
    await profil(page, 'avocat');
    await page.route('**/api/v1/rag/ask/stream', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ detail: [{ loc: ['body', 'persona'], msg: 'Profil inconnu' }] }),
      }),
    );

    await page.goto('/chat');
    await page.getByTestId('chat-suggestion').first().click();

    await expect(page.getByTestId('chat-error')).toContainText('profil');
  });
});

test.describe('Une conversation rouverte garde son profil', () => {
  /** Un JWT dont seule la charge compte : la signature n'est jamais vérifiée côté client. */
  function jetonValide(): string {
    const charge = { sub: 'rahim@jurix.cm', exp: Math.floor(Date.now() / 1000) + 86_400 };
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(charge)}.signature-non-verifiee`;
  }

  test('rouverte en avocat, elle continue en avocat malgré un profil citoyen', async ({ page }) => {
    await profil(page, 'citoyen');
    await page.addInitScript((jeton) => {
      localStorage.setItem('jurix-auth-token', jeton);
      localStorage.setItem('jurix-auth-user', JSON.stringify({ id: 7, email: 'rahim@jurix.cm', role: 'user' }));
    }, jetonValide());
    const conversation = {
      session_id: 'sid-1', title: 'Abus de confiance', persona: 'avocat', language: 'fr',
      created_at: '2026-10-01T10:00:00', updated_at: '2026-10-01T10:05:00',
    };
    await page.route('**/api/v1/rag/conversations', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([conversation]) }),
    );
    await page.route('**/api/v1/rag/conversations/sid-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...conversation,
          messages: [
            { id: 1, role: 'user', content: 'Éléments constitutifs ?', created_at: '2026-10-01T10:00:00' },
            { id: 2, role: 'assistant', content: 'Selon l’article 318 du Code Pénal…', created_at: '2026-10-01T10:00:05' },
          ],
        }),
      }),
    );
    // La synchronisation du compte au démarrage ne doit pas changer le profil global ici.
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ persona: 'citoyen' }) }),
    );
    const corps = await repondre(page, { persona: 'avocat', session_id: 'sid-1' });

    await page.goto('/chat');
    await page.getByTestId('conversation-item').first().click();
    await expect(page.getByTestId('chat-persona')).toHaveAttribute('data-persona', 'avocat');

    const champ = page.getByRole('textbox').first();
    await champ.fill('Et la tentative ?');
    await champ.press('Enter');

    await expect(page.getByRole('log')).toContainText('voici la réponse');
    expect(corps[0].persona).toBe('avocat');
    expect(corps[0].session_id).toBe('sid-1');
  });
});
