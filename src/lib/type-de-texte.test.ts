import { describe, expect, it } from 'vitest';

import { translations } from './stores/language';
import { typeDeTexte } from './type-de-texte';
import type { LawType } from './types';

describe('typeDeTexte', () => {
  it('nomme chaque type de l’API, avec une clé traduite dans les deux langues', () => {
    const types: LawType[] = [
      'loi',
      'décret',
      'ordonnance',
      'arrêté',
      'circulaire',
      'instruction',
      'décision',
      'acte uniforme',
      'autre',
    ];
    for (const type of types) {
      const { cle } = typeDeTexte(type);
      expect(Object.keys(translations.fr), `${type} : ${cle} manque en français`).toContain(cle);
      expect(Object.keys(translations.en), `${type} : ${cle} manque en anglais`).toContain(cle);
    }
  });

  it('distingue les types courants, et retombe sur « Texte » sinon', () => {
    expect(typeDeTexte('loi').cle).toBe('badge.law');
    expect(typeDeTexte('décret').cle).toBe('badge.decree');
    expect(typeDeTexte('arrêté').cle).toBe('badge.arrete');
    expect(typeDeTexte('autre').cle).toBe('badge.text');
    expect(typeDeTexte(null).cle).toBe('badge.text');
  });

  it('reconnaît la Constitution au premier mot du titre seulement', () => {
    expect(typeDeTexte('loi', 'Constitution de la République du Cameroun')).toMatchObject({
      cle: 'badge.constitution',
      emphase: true,
    });
    expect(typeDeTexte('loi', 'Loi N°2008/001 portant révision de la Constitution').cle).toBe('badge.law');
  });
});
