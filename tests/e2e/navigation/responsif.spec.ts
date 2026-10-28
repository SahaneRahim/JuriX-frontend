/**
 * Le site sur six tailles d'écran, du téléphone de 360 px au bureau.
 *
 * POURQUOI CE FICHIER EXISTE. Essayé sur un téléphone, le site était mal
 * adapté, le chat surtout : une boîte de 400 à 500 px de haut dans une page qui
 * défile, la saisie sous le bord de l'écran, le bouton d'envoi coupé, et des
 * pages qui glissaient de côté. Rien ne pouvait l'attraper : la suite tourne au
 * viewport de bureau (1280×720), et deux specs seulement passent en 375 px,
 * pour le menu. L'audit a ramené presque tous les défauts à deux causes : des
 * éléments plus larges que l'écran, et des hauteurs fixes (px, vh). Ce fichier
 * garde les deux.
 *
 * POUR CHAQUE PAGE ET CHAQUE TAILLE :
 *  - rien ne dépasse à droite (`scrollWidth <= innerWidth + 1`). En échec, le
 *    message nomme les éléments fautifs et leur bord droit ;
 *  - une capture pleine page, test-results/responsif/<page>-<l>x<h>.png. Un
 *    test voit ce qui dépasse, pas ce qui est disgracieux : elles sont à relire.
 *
 * EN PLUS :
 *  - /chat : la saisie et le bouton d'envoi dans l'écran, avant et après une
 *    longue réponse ; sur téléphone, la page elle-même ne défile pas ;
 *  - /chat, compte connecté : sous 1 024 px, les conversations sont un tiroir
 *    qui s'ouvre, se referme à Échap et au choix d'une conversation ;
 *  - accueil en 390×844 : le champ de recherche sans défiler ;
 *  - accueil sur trois téléphones courts (320×568, 360×584, 375×553) : le
 *    bouton flottant de l'assistant ne couvre pas le bouton « Rechercher ».
 *
 * HORS DE PORTÉE. Le clavier virtuel, la barre d'adresse qui se replie et le
 * zoom au doigt n'existent pas en émulation : ils se vérifient sur un vrai
 * téléphone.
 *
 * DONNÉES. Le chat, la recherche, la comparaison et l'administration sont
 * interceptés : aucun appel au modèle, aucun quota, et des contenus choisis
 * pour déborder (références sans espace, URL, titres de loi entiers, tableau).
 * L'accueil, /laws, une loi et une catégorie sont rendus par le serveur, dont
 * `page.route` ne voit pas les appels : ils lisent la vraie API, et sont sautés
 * quand elle est éteinte — sauf avec E2E_EXIGER_BACKEND=1, où c'est un échec.
 *
 * Lancer : npx playwright test --project=responsif
 */

import path from 'node:path';

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import type { Category } from '../../../src/lib/types';
// Les doublures de l'API, les sessions simulées et les jeux de données vivent
// dans tests/e2e/doublures.ts : monochrome.spec.ts et
// redimensionnement.spec.ts ouvrent les mêmes pages avec les mêmes réponses.
import {
  AGENT_MOBILE,
  COMPARAISON,
  DEBUT_REPONSE,
  FIN_REPONSE,
  LOIS,
  MEMBRE,
  QUESTION,
  REPONSE_RECHERCHE,
  REPONSE_ROUVERTE,
  SESSION_DU_CHAT,
  UTILISATEURS,
  attendreLeRepos,
  boutonDEnvoi,
  connecter,
  exiger,
  lireListe,
  ouvrirAuServeur,
  saisieDuChat,
  simulerLAdministration,
  simulerLaComparaison,
  simulerLaRecherche,
  simulerLeChat,
  visible,
} from '../doublures';
import { cliquerJusqualEffet, saisirJusqualEffet } from '../hydratation';

/**
 * Point de rupture `lg` de Tailwind, où le plan met la bascule : en dessous,
 * en-tête compact et conversations en tiroir ; au-dessus, la colonne fixe.
 */
const LARGEUR_LG = 1024;

interface Taille {
  largeur: number;
  hauteur: number;
  /**
   * Émulé en téléphone : la balise viewport compte (sans elle, Chrome mobile
   * mettrait la page à 980 px puis la réduirait), l'écran est tactile, et
   * l'agent annonce un Android.
   */
  telephone: boolean;
}

