/**
 * Les 14 domaines juridiques : noms, descriptions, textes phares, ordre de
 * l'accueil et icône, dans la langue de l'interface.
 *
 * POURQUOI. Les catégories vivent dans la table `categories` du backend, en
 * français et sous leur nom long (« Droit des Personnes, de la Famille et
 * État Civil ») : le site passé en anglais affichait ce nom au milieu d'une
 * page traduite, et sur téléphone il passait sur deux lignes.
 *
 * La liste est FERMÉE : ce sont les 14 domaines canoniques de
 * `app/services/legal_domain_classifier.CANONICAL_DOMAINS`, gravés par la
 * migration 007 (index unique sur `lower(name)`, assertion sur leur nombre).
 * Traduire et raccourcir côté client, par le nom, est donc aussi sûr qu'une
 * colonne de plus, sans migration ni paramètre de langue sur l'API.
 *
 * NOMS COURTS (proposition Q2, variante A). `nomCategorie` rend un nom court,
 * en casse de phrase, le mot distinctif en tête (« Pénal et procédure
 * pénale »), en français comme en anglais. Toutes les pages passent par lui
 * (accueil, h1 et titre d'une page de domaine, fil d'Ariane d'un texte,
 * filtres de la recherche et des listes) : un domaine porte le même nom
 * partout. Le nom complet reste disponible (`nomCompletCategorie`).
 *
 * LARGEUR DES NOMS ANGLAIS. Sur l'accueil, le nom tient sur une ligne entre
 * l'icône et le chevron : 226 px de texte à 360 px de large (16 px demi-gras),
 * la largeur d'environ 37 % des téléphones au Cameroun. Les noms anglais sont
 * donc mesurés (Chromium, Inter, le 29/10/2026) : 222 px au plus.
 * « Administration and local authorities » (274 px) passait sur deux lignes
 * à 390 px, et sa ligne faisait 88 px au lieu de 64 : « councils » est le
 * mot des textes camerounais pour les communes. Les noms à trois termes
 * s'écrivent en liste, sans « and » (« Business, banking, OHADA ») : avec
 * lui, ils faisaient de 224 à 251 px. Les noms français sont
 * ceux de la proposition ; deux dépassent encore à 360 px (« Administration
 * et collectivités », 230 px, et « Environnement, mines et forêts », 241 px)
 * et passent alors à la ligne, jamais coupés ; à 390 px, tous tiennent.
 *
 * Un nom inconnu (catégorie ajoutée en base sans être ajoutée ici) revient
 * tel quel : mieux vaut du français exact qu'un trou.
 *
 * L'icône de chaque domaine est choisie ici aussi (`iconeCategorie`, en fin
 * de fichier) : même liste fermée, même source de vérité.
 */

import type { NomIcone } from './icones';
import type { Language } from './stores/language';

/**
 * Les deux variantes d'une ligne de textes phares, par largeur d'écran.
 *
 * La longue n'apparaît qu'à partir de xl : à 1 024 px, les deux colonnes ne
 * laissent que 362 px de texte, et les lignes longues vont jusqu'à 380 px en
 * 14 px ; elles s'arrêtaient au milieu d'un mot (« …justice militai… »).
 */
export interface TextesPhares {
  /** Une colonne, ou deux colonnes étroites (sous xl) : 35 caractères environ, 240 px au plus. */
  court: string;
  /** Deux colonnes larges (à partir de xl, 474 px de texte) : jusqu'à 60 caractères. */
  long: string;
}

interface Domaine {
  /** Nom court affiché partout (Q2 A). */
  court: Record<Language, string>;
  /** Nom complet en anglais : la traduction du nom en base. */
  completEn: string;
  /** Description en anglais ; la française vient de la base. */
  descriptionEn: string;
  /**
   * Textes phares cités sous le nom, sur l'accueil.
   *
   * VÉRIFIÉS DANS LA BASE le 28/10/2026 (jurix_dev, lecture seule, requêtes
   * et résultats dans data/ux-front/accueil/verif/ du dépôt backend) :
   * chaque texte cité existe, publié, DANS CE DOMAINE. Une ligne qui
   * nommerait un texte absent du domaine promettrait ce que la page du
   * domaine ne montre pas. À revérifier si un texte phare change de domaine
   * ou disparaît du corpus.
   */
  phares: Record<Language, TextesPhares>;
}

