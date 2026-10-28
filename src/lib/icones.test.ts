import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ICONE_DOMAINE_INCONNU } from '$lib/categories';
import { ICONES, elementsIcone, estNomIcone, type NomIcone } from '$lib/icones';
import { PERSONA_ICONE } from '$lib/stores/persona';

/**
 * Le registre des icônes (src/lib/icones.ts) ne contient que du SVG sain.
 *
 * POURQUOI. Le composant Icone crée dans son <svg> chaque élément d'une
 * entrée, relu par `elementsIcone`. Une entrée mal formée perdrait des tracés
 * en silence (l'icône s'afficherait à moitié) ; un attribut `style`, `on…` ou
 * `href` ferait d'une simple icône un vecteur d'injection ; une couleur écrite
 * en dur échapperait au mode sombre et au noir et blanc du site, qui reposent
 * sur `currentColor`.
 *
 * Le second bloc relit les noms d'icônes employés dans src : chacun existe, et
 * chaque entrée du registre sert.
 */

const SVG = 'http://www.w3.org/2000/svg';

/** Les éléments de dessin de Lucide, et rien d'autre. */
const ELEMENTS = new Set(['path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect']);

/** Attributs de géométrie ; `fill` seulement à `currentColor` (points pleins). */
const ATTRIBUTS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'width', 'height', 'points', 'fill']);

/** Les éléments d'une entrée, lus par un VRAI analyseur XML, ou `null` si elle est mal formée. */
function analyser(balisage: string): Element[] | null {
  let document: Document;
  try {
    document = new DOMParser().parseFromString(`<svg xmlns="${SVG}">${balisage}</svg>`, 'image/svg+xml');
  } catch {
    return null;
  }
  if (document.getElementsByTagName('parsererror').length > 0) return null;
  const racine = document.documentElement;
  if (racine.localName !== 'svg' || racine.namespaceURI !== SVG) return null;
  return [...racine.children];
}

/** Ce qui ne va pas dans une entrée ; vide si elle est saine. */
function defauts(balisage: string): string[] {
  const elements = analyser(balisage);
  if (elements === null) return ['SVG mal formé'];
  if (elements.length === 0) return ['aucun élément de dessin'];
  const trouves: string[] = [];
  for (const element of elements) {
    if (element.namespaceURI !== SVG) trouves.push(`<${element.localName}> hors de l'espace de noms SVG`);
    if (!ELEMENTS.has(element.localName)) trouves.push(`élément <${element.localName}> interdit`);
    if (element.children.length > 0) trouves.push(`<${element.localName}> contient des éléments`);
    for (const { name, value } of [...element.attributes]) {
      if (!ATTRIBUTS.has(name)) trouves.push(`attribut ${name} interdit sur <${element.localName}>`);
      else if (name === 'fill' && value !== 'currentColor') trouves.push(`fill="${value}" : seulement currentColor`);
    }
  }
  return trouves;
}

const NOMS = Object.keys(ICONES) as NomIcone[];