const TAILLES: Taille[] = [
  // Android courant : la plupart des visiteurs, au Cameroun, sont sur mobile.
  { largeur: 360, hauteur: 740, telephone: true },
  // iPhone 12 à 14.
  { largeur: 390, hauteur: 844, telephone: true },
  // Le premier, tourné : 360 px de haut pour l'en-tête, le chat et la saisie.
  { largeur: 740, hauteur: 360, telephone: true },
  // Tablette en portrait : sous `lg`, donc encore en mise en page mobile.
  { largeur: 768, hauteur: 1024, telephone: false },
  // Tablette en paysage, ou petit portable : pile sur `lg`, la plus étroite
  // des mises en page de bureau (conversations en colonne). L'en-tête y garde
  // son menu : il bascule à xl (1 280 px), voir SiteHeader.svelte.
  { largeur: 1024, hauteur: 768, telephone: false },
  { largeur: 1440, hauteur: 900, telephone: false },
];

// ---------------------------------------------------------------------------
// Mesures
// ---------------------------------------------------------------------------

interface Mesure {
  /** `window.innerWidth` : la largeur de l'écran. */
  fenetre: number;
  /** `scrollWidth` du document : plus large que l'écran, la page glisse de côté. */
  defilable: number;
  hauteurFenetre: number;
  hauteurDefilable: number;
  /** Les éléments qui font déborder la page, du plus loin au moins loin. */
  coupables: { element: string; droite: number; largeur: number }[];
}

/**
 * Mesure la page, et nomme ce qui la fait déborder.
 *
 * Ne comptent pas : un sous-arbre en position fixe (attaché à l'écran, pas au
 * document — un tiroir rangé hors champ en fait partie), ni un élément dont un
 * ancêtre coupe ou fait défiler horizontalement (le tableau d'une réponse,
 * dans son conteneur `overflow-x-auto`). Seul le PREMIER élément qui dépasse,
 * dans chaque branche, est nommé : ses descendants dépassent avec lui et
 * noieraient le message.
 */
async function mesurer(page: Page): Promise<Mesure> {
  return page.evaluate((maximum) => {
    const fenetre = window.innerWidth;
    const racine = document.documentElement;
    // Coordonnées du document, et non de l'écran : un clic de Playwright peut
    // avoir fait défiler la page de côté pour atteindre sa cible.
    const decalage = window.scrollX;

    const decrire = (el: Element): string => {
      const testid = el.getAttribute('data-testid');
      const classes = (el.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean);
      const texte = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      return [
        el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ''),
        testid ? `[data-testid="${testid}"]` : '',
        classes.length ? `.${classes.slice(0, 6).join('.')}${classes.length > 6 ? '…' : ''}` : '',
        texte ? `« ${texte.slice(0, 60)}${texte.length > 60 ? '…' : ''} »` : '',
      ]
        .filter(Boolean)
        .join(' ');
    };

    const neFaitPasGlisser = (el: Element): boolean => {
      for (let p: Element | null = el; p && p !== racine; p = p.parentElement) {
        const style = getComputedStyle(p);
        if (style.position === 'fixed') return true;
        // Le débordement de <body> passe à l'écran lui-même : c'est la mesure
        // du document qui en juge.
        if (p !== el && p !== document.body && style.overflowX !== 'visible') return true;
      }
      return false;
    };

    const depassent = new Set<Element>();
    for (const el of document.body.querySelectorAll('*')) {
      const boite = el.getBoundingClientRect();
      if (boite.width > 0 && boite.right + decalage > fenetre + 1 && !neFaitPasGlisser(el)) depassent.add(el);
    }

    const coupables = [...depassent]
      .filter((el) => !el.parentElement || !depassent.has(el.parentElement))
      .map((el) => {
        const boite = el.getBoundingClientRect();
        return { element: decrire(el), droite: Math.round(boite.right + decalage), largeur: Math.round(boite.width) };
      })
      .sort((a, b) => b.droite - a.droite)
      .slice(0, maximum);

    return {
      fenetre,
      defilable: racine.scrollWidth,
      hauteurFenetre: window.innerHeight,
      hauteurDefilable: racine.scrollHeight,
      coupables,
    };
  }, 8);
}