/** Espace insécable : avant le deux-points français, le signe reste sur sa ligne. */
const INSECABLE = '\u00a0';

/** Clé : nom français en minuscules, comme l'index unique du backend. */
const DOMAINES: Record<string, Domaine> = {
  'droit constitutionnel': {
    court: { fr: 'Constitution et institutions', en: 'Constitution and institutions' },
    completEn: 'Constitutional Law',
    descriptionEn: 'Constitution, institutions, elections and public powers',
    // Loi n° 96/06 (révision de la Constitution), loi n° 2012/001 (Code
    // électoral), loi n° 2004/004 (Conseil constitutionnel).
    phares: {
      fr: { court: 'Constitution, Code électoral', long: 'Constitution, Code électoral, Conseil constitutionnel' },
      en: { court: 'Constitution, Electoral Code', long: 'Constitution, Electoral Code, Constitutional Council' },
    },
  },
  'droit administratif': {
    // « councils » : les communes, dans l'anglais des textes camerounais (voir
    // « Largeur des noms anglais », en tête de fichier).
    court: { fr: 'Administration et collectivités', en: 'Administration and councils' },
    completEn: 'Administrative Law',
    descriptionEn: 'Organisation and operation of public services and local authorities',
    // Loi n° 2019/024 portant Code général des collectivités territoriales
    // décentralisées.
    phares: {
      fr: {
        court: 'Collectivités territoriales (2019)',
        long: 'Code général des collectivités territoriales décentralisées',
      },
      en: {
        court: 'Regional and local authorities (2019)',
        long: 'General Code of Regional and Local Authorities',
      },
    },
  },
  'fonction publique': {
    court: { fr: 'Fonction publique', en: 'Civil service' },
    completEn: 'Civil Service',
    descriptionEn: 'Status of public servants, careers, appointments and honours',
    // Décret n° 94/199 (Statut général de la fonction publique de l'État),
    // loi n° 2019/007 (régime des ordres nationaux).
    phares: {
      fr: { court: 'Statut général, ordres nationaux', long: 'Statut général de la fonction publique, ordres nationaux' },
      en: { court: 'General Statute, national orders', long: 'General Statute of the Civil Service, national orders' },
    },
  },
  'droit international': {
    court: { fr: 'Traités et accords', en: 'Treaties and agreements' },
    completEn: 'International Law',
    descriptionEn: 'Ratified treaties, conventions and bilateral agreements',
    // 149 textes de ratification dans le domaine ; Code CIMA des assurances
    // (CIMA-CODE-2019).
    phares: {
      fr: { court: 'Traités ratifiés, Code CIMA', long: 'Traités ratifiés, Code CIMA des assurances' },
      en: { court: 'Ratified treaties, CIMA Code', long: 'Ratified treaties, CIMA Insurance Code' },
    },
  },
  'finances publiques et fiscalité': {
    court: { fr: 'Finances publiques et impôts', en: 'Public finance and taxes' },
    completEn: 'Public Finance and Taxation',
    descriptionEn: 'State budget, taxation, customs, public loans and financing',
    // Lois de finances 2015 à 2025, loi n° 2018/012 (régime financier de
    // l'État et des autres entités publiques).
    phares: {
      fr: { court: 'Lois de finances, régime financier', long: 'Lois de finances, régime financier de l’État' },
      en: { court: 'Finance laws, financial regime', long: 'Finance laws, State financial regime' },
    },
  },
  'droit pénal et procédure pénale': {
    court: { fr: 'Pénal et procédure pénale', en: 'Criminal law and procedure' },
    completEn: 'Criminal Law and Criminal Procedure',
    descriptionEn: 'Offences, penalties, prosecutions and military justice',
    // Loi n° 2016/007 (Code pénal), loi n° 2005/007 (Code de procédure
    // pénale), loi n° 2017/012 (Code de justice militaire).
    phares: {
      fr: { court: 'Code pénal, procédure pénale', long: 'Code pénal, Code de procédure pénale, justice militaire' },
      en: { court: 'Penal Code, criminal procedure', long: 'Penal Code, Criminal Procedure Code, military justice' },
    },
  },
  'droit civil et procédure civile': {
    court: { fr: 'Civil et procédure civile', en: 'Civil law and procedure' },
    completEn: 'Civil Law and Civil Procedure',
    descriptionEn: 'Persons, obligations, contracts, civil proceedings and enforcement',
    // Code civil annoté (CODE-CIVIL), Acte uniforme OHADA sur les voies
    // d'exécution (OHADA-AUPSRVE-2023), tous deux rangés dans ce domaine.
    phares: {
      fr: { court: 'Code civil, voies d’exécution', long: 'Code civil, voies d’exécution (OHADA)' },
      en: { court: 'Civil Code, enforcement', long: 'Civil Code, enforcement procedures (OHADA)' },
    },
  },
  'droit des personnes, de la famille et état civil': {
    court: { fr: 'Famille et état civil', en: 'Family and civil status' },
    completEn: 'Law of Persons, Family and Civil Status',
    descriptionEn: 'Marriage, filiation, succession, civil status, national ID and nationality',
    // Ordonnance n° 81/002 (état civil), loi n° 1968-LF-3 (Code de la
    // nationalité).
    phares: {
      fr: { court: 'État civil, Code de la nationalité', long: 'État civil (ordonnance de 1981), Code de la nationalité' },
      en: { court: 'Civil status, Nationality Code', long: 'Civil status (1981 ordinance), Nationality Code' },
    },
  },
  'droit du travail et sécurité sociale': {
    court: { fr: 'Travail et sécurité sociale', en: 'Labour and social security' },
    completEn: 'Labour Law and Social Security',
    descriptionEn: 'Employment relations, collective agreements, trade unions and social security',
    // Loi n° 92/007 (Code du travail), loi n° 69/LF/18 (pensions de
    // vieillesse, d'invalidité et de décès).
    phares: {
      fr: { court: 'Code du travail, pensions', long: 'Code du travail, pensions de vieillesse et d’invalidité' },
      en: { court: 'Labour Code, pensions', long: 'Labour Code, old-age and disability pensions' },
    },
  },
  'droit des affaires, banque et ohada': {
    court: { fr: 'Affaires, banque et OHADA', en: 'Business, banking, OHADA' },
    completEn: 'Business Law, Banking and OHADA',
    descriptionEn: 'Companies, commerce, banking secrecy, public procurement and OHADA law',
    // Actes uniformes OHADA : sociétés commerciales (AUSCGIE-2014), droit
    // commercial général (AUDCG-2010), sûretés (AUS-2010).
    phares: {
      fr: { court: 'Actes uniformes OHADA, sûretés', long: `Actes uniformes OHADA${INSECABLE}: sociétés, commerce, sûretés` },
      en: { court: 'OHADA Uniform Acts, securities', long: 'OHADA Uniform Acts: companies, commerce, securities' },
    },
  },
  'droit foncier et domanial': {
    court: { fr: 'Foncier et domaine de l’État', en: 'Land and State property' },
    completEn: 'Land and State Property Law',
    descriptionEn: 'State domain, land titles, expropriation and cadastre',
    // Ordonnances n° 74/1 (régime foncier) et 74/2 (régime domanial),
    // décret n° 76/165 (titre foncier).
    phares: {
      fr: { court: 'Régime foncier, titre foncier', long: 'Régimes foncier et domanial (1974), titre foncier' },
      en: { court: 'Land tenure, land titles', long: 'Land tenure and State lands (1974), land titles' },
    },
  },
  "droit de l'environnement et des ressources naturelles": {
    court: { fr: 'Environnement, mines et forêts', en: 'Environment, mines, forests' },
    completEn: 'Environmental and Natural Resources Law',
    descriptionEn: 'Environment, mining, forests, water, hydrocarbons and biodiversity',
    // Loi n° 2023/014 (Code minier), loi n° 2024/008 (forêts et faune), loi
    // n° 2019/008 (Code pétrolier).
    phares: {
      fr: { court: 'Code minier, forêts et faune', long: 'Code minier, forêts et faune, Code pétrolier' },
      en: { court: 'Mining Code, forests and wildlife', long: 'Mining Code, forests and wildlife, Petroleum Code' },
    },
  },
  'santé publique et sécurité sanitaire': {
    court: { fr: 'Santé publique', en: 'Public health' },
    completEn: 'Public Health and Health Safety',
    descriptionEn: 'Public health, medicine, pharmacy, health safety and radiological security',
    // Loi n° 96/03 (loi-cadre dans le domaine de la santé), loi n° 2018/020
    // (sécurité sanitaire des aliments).
    phares: {
      fr: { court: 'Loi-cadre sur la santé (1996)', long: 'Loi-cadre sur la santé, sécurité sanitaire des aliments' },
      en: { court: 'Health framework law (1996)', long: 'Health framework law, food safety' },
    },
  },
  'éducation, recherche, culture et médias': {
    court: { fr: 'Éducation, culture et médias', en: 'Education, culture, media' },
    completEn: 'Education, Research, Culture and Media',
    descriptionEn: 'Education, universities, research, culture, heritage, media and official languages',
    // Loi n° 98/004 (orientation de l'éducation), loi n° 2023/007
    // (orientation de l'enseignement supérieur).
    phares: {
      fr: { court: 'Orientation de l’éducation', long: 'Orientation de l’éducation, enseignement supérieur' },
      en: { court: 'Education guidelines law', long: 'Education guidelines law, higher education' },
    },
  },
};

