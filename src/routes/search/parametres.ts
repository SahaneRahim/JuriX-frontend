/**
 * Les paramètres de /search, lus dans l'adresse et réécrits dans les liens.
 *
 * POURQUOI L'ADRESSE PORTE TOUT (P7, P8). La recherche part maintenant d'un
 * vrai formulaire GET et se rend au serveur (+page.server.ts) : la requête,
 * la nature, les domaines, la période, le tri et la page sont des paramètres
 * d'URL, et chaque filtre, onglet ou numéro de page est un lien ou un
 * formulaire GET. Tout marche donc sans JavaScript (Opera Mini, page pas
 * encore hydratée sur un réseau lent), une recherche filtrée se partage et se
 * met en signet, et le bouton « Précédent » défait le dernier filtre.
 *
 * Les valeurs viennent de l'extérieur : toute valeur inconnue est ignorée
 * plutôt qu'envoyée à l'API, qui répondrait 422 (clé de `refine` inconnue,
 * requête de plus de 500 caractères, bornes impossibles).
 *
 * Noms français. DEUX PARAMÈTRES DE DOMAINE, qui ne disent pas la même chose :
 * - `perimetre=13`, le champ caché de la page d'un domaine (P8 l'appelait
 *   « categorie=13 ») : on cherche DANS ce domaine, et l'API calcule
 *   l'ensemble trouvé parmi ses seuls textes (`filters`, en SQL) ;
 * - `categorie=13`, une case cochée dans la colonne de filtres : on garde, de
 *   ce que la recherche a trouvé dans tout le corpus, les textes de ce domaine
 *   (`refine`).
 * Un seul paramètre pour les deux envoyait la recherche d'une page de domaine
 * en `refine` : l'ensemble trouvé, une vingtaine de textes de tout le corpus,
 * n'en gardait que ceux du domaine. « indemnité de licenciement » depuis
 * Travail et sécurité sociale rendait 2 textes au lieu de 5, et
 * « nomination » depuis Santé publique, aucun au lieu de 10 (API de test,
 * 29/10/2026) : les décrets de la Fonction publique remplissaient l'ensemble.
 */

import type { DemandeDeRecherche } from '$lib/api-publique';
import { identifiantDepuis } from '$lib/identifiant';
import { TAILLE_PAGE_RECHERCHE } from '$lib/pagination';

/**
 * Les natures des onglets, dans l'ordre de la maquette recherche-p7a (du plus
 * au moins fréquent dans le corpus : 1 702 décrets, 228 lois, 286 arrêtés…).
 * « autres » regroupe les natures rares, qu'un onglet chacune aurait allongé
 * la bande au-delà d'un écran de téléphone.
 */
export const NATURES = ['decret', 'loi', 'arrete', 'acte-uniforme', 'autres'] as const;
export type NatureDuFiltre = (typeof NATURES)[number];

export const PERIODES = ['annee', '5ans'] as const;
export type PeriodeDuFiltre = (typeof PERIODES)[number];

/** Pertinence par défaut (pas de paramètre) ; sinon par date. */
export const TRIS = ['recent', 'ancien'] as const;
export type TriDuFiltre = (typeof TRIS)[number];

/**
 * Les valeurs de `laws.type` de chaque nature, accents compris (contrat §1.2).
 * L'ancienne API les compare telles quelles (`filters.types`, égalité
 * stricte) ; la nouvelle ignore accents et casse. « instruction » n'existe
 * que pour un texte hors corpus : il ne coûte rien de le prévoir.
 */
export const TYPES_DES_NATURES: Readonly<Record<NatureDuFiltre, readonly string[]>> = {
  decret: ['décret'],
  loi: ['loi'],
  arrete: ['arrêté'],
  'acte-uniforme': ['acte uniforme'],
  autres: ['ordonnance', 'circulaire', 'décision', 'instruction', 'autre'],
};

/** `SearchRequest.query` : 500 caractères au plus (app/schemas/search.py), sinon 422. */
export const LONGUEUR_MAX_REQUETE = 500;

/**
 * Dernière page lue dans l'adresse. Le parcours affiné ne rend que quelques
 * dizaines de textes (contrat §6.3), le classique quelques centaines : mille
 * pages de 20 couvrent tout, et bornent l'`offset` d'une adresse fabriquée.
 */
export const PAGE_MAX = 1000;