/**
 * La page ne glisse pas de côté. Vérification souple : la suite du test
 * s'exécute quand même, et un seul passage rapporte tous les défauts.
 */
async function verifierSansDebordement(page: Page, ou: string): Promise<void> {
  const mesure = await mesurer(page);
  const fautifs = mesure.coupables.length
    ? mesure.coupables
        .map((c) => `  - ${c.element} : bord droit à ${c.droite} px, ${c.largeur} px de large`)
        .join('\n')
    : '  (aucun élément nommable : une marge, une ombre ou un pseudo-élément ?)';
  expect
    .soft(
      mesure.defilable,
      `${ou} : la page glisse de côté, ${mesure.defilable} px de contenu pour ${mesure.fenetre} px d'écran.\n` +
        `Ce qui dépasse :\n${fautifs}`,
    )
    .toBeLessThanOrEqual(mesure.fenetre + 1);
}

/**
 * `cible` est entière dans l'écran, sans défiler. La boîte donne la position
 * en pixels, pour un message lisible ; l'intersection réelle dit en plus si un
 * ancêtre la rogne (une carte en `overflow-hidden` trop courte, par exemple).
 */
async function verifierDansLEcran(page: Page, cible: Locator, nom: string): Promise<void> {
  await expect(cible, `${nom} : introuvable`).toBeVisible();
  const boite = await cible.boundingBox();
  if (!boite) throw new Error(`${nom} : aucune boîte de mise en page`);
  const ecran = await page.evaluate(() => ({ largeur: window.innerWidth, hauteur: window.innerHeight }));

  const haut = Math.round(boite.y);
  const bas = Math.round(boite.y + boite.height);
  const gauche = Math.round(boite.x);
  const droite = Math.round(boite.x + boite.width);
  expect.soft(haut, `${nom} : au-dessus de l'écran (haut à ${haut} px)`).toBeGreaterThanOrEqual(-1);
  expect
    .soft(bas, `${nom} : sous le bord de l'écran (bas à ${bas} px pour ${ecran.hauteur} px de haut)`)
    .toBeLessThanOrEqual(ecran.hauteur + 1);
  expect.soft(gauche, `${nom} : coupé à gauche (bord à ${gauche} px)`).toBeGreaterThanOrEqual(-1);
  expect
    .soft(droite, `${nom} : coupé à droite (bord à ${droite} px pour ${ecran.largeur} px de large)`)
    .toBeLessThanOrEqual(ecran.largeur + 1);
  await expect.soft(cible, `${nom} : rogné par un conteneur`).toBeInViewport({ ratio: 0.9 });
}

/** Ce que rend `ceQuiRecoitLAppui` quand l'appui atteint bien sa cible. */
const LA_CIBLE = 'la cible elle-même';

/**
 * Ce que toucherait un doigt posé sur `cible`, sans défiler : `LA_CIBLE` si
 * chaque point sondé l'atteint, elle ou l'un de ses descendants (l'icône d'un
 * bouton) ; sinon le premier point qui la manque, et l'élément qui la couvre
 * là. Le centre d'abord, puis une grille à 20 et 80 % de la largeur et de la
 * hauteur : à 360×584, le bouton flottant ne couvrait que le bas du bouton
 * « Rechercher », et son centre restait libre. Les coins mêmes, arrondis, ne
 * sont pas sondés. `elementFromPoint` suit les règles du toucher : un élément
 * en `pointer-events: none` ou invisible n'y compte pas. Un point hors de
 * l'écran ne touche rien, et le message le dit.
 */
async function ceQuiRecoitLAppui(cible: Locator): Promise<string> {
  return cible.evaluate((el, laCible) => {
    const decrire = (n: Element): string => {
      const testid = n.getAttribute('data-testid');
      const nom = n.getAttribute('aria-label');
      return (
        n.tagName.toLowerCase() +
        (n.id ? `#${n.id}` : '') +
        (testid ? `[data-testid="${testid}"]` : '') +
        (nom ? ` « ${nom} »` : '')
      );
    };
    const boite = el.getBoundingClientRect();
    const points = [0.5, 0.2, 0.8].flatMap((fy) => [0.5, 0.2, 0.8].map((fx) => [fx, fy]));
    for (const [fx, fy] of points) {
      const x = boite.left + boite.width * fx;
      const y = boite.top + boite.height * fy;
      const ou = `en (${Math.round(x)}, ${Math.round(y)})`;
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) {
        return `rien ${ou}, hors de l'écran (${window.innerWidth}×${window.innerHeight})`;
      }
      const touche = document.elementFromPoint(x, y);
      if (!touche) return `rien ${ou}`;
      if (el.contains(touche)) continue;
      // Le lien ou le bouton dont l'élément touché fait partie : l'icône du
      // bouton flottant se nomme par lui.
      const porteur = touche.closest('a, button, [data-testid]');
      return `${porteur && porteur !== touche ? `${decrire(touche)}, dans ${decrire(porteur)}` : decrire(touche)} ${ou}`;
    }
    return laCible;
  }, LA_CIBLE);
}