/** Nombre de domaines canoniques, pour le test de couverture. */
export const NOMBRE_DE_DOMAINES = 14;

/**
 * Ordre des domaines sur l'accueil : PROVISOIRE (Q2 A), en attendant des
 * statistiques de consultation, qui n'existent pas encore. D'abord les
 * domaines de la vie courante (travail, pénal, famille, foncier, affaires,
 * civil, impôts, Constitution), puis les autres. L'ordre de l'API
 * (`display_order`, puis l'identifiant) mettait la Constitution et
 * l'administration en tête et le droit du travail en neuvième position.
 */
const ORDRE_PROVISOIRE: readonly string[] = [
  'droit du travail et sécurité sociale',
  'droit pénal et procédure pénale',
  'droit des personnes, de la famille et état civil',
  'droit foncier et domanial',
  'droit des affaires, banque et ohada',
  'droit civil et procédure civile',
  'finances publiques et fiscalité',
  'droit constitutionnel',
  'droit administratif',
  'fonction publique',
  'droit international',
  "droit de l'environnement et des ressources naturelles",
  'santé publique et sécurité sanitaire',
  'éducation, recherche, culture et médias',
];

/**
 * Clé de la table : minuscules, espaces réduites, apostrophe droite. Le nom
 * vient de la base, qui écrit « l'Environnement » avec une apostrophe
 * droite ; une saisie d'administration pourrait écrire l'autre.
 */
