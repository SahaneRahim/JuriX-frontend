/**
 * Chaque page s'adapte à chaque écran, et au redimensionnement en direct.
 *
 * POURQUOI CE FICHIER EXISTE. Le propriétaire veut un site qui suive tous les
 * écrans (téléphone, tablette, portable, bureau) ET la fenêtre qu'on
 * redimensionne. responsif.spec.ts charge chaque page à six tailles fixes :
 * il ne voit ni les largeurs entre deux (l'en-tête coupait « Créer un
 * compte » vers 1 024 px et la page glissait de côté), ni ce qui arrive à une
 * page déjà ouverte quand la fenêtre change (un tiroir resté ouvert, un
 * verrou de défilement oublié, une fenêtre de dialogue plus large que le
 * nouvel écran).
 *
 * BALAYAGE EN DIRECT (21 pages, thème clair) : chaque page est ouverte UNE
 * fois en 1440×900, puis la MÊME page passe, sans rechargement, par 31
 * largeurs de 1 920 à 320 px (900 px de haut jusqu'à 768 px de large, 800
 * en dessous), puis revient à 1 440. À chaque pas, deux images plus tard (et
 * la fin des transitions en cours, une seconde au plus) :
 *  - la page ne glisse pas de côté (`scrollWidth <= innerWidth + 1`) ;
 *  - aucun élément visible ne sort de l'écran de plus de 1 px, sauf dans un
 *    conteneur qui défile à dessein (`overflow-x: auto | scroll` : tableaux,
 *    code, visionneuse du PDF) ;
 *  - l'en-tête montre UN seul mode de navigation : les liens du bureau, ou le
 *    bouton du menu ;
 *  - les éléments fixes ou collants (en-tête, bouton flottant de
 *    l'assistant, fil d'Ariane d'une loi, sommaire, saisie du chat) ne se
 *    couvrent pas, en haut de page comme à mi-défilement ;
 *  - le titre de la page, son formulaire ou la saisie du chat reste visible.
 * Le même balayage passe aussi l'en-tête le plus chargé, sur /about (un
 * administrateur connecté, au profil le plus long), et /chat d'un compte
 * connecté, avec sa colonne des conversations.
 *
 * ÉCRANS COURTS : 740×360 et 844×390 (téléphones en paysage), 1024×600 et
 * 1280×600 : l'action principale de la page s'atteint (elle vient à l'écran
 * et rien ne la couvre), et le contenu défile.
 *
 * ÉTATS QUI TRAVERSENT UN REDIMENSIONNEMENT : menu du site ouvert à 390 px
 * puis 1 280 ; menu des réglages et du compte (de lg à xl) ouvert à 1 100 px
 * puis 1 440 et 390 ; tiroir des conversations ; tiroir de l'administration ;
 * fenêtres de dialogue ouvertes à 1 440 puis 390 (profil, compte d'un
 * utilisateur) ; sommaire d'une loi ; /chat tourné de 390×844 à 844×390.
 *
 * TACTILE : en 390×844 (écran tactile, mobile), les boutons, liens, champs
 * et bascules de l'en-tête et du contenu mesurent au moins 44×44 px, zone
 * d'appui étendue par ::before/::after comprise ; les liens pris dans une
 * phrase en sont exemptés.
 *
 * Chaque échec nomme la page, la taille, l'élément et les mesures.
 * DONNÉES ET MODÈLE : les doublures de tests/e2e/doublures.ts ; aucun appel
 * au modèle.
 *
 * Lancer : npx playwright test --project=redimensionnement
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  AGENT_MOBILE,
  MEMBRE,
  SUPERADMIN,
  connecter,
  saisieDuChat,
  boutonDEnvoi,
  simulerLAdministration,
  simulerLeChat,
  attendreLeRepos,
  exiger,
  ouvrirAuServeur,
} from '../doublures';
import { cliquerJusqualEffet } from '../hydratation';
import { PAGES, loiAvecArticles, ouvrirAuRepos, type Entete, type PageDuSite } from '../pages-du-site';

/** Les largeurs du balayage : chaque point de rupture de Tailwind, et ses deux voisins. */
const LARGEURS = [
  1920, 1680, 1536, 1440, 1366, 1280, 1180, 1100, 1025, 1024, 1023, 960, 900, 820, 769, 768, 767, 700, 641, 640,
  639, 600, 540, 480, 430, 414, 390, 375, 360, 344, 320,
];
/** 900 px de haut jusqu'à 768 px de large (portables, tablettes), 800 en dessous. */
const hauteurPour = (largeur: number) => (largeur >= 768 ? 900 : 800);

/** Le point de rupture `lg` : en dessous, menus et tiroirs ; au-dessus, colonnes. */
const LARGEUR_LG = 1024;

/** Cible tactile minimale (WCAG 2.5.5, et le choix du site depuis l'audit mobile). */
const CIBLE_MIN = 44;

interface Taille {
  largeur: number;
  hauteur: number;
  telephone: boolean;
}

const reglages = (taille: Taille) => ({
  viewport: { width: taille.largeur, height: taille.hauteur },
  isMobile: taille.telephone,
  hasTouch: taille.telephone,
  ...(taille.telephone ? { userAgent: AGENT_MOBILE } : {}),
});

/** Deux images : le temps que les media queries, Svelte et la mise en page suivent. */
async function deuxImages(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((fin) => requestAnimationFrame(() => requestAnimationFrame(() => fin()))),
  );
}

/**
 * Change la taille de l'écran, puis attend deux images et la fin des
 * transitions en cours (une seconde au plus). Sans cette fin, la barre de
 * l'administration, qui glisse en 200 ms quand l'écran passe sous lg, était
 * mesurée en plein glissement : elle « sortait » de l'écran et couvrait la
 * barre du haut. Un état de passage, pas une mise en page. Les animations
 * infinies (pastille qui pulse) n'ont pas de fin : elles sont écartées.
 */
async function redimensionner(page: Page, largeur: number, hauteur: number): Promise<void> {
  await page.setViewportSize({ width: largeur, height: hauteur });
  await deuxImages(page);
  await page.evaluate(async () => {
    const finies = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === 'running' &&
          Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)),
      );
    await Promise.race([
      Promise.all(finies.map((animation) => animation.finished.catch(() => undefined))),
      new Promise((fin) => setTimeout(fin, 1_000)),
    ]);
  });
}

/** Thème clair posé avant le chargement : la clé que lisent app.html et le store. */
async function themeClair(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('jurix-theme', 'light'));
}

// ---------------------------------------------------------------------------
// Mesures, dans la page
// ---------------------------------------------------------------------------

