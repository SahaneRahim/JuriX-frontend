import { describe, expect, it } from 'vitest';
import {
  NOMBRE_DE_DOMAINES,
  _domainesTraduits,
  _ordreProvisoire,
  descriptionCategorie,
  nomCategorie,
  nomCompletCategorie,
  nombreDeTextesDuCorpus,
  ordonnerLesDomaines,
  pharesCategorie,
} from './categories';

/**
 * Les 14 noms canoniques, tels que l'API les sert (table `categories`,
 * migration 007), dans l'ordre provisoire de l'accueil (Q2 A), avec leur nom
 * court français et anglais.
 *
 * Quatre noms anglais ont été raccourcis le 29/10 pour tenir sur une ligne à
 * 360 px (mesures dans l'en-tête de categories.ts) : les noms à trois termes
 * s'écrivent en liste, sans « and », et « councils » remplace « local
 * authorities ». La table suit la source : l'ancienne attente faisait échouer
 * ce test sur un choix délibéré (vérification r2 du 29/10).
 */
const DOMAINES: ReadonlyArray<readonly [string, string, string]> = [
  ['Droit du Travail et Sécurité Sociale', 'Travail et sécurité sociale', 'Labour and social security'],
  ['Droit Pénal et Procédure Pénale', 'Pénal et procédure pénale', 'Criminal law and procedure'],
  ['Droit des Personnes, de la Famille et État Civil', 'Famille et état civil', 'Family and civil status'],
  ['Droit Foncier et Domanial', 'Foncier et domaine de l’État', 'Land and State property'],
  ['Droit des Affaires, Banque et OHADA', 'Affaires, banque et OHADA', 'Business, banking, OHADA'],
  ['Droit Civil et Procédure Civile', 'Civil et procédure civile', 'Civil law and procedure'],
  ['Finances Publiques et Fiscalité', 'Finances publiques et impôts', 'Public finance and taxes'],
  ['Droit Constitutionnel', 'Constitution et institutions', 'Constitution and institutions'],
  ['Droit Administratif', 'Administration et collectivités', 'Administration and councils'],
  ['Fonction Publique', 'Fonction publique', 'Civil service'],
  ['Droit International', 'Traités et accords', 'Treaties and agreements'],
  ["Droit de l'Environnement et des Ressources Naturelles", 'Environnement, mines et forêts', 'Environment, mines, forests'],
  ['Santé Publique et Sécurité Sanitaire', 'Santé publique', 'Public health'],
  ['Éducation, Recherche, Culture et Médias', 'Éducation, culture et médias', 'Education, culture, media'],
];

/**
 * Ce qui signe le français dans une chaîne anglaise : la même idée que le
 * contrôle de tests/e2e/navigation/monochrome.spec.ts, qui échoue sur tout
 * reste de français affiché dans l'interface anglaise.
 */
const ACCENTS = /[àâäçéèêëîïôöùûüÿœæ]/i;
const MOTS_FRANCAIS = /(^|[^\p{L}])(le|la|les|des|du|de|et|aux|au|une|pour|avec|sur|dans|loi|lois|texte|textes)([^\p{L}]|$)/iu;

describe('categories : liste fermée', () => {
  it('couvre les 14 domaines canoniques, pas un de plus', () => {
    // La liste est fermée côté backend (migration 007). Un domaine ajouté
    // là-bas sans entrée ici garderait son nom long, en français même dans
    // l'interface anglaise, et sans textes phares.
    expect(_domainesTraduits()).toHaveLength(NOMBRE_DE_DOMAINES);
    expect(DOMAINES).toHaveLength(NOMBRE_DE_DOMAINES);
    expect([..._domainesTraduits()].sort()).toEqual(DOMAINES.map(([nom]) => nom.toLowerCase()).sort());
  });

  it('range chacun des 14 domaines une fois, et rien d’autre, dans l’ordre provisoire', () => {
    expect([..._ordreProvisoire()].sort()).toEqual([..._domainesTraduits()].sort());
    expect(new Set(_ordreProvisoire()).size).toBe(NOMBRE_DE_DOMAINES);
  });
});

