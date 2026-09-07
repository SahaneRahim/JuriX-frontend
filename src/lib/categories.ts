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
 */

import type { Language } from './stores/language';

interface Traduction {
  name: string;
  description: string;
}

/** Clé : nom français en minuscules, comme l'index unique du backend. */
const EN: Record<string, Traduction> = {
  'droit constitutionnel': {
    name: 'Constitutional Law',
    description: 'Constitution, institutions and elections',
  },
  'droit administratif': {
    name: 'Administrative Law',
    description: 'Organisation and operation of public services',
  },
  'fonction publique': {
    name: 'Civil Service',
    description: 'Status of public servants, careers and honours',
  },
  'droit international': {
    name: 'International Law',
    description: 'Ratified treaties, conventions and agreements',
  },
  'finances publiques et fiscalité': {
    name: 'Public Finance and Taxation',
    description: 'State budget, taxes, customs and borrowing',
  },
  'droit pénal': {
    name: 'Criminal Law',
    description: 'Offences and penalties',
  },
  'procédure pénale': {
    name: 'Criminal Procedure',
    description: 'Investigation, prosecution and judgment in criminal matters',
  },
  'droit civil': {
    name: 'Civil Law',
    description: 'Persons, property, obligations and contracts',
  },
  'procédure civile': {
    name: 'Civil Procedure',
    description: 'Civil proceedings and enforcement',
  },
  'droit de la famille': {
    name: 'Family Law',
    description: 'Marriage, filiation, succession and civil status',
  },
  'droit du travail et sécurité sociale': {
    name: 'Labour Law and Social Security',
    description: 'Employment relations and social welfare',
  },
  'droit des affaires et ohada': {
    name: 'Business Law and OHADA',
    description: 'Companies, commerce and OHADA uniform acts',
  },
  'droit foncier et domanial': {
    name: 'Land and State Property Law',
    description: 'State domain, land titles and expropriation',
  },
  "droit de l'environnement et des ressources naturelles": {
    name: 'Environmental and Natural Resources Law',
    description: 'Environment, mining, forests, water and hydrocarbons',
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