function cle(nom: string): string {
  return nom.trim().replace(/\s+/g, ' ').replace(/’/g, "'").toLowerCase();
}

function domaine(nom: string | null | undefined): Domaine | undefined {
  return nom ? DOMAINES[cle(nom)] : undefined;
}

/**
 * Le nom COURT d'un domaine dans la langue demandée (Q2 A), ou le nom
 * d'origine s'il est inconnu. C'est le nom affiché partout, pour qu'un
 * domaine s'appelle de la même façon sur l'accueil, dans le h1 de sa page et
 * dans le fil d'Ariane d'un texte.
 */
export function nomCategorie(nom: string | null | undefined, lang: Language): string {
  if (!nom) return '';
  return domaine(nom)?.court[lang] ?? nom;
}

/**
 * Le nom COMPLET d'un domaine : tel qu'en base en français, sa traduction en
 * anglais. Pour qui a besoin de l'intitulé officiel de la classification
 * (un formulaire d'administration, une description pour les moteurs).
 */
export function nomCompletCategorie(nom: string | null | undefined, lang: Language): string {
  if (!nom) return '';
  if (lang !== 'en') return nom;
  return domaine(nom)?.completEn ?? nom;
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
  if (lang === 'en') {
    const d = domaine(nom);
    if (d) return d.descriptionEn;
  }
  return description ?? '';
}

/**
 * Les textes phares d'un domaine, vérifiés en base (voir `Domaine.phares`),
 * ou `null` pour un domaine inconnu : rien n'a été vérifié pour lui, l'accueil
 * affiche alors la description de l'API.
 */