describe('nomCategorie : le nom court, partout le même (Q2 A)', () => {
  it('donne le nom court français et anglais de chaque domaine', () => {
    for (const [nom, fr, en] of DOMAINES) {
      expect(nomCategorie(nom, 'fr'), nom).toBe(fr);
      expect(nomCategorie(nom, 'en'), nom).toBe(en);
    }
  });

  it('ignore la casse, les espaces en trop et la forme de l’apostrophe', () => {
    expect(nomCategorie('DROIT PÉNAL ET PROCÉDURE PÉNALE', 'en')).toBe('Criminal law and procedure');
    expect(nomCategorie('  Droit   Pénal et Procédure Pénale ', 'fr')).toBe('Pénal et procédure pénale');
    expect(nomCategorie('Droit de l’Environnement et des Ressources Naturelles', 'fr')).toBe(
      'Environnement, mines et forêts',
    );
  });

  it('rend un nom inconnu tel quel plutôt que rien', () => {
    expect(nomCategorie('Droit Spatial', 'en')).toBe('Droit Spatial');
    expect(nomCategorie('Droit Spatial', 'fr')).toBe('Droit Spatial');
    expect(nomCategorie(null, 'en')).toBe('');
    expect(nomCategorie(undefined, 'fr')).toBe('');
  });

  it('écrit les noms courts en casse de phrase, sans majuscule à chaque mot', () => {
    // « Droit Pénal et Procédure Pénale » : la majuscule à l'anglaise que
    // l'OQLF déconseille. Restent les sigles et l'État (nom propre).
    const majusculesPermises = new Set(['OHADA', 'État', 'State']);
    for (const [, fr, en] of DOMAINES) {
      for (const nom of [fr, en]) {
        const [premier, ...suite] = nom.split(/[\s,]+/).filter(Boolean);
        expect(premier[0], nom).toBe(premier[0].toUpperCase());
        for (const mot of suite) {
          const motSansElision = mot.replace(/^l[’']/, '');
          if (majusculesPermises.has(motSansElision)) continue;
          expect(motSansElision, `${nom} : « ${mot} »`).toBe(motSansElision.toLowerCase());
        }
      }
    }
  });

  it('garde des noms courts : 36 caractères au plus', () => {
    // Plus court que l'ancien nom le plus long (48 caractères), pour tenir sur
    // une ligne à côté de l'icône et du chevron dès 390 px.
    for (const [, fr, en] of DOMAINES) {
      expect(fr.length, fr).toBeLessThanOrEqual(36);
      expect(en.length, en).toBeLessThanOrEqual(36);
    }
  });

  it('n’a aucun reste de français dans les noms anglais', () => {
    for (const [, , en] of DOMAINES) {
      expect(en, en).not.toMatch(ACCENTS);
      expect(en, en).not.toMatch(MOTS_FRANCAIS);
    }
  });
});

describe('nomCompletCategorie : l’intitulé de la classification', () => {
  it('rend le nom en base en français, sa traduction en anglais', () => {
    expect(nomCompletCategorie('Droit Pénal et Procédure Pénale', 'fr')).toBe('Droit Pénal et Procédure Pénale');
    expect(nomCompletCategorie('Droit Pénal et Procédure Pénale', 'en')).toBe('Criminal Law and Criminal Procedure');
    expect(nomCompletCategorie('DROIT PÉNAL ET PROCÉDURE PÉNALE', 'en')).toBe('Criminal Law and Criminal Procedure');
  });

  it('rend un nom inconnu tel quel, et rien pour un nom absent', () => {
    expect(nomCompletCategorie('Droit Spatial', 'en')).toBe('Droit Spatial');
    expect(nomCompletCategorie(null, 'en')).toBe('');
  });
});

describe('descriptionCategorie', () => {
  it('préfère la traduction à la description en base, et retombe dessus sinon', () => {
    expect(descriptionCategorie('Droit Civil et Procédure Civile', 'Personnes, biens…', 'en')).toBe(
      'Persons, obligations, contracts, civil proceedings and enforcement',
    );
    expect(descriptionCategorie('Droit Civil et Procédure Civile', 'Personnes, biens…', 'fr')).toBe('Personnes, biens…');
    expect(descriptionCategorie('Droit Spatial', 'Orbites', 'en')).toBe('Orbites');
    expect(descriptionCategorie('Droit Spatial', null, 'en')).toBe('');
  });
});

describe('pharesCategorie : les textes phares vérifiés en base', () => {
  it('donne une ligne courte et une ligne longue, en français et en anglais, pour chaque domaine', () => {
    for (const [nom] of DOMAINES) {
      for (const langue of ['fr', 'en'] as const) {
        const phares = pharesCategorie(nom, langue);
        expect(phares, `${nom} (${langue})`).not.toBeNull();
        // Courte : une ligne de 14 px entre l'icône et le chevron, à 390 px.
        expect(phares!.court.length, phares!.court).toBeGreaterThan(0);
        expect(phares!.court.length, phares!.court).toBeLessThanOrEqual(38);
        // Longue : une demi-ligne de la liste à deux colonnes, à 1 280 px.
        expect(phares!.long.length, phares!.long).toBeGreaterThanOrEqual(phares!.court.length);
        expect(phares!.long.length, phares!.long).toBeLessThanOrEqual(60);
      }
    }
  });

  it('cite des textes réels du domaine (relevé du 28/10/2026)', () => {
    // Quelques textes vérifiés dans jurix_dev, à leur domaine : le Code du
    // travail (loi n° 92/007) en Travail, le Code civil en Civil, le Code
    // CIMA en International.
    expect(pharesCategorie('Droit du Travail et Sécurité Sociale', 'fr')?.court).toContain('Code du travail');
    expect(pharesCategorie('Droit Civil et Procédure Civile', 'fr')?.court).toContain('Code civil');
    expect(pharesCategorie('Droit International', 'fr')?.long).toContain('Code CIMA');
  });

  it('écrit l’espace insécable avant le deux-points français', () => {
    expect(pharesCategorie('Droit des Affaires, Banque et OHADA', 'fr')?.long).toBe(
      'Actes uniformes OHADA\u00a0: sociétés, commerce, sûretés',
    );
  });

  it('n’a aucun reste de français dans les lignes anglaises', () => {
    for (const [nom] of DOMAINES) {
      const { court, long } = pharesCategorie(nom, 'en')!;
      for (const ligne of [court, long]) {
        expect(ligne, ligne).not.toMatch(ACCENTS);
        expect(ligne, ligne).not.toMatch(MOTS_FRANCAIS);
      }
    }
  });

  it('ne promet rien pour un domaine inconnu ou absent', () => {
    expect(pharesCategorie('Droit Spatial', 'fr')).toBeNull();
    expect(pharesCategorie(null, 'en')).toBeNull();
  });
});

describe('ordonnerLesDomaines : l’ordre provisoire de l’accueil', () => {
  /** Les catégories telles que l'API les rend : par `display_order`, puis par identifiant. */
  const ORDRE_DE_L_API = [
    'Droit Constitutionnel',
    'Droit Administratif',
    'Fonction Publique',
    'Droit International',
    'Finances Publiques et Fiscalité',
    'Droit Pénal et Procédure Pénale',
    'Droit Civil et Procédure Civile',
    'Droit des Personnes, de la Famille et État Civil',
    'Droit du Travail et Sécurité Sociale',
    'Droit des Affaires, Banque et OHADA',
    'Droit Foncier et Domanial',
    "Droit de l'Environnement et des Ressources Naturelles",
    'Santé Publique et Sécurité Sanitaire',
    'Éducation, Recherche, Culture et Médias',
  ].map((name, i) => ({ id: i + 1, name }));

  it('met le travail, le pénal, la famille… en tête, la Constitution en huitième', () => {
    expect(ordonnerLesDomaines(ORDRE_DE_L_API).map((c) => c.name)).toEqual(DOMAINES.map(([nom]) => nom));
  });

  it('place les domaines inconnus à la fin, dans l’ordre de l’API', () => {
    const avecInconnus = [{ id: 90, name: 'Droit Spatial' }, ...ORDRE_DE_L_API, { id: 91, name: 'Droit Maritime' }];
    const ordonnes = ordonnerLesDomaines(avecInconnus);
    expect(ordonnes.slice(-2).map((c) => c.id)).toEqual([90, 91]);
    expect(ordonnes[0].name).toBe('Droit du Travail et Sécurité Sociale');
  });

  it('ne modifie pas la liste reçue, et garde les objets tels quels', () => {
    const copie = ORDRE_DE_L_API.map((c) => ({ ...c }));
    const ordonnes = ordonnerLesDomaines(ORDRE_DE_L_API);
    expect(ORDRE_DE_L_API).toEqual(copie);
    expect(ordonnes).toHaveLength(ORDRE_DE_L_API.length);
    expect(ordonnes).toContain(ORDRE_DE_L_API[0]);
  });

  it('rend une liste vide pour une liste vide', () => {
    expect(ordonnerLesDomaines([])).toEqual([]);
  });
});

describe('nombreDeTextesDuCorpus : le chiffre du sous-titre (Q1 A)', () => {
  it('lit `textes` d’une réponse de GET /corpus', () => {
    expect(nombreDeTextesDuCorpus({ textes: 2275, articles: 27157 })).toBe(2275);
  });

  it('rend null sans réponse, ou pour une valeur qui ne se lit pas', () => {
    // Ancienne API (route absente : le load passe null), panne, autre forme.
    for (const valeur of [null, undefined, 'texte', 2275, [], {}, { textes: '2275' }, { textes: Number.NaN }]) {
      expect(nombreDeTextesDuCorpus(valeur), JSON.stringify(valeur)).toBeNull();
    }
  });

  it('rend null pour un nombre qu’une phrase au pluriel ne peut pas porter', () => {
    for (const textes of [0, 1, -3, 2.5, Number.POSITIVE_INFINITY, 2 ** 60]) {
      expect(nombreDeTextesDuCorpus({ textes }), String(textes)).toBeNull();
    }
  });
});
