/**
 * Invariants d'accessibilité, vérifiés page par page.
 *
 * Ce spec ne cherche pas à couvrir toute l'accessibilité : il verrouille les
 * défauts précis qui existaient et qui, sans garde, reviendront. Chacun était
 * invisible à la relecture parce qu'il ne se manifeste qu'au clavier ou au
 * lecteur d'écran :
 *
 *  - aucun `aria-live` dans tout le projet : après une recherche, rien n'était
 *    annoncé — ni le départ de la requête, ni le nombre de résultats ;
 *  - les 36 `<span class="material-icons">` faisaient lire leur ligature à voix
 *    haute (« send », « menu », « balance ») au milieu d'une interface
 *    française ;
 *  - `/chat` et `/login` n'avaient aucun titre, de h1 à h6 ;
 *  - `<html lang="fr">` était figé alors que l'interface bascule FR/EN ;
 *  - aucun lien d'évitement : atteindre le contenu au clavier demandait de
 *    traverser toute la navigation, à chaque page.
 */

import { expect, test } from '@playwright/test';

const PAGES_PUBLIQUES = [
  '/',
  '/chat',
  '/laws',
  '/about',
  '/search?q=loi',
  '/login',
  '/compare',
  '/signup',
];

test.describe('Structure des pages', () => {
  for (const chemin of PAGES_PUBLIQUES) {
    test(`${chemin} : un h1, un main, un titre`, async ({ page }) => {
      await page.goto(chemin);

      // Exactement un h1 : /chat et /login n'en avaient aucun, et le h1 du
      // layout est masqué sur /chat depuis que le hero y est caché.
      await expect(page.locator('h1')).toHaveCount(1);

      // Repère principal : six pages sur onze n'avaient pas de <main>, ce qui
      // prive du saut direct au contenu.
      await expect(page.locator('main')).toHaveCount(1);

      await expect(page).toHaveTitle(/.+/);
    });
  }
});

test.describe('Lien d’évitement', () => {
  test('la première tabulation atteint le contenu', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Tab');
    const premier = page.locator(':focus');
    await expect(premier).toHaveAttribute('href', '#contenu');
    // Masqué tant qu'il n'a pas le focus, visible dès qu'il l'a.
    await expect(premier).toBeVisible();
  });
});

test.describe('Cible du lien d’évitement', () => {
  for (const chemin of PAGES_PUBLIQUES) {
    test(`${chemin} : #contenu existe`, async ({ page }) => {
      await page.goto(chemin);
      // Un lien d'evitement sans ancre correspondante ne mene nulle part : il
      // donne l'illusion du raccourci sans le rendre. Cinq pages sur huit
      // etaient dans ce cas.
      await expect(page.locator('#contenu')).toHaveCount(1);
    });
  }
});

test.describe('Icônes décoratives', () => {
  for (const chemin of ['/', '/search?q=loi', '/laws']) {
    test(`${chemin} : aucune ligature lue à voix haute`, async ({ page }) => {
      await page.goto(chemin);

      // Une ligature Material Icons est du TEXTE : sans aria-hidden, un lecteur
      // d'écran annonce « search », « menu », « balance » au fil de la page.
      const exposees = await page
        .locator('.material-icons:not([aria-hidden="true"])')
        .count();
      expect(exposees, `${exposees} icône(s) encore annoncée(s)`).toBe(0);
    });
  }
});

test.describe('Noms accessibles', () => {
  for (const chemin of PAGES_PUBLIQUES) {
    test(`${chemin} : aucun lien ni bouton anonyme`, async ({ page }) => {
      await page.goto(chemin);

      // Piege appris a nos depens : masquer une icone avec aria-hidden est
      // correct pour une icone DECORATIVE, mais si elle est le seul contenu
      // d'un bouton, celui-ci perd son unique nom. Le balayage des ligatures a
      // rendu anonymes deux boutons flottants et le bouton d'envoi du chat.
      const anonymes = await page.$$eval('a, button', (els) =>
        els
          .filter((e) => {
            if (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby')) return false;
            const copie = e.cloneNode(true) as HTMLElement;
            copie.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
            return !(copie.textContent || '').replace(/\s+/g, '').length;
          })
          .map((e) => `${e.tagName.toLowerCase()} ${e.getAttribute('href') ?? e.className}`.slice(0, 70)),
      );

      expect(anonymes, `sans nom : ${anonymes.join(' | ')}`).toEqual([]);
    });
  }
});

test.describe('Annonces dynamiques', () => {
  test('/search annonce l’état de la recherche', async ({ page }) => {
    await page.goto('/search?q=loi');
    const statut = page.getByTestId('search-status');
    await expect(statut).toHaveAttribute('role', 'status');
    await expect(statut).toHaveAttribute('aria-live', 'polite');
  });

  test('/chat annonce les nouveaux messages', async ({ page }) => {
    await page.goto('/chat');
    const journal = page.locator('[role="log"]');
    await expect(journal).toHaveCount(1);
    await expect(journal).toHaveAttribute('aria-live', 'polite');
  });
});

test.describe('Langue du document', () => {
  test('l’attribut lang suit la bascule FR/EN', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    await page.getByTestId('lang-en').click();
    // `app/app.html` fixait lang="fr" en dur : tout le contenu anglais était
    // annoncé avec la prononciation française.
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByTestId('lang-fr').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });
});

test.describe('Champs de formulaire', () => {
  for (const chemin of PAGES_PUBLIQUES) {
    test(`${chemin} : tout champ porte un nom accessible`, async ({ page }) => {
      await page.goto(chemin);

      const sansNom = await page.$$eval(
        'input:not([type="hidden"]), select, textarea',
        (champs) =>
          champs
            .filter((c) => {
              if (c.getAttribute('aria-label')) return false;
              if (c.getAttribute('aria-labelledby')) return false;
              const id = c.getAttribute('id');
              if (id && document.querySelector(`label[for="${id}"]`)) return false;
              if (c.closest('label')) return false;
              return true;
            })
            .map((c) => `${c.tagName.toLowerCase()}#${c.id || '(sans id)'}`),
      );

      expect(sansNom, `champs sans étiquette : ${sansNom.join(', ')}`).toEqual([]);
    });
  }
});

/**
 * Balayage automatique, en complement des invariants ci-dessus.
 *
 * Les tests precedents verrouillent ce qui a ete corrige ; celui-ci attrape ce
 * qui viendra. Le portail est volontairement pose sur `serious` et `critical` :
 * inclure `moderate` et `minor` d'emblee produirait une liste que personne ne
 * traiterait, et un portail qu'on finit par desactiver ne protege rien.
 */
import AxeBuilder from '@axe-core/playwright';

test.describe('Balayage axe-core', () => {
  for (const chemin of PAGES_PUBLIQUES) {
    test(`${chemin} : aucune violation serieuse`, async ({ page }) => {
      await page.goto(chemin);

      const resultats = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const graves = resultats.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );

      expect(
        graves,
        graves.map((v) => `${v.id} (${v.impact}) — ${v.nodes.length} noeud(s)`).join('\n'),
      ).toEqual([]);
    });
  }
});
