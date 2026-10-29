/**
 * La ligne de repères d'un texte dans une liste ou un résultat de recherche
 * (P7, P11) : « Décret n° 2026/285 · 31 août 2026 · 3 articles », puis son
 * objet en clair (« Nomination des Officiers Magistrats… »).
 *
 * POURQUOI. Chaque fiche répétait « Décret N°… du … portant … » puis
 * « PRC-6803 · 10 décembre 2018 · 4 articles » : la date deux fois, une cote
 * interne que personne ne cite, et un titre coupé précisément sur l'objet. Les
 * repères (nature, numéro, date) passent en tête, l'objet devient le titre.
 *
 * TOUT VIENT DE L'API (contrat-api.md §1.1 et §1.2), rien n'est deviné ici :
 * - le numéro est `numero`, lu par le serveur dans l'en-tête de l'intitulé,
 *   fautes d'OCR réparées ; seule sa casse est reprise ici, sigles en
 *   capitales (`numeroAffiche`). L'ancienne API ne l'envoie pas : la ligne garde
 *   alors la seule nature, et le titre officiel entier, affiché dessous,
 *   porte le numéro. Le chercher ici dans l'intitulé prendrait aussi le
 *   numéro d'un texte simplement CITÉ (« … modifiant la loi n° 90/053 ») ;
 * - l'objet est `objet`, découpé par le serveur et testé sur tout le corpus ;
 *   nul (« découpe pas sûre ») ou absent (ancienne API), c'est le titre
 *   officiel entier ;
 * - la date suit `dateDeLActe` ($lib/api-publique) : signature, JO, année,
 *   jamais un « 1er janvier de remplissage ».
 *
 * Fonctions PURES : la langue et la traduction sont passées par l'appelant
 * (`$tr`), comme dans $lib/format.
 */

import { dateDeLActe } from '$lib/api-publique';
import { formatDateCourte } from '$lib/format';
import type { Language } from '$lib/stores/language';
import { typeDeTexte } from '$lib/type-de-texte';
import type { ReperesDuTexte } from '$lib/types';
import { nomCourtDuDomaine } from './domaines';

/** `$tr` : une clé de src/lib/stores/language.ts vers son texte. */
export type Traduire = (cle: string) => string;

/** Ce qu'il faut d'un texte pour ses repères : ligne de liste ou résultat de recherche. */
export interface TexteRepere extends ReperesDuTexte {
  title: string;
  type: string;
  publication_date?: string | null;
  article_count?: number | null;
  category_name?: string | null;
}

/** Un morceau d'extrait : le texte, en gras s'il porte un mot cherché. */
export interface SegmentDExtrait {
  texte: string;
  gras: boolean;
}

/**
 * Un résultat de recherche réduit à ce que sa ligne affiche (P7), préparé au
 * serveur par src/routes/search/resultats.ts.
 */
export interface ResultatAffiche extends TexteRepere {
  /** `law_id` : le texte, `/laws/{id}`. */
  id: number;
  category_id: number | null;
  /** Deux lignes d'extrait au plus, mots cherchés en gras. */
  extrait: SegmentDExtrait[];
  /** Numéros des articles trouvés (« 35.1 »), trois au plus, pour les puces. */
  articles: string[];
}

const INSECABLE = '\u00a0';

/**
 * Séparateur des repères. L'espace AVANT le point est insécable : à la coupure
 * de ligne, le point reste au bout de la ligne, jamais en tête de la
 * suivante (« 2026/285 · » puis « 31 août 2026 »).
 */
export const SEPARATEUR = `${INSECABLE}· `;

/** Une date ou un nombre ne se coupe pas en deux lignes (« 31 août » puis « 2026 »). */
function insecable(texte: string): string {
  return texte.replace(/ /g, INSECABLE);
}

/**
 * Remplit les `{cle}` d'un texte traduit. Par une FONCTION de remplacement :
 * une valeur venue du lecteur ou de l'API (« $& », « $1 ») serait sinon lue
 * comme un motif de `String.replace`.
 */