/** Les deux modes de navigation d'une barre : liens du bureau, ou bouton du menu. */
const NAVIGATION: Record<Entete, { bureau: string; mobile: string; bureauDansLEcran: boolean }> = {
  site: { bureau: '[data-testid="site-header"] nav', mobile: '[data-testid="nav-mobile-toggle"]', bureauDansLEcran: false },
  // Sous lg, /chat remplace l'en-tête du site par sa barre compacte ; de lg
  // à xl, l'en-tête revient, avec son bouton de menu.
  chat: {
    bureau: '[data-testid="site-header"] nav',
    mobile: '[data-testid="chat-menu-toggle"], [data-testid="nav-mobile-toggle"]',
    bureauDansLEcran: false,
  },
  // L'administration : colonne fixe à partir de lg, tiroir rangé hors de
  // l'écran (et inerte) en dessous.
  admin: { bureau: '[data-testid="admin-sidebar"]', mobile: '[data-testid="admin-menu-toggle"]', bureauDansLEcran: true },
};

/** Éléments qui ne sont ni fixes ni collants, mais qu'aucun élément fixe ne doit couvrir. */
const A_NE_PAS_COUVRIR: Partial<Record<string, string[]>> = {
  '/chat': ['form:has(textarea)'],
};

interface OptionsDeMesure {
  bureau: string;
  mobile: string;
  bureauDansLEcran: boolean;
  aussi: string[];
  seulementRecouvrements: boolean;
}

interface Depassement {
  element: string;
  gauche: number;
  droite: number;
  largeur: number;
}

interface Recouvrement {
  a: string;
  b: string;
  aire: number;
  boiteA: string;
  boiteB: string;
}

interface MesureDeMiseEnPage {
  largeur: number;
  hauteur: number;
  defilable: number;
  depassements: Depassement[];
  bureau: boolean;
  mobile: boolean;
  recouvrements: Recouvrement[];
}

/**
 * Mesure la page telle qu'elle s'affiche. Exécutée DANS la page : rien du
 * fichier qui l'entoure n'y est accessible.
 *
 * Dépassements : un parcours en profondeur porte, d'ancêtre en enfant,
 * l'opacité cumulée, la zone horizontale que les ancêtres laissent voir
 * (`overflow` hidden ou clip) et le fait d'être dans un conteneur qui défile
 * de côté (exempté) ou dans un sous-arbre fixe. L'étendue d'un élément
 * comprend ses propres lignes de texte : un libellé `whitespace-nowrap` peut
 * déborder d'une boîte qui, elle, tient dans l'écran. Un tiroir fixe rangé
 * ENTIÈREMENT hors de l'écran, ou un élément entièrement à gauche (procédé de
 * masquage), ne comptent pas. Seul le premier élément fautif d'une branche
 * est nommé : ses descendants dépassent avec lui.
 */
function mesurerLaMiseEnPage(o: OptionsDeMesure): MesureDeMiseEnPage {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const racine = document.scrollingElement ?? document.documentElement;

  const decrire = (el: Element): string => {
    const testid = el.getAttribute('data-testid');
    const classes = (el.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean);
    const texte = (el.textContent ?? '').replace(/\s+/g, ' ').trim() || el.getAttribute('aria-label') || '';
    return [
      el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ''),
      testid ? `[data-testid="${testid}"]` : '',
      classes.length ? `.${classes.slice(0, 5).join('.')}${classes.length > 5 ? '…' : ''}` : '',
      texte ? `« ${texte.slice(0, 50)}${texte.length > 50 ? '…' : ''} »` : '',
    ]
      .filter(Boolean)
      .join(' ');
  };

  /** Affiché : une boîte, visible, et aucun ancêtre transparent. */
  const affiche = (el: Element | null): boolean => {
    if (!el) return false;
    const boite = el.getBoundingClientRect();
    if (boite.width <= 1 || boite.height <= 1) return false;
    if (getComputedStyle(el).visibility !== 'visible') return false;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || parseFloat(s.opacity) === 0) return false;
    }
    return true;
  };

  // --- Dépassements -------------------------------------------------------
  const depassements: (Depassement & { exces: number })[] = [];
  interface Contexte {
    opacite: number;
    clipG: number;
    clipD: number;
    defile: boolean;
    fixe: boolean;
  }
  const parcourir = (el: Element, ctx: Contexte): void => {
    const s = getComputedStyle(el);
    if (s.display === 'none') return;
    const opacite = ctx.opacite * parseFloat(s.opacity || '1');
    if (opacite <= 0) return;
    const fixe = s.position === 'fixed';
    // Un élément fixe échappe aux rognages de ses ancêtres (sauf transformés,
    // cas absent ici) : il repart de l'écran entier.
    const c: Contexte = fixe
      ? { opacite, clipG: -Infinity, clipD: Infinity, defile: false, fixe: true }
      : { ...ctx, opacite };
    const boite = el.getBoundingClientRect();
    const peint = s.visibility === 'visible' && boite.width > 1 && boite.height > 1;

    if (peint && !c.defile) {
      let g = boite.left;
      let d = boite.right;
      // Un élément qui rogne (`truncate`, overflow hidden) rogne aussi son
      // propre texte : seule la partie dans sa boîte se voit.
      const rognePropre = s.overflowX !== 'visible';
      for (const n of el.childNodes) {
        if (n.nodeType !== Node.TEXT_NODE || !(n.textContent ?? '').trim()) continue;
        const plage = document.createRange();
        plage.selectNodeContents(n);
        const r = plage.getBoundingClientRect();
        if (r.width > 0) {
          g = Math.min(g, rognePropre ? Math.max(r.left, boite.left) : r.left);
          d = Math.max(d, rognePropre ? Math.min(r.right, boite.right) : r.right);
        }
      }
      const vg = Math.max(g, c.clipG);
      const vd = Math.min(d, c.clipD);
      if (vd - vg > 0.5) {
        const horsEcran = vd <= 0 || vg >= W;
        const ignore = vd <= 0 || (horsEcran && c.fixe);
        if (!ignore && (vg < -1 || vd > W + 1)) {
          depassements.push({
            element: decrire(el),
            gauche: Math.round(vg),
            droite: Math.round(vd),
            largeur: Math.round(d - g),
            exces: Math.max(-vg, vd - W),
          });
          return;
        }
      }
    }
    // Les enfants d'une icône SVG n'ont pas de mise en page propre.
    if (el instanceof SVGElement) return;
    const enfant: Contexte = { ...c };
    if (el !== document.body && el !== document.documentElement && s.overflowX !== 'visible') {
      if (s.overflowX === 'auto' || s.overflowX === 'scroll') enfant.defile = true;
      else {
        enfant.clipG = Math.max(c.clipG, boite.left + parseFloat(s.borderLeftWidth));
        enfant.clipD = Math.min(c.clipD, boite.right - parseFloat(s.borderRightWidth));
      }
    }
    for (const e of el.children) parcourir(e, enfant);
  };
  if (!o.seulementRecouvrements) {
    parcourir(document.body, { opacite: 1, clipG: -Infinity, clipD: Infinity, defile: false, fixe: false });
  }

  // --- Modes de navigation ------------------------------------------------
  // Un mode est montré si l'un des éléments qui le portent est affiché.
  const bureau = [...document.querySelectorAll(o.bureau)].some((el) => {
    if (!affiche(el)) return false;
    if (!o.bureauDansLEcran) return true;
    const b = el.getBoundingClientRect();
    return b.right > 1 && b.left < W - 1 && !el.closest('[inert]');
  });
  const mobile = [...document.querySelectorAll(o.mobile)].some(affiche);

  // --- Éléments fixes ou collants qui se couvrent ---------------------------
  const candidats = new Set<Element>();
  for (const el of document.body.querySelectorAll('*')) {
    const position = getComputedStyle(el).position;
    if (position === 'fixed' || position === 'sticky') candidats.add(el);
  }
  for (const selecteur of o.aussi) document.querySelectorAll(selecteur).forEach((el) => candidats.add(el));
  const retenus = [...candidats].filter((el) => {
    if (!affiche(el)) return false;
    // Un candidat dans un autre ne compte qu'une fois, par son conteneur.
    for (let p = el.parentElement; p; p = p.parentElement) if (candidats.has(p)) return false;
    const b = el.getBoundingClientRect();
    if (b.right <= 0 || b.left >= W || b.bottom <= 0 || b.top >= H) return false;
    // Un voile ou une fenêtre plein écran couvre tout, à dessein.
    if (b.width >= W * 0.9 && b.height >= H * 0.9) return false;
    // Un élément qui laisse passer les appuis ne gêne rien.
    if (getComputedStyle(el).pointerEvents === 'none') return false;
    return true;
  });
  const boiteEnTexte = (b: DOMRect) =>
    `${Math.round(b.left)},${Math.round(b.top)} → ${Math.round(b.right)},${Math.round(b.bottom)}`;
  const recouvrements: Recouvrement[] = [];
  for (let i = 0; i < retenus.length; i++) {
    for (let j = i + 1; j < retenus.length; j++) {
      const a = retenus[i].getBoundingClientRect();
      const b = retenus[j].getBoundingClientRect();
      const larg = Math.min(a.right, b.right, W) - Math.max(a.left, b.left, 0);
      const haut = Math.min(a.bottom, b.bottom, H) - Math.max(a.top, b.top, 0);
      if (larg > 1 && haut > 1) {
        recouvrements.push({
          a: decrire(retenus[i]),
          b: decrire(retenus[j]),
          aire: Math.round(larg * haut),
          boiteA: boiteEnTexte(a),
          boiteB: boiteEnTexte(b),
        });
      }
    }
  }

  return {
    largeur: W,
    hauteur: H,
    defilable: racine.scrollWidth,
    depassements: depassements
      .sort((x, y) => y.exces - x.exces)
      .slice(0, 10)
      .map(({ exces: _exces, ...reste }) => reste),
    bureau,
    mobile,
    recouvrements,
  };
}

