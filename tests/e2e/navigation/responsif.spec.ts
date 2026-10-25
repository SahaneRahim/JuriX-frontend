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

import { devices, expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import type {
  AnalyticsOverview,
  AnalyticsSearch,
  AnalyticsUsage,
  Category,
  ComparisonResponse,
  ConversationDetail,
  ConversationSummary,
  Law,
  LawStatus,
  LawType,
  SearchResponse,
  SearchResult,
  SourceRef,
  User,
} from '../../../src/lib/types';
import { cliquerJusqualEffet, saisirJusqualEffet } from '../hydratation';

const API = process.env.VITE_API_URL ?? 'http://localhost:8000';
const EXIGER_BACKEND = process.env.E2E_EXIGER_BACKEND === '1';

/**
 * Point de rupture `lg` de Tailwind, où le plan met la bascule : en dessous,
 * en-tête compact et conversations en tiroir ; au-dessus, la colonne fixe.
 */
const LARGEUR_LG = 1024;

/** Un téléphone s'annonce comme tel : ce qui lit l'agent doit y voir un Android. */
const AGENT_MOBILE = devices['Pixel 7'].userAgent;

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
  // des mises en page de bureau (en-tête complet, conversations en colonne).
  { largeur: 1024, hauteur: 768, telephone: false },
  { largeur: 1440, hauteur: 900, telephone: false },
];

// ---------------------------------------------------------------------------
// Mesures
// ---------------------------------------------------------------------------

/**
 * Attend que la page ne bouge plus avant de la mesurer : réseau calme (le
 * JavaScript et les données sont là), polices chargées (Inter et Material
 * Icons changent la largeur des textes), transitions finies (les `fly` et
 * `fade` de Svelte passent par l'API Web Animations). Les animations infinies
 * — la pastille qui pulse, les points qui sautent — n'ont pas de fin : elles
 * sont écartées. Le délai borne le tout, une animation en pause ne finissant
 * jamais.
 */
async function attendreLeRepos(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await document.fonts.ready;
    const finies = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === 'running' &&
          Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)),
      );
    await Promise.race([
      Promise.all(finies.map((animation) => animation.finished.catch(() => undefined))),
      new Promise((fin) => setTimeout(fin, 3_000)),
    ]);
  });
}

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
// La vraie API, et les sessions simulées
// ---------------------------------------------------------------------------

/**
 * Condition qui demande l'API et ses données : sautée sans elles, échouée avec
 * E2E_EXIGER_BACKEND=1, comme dans link-integrity.spec.ts. Sans ce réglage,
 * une suite verte ne prouverait rien des pages rendues par le serveur.
 */
function exiger(condition: unknown, raison: string): asserts condition {
  if (EXIGER_BACKEND) expect(Boolean(condition), `${raison} (E2E_EXIGER_BACKEND=1)`).toBe(true);
  test.skip(!condition, raison);
}

/**
 * Une liste lue dans la vraie API, vide si elle ne répond pas. Les
 * identifiants viennent de là, jamais du code : un jeu figé pourrit à la
 * première réingestion du corpus. Un hôte éteint fait REJETER la requête, d'où
 * le `catch`.
 */
async function lireListe<T>(request: APIRequestContext, chemin: string): Promise<T[]> {
  const reponse = await request.get(`${API}/api/v1${chemin}`, { failOnStatusCode: false }).catch(() => null);
  if (!reponse?.ok()) return [];
  const corps = await reponse.json().catch(() => null);
  const liste = corps?.items ?? corps?.laws ?? corps;
  return Array.isArray(liste) ? (liste as T[]) : [];
}

/**
 * Ouvre une page rendue par le serveur. API éteinte, ces pages répondent 503
 * avec la page d'erreur du site : la mesurer reviendrait à tester une autre
 * page.
 */
async function ouvrirAuServeur(page: Page, chemin: string): Promise<void> {
  const statut = (await page.goto(chemin))?.status() ?? 0;
  exiger(statut !== 503, `${chemin} : API indisponible (503)`);
  expect(statut, `${chemin} : statut`).toBeLessThan(400);
}

