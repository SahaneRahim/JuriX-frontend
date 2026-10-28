/**
 * Noms et descriptions des catégories, dans la langue de l'interface.
 *
 * POURQUOI. Les catégories vivent dans la table `categories` du backend, en
 * français : le site passé en anglais affichait « Droit Constitutionnel —
 * Constitution, institutions et élections » au milieu d'une page traduite.
 *
 * La liste est FERMÉE : ce sont les 14 domaines canoniques de
 * `app/services/legal_domain_classifier.CANONICAL_DOMAINS`, gravés par la
 * migration 007 (index unique sur `lower(name)`, assertion sur leur nombre).
 * Traduire côté client, par le nom, est donc aussi sûr qu'une colonne
 * `name_en` — sans migration ni paramètre de langue sur l'API.
 *
 * Un nom inconnu (catégorie ajoutée en base sans être ajoutée ici) revient
 * tel quel : mieux vaut du français exact qu'un trou.
 *
 * L'icône de chaque domaine est choisie ici aussi (`iconeCategorie`, en fin
 * de fichier) : même liste fermée, même source de vérité.
 */

import type { NomIcone } from './icones';
import type { Language } from './stores/language';

interface Traduction {
  name: string;
  description: string;
}

/** Clé : nom français en minuscules, comme l'index unique du backend. */
const EN: Record<string, Traduction> = {
  'droit constitutionnel': {
    name: 'Constitutional Law',
    description: 'Constitution, institutions, elections and public powers',
  },
  'droit administratif': {
    name: 'Administrative Law',
    description: 'Organisation and operation of public services and local authorities',
  },
  'fonction publique': {
    name: 'Civil Service',
    description: 'Status of public servants, careers, appointments and honours',
  },
  'droit international': {
    name: 'International Law',
    description: 'Ratified treaties, conventions and bilateral agreements',
  },
  'finances publiques et fiscalité': {
    name: 'Public Finance and Taxation',
    description: 'State budget, taxation, customs, public loans and financing',
  },
  'droit pénal et procédure pénale': {
    name: 'Criminal Law and Criminal Procedure',
    description: 'Offences, penalties, prosecutions and military justice',
  },
  'droit civil et procédure civile': {
    name: 'Civil Law and Civil Procedure',
    description: 'Persons, obligations, contracts, civil proceedings and enforcement',
  },
  'droit des personnes, de la famille et état civil': {
    name: 'Law of Persons, Family and Civil Status',
    description: 'Marriage, filiation, succession, civil status, national ID and nationality',
  },
  'droit du travail et sécurité sociale': {
    name: 'Labour Law and Social Security',
    description: 'Employment relations, collective agreements, trade unions and social security',
  },
  'droit des affaires, banque et ohada': {
    name: 'Business Law, Banking and OHADA',
    description: 'Companies, commerce, banking secrecy, public procurement and OHADA law',
  },
  'droit foncier et domanial': {
    name: 'Land and State Property Law',
    description: 'State domain, land titles, expropriation and cadastre',
  },
  "droit de l'environnement et des ressources naturelles": {
    name: 'Environmental and Natural Resources Law',
    description: 'Environment, mining, forests, water, hydrocarbons and biodiversity',
  },
  'santé publique et sécurité sanitaire': {
    name: 'Public Health and Health Safety',
    description: 'Public health, medicine, pharmacy, health safety and radiological security',
  },
  'éducation, recherche, culture et médias': {
    name: 'Education, Research, Culture and Media',
    description: 'Education, universities, research, culture, heritage, media and official languages',
  },
};

/** Nombre de domaines canoniques, pour le test de couverture. */
export const NOMBRE_DE_DOMAINES = 14;

function cle(nom: string): string {
  return nom.trim().toLowerCase();
}

/** Le nom d'une catégorie dans la langue demandée, ou le nom d'origine. */
export function nomCategorie(nom: string | null | undefined, lang: Language): string {
  if (!nom) return '';
  if (lang !== 'en') return nom;
  return EN[cle(nom)]?.name ?? nom;
}

/**
 * La description d'une catégorie dans la langue demandée.
 *
 * En anglais, la traduction prime sur la description en base ; à défaut de
 * traduction, la description en base est rendue telle quelle.
 */
export function descriptionCategorie(
  nom: string | null | undefined,
  description: string | null | undefined,
  lang: Language,
): string {
  if (lang === 'en' && nom) {
    const t = EN[cle(nom)];
    if (t) return t.description;
  }
  return description ?? '';
}

/** Exposé pour le test de couverture uniquement. */
export const _domainesTraduits = (): string[] => Object.keys(EN);