/** Le chemin et la taille d'écran, en tête de chaque message. */
const lieu = (chemin: string, page: Page) => {
  const taille = page.viewportSize();
  return `${chemin} ${taille?.width}x${taille?.height}`;
};

/**
 * Les cinq vérifications d'un pas du balayage. Souples : un seul passage
 * rapporte toutes les largeurs fautives.
 */
async function verifierLaMiseEnPage(page: Page, parcours: PageDuSite, chemin: string): Promise<void> {
  const ou = lieu(chemin, page);
  const options: OptionsDeMesure = {
    ...NAVIGATION[parcours.entete],
    aussi: A_NE_PAS_COUVRIR[parcours.nom] ?? [],
    seulementRecouvrements: false,
  };
  await page.evaluate(() => window.scrollTo(0, 0));
  await deuxImages(page);
  const m = await page.evaluate(mesurerLaMiseEnPage, options);

  const fautifs = m.depassements
    .map((d) => `  - ${d.element} : de ${d.gauche} à ${d.droite} px (${d.largeur} px de large)`)
    .join('\n');
  expect
    .soft(
      m.defilable,
      `${ou} : la page glisse de côté, ${m.defilable} px de contenu pour ${m.largeur} px d'écran.\n${fautifs || '  (aucun élément nommable)'}`,
    )
    .toBeLessThanOrEqual(m.largeur + 1);
  expect.soft(m.depassements, `${ou} : des éléments sortent de l'écran (${m.largeur} px) :\n${fautifs}`).toEqual([]);

  const modes = `liens du bureau ${m.bureau ? 'affichés' : 'masqués'}, bouton du menu ${m.mobile ? 'affiché' : 'masqué'}`;
  expect.soft(m.bureau !== m.mobile, `${ou} : il faut UN mode de navigation, pas ${m.bureau ? 'deux' : 'aucun'} (${modes})`).toBe(true);

  const recouvert = (liste: Recouvrement[], moment: string) =>
    liste.map((r) => `  - ${r.a} [${r.boiteA}] et ${r.b} [${r.boiteB}] : ${r.aire} px² ${moment}`).join('\n');
  expect.soft(m.recouvrements, `${ou} : des éléments fixes se couvrent :\n${recouvert(m.recouvrements, 'en haut de page')}`).toEqual([]);

  // Le contenu principal, toujours là et entier en largeur.
  const principal = parcours.principal(page);
  await expect.soft(principal, `${ou} : le contenu principal n'est plus visible`).toBeVisible({ timeout: 2_000 });
  const boite = await principal.boundingBox().catch(() => null);
  if (boite) {
    expect
      .soft(
        Math.round(boite.x) >= -1 && Math.round(boite.x + boite.width) <= m.largeur + 1,
        `${ou} : le contenu principal sort de l'écran (de ${Math.round(boite.x)} à ${Math.round(boite.x + boite.width)} px pour ${m.largeur})`,
      )
      .toBe(true);
  }

  // À mi-défilement, les éléments collants sont « collés » : ils peuvent
  // alors rencontrer un élément fixe.
  const milieu = await page.evaluate(() => {
    const max = (document.scrollingElement ?? document.documentElement).scrollHeight - window.innerHeight;
    if (max > 40) window.scrollTo(0, Math.round(max / 2));
    return max > 40;
  });
  if (milieu) {
    await deuxImages(page);
    const auMilieu = await page.evaluate(mesurerLaMiseEnPage, { ...options, seulementRecouvrements: true });
    expect
      .soft(auMilieu.recouvrements, `${ou} : des éléments fixes se couvrent :\n${recouvert(auMilieu.recouvrements, 'à mi-défilement')}`)
      .toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
}

// ---------------------------------------------------------------------------
// 1. Balayage en direct : de 1 920 à 320 px, puis retour à 1 440
// ---------------------------------------------------------------------------

test.describe('redimensionnement en direct', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const parcours of PAGES) {
    test(`${parcours.nom} : de 1 920 à 320 px et retour, sans recharger`, async ({ page, request }) => {
      test.setTimeout(300_000);
      await themeClair(page);
      const chemin = await ouvrirAuRepos(parcours, page, request);
      for (const largeur of [...LARGEURS, 1440]) {
        await redimensionner(page, largeur, hauteurPour(largeur));
        await verifierLaMiseEnPage(page, parcours, chemin);
      }
    });
  }

  /**
   * L'en-tête le plus chargé : un administrateur connecté (icône
   * « Administration », nom, « Se déconnecter ») au profil le plus long
   * (« Étudiant en droit », affiché à partir de 2xl). C'est sur lui que les
   * paliers de SiteHeader.svelte sont calculés ; les pages, ouvertes sans
   * session, ne montrent que « Se connecter » et « Créer un compte ».
   */
  test('/about, administrateur connecté : l’en-tête le plus chargé, de 1 920 à 320 px et retour', async ({ page }) => {
    test.setTimeout(300_000);
    await themeClair(page);
    await connecter(page, SUPERADMIN);
    await page.addInitScript(() => localStorage.setItem('jurix-persona', 'étudiant'));
    // L'API refuserait le jeton factice, et un 401 déconnecte (src/lib/api.ts).
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...SUPERADMIN, persona: 'étudiant' }),
      }),
    );
    await ouvrirAuServeur(page, '/about');
    await attendreLeRepos(page);
    await expect(page.getByTestId('user-name')).toBeVisible();
    const parcours = PAGES.find((p) => p.nom === '/about');
    if (!parcours) throw new Error('/about absente de tests/e2e/pages-du-site.ts');
    for (const largeur of [...LARGEURS, 1440]) {
      await redimensionner(page, largeur, hauteurPour(largeur));
      await verifierLaMiseEnPage(page, parcours, '/about (administrateur connecté)');
    }
  });

  /**
   * Le chat d'un compte connecté : la colonne des conversations s'ajoute à
   * partir de lg, à côté de la conversation. Ouvert sans session, /chat n'a
   * pas cette colonne : la largeur qu'elle prend n'était jamais balayée.
   */
  test('/chat, compte connecté : la colonne des conversations, de 1 920 à 320 px et retour', async ({ page, request }) => {
    test.setTimeout(300_000);
    await themeClair(page);
    await connecter(page, MEMBRE);
    const parcours = PAGES.find((p) => p.nom === '/chat');
    if (!parcours) throw new Error('/chat absente de tests/e2e/pages-du-site.ts');
    const chemin = await ouvrirAuRepos(parcours, page, request);
    await expect(page.getByTestId('conversations-panel')).toBeAttached();
    for (const largeur of [...LARGEURS, 1440]) {
      await redimensionner(page, largeur, hauteurPour(largeur));
      await verifierLaMiseEnPage(page, parcours, `${chemin} (compte connecté)`);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Écrans courts : l'action principale s'atteint, le contenu défile
// ---------------------------------------------------------------------------

const ECRANS_COURTS: Taille[] = [
  { largeur: 740, hauteur: 360, telephone: true },
  { largeur: 844, hauteur: 390, telephone: true },
  { largeur: 1024, hauteur: 600, telephone: false },
  { largeur: 1280, hauteur: 600, telephone: false },
];

/** Ce que toucherait un doigt sur `cible` : `null` si chaque point sondé l'atteint. */
async function ceQuiCouvre(cible: Locator): Promise<string | null> {
  return cible.evaluate((el) => {
    const decrire = (n: Element) => {
      const testid = n.getAttribute('data-testid');
      const nom = n.getAttribute('aria-label');
      return n.tagName.toLowerCase() + (n.id ? `#${n.id}` : '') + (testid ? `[data-testid="${testid}"]` : '') + (nom ? ` « ${nom} »` : '');
    };
    const b = el.getBoundingClientRect();
    for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.5], [0.8, 0.5], [0.5, 0.2], [0.5, 0.8]]) {
      const x = b.left + b.width * fx;
      const y = b.top + b.height * fy;
      const ou = `en (${Math.round(x)}, ${Math.round(y)})`;
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) {
        return `hors de l'écran ${ou} (${window.innerWidth}×${window.innerHeight}, boîte ${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}×${Math.round(b.height)})`;
      }
      const touche = document.elementFromPoint(x, y);
      if (!touche) return `rien ${ou}`;
      if (!el.contains(touche)) return `${decrire(touche)} ${ou}`;
    }
    return null;
  });
}

