/**
 * Le statut juridique d'un texte tel que la page le montre (P1, étapes 1 et
 * 2) : encadré en tête, encadré sous un article, marques « · modifié » du
 * sommaire, onglet « Historique ». Source : `statut_juridique` de
 * `GET /laws/{id}` (data/ux-impl/contrat-api.md, §3).
 *
 * RIEN QUE CE QUE LE RELEVÉ PROUVE. Jamais « En vigueur » : aucun champ ne le
 * prouve, et présenter comme applicable un texte abrogé est l'erreur la plus
 * grave d'un service juridique. Sans statut (ancienne API, ou calcul en échec
 * côté serveur), la page dit seulement « Version d'origine, non consolidée »,
 * sans date de relevé (contrat, §8) : JuriX ne publie que le texte tel que
 * signé, et cette mention prévient le lecteur qu'il a pu changer depuis.
 *
 * POURQUOI `par_article` ET NON `par_morceau`. Le contrat recommande
 * `par_morceau` pour une page bâtie sur les morceaux de l'API. Celle-ci
 * découpe le texte lui-même (decoupage.ts) et ne connaît que des numéros :
 * `par_article`, calculé avec la même normalisation des numéros que le front
 * (`cle_article` du backend), est sa clé naturelle. Il est même plus juste ici :
 * l'article 5 de la loi 90/053, collé par l'ingestion à la fin du morceau « 2 »,
 * est marqué « 5 » par `par_article` et « 2 » par le numéro de son morceau.
 * Sa limite, les numéros en double d'une compilation, est levée par la
 * section du changement (`changementsParArticle`).
 */

import { dateDeLActe, modificationsActuelles } from '$lib/api-publique';
import { formatDate, formatDateCourte } from '$lib/format';
import type { Language } from '$lib/stores/language';
import type { Changement, StatutJuridique, TexteLie } from '$lib/types';
import { plier, type ArticleDuTexte, type TexteDecoupe } from './decoupage';
import type { Traduire } from './reference';

/* -------------------------------------------------------------------------- */
/* Nom d'un texte lié                                                          */
/* -------------------------------------------------------------------------- */

/** Nature d'un texte (`laws.type`, accents compris) → suffixe des clés `loi.lie.*`. */
const CLE_DE_NATURE: Readonly<Record<string, string>> = {
  loi: 'loi',
  décret: 'decret',
  ordonnance: 'ordonnance',
  arrêté: 'arrete',
  'acte uniforme': 'acte_uniforme',
  décision: 'decision',
  circulaire: 'circulaire',
  instruction: 'instruction',
};

/**
 * Le nom d'un texte lié, coupé pour la phrase : le déterminant, hors du lien
 * (« par la »), puis le nom, qui porte le lien (« loi n° 2008/001 du 14 avril
 * 2008 »), comme sur la maquette. En anglais, pas de déterminant.
 *
 * Un texte sans numéro est nommé par son intitulé officiel, entre `avant` et
 * `apres` (« texte « », « » ») : l'intitulé reste seul dans son élément, mot
 * pour mot, et n'est jamais pris pour du français resté dans l'interface
 * anglaise (monochrome.spec.ts compare chaque nœud de texte au document).
 */
export interface NomDeTexte {
  determinant: string;
  avant: string;
  nom: string;
  apres: string;
}

