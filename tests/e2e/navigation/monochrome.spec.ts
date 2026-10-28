/**
 * Le site en noir et blanc : aucune teinte, sauf le rouge des erreurs.
 *
 * POURQUOI CE FICHIER EXISTE. La refonte de 2026-10 passe tout le site sur
 * l'échelle zinc de Tailwind, et elle seule (guide de la conversion :
 * data/ui-mono/guide.md dans le dépôt du backend). L'inventaire des classes
 * (`inventaire.py`) lit le code, pas la page : il ne voit ni une couleur
 * venue d'une feuille de style (le bleu par défaut d'un lien, l'anneau de
 * @tailwindcss/forms), ni une valeur calculée, ni un composant oublié. Ce
 * fichier lit ce que le navigateur peint.
 *
 * POUR CHAQUE PAGE (21), en 390×844 (téléphone) et 1440×900, en clair et en
 * sombre :
 *  - toute couleur calculée d'un élément visible — texte, fond, dégradé,
 *    bordures, contour, soulignement, fill et stroke des SVG, ombres, et les
 *    mêmes sur ::before, ::after, ::marker et ::placeholder — est convertie en
 *    sRGB (rgb, hsl, hwb, lab, lch, oklab, oklch, color()) ;
 *  - ÉCHEC si sa saturation TSL dépasse 0,15 avec une luminosité entre 0,08
 *    et 0,95 (en deçà : noir, gris, blanc) ;
 *  - le ROUGE (teinte de 345° à 15°) est permis, pour les erreurs et les
 *    actions destructrices seulement : chaque usage est relevé et imprimé
 *    (`[rouge] …`), pour qu'un humain vérifie qu'il en est bien un.
 * Exemptés : img, video, canvas, iframe, et le bouton Google (sa charte) avec
 * tout ce qu'il contient.
 *
 * ÉTATS OUVERTS : le même relevé sur ce qu'une page ne montre qu'à la demande
 * — menus, palette de commande, choix du profil, tiroirs, panneau des
 * filtres, sommaire d'une loi, explication d'un article, fenêtres de
 * l'administration, messages d'erreur —, en clair et en sombre, à la taille
 * où chacun existe.
 *
 * EN ANGLAIS : l'accueil et une loi, interface en anglais (clé
 * `jurix-language`), ne doivent montrer aucun reste de français dans
 * l'interface. Le texte des lois, lui, reste en français : tout ce qui
 * figure dans la loi elle-même (titre, contenu) est mis à part.
 *
 * CAPTURES. Avec CAPTURES_DIR, une capture pleine page par page et par
 * taille : 390×844 et 1440×900 en clair et en sombre, et en clair seulement
 * 768×1024 (tablette en portrait), 1024×768 (tablette en paysage) et 740×360
 * (téléphone en paysage), nommées <page>__<l>x<h>__<thème>.png ; en anglais,
 * <page>__<l>x<h>__light-en.png ; les états ouverts dans le sous-dossier
 * `etats/`. Sans CAPTURES_DIR, les tests de captures seules sont sautés.
 *
 * DONNÉES ET MODÈLE : les doublures de tests/e2e/doublures.ts ; aucun appel
 * au modèle.
 *
 * Lancer : CAPTURES_DIR=… npx playwright test --project=monochrome
 */

import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type APIRequestContext, type Page, type Route } from '@playwright/test';

import {
  AGENT_MOBILE,
  API,
  ARTICLES_DU_BLOG_ADMIN,
  LOIS,
  MEMBRE,
  QUESTION,
  REPONSE_RECHERCHE,
  REPONSE_ROUVERTE,
  SUPERADMIN,
  TEXTES,
  UTILISATEURS,
  attendreLeRepos,
  connecter,
  exiger,
  ouvrirAuServeur,
  saisieDuChat,
  simulerLAdministration,
  simulerLaRecherche,
  simulerLeChat,
  visible,
} from '../doublures';
import { cliquerJusqualEffet, saisirJusqualEffet } from '../hydratation';
import { PAGES, loiAvecArticles, nomDeCapture, ouvrirAuRepos } from '../pages-du-site';

const DOSSIER_DES_CAPTURES = process.env.CAPTURES_DIR;

type Theme = 'light' | 'dark';

interface Taille {
  largeur: number;
  hauteur: number;
  /** Émulé en téléphone : balise viewport, écran tactile, agent Android. */
  telephone: boolean;
}

const TELEPHONE: Taille = { largeur: 390, hauteur: 844, telephone: true };
const BUREAU: Taille = { largeur: 1440, hauteur: 900, telephone: false };

/** Tailles des captures en clair seulement : la mise en page, pas les couleurs. */
const TAILLES_DES_CAPTURES: Taille[] = [
  { largeur: 768, hauteur: 1024, telephone: false },
  { largeur: 1024, hauteur: 768, telephone: false },
  { largeur: 740, hauteur: 360, telephone: true },
];

const reglages = (taille: Taille) => ({
  viewport: { width: taille.largeur, height: taille.hauteur },
  isMobile: taille.telephone,
  hasTouch: taille.telephone,
  ...(taille.telephone ? { userAgent: AGENT_MOBILE } : {}),
});

// ---------------------------------------------------------------------------
// Thème, langue, captures
// ---------------------------------------------------------------------------

/**
 * Thème posé AVANT le chargement, par la clé que lisent app.html (avant le
 * premier affichage) et src/lib/stores/theme.ts : la page s'ouvre directement
 * dans le bon thème, sans transition de couleur à attendre.
 */
async function poserLeTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((valeur) => localStorage.setItem('jurix-theme', valeur), theme);
}

/** Langue de l'interface, par la clé de src/lib/stores/language.ts. */
async function poserLaLangue(page: Page, langue: 'fr' | 'en'): Promise<void> {
  await page.addInitScript((valeur) => localStorage.setItem('jurix-language', valeur), langue);
}