for (const taille of ECRANS_COURTS) {
  const dimensions = `${taille.largeur}x${taille.hauteur}`;

  test.describe(`${dimensions} (écran court)`, () => {
    test.use(reglages(taille));

    for (const parcours of PAGES) {
      test(`${parcours.nom} : l’action principale s’atteint, le contenu défile`, async ({ page, request }) => {
        await themeClair(page);
        const chemin = await ouvrirAuRepos(parcours, page, request);
        const ou = lieu(chemin, page);

        const largeurs = await page.evaluate(() => ({
          contenu: (document.scrollingElement ?? document.documentElement).scrollWidth,
          ecran: window.innerWidth,
        }));
        expect.soft(largeurs.contenu, `${ou} : la page glisse de côté (${largeurs.contenu} px pour ${largeurs.ecran})`).toBeLessThanOrEqual(largeurs.ecran + 1);

        // L'action principale : amenée à l'écran, puis sondée au doigt.
        const action = parcours.action(page);
        await expect(action, `${ou} : action principale introuvable`).toBeVisible();
        await action.scrollIntoViewIfNeeded();
        await deuxImages(page);
        const couverte = await ceQuiCouvre(action);
        expect.soft(couverte, `${ou} : l'action principale ne reçoit pas l'appui : ${couverte}`).toBeNull();

        if (parcours.entete === 'chat') {
          // Le chat ne fait pas défiler la page, à dessein (h-app) : c'est la
          // conversation qui défile, et la saisie reste à l'écran.
          const journal = await page.getByRole('log').evaluate((el) => {
            const avant = el.scrollTop;
            el.scrollTop = el.scrollHeight;
            const apres = el.scrollTop;
            el.scrollTop = avant;
            return { debordant: el.scrollHeight > el.clientHeight + 1, apres };
          });
          if (journal.debordant) expect.soft(journal.apres, `${ou} : la conversation ne défile pas`).toBeGreaterThan(0);
          await expect.soft(saisieDuChat(page), `${ou} : la saisie du chat n'est pas à l'écran`).toBeInViewport();
          return;
        }

        const defilement = await page.evaluate(async () => {
          const racine = document.scrollingElement ?? document.documentElement;
          const max = racine.scrollHeight - window.innerHeight;
          window.scrollTo(0, max);
          await new Promise((fin) => requestAnimationFrame(() => requestAnimationFrame(fin)));
          const atteint = racine.scrollTop;
          window.scrollTo(0, 0);
          return {
            max,
            atteint,
            verrou: [document.body, document.documentElement].some((n) => getComputedStyle(n).overflowY === 'hidden'),
          };
        });
        expect.soft(defilement.verrou, `${ou} : le défilement de la page est verrouillé (overflow hidden)`).toBe(false);
        if (defilement.max > 1) {
          expect
            .soft(defilement.atteint, `${ou} : la page ne défile pas (${defilement.max} px de plus que l'écran)`)
            .toBeGreaterThan(0);
        }
      });
    }
  });
}