/** Quatorze domaines aujourd'hui (migration 007) : au-delà, une adresse fabriquée. */
const DOMAINES_MAX = 30;

export interface ParametresDeRecherche {
  /** La requête, sans blancs aux bouts ; vide : la page d'accueil de la recherche. */
  q: string;
  /**
   * Domaines OÙ chercher (`category_id`), triés et sans doublon : la page d'un
   * domaine (`perimetre=13`). L'ensemble trouvé ne compte que leurs textes.
   */
  perimetre: number[];
  /** Nature de l'onglet ; `null` : toutes. */
  nature: NatureDuFiltre | null;
  /** Domaines cochés dans la colonne (`category_id`), triés et sans doublon. */
  categories: number[];
  periode: PeriodeDuFiltre | null;
  /** `null` : pertinence. */
  tri: TriDuFiltre | null;
  /** À partir de 1. */
  page: number;
}

function parmi<T extends string>(valeurs: readonly T[], brut: string | null): T | null {
  return brut !== null && (valeurs as readonly string[]).includes(brut) ? (brut as T) : null;
}

/** Les domaines d'un paramètre répété (`categorie`, `perimetre`) : identifiants valides, triés, sans doublon. */
function domainesDepuis(parametres: URLSearchParams, nom: string): number[] {
  return [
    ...new Set(
      parametres
        .getAll(nom)
        .map((brut) => identifiantDepuis(brut.trim()))
        .filter((id): id is number => id !== null),
    ),
  ]
    .sort((a, b) => a - b)
    .slice(0, DOMAINES_MAX);
}

/** Les paramètres de l'adresse, chacun validé ; une valeur invalide vaut « par défaut ». */
export function lireParametres(parametres: URLSearchParams): ParametresDeRecherche {
  const q = (parametres.get('q') ?? '').trim().slice(0, LONGUEUR_MAX_REQUETE).trim();
  // Forme canonique d'un entier, comme les identifiants : « 2 », pas « 02 » ni « 2e0 ».
  const brutPage = parametres.get('page') ?? '';
  const page = /^[1-9]\d{0,6}$/.test(brutPage) ? Math.min(Number(brutPage), PAGE_MAX) : 1;
  return {
    q,
    perimetre: domainesDepuis(parametres, 'perimetre'),
    nature: parmi(NATURES, parametres.get('nature')),
    categories: domainesDepuis(parametres, 'categorie'),
    periode: parmi(PERIODES, parametres.get('periode')),
    tri: parmi(TRIS, parametres.get('tri')),
    page,
  };
}

/**
 * L'adresse d'une recherche, sans les valeurs par défaut : `/search?q=bail`
 * et non `/search?q=bail&nature=&page=1`. Mêmes paramètres dans le même
 * ordre : une même recherche a toujours la même adresse (historique, liens
 * visités).
 *
 * @param ancre un fragment (« resultats ») : un numéro de page y mène, avec
 *   ou sans JavaScript, au lieu du haut de la page
 */
export function adresseDeRecherche(p: ParametresDeRecherche, ancre = ''): string {
  const parametres = new URLSearchParams();
  parametres.set('q', p.q);
  // Juste après la requête : l'ordre où l'envoie le formulaire de la page
  // d'un domaine, qui donne ainsi d'emblée l'adresse des liens de la page.
  for (const id of p.perimetre) parametres.append('perimetre', String(id));
  if (p.nature) parametres.set('nature', p.nature);
  for (const id of p.categories) parametres.append('categorie', String(id));
  if (p.periode) parametres.set('periode', p.periode);
  if (p.tri) parametres.set('tri', p.tri);
  if (p.page > 1) parametres.set('page', String(p.page));
  return `/search?${parametres}${ancre ? `#${ancre}` : ''}`;
}

/** Un filtre qui restreint les résultats, périmètre compris (le tri n'en est pas un). */
export function aDesFiltres(p: ParametresDeRecherche): boolean {
  return p.perimetre.length > 0 || aDesAffinages(p);
}

/** Un filtre qui part en `refine` : nature, case de domaine ou période (pas le périmètre). */
export function aDesAffinages(p: ParametresDeRecherche): boolean {
  return p.nature !== null || p.categories.length > 0 || p.periode !== null;
}

/**
 * Ce que règle le panneau « Filtres » (domaines et période) : le nombre de sa
 * pastille. Le périmètre en est : la colonne le montre coché, parmi les
 * domaines, et le décocher l'ôte.
 */
