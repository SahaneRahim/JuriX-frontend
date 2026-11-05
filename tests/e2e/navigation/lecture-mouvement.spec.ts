/**
 * Le mouvement de la page de lecture (refonte A, PASSATION E5) : l'article qui
 * glisse, la note de l'IA calée sur son passage, et ce qui reste quand rien ne
 * bouge.
 *
 * POURQUOI CE FICHIER EXISTE. Chacune de ces garanties est invisible en lecture
 * de code : une animation qui rejoue à l'hydratation, une colonne qui fait
 * défiler un téléphone de 320 px, un trait qui vise la mauvaise ligne quand
 * Literata arrive, une note qui pousse le texte, un contenu qui reste caché en
 * mouvement réduit ou sans JavaScript. Les tests unitaires n'ont ni mise en
 * page ni animation : seul un vrai navigateur les voit.
 *
 * DONNÉES. Le texte vient de la vraie API (rendu serveur, `page.route` n'en
 * voit pas l'appel) : le fichier est sauté quand elle est éteinte, sauf avec
 * E2E_EXIGER_BACKEND=1. L'appel d'`explain-article`, lui, part du navigateur :
 * il est simulé, modèle compris. Les passages n'existent pas encore côté API
 * (décision L2, PASSATION § 9, B3) : ils ne sont ici que dans la réponse
 * simulée.
 *
 * Lancer : npx playwright test tests/e2e/navigation/lecture-mouvement.spec.ts
 */

import { expect, test, type Page, type Route } from '@playwright/test';

import { attendreLeRepos, exiger, ouvrirAuServeur, saisieDuChat } from '../doublures';
import { cliquerJusqualEffet } from '../hydratation';
import { loiAvecArticles } from '../pages-du-site';

const suivant = (page: Page) => page.locator('.article-navigation button').last();
const precedent = (page: Page) => page.locator('.article-navigation button').first();
const corps = (page: Page) => page.locator('article.article .article-content');
const titreDeLArticle = (page: Page) => page.locator('article.article h2');

/** La réponse d'`explain-article`, sans passer par le modèle. */
function repondre(page: Page, reponse: Record<string, unknown>, delaiMs = 0) {
  return page.route('**/api/v1/laws/*/explain-article', async (route: Route) => {
    if (delaiMs) await new Promise((fini) => setTimeout(fini, delaiMs));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reponse) });
  });
}

/**
 * Retient le nom de chaque animation CSS qui démarre, dès le début du chargement.
 *
 * POURQUOI UN JOURNAL, ET PAS `getAnimations()`. Sur une machine chargée, lire
 * l'animation en cours après le clic peut arriver après ses 550 ms ; et rien ne
 * dirait alors si une animation a joué pendant l'hydratation, avant la lecture.
 * `animationstart` remonte jusqu'au document et ne manque rien.
 */
function tenirLeJournal(page: Page) {
  return page.addInitScript(() => {
    const journal: string[] = [];
    (window as unknown as { journal: string[] }).journal = journal;
    document.addEventListener('animationstart', (event) => journal.push(event.animationName), true);
  });
}

/** Le journal depuis le dernier appel, vidé : ce que le geste qui précède a fait jouer. */
const lireLeJournal = (page: Page) =>
  page.evaluate(() => (window as unknown as { journal: string[] }).journal.splice(0));

/** Les glissements du journal. Le temps d'une image après le geste : l'événement la suit. */
async function glissements(page: Page): Promise<string[]> {
  await page.evaluate(() => new Promise((fini) => requestAnimationFrame(() => requestAnimationFrame(fini))));
  return (await lireLeJournal(page)).filter((nom) => nom.startsWith('mv-feuilleter-'));
}