// ---------------------------------------------------------------------------
// 3. États qui traversent un redimensionnement
// ---------------------------------------------------------------------------

/** Un voile plein écran affiché (fond de tiroir, de fenêtre). */
async function voileAffiche(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    for (const el of document.body.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (s.position !== 'fixed' || s.visibility !== 'visible' || parseFloat(s.opacity) === 0) continue;
      const b = el.getBoundingClientRect();
      if (b.width >= window.innerWidth * 0.9 && b.height >= window.innerHeight * 0.9 && s.pointerEvents !== 'none') {
        return `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').split(/\s+/).slice(0, 4).join('.')}`;
      }
    }
    return null;
  });
}

/** Le défilement de la page n'est pas resté verrouillé (body ou html en overflow hidden). */
async function defilementLibre(page: Page): Promise<boolean> {
  return page.evaluate(
    () => ![document.body, document.documentElement].some((n) => getComputedStyle(n).overflowY === 'hidden'),
  );
}

/** La page défile, si elle est plus haute que l'écran. */
async function pageDefile(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const racine = document.scrollingElement ?? document.documentElement;
    const max = racine.scrollHeight - window.innerHeight;
    if (max <= 1) return true;
    window.scrollTo(0, max);
    await new Promise((fin) => requestAnimationFrame(() => requestAnimationFrame(fin)));
    const ok = racine.scrollTop > 0;
    window.scrollTo(0, 0);
    return ok;
  });
}

/** La boîte de `cible` tient en largeur dans l'écran. */
async function tientEnLargeur(page: Page, cible: Locator): Promise<string | null> {
  const boite = await cible.boundingBox();
  const largeur = page.viewportSize()?.width ?? 0;
  if (!boite) return 'aucune boîte';
  const g = Math.round(boite.x);
  const d = Math.round(boite.x + boite.width);
  return g >= -1 && d <= largeur + 1 ? null : `de ${g} à ${d} px pour ${largeur} px d'écran`;
}