/** Au-delà, une capture devient lourde à relire : on garde le haut de la page. */
const HAUTEUR_MAX_CAPTURE = 15_000;

/** Capture pleine page dans CAPTURES_DIR, si le dossier est demandé. */
async function capturer(page: Page, nom: string): Promise<void> {
  if (!DOSSIER_DES_CAPTURES) return;
  const fichier = path.join(DOSSIER_DES_CAPTURES, `${nom}.png`);
  // Le dossier du fichier, et non celui des captures : les états ouverts
  // ont leur sous-dossier (`etats/`).
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
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
}

// ---------------------------------------------------------------------------
// Lecture des couleurs, dans la page
// ---------------------------------------------------------------------------

/** Une couleur relevée sur un élément visible. */
interface Releve {
  chemin: string;
  texte: string;
  propriete: string;
  valeur: string;
  teinte: number;
  saturation: number;
  luminosite: number;
  rouge: boolean;
}

interface Analyse {
  /** Teintes interdites : tout sauf le rouge. */
  teintes: Releve[];
  /** Rouges, permis aux erreurs et aux actions destructrices : à relire. */
  rouges: Releve[];
  /** Valeurs qu'aucun analyseur ne sait lire : signalées, jamais ignorées. */
  illisibles: Releve[];
  /** Éléments examinés (contrôle : une page vide ne prouve rien). */
  examines: number;
}

/**
 * Parcourt la page et relève chaque couleur peinte d'un élément visible.
 *
 * Exécutée DANS la page (page.evaluate) : elle ne peut rien utiliser du
 * fichier qui l'entoure. Un seul parcours en profondeur porte l'opacité
 * cumulée des ancêtres : un sous-arbre transparent (fond d'un tiroir fermé)
 * ne compte pas, un élément `invisible` non plus, mais un tiroir rangé hors de
 * l'écran, si : ses couleurs se verront à son ouverture.
 */