/** « Suivant », répété tant que Svelte n'a pas la main (tests/e2e/hydratation.ts). */
async function suivantJusqualAdresse(page: Page): Promise<void> {
  await expect(async () => {
    await suivant(page).click();
    await expect(page).toHaveURL(/[?&]article=/, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/** Le centre vertical du trait de la note, et celui de la première ligne du passage. */
const mesurerLAncrage = (page: Page) =>
  page.evaluate(() => {
    const note = document.querySelector('.ai-explanation') as HTMLElement;
    const passage = document.querySelector('mark.passage-cle') as HTMLElement;
    const trait = getComputedStyle(note, '::before');
    return {
      trait:
        trait.content === 'none'
          ? null
          : note.getBoundingClientRect().top + parseFloat(trait.top) + parseFloat(trait.height) / 2,
      passage: (() => {
        const ligne = passage.getClientRects()[0];
        return ligne.top + ligne.height / 2;
      })(),
    };
  });

let id: number;

test.beforeEach(async ({ request }) => {
  const trouve = await loiAvecArticles(request);
  exiger(trouve, 'aucune loi avec des articles : API injoignable ou corpus vide');
  id = trouve as number;
});

test.describe('Mouvement réduit : rien ne bouge, tout est là', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await tenirLeJournal(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('au chargement, après « Suivant » et pendant « Expliquer »', async ({ page }) => {
    await repondre(page, { explanation: 'Premier paragraphe.\n\nSecond paragraphe.' }, 2_000);
    await ouvrirAuServeur(page, `/laws/${id}`);
    await attendreLeRepos(page);

    await expect(page.getByTestId('law-status')).toBeVisible();
    await expect(page.locator('.ai-explanation')).toBeVisible();
    await expect(page.locator('.ai-explanation')).toHaveCSS('opacity', '1');

    await suivantJusqualAdresse(page);
    await expect(corps(page)).toBeVisible();
    await expect(page.locator('.feuille')).toHaveCSS('opacity', '1');

    await page.getByTestId('law-explain').click();
    await expect(page.getByTestId('law-explain-loading')).toBeVisible();
    await expect(page.getByTestId('law-explain-answer')).toContainText('Second paragraphe.');

    // Rien, de bout en bout : ni tampon, ni note, ni glissement, ni balance.
    expect(await lireLeJournal(page)).toEqual([]);
    const enCours = await page.evaluate(() =>
      document.getAnimations().filter((animation) => animation instanceof CSSAnimation).length,
    );
    expect(enCours).toBe(0);
  });
});

test.describe('Feuilleter : l’article glisse dans le sens de la lecture', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await tenirLeJournal(page);
  });

  test('« Suivant » puis « Précédent », jamais à l’arrivée par l’adresse', async ({ page }) => {
    await ouvrirAuServeur(page, `/laws/${id}`);
    await attendreLeRepos(page);
    // Le premier affichage ne glisse pas.
    expect(await glissements(page)).toEqual([]);

    await suivantJusqualAdresse(page);
    expect((await glissements(page)).join()).toMatch(/^mv-feuilleter-suivant-[ab]$/);

    await precedent(page).click();
    expect((await glissements(page)).join()).toMatch(/^mv-feuilleter-precedent-[ab]$/);

    // Deux gestes de suite dans le même sens : l'autre nom, ou rien ne rejouerait.
    await suivant(page).click();
    const [premier] = await glissements(page);
    await suivant(page).click();
    const [second] = await glissements(page);
    expect(premier).toMatch(/^mv-feuilleter-suivant-[ab]$/);
    expect(second).toMatch(/^mv-feuilleter-suivant-[ab]$/);
    expect(second).not.toBe(premier);

    const numero = new URL(page.url()).searchParams.get('article');
    exiger(numero, 'pas d’article dans l’adresse');
    await page.goto('about:blank');
    await page.goto(`/laws/${id}?article=${numero}`);
    await expect(titreDeLArticle(page)).toContainText(`Article ${numero}`, { timeout: 15_000 });
    await attendreLeRepos(page);
    expect(await glissements(page)).toEqual([]);
    await expect(page.locator('.feuille')).not.toHaveClass(/mv-feuilleter-/);
  });

  test('l’article n’est pas recréé : le titre survit, et le bouton garde le focus', async ({ page }) => {
    await ouvrirAuServeur(page, `/laws/${id}`);
    await suivantJusqualAdresse(page);
    const titre = await titreDeLArticle(page).elementHandle();
    await suivant(page).click();
    expect(await titre?.evaluate((h2) => h2.isConnected)).toBe(true);
    await expect(suivant(page)).toBeFocused();
  });
});

test.describe('Sur un téléphone de 320 px', () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });

  test('aucun défilement horizontal, ni au repos ni pendant le glissement', async ({ page }) => {
    await tenirLeJournal(page);
    await ouvrirAuServeur(page, `/laws/${id}`);
    await attendreLeRepos(page);
    const repos = await page.evaluate(() => ({ contenu: document.documentElement.scrollWidth, ecran: innerWidth }));
    expect(repos.contenu).toBeLessThanOrEqual(repos.ecran + 1);

    // Un premier geste : Svelte a la main, et l'adresse suit.
    await suivantJusqualAdresse(page);
    await attendreLeRepos(page);
    await lireLeJournal(page);

    // La largeur de la page, image par image, pendant tout le glissement.
    const largeurMaximale = await page.evaluate(
      () =>
        new Promise<number>((fini) => {
          const boutons = document.querySelectorAll<HTMLButtonElement>('.article-navigation button');
          boutons[boutons.length - 1].click();
          const debut = performance.now();
          let maximum = 0;
          const image = () => {
            maximum = Math.max(maximum, document.documentElement.scrollWidth);
            if (performance.now() - debut < 700) requestAnimationFrame(image);
            else fini(maximum);
          };
          requestAnimationFrame(image);
        }),
    );
    expect((await glissements(page)).join()).toMatch(/^mv-feuilleter-suivant-[ab]$/);
    expect(largeurMaximale).toBeLessThanOrEqual(repos.ecran + 1);
  });

  test('les puces défilent dans leurs limites, et « Sommaire » ouvre le sommaire complet', async ({ page }) => {
    await ouvrirAuServeur(page, `/laws/${id}`);
    await attendreLeRepos(page);
    const puces = page.getByRole('list', { name: 'Articles de la section' });
    await expect(puces).toBeVisible();
    await expect(puces.getByRole('link').first()).toHaveCSS('height', '44px');

    await cliquerJusqualEffet(page.getByTestId('law-toc-toggle'), page.getByRole('dialog', { name: 'Table des matières' }));
    await expect(page.getByPlaceholder('Filtrer les articles…')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Table des matières' })).toHaveCount(0);
    await expect(puces).toBeVisible();
    await expect(page.getByTestId('law-toc-toggle')).toBeFocused();
  });
});