/**
 * Icône d'un domaine juridique, une par domaine, toutes différentes.
 *
 * POURQUOI UNE TABLE DE MOTS ET NON LE NOM EXACT. La page d'une catégorie
 * passe le nom TRADUIT (`nomCategorie`), l'accueil le nom français de l'API :
 * les deux doivent donner la même icône. Les mots sont comparés en entier,
 * sans accents ni casse : une recherche de sous-chaîne prenait « publique »
 * dans trois noms (Finances, Fonction, Santé) et « civil » dans « État
 * Civil » comme dans « Civil Service ».
 *
 * L'ORDRE COMPTE : la première règle qui reconnaît un mot du nom l'emporte.
 * « Fonction Publique » (« Civil Service ») et le droit des personnes (« État
 * Civil », « Civil Status ») passent donc avant le droit civil.
 *
 * Choix des icônes, comparées sur une planche de contact (20, 24 et 44 px,
 * clair et sombre) : la plus reconnaissable de chaque domaine, et aucune qui
 * ressemble à une autre dans la grille de l'accueil.
 */
const ICONES_DES_DOMAINES: ReadonlyArray<{ mots: readonly string[]; icone: NomIcone }> = [
  // Badge d'agent : statut, carrière, nominations. Avant tout « civil ».
  { mots: ['fonction publique', 'agents publics', 'civil service'], icone: 'id-card-lanyard' },
  // Deux parents et un enfant : filiation, mariage, état civil, nationalité.
  {
    mots: ['personnes', 'famille', 'état civil', 'nationalité', 'persons', 'family', 'civil status'],
    icone: 'user-round-group',
  },
  // La balance : obligations, contrats, procès entre particuliers.
  { mots: ['droit civil', 'procédure civile', 'civil law', 'civil procedure'], icone: 'scale' },
  // Le maillet du juge qui prononce la peine.
  { mots: ['pénal', 'pénale', 'infractions', 'criminal'], icone: 'gavel' },
  // Le bâtiment à colonnes des institutions : Constitution, élections.
  { mots: ['constitutionnel', 'constitution', 'constitutional'], icone: 'landmark' },
  // Le tampon de l'administration : actes, services publics, collectivités.
  { mots: ['administratif', 'administrative'], icone: 'stamp' },
  // Le globe et ses méridiens : traités, conventions, accords.
  { mots: ['international', 'traités'], icone: 'globe' },
  // Les pièces : budget de l'État, impôts, douanes, emprunts.
  { mots: ['finances', 'fiscalité', 'impôts', 'douanes', 'finance', 'taxation'], icone: 'coins' },
  // Le casque du travailleur : relations de travail, syndicats, prévoyance.
  { mots: ['travail', 'sécurité sociale', 'syndicats', 'labour', 'labor', 'social security'], icone: 'hard-hat' },
  // La mallette d'affaires : sociétés, commerce, banque, OHADA.
  { mots: ['affaires', 'ohada', 'banque', 'commerce', 'sociétés', 'business', 'banking'], icone: 'briefcase-business' },
  // Une parcelle bornée : titres fonciers, domaine de l'État, cadastre.
  { mots: ['foncier', 'domanial', 'cadastre', 'land', 'state property'], icone: 'land-plot' },
  // La feuille : environnement, forêts, mines, eau, ressources naturelles.
  {
    mots: ['environnement', 'ressources naturelles', 'environmental', 'environment', 'natural resources'],
    icone: 'leaf',
  },
  // Le cœur et son pouls : santé publique, médecine, sécurité sanitaire.
  { mots: ['santé', 'sanitaire', 'médecine', 'health'], icone: 'heart-pulse' },
  // La toque de diplômé : enseignement, universités, recherche, culture.
  {
    mots: ['éducation', 'enseignement', 'recherche', 'culture', 'médias', 'research', 'media'],
    icone: 'graduation-cap',
  },
];

/** Icône d'un nom qu'aucune règle ne reconnaît : un texte juridique. */
export const ICONE_DOMAINE_INCONNU: NomIcone = 'scroll-text';

/**
 * Forme comparable d'un nom ou d'un mot : sans accents, en minuscules, chaque
 * suite de signes (espaces, virgules, apostrophes droites ou typographiques)
 * réduite à une espace, et une espace à chaque bout pour ne trouver que des
 * mots entiers (« land » ne se trouve pas dans « island »).
 */
function formeComparable(texte: string): string {
  const mots = texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return ` ${mots} `;
}

const REGLES = ICONES_DES_DOMAINES.map(({ mots, icone }) => ({
  mots: mots.map(formeComparable),
  icone,
}));

/**
 * L'icône du domaine `nom`, en français (API) ou en anglais (`nomCategorie`),
 * insensible aux accents et à la casse ; `ICONE_DOMAINE_INCONNU` sinon.
 */
export function iconeCategorie(nom: string | null | undefined): NomIcone {
  const texte = formeComparable(nom ?? '');
  return REGLES.find(({ mots }) => mots.some((mot) => texte.includes(mot)))?.icone ?? ICONE_DOMAINE_INCONNU;
}
