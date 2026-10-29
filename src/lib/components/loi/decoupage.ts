/**
 * Découpage du texte officiel d'une loi (`law.content`) en divisions et en
 * articles, pour la page d'un texte : lecture article par article, texte
 * entier (P10), sommaire, références à copier (P2).
 *
 * POURQUOI LE TEXTE ET NON `law.articles`. L'API sert bien un sommaire
 * (`articles[]` : numéro, section, page), mais sans le texte des articles :
 * il n'existe que dans `law.content`. Et ce sommaire est celui de l'ingestion,
 * fait de morceaux (« 55.1 », « SECTION_2 », un article 5 collé à la fin du
 * morceau « 2 ») que le lecteur ne doit pas voir. Le découpage reste donc
 * celui de la page, en fonctions PURES, testées sur des extraits réels
 * (decoupage.test.ts).
 *
 * LE MÊME DÉCOUPAGE QUE LES TESTS DE BOUT EN BOUT. `chat-rendu.spec.ts`
 * importe `decouperLeTexte` pour choisir une loi et vérifier qu'un lien
 * `?article=` ouvre le bon article : une copie de ses règles dans la spec
 * divergerait à la première retouche (« Art. N. », divisions élargies).
 *
 * L'ORDRE DE L'OCR N'EST PAS CELUI DU TEXTE. Le texte vient d'une lecture du
 * PDF page par page (marqueurs `<<PAGE:N>>`), qui range parfois un en-tête
 * de division loin de sa place : en bas de la page quand il était imprimé en
 * haut (Constitution), ou entre l'intitulé d'un article et son texte (Code
 * pénal). Pris tel quel, un tel en-tête fermait l'article en cours : la fin
 * de l'article passait hors de tout article, visible seulement en texte
 * entier, absente de « Copier le texte » et de l'extrait envoyé à
 * « Expliquer l'article », et le sommaire rangeait les articles sous le
 * mauvais titre (vérification r1 du 29/10/2026). `remettreLesEnTetesEnPlace`
 * les remet à leur place, seulement quand le texte le prouve.
 */

// Chemin relatif, et non `$lib/article` : chat-rendu.spec.ts importe ce module
// hors de Vite, par le chargeur de Playwright, qui ne doit dépendre d'aucun
// alias. `./reference` n'est qu'un import de type, effacé à la compilation.
import { LONGUEUR_MAX_NUMERO, normaliserNumeroArticle } from '../../article';
import type { Traduire } from './reference';

/** Les mots qui ouvrent une division du texte, du plus large au plus fin. */
export type MotDeDivision = 'livre' | 'titre' | 'chapitre' | 'section' | 'sous-section' | 'paragraphe';

/** Une ligne de division (« CHAPITRE III DE LA PARTICIPATION… »), lue. */
export interface EnTeteDeDivision {
  /** La ligne telle qu'écrite, sans l'emphase markdown (`**`, `#`). */
  ligne: string;
  mot: MotDeDivision;
  /**
   * Le numéro de la division, chiffres romains réparés quand l'OCR les a lus
   * de travers (« I1 » pour II, « U » pour V) ; « PREMIER », « PRÉLIMINAIRE »
   * ou « UNIQUE » tels quels.
   */
  numeral: string;
  /**
   * L'intitulé, mot pour mot : la suite de la ligne, ou la ligne suivante quand
   * l'en-tête n'en portait pas (« CHAPITRE V » puis « DE LA DELIVRANCE… »).
   * Jamais remis en minuscules : le texte d'origine écrit souvent ses
   * capitales sans accents, et « DE LA CREATION » deviendrait « de la
   * creation », une faute.
   */
  intitule: string;
  /** Autres lignes entre cet en-tête et la suite (rare : une note, un sous-titre). */
  lignes: string[];
}

export interface ArticleDuTexte {
  /** Place dans la liste plate des articles, à partir de 0. */
  rang: number;
  /** Le numéro lu dans la ligne « Article N » (chiffres seulement). */
  numero: string;
  /** `normaliserNumeroArticle(numero)` : la clé de `?article=`, de `#art-N` et du statut. */
  cle: string;
  /**
   * Ce qui suit « Article N » sur la même ligne : un intitulé (« Imputabilité »)
   * ou, le plus souvent dans un décret, la première phrase de l'article
   * (voir `titreEstLeTexte`). Vide quand la ligne s'arrête au numéro.
   */
  titre: string;
  /** Les lignes suivantes, une par paragraphe. */
  lignes: string[];
  /** Place de la division qui le contient dans `TexteDecoupe.divisions`. */
  division: number;
  /** Rang de cet article parmi ceux qui portent le même numéro (compilations), à partir de 0. */
  occurrence: number;
}

export interface DivisionDuTexte {
  /** Place dans `TexteDecoupe.divisions`, à partir de 0. */
  rang: number;
  /**
   * Les en-têtes lus depuis la division précédente, dans l'ordre : « TITRE II »
   * puis « CHAPITRE 1 » quand le titre n'a pas d'article à lui. Vide pour
   * l'ouverture du texte (ce qui précède le premier en-tête).
   */
  entetes: EnTeteDeDivision[];
  /**
   * Toutes les divisions qui la contiennent, de la plus large à elle-même
   * (« LIVRE I », « TITRE 2 », « CHAPITRE I ») : la chaîne ne garde que les
   * en-têtes lus depuis la division précédente. Sert à reconnaître la section
   * d'un changement dans une compilation (statut.ts).
   */
  ancetres: EnTeteDeDivision[];
  /**
   * Lignes de l'ouverture, avant le premier article et le premier en-tête :
   * les visas d'un décret (« Vu la Constitution ; … »), le préambule.
   */
  introduction: string[];
  articles: ArticleDuTexte[];
}

export interface TexteDecoupe {
  divisions: DivisionDuTexte[];
  articles: ArticleDuTexte[];
  /** Le texte a-t-il au moins une division (titre, chapitre…) ? Sinon, ses articles se suivent sans titre. */
  structure: boolean;
}

/* -------------------------------------------------------------------------- */
/* Lignes                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Marqueurs de page de l'OCR (`<<PAGE:12>>`) : jamais affichés, mais lus. La
 * page d'une ligne dit si un en-tête finit sa page (`remettreLesEnTetesEnPlace`).
 */
const MARQUEUR_DE_PAGE = /<<PAGE:?\s*\d+>>/gi;

/**
 * Une ligne qui ouvre un article. Deux formes :
 * - « Article N », comme avant : le PDF converti écrit `**ARTICLE 1er.**-` et
 *   parfois `**Article35.-**` (emphase markdown, pas toujours d'espace), et
 *   l'OCR « Article. 2.- » ;
 * - « Art. N » suivi d'un séparateur (« - Art. 2. - La loi… »,
 *   « Art.10- (1) … », « Art. 6: … »). Le séparateur est exigé : une phrase
 *   qui commence par « Art. 5 du décret… » n'ouvre pas d'article.
 * Sans la seconde forme, le Code civil (« Art. N. », 2 134 articles en base)
 * n'avait que 3 articles reconnus, et un lien `?article=1382` du chat n'y
 * trouvait rien ; la loi 90/053 en avait 3 sur 29. Mesuré le 28/10 sur les
 * textes de la base locale : 2 041 articles pour le Code civil, 26 pour la
 * loi 90/053, et aucun changement pour le Code pénal, le Code du travail,
 * l'Acte uniforme OHADA ni le décret 2021/745.
 *
 * Un tiret entre le mot et le numéro (« Article - 78.- », « Article-128.- »)
 * est une lecture de l'OCR : trois lignes dans la base, dont l'article 78 du
 * Code du travail, resté hors de tout article (vérification r1 du 29/10).
 *
 * `chat-rendu.spec.ts` choisit sa loi avec `decouperLeTexte` lui-même : la
 * règle n'a pas de copie à tenir à jour.
 */