/** Un JWT dont seule la charge compte : la signature n'est jamais vérifiée côté client. */
function jetonValide(): string {
  const charge = { sub: 'rahim@jurix.cm', exp: Math.floor(Date.now() / 1000) + 86_400 };
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(charge)}.signature-non-verifiee`;
}

/** L'utilisateur tel que le garde src/lib/stores/auth.ts dans `jurix-auth-user`. */
interface Compte {
  id: number;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
  name?: string;
}

const MEMBRE: Compte = { id: 7, email: 'rahim@jurix.cm', role: 'user', name: 'Rahim Sahane' };
// Superadmin : il voit les boutons de suppression des comptes, la ligne la
// plus large du tableau.
const SUPERADMIN: Compte = { id: 1, email: 'admin@jurix.cm', role: 'superadmin', name: 'Administration JuriX' };

/**
 * Une session ouverte, posée avant le chargement. Le jeton doit être un vrai
 * triplet base64 à `exp` lointain : `jetonExpire()` jugerait périmé un jeton
 * bidon, et la page repartirait anonyme.
 */
async function connecter(page: Page, compte: Compte): Promise<void> {
  await page.addInitScript(
    ({ jeton, compte }) => {
      localStorage.setItem('jurix-auth-token', jeton);
      localStorage.setItem('jurix-auth-user', JSON.stringify(compte));
    },
    { jeton: jetonValide(), compte },
  );
}

// ---------------------------------------------------------------------------
// Doublures de l'API
// ---------------------------------------------------------------------------

/** Une réponse simulée : du JSON, ou un flux d'événements (le chat). */
type Simulee = { json: unknown; statut?: number } | { flux: Record<string, unknown>[] };

/**
 * Intercepte TOUTE l'API de la page. `repondre` donne la réponse d'un appel ;
 * un appel qu'elle ne connaît pas reçoit un 404, noté dans le rapport, au lieu
 * de partir vers le vrai backend : un jeton factice y serait refusé (et un 401
 * déconnecte, voir src/lib/api.ts), et le chat y dépenserait du quota.
 */
async function intercepterLApi(
  page: Page,
  repondre: (methode: string, chemin: string, url: URL) => Simulee | undefined,
): Promise<void> {
  await page.route('**/api/v1/**', (route) => {
    const requete = route.request();
    const url = new URL(requete.url());
    // « /laws/ » et « /laws » sont le même appel pour ces doublures.
    const chemin = url.pathname.replace(/^.*?\/api\/v1/, '').replace(/\/+$/, '') || '/';
    const reponse = repondre(requete.method(), chemin, url);

    if (!reponse) {
      try {
        test.info().annotations.push({ type: 'appel non simulé', description: `${requete.method()} ${chemin}` });
      } catch {
        // Requête tardive, après la fin du test : plus de rapport où l'écrire.
      }
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Non simulé par responsif.spec.ts' }),
      });
    }
    if ('flux' in reponse) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: reponse.flux.map((evenement) => `data: ${JSON.stringify(evenement)}\n\n`).join(''),
      });
    }
    return route.fulfill({
      status: reponse.statut ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(reponse.json),
    });
  });
}

/**
 * Des titres de la longueur de ceux du corpus : un texte camerounais porte son
 * numéro, sa date et son objet entiers. Les références à barres obliques ne
 * contiennent aucune espace où couper.
 */
const TEXTES: { titre: string; reference: string; type: LawType }[] = [
  { titre: 'Loi N°92/007 du 14 août 1992 portant Code du travail', reference: 'PRC-4722', type: 'loi' },
  {
    titre:
      'Décret N°2018/9387/CAB/PM du 30 décembre 2018 fixant les modalités d’application de certaines dispositions du Code du travail relatives au licenciement pour motif économique',
    reference: 'N°2018/9387/CAB/PM',
    type: 'décret',
  },
  {
    titre:
      'Ordonnance N°2020/001 du 15 juin 2020 modifiant et complétant certaines dispositions de la loi de finances de la République du Cameroun pour l’exercice 2020',
    reference: 'ORD-2020-001',
    type: 'ordonnance',
  },
  {
    titre:
      'Arrêté conjoint N°00000127/MINFI/MINCOMMERCE du 4 mars 2021 fixant les modalités de contrôle des prix des produits de grande consommation',
    reference: 'N°00000127/MINFI/MINCOMMERCE',
    type: 'arrêté',
  },
  {
    titre: 'Acte uniforme relatif au droit des sociétés commerciales et du groupement d’intérêt économique',
    reference: 'AUDSCGIE-2014',
    type: 'acte uniforme',
  },
  { titre: 'Loi N°2016/007 du 12 juillet 2016 portant Code pénal', reference: 'PRC-4810', type: 'loi' },
];

/** Une référence de dossier comme en citent les réponses : 70 caractères d'un bloc. */
const REFERENCE_SANS_ESPACE = 'DRH/CONTENTIEUX/2024/0001879/LICENCIEMENT-ECONOMIQUE-COLLECTIF-DOUALA';

const CATEGORIES: Category[] = [
  'Droit du travail et de la sécurité sociale',
  'Droit des affaires et des sociétés commerciales (OHADA)',
  'Finances publiques, fiscalité et douanes',
  'Droit foncier, domanial et de l’urbanisme',
  'Mines, énergie, eau et ressources naturelles',
  'Droit pénal et procédure pénale',
].map((name, i) => ({
  id: 30 + i,
  name,
  description: 'Textes en vigueur, du plus récent au plus ancien, avec leurs modifications successives.',
  icon: null,
  created_at: '2026-01-01T00:00:00',
  law_count: 40 - i * 5,
}));

// --- Chat ------------------------------------------------------------------

const QUESTION = 'Quelles indemnités en cas de licenciement économique ?';
const DEBUT_REPONSE = 'Réponse directe';
const FIN_REPONSE = 'Réponse simulée par responsif.spec.ts, pour éprouver la mise en page.';
const SESSION_DU_CHAT = 'sid-responsif';

/**
 * Une réponse longue, dans le markdown que demande le prompt système : titres,
 * liste numérotée, TABLEAU (le plus large des blocs), une URL et une référence
 * sans espace, que seul `overflow-wrap: anywhere` peut couper.
 */
const REPONSE_LONGUE = [
  `**${DEBUT_REPONSE}**`,
  'Un salarié licencié pour motif économique après deux ans d’ancienneté a droit à une indemnité de licenciement, ' +
    `sauf faute lourde. Le dossier de l’employeur porte une référence de ce genre : ${REFERENCE_SANS_ESPACE}.`,
  '**Ce que disent les textes**',
  [
    '1. Le Code du travail pose le principe de l’indemnité et du préavis.',
    '2. Le décret N°2018/9387/CAB/PM en précise le calcul, par tranche d’ancienneté.',
    '3. Une convention collective peut prévoir mieux que le minimum légal.',
  ].join('\n'),
  [
    '| Ancienneté | Taux par année de service (exemple) | Base de calcul | Texte |',
    '|---|---|---|---|',
    '| De 2 à 5 ans | 20 % | Salaire mensuel moyen des douze derniers mois | Décret N°2018/9387/CAB/PM, article 3 |',
    '| De 6 à 10 ans | 25 % | Salaire mensuel moyen des douze derniers mois | Décret N°2018/9387/CAB/PM, article 3 |',
    '| Plus de 10 ans | 30 % | Salaire mensuel moyen, primes et indemnités comprises | Convention collective nationale du commerce, article 22 |',
  ].join('\n'),
  '**Pour aller plus loin**',
  [
    '- Le texte intégral : https://documents.example.org/textes/decret_2018_9387_cab_pm_modalites_application_code_du_travail_version_consolidee.pdf',
    '- L’inspection du travail de votre ressort peut vérifier le calcul.',
  ].join('\n'),
  FIN_REPONSE,
].join('\n\n');

/** Une source du chat, telle que la porte le dernier événement du flux (`Citation` côté backend). */
interface SourceDuChat {
  law_id: number;
  law_reference: string;
  law_title: string;
  article_number: string | null;
  article_id: number | null;
  excerpt: string;
  relevance_score: number;
}

const SOURCES_DU_CHAT: SourceDuChat[] = [
  {
    law_id: 101,
    law_reference: 'PRC-4722',
    law_title: TEXTES[0].titre,
    article_number: '37',
    article_id: 9001,
    excerpt:
      'En cas de licenciement, le travailleur a droit à une indemnité distincte du préavis, calculée sur son ancienneté dans l’entreprise.',
    relevance_score: 0.93,
  },
  {
    law_id: 102,
    law_reference: TEXTES[1].reference,
    law_title: TEXTES[1].titre,
    article_number: '3',
    article_id: 9002,
    excerpt:
      'L’indemnité est calculée par tranche d’ancienneté, sur la base du salaire mensuel moyen des douze derniers mois.',
    relevance_score: 0.88,
  },
  {
    law_id: 103,
    law_reference: 'CCN-COMMERCE/2019/REVISION-GENERALE-DES-CLASSIFICATIONS-PROFESSIONNELLES',
    law_title: 'Convention collective nationale du commerce',
    article_number: null,
    article_id: null,
    excerpt:
      'Les parties signataires conviennent de dispositions plus favorables que le minimum légal pour les salariés comptant plus de dix ans d’ancienneté.',
    relevance_score: 0.71,
  },
];

/**
 * La réponse en flux, comme `/rag/ask/stream` : un morceau par paragraphe,
 * puis le dernier événement, qui porte les sources et la session. Le flux ne
 * porte pas de suggestions (`RAGStreamChunk`) : celles qu'affiche le chat sont
 * les puces du profil, sous le message d'accueil, mesurées avec le reste.
 */
function evenementsDuChat(): Record<string, unknown>[] {
  return [
    ...REPONSE_LONGUE.split(/(?<=\n\n)/).map((chunk) => ({ chunk, done: false })),
    {
      chunk: '',
      done: true,
      sources: SOURCES_DU_CHAT,
      intent: 'juridique',
      confidence: 0.82,
      session_id: SESSION_DU_CHAT,
      persona: 'citoyen',
    },
  ];
}

/** Des titres longs : la liste les tronque, le tiroir ne doit pas s'élargir pour eux. */
const TITRES_DE_CONVERSATION = [
  'Licenciement pour motif économique dans une entreprise de plus de cinquante salariés : préavis, indemnités et recours',
  'Bail commercial OHADA : renouvellement, révision du loyer et indemnité d’éviction',
  'Création d’une SARL unipersonnelle à Douala',
  'Succession sans testament : droits du conjoint survivant et des enfants',
];

const CONVERSATIONS: ConversationSummary[] = Array.from({ length: 12 }, (_, i): ConversationSummary => ({
  session_id: `sid-${i + 1}`,
  // Une conversation sans titre : la liste affiche un repli.
  title: i === 3 ? null : TITRES_DE_CONVERSATION[i % TITRES_DE_CONVERSATION.length],
  persona: 'citoyen',
  language: 'fr',
  created_at: `2026-10-${String(20 - i).padStart(2, '0')}T09:00:00`,
  updated_at: `2026-10-${String(20 - i).padStart(2, '0')}T09:30:00`,
}));

const REPONSE_ROUVERTE = 'Sauf faute lourde, le licenciement ouvre droit à un préavis et à une indemnité.';

const CONVERSATION_ROUVERTE: ConversationDetail = {
  ...CONVERSATIONS[0],
  messages: [
    { id: 1, role: 'user', content: 'Mon employeur peut-il me licencier sans préavis ?', created_at: '2026-10-20T09:00:00' },
    { id: 2, role: 'assistant', content: REPONSE_ROUVERTE, created_at: '2026-10-20T09:00:05' },
  ],
};

/** Le chat, sans jamais atteindre le modèle : même une question réelle reste ici. */
async function simulerLeChat(page: Page): Promise<void> {
  await intercepterLApi(page, (methode, chemin) => {
    if (chemin === '/rag/ask/stream') return { flux: evenementsDuChat() };
    if (chemin === '/rag/conversations') return { json: CONVERSATIONS };
    if (chemin === `/rag/conversations/${CONVERSATION_ROUVERTE.session_id}`) return { json: CONVERSATION_ROUVERTE };
    // La synchronisation du profil au démarrage, pour un compte connecté.
    if (chemin === '/auth/me') return { json: { persona: 'citoyen' } };
    return undefined;
  });
}

// --- Recherche -------------------------------------------------------------

const RESULTATS: SearchResult[] = Array.from({ length: 20 }, (_, i): SearchResult => {
  const texte = TEXTES[i % TEXTES.length];
  const categorie = CATEGORIES[i % CATEGORIES.length];
  return {
    law_id: 700 + i,
    reference: texte.reference,
    title: texte.titre,
    type: texte.type,
    language: 'fr',
    status: 'published',
    category_id: categorie.id,
    category_name: categorie.name,
    publication_date: '1992-08-14',
    relevance_score: 0.95 - i * 0.02,
    match_scope: i % 2 === 0 ? 'body' : 'title',
    // Les articles trouvés s'ajoutent à la carte : la plus haute, et la plus chargée.
    matched_articles:
      i % 3 === 0
        ? [
            {
              article_id: 9100 + i,
              number: '37',
              title: 'Indemnité de licenciement',
              content_snippet:
                'Le contrat de <mark>travail</mark> à durée indéterminée peut cesser par la volonté de l’une des parties, sous réserve du préavis.',
              relevance_score: 0.81,
            },
            {
              article_id: 9200 + i,
              number: '45-1 (nouveau)',
              title: null,
              content_snippet: `Dossier ${REFERENCE_SANS_ESPACE} transmis à l’inspection du <mark>travail</mark>.`,
              relevance_score: 0.62,
            },
          ]
        : [],
    highlights: {
      content: `Toute rupture du contrat de <mark>travail</mark> ouvre droit au préavis, sauf faute lourde. Référence : ${REFERENCE_SANS_ESPACE}.`,
    },
    content: 'Toute rupture du contrat de travail ouvre droit au préavis, sauf faute lourde du travailleur.',
  };
});

/** Bien plus d'une page : la pagination se montre, avec tous ses numéros. */
const REPONSE_RECHERCHE: SearchResponse = {
  query: 'travail',
  mode: 'hybrid',
  results: RESULTATS,
  total: 137,
  search_time_ms: 312,
  filters_applied: null,
  direct_navigation: false,
  target_law_id: null,
  target_article: null,
};

/** La recherche hybride appelle un modèle d'embeddings : simulée, elle ne coûte rien. */
async function simulerLaRecherche(page: Page): Promise<void> {
  await intercepterLApi(page, (methode, chemin) => {
    if (chemin === '/search') return { json: REPONSE_RECHERCHE };
    if (chemin === '/search/suggest') return { json: { suggestions: [] } };
    if (chemin === '/categories') return { json: CATEGORIES };
    return undefined;
  });
}

// --- Comparaison -----------------------------------------------------------

const ARTICLE_LONG =
  'Le contrat de travail à durée indéterminée peut cesser par la volonté de l’une des parties. Cette résiliation ' +
  'est subordonnée à un préavis donné par la partie qui prend l’initiative de la rupture, dont la durée tient ' +
  'compte de l’ancienneté du travailleur et de sa catégorie professionnelle. Pendant le préavis, le travailleur ' +
  'dispose d’un jour de liberté par semaine pour chercher un autre emploi.';

/** Une source de cellule : la puce porte la RÉFÉRENCE du texte, parfois sans espace. */
function sourceComparee(i: number, numero: string): SourceRef {
  const texte = TEXTES[i % TEXTES.length];
  return {
    article_id: 9300 + i,
    law_id: 800 + i,
    law_title: texte.titre,
    reference: texte.reference,
    number: numero,
    article_title: null,
    page_number: 3 + i,
    content: ARTICLE_LONG,
  };
}

const COMPARAISON: ComparisonResponse = {
  subject_a: 'licenciement pour motif économique',
  subject_b: 'licenciement pour faute lourde',
  language: 'fr',
  rows: [
    {
      criterion: 'Préavis',
      a: {
        value: 'Dû, selon l’ancienneté et la catégorie professionnelle du travailleur.',
        sources: [sourceComparee(0, '34'), sourceComparee(3, '4')],
      },
      b: { value: 'Non dû : la faute lourde prive le travailleur du préavis.', sources: [sourceComparee(0, '36')] },
    },
    {
      criterion: 'Indemnité de licenciement',
      a: {
        value: 'Due après deux ans d’ancienneté, calculée par tranche.',
        sources: [sourceComparee(1, '3'), sourceComparee(3, '4')],
      },
      b: { value: 'Non due.', sources: [sourceComparee(0, '37')] },
    },
    {
      criterion: 'Consultation des délégués du personnel et information de l’inspection du travail',
      a: {
        value: 'Obligatoire avant tout licenciement collectif, avec un ordre des départs.',
        sources: [sourceComparee(2, '40-2 (nouveau)')],
      },
      b: { value: 'Non trouvé dans les textes consultés', sources: [] },
    },
    {
      criterion: 'Recours',
      a: { value: 'Devant l’inspection du travail, puis le tribunal compétent.', sources: [sourceComparee(5, '139')] },
      b: { value: 'Devant le tribunal, qui apprécie la gravité de la faute.', sources: [sourceComparee(5, '139')] },
    },
  ],
  key_differences: [
    'La faute lourde prive à la fois du préavis et de l’indemnité de licenciement.',
    'Le licenciement économique impose une procédure collective, avec consultation et ordre des départs.',
  ],
  blind_spots: ['Le sort des congés payés acquis ne figure pas dans les textes consultés.'],
  articles_a: [sourceComparee(0, '34'), sourceComparee(1, '3')],
  articles_b: [sourceComparee(0, '36')],
  // Une citation sans article : l'avertissement s'affiche, avec le reste.
  unmatched_citations: ['9999'],
  retrieval_time_ms: 140,
  generation_time_ms: 5200,
};

/** La comparaison appelle le modèle : simulée, comme dans comparaison.spec.ts. */
async function simulerLaComparaison(page: Page): Promise<void> {
  await intercepterLApi(page, (methode, chemin) => (chemin === '/compare' ? { json: COMPARAISON } : undefined));
}

// --- Administration --------------------------------------------------------

const STATUTS: LawStatus[] = ['published', 'processing', 'published', 'refused', 'pending', 'draft'];

/** Vingt documents : plus d'une page de quinze (TAILLE_PAGE_ADMIN), la pagination se montre. */
const LOIS: Law[] = Array.from({ length: 20 }, (_, i): Law => {
  const texte = TEXTES[i % TEXTES.length];
  return {
    id: 500 + i,
    reference: texte.reference,
    title: texte.titre,
    type: texte.type,
    content: 'Article premier.- La présente loi s’applique à tout travailleur exerçant son activité au Cameroun.',
    language: i % 5 === 4 ? 'en' : 'fr',
    category_id: CATEGORIES[i % CATEGORIES.length].id,
    status: STATUTS[i % STATUTS.length],
    publication_date: '2018-12-30',
    detected_language: 'fr',
    language_confidence: 0.98,
    suggested_categories: null,
    category_confidence: null,
    file_id: null,
    original_filename: 'decret_2018_9387_cab_pm_modalites_application_code_du_travail_version_consolidee.pdf',
    article_count: 12 + i,
    created_at: `2026-10-${String(21 - i).padStart(2, '0')}T08:30:00`,
    updated_at: null,
    category: null,
  };
});

/** Vingt comptes, dont des adresses et des identifiants très longs. */
const UTILISATEURS: User[] = Array.from({ length: 20 }, (_, i): User => ({
  id: i + 1,
  email:
    i === 0
      ? SUPERADMIN.email
      : i % 4 === 1
        ? `agent${i}.direction-des-affaires-juridiques-et-du-contentieux@minjustice.example.cm`
        : `lecteur${i}@jurix.cm`,
  username: i === 0 ? 'admin' : i % 5 === 2 ? `marie_claire_essomba_tchoungui_${i}` : `lecteur${i}`,
  full_name: i % 3 === 0 ? null : 'Marie-Claire Essomba Tchoungui',
  role: i === 0 ? 'superadmin' : i % 6 === 0 ? 'admin' : 'user',
  is_active: i % 7 !== 3,
  is_verified: true,
  created_at: '2026-09-01T10:00:00',
  last_login_at: i % 4 === 3 ? null : '2026-10-20T18:45:00',
}));

const VUE_D_ENSEMBLE: AnalyticsOverview = {
  total_laws: 1284,
  by_language: { fr: 1150, en: 134 },
  by_status: { published: 1200, processing: 4, refused: 80 },
  recent_laws: 37,
};

const USAGE: AnalyticsUsage = {
  window_days: 7,
  conversations: 412,
  questions_asked: 1290,
  answers_generated: 1275,
  searches: 3480,
  active_users: 87,
  median_answer_time_ms: 4200,
  personas_usage: { citoyen: 180, avocat: 90, 'étudiant': 70, entrepreneur: 42, general: 30 },
};

const STATS_RECHERCHE: AnalyticsSearch = {
  window_days: 7,
  total_searches: 3480,
  median_response_time_ms: 310,
  p95_response_time_ms: 1250,
  max_response_time_ms: 4800,
  cache_hit_rate_percent: 42,
  modes_usage: { hybrid: 3000, text: 400, semantic: 80 },
};

/**
 * L'administration, en superadmin. Tous ses appels sont simulés : rendue dans
 * le navigateur (admin/+layout.ts), elle n'a rien à demander au serveur.
 */
async function simulerLAdministration(page: Page): Promise<void> {
  await connecter(page, SUPERADMIN);
  await intercepterLApi(page, (methode, chemin, url) => {
    if (methode !== 'GET') return undefined;
    switch (chemin) {
      case '/auth/me':
        return { json: { ...SUPERADMIN, persona: 'citoyen' } };
      case '/analytics/overview':
        return { json: VUE_D_ENSEMBLE };
      case '/analytics/usage':
        return { json: USAGE };
      case '/analytics/search':
        return { json: STATS_RECHERCHE };
      case '/laws':
        // Le tableau de bord demande les 4 derniers, la page des documents tout.
        return { json: LOIS.slice(0, Number(url.searchParams.get('limit')) || LOIS.length) };
      case '/categories':
        return { json: CATEGORIES };
      case '/admin/users':
        return { json: UTILISATEURS };
      default:
        return undefined;
    }
  });
}

// ---------------------------------------------------------------------------
// Les pages
// ---------------------------------------------------------------------------

/** La saisie du chat, par son nom accessible : `input` hier, `textarea` qui grandit selon le plan. */
const saisieDuChat = (page: Page): Locator => page.getByRole('textbox', { name: 'Votre question' });
const boutonDEnvoi = (page: Page): Locator => page.getByRole('button', { name: 'Envoyer', exact: true });

/** Le premier exemplaire visible : sous md, des cartes peuvent remplacer un tableau, avec le même texte. */
const visible = (cible: Locator): Locator => cible.filter({ visible: true }).first();

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