function analyserLesCouleurs(seuils: { saturation: number; luminositeMin: number; luminositeMax: number }): Analyse {
  type Rgba = { r: number; g: number; b: number; a: number };

  // --- Conversions vers sRGB (CSS Color 4) ---------------------------------
  const versLineaire = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const versGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.sign(c) * Math.abs(c) ** (1 / 2.4) - 0.055);
  const produit = (m: number[][], v: number[]) => m.map((ligne) => ligne[0] * v[0] + ligne[1] * v[1] + ligne[2] * v[2]);
  const XYZ_VERS_SRGB = [
    [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
    [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
    [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
  ];
  const D50_VERS_D65 = [
    [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
    [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
    [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
  ];
  const P3_VERS_XYZ = [
    [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
    [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
    [0, 0.04511338185890264, 1.043944368900976],
  ];
  const depuisXyzD65 = (xyz: number[]) => produit(XYZ_VERS_SRGB, xyz).map(versGamma);
  const depuisLab = (L: number, a: number, b: number) => {
    const k = 24389 / 27;
    const e = 216 / 24389;
    const fy = (L + 16) / 116;
    const fx = fy + a / 500;
    const fz = fy - b / 200;
    const xr = fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k;
    const yr = L > k * e ? ((L + 16) / 116) ** 3 : L / k;
    const zr = fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k;
    const d50 = [xr * 0.96429567, yr, zr * 0.8251046];
    return depuisXyzD65(produit(D50_VERS_D65, d50));
  };
  const depuisOklab = (L: number, a: number, b: number) => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map(versGamma);
  };
  const depuisTsl = (h: number, s: number, l: number) => {
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)];
  };

  /** Un nombre CSS : `none` vaut 0, un pourcentage se rapporte à `cent`. */
  const nombre = (jeton: string, cent = 1): number => {
    if (jeton === 'none') return 0;
    if (jeton.endsWith('%')) return (parseFloat(jeton) / 100) * cent;
    if (jeton.endsWith('deg')) return parseFloat(jeton);
    if (jeton.endsWith('turn')) return parseFloat(jeton) * 360;
    if (jeton.endsWith('rad')) return (parseFloat(jeton) * 180) / Math.PI;
    return parseFloat(jeton);
  };

  function lire(valeur: string): Rgba | null {
    const v = valeur.trim().toLowerCase();
    if (v === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    const m = /^([a-z-]+)\((.*)\)$/.exec(v);
    if (!m) return null;
    const [, fonction, interieur] = m;
    const [corps, alphaBrut] = interieur.split('/').map((x) => x.trim());
    const jetons = corps.replace(/,/g, ' ').trim().split(/\s+/);
    let alpha = alphaBrut !== undefined ? nombre(alphaBrut) : 1;
    let rgb: number[] | null = null;
    switch (fonction) {
      case 'rgb':
      case 'rgba': {
        if (jetons.length === 4 && alphaBrut === undefined) alpha = nombre(jetons[3]);
        rgb = jetons.slice(0, 3).map((j) => nombre(j, 255) / 255);
        break;
      }
      case 'hsl':
      case 'hsla': {
        if (jetons.length === 4 && alphaBrut === undefined) alpha = nombre(jetons[3]);
        rgb = depuisTsl(nombre(jetons[0]), nombre(jetons[1], 1) / (jetons[1].endsWith('%') ? 1 : 100), nombre(jetons[2], 1) / (jetons[2].endsWith('%') ? 1 : 100));
        break;
      }
      case 'hwb': {
        const blanc = nombre(jetons[1], 1);
        const noir = nombre(jetons[2], 1);
        const pur = depuisTsl(nombre(jetons[0]), 1, 0.5);
        rgb = pur.map((c) => c * (1 - blanc - noir) + blanc);
        break;
      }
      case 'lab':
        rgb = depuisLab(nombre(jetons[0], 100), nombre(jetons[1], 125), nombre(jetons[2], 125));
        break;
      case 'lch': {
        const h = (nombre(jetons[2]) * Math.PI) / 180;
        const c = nombre(jetons[1], 150);
        rgb = depuisLab(nombre(jetons[0], 100), c * Math.cos(h), c * Math.sin(h));
        break;
      }
      case 'oklab':
        rgb = depuisOklab(nombre(jetons[0], 1), nombre(jetons[1], 0.4), nombre(jetons[2], 0.4));
        break;
      case 'oklch': {
        const h = (nombre(jetons[2]) * Math.PI) / 180;
        const c = nombre(jetons[1], 0.4);
        rgb = depuisOklab(nombre(jetons[0], 1), c * Math.cos(h), c * Math.sin(h));
        break;
      }
      case 'color': {
        const [espace, ...composantes] = jetons;
        const c = composantes.slice(0, 3).map((j) => nombre(j, 1));
        if (espace === 'srgb') rgb = c;
        else if (espace === 'srgb-linear') rgb = c.map(versGamma);
        else if (espace === 'display-p3') rgb = depuisXyzD65(produit(P3_VERS_XYZ, c.map(versLineaire)));
        else if (espace === 'xyz' || espace === 'xyz-d65') rgb = depuisXyzD65(c);
        else if (espace === 'xyz-d50') rgb = depuisXyzD65(produit(D50_VERS_D65, c));
        break;
      }
    }
    if (!rgb || rgb.some((c) => Number.isNaN(c))) return null;
    const borne = (c: number) => Math.min(1, Math.max(0, c));
    return { r: borne(rgb[0]), g: borne(rgb[1]), b: borne(rgb[2]), a: Number.isNaN(alpha) ? 1 : alpha };
  }

  /** Teinte (degrés), saturation et luminosité TSL d'une couleur sRGB. */
  function tsl({ r, g, b }: Rgba): { h: number; s: number; l: number } {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    let h: number;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return { h, s, l };
  }

  /** Toutes les fonctions de couleur d'une valeur composée (ombres, dégradés). */
  const COULEURS = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)/gi;

  // --- Description d'un élément ---------------------------------------------
  const cheminDe = (el: Element): string => {
    const morceaux: string[] = [];
    for (let n: Element | null = el; n && n !== document.body && morceaux.length < 4; n = n.parentElement) {
      const testid = n.getAttribute('data-testid');
      const classes = (n.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
      morceaux.unshift(
        n.tagName.toLowerCase() +
          (n.id ? `#${CSS.escape(n.id)}` : '') +
          (testid ? `[data-testid="${testid}"]` : '') +
          classes.map((c) => `.${CSS.escape(c)}`).join(''),
      );
    }
    return morceaux.join(' > ');
  };
  /**
   * Le texte qui nomme l'élément. Une icône n'en a pas : elle se nomme par le
   * bouton ou le lien qui la porte (« Supprimer »), sans quoi un rouge sur une
   * corbeille ne se relirait pas.
   */
  const texteDe = (el: Element): string => {
    const propre = (n: Element) =>
      (n.textContent ?? '').replace(/\s+/g, ' ').trim() || n.getAttribute('aria-label') || n.getAttribute('title') || '';
    const porteur = el instanceof SVGElement ? el.closest('button, a, [role="button"]') : null;
    const brut = propre(el) || (porteur ? propre(porteur) : '');
    return brut.length > 50 ? `${brut.slice(0, 50)}…` : brut;
  };

  // --- Relevé --------------------------------------------------------------
  const teintes: Releve[] = [];
  const rouges: Releve[] = [];
  const illisibles: Releve[] = [];
  let examines = 0;

  /** Déjà relevé (élément, propriété, valeur) : les tracés d'une icône partagent sa couleur. */
  const vus = new WeakMap<Element, Set<string>>();
  const relever = (element: Element, propriete: string, valeur: string) => {
    let el = element;
    if (!valeur || valeur === 'none' || valeur === 'transparent' || valeur.startsWith('url(')) return;
    // Une icône se nomme par son <svg>, pas par chacun de ses tracés.
    if (el instanceof SVGElement && el.ownerSVGElement) {
      let racineSvg: SVGSVGElement = el.ownerSVGElement;
      while (racineSvg.ownerSVGElement) racineSvg = racineSvg.ownerSVGElement;
      el = racineSvg;
    }
    const cle = `${propriete}|${valeur}`;
    const dejaVus = vus.get(el) ?? new Set<string>();
    if (dejaVus.has(cle)) return;
    dejaVus.add(cle);
    vus.set(el, dejaVus);
    // Une valeur simple (une couleur) ou composée (ombres, dégradé).
    const couleurs = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i.test(valeur.trim()) && !/\)\s*\S/.test(valeur.trim())
      ? [valeur.trim()]
      : valeur.match(COULEURS) ?? [];
    for (const couleur of couleurs) {
      const rgba = lire(couleur);
      if (!rgba) {
        illisibles.push({ chemin: cheminDe(el), texte: texteDe(el), propriete, valeur: couleur, teinte: 0, saturation: 0, luminosite: 0, rouge: false });
        continue;
      }
      if (rgba.a <= 0) continue;
      const { h, s, l } = tsl(rgba);
      if (s <= seuils.saturation || l <= seuils.luminositeMin || l >= seuils.luminositeMax) continue;
      const rouge = h >= 345 || h <= 15;
      const releve = {
        chemin: cheminDe(el),
        texte: texteDe(el),
        propriete,
        valeur: couleur,
        teinte: Math.round(h),
        saturation: Math.round(s * 100) / 100,
        luminosite: Math.round(l * 100) / 100,
        rouge,
      };
      (rouge ? rouges : teintes).push(releve);
    }
  };

  const aDuTexte = (el: Element): boolean =>
    [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
  const estChamp = (el: Element) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;

  const COTES = ['top', 'right', 'bottom', 'left'] as const;
  /** Les bordures tracées ; une seule ligne quand les quatre côtés ont la même couleur. */
  const bordures = (el: Element, s: CSSStyleDeclaration, prefixe = '') => {
    const tracees = COTES.filter((cote) => {
      const style = s.getPropertyValue(`border-${cote}-style`);
      return parseFloat(s.getPropertyValue(`border-${cote}-width`)) > 0 && style !== 'none' && style !== 'hidden';
    }).map((cote) => [cote, s.getPropertyValue(`border-${cote}-color`)] as const);
    if (tracees.length === 4 && tracees.every(([, couleur]) => couleur === tracees[0][1])) {
      relever(el, `${prefixe}border-color`, tracees[0][1]);
      return;
    }
    for (const [cote, couleur] of tracees) relever(el, `${prefixe}border-${cote}-color`, couleur);
  };

  const EXEMPTES = new Set(['IMG', 'VIDEO', 'CANVAS', 'IFRAME', 'PICTURE']);

  function examiner(el: Element, opaciteParent: number): void {
    if (EXEMPTES.has(el.tagName) || el.matches('[data-testid="google-button-container"]')) return;
    const s = getComputedStyle(el);
    if (s.display === 'none') return;
    const opacite = opaciteParent * parseFloat(s.opacity || '1');
    if (opacite <= 0) return;

    const boite = el.getBoundingClientRect();
    const coupe = s.overflow !== 'visible' || s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)';
    // Texte réservé aux lecteurs d'écran (sr-only) : rien n'en est peint.
    if (coupe && (boite.width <= 1 || boite.height <= 1)) return;

    const peint = s.visibility === 'visible' && boite.width > 0 && boite.height > 0;
    if (peint) {
      examines += 1;
      const svg = el instanceof SVGElement;
      if (aDuTexte(el) || estChamp(el)) relever(el, 'color', s.color);
      relever(el, 'background-color', s.backgroundColor);
      if (s.backgroundImage !== 'none') relever(el, 'background-image', s.backgroundImage);
      bordures(el, s);
      if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) relever(el, 'outline-color', s.outlineColor);
      // Le soulignement se propage au texte des descendants en ligne : un lien
      // dont le texte est dans un <span> le peint quand même, de SA couleur.
      // Limité au texte direct, un `decoration-blue-500` posé sur un tel lien
      // passait inaperçu.
      if (s.textDecorationLine !== 'none' && (el.textContent ?? '').trim() !== '') {
        relever(el, 'text-decoration-color', s.textDecorationColor);
      }
      if (svg) {
        relever(el, 'fill', s.fill);
        if (s.stroke !== 'none' && parseFloat(s.strokeWidth) > 0) relever(el, 'stroke', s.stroke);
      }
      if (s.boxShadow !== 'none') relever(el, 'box-shadow', s.boxShadow);

      // Pseudo-éléments : ce qu'ils peignent compte comme le reste.
      for (const pseudo of ['::before', '::after'] as const) {
        const p = getComputedStyle(el, pseudo);
        if (p.content === 'none' || p.content === 'normal' || p.display === 'none') continue;
        if (/^["'].*\S.*["']$/.test(p.content)) relever(el, `${pseudo} color`, p.color);
        relever(el, `${pseudo} background-color`, p.backgroundColor);
        if (p.backgroundImage !== 'none') relever(el, `${pseudo} background-image`, p.backgroundImage);
        bordures(el, p, `${pseudo} `);
        if (p.boxShadow !== 'none') relever(el, `${pseudo} box-shadow`, p.boxShadow);
      }
      if (s.display === 'list-item' && s.listStyleType !== 'none') {
        relever(el, '::marker color', getComputedStyle(el, '::marker').color);
      }
      if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.placeholder && !el.value) {
        relever(el, '::placeholder color', getComputedStyle(el, '::placeholder').color);
      }
    }
    for (const enfant of el.children) examiner(enfant, opacite);
  }

  examiner(document.body, 1);
  return { teintes, rouges, illisibles, examines };
}

const SEUILS = { saturation: 0.15, luminositeMin: 0.08, luminositeMax: 0.95 };

/** Regroupe les relevés identiques (vingt cartes, une même bordure) pour un message lisible. */
function regrouper(releves: Releve[]): string[] {
  const groupes = new Map<string, { releve: Releve; nombre: number }>();
  for (const r of releves) {
    const cle = `${r.propriete}|${r.valeur}|${r.chemin.split(' > ').pop()}`;
    const groupe = groupes.get(cle);
    if (groupe) groupe.nombre += 1;
    else groupes.set(cle, { releve: r, nombre: 1 });
  }
  return [...groupes.values()].map(
    ({ releve: r, nombre }) =>
      `${r.chemin}${r.texte ? ` « ${r.texte} »` : ''} : ${r.propriete} ${r.valeur}` +
      ` (teinte ${r.teinte}°, saturation ${r.saturation}, luminosité ${r.luminosite})${nombre > 1 ? ` ×${nombre}` : ''}`,
  );
}

/** Relève les couleurs de la page ouverte, imprime les rouges, et échoue sur toute autre teinte. */
async function verifierLeNoirEtBlanc(page: Page, ou: string): Promise<void> {
  const analyse = await page.evaluate(analyserLesCouleurs, SEUILS);
  expect(analyse.examines, `${ou} : aucun élément visible examiné`).toBeGreaterThan(20);

  if (analyse.rouges.length) {
    const lignes = regrouper(analyse.rouges);
    // Imprimés pour la relecture humaine : chaque rouge doit être une erreur
    // ou une action destructrice (guide, § 5).
    for (const ligne of lignes) console.log(`[rouge] ${ou} : ${ligne}`);
    await test.info().attach(`rouges ${ou}`, { body: lignes.join('\n'), contentType: 'text/plain' });
  }
  const illisibles = regrouper(analyse.illisibles);
  expect.soft(illisibles, `${ou} : couleurs qu'aucun analyseur ne sait lire :\n${illisibles.join('\n')}`).toEqual([]);

  const fautes = regrouper(analyse.teintes);
  const MAX = 40;
  expect
    .soft(
      fautes,
      `${ou} : ${analyse.teintes.length} couleur(s) saturée(s) hors du rouge :\n` +
        fautes.slice(0, MAX).join('\n') +
        (fautes.length > MAX ? `\n… et ${fautes.length - MAX} autre(s)` : ''),
    )
    .toEqual([]);
}

// ---------------------------------------------------------------------------
// Les tests : couleurs (et captures) en téléphone et en bureau
// ---------------------------------------------------------------------------

for (const taille of [TELEPHONE, BUREAU]) {
  const dimensions = `${taille.largeur}x${taille.hauteur}`;

  test.describe(`${dimensions}${taille.telephone ? ' (téléphone)' : ''}`, () => {
    test.use(reglages(taille));

    for (const parcours of PAGES) {
      for (const theme of ['light', 'dark'] as const) {
        test(`${parcours.nom}, ${theme === 'light' ? 'clair' : 'sombre'} : aucune teinte hors du rouge`, async ({
          page,
          request,
        }) => {
          await poserLeTheme(page, theme);
          const chemin = await ouvrirAuRepos(parcours, page, request);
          // La classe que pose app.html : sans elle, le sombre ne serait pas vérifié.
          await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`));
          // La capture d'abord : elle reste à relire même quand le contrôle échoue.
          await capturer(page, `${nomDeCapture(chemin)}__${dimensions}__${theme}`);
          await verifierLeNoirEtBlanc(page, `${chemin} ${dimensions} ${theme}`);
        });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// États ouverts : menus, fenêtres, tiroirs, panneaux, erreurs
// ---------------------------------------------------------------------------

/**
 * Ce que l'ouverture d'une page ne montre pas. Un menu, une fenêtre de
 * dialogue, un tiroir, un panneau replié ou un message d'erreur ne sont rendus
 * qu'à la demande (`{#if}`, `hidden`) : le relevé des pages ne les voyait
 * jamais, alors que la conversion les a repeints eux aussi (palette de
 * commande, choix du profil, fenêtres de l'administration…), et qu'une case
 * cochée ou une ligne choisie ne se peignent qu'une fois cochée ou choisie.
 *
 * Chaque état est relevé en clair et en sombre, à la taille où il existe (le
 * menu mobile n'existe pas en 1 440 px). Les rouges y sont attendus (alertes
 * d'erreur, boutons de suppression) : imprimés, comme ailleurs. Rien n'y
 * atteint le modèle : chat, recherche, explication et administration sont
 * simulés, et le générateur d'articles s'ouvre sans rien générer.
 *
 * Avec CAPTURES_DIR, une capture par état dans le sous-dossier `etats/`, à
 * part des captures des pages : <page>--<état>__<l>x<h>__<thème>.png.
 */
interface EtatOuvert {
  /** `<page>--<état>` : le nom du test et de sa capture. */
  nom: string;
  taille: Taille;
  /** Prépare les doublures, ouvre la page et met l'état à l'écran. */
  ouvrir: (page: Page, request: APIRequestContext) => Promise<void>;
}

/** Une réponse JSON simulée, pour `page.route`. */
const repondreEnJson = (statut: number, corps: unknown) => (route: Route) =>
  route.fulfill({ status: statut, contentType: 'application/json', body: JSON.stringify(corps) });

/** Les lois que propose la palette pendant la saisie (`/search/suggest`, simulé). */
const SUGGESTIONS = TEXTES.slice(0, 3).map((texte, i) => ({ id: 101 + i, title: texte.titre, reference: texte.reference }));

/** L'explication d'un article : le bouton appellerait le modèle, elle est simulée. */
const EXPLICATION = {
  law_id: 1,
  article_id: 42,
  number: '1',
  explanation:
    '**En clair**\n\nLe texte fixe les règles applicables à tous.\n\n- Ce qui change pour vous.\n- Ce qu’il faut vérifier.',
  language: 'fr',
  persona: 'citoyen',
  resolved_from: 'database',
  generation_time_ms: 1234,
};

/**
 * Un administrateur connecté sur une page publique. `/auth/me` est simulé :
 * l'API refuserait le jeton factice, et un 401 déconnecte (src/lib/api.ts).
 */
async function administrateurConnecte(page: Page): Promise<void> {
  await connecter(page, SUPERADMIN);
  await page.route('**/api/v1/auth/me', repondreEnJson(200, { ...SUPERADMIN, persona: 'citoyen' }));
}

/** Une loi réelle qui a des articles : son sommaire et son bouton « Expliquer l'article ». */
async function ouvrirUneLoi(page: Page, request: APIRequestContext): Promise<void> {
  const id = await loiAvecArticles(request);
  exiger(id, 'aucune loi avec des articles : API injoignable ou corpus vide');
  await ouvrirAuServeur(page, `/laws/${id}`);
}

/** La palette de commande (Ctrl+K), ouverte par la loupe de l'en-tête, avec des résultats. */
async function ouvrirLaPalette(page: Page): Promise<void> {
  await page.route('**/api/v1/search/suggest**', repondreEnJson(200, { suggestions: SUGGESTIONS }));
  await ouvrirAuServeur(page, '/');
  const palette = page.getByRole('dialog', { name: 'Palette de commande' });
  // Une loupe par mode de l'en-tête (bureau, menu) : celle qui est affichée.
  const loupe = visible(page.getByTestId('site-header').getByRole('button', { name: /^Recherche et actions rapides/ }));
  await cliquerJusqualEffet(loupe, palette);
  await palette.getByRole('textbox').fill('travail');
  await expect(palette.getByText(SUGGESTIONS[0].title)).toBeVisible();
}

const ETATS_OUVERTS: EtatOuvert[] = [
  {
    nom: 'accueil--menu-mobile',
    taille: TELEPHONE,
    ouvrir: async (page) => {
      await ouvrirAuServeur(page, '/');
      await cliquerJusqualEffet(page.getByTestId('nav-mobile-toggle'), page.getByTestId('nav-mobile-panel'));
    },
  },
  {
    // Connecté, le menu porte le nom, « Administration » et « Se déconnecter ».
    nom: 'about--menu-mobile-administrateur',
    taille: TELEPHONE,
    ouvrir: async (page) => {
      await administrateurConnecte(page);
      await ouvrirAuServeur(page, '/about');
      await cliquerJusqualEffet(page.getByTestId('nav-mobile-toggle'), page.getByTestId('logout-mobile'));
    },
  },
  {
    nom: 'about--entete-administrateur',
    taille: BUREAU,
    ouvrir: async (page) => {
      await administrateurConnecte(page);
      await ouvrirAuServeur(page, '/about');
      await expect(page.getByTestId('user-name')).toBeVisible();
    },
  },
  { nom: 'accueil--palette', taille: TELEPHONE, ouvrir: ouvrirLaPalette },
  { nom: 'accueil--palette', taille: BUREAU, ouvrir: ouvrirLaPalette },
  {
    // Sans profil enregistré, la question « Qui êtes-vous ? » s'ouvre seule.
    nom: 'about--choix-du-profil-premiere-visite',
    taille: TELEPHONE,
    ouvrir: async (page) => {
      await page.addInitScript(() => localStorage.removeItem('jurix-persona'));
      await ouvrirAuServeur(page, '/about');
      await expect(page.getByTestId('persona-dialog')).toBeVisible();
    },
  },
  {
    nom: 'about--choix-du-profil',
    taille: BUREAU,
    ouvrir: async (page) => {
      await ouvrirAuServeur(page, '/about');
      await cliquerJusqualEffet(page.getByTestId('persona-toggle'), page.getByTestId('persona-dialog'));
    },
  },
  {
    nom: 'chat--conversations',
    taille: TELEPHONE,
    ouvrir: async (page) => {
      await connecter(page, MEMBRE);
      await simulerLeChat(page);
      await page.goto('/chat');
      await cliquerJusqualEffet(
        page.getByTestId('conversations-toggle'),
        page.locator('[data-testid="conversations-toggle"][aria-expanded="true"]'),
      );
      await expect(page.getByTestId('conversation-item').first()).toBeInViewport();
    },
  },
  {
    // La colonne des conversations, l'une d'elles choisie et rouverte.
    nom: 'chat--conversation-rouverte',
    taille: BUREAU,
    ouvrir: async (page) => {
      await connecter(page, MEMBRE);
      await simulerLeChat(page);
      await page.goto('/chat');
      await cliquerJusqualEffet(
        page.getByTestId('conversation-item').first(),
        page.getByRole('log').getByText(REPONSE_ROUVERTE),
      );
    },
  },
  {
    nom: 'chat--menu',
    taille: TELEPHONE,
    ouvrir: async (page) => {
      await simulerLeChat(page);
      await page.goto('/chat');
      await cliquerJusqualEffet(page.getByTestId('chat-menu-toggle'), page.getByTestId('chat-menu'));
    },
  },
  {
    // L'API injoignable : l'appel est coupé avant de partir, jamais servi par le modèle.
    nom: 'chat--api-injoignable',
    taille: TELEPHONE,
    ouvrir: async (page) => {
      await page.route('**/api/v1/rag/ask/stream', (route) => route.abort());
      await page.goto('/chat');
      await saisirJusqualEffet(saisieDuChat(page), QUESTION, page.getByTestId('chat-error'));
    },
  },
  {
    // Le panneau des filtres, replié sous lg, avec une catégorie cochée : le
    // fond d'une case cochée est la couleur de son texte (module des
    // formulaires), un bleu par défaut s'y verrait.
    nom: 'search--filtres',
    taille: TELEPHONE,
    ouvrir: async (page) => {
      await simulerLaRecherche(page);
      await page.goto('/search?q=travail');
      await expect(page.getByTestId('search-status')).toContainText(String(REPONSE_RECHERCHE.total));
      const panneau = page.locator('#filtres-recherche');
      await cliquerJusqualEffet(page.getByTestId('search-filters-toggle'), panneau);
      await panneau.locator('input[type="checkbox"]').first().check();
    },
  },
  {
    nom: 'laws--sommaire',
    taille: TELEPHONE,
    ouvrir: async (page, request) => {
      await ouvrirUneLoi(page, request);
      await cliquerJusqualEffet(page.getByTestId('law-toc-toggle'), page.getByTestId('law-toc'));
    },
  },
  {
    nom: 'laws--explication',
    taille: BUREAU,
    ouvrir: async (page, request) => {
      await page.route('**/api/v1/laws/*/explain-article', repondreEnJson(200, EXPLICATION));
      await ouvrirUneLoi(page, request);
      await cliquerJusqualEffet(page.getByTestId('law-explain').first(), page.getByTestId('law-explain-answer'));
    },
  },
  {
    nom: 'admin--tiroir',
    taille: TELEPHONE,
    ouvrir: async (page) => {
      await simulerLAdministration(page);
      await page.goto('/admin');
      await expect(page.getByTestId('admin-profils')).toBeVisible();
      await cliquerJusqualEffet(
        page.getByTestId('admin-menu-toggle'),
        page.locator('[data-testid="admin-menu-toggle"][aria-expanded="true"]'),
      );
      await expect(page.getByTestId('admin-sidebar')).toBeInViewport();
    },
  },
  {
    nom: 'admin_users--compte',
    taille: BUREAU,
    ouvrir: async (page) => {
      await simulerLAdministration(page);
      await page.goto('/admin/users');
      await expect(visible(page.getByText(UTILISATEURS[1].email))).toBeVisible();
      await cliquerJusqualEffet(page.getByTestId('user-new'), page.getByTestId('user-modal'));
    },
  },
  {
    nom: 'admin_documents--televersement',
    taille: BUREAU,
    ouvrir: async (page) => {
      await simulerLAdministration(page);
      await page.goto('/admin/documents');
      await expect(visible(page.getByText(LOIS[0].title))).toBeVisible();
      await cliquerJusqualEffet(page.getByTestId('doc-new'), page.getByTestId('upload-modal'));
    },
  },
  {
    nom: 'admin_documents--edition',
    taille: BUREAU,
    ouvrir: async (page) => {
      await simulerLAdministration(page);
      await page.goto('/admin/documents');
      await expect(visible(page.getByText(LOIS[0].title))).toBeVisible();
      await cliquerJusqualEffet(
        visible(page.getByRole('button', { name: 'Modifier', exact: true })),
        page.getByTestId('edit-modal'),
      );
    },
  },
  {
    // Le générateur s'ouvre ; rien n'est généré.
    nom: 'admin_blog--generateur',
    taille: BUREAU,
    ouvrir: async (page) => {
      await simulerLAdministration(page);
      await page.goto('/admin/blog');
      await expect(visible(page.getByText(ARTICLES_DU_BLOG_ADMIN[0].title))).toBeVisible();
      await cliquerJusqualEffet(
        page.locator('main').getByRole('button', { name: /Générer un article IA/ }),
        page.getByRole('heading', { name: 'Générateur d\'article automatique' }),
      );
    },
  },
  {
    // La fenêtre d'édition d'un article publié : sa case « publié » est cochée.
    nom: 'admin_blog--edition',
    taille: BUREAU,
    ouvrir: async (page) => {
      await simulerLAdministration(page);
      await page.goto('/admin/blog');
      await expect(visible(page.getByText(ARTICLES_DU_BLOG_ADMIN[0].title))).toBeVisible();
      await cliquerJusqualEffet(
        visible(page.getByRole('button', { name: 'Modifier', exact: true })),
        page.getByRole('dialog', { name: 'Modifier l\'article' }),
      );
    },
  },
  {
    // Un 401 simulé : l'alerte de la connexion refusée, et le lien vers la
    // réinitialisation qui la suit.
    nom: 'login--erreur',
    taille: TELEPHONE,
    ouvrir: async (page) => {
      await page.route('**/api/v1/auth/login/json', repondreEnJson(401, { detail: 'Identifiants invalides' }));
      await ouvrirAuServeur(page, '/login');
      // Désactivé jusqu'à l'hydratation : un envoi plus tôt rechargerait la page.
      await expect(page.getByTestId('login-submit')).toBeEnabled();
      await page.getByTestId('login-email').fill('lecteur@jurix.cm');
      await page.getByTestId('login-password').fill('MotDePasse1');
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('login-reset-hint')).toBeVisible();
    },
  },
  {
    // Une adresse mal écrite : le champ en erreur et son message.
    nom: 'forgot-password--adresse-invalide',
    taille: BUREAU,
    ouvrir: async (page) => {
      await page.route('**/api/v1/auth/password/forgot', repondreEnJson(202, {}));
      await ouvrirAuServeur(page, '/forgot-password');
      await expect(page.getByTestId('forgot-submit')).toBeEnabled();
      await page.getByTestId('forgot-email').fill('rahim@jurix');
      await page.getByTestId('forgot-submit').click();
      await expect(page.getByTestId('forgot-error')).toBeVisible();
    },
  },
];

for (const taille of [TELEPHONE, BUREAU]) {
  const dimensions = `${taille.largeur}x${taille.hauteur}`;

  test.describe(`${dimensions}${taille.telephone ? ' (téléphone)' : ''}, états ouverts`, () => {
    test.use(reglages(taille));

    for (const etat of ETATS_OUVERTS.filter((e) => e.taille === taille)) {
      for (const theme of ['light', 'dark'] as const) {
        test(`${etat.nom}, ${theme === 'light' ? 'clair' : 'sombre'} : aucune teinte hors du rouge`, async ({
          page,
          request,
        }) => {
          await poserLeTheme(page, theme);
          await etat.ouvrir(page, request);
          await attendreLeRepos(page);
          await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`));
          await capturer(page, `etats/${etat.nom}__${dimensions}__${theme}`);
          await verifierLeNoirEtBlanc(page, `${etat.nom} ${dimensions} ${theme}`);
        });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Captures seules : tablettes et téléphone en paysage, en clair
// ---------------------------------------------------------------------------

for (const taille of TAILLES_DES_CAPTURES) {
  const dimensions = `${taille.largeur}x${taille.hauteur}`;

  test.describe(`${dimensions} (captures)`, () => {
    test.use(reglages(taille));
    test.skip(!DOSSIER_DES_CAPTURES, 'CAPTURES_DIR non défini : rien à capturer');

    for (const parcours of PAGES) {
      test(`${parcours.nom} : capture en clair`, async ({ page, request }) => {
        await poserLeTheme(page, 'light');
        const chemin = await ouvrirAuRepos(parcours, page, request);
        await capturer(page, `${nomDeCapture(chemin)}__${dimensions}__light`);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Interface en anglais : aucun reste de français
// ---------------------------------------------------------------------------

/**
 * Les chaînes françaises de l'interface (src/lib/stores/language.ts) qui
 * diffèrent de leur traduction anglaise. Lues dans le fichier source : le
 * module importe `$app/environment`, que la spec ne sait pas résoudre.
 */
function chainesFrancaises(): string[] {
  const source = fs.readFileSync(new URL('../../../src/lib/stores/language.ts', import.meta.url), 'utf8');
  const debutEn = source.search(/^\s{2}en:\s*\{/m);
  const lireBloc = (bloc: string) => {
    const table = new Map<string, string>();
    const motif = /^\s*'([^']+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/gm;
    for (let m = motif.exec(bloc); m; m = motif.exec(bloc)) {
      table.set(m[1], (m[2] ?? m[3]).replace(/\\(.)/g, '$1'));
    }
    return table;
  };
  const fr = lireBloc(source.slice(0, debutEn));
  const en = lireBloc(source.slice(debutEn));
  return [...fr.entries()]
    .filter(([cle, valeur]) => en.has(cle) && en.get(cle) !== valeur && /\p{L}{3}/u.test(valeur))
    .map(([, valeur]) => valeur.replace(/\s+/g, ' ').trim());
}

interface TexteAffiche {
  texte: string;
  chemin: string;
}

/**
 * Les textes affichés de l'interface : nœuds de texte visibles et
 * placeholders. Exécutée dans la page.
 */
function textesAffiches(): TexteAffiche[] {
  const sortie: TexteAffiche[] = [];
  const decrire = (el: Element) => {
    const morceaux: string[] = [];
    for (let n: Element | null = el; n && n !== document.body && morceaux.length < 4; n = n.parentElement) {
      const testid = n.getAttribute('data-testid');
      morceaux.unshift(n.tagName.toLowerCase() + (n.id ? `#${n.id}` : '') + (testid ? `[data-testid="${testid}"]` : ''));
    }
    return morceaux.join(' > ');
  };
  const estVisible = (el: Element) => {
    const boite = el.getBoundingClientRect();
    if (boite.width <= 1 || boite.height <= 1) return false;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.visibility !== 'visible' || s.opacity === '0' || s.display === 'none') return false;
    }
    return true;
  };
  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
    const texte = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
    const parent = n.parentElement;
    if (!texte || !parent || parent.closest('script, style, noscript')) continue;
    if (estVisible(parent)) sortie.push({ texte, chemin: decrire(parent) });
  }
  for (const champ of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[placeholder], textarea[placeholder]')) {
    if (estVisible(champ)) sortie.push({ texte: champ.placeholder.trim(), chemin: `${decrire(champ)} (placeholder)` });
  }
  return sortie;
}

/**
 * Mots qui signent le français, et qu'une interface anglaise n'affiche pas.
 * Pas « en », « a », « son », « plus » : ils existent aussi en anglais.
 */
const MOTS_FRANCAIS = new Set(
  (
    'le la les des du de et aux au une pour avec sans sur dans votre vos notre nos est sont cette ces qui que ' +
    'tous toutes leur leurs nous vous pas être très aucun aucune textes texte lois loi rechercher accueil ' +
    'connexion inscription retour suivant précédent télécharger partager sommaire général'
  ).split(' '),
);
/** Lettres accentuées du français ; l'anglais de l'interface n'en a pas. */
const ACCENTS = /[àâäçéèêëîïôöùûüÿœæ]/i;
/** Élisions : l'article, d'un, s'il, qu'une. */
const ELISION = /(^|[^\p{L}])(?:[ldjnmst]|qu)['’]\p{L}/iu;
/** Noms de langue écrits dans leur langue, à dessein (sélecteur de langue). */
const NOMS_DE_LANGUE = /^(français|english|fr|en)$/i;

function signeFrancais(texte: string, francais: Set<string>): string | null {
  if (NOMS_DE_LANGUE.test(texte)) return null;
  if (francais.has(texte)) return 'chaîne française de language.ts';
  const mots = texte.toLowerCase().split(/[^\p{L}']+/u).filter(Boolean);
  const mot = mots.find((m) => MOTS_FRANCAIS.has(m));
  if (mot) return `mot français « ${mot} »`;
  if (ELISION.test(texte)) return 'élision française';
  const accentue = mots.find((m) => ACCENTS.test(m) && !NOMS_DE_LANGUE.test(m));
  if (accentue) return `mot accentué « ${accentue} »`;
  return null;
}

/** Le texte d'une loi, tel que le rend l'API : ce qui en vient est du contenu, pas de l'interface. */
async function texteDeLaLoi(request: APIRequestContext, id: number): Promise<string> {
  const reponse = await request.get(`${API}/api/v1/laws/${id}`, { failOnStatusCode: false }).catch(() => null);
  if (!reponse?.ok()) return '';
  const loi = (await reponse.json().catch(() => ({}))) as Record<string, unknown>;
  const morceaux: string[] = [];
  const ramasser = (v: unknown) => {
    if (typeof v === 'string') morceaux.push(v);
    else if (Array.isArray(v)) v.forEach(ramasser);
    else if (v && typeof v === 'object') Object.values(v).forEach(ramasser);
  };
  ramasser(loi);
  return morceaux.join('\n').replace(/\*+/g, '').replace(/\s+/g, ' ');
}

const PAGES_EN_ANGLAIS = PAGES.filter((p) => p.nom === '/' || p.nom === '/laws/[id]');

for (const taille of [TELEPHONE, BUREAU]) {
  const dimensions = `${taille.largeur}x${taille.hauteur}`;

  test.describe(`${dimensions} en anglais`, () => {
    test.use(reglages(taille));

    for (const parcours of PAGES_EN_ANGLAIS) {
      test(`${parcours.nom} : aucun reste de français dans l’interface`, async ({ page, request }) => {
        await poserLeTheme(page, 'light');
        await poserLaLangue(page, 'en');
        const chemin = await ouvrirAuRepos(parcours, page, request);
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await capturer(page, `${nomDeCapture(chemin)}__${dimensions}__light-en`);

        // Le contenu de la loi reste en français : tout texte qui s'y trouve
        // tel quel est mis à part (titre, articles, références).
        const loi = parcours.nom === '/laws/[id]' ? await texteDeLaLoi(request, Number((await loiAvecArticles(request)) ?? 0)) : '';
        const francais = new Set(chainesFrancaises());
        const restes = (await page.evaluate(textesAffiches))
          .filter(({ texte }) => !(loi && loi.includes(texte.replace(/\s+/g, ' '))))
          .map(({ texte, chemin: ou }) => ({ texte, ou, signe: signeFrancais(texte, francais) }))
          .filter((r) => r.signe);
        expect(
          restes.map((r) => `${r.ou} : « ${r.texte.slice(0, 80)} » (${r.signe})`),
          `${chemin} ${dimensions} en anglais : du français reste affiché dans l’interface`,
        ).toEqual([]);
      });
    }
  });
}
