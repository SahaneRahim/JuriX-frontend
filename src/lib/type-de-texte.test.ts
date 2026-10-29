import { describe, expect, it } from 'vitest';

import { translations } from './stores/language';
import { typeDeTexte, typeDuTitre } from './type-de-texte';
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

/**
 * La palette Ctrl K ne reçoit que l'intitulé (GET /search/suggest) : la nature
 * se lit en tête de celui-ci. Intitulés réels de jurix_dev (relevés le
 * 29/10/2026), casse et accents de l'OCR compris.
 */
describe('typeDuTitre', () => {
  it('lit la nature en tête de l’intitulé officiel', () => {
    expect(typeDuTitre('Loi N°92/007 du 14 août 1992 portant Code du travail').cle).toBe('badge.law');
    expect(
      typeDuTitre('Décret N°2018/9387/CAB/PM du 30 décembre 2018 fixant les modalités d’application').cle,
    ).toBe('badge.decree');
    expect(typeDuTitre('Ordonnance N°2020/001 du 03 juin 2020 modifiant et complétant').cle).toBe(
      'badge.ordinance',
    );
    expect(typeDuTitre('Acte uniforme révisé portant sur le droit commercial général du 15 décembre 2010').cle).toBe(
      'badge.uniformAct',
    );
  });

  it('sans tenir compte des accents ni de la casse de l’OCR', () => {
    expect(typeDuTitre('DECRET N° 2013/300 DU 09 SEP. 2013 portant ratification').cle).toBe('badge.decree');
    expect(typeDuTitre("decret n° 2013/034 du 14 février 2013 portant nomination du pca").cle).toBe('badge.decree');
    expect(typeDuTitre('ARRETE N° 0524/CAB/PR du 9 mai 2025').cle).toBe('badge.arrete');
    expect(typeDuTitre('Loi-cadre N° 96/03 du 4 janvier 1996 dans le domaine de la santé').cle).toBe('badge.law');
  });

  it('« Texte » pour un intitulé sans nature en tête, jamais « Loi » par défaut', () => {
    expect(typeDuTitre('Code civil applicable au Cameroun, annoté de la jurisprudence de la Cour suprême').cle).toBe(
      'badge.text',
    );
    expect(typeDuTitre('ordonnance_n_2015_001.pdf').cle).toBe('badge.text');
    // « Loisirs » commence par « loi » sans être une loi.
    expect(typeDuTitre('Loisirs et sports : textes réunis').cle).toBe('badge.text');
    expect(typeDuTitre('').cle).toBe('badge.text');
    expect(typeDuTitre(null).cle).toBe('badge.text');
  });

  it('la Constitution garde son badge d’emphase', () => {
    expect(typeDuTitre('Constitution de la République du Cameroun')).toMatchObject({
      cle: 'badge.constitution',
      emphase: true,
    });
  });
});