export function remplir(modele: string, valeurs: Record<string, string | number>): string {
  return modele.replace(/\{(\w+)\}/g, (tout, cle: string) => (cle in valeurs ? String(valeurs[cle]) : tout));
}

/** Un nombre dans la notation de la langue : « 1 277 » en français, « 1,277 » en anglais. */
export function formatNombre(n: number, langue: Language): string {
  return new Intl.NumberFormat(langue === 'fr' ? 'fr-FR' : 'en-US').format(n);
}

/**
 * La forme `.one` ou `.other` d'une clé selon le nombre. Le français met 0 et
 * 1 au singulier (« 0 texte », « 1 texte ») ; l'anglais, 1 seulement.
 */
export function cleSelonNombre(base: string, n: number, langue: Language): string {
  const singulier = langue === 'fr' ? n < 2 : n === 1;
  return `${base}.${singulier ? 'one' : 'other'}`;
}

/** Au-delà, le nom d'un code ne sert plus de repère court : la nature le remplace. */
const LONGUEUR_MAX_DU_NOM_DE_CODE = 40;

/**
 * Le nom court d'un code, quand l'intitulé COMMENCE par « Code » et que le
 * texte n'a pas de numéro : « Code civil » pour « Code civil applicable au
 * Cameroun, annoté de la jurisprudence de la Cour suprême », « Code des
 * assurances CIMA ». Les codes adoptés par une loi (« Loi N° 92/007 …
 * portant Code du travail ») ont leur numéro, et ne passent pas ici.
 */
export function nomDuCode(titre: string | null | undefined): string | null {
  const t = (titre ?? '').replace(/\s+/g, ' ').trim();
  if (!/^code\s/i.test(t)) return null;
  const nom = t
    .split(',')[0]
    .replace(/\s+applicable au Cameroun\b/i, '')
    .replace(/\s+des États membres de la CIMA\b/i, ' CIMA')
    .replace(/[.\s]+$/, '');
  return nom.length <= LONGUEUR_MAX_DU_NOM_DE_CODE ? nom : null;
}

/**
 * Clé du libellé de la nature : celle des badges ($lib/type-de-texte), sauf
 * l'acte uniforme, nommé « Acte uniforme OHADA » : seul, « Acte uniforme » ne
 * dit pas de quelle organisation il vient.
 */
export function cleDeNature(type: string | null | undefined, titre?: string | null): string {
  if ((type ?? '').trim().toLowerCase() === 'acte uniforme') return 'listes.nature.acteUniforme';
  return typeDeTexte(type, titre).cle;
}

/**
 * Les adverbes de rang (« 2003/006/bis ») : des mots latins, écrits en
 * minuscules dans les textes officiels. Ce ne sont pas des sigles.
 */
const ADVERBES_DE_RANG = new Set(['bis', 'ter', 'quater', 'quinquies', 'sexies', 'septies', 'octies', 'nonies', 'decies']);

/**
 * Le numéro tel qu'il s'affiche : SIGLES EN CAPITALES.
 *
 * L'API rend le numéro tel que l'intitulé l'écrit (contrat §1.2), et quelques
 * arrêtés de 2025 écrivent « 0600/cab/pr » quand les autres arrêtés du même
 * cabinet écrivent « 0525/CAB/PR » : dans une même liste, d'un lot à l'autre,
 * le même émetteur changeait de casse (« Arrêté n° 0593/cab/pr » puis
 * « Arrêté n° 0525/CAB/PR »). Un segment fait de LETTRES SEULES est un sigle
 * (CAB, PR, PM, MINFI, LF…) et passe en capitales ; un adverbe de rang reste
 * en minuscules, et un segment qui mêle chiffres et lettres n'est pas touché :
 * rien n'y dit ce qui serait un sigle.
 */
