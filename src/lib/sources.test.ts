import { describe, expect, it } from 'vitest';

import { libelleDeSource, nomCourtDuTexte } from './sources';

describe('le nom court d une source', () => {
  it.each([
    ['Loi N° 2016/007 du 12 juillet 2016 portant Code Pénal', 'Code Pénal'],
    ['Loi N°2023/014 du 19 décembre 2023 portant Code Minier', 'Code Minier'],
    ['Loi N° 2017/012 du 12 juillet 2017 portant code de justice militaire.', 'Code de justice militaire'],
  ])('un texte qui EST un code : %s', (titre, nom) => {
    expect(nomCourtDuTexte(titre, 'PRC-4722')).toBe(nom);
  });

  it.each([
    [
      'Loi N° 2019/020 du 24 décembre 2019 modifiant et complétant certaines dispositions de la loi No 2016/007 du 12 juillet 2016 portant code pénal',
      'Loi N° 2019/020',
    ],
    [
      "Décret N°2023/232 du 04 mai 2023 fixant les modalités d'application de la loi n°2019/008 du 25 avril 2019 portant Code Pétrolier",
      'Décret N°2023/232',
    ],
    [
      'Décret N° 2016/319 du 12 juillet 2016 portant partie réglementaire du Code Pénal définissant les contraventions.',
      'Décret N° 2016/319',
    ],
  ])('un texte qui MODIFIE ou applique un code garde son nom : %s', (titre, nom) => {
    expect(nomCourtDuTexte(titre)).toBe(nom);
  });

  it.each([
    ['Décret N°2019/143 du 3 avril 2019 portant organisation du Gouvernement', 'Décret N°2019/143'],
    ['Arrêté N°0096/CAB/PR/du 16 février 2026 portant intégration de 46 élèves', 'Arrêté N°0096/CAB/PR'],
    ['Pleins Pouvoirs N°2020/137 du 25 mars 2020 habilitant le Ministre', 'Pleins Pouvoirs N°2020/137'],
  ])('sinon l acte et son numero : %s', (titre, nom) => {
    expect(nomCourtDuTexte(titre)).toBe(nom);
  });

  it('sans titre, la cote ; sans motif reconnu, le titre entier', () => {
    expect(nomCourtDuTexte('', 'PRC-4722')).toBe('PRC-4722');
    expect(nomCourtDuTexte(null, 'PRC-4722')).toBe('PRC-4722');
    expect(nomCourtDuTexte('Code OHADA')).toBe('Code OHADA');
  });
});

describe('le libelle d une source', () => {
  it('nomme l article et le texte, jamais la cote interne', () => {
    const libelle = libelleDeSource({
      law_reference: 'PRC-4722',
      law_title: 'Loi N° 2016/007 du 12 juillet 2016 portant Code Pénal',
      article_number: '94',
    });

    expect(libelle).toBe('Article 94 — Code Pénal');
    expect(libelle).not.toContain('PRC');
  });

  it('sans numero d article, le texte seul', () => {
    expect(libelleDeSource({ law_reference: 'X', law_title: 'Loi N°2023/014 du 19 décembre 2023 portant Code Minier' }))
      .toBe('Code Minier');
  });
});