/** « la loi n° 2008/001 du 14 avril 2008 » → « la » et le reste (« l’ » collé au nom). */
const DETERMINANT = /^(la |le |les |l['’])([\s\S]*)$/;

function couperLeDeterminant(phrase: string): { determinant: string; reste: string } {
  const m = DETERMINANT.exec(phrase);
  return m ? { determinant: m[1], reste: m[2] } : { determinant: '', reste: phrase };
}

export function nomDuTexteLie(texte: TexteLie, langue: Language, traduire: Traduire): NomDeTexte {
  if (!texte.numero) {
    // Un code, un traité, un acte nommé par son titre : l'intitulé, entier.
    const [debut, fin = ''] = traduire('loi.lie.sans_numero').split('{titre}');
    const { determinant, reste } = couperLeDeterminant(debut);
    return { determinant, avant: reste, nom: texte.titre, apres: fin };
  }
  const base = traduire(`loi.lie.${CLE_DE_NATURE[texte.nature] ?? 'autre'}`).replace('{numero}', texte.numero);
  // La date de l'acte, dans l'ordre du contrat (§1.1) : signature, Journal officiel, année.
  const date = dateDeLActe(texte);
  let phrase = base;
  if (date?.genre === 'signature' || date?.genre === 'date') {
    phrase = traduire('loi.lie.date').replace('{texte}', base).replace('{date}', formatDate(date.date, langue));
  } else if (date?.genre === 'journal_officiel') {
    phrase = traduire('loi.lie.jo').replace('{texte}', base).replace('{date}', formatDate(date.date, langue));
  } else if (date?.genre === 'annee') {
    phrase = traduire('loi.lie.annee').replace('{texte}', base).replace('{annee}', String(date.annee));
  }
  const { determinant, reste } = couperLeDeterminant(phrase);
  return { determinant, avant: '', nom: reste, apres: '' };
}

/** Première lettre en capitale : le nom d'un texte en tête d'une ligne d'historique. */
export function capitaliser(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Le lien vers un texte lié, seulement s'il est publié dans JuriX (contrat, §3.3). */
export function lienDuTexteLie(texte: TexteLie): string | null {
  return texte.consultable && Number.isInteger(texte.id) && (texte.id as number) > 0 ? `/laws/${texte.id}` : null;
}

/* -------------------------------------------------------------------------- */
/* Encadré en tête du texte                                                    */
/* -------------------------------------------------------------------------- */

/** Ce que dit l'encadré de statut en tête du texte. */
export type EtatDuBloc =
  /** Pas de statut (ancienne API, calcul en échec) : « Version d'origine, non consolidée », sans date. */
  | { genre: 'inconnu' }
  /** Aucun lien relevé : « Version d'origine, non consolidée. Aucune modification relevée par JuriX au … ». */
  | { genre: 'origine'; releveLe: string }
  /** Le document en base intègre déjà ces textes, et rien d'autre n'est relevé. */
  | { genre: 'consolide'; releveLe: string; integres: TexteLie[] }
  /** Des modifications actuelles, regroupées par texte (contrat, §3.5). */
  | {
      genre: 'modifie';
      releveLe: string;
      groupes: { texte: TexteLie; changements: Changement[] }[];
      integres: TexteLie[];
    }
  /** Le texte ENTIER est abrogé ou remplacé : pas de « version d'origine » trompeuse. */
  | { genre: 'abroge' | 'remplace'; releveLe: string; par: TexteLie | null };

export function etatDuBloc(statut: StatutJuridique | null): EtatDuBloc {
  if (!statut) return { genre: 'inconnu' };
  const releveLe = statut.releve_le;
  if (statut.abroge || statut.etat === 'abroge' || statut.etat === 'remplace') {
    return { genre: statut.etat === 'remplace' ? 'remplace' : 'abroge', releveLe, par: statut.abroge_par ?? null };
  }
  const integres = statut.version_en_base?.textes_integres ?? [];
  const groupes = modificationsActuelles(statut);
  if (groupes.length) return { genre: 'modifie', releveLe, groupes, integres };
  if (integres.length) return { genre: 'consolide', releveLe, integres };
  return { genre: 'origine', releveLe };
}

/**
 * La date du relevé, en forme courte (« 14 oct. 2026 »), comme la maquette,
 * en un seul bloc : espaces insécables. En fin de ligne, l'encadré coupait
 * « au 14 oct. / 2026. » à 768 et 740 px, « as of Oct / 14, 2026. » à 390 px
 * (vérification r1 du 29/10/2026).
 */
export function dateDuReleve(releveLe: string, langue: Language): string {
  return formatDateCourte(releveLe, langue).replace(/\s/g, ' ');
}

/* -------------------------------------------------------------------------- */
/* Articles touchés                                                            */
/* -------------------------------------------------------------------------- */

/** Les articles visés, écrits pour une phrase : « 14, 15, 51 » ; « 246 à 323 » devient « 246 to 323 » en anglais. */
export function articlesEcrits(articles: string[], langue: Language): string {
  return articles.map((a) => (langue === 'fr' ? a : a.replace(/\s+à\s+/g, ' to '))).join(', ');
}

/** Plusieurs articles (une liste, ou une plage) : le participe s'accorde au pluriel. */
function auPluriel(articles: string[]): boolean {
  return articles.length > 1 || articles.some((a) => /\sà\s/.test(a));
}

/** Participe d'un changement (« complété », « réécrits en entier »), accordé. */
export function participe(changement: Changement, pluriel: boolean, traduire: Traduire): string {
  return traduire(`loi.participe.${changement.nature_modification}${pluriel ? '.pluriel' : ''}`);
}

/** Une modification simple d'articles : elle ne dit que ses articles, sans participe. */
function sansParticipe(changement: Changement): boolean {
  return (
    changement.etendue === 'articles' &&
    changement.articles_cibles.length > 0 &&
    changement.nature_modification === 'modifie'
  );
}

/**
 * Le détail d'un texte modificatif dans l'encadré en tête : « art. 14, 15,
 * 51 ; art. 67 complété » (maquette constitution-p1a). Une modification
 * simple ne dit que ses articles ; les autres disent aussi ce qui a changé.
 *
 * Les modifications simples passent EN TÊTE, chaque groupe dans l'ordre de
 * l'API : « art. 5, 7, 10, 53, 66 ; art. 6 réécrit en entier ». Dans l'ordre
 * de l'API, la loi n° 2026/002 se lisait « art. 6 réécrit en entier ; art. 5,
 * 7, 10, 53, 66 » : rien ne disait ce qui arrivait aux articles 5, 7, 10, 53
 * et 66, et le participe du groupe précédent semblait valoir pour eux aussi.
 */
export function detailDesChangements(changements: Changement[], langue: Language, traduire: Traduire): string {
  const ordonnes = [...changements.filter(sansParticipe), ...changements.filter((c) => !sansParticipe(c))];
  const morceaux = ordonnes.map((c) => {
    if (c.etendue === 'articles' && c.articles_cibles.length) {
      const articles = `${traduire('loi.art')} ${articlesEcrits(c.articles_cibles, langue)}`;
      return sansParticipe(c) ? articles : `${articles} ${participe(c, auPluriel(c.articles_cibles), traduire)}`;
    }
    if (c.etendue === 'texte') return `${traduire('loi.historique.texte_entier')} ${participe(c, false, traduire)}`;
    return `${participe(c, false, traduire)} (${traduire('loi.historique.articles_inconnus')})`;
  });
  // Espace insécable avant le point-virgule, en français seulement.
  return morceaux.join(langue === 'fr' ? '\u00a0; ' : '; ');
}

/**
 * La phrase de l'encadré d'un article sur le texte affiché (une clé
 * `loi.article.*`), d'après ses changements actuels, ou `null` s'il n'en a
 * pas. JAMAIS plus que le relevé ne prouve (P1) :
 * - tous intégrés au document (`integre_au_texte`) : « intègre déjà » ;
 * - aucun intégré, dans un document qui n'est pas une version consolidée
 *   (`version_en_base` nul) : « version d'origine, sans cette modification » ;
 * - sinon, « ne contient pas cette modification », pour ceux qui manquent.
 * L'article 5 de l'ordonnance 74/1 (/laws/2242) affiche la réécriture de
 * l'ordonnance 77/1, intégrée, mais pas la loi 83-19 : l'encadré le disait
 * « version d'origine, sans ces modifications ». Les articles 140 à 146 du
 * Code électoral (/laws/2282), lus dans sa version consolidée par la loi
 * 2012/017, aussi.
 *
 * @param consolide le document en base est une version consolidée (`version_en_base`)
 */
export function mentionDuTexteAffiche(actuels: Changement[], consolide: boolean): string | null {
  if (actuels.length === 0) return null;
  const absents = actuels.filter((c) => !c.integre_au_texte).length;
  const nombre = (n: number) => (n > 1 ? '.pluriel' : '');
  if (absents === 0) return `loi.article.deja_integre${nombre(actuels.length)}`;
  if (absents === actuels.length && !consolide) return `loi.article.version_origine${nombre(absents)}`;
  return `loi.article.sans_modification${nombre(absents)}`;
}

/** Ce que la page dit d'un article : changements reçus (actuels, dépassés) et portés. */
export interface ChangementsDeLArticle {
  /** Reçus d'un autre texte, et pas dépassés depuis. */
  actuels: Changement[];
  /** Reçus, puis dépassés par un texte plus récent : de l'historique. */
  anciens: Changement[];
  /** Portés par cet article : ce qu'il fait à un autre texte. */
  portes: Changement[];
}

/** Forme comparable d'un intitulé de division : sans casse, accents, ponctuation ni espaces. */
function formeDeSection(texte: string): string {
  return plier(texte).replace(/[^a-z0-9]/g, '');
}

/**
 * La section d'un changement (« TITRE 2 Des actes de l'état civil. ») est-elle
 * celle d'une des divisions qui contiennent l'article ? Égales, ou l'une est
 * le début de l'autre suivi d'une lettre (« titre1 » n'est pas le début de
 * « titre10… »).
 */
function memeSection(section: string, divisions: string[]): boolean {
  const cherchee = formeDeSection(section);
  if (cherchee.length < 4) return false;
  return divisions.some((ligne) => {
    const forme = formeDeSection(ligne);
    if (forme === cherchee) return true;
    const [court, long] = forme.length < cherchee.length ? [forme, cherchee] : [cherchee, forme];
    return court.length >= 4 && long.startsWith(court) && /[a-z]/.test(long.charAt(court.length));
  });
}

/**
 * Les changements de chaque article du texte découpé, par rang.
 *
 * Un numéro unique prend tous les changements de `par_article`. Un numéro en
 * double (compilation) ne prend un changement limité à une section
 * (`Changement.section`) que dans les divisions de cette section ; si aucune
 * ne lui correspond (intitulés écrits autrement), tous les homonymes le
 * prennent, et l'encadré nomme la section : mieux vaut un avertissement de
 * trop qu'un article modifié présenté comme intact.
 */
export function changementsParArticle(
  statut: StatutJuridique | null,
  decoupe: TexteDecoupe,
): Map<number, ChangementsDeLArticle> {
  const parRang = new Map<number, ChangementsDeLArticle>();
  if (!statut) return parRang;
  const parId = new Map<string, Changement>();
  for (const c of [...statut.modifie_par, ...statut.modifie]) parId.set(c.id, c);

  const parCle = new Map<string, ArticleDuTexte[]>();
  for (const article of decoupe.articles) {
    const liste = parCle.get(article.cle);
    if (liste) liste.push(article);
    else parCle.set(article.cle, [article]);
  }

  const lignesDes = (article: ArticleDuTexte) =>
    (decoupe.divisions[article.division]?.ancetres ?? []).map((e) => e.ligne);

  for (const [cle, ids] of Object.entries(statut.par_article ?? {})) {
    const homonymes = parCle.get(cle);
    if (!homonymes || !Array.isArray(ids)) continue;
    for (const id of ids) {
      const changement = parId.get(id);
      if (!changement) continue;
      let vises = homonymes;
      if (homonymes.length > 1 && changement.section) {
        const dansLaSection = homonymes.filter((a) => memeSection(changement.section as string, lignesDes(a)));
        if (dansLaSection.length) vises = dansLaSection;
      }
      for (const article of vises) {
        const entree = parRang.get(article.rang) ?? { actuels: [], anciens: [], portes: [] };
        if (changement.sens === 'modifie') entree.portes.push(changement);
        else if (changement.depasse) entree.anciens.push(changement);
        else entree.actuels.push(changement);
        parRang.set(article.rang, entree);
      }
    }
  }
  return parRang;
}

/** Marque d'un article au sommaire (« · modifié »), ou `null` s'il n'a rien reçu. */
export type MarqueDuSommaire = 'modifie' | 'abroge' | 'remplace';

export function marqueDuSommaire(changements: ChangementsDeLArticle | undefined): MarqueDuSommaire | null {
  if (!changements) return null;
  if (changements.actuels.some((c) => c.type === 'abroge')) return 'abroge';
  if (changements.actuels.some((c) => c.type === 'remplace')) return 'remplace';
  return changements.actuels.length || changements.anciens.length ? 'modifie' : null;
}

/* -------------------------------------------------------------------------- */
/* Historique                                                                  */
/* -------------------------------------------------------------------------- */

export interface GroupeDHistorique {
  texte: TexteLie;
  changements: Changement[];
}

/** Clé d'un texte lié : sa cote, ou son titre pour un texte hors corpus (même règle que $lib/api-publique). */
function cleDuTexte(texte: TexteLie): string {
  return texte.reference ?? texte.titre;
}

function grouper(changements: Changement[]): GroupeDHistorique[] {
  const groupes: GroupeDHistorique[] = [];
  for (const c of changements) {
    const dernier = groupes[groupes.length - 1];
    if (dernier && cleDuTexte(dernier.texte) === cleDuTexte(c.texte)) dernier.changements.push(c);
    else groupes.push({ texte: c.texte, changements: [c] });
  }
  return groupes;
}

/**
 * Toute la chaîne (P1, étape 2) : les changements reçus, du plus ancien au
 * plus récent, dépassés et intégrés compris, puis ceux que ce texte a faits à
 * d'autres. Un groupe par texte, dans l'ordre de l'API, qui fait déjà se
 * suivre les changements d'un même texte.
 */
export function historiqueDuTexte(statut: StatutJuridique): { recus: GroupeDHistorique[]; portes: GroupeDHistorique[] } {
  return { recus: grouper(statut.modifie_par), portes: grouper(statut.modifie) };
}

/**
 * Les articles du texte qui porte un changement (`articles_source`), tels
 * qu'un lecteur peut les chercher dans ce texte. Le champ donne les MORCEAUX
 * de l'ingestion (contrat, §3.2) : « SECTION_2 », « DISPOSITIF » ne sont pas
 * des articles, et « 67.3 » est le troisième morceau de l'article 67.
 * L'onglet « Historique » du Code du travail écrivait « (art. SECTION_2, 25,
 * 174 de ce texte) ». Rien quand il ne reste aucun numéro.
 */
export function articlesSourceLisibles(articles: string[]): string[] {
  const numeros = new Set<string>();
  for (const morceau of articles) {
    const numero = morceau.trim().replace(/\.\d+$/, '');
    if (/^\d/.test(numero)) numeros.add(numero);
  }
  return [...numeros];
}

/** Ce qu'un changement vise, pour une ligne d'historique : « art. 6, 53 », « texte entier »… */
export function cibleDuChangement(changement: Changement, langue: Language, traduire: Traduire): string {
  if (changement.etendue === 'articles' && changement.articles_cibles.length) {
    return `${traduire('loi.art')} ${articlesEcrits(changement.articles_cibles, langue)}`;
  }
  return traduire(changement.etendue === 'texte' ? 'loi.historique.texte_entier' : 'loi.historique.articles_inconnus');
}