test.describe('La note de l’IA, calée sur son passage', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /** Ouvre la loi, et simule une réponse dont le passage est le début du deuxième paragraphe, ou du premier. */
  async function ouvrirAvecUnPassage(page: Page) {
    await ouvrirAuServeur(page, `/laws/${id}`);
    await attendreLeRepos(page);
    const paragraphes = (await corps(page).locator('p').allTextContents()).map((p) => p.trim()).filter(Boolean);
    exiger(paragraphes.length > 0, 'article sans texte');
    const passage = (paragraphes[1] ?? paragraphes[0]).slice(0, 48);
    await repondre(page, { explanation: 'Premier paragraphe.', passages: [{ texte: passage, role: 'cle' }] });
    return passage;
  }

  test('le trait tombe sur la première ligne du passage, et le texte ne bouge pas', async ({ page }) => {
    const passage = await ouvrirAvecUnPassage(page);
    const avant = await corps(page).evaluate((element) => {
      const { top, left, width } = element.getBoundingClientRect();
      return { top: top + scrollY, left, width };
    });

    await cliquerJusqualEffet(page.getByTestId('law-explain'), page.locator('mark.passage-cle'));
    await expect(page.locator('mark.passage-cle')).toContainText(passage.slice(0, 20));
    await expect(page.locator('.ai-explanation')).toHaveClass(/\bancree\b/);
    await attendreLeRepos(page);

    await expect
      .poll(async () => {
        const { trait, passage: ligne } = await mesurerLAncrage(page);
        return trait === null ? Number.POSITIVE_INFINITY : Math.abs(trait - ligne);
      })
      .toBeLessThanOrEqual(2);

    // Le texte de l'article n'a pas bougé d'un pixel : ni la note ni le surlignage.
    const apres = await corps(page).evaluate((element) => {
      const { top, left, width } = element.getBoundingClientRect();
      return { top: top + scrollY, left, width };
    });
    expect(apres).toEqual(avant);

    // Toujours juste une fois les polices arrivées.
    await page.evaluate(() => document.fonts.ready);
    const { trait, passage: ligne } = await mesurerLAncrage(page);
    expect(Math.abs((trait as number) - ligne)).toBeLessThanOrEqual(2);
  });

  test('sous 1 280 px, la note passe sous le texte, sans trait ; elle retrouve son passage au retour', async ({ page }) => {
    await ouvrirAvecUnPassage(page);
    await cliquerJusqualEffet(page.getByTestId('law-explain'), page.locator('mark.passage-cle'));
    await expect(page.locator('.ai-explanation')).toHaveClass(/\bancree\b/);

    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(page.locator('.ai-explanation')).not.toHaveClass(/\bancree\b/);
    expect((await mesurerLAncrage(page)).trait).toBeNull();
    const boites = await page.evaluate(() => ({
      lecture: (document.querySelector('.lecture') as HTMLElement).getBoundingClientRect().bottom,
      note: (document.querySelector('.ai-explanation') as HTMLElement).getBoundingClientRect().top,
    }));
    expect(boites.note).toBeGreaterThanOrEqual(boites.lecture);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('.ai-explanation')).toHaveClass(/\bancree\b/);
    const ecart = async () => {
      const { trait, passage } = await mesurerLAncrage(page);
      return trait === null ? Number.POSITIVE_INFINITY : Math.abs(trait - passage);
    };
    await expect.poll(ecart).toBeLessThanOrEqual(2);

    // Détruite par le texte entier, l'action repart de zéro au retour.
    await page.getByTestId('law-mode-texte').click();
    await expect(page.getByTestId('law-full-text')).toBeVisible();
    await page.getByTestId('law-mode-article').click();
    await expect(page.locator('.ai-explanation')).toHaveClass(/\bancree\b/);
    await expect.poll(ecart).toBeLessThanOrEqual(2);
  });

  test('sans passage (la v1) : la note reste en haut de la marge, sans trait ni surlignage', async ({ page }) => {
    await repondre(page, { explanation: 'Premier paragraphe.' });
    await ouvrirAuServeur(page, `/laws/${id}`);
    await attendreLeRepos(page);
    const marge = await page.locator('.rail').boundingBox();
    const rangee = await page.locator('.rangee').boundingBox();
    expect(Math.abs((marge?.y ?? 0) - (rangee?.y ?? 0))).toBeLessThanOrEqual(1);

    await cliquerJusqualEffet(page.getByTestId('law-explain'), page.getByTestId('law-explain-answer'));
    await expect(corps(page).locator('mark')).toHaveCount(0);
    await expect(page.locator('.ai-explanation')).not.toHaveClass(/\bancree\b/);
    const trait = await page
      .locator('.ai-explanation')
      .evaluate((note) => getComputedStyle(note, '::before').content);
    expect(trait).toBe('none');
  });

  test('la note est à droite du texte à partir de 1 280 px, le sommaire à gauche, et le repère sur l’article lu', async ({
    page,
  }) => {
    await ouvrirAuServeur(page, `/laws/${id}`);
    await attendreLeRepos(page);
    const [sommaire, lecture, note] = await Promise.all(
      ['#sommaire', '.article-content', '.ai-explanation'].map((selecteur) => page.locator(selecteur).boundingBox()),
    );
    expect(sommaire?.width).toBe(200);
    expect(note?.width).toBe(280);
    expect((sommaire?.x ?? 0) + 200).toBeLessThan(lecture?.x ?? 0);
    expect((lecture?.x ?? 0) + (lecture?.width ?? 0)).toBeLessThan(note?.x ?? 0);

    const repere = await page.evaluate(() => {
      const trait = document.querySelector('.repere') as HTMLElement;
      const lu = document.querySelector('#sommaire [aria-current="location"]') as HTMLElement;
      return { trait: trait.getBoundingClientRect().top, lu: lu.getBoundingClientRect().top };
    });
    expect(Math.abs(repere.trait - repere.lu)).toBeLessThanOrEqual(1);
  });
});