const LIGNE_D_ARTICLE =
  /^(?:[-–•]\s*)?\**\s*(?:Article\.?\s*(?:[-–—]\s*)?(\d+)|Art\.?\s*(\d+)\s*(?:er|ère|°)?\s*\**\s*[.:\-–—])/i;

/**
 * « Article premier », en toutes lettres : 37 textes de la base l'écrivent
 * ainsi (la Constitution, le régime foncier, la loi sur les pensions, des Actes
 * uniformes OHADA…), seul sur sa ligne, suivi d'une ponctuation
 * (« ARTICLE PREMIER.- », « Article premier: ») ou d'un intitulé
 * (« Article premier Champ d'application »). Sans cette forme, leur article 1
 * manquait au sommaire et à la lecture article par article : celui de la
 * Constitution n'était lisible qu'en texte entier, hors de tout article
 * (vérification r1 du 29/10/2026).
 *
 * Ce qui suit « premier » est lu À PART et en respectant la casse : rien, une
 * ponctuation ou une capitale. « Article premier de la loi n° … est
 * modifié », une phrase, continue en minuscule et n'ouvre rien.
 */
const ARTICLE_PREMIER = /^(?:[-–•]\s*)?\**\s*Article\s+premi(?:er|ère)\b\s*\**/i;
const SUITE_D_ARTICLE_PREMIER = /^\s*(?:$|[.:\-–—]|[A-ZÀ-ÖØ-Þ«"(])/;

/** Le numéro d'une ligne qui ouvre un article (« 1 » pour « Article premier »), ou `null`. */
function numeroDeLaLigne(ligne: string): string | null {
  const m = LIGNE_D_ARTICLE.exec(ligne);
  if (m) return m[1] ?? m[2];
  const premier = ARTICLE_PREMIER.exec(ligne);
  return premier && SUITE_D_ARTICLE_PREMIER.test(ligne.slice(premier[0].length)) ? '1' : null;
}

/**
 * Le numéro, son ordinal et la ponctuation qui le suit, emphase comprise des
 * deux côtés (« **ARTICLE 1er.**- Le… »). L'OCR lit aussi « 1er » en « 1ºr »
 * ou « 1° » : non retirés, ces débris ouvraient le texte de l'article
 * (« ºr.- Le présent décret… »). « Article premier » se retire de même.
 */
const DEBUT_D_ARTICLE =
  /^(?:[-–•]\s*)?\**\s*Art(?:icle)?\.?\s*(?:[-–—]\s*)?(?:\d+\s*(?:er|ère|ème|[º°]\s*r?)?|premi(?:er|ère)\b)\s*[:.\-–—]*\s*\**\s*[:.\-–—]*\s*/i;

/**
 * Une ligne de division : le mot, son numéro (collé ou non, l'OCR écrit
 * « CHAPITREI » et « TITREU »), un ordinal, puis le reste de la ligne.
 *
 * L'ancienne règle, `^(LIVRE|TITRE|CHAPITRE)\s+[IVX0-9]+`, voulait une espace
 * et un chiffre : « CHAPITREI », « TITRE PREMIER », « Section 1 – … » ne
 * comptaient pas. Les articles de ces divisions passaient sous la précédente,
 * et le sommaire du décret 2021/745 commençait par un « Préambule » de six
 * articles qui étaient le chapitre I.
 */
// L'ordre des numéros compte : la première forme qui convient l'emporte, le
// reste de la ligne prenant tout. « \d+ » avant les romains douteux, sinon
// « CHAPITRE 12 » se lirait « 1 » suivi de « 2 » ; « première » avant
// « premier », qui en est le début.
//
// Pas « SECT. I » (Code civil) : reconnue, la section fermait l'article
// d'avant, et la ligne suivante, souvent l'article d'après illisible à l'OCR
// (« Ar uo r u ur… »), passait hors de tout article, 98 lignes de plus
// (mesuré le 29/10/2026). Elle reste une ligne de l'article qui la précède.
const DEBUT_DE_DIVISION =
  /^[#*\s]*(livre|titre|chapitre|chap\.|sous-section|section|paragraphe)\s*(première|premiere|premier|préliminaire|preliminaire|unique|\d+|[ivxlu1]+)(\s*(?:er|ère|ème))?(.*)$/i;

/**
 * Ce qui peut suivre le numéro d'une division : rien, un séparateur, ou un
 * intitulé qui commence par une capitale. Une phrase (« Section 2 du présent
 * chapitre… ») continue en minuscule : ce n'est pas un en-tête.
 */
const SUITE_DE_DIVISION = /^(?:\s*$|\s*[-–—:.)]|\s*\*|\s+[A-ZÀ-ÖØ-Þ«"'’(])/;

/** Lettres qu'un OCR confond avec des chiffres romains. */
const ROMAIN_DOUTEUX = /^[IVXLU1l]+$/;

/**
 * « I1 » → « II », « IU » → « IV », « U » → « V » : seulement pour un numéro
 * fait de lettres romaines et de ces confusions, qui n'est pas un nombre
 * arabe (« 11 » reste 11).
 */
function reparerRomain(numeral: string): string {
  const haut = numeral.toUpperCase();
  if (!ROMAIN_DOUTEUX.test(numeral) || /^\d+$/.test(numeral)) return haut;
  if (!/[U1l]/.test(numeral)) return haut;
  return numeral.replace(/1|l/g, 'I').replace(/u/gi, 'V').toUpperCase();
}

/** Retire l'emphase markdown d'une ligne affichée (`**…**`, `# …`). */
function sansEmphase(ligne: string): string {
  return ligne.replace(/^[#*\s]+/, '').replace(/\*+/g, '').trim();
}

/**
 * Une ligne de division, ou `null`. Publique pour les tests : c'est la règle
 * qui a le plus d'effet sur le sommaire.
 */
export function lireEnTete(ligne: string): EnTeteDeDivision | null {
  const m = DEBUT_DE_DIVISION.exec(ligne);
  if (!m) return null;
  const reste = m[4] ?? '';
  if (!SUITE_DE_DIVISION.test(reste)) return null;
  const mot = m[1].toLowerCase();
  return {
    ligne: sansEmphase(ligne),
    // « CHAP. I » (Code civil) est un chapitre.
    mot: (mot === 'chap.' ? 'chapitre' : mot) as MotDeDivision,
    numeral: reparerRomain(m[2]),
    // Le séparateur (« .- », « : », « – ») n'est pas l'intitulé.
    intitule: sansEmphase(reste).replace(/^[-–—:.)\s]+/, '').trim(),
    lignes: [],
  };
}

/**
 * Un article collé par l'OCR à la fin d'une ligne de division
 * (« CHAPITREI DE LA CREATION Art. 6: sous réserve… », loi 90/053) : la
 * ligne est coupée avant lui. Seulement sur une ligne de division, et sur
 * une forme qui ouvre bien un article (« Art. 6: », « ARTICLE 7.- »), avec une
 * capitale : un renvoi (« à l'art. 4 ci-dessus ») ne coupe rien.
 */
const ARTICLE_COLLE = /^(.*?\S)\s+((?:Art|ART|Article|ARTICLE)\.?\s*\d+\s*(?:er|ère|°)?\s*[.:\-–—].*)$/;

/** La ligne, ou ses deux morceaux quand un article est collé à une ligne de division. */
function scinderLigne(ligne: string): string[] {
  if (!lireEnTete(ligne)) return [ligne];
  const m = ARTICLE_COLLE.exec(ligne);
  return m && lireEnTete(m[1]) ? [m[1], m[2]] : [ligne];
}

/**
 * Un article qui commence au milieu d'une ligne : l'OCR colle souvent un
 * article à la fin du précédent (« …qu'elle jugerait bon de demander.
 * Article 36.- (1) Toute rupture… »). Dans le Code du travail, 82 des 144
 * articles s'écrivent ainsi : les articles 35 à 40 du licenciement n'en
 * faisaient qu'un, et un lien `?article=36` du chat ou de la recherche ne
 * trouvait rien (vérification r3 du 29/10/2026). Mêmes pertes dans les lois
 * sur les communications électroniques et la cybersécurité, le régime
 * domanial, les prestations familiales.
 *
 * « Article » ou « ARTICLE » avec sa capitale et un séparateur (« .- », « : ») :
 * un renvoi s'écrit « l'article 3 de la présente loi ». Rien après un « « » ou
 * un guillemet : une loi qui modifie cite le nouvel article
 * (« … ainsi qu'il suit : « Article 5.- … »), qui n'ouvre rien. Ni après un
 * chiffre (« du 19 Article 3: Novembre 2012 », une date que l'OCR a
 * mêlée), ni devant un numéro composé (« Article 335-3 », « Article 36.1 »),
 * ni dans un tableau (une ligne qui commence par « | »). Pas de
 * recherche en arrière (`(?<=…)`) : Safari ne la lit qu'à partir de 16.4, et
 * l'expression ferait échouer tout le module.
 */
const ARTICLE_EN_COURS_DE_LIGNE =
  /([^\s\d«"“])\s+(?=\**\s*(?:Article|ARTICLE)\s*(?:[-–—]\s*)?(\d+)\s*(?:er|ère|ème|°)?\s*\**\s*[.:\-–—](?!\d))/g;

/** Écart admis avec le numéro précédent : un en-tête illisible à l'OCR en fait sauter un ou deux. */
const ECART_MAX_DES_NUMEROS = 3;

/**
 * La ligne, coupée avant chaque article qui y commence en cours de route, et
 * le numéro du dernier article ouvert. Seulement dans la suite des numéros
 * (`precedent` + 1 à + 3, ou un article 1 en tête du texte) : « Article 36.- »
 * après l'article 35 ouvre bien un article, une citation qui revient en
 * arrière ou saute loin reste du texte.
 */
function couperAuxArticles(ligne: string, precedent: number | null): { morceaux: string[]; dernier: number | null } {
  const enTete = numeroDeLaLigne(ligne);
  let dernier = enTete === null ? precedent : Number(enTete);
  if (ligne.startsWith('|')) return { morceaux: [ligne], dernier };
  const morceaux: string[] = [];
  let debut = 0;
  for (const m of ligne.matchAll(ARTICLE_EN_COURS_DE_LIGNE)) {
    const numero = Number(m[2]);
    const dansLaSuite =
      dernier === null ? numero === 1 : numero > dernier && numero - dernier <= ECART_MAX_DES_NUMEROS;
    if (!dansLaSuite) continue;
    const coupure = (m.index ?? 0) + m[1].length;
    morceaux.push(ligne.slice(debut, coupure).trim());
    debut = coupure;
    dernier = numero;
  }
  morceaux.push(ligne.slice(debut).trim());
  return { morceaux, dernier };
}

/**
 * Une ligne qui peut servir d'intitulé à un en-tête qui n'en a pas : courte,
 * sans ponctuation de phrase en fin, et pas une ligne de visa.
 */
function ressembleAUnIntitule(ligne: string): boolean {
  if (ligne.length > 200 || /[;,]$/.test(ligne)) return false;
  if (/^(vu|considérant|considerant|sur proposition)\b/i.test(ligne)) return false;
  return /\p{Lu}/u.test(ligne.charAt(0)) || /^["«(]/.test(ligne);
}

/* -------------------------------------------------------------------------- */
/* En-têtes déplacés par l'OCR                                                 */
/* -------------------------------------------------------------------------- */

/** Une ligne du texte, lue une fois : sa page, et ce qu'elle ouvre. */
interface LigneLue {
  texte: string;
  /** Rang de la page de l'OCR (`<<PAGE:N>>`), à partir de 0. */
  page: number;
  entete: EnTeteDeDivision | null;
  /** Le numéro de l'article qu'ouvre la ligne, ou `null`. */
  numero: string | null;
}

/**
 * Les lignes non vides du texte, page par page, marqueurs retirés, et coupées
 * avant un article collé à la ligne précédente (`couperAuxArticles`).
 */
function lireLesLignes(contenu: string): LigneLue[] {
  const lignes: LigneLue[] = [];
  let dernier: number | null = null;
  contenu
    .replace(/\r\n?/g, '\n')
    .split(MARQUEUR_DE_PAGE)
    .forEach((texteDeLaPage, page) => {
      for (const brute of texteDeLaPage.split('\n')) {
        for (const morceau of scinderLigne(brute.trim())) {
          // Une ligne de division garde sa forme : son article collé est déjà
          // à part (`scinderLigne`).
          const coupe = lireEnTete(morceau) ? { morceaux: [morceau], dernier } : couperAuxArticles(morceau, dernier);
          dernier = coupe.dernier;
          for (const texte of coupe.morceaux) {
            if (!texte) continue;
            const entete = lireEnTete(texte);
            lignes.push({ texte, page, entete, numero: entete ? null : numeroDeLaLigne(texte) });
          }
        }
      }
    });
  return lignes;
}

/**
 * Les lignes que l'OCR répète en tête de page : l'en-tête courant d'un Acte
 * uniforme (« ACTE UNIFORME RELATIF AU DROIT DE L'ARBITRAGE », « Adopté le
 * 23/11/2017 à Conakry », « Publié au Journal Officiel… »), le nom du code.
 * Une même ligne parmi les trois premières de trois pages au moins, sans
 * ponctuation de phrase en fin : « Le reste sans changement. », qui ouvre
 * souvent une page de loi de finances, est du texte d'article.
 */
function lignesCourantes(lignes: LigneLue[]): Set<string> {
  const premieres = new Map<number, Set<string>>();
  const vues = new Map<number, number>();
  for (const ligne of lignes) {
    const rang = vues.get(ligne.page) ?? 0;
    vues.set(ligne.page, rang + 1);
    if (rang >= 3 || ligne.entete || ligne.numero !== null || /[.;:,]$/.test(ligne.texte)) continue;
    const page = premieres.get(ligne.page) ?? new Set<string>();
    page.add(ligne.texte);
    premieres.set(ligne.page, page);
  }
  const compte = new Map<string, number>();
  for (const page of premieres.values()) for (const texte of page) compte.set(texte, (compte.get(texte) ?? 0) + 1);
  return new Set([...compte].filter(([texte, n]) => n >= 3 && texte.length >= 6).map(([texte]) => texte));
}

/** Numéro d'alinéa en tête de ligne : « (7) », « 7) », « - (8) », « a) », « - b) ». */
const MARQUE_D_ALINEA = /^(?:[-–•]\s*)*(?:\((\d{1,3})\)|(\d{1,3})\)|\(?([a-z])\))/;

function marqueDAlinea(texte: string): { genre: 'nombre' | 'lettre'; valeur: number } | null {
  const m = MARQUE_D_ALINEA.exec(texte);
  if (!m) return null;
  if (m[3]) return { genre: 'lettre', valeur: m[3].charCodeAt(0) - 96 };
  return { genre: 'nombre', valeur: Number(m[1] ?? m[2]) };
}

/** L'article en cours de lecture : sa ligne « Article N » et les lignes qui la suivent. */
interface ArticleOuvert {
  ligne: LigneLue;
  corps: LigneLue[];
}

/** Ce qui suit « Article N » sur sa ligne (`ArticleDuTexte.titre`). */
function titreDeLaLigne(ligne: LigneLue): string {
  return ligne.texte.replace(DEBUT_D_ARTICLE, '').trim();
}

/**
 * La page suivante continue-t-elle l'article qu'un en-tête de bas de page
 * vient d'interrompre ? Trois preuves, dans le texte courant (`reprise`,
 * sans le bruit de la page) :
 * - l'alinéa suivant : « - (7) » puis « - (8) », « a) » puis « b) » ;
 * - une liste annoncée par « : », dont la page suivante donne les éléments ;
 * - une phrase coupée (sans ponctuation finale) qui reprend en minuscule.
 * Un vrai titre en fin de page est suivi d'un article qui commence : son
 * premier alinéa, s'il est numéroté, repart à « (1) », ou à « (2) » quand la
 * ligne « Article N » a été perdue (décret 1997, p. 13).
 */
function continueLArticle(texte: string[], reprise: string[]): boolean {
  if (!texte.length || !reprise.length) return false;
  const derniere = texte[texte.length - 1];
  const premiere = reprise[0];
  if (/:\s*$/.test(derniere) && /^(?:[-–•]|\p{Ll}|\(?[a-z0-9]{1,3}\))/u.test(premiere)) return true;
  if (!/[.!?;:…»")\]]\s*$/.test(derniere) && /^\p{Ll}/u.test(premiere)) return true;
  // Pas de `.at(-1)` : Safari 15.0 à 15.3 ne l'a pas, et Vite ne le remplace pas.
  const marques = texte.map(marqueDAlinea).filter((m) => m !== null);
  const avant = marques[marques.length - 1];
  const apres = reprise.slice(0, 4).map(marqueDAlinea).find((m) => m !== null);
  return Boolean(avant && apres && avant.genre === apres.genre && apres.valeur === avant.valeur + 1);
}

/**
 * L'intitulé d'un article (« Exclusion de la loi étrangère »), ou rien après
 * le numéro : son texte n'a pas commencé. Un intitulé est court, sans
 * ponctuation finale ni chiffre ; « Article 3.- Le présent décret abroge… »
 * et « Art. 773. - Abrogé par L. 25 mars 1896 » (Code civil) sont du texte.
 */
function titreSansTexte(ligne: LigneLue): boolean {
  const titre = titreDeLaLigne(ligne);
  return !titre || (titre.length <= 80 && !/[.:;,]$/.test(titre) && !/\d/.test(titre) && !/^\(?abrog/i.test(titre));
}

/**
 * Fin (exclue) du bloc d'en-têtes qui commence en `debut` : les en-têtes qui
 * se suivent, chacun avec la ligne suivante quand elle lui sert d'intitulé
 * (même règle que `decouperLeTexte`).
 */
function finDuBloc(lignes: LigneLue[], debut: number): number {
  let fin = debut;
  while (fin < lignes.length && lignes[fin].entete) {
    const nu = !lignes[fin].entete?.intitule;
    fin++;
    const suivante = lignes[fin];
    if (nu && suivante && !suivante.entete && suivante.numero === null && ressembleAUnIntitule(suivante.texte)) fin++;
  }
  return fin;
}

/**
 * Un bloc d'en-têtes peut-il remonter jusqu'au premier article de sa page,
 * par-dessus les en-têtes lus entre les deux (`sautes`) ? Non par-dessus un
 * rang plus large (une section ne remonte pas au-dessus du chapitre qui
 * l'ouvre, loi 90/052 p. 9), ni par-dessus un numéro de même rang plus petit
 * (« CHAPITRE V » ne remonte pas avant les chapitres III et IV, p. 5). La
 * Constitution, elle, remonte « TITRE UIL » au-dessus des titres IX et X.
 */
function remontee(bloc: LigneLue[], sautes: LigneLue[]): boolean {
  const entetes = bloc.map((l) => l.entete).filter((e) => e !== null);
  const haut = entetes.reduce((a, b) => (NIVEAU[b.mot] < NIVEAU[a.mot] ? b : a));
  const valeur = valeurDuNumero(haut.numeral);
  return sautes.every(({ entete }) => {
    if (!entete || NIVEAU[entete.mot] > NIVEAU[haut.mot]) return true;
    if (NIVEAU[entete.mot] < NIVEAU[haut.mot]) return false;
    const autre = valeurDuNumero(entete.numeral);
    return valeur === null || autre === null || valeur < autre;
  });
}

/**
 * Les lignes dans l'ordre du texte, en-têtes déplacés par l'OCR remis à leur
 * place. Deux déplacements, relevés sur la base le 29/10/2026 :
 *
 * 1. EN BAS DE PAGE (Constitution, /laws/2143). L'OCR lit en dernier
 *    l'en-tête imprimé en haut de la page : « TITRE PREMIER… » arrive après
 *    l'alinéa (7) de l'article premier, « TITRE II / CHAPITRE 1 » après le
 *    a) de l'article 6, et la page suivante reprend l'article (« Les
 *    armoiries… », « - b) le Président… »). Le déplacement n'est retenu que
 *    si la suite le prouve (`continueLArticle`) : la suite rejoint
 *    l'article, et l'en-tête revient avant le premier article de sa page, là
 *    où il était imprimé (`remontee`), sinon juste après la suite.
 *    Un texte où l'OCR l'a fait une fois l'a fait sur ses autres pages : ses
 *    autres en-têtes de bas de page, suivis d'un article ou de bruit,
 *    remontent de même (« CHAPITRE 11 : DU GOUVERNEMENT », « TITRE V DU
 *    POUVOIR JUDICIAIRE »). Ailleurs, un en-tête en bas de page reste où il
 *    est : c'est le plus souvent un vrai titre en fin de page.
 *
 * 2. ENTRE L'INTITULÉ D'UN ARTICLE ET SON TEXTE (Code pénal, /laws/2236) :
 *    « ARTICLE 13.- Exclusion de la loi étrangère », le tampon de la
 *    Présidence, « CHAPITRE IV » et son intitulé, puis « Sous réserve des
 *    articles 9 et 10… ». L'en-tête passe avant l'article, et le texte le
 *    rejoint.
 *
 * Le bruit de la page (lignes sans minuscule : tampon de la Présidence,
 * « …/. », numéro de page ; en-têtes courants) suit l'en-tête déplacé, hors
 * de l'article. Aucune ligne n'est retirée ni ajoutée : seul l'ordre change.
 */
function remettreLesEnTetesEnPlace(lignes: LigneLue[]): LigneLue[] {
  const courantes = lignesCourantes(lignes);
  const bruit = (ligne: LigneLue) => !/\p{Ll}/u.test(ligne.texte) || courantes.has(ligne.texte);
  const sortie: LigneLue[] = [];
  // Le premier article de chaque page, s'il n'y est précédé d'aucun en-tête :
  // la place d'un en-tête imprimé en haut de cette page.
  const cibleDeLaPage = new Map<number, LigneLue | null>();
  const noter = (ligne: LigneLue) => {
    if (cibleDeLaPage.has(ligne.page)) return;
    if (ligne.numero !== null) cibleDeLaPage.set(ligne.page, ligne);
    else if (ligne.entete) cibleDeLaPage.set(ligne.page, null);
  };
  /** Le premier article de la page, si le bloc peut y remonter. */
  const cibleDuBloc = (bloc: LigneLue[], page: number): LigneLue | null => {
    const cible = cibleDeLaPage.get(page);
    return cible && remontee(bloc, sortie.slice(sortie.indexOf(cible))) ? cible : null;
  };
  let ouvert: ArticleOuvert | null = null;
  let deplacant = false;
  // En-têtes de bas de page qui ne prouvent rien seuls, remontés si le texte
  // en a déplacé au moins un autre.
  const candidats: { bloc: LigneLue[]; cible: LigneLue }[] = [];

  let i = 0;
  while (i < lignes.length) {
    const ligne = lignes[i];
    if (!ligne.entete) {
      noter(ligne);
      sortie.push(ligne);
      if (ligne.numero !== null) ouvert = { ligne, corps: [] };
      else ouvert?.corps.push(ligne);
      i++;
      continue;
    }

    const fin = finDuBloc(lignes, i);
    let finDeLaSuite = fin;
    while (finDeLaSuite < lignes.length && !lignes[finDeLaSuite].entete && lignes[finDeLaSuite].numero === null) {
      finDeLaSuite++;
    }
    const bloc = lignes.slice(i, fin);
    const suite = lignes.slice(fin, finDeLaSuite);
    const texteDeLaSuite = suite.filter((l) => !bruit(l));
    const bruitDeLaSuite = suite.filter(bruit);
    const page = lignes[fin - 1].page;
    const finDePage = fin >= lignes.length || lignes[fin].page > page;
    i = finDeLaSuite;

    if (ouvert && titreSansTexte(ouvert.ligne) && ouvert.corps.every(bruit) && texteDeLaSuite.length) {
      // 2. L'en-tête passe avant l'article ; le bruit lu entre les deux le suit.
      const position = sortie.indexOf(ouvert.ligne);
      sortie.splice(position, sortie.length - position, ...bloc, ...ouvert.corps, ...bruitDeLaSuite, ouvert.ligne);
      sortie.push(...texteDeLaSuite);
      // Précédé désormais d'un en-tête, l'article n'est plus le haut de sa page.
      if (cibleDeLaPage.get(ouvert.ligne.page) === ouvert.ligne) cibleDeLaPage.set(ouvert.ligne.page, null);
      ouvert = { ligne: ouvert.ligne, corps: [...texteDeLaSuite] };
      continue;
    }

    const texteDeLArticle = ouvert
      ? [titreDeLaLigne(ouvert.ligne), ...ouvert.corps.filter((l) => !bruit(l)).map((l) => l.texte)].filter(Boolean)
      : [];
    if (ouvert && finDePage && continueLArticle(texteDeLArticle, texteDeLaSuite.map((l) => l.texte))) {
      // 1. En bas de page, preuve à l'appui.
      deplacant = true;
      const cible = cibleDuBloc(bloc, page);
      if (cible) sortie.splice(sortie.indexOf(cible), 0, ...bloc, ...bruitDeLaSuite);
      sortie.push(...texteDeLaSuite);
      ouvert.corps.push(...texteDeLaSuite);
      if (!cible) {
        sortie.push(...bloc, ...bruitDeLaSuite);
        ouvert = null;
      }
      continue;
    }

    const cible = finDePage && !texteDeLaSuite.length ? cibleDuBloc(bloc, page) : null;
    if (cible) candidats.push({ bloc: [...bloc, ...suite], cible });
    for (const l of bloc) noter(l);
    sortie.push(...bloc, ...suite);
    ouvert = null;
  }

  if (deplacant) {
    for (const { bloc, cible } of candidats) {
      sortie.splice(sortie.indexOf(bloc[0]), bloc.length);
      sortie.splice(sortie.indexOf(cible), 0, ...bloc);
    }
  }
  return sortie;
}

/* -------------------------------------------------------------------------- */
/* Numéros des divisions                                                       */
/* -------------------------------------------------------------------------- */

const VALEURS_ROMAINES: Readonly<Record<string, number>> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
const CHIFFRES_ROMAINS: [number, string][] = [
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

function enRomain(valeur: number): string {
  let reste = valeur;
  let romain = '';
  for (const [n, lettres] of CHIFFRES_ROMAINS) {
    while (reste >= n) {
      romain += lettres;
      reste -= n;
    }
  }
  return romain;
}

/**
 * La valeur d'un numéro de division : « PREMIER » 1, « 12 » 12, « XIV » 14 ;
 * `null` pour un numéro illisible (« VIL », écriture que les chiffres romains
 * n'admettent pas) ou hors de toute suite (« PRÉLIMINAIRE », « UNIQUE »).
 */
function valeurDuNumero(numeral: string): number | null {
  const plie = plier(numeral);
  if (plie === 'premier' || plie === 'premiere') return 1;
  if (/^\d+$/.test(numeral)) return Number(numeral);
  const romain = numeral.toUpperCase();
  if (!/^[IVXLC]+$/.test(romain)) return null;
  let total = 0;
  for (let i = 0; i < romain.length; i++) {
    const valeur = VALEURS_ROMAINES[romain[i]];
    total += valeur < (VALEURS_ROMAINES[romain[i + 1]] ?? 0) ? -valeur : valeur;
  }
  return enRomain(total) === romain ? total : null;
}

/** Le numéro `valeur`, écrit comme son voisin : en chiffres s'il l'est, sinon en romain. */
function ecrireComme(valeur: number, voisin: string): string {
  return /^\d+$/.test(voisin) ? String(valeur) : enRomain(valeur);
}

/**
 * Répare les numéros que l'OCR a mal lus, par leurs voisins de même rang
 * (les chapitres d'un même titre, les titres d'un même livre), dans l'ordre
 * du texte. Deux cas seulement, sûrs :
 * - « 11 » juste après « 1 » : le II romain lu en chiffres (« CHAPITRE 11 :
 *   DU GOUVERNEMENT », Constitution). Il s'écrit comme son voisin : 2 ;
 * - un numéro illisible, ou déjà pris par un voisin plus haut, encadré par
 *   deux voisins qui se suivent à deux près : « VII », « UIL », « IX » donne
 *   VIII ; « X », « IX », « XII » donne XI (deux « Titre IX » dans le
 *   sommaire de la Constitution) ; « II », « II », « IV » donne III. Un
 *   numéro lisible et neuf reste tel quel, même hors de la suite : une loi de
 *   finances cite des titres du Code général des impôts dans le désordre.
 * L'intitulé et la ligne d'origine (`ligne`) restent tels quels.
 */
function reparerLesNumeros(entetes: EnTeteDeDivision[]): void {
  const fratries: EnTeteDeDivision[][] = [];
  const ouvertes = new Map<MotDeDivision, EnTeteDeDivision[]>();
  for (const entete of entetes) {
    // Un « TITRE » clôt les chapitres du titre d'avant : leur suite repart.
    for (const mot of [...ouvertes.keys()]) if (NIVEAU[mot] > NIVEAU[entete.mot]) ouvertes.delete(mot);
    let fratrie = ouvertes.get(entete.mot);
    if (!fratrie) {
      fratrie = [];
      ouvertes.set(entete.mot, fratrie);
      fratries.push(fratrie);
    }
    fratrie.push(entete);
  }
  for (const fratrie of fratries) {
    for (let i = 1; i < fratrie.length; i++) {
      const { numeral } = fratrie[i];
      if (/^1{2,4}$/.test(numeral) && valeurDuNumero(fratrie[i - 1].numeral) === numeral.length - 1) {
        fratrie[i].numeral = ecrireComme(numeral.length, fratrie[i - 1].numeral);
      }
    }
    const pris = new Set<number>();
    fratrie.forEach((entete, i) => {
      const ici = valeurDuNumero(entete.numeral);
      const avant = i > 0 ? valeurDuNumero(fratrie[i - 1].numeral) : null;
      const apres = i < fratrie.length - 1 ? valeurDuNumero(fratrie[i + 1].numeral) : null;
      if ((ici === null || pris.has(ici)) && avant !== null && apres === avant + 2) {
        entete.numeral = ecrireComme(avant + 1, fratrie[i + 1].numeral);
      }
      const valeur = valeurDuNumero(entete.numeral);
      if (valeur !== null) pris.add(valeur);
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Découpage                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Le texte découpé. Une ligne « Article N » ouvre un article ; une ligne de
 * division le ferme et ouvre une division ; toute autre ligne non vide est un
 * paragraphe de l'article en cours (ou, avant le premier article d'une
 * division, son intitulé ou ses lignes d'ouverture). Les en-têtes que l'OCR a
 * déplacés sont d'abord remis à leur place (`remettreLesEnTetesEnPlace`).
 *
 * Les divisions sans article qui précèdent une autre division (« TITRE II »
 * puis « CHAPITRE 1 ») ne sont pas perdues : leurs en-têtes passent dans la
 * chaîne de la division suivante. Une division sans aucun article jusqu'à la
 * fin du texte (annexe, signature mal lue) est gardée pour le texte entier,
 * mais n'a pas d'entrée au sommaire.
 */
export function decouperLeTexte(contenu: string | null | undefined): TexteDecoupe {
  const divisions: DivisionDuTexte[] = [];
  const articles: ArticleDuTexte[] = [];
  if (!contenu) return { divisions, articles, structure: false };

  let division: DivisionDuTexte = { rang: 0, entetes: [], ancetres: [], introduction: [], articles: [] };
  divisions.push(division);
  let article: ArticleDuTexte | null = null;
  const occurrences = new Map<string, number>();
  // Les divisions ouvertes, de la plus large à la plus fine : un « TITRE »
  // ferme les chapitres et sections du titre précédent.
  const pile: EnTeteDeDivision[] = [];

  for (const { texte: ligne, entete, numero: lu } of remettreLesEnTetesEnPlace(lireLesLignes(contenu))) {
    if (entete) {
      article = null;
      if (division.articles.length > 0 || (division.entetes.length === 0 && division.introduction.length > 0)) {
        // La division en cours a ses articles (ou c'est l'ouverture, avec ses
        // visas) : une nouvelle commence.
        division = { rang: divisions.length, entetes: [], ancetres: [], introduction: [], articles: [] };
        divisions.push(division);
      }
      // Sinon, l'en-tête rejoint la chaîne de la division en cours, encore
      // sans article (« TITRE II » suivi de « CHAPITRE 1 »).
      division.entetes.push(entete);
      while (pile.length && NIVEAU[pile[pile.length - 1].mot] >= NIVEAU[entete.mot]) pile.pop();
      pile.push(entete);
      division.ancetres = [...pile];
      continue;
    }

    if (lu !== null) {
      // Borne : le numéro finit dans `?article=` et `#art-N`.
      const numero = lu.slice(0, LONGUEUR_MAX_NUMERO);
      const cle = normaliserNumeroArticle(numero);
      const occurrence = occurrences.get(cle) ?? 0;
      occurrences.set(cle, occurrence + 1);
      article = {
        rang: articles.length,
        numero,
        cle,
        titre: ligne.replace(DEBUT_D_ARTICLE, '').trim(),
        lignes: [],
        division: division.rang,
        occurrence,
      };
      division.articles.push(article);
      articles.push(article);
      continue;
    }

    if (article) {
      article.lignes.push(ligne);
      continue;
    }

    // Avant le premier article de la division : l'intitulé de son dernier
    // en-tête s'il n'en a pas (« CHAPITRE V » puis « DE LA DELIVRANCE… »),
    // sinon une ligne d'ouverture (visas, préambule) ou de l'en-tête.
    const dernier = division.entetes[division.entetes.length - 1];
    if (dernier && !dernier.intitule && dernier.lignes.length === 0 && ressembleAUnIntitule(ligne)) {
      dernier.intitule = sansEmphase(ligne);
    } else if (dernier) {
      dernier.lignes.push(ligne);
    } else {
      division.introduction.push(ligne);
    }
  }

  // Une ouverture vide (le texte commence par un en-tête) ne sert à rien.
  const gardees = divisions.filter(
    (d) => d.articles.length > 0 || d.entetes.length > 0 || d.introduction.length > 0,
  );
  gardees.forEach((d, rang) => {
    d.rang = rang;
    for (const a of d.articles) a.division = rang;
  });
  reparerLesNumeros(gardees.flatMap((d) => d.entetes));
  return { divisions: gardees, articles, structure: gardees.some((d) => d.entetes.length > 0) };
}

/* -------------------------------------------------------------------------- */
/* Lecture d'un article                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Ce qui précède parfois le vrai début du titre : la marque d'un article
 * réécrit (« Article 5 (nouveau) (1) Le Président… », loi 2026/002) ou un
 * suffixe que le découpage ne lit pas (« Article 93 septies.- Régimes… »).
 * Ni intitulé ni phrase, elle ne décide de rien.
 */
const MARQUE_AVANT_LE_TITRE =
  /^(?:\(nouveau\)|(?:bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies)(?![a-zà-ÿ]))[\s.*:–—-]*/i;

/** Un numéro d'alinéa en tête : « (1) », « 1) », « - (2) », « 1°) », « 1º ». */
const ALINEA_EN_TETE = /^[-–•_]?\s*\(?-?\d{1,3}\s*(?:\)|[°º])/;

/**
 * Une fin de phrase, et les débris que l'OCR laisse après elle (« … en
 * anglais./- », « … en vigueur. ■ »). Pas « » » : « Confiscation du « corpus
 * delicti » » est un intitulé du Code pénal.
 */
const FIN_DE_PHRASE = /[.!?…]\s*[-–/_■]*\s*$/;

/**
 * Les mots qui ouvrent une phrase de loi, et jamais un intitulé : article,
 * pronom, quantité, conjonction (« Le dépôt est volontaire… », « Tout
 * Français jouira… », « A défaut de… »). Pas « Des », « Du », « De » : « Des
 * contrats » est un intitulé. « A » suivi d'un tiret est une lettre
 * d'énumération (« A - Droits dégressifs »).
 */
const DEBUT_DE_PHRASE =
  /^(?:(?:le|la|les|un|une|il|ils|elle|elles|on|tout|toute|tous|toutes|aucun|aucune|nul|nulle|chaque|ce|cet|cette|ces|celui|celle|ceux|celles|quiconque|lorsque|quand|si|sauf|dans|en|pour|par|au|aux|sous|sur|toutefois|néanmoins|cependant|nonobstant)(?=[\s,]|$)|[aà]\s+(?=\p{L})|(?:l|n|qu|s|lorsqu|jusqu)['’]|abrog)/iu;

/** « LeConseil », « LaSRC » : l'article collé par l'OCR au nom qui le suit. */
const DETERMINANT_COLLE = /^(?:Les|Le|La)(?=\p{Lu})/u;

/** Un verbe conjugué en tête, sujet inversé : « Sont abrogées… », « Est puni… ». */
const VERBE_EN_TETE = /^(?:est|sont|sera|seront|peut|peuvent|doit|doivent)(?=[\s,]|$)/i;

/**
 * Un auxiliaire ou un verbe modal : la phrase que l'OCR a coupée avant son
 * point (« Le présent décret sera enregistré, publié suivant la procédure
 * d'urgence, -ui l il »). Une liste fermée de mots : « Le régime de
 * probation », intitulé du Code pénal, n'en contient aucun.
 */
const AUXILIAIRE = /(?:^|[\s,'’])(?:est|sont|sera|seront|a|ont|peut|peuvent|doit|doivent)(?=[\s,.;:]|$)/i;

/**
 * Une phrase, et non un intitulé : un verbe en tête, ou un premier mot de
 * phrase suivi d'une fin de phrase ou d'un auxiliaire. Une ligne sans
 * minuscule (« ENFANTS LÉGITIMES ») reste un intitulé.
 */
function ressembleAUnePhrase(titre: string): boolean {
  if (!/\p{Ll}/u.test(titre)) return false;
  if (VERBE_EN_TETE.test(titre)) return true;
  if (!DEBUT_DE_PHRASE.test(titre) && !DETERMINANT_COLLE.test(titre)) return false;
  // Après le premier mot : « A - Droits dégressifs » n'a pas de verbe.
  return FIN_DE_PHRASE.test(titre) || AUXILIAIRE.test(titre.replace(/^\S+/, ''));
}

/**
 * Le « titre » d'un article est-il en réalité son texte ?
 *
 * `decouperLeTexte` prend pour titre ce qui suit « Article N » sur la même
 * ligne. Dans les décrets, c'est presque toujours la première phrase de
 * l'article, souvent tout l'article (« Article 1er.- Le présent décret
 * fixe… »). Rendue en intertitre, elle se lisait comme un sous-titre, et
 * aucun paragraphe ne suivait. Un vrai intitulé (« Imputabilité ») est court
 * et suivi du texte ; ici, l'article n'a pas d'autre texte, ou la ligne est
 * longue, ou elle annonce une liste (« … on entend par : »).
 *
 * Une ligne courte peut aussi porter le texte : un alinéa numéroté (« (1)
 * Sont abrogées toutes les dispositions antérieures contraires. ») ou une
 * phrase (« Le présent décret sera enregistré, puis publié au Journal
 * Officiel… »). En intertitre, elle manquait au texte copié et à l'extrait
 * envoyé avec « Expliquer l'article » : 1 262 lignes dans 356 textes de la
 * base, dont 121 articles du Code civil et 53 du Code de procédure pénale
 * (mesuré le 29/10/2026). Un intitulé qui finit par un point (« Attroupement
 * armé. », Code pénal) reste un intitulé : il ne s'ouvre pas comme une phrase.
 */
export function titreEstLeTexte(article: Pick<ArticleDuTexte, 'titre' | 'lignes'>): boolean {
  const titre = article.titre.trim();
  if (!titre) return false;
  if (article.lignes.length === 0 || titre.length > 100 || /[:;]$/.test(titre)) return true;
  const debut = titre.replace(MARQUE_AVANT_LE_TITRE, '') || titre;
  return ALINEA_EN_TETE.test(debut) || ressembleAUnePhrase(debut);
}

/** Un vrai intitulé d'article (« Imputabilité »), ou une chaîne vide. */
export function intituleDeLArticle(article: Pick<ArticleDuTexte, 'titre' | 'lignes'>): string {
  return titreEstLeTexte(article) ? '' : article.titre.trim();
}

/**
 * Le tiret que la conversion du PDF pose en puce devant un alinéa numéroté
 * (« - (1) La République… », « - a) l'intérim… ») : absent du Journal
 * officiel, il ouvrait le texte affiché et copié de la Constitution, dont
 * l'alinéa « (2) » n'en avait pas (vérification r3 du 29/10/2026). Les vrais
 * tirets d'énumération (« - la participation à… ») restent.
 */
const PUCE_D_ALINEA = /^[-–•]\s+(?=\(\d{1,3}\)|\d{1,3}\)|\(?[a-z]\))/;

/** Les lignes de l'article telles que le document les écrit, sa première comprise quand elle porte le texte. */
function lignesDuTexte(article: Pick<ArticleDuTexte, 'titre' | 'lignes'>): string[] {
  return titreEstLeTexte(article) ? [article.titre.trim(), ...article.lignes] : article.lignes;
}

/**
 * Les paragraphes de l'article, sa première ligne comprise quand c'en est une,
 * sans la puce que la conversion du PDF pose devant un alinéa. Les mêmes pour
 * l'affichage et le texte copié : un article tenant sur sa ligne « Article N »
 * aurait sinon copié un texte vide. Pas pour l'extrait envoyé avec
 * « Expliquer l'article » (`extraitDeLArticle`).
 */
export function paragraphesDeLArticle(article: Pick<ArticleDuTexte, 'titre' | 'lignes'>): string[] {
  return lignesDuTexte(article).map((paragraphe) => paragraphe.replace(PUCE_D_ALINEA, ''));
}

/** Le texte de l'article, un paragraphe par ligne. */
export function texteDeLArticle(article: Pick<ArticleDuTexte, 'titre' | 'lignes'>): string {
  return paragraphesDeLArticle(article).join('\n');
}

/**
 * Ce que copie « Copier le texte » : l'intitulé de l'article quand il en a un
 * (« Imputabilité »), puis ses paragraphes. Affiché en intertitre au-dessus
 * du texte, l'intitulé en fait partie ; la copie le perdait.
 */
export function paragraphesACopier(article: Pick<ArticleDuTexte, 'titre' | 'lignes'>): string[] {
  const intitule = intituleDeLArticle(article);
  return intitule ? [intitule, ...paragraphesDeLArticle(article)] : paragraphesDeLArticle(article);
}

/**
 * L'extrait envoyé avec « Expliquer l'article » : les lignes MOT POUR MOT,
 * puces comprises. Quand la base n'a pas de ligne pour ce numéro, le serveur
 * ne s'en sert que s'il retrouve ses 200 premiers caractères dans le document
 * (explanation_service.py, `_empreinte`, qui ne retire ni « - » ni puce).
 * Sans la puce, « … Urbaine. (2) La police… » n'y était plus, là où le
 * document écrit « … Urbaine. - (2) » : « Cet article n'a pas pu être
 * retrouvé dans le document » (/laws/1936, art. 2). Sur la base, la sonde
 * échouait pour 2 739 articles avec les paragraphes affichés ; elle échoue
 * pour 156 avec les lignes du document (mesuré le 29/10/2026).
 *
 * L'intitulé n'y est pas : il est parfois séparé du texte par un en-tête que
 * l'OCR a déplacé (Code pénal, art. 13), et la sonde ne le retrouverait pas
 * collé à la suite.
 */
export function extraitDeLArticle(article: Pick<ArticleDuTexte, 'titre' | 'lignes'>): string {
  return lignesDuTexte(article).join('\n');
}

/** Numérotation d'un alinéa ou d'une énumération en tête de ligne : « (1) », « 1) », « a) », « - », « • ». */
const NUMEROTATION_EN_TETE = /^(?:\(?\d{1,3}\)|\(?[a-z]\)|\d{1,3}[.°]-?|[-–—•*])\s*/i;

/**
 * Les premiers mots de l'article, pour le sommaire (P10) : son intitulé s'il
 * en a un, sinon le début de son texte, sans la numérotation de l'alinéa.
 * Coupés à 160 caractères SANS points de suspension : la ligne du sommaire
 * coupe elle-même à sa largeur (`truncate`), et le texte affiché reste mot
 * pour mot celui du document.
 */
export function premiersMots(article: Pick<ArticleDuTexte, 'titre' | 'lignes'>): string {
  const intitule = intituleDeLArticle(article);
  if (intitule) return intitule.slice(0, 160);
  for (const paragraphe of paragraphesDeLArticle(article)) {
    let debut = paragraphe.replace(/\s+/g, ' ').trim();
    // Les numérotations s'empilent : « - (1) Le Président… », « 1. a) … ».
    // Une seule passe laissait « (1) » : les articles 5 à 9 de la
    // Constitution se lisaient tous « (1) Le Président de la République e… ».
    for (let passe = 0; passe < 3; passe++) {
      const sans = debut.replace(NUMEROTATION_EN_TETE, '');
      if (sans === debut) break;
      debut = sans;
    }
    // Un paragraphe qui n'était qu'un numéro (« - (1) ») : le suivant.
    if (debut) return debut.slice(0, 160);
  }
  return '';
}

/* -------------------------------------------------------------------------- */
/* Divisions                                                                   */
/* -------------------------------------------------------------------------- */

/** La dernière division de la chaîne : celle qui nomme la division au sommaire. */
export function enTetePrincipal(division: Pick<DivisionDuTexte, 'entetes'>): EnTeteDeDivision | null {
  return division.entetes[division.entetes.length - 1] ?? null;
}

/** Rang d'un mot dans la hiérarchie : plus petit, plus large. */
const NIVEAU: Record<MotDeDivision, number> = {
  livre: 0,
  titre: 1,
  chapitre: 2,
  section: 3,
  'sous-section': 4,
  paragraphe: 5,
};

/**
 * Le nom d'une division, en casse de phrase et dans la langue de
 * l'interface : « CHAPITRE III » → « Chapitre III » (« Chapter III »),
 * « TITRE PREMIER » → « Titre premier » (« Title I »), « CHAPITRE
 * PRÉLIMINAIRE » → « Chapitre préliminaire » (« Preliminary chapter »). Les
 * capitales espacées en chasse fixe sont parties avec Q5 (deux voix au plus).
 * L'intitulé, lui, reste mot pour mot (`EnTeteDeDivision.intitule`).
 *
 * @param traduire clés `loi.division.*`
 */
export function libelleDeDivision(entete: Pick<EnTeteDeDivision, 'mot' | 'numeral'>, traduire: Traduire): string {
  const Mot = traduire(`loi.division.${entete.mot}`);
  const mot = Mot.toLowerCase();
  const numeral = entete.numeral.toLowerCase();
  const remplir = (cle: string) => traduire(cle).replace('{Mot}', Mot).replace('{mot}', mot);
  if (numeral === 'premier') return remplir('loi.division.premier');
  if (numeral === 'première' || numeral === 'premiere') return remplir('loi.division.premiere');
  if (numeral === 'préliminaire' || numeral === 'preliminaire') return remplir('loi.division.preliminaire');
  if (numeral === 'unique') return remplir('loi.division.unique');
  return `${Mot} ${entete.numeral}`;
}

/**
 * Les en-têtes qui situent la division au sommaire : le dernier, et ceux de
 * la chaîne qui le CONTIENNENT (« Titre II · Chapitre 1 »). Un en-tête de
 * même rang ou plus fin qui le précède appartient à ce qui précède : dans
 * « CHAPITRE 11 » (resté sans article) puis « TITRE III », le chapitre est la
 * fin du titre II, pas une partie du titre III. Le texte entier, lui, montre
 * toute la chaîne.
 */
export function enTetesDuSommaire(division: Pick<DivisionDuTexte, 'entetes'>): EnTeteDeDivision[] {
  const garde: EnTeteDeDivision[] = [];
  for (let i = division.entetes.length - 1; i >= 0; i--) {
    const entete = division.entetes[i];
    if (garde.length === 0 || NIVEAU[entete.mot] < NIVEAU[garde[0].mot]) garde.unshift(entete);
  }
  return garde;
}

/**
 * Les divisions qui structurent le texte, pour son résumé (« 69 articles ·
 * 13 titres ») : le plus haut rang qui compte au moins deux divisions avec
 * des articles. Les titres de la Constitution, les chapitres du décret
 * 2021/745, les livres du Code civil. Compter les dernières divisions de
 * chaque chaîne mêlait titres et chapitres (« 15 parties »). `null` sans
 * structure ou sous deux divisions.
 */
export function divisionsPrincipales(
  texte: Pick<TexteDecoupe, 'divisions'>,
): { mot: MotDeDivision; nombre: number } | null {
  const avecArticles = texte.divisions.filter((d) => d.articles.length > 0);
  const mots = (Object.keys(NIVEAU) as MotDeDivision[]).sort((a, b) => NIVEAU[a] - NIVEAU[b]);
  for (const mot of mots) {
    // Une même division (même en-tête) contient plusieurs morceaux du découpage.
    const vues = new Set<EnTeteDeDivision>();
    for (const division of avecArticles) {
      const entete = division.ancetres.find((e) => e.mot === mot);
      if (entete) vues.add(entete);
    }
    if (vues.size >= 2) return { mot, nombre: vues.size };
  }
  return null;
}

/**
 * Plage d'articles d'une division (« art. 7 à 11 ») : premier et dernier
 * numéros, égaux pour un seul article. `null` sans article, ou quand les
 * numéros ne vont pas croissant : une compilation insère les articles d'un
 * autre texte (le Code civil cite l'ordonnance de 1981 en plein titre 2), et
 * « art. 34 à 11 » se lirait comme une faute. Le sommaire dit alors le nombre
 * d'articles.
 */
export function plageDArticles(division: Pick<DivisionDuTexte, 'articles'>): { de: string; a: string } | null {
  const { articles } = division;
  if (articles.length === 0) return null;
  const de = articles[0].numero;
  const a = articles[articles.length - 1].numero;
  return Number(a) >= Number(de) ? { de, a } : null;
}

/* -------------------------------------------------------------------------- */
/* Filtre du sommaire                                                          */
/* -------------------------------------------------------------------------- */

/** Lettres accentuées ramenées à leur base, une pour une : les positions restent celles du texte d'origine. */
const SANS_ACCENT: Record<string, string> = {};
for (const [base, accentuees] of Object.entries({
  a: 'àáâãäåÀÁÂÃÄÅ',
  c: 'çÇ',
  e: 'èéêëÈÉÊË',
  i: 'ìíîïÌÍÎÏ',
  n: 'ñÑ',
  o: 'òóôõöÒÓÔÕÖ',
  u: 'ùúûüÙÚÛÜ',
  y: 'ýÿÝŸ',
})) {
  for (const lettre of accentuees) SANS_ACCENT[lettre] = base;
}

/**
 * Le texte en minuscules et sans accents, de MÊME LONGUEUR que l'original :
 * une occurrence trouvée dans la forme pliée se découpe aux mêmes positions
 * dans le texte affiché. `normalize('NFD')` changerait les longueurs.
 */
export function plier(texte: string): string {
  let sortie = '';
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    const plie = SANS_ACCENT[c] ?? c.toLowerCase();
    sortie += plie.length === 1 ? plie : c;
  }
  return sortie;
}

/** Une occurrence du filtre, découpée pour être mise en gras dans le sommaire. */
export interface Occurrence {
  avant: string;
  trouve: string;
  apres: string;
}

const CHERCHABLES = new WeakMap<ArticleDuTexte, { brut: string; plie: string }>();

/**
 * Le texte cherchable d'un article (intitulé et paragraphes), préparé une
 * seule fois : le Code civil en compte 2 134, relus à chaque frappe.
 */
function texteCherchable(article: ArticleDuTexte): { brut: string; plie: string } {
  let cherchable = CHERCHABLES.get(article);
  if (!cherchable) {
    const brut = [article.titre, ...article.lignes].join(' ').replace(/\s+/g, ' ');
    cherchable = { brut, plie: plier(brut) };
    CHERCHABLES.set(article, cherchable);
  }
  return cherchable;
}

/**
 * L'article répond-il au filtre du sommaire ? Insensible à la casse et aux
 * accents (« securite » trouve « SÉCURITÉ »). Un nombre seul cherche aussi le
 * numéro : « 12 » trouve l'article 12 sans s'arrêter aux « 12 mois » du texte.
 *
 * Rend l'occurrence (quelques mots autour, mot pour mot) à mettre en gras, ou
 * `true` pour un numéro, ou `false`.
 */
export function filtrerLArticle(article: ArticleDuTexte, filtre: string): Occurrence | boolean {
  const cherche = plier(filtre.trim().replace(/\s+/g, ' '));
  if (!cherche) return true;
  if (/^\d+$/.test(cherche) && article.cle === cherche) return true;
  const { brut, plie } = texteCherchable(article);
  const position = plie.indexOf(cherche);
  if (position < 0) return false;
  // Une quarantaine de caractères avant, coupés au mot, pour situer l'occurrence.
  let debut = Math.max(0, position - 40);
  if (debut > 0) {
    const espace = brut.indexOf(' ', debut);
    if (espace >= 0 && espace < position) debut = espace + 1;
  }
  const fin = position + cherche.length;
  return {
    avant: brut.slice(debut, position),
    trouve: brut.slice(position, fin),
    apres: brut.slice(fin, fin + 120),
  };
}
