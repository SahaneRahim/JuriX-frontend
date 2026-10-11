/**
 * Le profil (persona) : la question d'entrée, sa mémoire, et ce que le chat
 * envoie et propose.
 *
 * CE QUE CE FICHIER PROTÈGE.
 * - Le chat envoyait `persona: "citoyen"` en dur : il ne répondait qu'aux
 *   citoyens. Il envoie désormais le profil de la conversation, et l'omet en
 *   profil général.
 * - Les suggestions étaient figées (« Licenciement abusif »…), dans la
 *   première langue chargée. Elles suivent le profil ET la langue, et un clic
 *   les envoie.
 * - Une conversation rouverte continue avec SON profil ; changer de profil en
 *   pleine conversation en ouvre une nouvelle.
 * - La question est posée à la première visite, jamais sur les pages de
 *   compte ni d'administration. Un choix est gardé ; un refus vaut pour la
 *   visite (cookie de session), nouveaux onglets compris.
 * - Le profil suit le compte : adopté au démarrage, envoyé à chaque
 *   changement.
 *
 * Tout est intercepté : aucun backend requis, aucun quota dépensé. Le profil
 * est posé dans le stockage avant le chargement de la page.
 */

import AxeBuilder from '@axe-core/playwright';
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

/**
 * Répond en flux et garde le corps de chaque requête. Comme le serveur, le
 * dernier événement renvoie le profil de la conversation : celui de la
 * requête, `general` s'il est omis.
 */
async function repondre(page: Page, final: Record<string, unknown> = {}) {
  const corps: Record<string, unknown>[] = [];
  await page.route('**/api/v1/rag/ask/stream', (route) => {
    const demande = route.request().postDataJSON();
    corps.push(demande);
    const evenements = [
      { chunk: 'Selon les textes, ', done: false },
      { chunk: 'voici la réponse.', done: false },
      {
        chunk: '', done: true, sources: [], confidence: 1, session_id: 'sid-profil',
        persona: demande.persona ?? 'general', ...final,
      },
    ];
    return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: evenements.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
    });
  });
  return corps;
}