export function numeroAffiche(numero: string): string {
  return numero
    .split(/([^\p{L}\p{N}]+)/u)
    .map((segment) =>
      /^\p{L}+$/u.test(segment) && !ADVERBES_DE_RANG.has(segment.toLowerCase()) ? segment.toUpperCase() : segment,
    )
    .join('');
}

/** Le numéro de l'API, ou rien : jamais deviné dans l'intitulé (voir l'en-tête). */
function numeroDe(texte: TexteRepere): string | null {
  return typeof texte.numero === 'string' && texte.numero.trim() ? numeroAffiche(texte.numero.trim()) : null;
}

/** « Décret n° 2018/763 », « Loi n° 92/007 », « Acte uniforme OHADA », « Code civil ». */
export function natureEtNumero(texte: TexteRepere, traduire: Traduire): string {
  const numero = numeroDe(texte);
  if (!numero) {
    const code = nomDuCode(texte.title);
    if (code) return code;
  }
  const nature = traduire(cleDeNature(texte.type, texte.title));
  return numero ? `${nature} ${remplir(traduire('listes.numero'), { n: numero })}` : nature;
}

/**
 * La date des repères (contrat §1.1) : la date de l'acte en forme courte
 * (« 31 août 2026 », « 7 oct. 1994 »), « JO du … » pour les deux Actes
 * uniformes que seul le Journal officiel date, l'année seule quand le jour
 * n'est pas sûr, sinon rien.
 */
export function dateDesReperes(texte: TexteRepere, langue: Language, traduire: Traduire): string | null {
  const date = dateDeLActe(texte);
  if (!date) return null;
  if (date.genre === 'annee') return String(date.annee);
  const jour = insecable(formatDateCourte(date.date, langue));
  return date.genre === 'journal_officiel' ? remplir(traduire('listes.dateJo'), { date: jour }) : jour;
}

/** « 3 articles » ; rien pour zéro, qui signale une extraction en échec et non un texte vide. */
export function nombreDArticles(n: number | null | undefined, langue: Language, traduire: Traduire): string | null {
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) return null;
  return remplir(traduire(cleSelonNombre('listes.articles', n, langue)), { n: formatNombre(n, langue) });
}

export interface OptionsDesReperes {
  langue: Language;
  traduire: Traduire;
  /**
   * Troisième repère : le nombre d'articles dans une liste de textes (P11,
   * contrat §5.3), le domaine dans un résultat de recherche (P7), où les
   * textes viennent de tous les domaines.
   */
  suite: 'articles' | 'domaine';
}

/** La ligne de repères entière : « Décret n° 2026/285 · 31 août 2026 · 3 articles ». */
export function reperesDuTexte(texte: TexteRepere, { langue, traduire, suite }: OptionsDesReperes): string {
  const troisieme =
    suite === 'articles'
      ? nombreDArticles(texte.article_count, langue, traduire)
      : nomCourtDuDomaine(texte.category_name, langue) || null;
  return [natureEtNumero(texte, traduire), dateDesReperes(texte, langue, traduire), troisieme]
    .filter((morceau): morceau is string => Boolean(morceau))
    .join(SEPARATEUR);
}

/**
 * Le titre affiché : l'objet en clair quand le serveur a pu le découper, sinon
 * l'intitulé officiel entier (la page du texte garde toujours ce dernier).
 */
export function intituleDuTexte(texte: { objet?: string | null; title: string }): string {
  const objet = typeof texte.objet === 'string' ? texte.objet.trim() : '';
  return objet || texte.title.trim();
}

/**
 * Vrai quand le titre affiché est l'objet découpé : l'intitulé officiel, et
 * avec lui la nature et le numéro, ne se lisent plus dans le lien. Le nom
 * accessible du lien les reprend alors (P11 : « le lien doit porter l'objet
 * et la référence »).
 */
export function titreDecoupe(texte: { objet?: string | null; title: string }): boolean {
  return intituleDuTexte(texte) !== texte.title.trim();
}
