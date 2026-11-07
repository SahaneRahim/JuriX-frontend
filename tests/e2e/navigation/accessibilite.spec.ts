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
 *  - les 36 icônes de l'ancienne police faisaient lire leur ligature à voix
 *    haute (« send », « menu », « balance ») au milieu d'une interface
 *    française ; leurs remplaçantes SVG doivent rester muettes de même ;
 *  - `/chat` et `/login` n'avaient aucun titre, de h1 à h6 ;
 *  - `<html lang="fr">` était figé alors que l'interface bascule FR/EN ;
 *  - aucun lien d'évitement : atteindre le contenu au clavier demandait de
 *    traverser toute la navigation, à chaque page.
 */

import { expect, test, type Page } from '@playwright/test';
import { attendreLeRepos, EFFECTIFS_DE_RECHERCHE, enregistrerLaRecherche, REPONSE_RECHERCHE } from '../doublures';
import { cliquerJusqualEffet } from '../hydratation';

/**
 * Ouvre la page et vérifie que c'est bien ELLE qui est auditée.
 *
 * API ou base éteinte, '/' et '/laws' répondent 503 avec la page d'erreur, qui
 * a elle aussi un h1, un main, un titre et des contrôles nommés : chaque
 * contrôle passerait contre une autre page. Elles sont alors sautées — et le
 * test échoue avec E2E_EXIGER_BACKEND=1.
 */
async function ouvrir(page: Page, chemin: string): Promise<void> {
  const statut = (await page.goto(chemin))?.status() ?? 0;
  if (statut === 503) {
    if (process.env.E2E_EXIGER_BACKEND === '1') expect(statut, `${chemin} : API indisponible`).toBe(200);
    test.skip(true, `${chemin} : API indisponible (503)`);
  }
  expect(statut, `${chemin} : statut`).toBeLessThan(400);
}

const PAGES_PUBLIQUES = [
  '/',
  '/chat',
  '/laws',
  '/about',
  '/search?q=loi',
  '/login',
  '/compare',
  '/signup',
  // Les trois pages de recuperation de compte. Les deux dernieres sont
  // visitees avec un jeton bidon : elles sont donc balayees DANS LEUR ETAT
  // D'ERREUR, qui est justement celui qu'on oublie de rendre accessible.
  '/forgot-password',
  '/reset-password/jeton-invalide-pour-le-test',
  '/verify-email/jeton-invalide-pour-le-test',
  // Les atterrissages sans jeton, ou les pages a jeton reecrivent l'URL. Sans
  // eux, un rechargement apres usage d'un lien de courriel tombait sur une 404.
  '/reset-password',
  '/verify-email',
];

test.describe('Structure des pages', () => {
  for (const chemin of PAGES_PUBLIQUES) {
    test(`${chemin} : un h1, un main, un titre`, async ({ page }) => {
      await ouvrir(page, chemin);

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
      await ouvrir(page, chemin);
      // Un lien d'evitement sans ancre correspondante ne mene nulle part : il
      // donne l'illusion du raccourci sans le rendre. Cinq pages sur huit
      // etaient dans ce cas.
      await expect(page.locator('#contenu')).toHaveCount(1);
    });
  }
});

test.describe('Icônes décoratives', () => {
  for (const chemin of ['/', '/search?q=loi', '/laws']) {
    test(`${chemin} : aucune icône décorative annoncée`, async ({ page }) => {
      await ouvrir(page, chemin);

      // Une icône (src/lib/components/Icone.svelte) est décorative sauf si
      // elle porte seule une information : elle est alors une image nommée
      // (role="img" et <title>). Une icône sans l'un ni l'autre serait lue
      // « image » ou « groupe » au fil de la page, sans rien dire.
      const exposees = await page
        .locator('svg.icone:not([aria-hidden="true"]):not([role="img"])')
        .count();
      expect(exposees, `${exposees} icône(s) encore annoncée(s)`).toBe(0);
    });
  }
});