/**
 * Au-delà, une capture devient lourde à relire : on garde le haut de la page,
 * là où se joue la mise en page.
 */
const HAUTEUR_MAX_CAPTURE = 15_000;

/**
 * Capture pleine page dans test-results/responsif/, jointe au rapport HTML.
 * Le dossier de sortie du projet plutôt qu'un chemin relatif : la capture
 * arrive au même endroit, d'où que la suite soit lancée.
 */
async function capturer(page: Page, nom: string): Promise<void> {
  const fichier = path.join(test.info().project.outputDir, 'responsif', `${nom}.png`);
  const pleinePage = await page.evaluate(() => ({
    largeur: document.documentElement.scrollWidth,
    hauteur: document.documentElement.scrollHeight,
  }));
  await page.screenshot({
    path: fichier,
    fullPage: true,
    // Pastille qui pulse, points qui sautent : figés, pour que deux captures
    // de la même page se comparent à l'œil.
    animations: 'disabled',
    ...(pleinePage.hauteur > HAUTEUR_MAX_CAPTURE
      ? { clip: { x: 0, y: 0, width: pleinePage.largeur, height: HAUTEUR_MAX_CAPTURE } }
      : {}),
  });
  await test.info().attach(nom, { path: fichier, contentType: 'image/png' });
}
// ---------------------------------------------------------------------------
// Les pages
// ---------------------------------------------------------------------------

/**
 * Déplie les sources sous la réponse si elles sont repliées — le plan les
 * replie sur téléphone —, pour que leurs titres longs passent aussi au
 * contrôle. La forme du bouton n'étant pas figée, l'étape est tolérante ; seul
 * le bureau, où elles ne se replient pas, exige de les voir.
 */
async function deplierLesSources(journal: Locator, exigees: boolean): Promise<void> {
  const source = journal.getByTestId('chat-source').first();
  if (!(await source.isVisible())) {
    const bouton = journal.locator('summary, button[aria-expanded]').filter({ hasText: /sources/i }).first();
    if ((await bouton.count()) > 0) await bouton.click();
  }
  if (exigees) await expect(source).toBeVisible();
}

interface Parcours {
  /** L'adresse, telle qu'elle apparaît dans le titre du test. */
  chemin: string;
  /** Début du nom de la capture. */
  capture: string;
  /** Prépare la page (session, doublures), l'ouvre, et attend son contenu. */
  ouvrir: (page: Page, request: APIRequestContext) => Promise<void>;
  /** Vérifications propres à la page, après la mesure commune. */
  verifier?: (page: Page) => Promise<void>;
}

