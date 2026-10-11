import { describe, expect, it } from 'vitest';

import { repartitionParProfil } from './repartition-profils';

describe('conversations par profil (tableau de bord)', () => {
  it('rien à afficher sans données', () => {
    expect(repartitionParProfil(undefined)).toEqual([]);
    expect(repartitionParProfil(null)).toEqual([]);
    expect(repartitionParProfil({})).toEqual([]);
  });

  it('les graphies d un même profil sont regroupées sous la forme canonique', () => {
    const lignes = repartitionParProfil({
      'étudiant': 3,
      'étudiant': 2, // NFD
      Etudiant: 1,
    });

    expect(lignes).toEqual([{ cle: 'étudiant', profil: 'étudiant', conversations: 6, part: 1 }]);
  });

  it('le profil général a sa ligne, et les parts somment à 1', () => {
    const lignes = repartitionParProfil({ citoyen: 2, general: 2 });

    expect(lignes.map((l) => [l.profil, l.part])).toEqual([
      ['citoyen', 0.5],
      ['general', 0.5],
    ]);
  });

  it('du plus utilisé au moins utilisé ; à égalité, l ordre de la question', () => {
    const lignes = repartitionParProfil({ general: 1, entrepreneur: 1, avocat: 4, citoyen: 1 });

    expect(lignes.map((l) => l.cle)).toEqual(['avocat', 'citoyen', 'entrepreneur', 'general']);
  });

  it('une valeur inconnue reste affichée telle quelle, et compte dans le total', () => {
    const lignes = repartitionParProfil({ citoyen: 3, notaire: 1 });

    expect(lignes[1]).toEqual({ cle: 'notaire', profil: null, conversations: 1, part: 0.25 });
    expect(lignes[0].part).toBe(0.75);
  });

  it('un effectif nul ou illisible est ignoré', () => {
    const lignes = repartitionParProfil({ citoyen: 0, avocat: Number.NaN, entrepreneur: 2 });

    expect(lignes.map((l) => l.cle)).toEqual(['entrepreneur']);
  });
});
