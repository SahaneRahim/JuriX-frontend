import { describe, expect, it } from 'vitest';

import { decoupeDuTitre, objetDuTitre, sansNoteDeConsolidation } from './nom-du-texte';

/**
 * Des intitulés réels de la base (jurix_dev, 29/10/2026), et l'objet que rend
 * pour chacun `objet_du_titre` du serveur (app/utils/titre_officiel.py, branche
 * feat/ux-api). La découpe du chat doit rendre le même, au caractère près : un
 * texte ne change pas de nom entre les listes et le chat. Les 2 287 intitulés
 * ont été comparés ainsi le 29/10/2026 (aucun écart hors des trois verbes non
 * repris) ; ceux-ci couvrent chaque traitement.
 */
describe('objetDuTitre : la découpe du serveur', () => {
  const CAS: [string, string][] = [
    // laws.id 2274 : « portant », l'objet tel quel.
    ['Loi N°92/007 du 14 août 1992 portant Code du travail', 'Code du travail'],
    // laws.id 2246 : « portant sur », sans l'article.
    ["Loi N°90/053 du 19 décembre 1990 portant sur la liberté d'association", "Liberté d'association"],
    // laws.id 1148 : « modifiant et complétant », nominalisé, « de » contracté.
    [
      "Décret N°2017/583 du 24 novembre 2017 modifiant et complétant certaines dispositions du décret n°93/034 du 19 janvier 1993 portant organisation de l'Université de Buea.",
      "Modification de certaines dispositions du décret n°93/034 du 19 janvier 1993 portant organisation de l'Université de Buea",
    ],
    // laws.id 594 : « complétant », et le mois collé au jour (« 07septembre »).
    [
      'Décret N°82/408 du 07septembre 1982 complétant certaines dispositions du décret n° 74/759 du 26 août 1974 portant organisation du régime des Pensions Civiles',
      'Complément à certaines dispositions du décret n° 74/759 du 26 août 1974 portant organisation du régime des Pensions Civiles',
    ],
    // laws.id 94 : la locution la plus longue d'abord.
    [
      "Décret N° 2014/604 du 31 décembre 2014 approuvant et rendant exécutoire le budget de la Caisse nationale de prévoyance sociale pour l'exercice 2015",
      "Approbation du budget de la Caisse nationale de prévoyance sociale pour l'exercice 2015",
    ],
    // laws.id 1116 : « fixant », sans date dans l'en-tête.
    [
      'Décret N°2015/405 fixant les modalités de rémunération des Délégués du Gouvernement, des Maires et de leurs Adjoints',
      'Modalités de rémunération des Délégués du Gouvernement, des Maires et de leurs Adjoints',
    ],
    // laws.id 1247 : « relative aux ».
    [
      'Loi N° 79/17 du 30 juin 1979 relative aux contestations soulevées à l’occasion de la désignation des chefs traditionnels',
      'Contestations soulevées à l’occasion de la désignation des chefs traditionnels',
    ],
    // laws.id 1816 : « régissant ».
    ["Loi n° 2020/010 du 20 juillet 2020 régissant l'activité statistique au Cameroun", 'Activité statistique au Cameroun'],
    // laws.id 337 : sans verbe, un nom d'objet ouvre l'objet.
    [
      "Décret N°2019/233 du 08 mai 2019 nomination d'un Inspecteur Général au Ministère de la Santé Publique",
      "Nomination d'un Inspecteur Général au Ministère de la Santé Publique",
    ],
    // laws.id 575 : « port an t », faute de saisie réparée.
    [
      "Décret N°2021/069 du 04 février 2021 port an t agrément de la société « AGENCE DOBERMANN » à l'exercice des activités privées de gardiennage.",
      "Agrément de la société « AGENCE DOBERMANN » à l'exercice des activités privées de gardiennage",
    ],
    // laws.id 14 : intitulé coupé à la source, l'objet garde la marque.
    [
      "DECRET N° 2013/300 DU 09 SEP. 2013 portant ratification de la Convention de l'Afrique Centrale pour le contrôle des Armes Légères et de Petit Calibre, de leurs munitions et de toutes pièces et composantes pouvant servir à leur fabrication, réparation et a",
      "Ratification de la Convention de l'Afrique Centrale pour le contrôle des Armes Légères et de Petit Calibre, de leurs munitions et de toutes pièces et composantes pouvant servir à leur fabrication, réparation et a …",
    ],
  ];

  it.each(CAS)('%s', (titre, objet) => {
    expect(objetDuTitre(titre)).toBe(objet);
  });

  it('decoupeDuTitre : l’en-tête vérifié, tel que l’intitulé l’écrit, avec l’objet', () => {
    expect(decoupeDuTitre('Loi N°92/007 du 14 août 1992 portant Code du travail')).toEqual({
      enTete: 'Loi N°92/007 du 14 août 1992',
      objet: 'Code du travail',
    });
    // Sans date dans l'en-tête (laws.id 1116).
    expect(decoupeDuTitre('Décret N°2015/405 fixant les modalités de rémunération des Maires')?.enTete).toBe('Décret N°2015/405');
    expect(decoupeDuTitre('Code civil applicable au Cameroun')).toBeNull();
  });

  it('rend null dès qu’il doute : le nom court d’avant reste', () => {
    for (const titre of [
      // laws.id 34 et 193 : « habilitant » et « déclarant », non repris ici.
      "Décret N°2014 /131 du 31 mars 2014 habilitant le Ministre des Finances à recourir à des émissions de titres publics d'un montant maximum de 280 milliards de francs CFA",
      'Arrêté N° 8448/CAB/PR du 24 juin 2017 déclarant fériée et chômée la journée du lundi 26 juin 2017',
      // laws.id 86 : un nom de fichier.
      'decret_n_2014_543_du_10.12.2014_nomination_dg_apme',
      // laws.id 2285 : un nom, pas un acte suivi de son objet.
      'Code civil applicable au Cameroun, annoté de la jurisprudence de la Cour suprême',
      // laws.id 1967 : deux verbes coordonnés.
      'Décret N°2023/475 du 7 novembre 2023 précisant certaines attributions et fixant les avantages des comptables publics placés auprès des Collectivités Territoriales Décentralisées',
      // laws.id 1113 : l'objet a perdu son nom (« portant de la médaille »).
      'Décret N° 2015/193 portant de la médaille de la Vaillance à titre collectif aux étendards des Formations et Unités de la Gendarmerie Nationale',
      // laws.id 1770 : l'en-tête porte autre chose qu'une nature, un numéro et une date.
      "Décret N° 2016/341 du 22 juillet 2016 d'Etat portant nomination de responsables dans les services du Contrôle Supérieur de l'Etat.",
      '',
      null,
    ]) {
      expect(objetDuTitre(titre)).toBeNull();
    }
  });
});