const PARCOURS: Parcours[] = [
  {
    chemin: '/',
    capture: 'accueil',
    ouvrir: async (page) => {
      // API éteinte, l'accueil répond 503 comme les autres pages publiques :
      // mis en cache par Vercel (ISR), il ne doit jamais être servi sans sa
      // grille de catégories. ouvrirAuServeur passe alors le test.
      await ouvrirAuServeur(page, '/');
    },
  },
  {
    chemin: '/chat',
    capture: 'chat',
    ouvrir: async (page) => {
      await simulerLeChat(page);
      await page.goto('/chat');
      await expect(saisieDuChat(page)).toBeVisible();
    },
    verifier: async (page) => {
      // L'audit : sur téléphone, la saisie passait sous le bord de l'écran, et
      // le bouton d'envoi était coupé à droite.
      await verifierDansLEcran(page, saisieDuChat(page), 'la saisie du chat');
      await verifierDansLEcran(page, boutonDEnvoi(page), 'le bouton d’envoi');
    },
  },
  {
    chemin: '/laws',
    capture: 'laws',
    ouvrir: (page) => ouvrirAuServeur(page, '/laws'),
  },
  {
    chemin: '/laws/[id]',
    capture: 'laws-id',
    ouvrir: async (page, request) => {
      const [loi] = await lireListe<{ id: number }>(request, '/laws/?limit=1');
      exiger(loi, 'aucune loi : API injoignable ou corpus vide');
      await ouvrirAuServeur(page, `/laws/${loi.id}`);
      await expect(page.getByTestId('law-error')).toHaveCount(0);
    },
  },
  {
    chemin: '/search?q=travail',
    capture: 'search',
    ouvrir: async (page) => {
      await simulerLaRecherche(page);
      await page.goto('/search?q=travail');
      await expect(page.getByTestId('search-status')).toContainText(String(REPONSE_RECHERCHE.total));
    },
  },
  {
    chemin: '/categories/[id]',
    capture: 'categories-id',
    ouvrir: async (page, request) => {
      const categories = await lireListe<Category>(request, '/categories');
      // La plus fournie : une catégorie vide n'aurait aucune carte à mesurer.
      const [categorie] = [...categories].sort((a, b) => (b.law_count ?? 0) - (a.law_count ?? 0));
      exiger(categorie, 'aucune catégorie : API injoignable');
      await ouvrirAuServeur(page, `/categories/${categorie.id}`);
    },
  },
  {
    chemin: '/compare',
    capture: 'compare',
    ouvrir: async (page) => {
      await simulerLaComparaison(page);
      await page.goto('/compare');
      // Le bouton s'active au montage : Svelte a la main, la saisie ne sera
      // pas perdue (tests/e2e/hydratation.ts).
      await expect(page.getByTestId('compare-submit')).toBeEnabled();
      await page.getByTestId('compare-a').fill(COMPARAISON.subject_a);
      await page.getByTestId('compare-b').fill(COMPARAISON.subject_b);
      await cliquerJusqualEffet(page.getByTestId('compare-submit'), page.getByTestId('compare-result'));
      // Le texte d'un article déplié sous sa cellule : le plus long contenu de la grille.
      await cliquerJusqualEffet(page.getByTestId('compare-toggle-0-a'), page.getByTestId('compare-source-0-a'));
    },
  },
  {
    chemin: '/about',
    capture: 'about',
    ouvrir: (page) => ouvrirAuServeur(page, '/about'),
  },
  {
    chemin: '/login',
    capture: 'login',
    ouvrir: (page) => ouvrirAuServeur(page, '/login'),
  },
  {
    chemin: '/signup',
    capture: 'signup',
    ouvrir: (page) => ouvrirAuServeur(page, '/signup'),
  },
  {
    chemin: '/admin',
    capture: 'admin',
    ouvrir: async (page) => {
      await simulerLAdministration(page);
      await page.goto('/admin');
      await expect(page.getByTestId('admin-profils')).toBeVisible();
    },
  },
  {
    chemin: '/admin/users',
    capture: 'admin-users',
    ouvrir: async (page) => {
      await simulerLAdministration(page);
      await page.goto('/admin/users');
      // Une des adresses les plus longues : le tableau, ou ses cartes, est rempli.
      await expect(visible(page.getByText(UTILISATEURS[1].email))).toBeVisible();
    },
  },
  {
    chemin: '/admin/documents',
    capture: 'admin-documents',
    ouvrir: async (page) => {
      await simulerLAdministration(page);
      await page.goto('/admin/documents');
      await expect(visible(page.getByText(LOIS[0].title))).toBeVisible();
    },
  },
];

// ---------------------------------------------------------------------------
// Les tests
// ---------------------------------------------------------------------------

