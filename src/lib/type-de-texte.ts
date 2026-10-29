/**
 * Type d'un texte (loi, décret, ordonnance…) tel que l'affichent la liste des
 * documents (/laws), la fiche d'un texte, la page d'une catégorie et la
 * recherche : un libellé traduit et une icône, dans le badge du guide (§ 4.8).
 *
 * POURQUOI UN MODULE. Le même type s'affichait de trois façons : « décret »
 * et « arrêté » bruts, en minuscules et sans icône sur /laws (la valeur de
 * l'API, jamais traduite) ; « LOI / DÉCRET » en capitales mono sur la fiche,
 * un libellé FIXE qui annonçait aussi un arrêté ou une ordonnance comme
 * « Loi / Décret » ; « Décret », « Loi », « Texte » capitalisés avec une icône
 * sur /search. Une seule table, lue par les quatre pages.
 *
 * Le type vient de l'API (`LawType`, normalisé en minuscules à l'ingestion).
 * La Constitution est une `loi` pour l'API : seul le PREMIER mot de son titre
 * la distingue (« Loi … portant révision de la Constitution » reste une loi).
 * Texte suprême, elle garde seule le badge inversé (d'emphase).
 *
 * Icônes : le parchemin pour la loi, et non le maillet, qui est celui du droit
 * pénal dans la ligne des domaines (CategoryIcon) ; l'acte signé pour le
 * décret ; la pile de documents, celle de « Tous les textes », pour les types
 * moins courants et l'inconnu.
 */
import type { NomIcone } from './icones';

export interface TypeDeTexte {
  /** Clé de traduction du libellé (`badge.*`, src/lib/stores/language.ts). */
  cle: string;
  icone: NomIcone;
  /** Badge inversé (la Constitution). */
  emphase: boolean;
}

const TYPES: Readonly<Record<string, { cle: string; icone: NomIcone }>> = {
  loi: { cle: 'badge.law', icone: 'scroll-text' },
  décret: { cle: 'badge.decree', icone: 'file-pen-line' },
  ordonnance: { cle: 'badge.ordinance', icone: 'file-text' },
  arrêté: { cle: 'badge.arrete', icone: 'files' },
  circulaire: { cle: 'badge.circular', icone: 'files' },
  instruction: { cle: 'badge.instruction', icone: 'files' },
  décision: { cle: 'badge.decision', icone: 'files' },
  'acte uniforme': { cle: 'badge.uniformAct', icone: 'files' },
};

/** Le libellé et l'icône du type d'un texte ; « Texte » pour un type inconnu. */
export function typeDeTexte(type: string | null | undefined, titre?: string | null): TypeDeTexte {
  const premierMot = (titre ?? '').trim().split(/\s/)[0].toLowerCase();
  if (premierMot === 'constitution') {
    return { cle: 'badge.constitution', icone: 'landmark', emphase: true };
  }
  const connu = TYPES[(type ?? '').trim().toLowerCase()];
  return connu ? { ...connu, emphase: false } : { cle: 'badge.text', icone: 'files', emphase: false };
}

/**
 * La nature écrite en tête d'un intitulé officiel, sans accents ni casse
 * (« DECRET N° 2013/300 », « decret n° 2013/034 », « Loi-cadre … »), suivie
 * d'une espace, d'un tiret ou de rien : « Loisirs » n'est pas une loi, ni
 * « ordonnance_n_2015_001.pdf » (un nom de fichier) une ordonnance sûre.
 * « Acte uniforme » prend deux mots.
 */
const NATURE_EN_TETE = /^(acte\s+uniforme|loi|decret|ordonnance|arrete|circulaire|instruction|decision)(?=$|[\s\-–])/u;

/** La forme de l'API (`LawType`) de chaque nature lue en tête d'intitulé. */
const NATURE_DE_L_API: Readonly<Record<string, string>> = {
  loi: 'loi',
  decret: 'décret',
  ordonnance: 'ordonnance',
  arrete: 'arrêté',
  circulaire: 'circulaire',
  instruction: 'instruction',
  decision: 'décision',
};

/**
 * Le type d'un texte lu dans le PREMIER MOT de son intitulé officiel, pour
 * les listes qui ne reçoivent que le titre : GET /search/suggest (la palette
 * Ctrl K) ne sert que `id`, `title` et la cote interne, jamais affichée (P2).
 *
 * Ce n'est pas une devinette : un acte se nomme lui-même en tête de son
 * intitulé (« Décret N°2018/9387/CAB/PM du 30 décembre 2018 … »). La palette
 * étiquetait « Loi » chaque texte, décrets et ordonnances compris : un
 * libellé fixe, faux pour la plupart du corpus. Un intitulé qui ne commence
 * par aucune nature connue (« Code civil applicable au Cameroun… », un nom
 * de fichier) donne « Texte », comme un type inconnu ; la Constitution garde
 * son badge (`typeDeTexte`).
 */
export function typeDuTitre(titre: string | null | undefined): TypeDeTexte {
  const tete = (titre ?? '')
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  const m = NATURE_EN_TETE.exec(tete);
  const nature = m ? (m[1].startsWith('acte') ? 'acte uniforme' : NATURE_DE_L_API[m[1]]) : null;
  return typeDeTexte(nature, titre);
}

/** Le badge du guide (§ 4.8), icône comprise (14 px : floue à 12). */
export const BADGE_DE_TYPE =
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium';
/** Couleurs du badge ordinaire. */
export const BADGE_DE_TYPE_NEUTRE =
  'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
/** Couleurs du badge d'emphase (la Constitution). */
export const BADGE_DE_TYPE_EMPHASE =
  'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white';

/** Les classes complètes du badge d'un type. */
export function classesBadgeDeType(type: TypeDeTexte): string {
  return `${BADGE_DE_TYPE} ${type.emphase ? BADGE_DE_TYPE_EMPHASE : BADGE_DE_TYPE_NEUTRE}`;
}