test.describe('états à travers un redimensionnement', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('menu du site ouvert à 390 px, puis 1 280 et retour', async ({ page }) => {
    await themeClair(page);
    await ouvrirAuServeur(page, '/about');
    await attendreLeRepos(page);
    const bascule = page.getByTestId('nav-mobile-toggle');
    const panneau = page.getByTestId('nav-mobile-panel');
    await cliquerJusqualEffet(bascule, panneau);

    await redimensionner(page, 1280, 900);
    const ou = '/about 1280x900, menu ouvert à 390 px';
    await expect.soft(panneau, `${ou} : le panneau du menu reste affiché`).toBeHidden();
    await expect.soft(page.locator('[data-testid="site-header"] nav'), `${ou} : pas de liens du bureau`).toBeVisible();
    expect.soft(await voileAffiche(page), `${ou} : un voile couvre la page`).toBeNull();
    expect.soft(await defilementLibre(page), `${ou} : le défilement reste verrouillé`).toBe(true);
    expect.soft(await pageDefile(page), `${ou} : la page ne défile pas`).toBe(true);

    await redimensionner(page, 390, 844);
    const retour = '/about 390x844, après 1 280 px';
    // Rouvert ou refermé, mais jamais l'un sans l'autre : le bouton dit l'état du panneau.
    const ouvert = await panneau.isVisible();
    await expect.soft(bascule, `${retour} : aria-expanded ne suit pas le panneau`).toHaveAttribute('aria-expanded', String(ouvert));
    expect.soft(await defilementLibre(page), `${retour} : le défilement reste verrouillé`).toBe(true);
  });

  /**
   * De lg à xl, la barre garde les liens et range les réglages et le compte
   * dans un menu (`nav-reglages-toggle`, SiteHeader.svelte) : c'est ainsi que
   * « Créer un compte » a cessé d'être coupé à 1 024 px. Le balayage vérifie
   * que rien ne dépasse ; il ne dit pas que le compte s'atteint encore. Ici :
   * ouvert à 1 100 px, le menu montre « Créer un compte » entier et sous le
   * doigt, sans répéter les liens de la barre ; à 1 440 px, il s'efface et la
   * barre complète reprend le bouton ; à 390 px, le bouton du menu dit l'état
   * du panneau.
   */
  test('menu des réglages ouvert à 1 100 px, puis 1 440 et 390', async ({ page }) => {
    await themeClair(page);
    await redimensionner(page, 1100, 900);
    await ouvrirAuServeur(page, '/about');
    await attendreLeRepos(page);
    const panneau = page.getByTestId('nav-mobile-panel');
    await cliquerJusqualEffet(page.getByTestId('nav-reglages-toggle'), panneau);
    await attendreLeRepos(page);

    const ou = '/about 1100x900, menu des réglages ouvert';
    const inscription = page.getByTestId('nav-signup-mobile');
    expect.soft(await tientEnLargeur(page, inscription), `${ou} : « Créer un compte » sort de l'écran`).toBeNull();
    expect.soft(await ceQuiCouvre(inscription), `${ou} : « Créer un compte » ne reçoit pas l'appui`).toBeNull();
    // Une seule navigation à l'écran : les liens sont dans la barre, pas une
    // seconde fois dans le panneau.
    await expect.soft(page.locator('[data-testid="site-header"] nav'), `${ou} : plus de liens dans la barre`).toBeVisible();
    await expect.soft(panneau.locator('nav'), `${ou} : les liens de la barre sont répétés dans le panneau`).toBeHidden();

    await redimensionner(page, 1440, 900);
    const large = '/about 1440x900, menu des réglages ouvert à 1 100 px';
    await expect.soft(panneau, `${large} : le panneau reste affiché`).toBeHidden();
    await expect.soft(page.getByTestId('nav-signup'), `${large} : « Créer un compte » absent de la barre`).toBeVisible();
    expect.soft(await tientEnLargeur(page, page.getByTestId('nav-signup')), `${large} : « Créer un compte » sort de l'écran`).toBeNull();
    expect.soft(await voileAffiche(page), `${large} : un voile couvre la page`).toBeNull();
    expect.soft(await defilementLibre(page), `${large} : le défilement reste verrouillé`).toBe(true);

    await redimensionner(page, 390, 844);
    const etroit = '/about 390x844, après 1 440 px';
    const ouvert = await panneau.isVisible();
    await expect
      .soft(page.getByTestId('nav-mobile-toggle'), `${etroit} : aria-expanded ne suit pas le panneau`)
      .toHaveAttribute('aria-expanded', String(ouvert));
    expect.soft(await defilementLibre(page), `${etroit} : le défilement reste verrouillé`).toBe(true);
  });

  test('tiroir des conversations ouvert à 390 px, puis 1 280 et retour', async ({ page }) => {
    await themeClair(page);
    await connecter(page, MEMBRE);
    await simulerLeChat(page);
    await page.goto('/chat');
    await attendreLeRepos(page);
    const bascule = page.getByTestId('conversations-toggle');
    const panneau = page.getByTestId('conversations-panel');
    const premiere = page.getByTestId('conversation-item').first();
    await cliquerJusqualEffet(bascule, page.locator('[data-testid="conversations-toggle"][aria-expanded="true"]'));
    await expect(premiere).toBeInViewport();

    await redimensionner(page, 1280, 900);
    const ou = '/chat 1280x900, tiroir ouvert à 390 px';
    // Le tiroir devient la colonne : à l'écran, sans voile, sans piège.
    await expect.soft(premiere, `${ou} : la liste des conversations n'est plus à l'écran`).toBeInViewport();
    await expect.soft(panneau, `${ou} : la colonne est encore une fenêtre modale`).not.toHaveAttribute('role', 'dialog');
    expect.soft(await voileAffiche(page), `${ou} : un voile couvre la page`).toBeNull();
    expect.soft(await defilementLibre(page), `${ou} : le défilement reste verrouillé`).toBe(true);
    const journalDefile = await page.getByRole('log').evaluate((el) => getComputedStyle(el).overflowY);
    expect.soft(['auto', 'scroll'], `${ou} : la conversation ne défile plus (${journalDefile})`).toContain(journalDefile);

    await redimensionner(page, 390, 844);
    const retour = '/chat 390x844, après 1 280 px';
    await expect.soft(bascule, `${retour} : le tiroir s'est rouvert`).toHaveAttribute('aria-expanded', 'false');
    await expect.soft(premiere, `${retour} : le tiroir couvre la conversation`).not.toBeInViewport();
    expect.soft(await voileAffiche(page), `${retour} : un voile couvre la page`).toBeNull();
    expect.soft(await defilementLibre(page), `${retour} : le défilement reste verrouillé`).toBe(true);
  });

  test('tiroir de l’administration ouvert à 390 px, puis 1 280 et retour', async ({ page }) => {
    await themeClair(page);
    await simulerLAdministration(page);
    await page.goto('/admin/users');
    await attendreLeRepos(page);
    const bascule = page.getByTestId('admin-menu-toggle');
    const tiroir = page.getByTestId('admin-sidebar');
    await cliquerJusqualEffet(bascule, page.locator('[data-testid="admin-menu-toggle"][aria-expanded="true"]'));
    await expect(tiroir).toBeInViewport();

    await redimensionner(page, 1280, 900);
    const ou = '/admin/users 1280x900, tiroir ouvert à 390 px';
    await expect.soft(tiroir, `${ou} : la colonne n'est pas à l'écran`).toBeInViewport({ ratio: 0.99 });
    await expect.soft(tiroir, `${ou} : la colonne reste inerte`).not.toHaveAttribute('inert', /.*/);
    await expect.soft(page.locator('main'), `${ou} : le contenu reste inerte`).not.toHaveAttribute('inert', /.*/);
    expect.soft(await voileAffiche(page), `${ou} : un voile couvre la page`).toBeNull();
    expect.soft(await defilementLibre(page), `${ou} : le défilement reste verrouillé`).toBe(true);
    expect.soft(await pageDefile(page), `${ou} : la page ne défile pas`).toBe(true);

    await redimensionner(page, 390, 844);
    const retour = '/admin/users 390x844, après 1 280 px';
    await expect.soft(bascule, `${retour} : le tiroir s'est rouvert`).toHaveAttribute('aria-expanded', 'false');
    await expect.soft(tiroir, `${retour} : le tiroir couvre la page`).not.toBeInViewport();
    expect.soft(await voileAffiche(page), `${retour} : un voile couvre la page`).toBeNull();
    expect.soft(await defilementLibre(page), `${retour} : le défilement reste verrouillé`).toBe(true);
  });

  test('choix du profil ouvert à 1 440 px, puis 390', async ({ page }) => {
    await themeClair(page);
    await redimensionner(page, 1440, 900);
    await ouvrirAuServeur(page, '/about');
    await attendreLeRepos(page);
    const fenetre = page.getByTestId('persona-dialog');
    await cliquerJusqualEffet(page.getByTestId('persona-toggle'), fenetre);

    await redimensionner(page, 390, 844);
    const ou = '/about 390x844, choix du profil ouvert à 1 440 px';
    expect.soft(await tientEnLargeur(page, fenetre), `${ou} : la fenêtre sort de l'écran`).toBeNull();
    // La fenêtre défile dans son voile : sa fin (« Ne pas répondre ») s'atteint.
    const fin = page.getByTestId('persona-skip');
    await fin.scrollIntoViewIfNeeded();
    expect.soft(await ceQuiCouvre(fin), `${ou} : la fin de la fenêtre ne s'atteint pas`).toBeNull();
    const fermer = page.getByTestId('persona-dialog-close');
    await fermer.scrollIntoViewIfNeeded();
    expect.soft(await ceQuiCouvre(fermer), `${ou} : le bouton de fermeture ne s'atteint pas`).toBeNull();
    const cible = await fermer.boundingBox();
    expect.soft(Math.round(Math.min(cible?.width ?? 0, cible?.height ?? 0)), `${ou} : bouton de fermeture trop petit au doigt`).toBeGreaterThanOrEqual(CIBLE_MIN);
    await fermer.click();
    await expect(fenetre).toBeHidden();
    expect.soft(await defilementLibre(page), `${ou} : le défilement reste verrouillé après fermeture`).toBe(true);
  });

  test('fenêtre d’un compte (administration) ouverte à 1 440 px, puis 390', async ({ page }) => {
    await themeClair(page);
    await redimensionner(page, 1440, 900);
    await simulerLAdministration(page);
    await page.goto('/admin/users');
    await attendreLeRepos(page);
    const voile = page.getByTestId('user-modal');
    await cliquerJusqualEffet(page.getByTestId('user-new'), voile);
    const fenetre = voile.getByRole('dialog');

    await redimensionner(page, 390, 844);
    const ou = '/admin/users 390x844, fenêtre ouverte à 1 440 px';
    expect.soft(await tientEnLargeur(page, fenetre), `${ou} : la fenêtre sort de l'écran`).toBeNull();
    const boite = await fenetre.boundingBox();
    expect.soft(Math.round((boite?.y ?? 0) + (boite?.height ?? 0)), `${ou} : la fenêtre dépasse en bas`).toBeLessThanOrEqual(845);
    expect.soft(Math.round(boite?.y ?? -1), `${ou} : la fenêtre dépasse en haut`).toBeGreaterThanOrEqual(0);
    const fermer = page.getByTestId('user-modal-close');
    expect.soft(await ceQuiCouvre(fermer), `${ou} : le bouton de fermeture ne s'atteint pas`).toBeNull();
    const enregistrer = page.getByTestId('user-modal-save');
    await enregistrer.scrollIntoViewIfNeeded();
    expect.soft(await ceQuiCouvre(enregistrer), `${ou} : « Enregistrer » ne s'atteint pas`).toBeNull();
    await fermer.click();
    await expect(voile).toBeHidden();
    expect.soft(await defilementLibre(page), `${ou} : le défilement reste verrouillé après fermeture`).toBe(true);
  });

  test('sommaire d’une loi ouvert à 390 px, puis 1 280 et retour', async ({ page, request }) => {
    await themeClair(page);
    const id = await loiAvecArticles(request);
    exiger(id, 'aucune loi avec des articles : API injoignable ou corpus vide');
    await ouvrirAuServeur(page, `/laws/${id}`);
    await attendreLeRepos(page);
    const bascule = page.getByTestId('law-toc-toggle');
    const sommaire = page.getByTestId('law-toc');
    await cliquerJusqualEffet(bascule, sommaire);
    await expect(sommaire).toHaveAttribute('role', 'dialog');

    await redimensionner(page, 1280, 900);
    const ou = `/laws/${id} 1280x900, sommaire ouvert à 390 px`;
    await expect.soft(sommaire, `${ou} : le sommaire n'est plus la colonne`).toBeVisible();
    await expect.soft(sommaire, `${ou} : le sommaire est encore une fenêtre modale`).not.toHaveAttribute('role', 'dialog');
    expect.soft(await voileAffiche(page), `${ou} : un voile couvre la page`).toBeNull();
    expect.soft(await defilementLibre(page), `${ou} : le défilement reste verrouillé`).toBe(true);
    expect.soft(await pageDefile(page), `${ou} : la page ne défile pas`).toBe(true);

    await redimensionner(page, 390, 844);
    const retour = `/laws/${id} 390x844, après 1 280 px`;
    await expect.soft(bascule, `${retour} : le sommaire s'est rouvert`).toHaveAttribute('aria-expanded', 'false');
    await expect.soft(sommaire, `${retour} : le sommaire couvre la page`).toBeHidden();
    expect.soft(await defilementLibre(page), `${retour} : le défilement reste verrouillé`).toBe(true);
  });
});