for (const taille of TAILLES) {
  const dimensions = `${taille.largeur}x${taille.hauteur}`;

  test.describe(`${dimensions}${taille.telephone ? ' (téléphone)' : ''}`, () => {
    // Un contexte neuf par test : la taille, le mobile et le tactile se
    // fixent à sa création, pas en cours de route comme `setViewportSize`.
    // Le stockage de départ reste celui de playwright.config.ts (profil
    // citoyen déjà choisi) : la question du profil ne couvre aucune page.
    test.use({
      viewport: { width: taille.largeur, height: taille.hauteur },
      isMobile: taille.telephone,
      hasTouch: taille.telephone,
      ...(taille.telephone ? { userAgent: AGENT_MOBILE } : {}),
    });

    for (const parcours of PARCOURS) {
      test(`${parcours.chemin} : rien ne dépasse de l’écran`, async ({ page, request }) => {
        await parcours.ouvrir(page, request);
        await attendreLeRepos(page);
        // La capture d'abord : elle reste à relire même quand une vérification échoue.
        await capturer(page, `${parcours.capture}-${dimensions}`);
        await verifierSansDebordement(page, parcours.chemin);
        await parcours.verifier?.(page);
      });
    }

    test('/chat : une longue réponse tient dans l’écran, la saisie reste à portée', async ({ page }) => {
      await simulerLeChat(page);
      await page.goto('/chat');
      const journal = page.getByRole('log');

      // Saisie et Entrée, comme un utilisateur, répétées tant que Svelte n'a
      // pas la main (tests/e2e/hydratation.ts).
      await saisirJusqualEffet(saisieDuChat(page), QUESTION, journal.getByText(DEBUT_REPONSE));
      // Le flux est fini quand le fil est mémorisé : seul son DERNIER
      // événement porte la session, avec les sources.
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem('jurix-chat-session')))
        .toBe(SESSION_DU_CHAT);
      await deplierLesSources(journal, taille.largeur >= LARGEUR_LG);
      await attendreLeRepos(page);
      await capturer(page, `chat-reponse-${dimensions}`);

      // Une partie au moins de la réponse est à l'écran, que le journal suive
      // sa fin ou garde la question en haut. Le plus petit bloc qui contient
      // son début et sa fin, c'est la réponse.
      const reponse = journal
        .locator('div')
        .filter({ has: page.getByText(DEBUT_REPONSE) })
        .filter({ has: page.getByText(FIN_REPONSE) })
        .last();
      await expect.soft(reponse, 'la réponse n’est pas à l’écran').toBeInViewport();
      await verifierDansLEcran(page, saisieDuChat(page), 'la saisie du chat, après la réponse');
      await verifierDansLEcran(page, boutonDEnvoi(page), 'le bouton d’envoi, après la réponse');
      await verifierSansDebordement(page, '/chat, après une longue réponse');

      // Le journal ne glisse pas de côté non plus : seul le tableau, dans son
      // propre conteneur, peut défiler horizontalement.
      const largeurs = await journal.evaluate((el) => ({ contenu: el.scrollWidth, visible: el.clientWidth }));
      expect
        .soft(largeurs.contenu, `le journal défile de côté : ${largeurs.contenu} px de contenu pour ${largeurs.visible} px`)
        .toBeLessThanOrEqual(largeurs.visible + 1);

      if (taille.telephone) {
        // Décision de l'utilisateur : le chat en plein écran sur téléphone.
        // La page ne défile pas, seul le journal défile ; sinon la saisie
        // repasse sous le bord dès qu'on remonte lire la réponse.
        const mesure = await mesurer(page);
        expect
          .soft(
            mesure.hauteurDefilable,
            `la page du chat défile : ${mesure.hauteurDefilable} px de haut pour ${mesure.hauteurFenetre} px d’écran`,
          )
          .toBeLessThanOrEqual(mesure.hauteurFenetre + 1);
      }
    });

    const enTiroir = taille.largeur < LARGEUR_LG;

    test(`/chat, compte connecté : les conversations ${enTiroir ? 'en tiroir' : 'en colonne'}`, async ({ page }) => {
      await connecter(page, MEMBRE);
      await simulerLeChat(page);
      await page.goto('/chat');
      // Réseau calme : la liste, chargée au montage, est arrivée. Sans cela,
      // « fermé au chargement » passerait sur une liste encore vide.
      await attendreLeRepos(page);
      const premiere = page.getByTestId('conversation-item').first();

      if (!enTiroir) {
        // La colonne fixe d'aujourd'hui : la liste est là, sans geste.
        await expect(premiere).toBeInViewport();
        await capturer(page, `chat-conversations-${dimensions}`);
        await verifierSansDebordement(page, '/chat, conversations en colonne');
        return;
      }

      const bascule = page.getByTestId('conversations-toggle');
      // Fermé au chargement : le tiroir ne cache pas la conversation.
      await expect(bascule).toHaveAttribute('aria-expanded', 'false');
      await expect(premiere).not.toBeInViewport();

      await cliquerJusqualEffet(bascule, page.locator('[data-testid="conversations-toggle"][aria-expanded="true"]'));
      await expect(premiere).toBeInViewport();
      await attendreLeRepos(page);
      await capturer(page, `chat-conversations-${dimensions}`);
      await verifierSansDebordement(page, '/chat, tiroir des conversations ouvert');

      // Échap le referme, comme le menu du site.
      await page.keyboard.press('Escape');
      await expect(bascule).toHaveAttribute('aria-expanded', 'false');
      await expect(premiere).not.toBeInViewport();

      // Choisir une conversation l'affiche et range le tiroir : on revient à
      // la lecture sans geste de plus.
      await bascule.click();
      await expect(premiere).toBeInViewport();
      await premiere.click();
      await expect(page.getByRole('log')).toContainText(REPONSE_ROUVERTE);
      await expect(bascule).toHaveAttribute('aria-expanded', 'false');
      await expect(premiere).not.toBeInViewport();
    });

    if (taille.largeur === 390 && taille.hauteur === 844) {
      test('/ : le champ de recherche dans le premier écran', async ({ page }) => {
        // L'API n'y est pour rien : le titre et le champ précèdent la grille
        // des catégories, seule à en dépendre.
        await page.goto('/');
        await attendreLeRepos(page);
        // Par son rôle de champ, `text` aujourd'hui, `search` selon le plan : le
        // bouton voisin s'appelle lui aussi « Rechercher ».
        const contenu = page.locator('#contenu');
        const champ = contenu
          .getByRole('searchbox', { name: 'Rechercher', exact: true })
          .or(contenu.getByRole('textbox', { name: 'Rechercher', exact: true }));
        await verifierDansLEcran(page, champ, 'le champ de recherche de l’accueil');
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Téléphones courts : le bouton flottant et le bouton « Rechercher »
// ---------------------------------------------------------------------------

/**
 * Sur ces écrans, le bouton « Rechercher » de l'accueil arrive en bas à droite
 * du premier écran, là où se pose le bouton flottant de l'assistant : celui-ci
 * en captait l'appui. Le layout le retire désormais tant que le haut de
 * l'accueil est à l'écran (src/routes/(main)/+layout.svelte). Seul l'accueil
 * y est ouvert : c'est là que les deux boutons se rencontraient.
 */
const TELEPHONES_COURTS: Taille[] = [
  // iPhone SE de première génération : la plus étroite des largeurs suivies.
  { largeur: 320, hauteur: 568, telephone: true },
  // Un Android de 360 × 640, moins la barre d'adresse.
  { largeur: 360, hauteur: 584, telephone: true },
  // Un iPhone 8 (375 × 667), barres de Safari déployées.
  { largeur: 375, hauteur: 553, telephone: true },
];

for (const taille of TELEPHONES_COURTS) {
  const dimensions = `${taille.largeur}x${taille.hauteur}`;

  test.describe(`${dimensions} (téléphone court)`, () => {
    test.use({
      viewport: { width: taille.largeur, height: taille.hauteur },
      isMobile: taille.telephone,
      hasTouch: taille.telephone,
      ...(taille.telephone ? { userAgent: AGENT_MOBILE } : {}),
    });

    test('/ : le bouton flottant ne couvre pas le bouton « Rechercher »', async ({ page }) => {
      // Comme pour le champ en 390×844 : le hero et la barre de recherche
      // précèdent la grille des catégories, seule à dépendre de l'API.
      await page.goto('/');
      await attendreLeRepos(page);
      // Par son rôle et son nom : sous sm, le bouton ne montre qu'une flèche.
      const bouton = page.locator('#contenu').getByRole('button', { name: 'Rechercher', exact: true });
      await expect(bouton).toBeVisible();
      // La mesure d'abord, sur la page telle qu'elle s'affiche, au repos ; la
      // capture suit, même en cas d'échec (vérification souple).
      const touche = await ceQuiRecoitLAppui(bouton);
      expect.soft(touche, `sur le bouton « Rechercher », un appui atteint : ${touche}`).toBe(LA_CIBLE);
      await capturer(page, `accueil-${dimensions}`);
    });
  });
}