describe('registre des icônes', () => {
  it('détecte bien une entrée cassée (garde-fou du contrôle lui-même)', () => {
    // Sans ce test, un analyseur trop indulgent rendrait le suivant vrai pour
    // n'importe quoi.
    expect(defauts('<path d="M0 0"')).toEqual(['SVG mal formé']);
    expect(defauts('<path d="M0 0" /></svg><svg>')).toEqual(['SVG mal formé']);
    expect(defauts('')).toEqual(['aucun élément de dessin']);
    expect(defauts('<path d="M0 0" onload="alert(1)" />')).toEqual(['attribut onload interdit sur <path>']);
    expect(defauts('<script>alert(1)</script>')).toEqual(['élément <script> interdit']);
    expect(defauts('<circle cx="1" cy="1" r="1" fill="#2563EB" />')).toEqual([
      'fill="#2563EB" : seulement currentColor',
    ]);
    expect(defauts('<g><path d="M0 0" /></g>')).toEqual(['élément <g> interdit', '<g> contient des éléments']);
  });

  it('ne contient que du SVG bien formé, sans attribut ni couleur étrangers', () => {
    const fautives = NOMS.flatMap((nom) => defauts(ICONES[nom]).map((defaut) => `${nom} : ${defaut}`));
    expect(fautives).toEqual([]);
    // Garde-fou : un registre vidé par erreur passerait le contrôle ci-dessus.
    // Le seuil reste bas : le registre ne garde que les icônes affichées
    // (dernier bloc de ce fichier).
    expect(NOMS.length).toBeGreaterThan(50);
  });

  it('garde chaque entrée sur une ligne, sans balise <svg> ni commentaire', () => {
    const fautives = NOMS.filter((nom) => {
      const balisage: string = ICONES[nom];
      return balisage !== balisage.trim() || /[\n\r]|<\/?svg|<!--/.test(balisage);
    });
    expect(fautives).toEqual([]);
  });

  it('nomme les icônes comme Lucide, dans l’ordre alphabétique', () => {
    // Noms en kebab-case, ceux du paquet ; l'ordre garde les ajouts lisibles
    // dans un diff et évite les doublons à la relecture.
    expect(NOMS.filter((nom) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(nom))).toEqual([]);
    expect(NOMS).toEqual([...NOMS].sort());
  });

  it('relit chaque entrée sans rien perdre ni ajouter', () => {
    // Ce que dessine le composant Icone : réécrits à la suite, les éléments
    // relus doivent redonner l'entrée caractère pour caractère. Une forme
    // inattendue (attribut sans guillemets, entité &…;) que la relecture
    // sauterait ferait échouer ce test au lieu d'amputer l'icône.
    const fautives = NOMS.filter((nom) => {
      const reecrit = elementsIcone(nom)
        .map(({ balise, attributs }) => {
          const liste = Object.entries(attributs).map(([cle, valeur]) => ` ${cle}="${valeur}"`);
          return `<${balise}${liste.join('')} />`;
        })
        .join('');
      return reecrit !== ICONES[nom] || /&/.test(ICONES[nom]);
    });
    expect(fautives).toEqual([]);
  });

  it('ne relit une icône qu’une fois', () => {
    expect(elementsIcone('scale')).toBe(elementsIcone('scale'));
    expect(elementsIcone('scale').map((e) => e.balise)).toEqual(['path', 'path', 'path', 'path', 'path']);
    expect(elementsIcone('clock')).toEqual([
      { balise: 'circle', attributs: { cx: '12', cy: '12', r: '10' } },
      { balise: 'path', attributs: { d: 'M12 6v6l4 2' } },
    ]);
  });

  it('reconnaît un nom du registre, et seulement lui', () => {
    expect(estNomIcone('scale')).toBe(true);
    expect(estNomIcone('balance')).toBe(false); // nom de l'ancienne police, pas un nom Lucide
    expect(estNomIcone('trash-2')).toBe(false); // alias de Lucide 0.x, devenu « trash »
    expect(estNomIcone('toString')).toBe(false); // propriété héritée d'un objet
    expect(estNomIcone('__proto__')).toBe(false);
    expect(estNomIcone(42)).toBe(false);
    expect(estNomIcone(undefined)).toBe(false);
  });
});

/**
 * Les noms d'icônes employés dans src, lus dans le code source.
 *
 * POURQUOI LES DEUX SENS. Un nom absent du registre donne une icône vide
 * (Icone ne dessine rien et ne le dit qu'en développement) ; svelte-check
 * attrape les littéraux typés `NomIcone`, pas un nom glissé dans une table
 * par une conversion de type. Une entrée que plus rien n'affiche, elle, pèse
 * sur le JavaScript de chaque page (environ 60 octets compressés) sans servir.
 *
 * Où un nom d'icône s'écrit dans ce dépôt, et rien d'autre :
 * - `<Icone nom="…">`, ou `nom={…}` : les chaînes de l'expression, hors de
 *   ce qui est entre crochets (`PERSONA_ICONE[x ?? "general"]` indexe une
 *   table, « general » n'est pas une icône) ;
 * - `icon="…"` (prop typée `NomIcone`, StatsCard) ;
 * - les champs `icon: "…"` et `icone: "…"` (onglets de la recherche, palette,
 *   statuts, domaines juridiques) ;
 * - `…: NomIcone = "…"` et les tables `Record<…, NomIcone> = { … }`.
 * Les commentaires sont retirés avant la lecture : un exemple dans un
 * commentaire ne compte pas comme un usage.
 */
const RACINE_SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Les fichiers de src lus par le contrôle : composants et modules, hors tests et registre. */
function fichiersSources(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) return fichiersSources(chemin);
    if (!/\.(svelte|ts)$/.test(entree.name) || /\.(test|spec)\.ts$/.test(entree.name)) return [];
    return relative(RACINE_SRC, chemin) === join('lib', 'icones.ts') ? [] : [chemin];
  });
}