test.describe('/chat tourné', () => {
  test.use(reglages({ largeur: 390, hauteur: 844, telephone: true }));

  test('de 390×844 à 844×390 : la saisie reste à l’écran', async ({ page }) => {
    await themeClair(page);
    await simulerLeChat(page);
    await page.goto('/chat');
    await attendreLeRepos(page);
    await expect(saisieDuChat(page)).toBeInViewport();

    await redimensionner(page, 844, 390);
    const ou = '/chat 844x390, tourné depuis 390x844';
    for (const [cible, nom] of [
      [saisieDuChat(page), 'la saisie'],
      [boutonDEnvoi(page), 'le bouton d’envoi'],
    ] as const) {
      await expect.soft(cible, `${ou} : ${nom} n'est pas entière à l'écran`).toBeInViewport({ ratio: 1 });
      expect.soft(await ceQuiCouvre(cible), `${ou} : ${nom} ne reçoit pas l'appui`).toBeNull();
    }
    const largeurs = await page.evaluate(() => ({
      contenu: (document.scrollingElement ?? document.documentElement).scrollWidth,
      ecran: window.innerWidth,
    }));
    expect.soft(largeurs.contenu, `${ou} : la page glisse de côté`).toBeLessThanOrEqual(largeurs.ecran + 1);
  });
});

// ---------------------------------------------------------------------------
// 4. Au doigt : des cibles de 44 × 44 px
// ---------------------------------------------------------------------------

interface CibleMesuree {
  element: string;
  largeur: number;
  hauteur: number;
}

/**
 * Les cibles d'appui de l'en-tête et du contenu, et leur taille. Exécutée
 * dans la page.
 *
 * La taille d'une cible est celle de sa boîte, étendue par un ::before ou un
 * ::after en position absolue (« Mot de passe oublié ? » agrandit ainsi sa
 * zone d'appui sans décaler la ligne). Une case ou un bouton radio se mesure
 * par son <label> : c'est lui qu'on touche. Un lien pris dans une phrase
 * (affiché en ligne, entouré de texte, ou dans un texte rendu `prose`) suit
 * la phrase : il est exempté.
 *
 * LE LIEN ÉTENDU (Q3 A, liste des domaines de l'accueil) : le lien, en ligne
 * et non positionné, ne porte que le nom du domaine (20 px de haut), mais son
 * ::after, en `inset-0`, couvre toute la ligne de la liste (64 px), son bloc
 * conteneur étant le premier ancêtre positionné. C'est cette ligne qu'on
 * touche : elle est mesurée. Seul un pseudo-élément aux quatre bords posés
 * compte ainsi, pour qu'un filet décoratif ne grandisse pas une cible.
 */
