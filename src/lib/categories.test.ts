import { describe, expect, it } from 'vitest';
import {
  NOMBRE_DE_DOMAINES,
  _domainesTraduits,
  descriptionCategorie,
  nomCategorie,
} from './categories';

describe('categories', () => {
  it('couvre les 14 domaines canoniques, pas un de plus', () => {
    // La liste est fermee cote backend (migration 007). Un domaine ajoute la-bas
    // sans traduction ici s'afficherait en francais dans l'interface anglaise.
    expect(_domainesTraduits()).toHaveLength(NOMBRE_DE_DOMAINES);
  });

  it('traduit un nom en anglais, insensible a la casse', () => {
    expect(nomCategorie('Droit Pénal et Procédure Pénale', 'en')).toBe('Criminal Law and Criminal Procedure');
    expect(nomCategorie('DROIT PÉNAL ET PROCÉDURE PÉNALE', 'en')).toBe('Criminal Law and Criminal Procedure');
  });

  it('rend le nom francais tel quel en francais', () => {
    expect(nomCategorie('Droit Pénal et Procédure Pénale', 'fr')).toBe('Droit Pénal et Procédure Pénale');
  });

  it('rend un nom inconnu tel quel plutot que rien', () => {
    expect(nomCategorie('Droit Spatial', 'en')).toBe('Droit Spatial');
    expect(nomCategorie(null, 'en')).toBe('');
  });

  it('prefere la traduction a la description en base, et retombe dessus sinon', () => {
    expect(descriptionCategorie('Droit Civil et Procédure Civile', 'Personnes, biens…', 'en')).toBe(
      'Persons, obligations, contracts, civil proceedings and enforcement',
    );
    expect(descriptionCategorie('Droit Civil et Procédure Civile', 'Personnes, biens…', 'fr')).toBe('Personnes, biens…');
    expect(descriptionCategorie('Droit Spatial', 'Orbites', 'en')).toBe('Orbites');
    expect(descriptionCategorie('Droit Spatial', null, 'en')).toBe('');
  });
});