/** Un JWT dont seule la charge compte : la signature n'est jamais vérifiée côté client. */
function jetonValide(): string {
  const charge = { sub: 'rahim@jurix.cm', exp: Math.floor(Date.now() / 1000) + 86_400 };
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(charge)}.signature-non-verifiee`;
}

/** Une session ouverte, posée avant chaque chargement de page. */
async function connecte(page: Page, role = 'user') {
  await page.addInitScript(
    ({ jeton, role }) => {
      localStorage.setItem('jurix-auth-token', jeton);
      localStorage.setItem('jurix-auth-user', JSON.stringify({ id: 7, email: 'rahim@jurix.cm', role }));
    },
    { jeton: jetonValide(), role },
  );
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
  test('rouverte en avocat, elle continue en avocat malgré un profil citoyen', async ({ page }) => {
    await profil(page, 'citoyen');
    await connecte(page);
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

test.describe('La question « Qui êtes-vous ? »', () => {
  test('posée à la première visite, sur l accueil comme sur une page profonde', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('persona-dialog')).toHaveAttribute('data-mode', 'accueil');

    await page.goto('/about');
    await expect(page.getByTestId('persona-dialog')).toBeVisible();
  });

  for (const chemin of ['/login', '/signup', '/forgot-password', '/reset-password/jeton-x', '/verify-email/jeton-x', '/admin']) {
    test(`jamais posée sur ${chemin}`, async ({ page }) => {
      await page.goto(chemin);
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('persona-dialog')).toHaveCount(0);
    });
  }

  for (const theme of ['light', 'dark']) {
    test(`accessible, ouverte, en thème ${theme}`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('jurix-theme', t), theme);
      await page.goto('/');
      await expect(page.getByTestId('persona-dialog')).toBeVisible();

      const resultats = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const graves = resultats.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

      expect(graves, graves.map((v) => `${v.id} — ${v.nodes.length} noeud(s)`).join('\n')).toEqual([]);
    });
  }

  test('un choix est gardé : rechargement et nouvel onglet', async ({ page, context }) => {
    await page.goto('/');
    await page.getByTestId('persona-choice-entrepreneur').click();
    await expect(page.getByTestId('persona-dialog')).toHaveCount(0);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('persona-dialog')).toHaveCount(0);

    const autre = await context.newPage();
    await autre.goto('/about');
    await autre.waitForLoadState('networkidle');
    await expect(autre.getByTestId('persona-dialog')).toHaveCount(0);
    expect(await autre.evaluate(() => localStorage.getItem('jurix-persona'))).toBe('entrepreneur');
  });

  test('un refus vaut pour la visite, nouveaux onglets compris, et revient à la suivante', async ({ page, context, browser, baseURL }) => {
    await page.goto('/');
    await page.getByTestId('persona-skip').click();
    await expect(page.getByTestId('persona-dialog')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('jurix-persona'))).toBeNull();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('persona-dialog')).toHaveCount(0);

    // Même visite, nouvel onglet : le cookie de session est partagé.
    const onglet = await context.newPage();
    await onglet.goto('/laws');
    await onglet.waitForLoadState('networkidle');
    await expect(onglet.getByTestId('persona-dialog')).toHaveCount(0);

    // Visite suivante : nouveau navigateur, la question revient.
    const suivante = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const nouvelle = await suivante.newPage();
    await nouvelle.goto('/');
    await expect(nouvelle.getByTestId('persona-dialog')).toBeVisible();
    await suivante.close();
  });

  test('Échap vaut « Ne pas répondre », et la première tabulation atteint le lien d évitement', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('persona-dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('persona-dialog')).toHaveCount(0);

    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveAttribute('href', '#contenu');
  });

  test('sur mobile, le profil se change depuis le menu', async ({ page }) => {
    await profil(page, 'citoyen');
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/about');

    await page.getByTestId('nav-mobile-toggle').click();
    await page.getByTestId('persona-toggle-mobile').click();

    await expect(page.getByTestId('persona-dialog')).toHaveAttribute('data-mode', 'changement');
  });
});

test.describe('Changer de profil', () => {
  test('en pleine conversation, un nouveau profil démarre une conversation neuve', async ({ page }) => {
    await profil(page, 'citoyen');
    const corps = await repondre(page);

    await page.goto('/chat');
    const champ = page.getByRole('textbox').first();
    await champ.fill('Quelles sont les sanctions ?');
    await champ.press('Enter');
    await expect(page.getByRole('log')).toContainText('voici la réponse');
    expect(await page.evaluate(() => localStorage.getItem('jurix-chat-session'))).toBe('sid-profil');

    await page.getByTestId('persona-toggle').click();
    await page.getByTestId('persona-choice-avocat').click();

    await expect(page.getByTestId('chat-persona')).toHaveAttribute('data-persona', 'avocat');
    await expect(page.getByRole('log')).not.toContainText('Quelles sont les sanctions ?');
    await expect(page.getByTestId('chat-suggestion').first()).toHaveText(SUGGESTIONS.fr.avocat[0]);
    expect(await page.evaluate(() => localStorage.getItem('jurix-chat-session'))).toBeNull();

    await page.getByTestId('chat-suggestion').first().click();
    await expect.poll(() => corps.length).toBe(2);
    expect(corps[1].persona).toBe('avocat');
    expect('session_id' in corps[1]).toBe(false);
  });

  test('Échap ferme sans rien changer et rend le focus au bouton', async ({ page }) => {
    await profil(page, 'étudiant');
    await page.goto('/about');

    await page.getByTestId('persona-toggle').click();
    await expect(page.getByTestId('persona-dialog')).toHaveAttribute('data-mode', 'changement');
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('persona-dialog')).toHaveCount(0);
    await expect(page.getByTestId('persona-toggle')).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem('jurix-persona'))).toBe('étudiant');
  });
});

test.describe('Le profil suit le compte', () => {
  test('au démarrage, le profil du compte est adopté, sans question', async ({ page }) => {
    await connecte(page);
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ persona: 'entrepreneur' }) }),
    );

    await page.goto('/about');

    await expect(page.getByTestId('persona-toggle')).toHaveAttribute('aria-label', /Entrepreneur/);
    await expect(page.getByTestId('persona-dialog')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('jurix-persona'))).toBe('entrepreneur');
  });

  test('connecté, un changement part sur le compte', async ({ page }) => {
    await connecte(page);
    const envois: unknown[] = [];
    await page.route('**/api/v1/auth/me', (route) => {
      if (route.request().method() === 'PATCH') {
        envois.push(route.request().postDataJSON());
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ persona: 'avocat' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ persona: 'citoyen' }) });
    });

    await page.goto('/about');
    await page.getByTestId('persona-toggle').click();
    await page.getByTestId('persona-choice-avocat').click();

    await expect.poll(() => envois.length).toBe(1);
    expect(envois[0]).toEqual({ persona: 'avocat' });
  });
});

test.describe('Le tableau de bord', () => {
  test('compte les conversations par profil, profil général compris', async ({ page }) => {
    await connecte(page, 'admin');
    const reponses: Record<string, unknown> = {
      '/analytics/overview': { total_laws: 0, by_language: {}, recent_laws: 0 },
      '/analytics/usage': {
        window_days: 7, conversations: 4, questions_asked: 0, answers_generated: 0,
        searches: 0, active_users: 1, median_answer_time_ms: 0,
        // « étudiant » en NFD, comme une ligne écrite avant la normalisation.
        personas_usage: { avocat: 2, general: 1, 'e\u0301tudiant': 1 },
      },
      '/analytics/search': {
        window_days: 7, total_searches: 0, median_response_time_ms: 0,
        p95_response_time_ms: 0, max_response_time_ms: 0, cache_hit_rate_percent: 0,
      },
      '/laws/': [],
      '/auth/me': { persona: null },
    };
    await page.route('**/api/v1/**', (route) => {
      const chemin = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1/, '');
      const corps = reponses[chemin];
      return corps === undefined
        ? route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
        : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
    });

    await page.goto('/admin');

    const lignes = page.getByTestId('admin-profil');
    await expect(lignes).toHaveCount(3);
    await expect(lignes.nth(0)).toHaveAttribute('data-profil', 'avocat');
    await expect(lignes.nth(0)).toContainText('50');
    await expect(lignes.nth(1)).toHaveAttribute('data-profil', 'étudiant');
    await expect(lignes.nth(2)).toContainText('Profil général');
    await expect(page.getByTestId('persona-dialog')).toHaveCount(0);
  });
});