/** Le source sans ses commentaires HTML, de bloc et de ligne (`https://` est gardé). */
function sansCommentaires(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

/** Le contenu d'un bloc qui s'ouvre à `debut` (sur `{`), jusqu'à son `}` apparié. */
function bloc(source: string, debut: number): string {
  let profondeur = 0;
  for (let i = debut; i < source.length; i++) {
    if (source[i] === '{') profondeur++;
    else if (source[i] === '}' && --profondeur === 0) return source.slice(debut + 1, i);
  }
  return source.slice(debut + 1);
}

const CHAINE = /(["'])([^"'\n]*)\1/g;

/** Les noms d'icônes écrits dans `source` (voir plus haut où ils s'écrivent). */
function nomsEmployes(brut: string): string[] {
  const source = sansCommentaires(brut);
  const noms: string[] = [];
  for (const m of source.matchAll(/(?<![\w-])(?:nom|icon)=(["'])([^"']*)\1/g)) noms.push(m[2]);
  for (const m of source.matchAll(/(?<![\w-])(?:icon|icone)\s*:\s*(["'])([^"']*)\1/g)) noms.push(m[2]);
  for (const m of source.matchAll(/:\s*NomIcone\s*=\s*(["'])([^"']*)\1/g)) noms.push(m[2]);
  for (const m of source.matchAll(/(?<![\w-])nom=\{/g)) {
    // Les crochets indexent une table : leurs chaînes sont des clés, pas des icônes.
    let expression = bloc(source, m.index + m[0].length - 1);
    while (/\[[^[\]]*\]/.test(expression)) expression = expression.replace(/\[[^[\]]*\]/g, ' ');
    for (const c of expression.matchAll(CHAINE)) noms.push(c[2]);
  }
  for (const m of source.matchAll(/Record<[^;=]*NomIcone>\s*=\s*\{/g)) {
    for (const c of bloc(source, m.index + m[0].length - 1).matchAll(/:\s*(["'])([^"']*)\1/g)) noms.push(c[2]);
  }
  return noms;
}

/** Nom d'icône -> fichiers de src qui l'emploient. */
const EMPLOIS = new Map<string, string[]>();
for (const chemin of fichiersSources(RACINE_SRC)) {
  for (const nom of nomsEmployes(readFileSync(chemin, 'utf8'))) {
    EMPLOIS.set(nom, [...(EMPLOIS.get(nom) ?? []), relative(RACINE_SRC, chemin)]);
  }
}

describe('noms d’icônes employés dans src', () => {
  it('lit bien les noms là où ils s’écrivent (garde-fou du contrôle lui-même)', () => {
    expect(nomsEmployes('<Icone nom="scale" class="text-lg" />')).toEqual(['scale']);
    expect(nomsEmployes('<Icone nom={copie ? "check" : \'link\'} />')).toEqual(['check', 'link']);
    expect(nomsEmployes('<Icone nom={PERSONA_ICONE[p ?? "general"]} />')).toEqual([]);
    expect(nomsEmployes('<Icone nom={t ? T[a["b"]] : "x"} />')).toEqual(['x']);
    expect(nomsEmployes('<StatsCard icon="zap" color="x" />')).toEqual(['zap']);
    expect(nomsEmployes("{ key: 'admin.draft', icone: 'pen-line' }, { icon: \"files\" }")).toEqual([
      'pen-line',
      'files',
    ]);
    expect(nomsEmployes("export const INCONNU: NomIcone = 'scroll-text';")).toEqual(['scroll-text']);
    expect(nomsEmployes('const T: Record<Etat, NomIcone> = { envoi: "upload", fait: \'check\' };')).toEqual([
      'upload',
      'check',
    ]);
    expect(nomsEmployes('<!-- <Icone nom="menu" /> -->\n// nom="x"\n/* icon: "zap" */')).toEqual([]);
    expect(nomsEmployes('const url = "https://lucide.dev"; // nom="x"')).toEqual([]);
  });

  it('trouve les icônes du site, des pages aux tables typées', () => {
    // Un contrôle qui ne lirait plus rien (chemin changé, motif cassé)
    // passerait le test suivant sans rien vérifier.
    expect(EMPLOIS.size).toBeGreaterThan(50);
    expect(EMPLOIS.get('scale')).toContain(join('lib', 'components', 'SiteHeader.svelte'));
    expect(EMPLOIS.get('archive')).toContain(join('lib', 'components', 'StatusBadge.svelte'));
    expect(EMPLOIS.get('zap')).toContain(join('routes', 'admin', '+page.svelte'));
    expect(EMPLOIS.get('user-round-group')).toContain(join('lib', 'categories.ts'));
    expect(EMPLOIS.get('briefcase-business')).toContain(join('lib', 'stores', 'persona.ts'));
  });

  it('ne nomme que des icônes du registre', () => {
    const inconnus = [...EMPLOIS].filter(([nom]) => !estNomIcone(nom)).map(([nom, f]) => `${nom} (${f.join(', ')})`);
    expect(inconnus, 'à ajouter dans src/lib/icones.ts, ou nom à corriger').toEqual([]);
    // Les tables qu'on affiche par leur nom (`nom={PERSONA_ICONE[…]}`), relues
    // à l'exécution : leur typage peut avoir été contourné.
    expect(Object.values(PERSONA_ICONE).filter((nom) => !estNomIcone(nom))).toEqual([]);
    expect(estNomIcone(ICONE_DOMAINE_INCONNU)).toBe(true);
  });

  it('n’embarque aucune icône que rien n’affiche', () => {
    expect(
      NOMS.filter((nom) => !EMPLOIS.has(nom)),
      'entrées inutilisées : les retirer de src/lib/icones.ts',
    ).toEqual([]);
  });
});
