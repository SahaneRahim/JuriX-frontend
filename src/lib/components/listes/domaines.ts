/**
 * Les 14 domaines juridiques dans les listes et la recherche : leur nom court
 * et l'ordre fixe de la colonne de filtres de /search.
 *
 * LE NOM vient de $lib/categories (`nomCategorie`), qui rend le nom COURT de
 * la proposition Q2 A (« Travail et sécurité sociale » pour « Droit du
 * Travail et Sécurité Sociale ») : un domaine porte le même nom sur
 * l'accueil, dans le titre de sa page, dans la ligne de repères d'un résultat
 * (« Loi n° 92/007 · 14 août 1992 · Travail et sécurité sociale », maquette
 * recherche-p7a) et dans la colonne de filtres de 256 px, où les noms longs
 * passaient sur deux ou trois lignes. Une seule table, dans ce module-là.
 *
 * L'ORDRE vient lui aussi de $lib/categories (`ordonnerLesDomaines`) : celui
 * de l'accueil. Voir `ORDRE_DES_DOMAINES`.
 */

import { nomCategorie, ordonnerLesDomaines } from '$lib/categories';
import type { Language } from '$lib/stores/language';

/** Clé d'un domaine : nom de l'API en minuscules, blancs réduits, apostrophe droite (l'API écrit « l'Environnement »). */
function cle(nom: string): string {
  return nom.trim().replace(/\s+/g, ' ').replace(/’/g, "'").toLowerCase();
}

/** Le nom court d'un domaine dans la langue de l'interface ; '' sans nom. */
export function nomCourtDuDomaine(nom: string | null | undefined, langue: Language): string {
  return nomCategorie(nom, langue);
}

/**
 * Les 14 domaines canoniques (migration 007), nom de l'API en minuscules : la
 * liste FERMÉE par laquelle la colonne de filtres reconnaît un domaine, même
 * quand la recherche n'y trouve rien (src/routes/search/resultats.ts). Leur
 * ordre ici ne compte pas : `ORDRE_DES_DOMAINES` le fixe.
 */
const DOMAINES_CANONIQUES: readonly string[] = [
  'droit constitutionnel',
  'droit administratif',
  'fonction publique',
  'droit international',
  'finances publiques et fiscalité',
  'droit pénal et procédure pénale',
  'droit civil et procédure civile',
  'droit des personnes, de la famille et état civil',
  'droit du travail et sécurité sociale',
  'droit des affaires, banque et ohada',
  'droit foncier et domanial',
  "droit de l'environnement et des ressources naturelles",
  'santé publique et sécurité sanitaire',
  'éducation, recherche, culture et médias',
];

/**
 * Les 14 domaines dans l'ORDRE DE L'ACCUEIL : l'ordre provisoire de Q2 A
 * (travail, pénal, famille, foncier, affaires…), que tient
 * `ordonnerLesDomaines` ($lib/categories).
 *
 * La colonne suivait l'ordre de `GET /categories` (Constitution,
 * administration, fonction publique, traités…), celui de la maquette
 * recherche-p7a : un même domaine changeait de rang entre la liste de
 * l'accueil et la colonne de /search, et l'œil devait le chercher deux fois.
 * Une seule source pour l'ordre, comme pour le nom : quand des statistiques
 * de consultation remplaceront l'ordre provisoire, les deux listes suivront
 * ensemble.
 *
 * Un ordre FIXE, toujours : trier par effectif ferait sauter chaque case
 * d'une ligne à l'autre au moindre filtre coché.
 */
export const ORDRE_DES_DOMAINES: readonly string[] = ordonnerLesDomaines(
  DOMAINES_CANONIQUES.map((name) => ({ name })),
).map(({ name }) => name);

/** La clé d'un nom de domaine dans `ORDRE_DES_DOMAINES`. */
export function cleDuDomaine(nom: string): string {
  return cle(nom);
}