export function filtresDuPanneau(p: ParametresDeRecherche): number {
  return p.perimetre.length + p.categories.length + (p.periode ? 1 : 0);
}

/** La nature d'onglet d'un `type` de l'API (« décret », « Acte_uniforme »…). */
export function natureDuType(type: string | null | undefined): NatureDuFiltre {
  const t = (type ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .trim();
  if (t === 'decret') return 'decret';
  if (t === 'loi') return 'loi';
  if (t === 'arrete') return 'arrete';
  if (t === 'acte uniforme') return 'acte-uniforme';
  return 'autres';
}

/** Première année de la période : l'année en cours, ou les cinq dernières, elle comprise. */
export function anneeDeDebut(periode: PeriodeDuFiltre | null, anneeCourante: number): number | undefined {
  if (periode === 'annee') return anneeCourante;
  if (periode === '5ans') return anneeCourante - 4;
  return undefined;
}

function pagination(p: ParametresDeRecherche): Pick<DemandeDeRecherche, 'limit' | 'offset'> {
  return { limit: TAILLE_PAGE_RECHERCHE, offset: (p.page - 1) * TAILLE_PAGE_RECHERCHE };
}

/**
 * La demande à la recherche AFFINÉE (contrat §6) : filtres dans `refine`, tri
 * dans `sort`, et les effectifs (`facets`).
 *
 * `refine`, et non `filters`, pour les filtres que l'on coche : il restreint
 * l'ensemble candidat sans le recalculer, et ses effectifs sont
 * DISJONCTIFS (chacun compte les résultats de tous les autres filtres) :
 * « Décrets 12 » reste vrai quand l'onglet « Lois » est choisi, et cocher un
 * deuxième domaine montre d'avance combien il en ajoute. Avec `filters`,
 * l'ensemble serait recalculé à chaque filtre, et toute autre nature y vaudrait
 * zéro.
 *
 * Le PÉRIMÈTRE, lui, part en `filters` : choisi avant de chercher, il doit
 * délimiter l'ensemble lui-même. L'API ne le calcule que pour les vingt
 * premiers textes trouvés (contrat §6.1) ; en `refine`, la recherche d'une
 * page de domaine ne gardait que ceux de ces vingt qui en sont, et un domaine
 * absent de ces vingt ne rendait rien. `filters` et `refine` se combinent :
 * nature et période affinent l'ensemble trouvé dans le domaine.
 */
export function demandeAffinee(p: ParametresDeRecherche, anneeCourante: number): DemandeDeRecherche {
  return {
    query: p.q,
    ...pagination(p),
    ...(p.perimetre.length ? { filters: { category_ids: p.perimetre } } : {}),
    ...(p.tri ? { sort: p.tri === 'recent' ? 'date_desc' : 'date_asc' } : {}),
    refine: {
      types: p.nature ? [...TYPES_DES_NATURES[p.nature]] : undefined,
      category_ids: p.categories.length ? p.categories : undefined,
      year_from: anneeDeDebut(p.periode, anneeCourante),
    },
    facets: true,
  };
}

/**
 * La même recherche pour l'ANCIENNE API, qui ignore `refine` (contrat §8) mais
 * applique depuis toujours `filters` en SQL (`types`, `category_ids`,
 * `year_from`) : les résultats restent justes, sans effectifs ni tri. Elle
 * n'a pas de colonne de filtres : une nature, une case ou une période n'y
 * viennent que d'une adresse partagée.
 *
 * Périmètre et cases s'y réunissent en une liste, que l'API lit en « l'un ou
 * l'autre » : c'est ce que disent les rappels des filtres, l'un à côté de
 * l'autre.
 */
export function demandeClassique(p: ParametresDeRecherche, anneeCourante: number): DemandeDeRecherche {
  const debut = anneeDeDebut(p.periode, anneeCourante);
  const domaines = [...new Set([...p.perimetre, ...p.categories])].sort((a, b) => a - b);
  return {
    query: p.q,
    ...pagination(p),
    filters: {
      ...(p.nature ? { types: [...TYPES_DES_NATURES[p.nature]] } : {}),
      ...(domaines.length ? { category_ids: domaines } : {}),
      ...(debut !== undefined ? { year_from: debut } : {}),
    },
  };
}