test.describe('Noms accessibles', () => {
  for (const chemin of PAGES_PUBLIQUES) {
    test(`${chemin} : aucun lien ni bouton anonyme`, async ({ page }) => {
      await ouvrir(page, chemin);

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

test.describe('Accueil : le champ unique (refonte A)', () => {
  test('les bascules disent leur état, et l’exemple tapé, caché, ne retient pas le focus', async ({ page }) => {
    await ouvrir(page, '/');

    // Profil et mode : des boutons à `aria-pressed`, dans des groupes nommés
    // (et non la seule couleur de la pastille).
    const profils = page.getByRole('group', { name: 'Je suis' });
    await expect(profils.locator('button')).toHaveCount(5);
    for (const bouton of await profils.locator('button').all()) await expect(bouton).toHaveAttribute('aria-pressed', /^(true|false)$/);
    const modes = page.getByRole('group', { name: 'Mode' }).getByRole('button');
    await expect(modes).toHaveCount(2);
    await expect(modes.first()).toHaveAttribute('aria-pressed', 'true');

    // L'exemple tapé est décoratif : caché aux lecteurs d'écran, sans rien
    // de focalisable dedans ; la zone de texte porte le vrai nom.
    const exemple = page.getByTestId('accueil-exemple');
    await expect(exemple).toHaveAttribute('aria-hidden', 'true');
    expect(await exemple.locator('a, button, input, textarea, select, [tabindex]').count()).toBe(0);
    await expect(
      page.locator('#contenu').getByRole('textbox', { name: 'Votre question ou votre recherche', exact: true }),
    ).toBeVisible();
  });
});

test.describe('Annonces dynamiques', () => {
  test('/search annonce l’état de la recherche', async ({ page }) => {
    await page.goto('/search?q=loi');
    const statut = page.getByTestId('search-status');
    await expect(statut).toHaveAttribute('role', 'status');
    await expect(statut).toHaveAttribute('aria-live', 'polite');
  });

  test('/chat annonce les nouveaux messages', async ({ page }) => {
    // P4 : le fil reste un journal nommé (`role="log"`), mais n'est plus une
    // région vivante. Annoncer chaque morceau d'une réponse en flux la lisait
    // mot à mot, et interrompait sans cesse le lecteur d'écran. Une seule
    // région d'annonce, HORS du fil, dit les étapes (recherche, textes
    // trouvés, rédaction), puis « Réponse terminée, N articles cités ».
    await page.goto('/chat');
    const journal = page.locator('[role="log"]');
    await expect(journal).toHaveCount(1);
    await expect(journal).toHaveAttribute('aria-live', 'off');
    const annonces = page.getByTestId('chat-announce');
    await expect(annonces).toHaveCount(1);
    await expect(annonces).toHaveAttribute('role', 'status');
    await expect(annonces).toHaveAttribute('aria-live', 'polite');
    // Hors du fil : sinon ses annonces seraient tues avec lui (aria-live="off"
    // et aria-busy pendant la réponse).
    await expect(journal.getByTestId('chat-announce')).toHaveCount(0);
  });

  test('/chat : le panneau des preuves est une région nommée, sans seconde annonce ni boîte', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/chat');
    await expect(page.getByRole('complementary', { name: 'Articles cités' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const resultats = await new AxeBuilder({ page }).include('[data-testid="chat-preview"]').analyze();
    const graves = resultats.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(graves, graves.map((v) => v.id).join('\n')).toEqual([]);
  });
});

test.describe('Langue du document', () => {
  test('l’attribut lang suit la bascule FR/EN', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    // La page arrive rendue par le serveur, html[lang="fr"] compris : le bouton
    // existe avant que Svelte ne s'y attache, et un clic parti trop tôt est
    // perdu. On clique jusqu'à voir l'effet.
    // `app/app.html` fixait lang="fr" en dur : tout le contenu anglais était
    // annoncé avec la prononciation française.
    await cliquerJusqualEffet(page.getByTestId('lang-en'), page.locator('html[lang="en"]'));
    // P6 : la langue active se dit sans la couleur (`aria-pressed`), et
    // chaque abréviation porte sa langue.
    await expect(page.getByTestId('lang-en')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('lang-fr')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('lang-en')).toHaveAttribute('lang', 'en');

    await page.getByTestId('lang-fr').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByTestId('lang-fr')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Champs de formulaire', () => {
  for (const chemin of PAGES_PUBLIQUES) {
    test(`${chemin} : tout champ porte un nom accessible`, async ({ page }) => {
      await ouvrir(page, chemin);

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
      await ouvrir(page, chemin);
      // POURQUOI AU REPOS. La refonte fait entrer les blocs en fondu : axe lirait
      // le contraste d'un texte à mi-opacité, et non celui de la page.
      await attendreLeRepos(page);

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

/**
 * /search dans ses deux états de la refonte A (E4), clair et sombre.
 *
 * POURQUOI EN PLUS DU BALAYAGE CI-DESSUS. Celui-ci ouvre la page en clair, au
 * chargement. Or la refonte y pose ce que seul un contraste mesuré peut
 * valider : pastilles d'effectif (encre sur encre à 20 % sur l'onglet actif),
 * onglet vide en pointillés, passerelle, bascule de mode, trait des mots
 * cherchés. Et les lignes qui montent passent par une opacité partielle, que
 * axe compterait dans le contraste : `attendreLeRepos` les laisse arriver, on
 * mesure l'état que l'on lit.
 *
 * La doublure, et non la vraie recherche : elle garantit des statuts, des
 * puces d'articles et un onglet à zéro (la réponse ci-dessous n'a aucun
 * arrêté), sans lesquels il n'y aurait rien à mesurer. L'attente (silhouettes
 * `aria-hidden`, balance décorative) est balayée aussi : une nouvelle requête
 * ne doit laisser aucun nom ni contraste en défaut.
 */
test.describe('/search : résultats et attente (refonte A)', () => {
  const SANS_ARRETE = {
    ...REPONSE_RECHERCHE,
    facets: { ...EFFECTIFS_DE_RECHERCHE, types: EFFECTIFS_DE_RECHERCHE.types.filter((t) => t.value !== 'arrêté') },
  };

  async function violationsGraves(page: Page): Promise<string[]> {
    const resultats = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    return resultats.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  }

  for (const theme of ['light', 'dark']) {
    test.describe(`thème ${theme}`, () => {
      test.beforeEach(async ({ page, request }) => {
        await enregistrerLaRecherche(request, ['licenciement', REPONSE_RECHERCHE.query], SANS_ARRETE);
        await page.addInitScript((valeur) => localStorage.setItem('jurix-theme', valeur), theme);
        await ouvrir(page, '/search?q=licenciement');
        await attendreLeRepos(page);
      });

      test('les résultats : aucune violation sérieuse', async ({ page }) => {
        await expect(page.locator('#contenu ul[role="list"] > li').first()).toBeVisible();
        // Il y a bien de quoi mesurer : un onglet vide, et le champ compact.
        await expect(page.getByRole('group', { name: 'Nature du texte' }).locator('[aria-disabled="true"]').first()).toBeVisible();
        await expect(page.locator('#contenu form[role="search"]').getByRole('group', { name: 'Mode' })).toBeVisible();
        expect(await violationsGraves(page)).toEqual([]);
      });

      test('pendant une nouvelle requête : aucune violation sérieuse', async ({ page }) => {
        // La page a repris la main : Entrée navigue sans recharger.
        await expect(page.getByTestId('search-filters-toggle')).toHaveAttribute('aria-expanded', 'false');
        let liberer: () => void = () => {};
        const retenue = new Promise<void>((fin) => (liberer = fin));
        await page.route(
          (url) => url.pathname === '/search/__data.json',
          async (route) => {
            await retenue;
            await route.continue();
          },
        );
        const champ = page.locator('#contenu').getByRole('combobox', { name: 'Rechercher', exact: true });
        await champ.fill(REPONSE_RECHERCHE.query);
        await champ.press('Enter');
        await expect(page.getByTestId('search-skeleton')).toBeVisible();
        const graves = await violationsGraves(page);
        liberer();
        expect(graves).toEqual([]);
      });
    });
  }
});