describe('nom-du-texte.ts', () => {
  it('n’utilise aucune assertion arrière (Safari avant la 16.4 refusait le module entier)', () => {
    const sources = import.meta.glob('./nom-du-texte.ts', { query: '?raw', import: 'default', eager: true });
    const source = Object.values(sources)[0] as string;

    expect(source).toBeTruthy();
    expect(source).not.toMatch(/\(\?<[=!]/);
  });
});

describe('sansNoteDeConsolidation', () => {
  it('retire « , modifié et complété par … » : une note, pas l’objet', () => {
    // laws.id 2279, dont l'objet du serveur garde la note.
    const objet = objetDuTitre(
      "Décret N°94/199 du 07 octobre 1994 portant Statut Général de la Fonction Publique de l'État, modifié et complété par le décret n°2000/287 du 12 octobre 2000",
    );
    expect(objet).toBe("Statut Général de la Fonction Publique de l'État, modifié et complété par le décret n°2000/287 du 12 octobre 2000");
    expect(sansNoteDeConsolidation(objet!)).toBe("Statut Général de la Fonction Publique de l'État");
    // laws.id 2282 : l'accord au féminin.
    expect(sansNoteDeConsolidation('Code électoral, modifiée et complétée par la loi n°2012/017 du 21 décembre 2012')).toBe(
      'Code électoral',
    );
  });

  it('ne touche ni un objet sans note, ni « modifiant » qui ouvre un objet', () => {
    expect(sansNoteDeConsolidation('Code du travail')).toBe('Code du travail');
    expect(sansNoteDeConsolidation('Modification du décret n° 74/759, modifiant le régime des pensions')).toBe(
      'Modification du décret n° 74/759, modifiant le régime des pensions',
    );
  });
});