export function pharesCategorie(nom: string | null | undefined, lang: Language): TextesPhares | null {
  return domaine(nom)?.phares[lang] ?? null;
}

/**
 * Les domaines dans l'ordre provisoire de l'accueil. Un domaine inconnu de
 * cette table passe après les 14, dans l'ordre où l'API l'a donné ; la liste
 * d'origine n'est pas modifiée.
 */
export function ordonnerLesDomaines<T extends { name: string }>(categories: readonly T[]): T[] {
  const rang = (c: T) => {
    const i = ORDRE_PROVISOIRE.indexOf(cle(c.name));
    return i === -1 ? ORDRE_PROVISOIRE.length : i;
  };
  return categories
    .map((categorie, position) => ({ categorie, position }))
    .sort((a, b) => rang(a.categorie) - rang(b.categorie) || a.position - b.position)
    .map(({ categorie }) => categorie);
}

/**
 * Le nombre de textes publiés du corpus, lu dans la réponse de `GET /corpus`
 * (`ChiffresDuCorpus.textes`) que le `load` de l'accueil passe à la page, ou
 * `null` : route absente (ancienne API), panne, ou valeur qui ne se lit pas.
 *
 * Il sert au sous-titre de l'accueil (« Cherchez dans 2 275 textes
 * officiels », Q1 A) et à la ligne « Tous les textes ». Sur `null`, ces deux
 * phrases s'écrivent sans chiffre : un nombre écrit en dur vieillirait en
 * silence, et la somme des domaines ne compterait pas les textes qui n'en
 * ont pas. Au moins 2 : la phrase est au pluriel.
 */
export function nombreDeTextesDuCorpus(corpus: unknown): number | null {
  if (typeof corpus !== 'object' || corpus === null) return null;
  const textes = (corpus as { textes?: unknown }).textes;
  return typeof textes === 'number' && Number.isSafeInteger(textes) && textes > 1 ? textes : null;
}

/** Exposé pour les tests de couverture uniquement. */
export const _domainesTraduits = (): string[] => Object.keys(DOMAINES);

/** Exposé pour les tests de couverture uniquement. */
export const _ordreProvisoire = (): readonly string[] => ORDRE_PROVISOIRE;

/**
 * Icône d'un domaine juridique, une par domaine, toutes différentes.
 *
 * POURQUOI UNE TABLE DE MOTS ET NON LE NOM EXACT. La page d'une catégorie
 * passe le nom de l'API, d'autres écrans le nom court (`nomCategorie`), en
 * français ou en anglais : tous doivent donner la même icône. Les mots sont
 * comparés en entier, sans accents ni casse : une recherche de sous-chaîne
 * prenait « publique » dans trois noms (Finances, Fonction, Santé) et
 * « civil » dans « État Civil » comme dans « Civil Service ».
 *
 * L'ORDRE COMPTE : la première règle qui reconnaît un mot du nom l'emporte.
 * « Fonction Publique » (« Civil service ») et le droit des personnes (« État
 * Civil », « Civil status ») passent donc avant le droit civil.
 *
 * Choix des icônes, comparées sur une planche de contact (20, 24 et 44 px,
 * clair et sombre) : la plus reconnaissable de chaque domaine, et aucune qui
 * ressemble à une autre dans la liste de l'accueil.
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
  // « administration » : le nom court (« Administration et collectivités »).
  { mots: ['administratif', 'administrative', 'administration'], icone: 'stamp' },
  // Le globe et ses méridiens : traités, conventions, accords. « treaties » :
  // le nom court anglais (« Treaties and agreements »).
  { mots: ['international', 'traités', 'treaties'], icone: 'globe' },
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
    .replace(/[\u0300-\u036f]/g, '') // diacritiques combinants, détachés par NFD
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
 * L'icône du domaine `nom` : nom de l'API, nom complet ou nom court, en
 * français ou en anglais, insensible aux accents et à la casse ;
 * `ICONE_DOMAINE_INCONNU` sinon.
 */
export function iconeCategorie(nom: string | null | undefined): NomIcone {
  const texte = formeComparable(nom ?? '');
  return REGLES.find(({ mots }) => mots.some((mot) => texte.includes(mot)))?.icone ?? ICONE_DOMAINE_INCONNU;
}