test.describe('Sans JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });

  test('le premier article, le statut, la note au repos et « Poser une question »', async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', (erreur) => erreurs.push(erreur.message));
    await ouvrirAuServeur(page, `/laws/${id}`);

    await expect(titreDeLArticle(page)).toBeVisible();
    await expect(corps(page)).not.toBeEmpty();
    await expect(page.getByTestId('law-status')).toBeVisible();
    await expect(page.locator('.ai-explanation')).toContainText('Explication simplifiée (IA)');
    await expect(page.getByTestId('law-explain')).toBeVisible();
    const lien = page.getByTestId('law-ask');
    await expect(lien).toBeVisible();
    await expect(lien).toHaveAttribute('href', /^\/chat\?q=/);
    // Rien n'attend le JavaScript, et le serveur rend la note non ancrée.
    await expect(page.locator('.ai-explanation')).not.toHaveClass(/\bancree\b/);
    await expect(page.locator('.feuille')).not.toHaveClass(/mv-feuilleter-/);
    expect(erreurs).toEqual([]);
  });
});

test.describe('« Poser une question sur cet article »', () => {
  test('ouvre l’assistant, la question pré-remplie, et rien n’est envoyé', async ({ page }) => {
    const envois: string[] = [];
    await page.route('**/api/v1/rag/ask/stream', async (route) => {
      envois.push(route.request().url());
      await route.abort();
    });
    await ouvrirAuServeur(page, `/laws/${id}`);
    const lien = page.getByTestId('law-ask');
    const adresse = (await lien.getAttribute('href')) ?? '';
    expect(adresse).toMatch(/^\/chat\?q=/);
    expect(adresse).not.toContain('envoyer');
    const question = new URL(adresse, 'http://localhost').searchParams.get('q') ?? '';
    expect(question).toMatch(/^Que dit l’article /);

    await lien.click();
    await expect(page).toHaveURL(/\/chat/);
    await expect(saisieDuChat(page)).toHaveValue(question, { timeout: 15_000 });
    await attendreLeRepos(page);
    expect(envois).toEqual([]);
  });
});