function mesurerLesCibles(minimum: number): CibleMesuree[] {
  const SELECTEUR =
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], ' +
    '[role="switch"], [role="tab"], [role="checkbox"], [role="radio"], [role="menuitem"]';

  const decrire = (el: Element): string => {
    const testid = el.getAttribute('data-testid');
    const classes = (el.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean);
    const texte =
      (el.textContent ?? '').replace(/\s+/g, ' ').trim() || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    const chemin: string[] = [];
    for (let n = el.parentElement; n && n !== document.body && chemin.length < 2; n = n.parentElement) {
      chemin.unshift(n.tagName.toLowerCase() + (n.id ? `#${n.id}` : '') + (n.getAttribute('data-testid') ? `[data-testid="${n.getAttribute('data-testid')}"]` : ''));
    }
    return [
      `${chemin.join(' > ')} > ${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
      testid ? `[data-testid="${testid}"]` : '',
      classes.length ? `.${classes.slice(0, 4).join('.')}${classes.length > 4 ? '…' : ''}` : '',
      texte ? `« ${texte.slice(0, 40)}${texte.length > 40 ? '…' : ''} »` : '',
    ]
      .filter(Boolean)
      .join(' ');
  };

  const affiche = (el: Element): boolean => {
    const b = el.getBoundingClientRect();
    if (b.width <= 1 || b.height <= 1) return false;
    if (getComputedStyle(el).visibility !== 'visible') return false;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || parseFloat(s.opacity) === 0) return false;
    }
    return !el.closest('[inert]');
  };

  /** Lien dans une phrase : en ligne, et le bloc qui le porte a d'autre texte que lui. */
  const dansUnePhrase = (el: Element): boolean => {
    if (el.closest('.prose')) return true;
    if (el.tagName !== 'A' || getComputedStyle(el).display !== 'inline') return false;
    let bloc = el.parentElement;
    while (bloc && ['inline', 'contents'].includes(getComputedStyle(bloc).display)) bloc = bloc.parentElement;
    if (!bloc) return false;
    const tout = (bloc.textContent ?? '').replace(/\s+/g, '');
    const lui = (el.textContent ?? '').replace(/\s+/g, '');
    return tout.length > lui.length;
  };

  /** Le premier ancêtre positionné : le bloc conteneur d'un pseudo-élément absolu d'un élément statique. */
  const ancetrePositionne = (el: Element): Element | null => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      if (getComputedStyle(n).position !== 'static') return n;
    }
    return null;
  };

  const taille = (el: Element) => {
    const b = el.getBoundingClientRect();
    let [g, h, d, bas] = [b.left, b.top, b.right, b.bottom];
    const s = getComputedStyle(el);
    // Bloc conteneur des pseudo-éléments absolus : l'élément s'il est
    // positionné (hors élément en ligne, au bloc conteneur particulier), sinon
    // son premier ancêtre positionné (le lien étendu, voir plus haut).
    const statique = s.position === 'static';
    const conteneur = !statique && s.display !== 'inline' ? el : statique ? ancetrePositionne(el) : null;
    if (conteneur) {
      const bc = conteneur.getBoundingClientRect();
      const sc = getComputedStyle(conteneur);
      const cg = bc.left + parseFloat(sc.borderLeftWidth);
      const ch = bc.top + parseFloat(sc.borderTopWidth);
      const cd = bc.right - parseFloat(sc.borderRightWidth);
      const cb = bc.bottom - parseFloat(sc.borderBottomWidth);
      for (const pseudo of ['::before', '::after']) {
        const p = getComputedStyle(el, pseudo);
        if (p.content === 'none' || p.content === 'normal' || p.display === 'none' || p.position !== 'absolute') continue;
        const val = (v: string) => (v === 'auto' ? null : parseFloat(v));
        const [top, right, bottom, left] = [val(p.top), val(p.right), val(p.bottom), val(p.left)];
        if (conteneur !== el && [top, right, bottom, left].some((v) => v === null)) continue;
        const w = parseFloat(p.width);
        const hh = parseFloat(p.height);
        const pg = left !== null ? cg + left : right !== null && !Number.isNaN(w) ? cd - right - w : cg;
        const pd = right !== null ? cd - right : pg + (Number.isNaN(w) ? 0 : w);
        const ph = top !== null ? ch + top : bottom !== null && !Number.isNaN(hh) ? cb - bottom - hh : ch;
        const pb = bottom !== null ? cb - bottom : ph + (Number.isNaN(hh) ? 0 : hh);
        [g, h, d, bas] = [Math.min(g, pg), Math.min(h, ph), Math.max(d, pd), Math.max(bas, pb)];
      }
    }
    return { largeur: d - g, hauteur: bas - h };
  };

  const vus = new Set<Element>();
  const petites: CibleMesuree[] = [];
  for (const zone of document.querySelectorAll('header, main')) {
    for (const el of zone.querySelectorAll(SELECTEUR)) {
      let cible: Element = el;
      if (el instanceof HTMLInputElement && ['checkbox', 'radio', 'file'].includes(el.type)) {
        cible =
          el.closest('label') ?? (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null) ?? el;
      }
      if (vus.has(cible)) continue;
      vus.add(cible);
      if (!affiche(cible) || dansUnePhrase(cible)) continue;
      const { largeur, hauteur } = taille(cible);
      if (largeur < minimum - 0.5 || hauteur < minimum - 0.5) {
        petites.push({ element: decrire(cible), largeur: Math.round(largeur * 10) / 10, hauteur: Math.round(hauteur * 10) / 10 });
      }
    }
  }
  return petites;
}

test.describe('390x844 au doigt', () => {
  test.use(reglages({ largeur: 390, hauteur: 844, telephone: true }));

  for (const parcours of PAGES) {
    test(`${parcours.nom} : des cibles de 44 × 44 px au moins`, async ({ page, request }) => {
      await themeClair(page);
      const chemin = await ouvrirAuRepos(parcours, page, request);
      const petites = await page.evaluate(mesurerLesCibles, CIBLE_MIN);
      expect(
        petites.map((c) => `${c.element} : ${c.largeur} × ${c.hauteur} px`),
        `${lieu(chemin, page)} : ${petites.length} cible(s) de moins de ${CIBLE_MIN} × ${CIBLE_MIN} px`,
      ).toEqual([]);
    });
  }
});

/** Contrôle : la largeur `lg` du site, pour qui lit ce fichier sans tailwind.config.js. */
test('le balayage passe de part et d’autre de lg', () => {
  expect(LARGEURS).toContain(LARGEUR_LG);
  expect(LARGEURS).toContain(LARGEUR_LG - 1);
});
