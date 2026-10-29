import { describe, expect, it } from 'vitest';
import {
  decouperLeTexte,
  divisionsPrincipales,
  enTetePrincipal,
  enTetesDuSommaire,
  extraitDeLArticle,
  filtrerLArticle,
  intituleDeLArticle,
  libelleDeDivision,
  lireEnTete,
  paragraphesACopier,
  paragraphesDeLArticle,
  plageDArticles,
  plier,
  premiersMots,
  texteDeLArticle,
  titreEstLeTexte,
} from './decoupage';

/**
 * Le découpage du texte officiel, sur des extraits RÉELS de la base locale
 * (28/10/2026) : décret 2021/745 (/laws/1740), Constitution (/laws/2143),
 * loi 90/053 (/laws/2246), Code civil (/laws/2285), Code pénal (/laws/2236).
 * Chaque cas est une forme que l'ancienne règle ratait ou qu'elle doit garder.
 */

const traduire = (cle: string) =>
  ({
    'loi.division.livre': 'Livre',
    'loi.division.titre': 'Titre',
    'loi.division.chapitre': 'Chapitre',
    'loi.division.section': 'Section',
    'loi.division.premier': '{Mot} premier',
    'loi.division.premiere': '{Mot} première',
    'loi.division.preliminaire': '{Mot} préliminaire',
    'loi.division.unique': '{Mot} unique',
  })[cle] ?? cle;

const anglais = (cle: string) =>
  ({
    'loi.division.titre': 'Title',
    'loi.division.chapitre': 'Chapter',
    'loi.division.premier': '{Mot} I',
    'loi.division.preliminaire': 'Preliminary {mot}',
  })[cle] ?? cle;

describe('articles', () => {
  it('garde les formes que la page reconnaissait déjà', () => {
    const texte = decouperLeTexte(
      [
        '**ARTICLE 1er.**- Le présent décret fixe les modalités.',
        '**Article35.-** Les dispositions…',
        'ARTICLE 1ºr.- Débris de l’OCR retirés.',
        'ARTiCLE 3.- La Région participe.',
      ].join('\n'),
    );
    expect(texte.articles.map((a) => a.numero)).toEqual(['1', '35', '1', '3']);
    expect(texte.articles.map((a) => a.titre)).toEqual([
      'Le présent décret fixe les modalités.',
      'Les dispositions…',
      'Débris de l’OCR retirés.',
      'La Région participe.',
    ]);
  });

  it('reconnaît « Art. N » suivi d’un séparateur (Code civil, loi 90/053)', () => {
    const texte = decouperLeTexte(
      [
        "- Art. 2. - La loi ne dispose que pour l'avenir; elle n'a point d'effet rétroactif.",
        '- Art. 4. -- Le juge qui refusera de juger…',
        'Art.10- (1) Toute association déclarée…',
        'Art. 6: sous réserve des cas de nullité…',
        'Article. 2.-',
        '(1) La souveraineté nationale appartient au peuple camerounais.',
      ].join('\n'),
    );
    expect(texte.articles.map((a) => a.numero)).toEqual(['2', '4', '10', '6', '2']);
    expect(texte.articles[0].titre).toBe("La loi ne dispose que pour l'avenir; elle n'a point d'effet rétroactif.");
    expect(texte.articles[1].titre).toBe('Le juge qui refusera de juger…');
    expect(texte.articles[2].titre).toBe('(1) Toute association déclarée…');
    // Le titre de la dernière ligne est vide ; son texte suit.
    expect(texte.articles[4].titre).toBe('');
    expect(texte.articles[4].lignes).toEqual(['(1) La souveraineté nationale appartient au peuple camerounais.']);
  });

  it('lit « Article premier » en toutes lettres comme l’article 1 (Constitution, régime foncier, OHADA)', () => {
    // Formes réelles de la base : Constitution (/laws/2143), loi sur les
    // pensions, Actes uniformes ; la dernière ligne est une phrase.
    const texte = decouperLeTexte(
      [
        'Article premier:',
        '- (1) La République Unie du Cameroun prend la dénomination de République du Cameroun.',
        'ARTICLE PREMIER.- (1) Les pensions civiles et militaires…',
        '**Article premier** Champ d’application',
        'Le présent Acte uniforme s’applique…',
        'Article premier de la loi n° 96/06 est modifié ainsi qu’il suit.',
        'ARTICLE PREMIER. — Il est institué un régime d’assurance pension.',
        'Article 2.- La souveraineté nationale…',
      ].join('\n'),
    );
    expect(texte.articles.map((a) => a.numero)).toEqual(['1', '1', '1', '1', '2']);
    expect(texte.articles.map((a) => a.titre)).toEqual([
      '',
      '(1) Les pensions civiles et militaires…',
      'Champ d’application',
      'Il est institué un régime d’assurance pension.',
      'La souveraineté nationale…',
    ]);
    expect(texte.articles[0].lignes).toEqual([
      '- (1) La République Unie du Cameroun prend la dénomination de République du Cameroun.',
    ]);
    // « Article premier de la loi… » : une phrase, laissée à l'article en cours.
    expect(texte.articles[2].lignes).toEqual([
      'Le présent Acte uniforme s’applique…',
      'Article premier de la loi n° 96/06 est modifié ainsi qu’il suit.',
    ]);
  });

  it('ne prend pas un renvoi pour un article', () => {
    const texte = decouperLeTexte(
      ['Article 1er.- Le présent décret.', 'Art. 5 du décret susvisé est abrogé.', 'art. 4 ci-dessus.'].join('\n'),
    );
    expect(texte.articles).toHaveLength(1);
    expect(texte.articles[0].lignes).toEqual(['Art. 5 du décret susvisé est abrogé.', 'art. 4 ci-dessus.']);
  });

  it('coupe avant un article collé au précédent, dans la suite des numéros (Code du travail)', () => {
    // Formes réelles : Code du travail (/laws/2274), régime foncier (/laws/2254),
    // prestations familiales (/laws/2244).
    const texte = decouperLeTexte(
      [
        'Article 35.- La partie lésée a droit à des dommages-intérêts qu’elle jugerait bon de demander. Article 36.- (1) Toute rupture de contrat à durée indéterminée… Article 37.- (1) En cas de rupture…',
        'Article 38.- Le contrat de travail à durée déterminée… susceptibles de solliciter l’obtention d’un titre foncier Article 39 : Les droits…',
      ].join('\n'),
    );
    expect(texte.articles.map((a) => a.numero)).toEqual(['35', '36', '37', '38', '39']);
    expect(texte.articles[0].titre).toBe(
      'La partie lésée a droit à des dommages-intérêts qu’elle jugerait bon de demander.',
    );
    expect(texte.articles[1].titre).toBe('(1) Toute rupture de contrat à durée indéterminée…');
    expect(texte.articles[4].titre).toBe('Les droits…');
  });

  it('laisse en place un « Article N » de milieu de ligne qui n’ouvre pas d’article', () => {
    const texte = decouperLeTexte(
      [
        // Hors de la suite : une citation qui saute loin, ou revient en arrière.
        'Article 1er.- Les articles 5 et 7 sont modifiés. Article 5.- (nouveau) Le contrat…',
        // Une loi qui modifie cite le nouvel article.
        'Article 2.- L’article 3 est ainsi rédigé : « Article 3.- Le délai… »',
        // Une date mêlée par l'OCR ; un numéro composé ; un tableau.
        'Article 4.- En application du décret du 19 Article 5: Novembre 2012 susvisé.',
        'Article 6.- Sont modifiés : Article 7-1 et suivants.',
        '| 1. Article 7 | 2. Article 8 |',
      ].join('\n'),
    );
    expect(texte.articles.map((a) => a.numero)).toEqual(['1', '2', '4', '6']);
    expect(texte.articles[3].lignes).toEqual(['| 1. Article 7 | 2. Article 8 |']);
  });

  it('retire les marqueurs de page et compte les numéros en double', () => {
    const texte = decouperLeTexte('Article 53.- Un.\n<<PAGE:12>>\nArticle 53.- Deux.\nArticle 54.- Trois.');
    expect(texte.articles.map((a) => [a.numero, a.occurrence, a.rang])).toEqual([
      ['53', 0, 0],
      ['53', 1, 1],
      ['54', 0, 2],
    ]);
    expect(texte.articles.map((a) => a.cle)).toEqual(['53', '53', '54']);
  });

  it('distingue un vrai intitulé de la première phrase', () => {
    const [intitule, phrase, liste] = decouperLeTexte(
      [
        'Article 74 : Imputabilité',
        '(1) Est pénalement responsable…',
        'Article 1er.- Le présent décret fixe les modalités d’exercice de certaines compétences transférées par l’État.',
        'Article 2.- Au sens du présent décret, on entend par :',
        '- Région : la collectivité…',
      ].join('\n'),
    ).articles;
    expect(titreEstLeTexte(intitule)).toBe(false);
    expect(intituleDeLArticle(intitule)).toBe('Imputabilité');
    expect(paragraphesDeLArticle(intitule)).toEqual(['(1) Est pénalement responsable…']);
    expect(titreEstLeTexte(phrase)).toBe(true);
    expect(texteDeLArticle(phrase)).toBe(
      'Le présent décret fixe les modalités d’exercice de certaines compétences transférées par l’État.',
    );
    expect(titreEstLeTexte(liste)).toBe(true);
    expect(paragraphesDeLArticle(liste)).toEqual(['Au sens du présent décret, on entend par :', '- Région : la collectivité…']);
  });

  /**
   * Une première ligne courte qui porte le texte, relevée sur la base le
   * 29/10/2026 : 1 262 lignes dans 356 textes passent dans le corps, aucun
   * intitulé connu n'y passe.
   */
  it('une phrase ou un alinéa numéroté n’est pas un intitulé, même court (décrets 2014/095 et 2013/271)', () => {
    const [publication, abrogation, reecrit, formule] = decouperLeTexte(
      [
        // /laws/31, art. 3 : la phrase passait en intertitre, et « Copier le
        // texte » commençait à « Yaoundé, le 14 mars 2014 ».
        'Article 3.- Le présent décret sera enregistré, puis publié au Journal Officiel en français et en anglais.',
        'Yaoundé, le 14 mars 2014 Le Président de la République, (é) Paul BIYA',
        // /laws/1628, art. 2 : l'alinéa (1) était le titre, la copie partait du (2).
        'Article 2.- (1) Sont abrogées toutes les dispositions antérieures contraires.',
        '(2) Toutefois, le Ministre en charge des marchés publics poursuit l’instruction des dossiers.',
        // Loi 2026/002 (/laws/1761) : la marque d'un article réécrit.
        'Article 5 (nouveau) (1) Le Président de la République est le Chef de l’Etat.',
        '(2) Elu de la Nation tout entière, il incarne l’unité nationale.',
        // La formule de publication, coupée par l'OCR avant son point.
        'Article 4.- Le présent décret sera enregistré, publié suivant la procédure d’urgence, -ui l il cstol sis',
        'Yaoundé, le 2 4 NOV 2017',
      ].join('\n'),
    ).articles;
    for (const article of [publication, abrogation, reecrit, formule]) {
      expect(titreEstLeTexte(article), article.titre).toBe(true);
      expect(intituleDeLArticle(article)).toBe('');
    }
    expect(paragraphesDeLArticle(abrogation)).toEqual([
      '(1) Sont abrogées toutes les dispositions antérieures contraires.',
      '(2) Toutefois, le Ministre en charge des marchés publics poursuit l’instruction des dossiers.',
    ]);
  });

  it('un vrai intitulé reste un intitulé, point final ou guillemets compris (Code pénal, CIMA)', () => {
    const intitules = [
      'Imputabilité',
      'Champ d’application',
      'Attroupement armé.',
      'Banqueroute simple.',
      'Confiscation du « corpus delicti »',
      'Le régime de probation',
      'A - Droits dégressifs',
      'Les éléments constitutifs de la marge de solvabilité',
    ];
    for (const titre of intitules) {
      const article = { titre, lignes: ['(1) Est puni d’un emprisonnement de trois mois à un an.'] };
      expect(titreEstLeTexte(article), titre).toBe(false);
      expect(intituleDeLArticle(article)).toBe(titre);
    }
  });

  it('« Copier le texte » garde l’intitulé, l’extrait d’« Expliquer l’article » les lignes du document', () => {
    const [intitule, alineas] = decouperLeTexte(
      [
        'Article 74 : Imputabilité',
        '- (1) Est pénalement responsable…',
        // /laws/1936, art. 2 : la puce « - » devant l'alinéa (2).
        "Article 2.- (1) La police municipale a pour objet d'assurer le bon ordre, ainsi que la sûreté, la tranquillité, la sécurité et la salubrité publiques sur le territoire de la Commune ou de la Communauté Urbaine.",
        "- (2) La police municipale est placée sous l'autorité du Maire.",
      ].join('\n'),
    ).articles;
    expect(paragraphesACopier(intitule)).toEqual(['Imputabilité', '(1) Est pénalement responsable…']);
    // L'intitulé n'est pas dans l'extrait : le serveur cherche son début dans le document.
    expect(extraitDeLArticle(intitule)).toBe('- (1) Est pénalement responsable…');
    expect(paragraphesACopier(alineas)[1]).toBe("(2) La police municipale est placée sous l'autorité du Maire.");
    // Mot pour mot, puce comprise : « … Urbaine. - (2) » est dans le document,
    // « … Urbaine. (2) » ne l'est pas.
    expect(extraitDeLArticle(alineas)).toMatch(/Communauté Urbaine\.\n- \(2\) La police municipale est placée/);
  });

  it('donne les premiers mots, sans la numérotation ni points de suspension', () => {
    const [a, b] = decouperLeTexte(
      'Article 6.-\n(1) Le Président de la République est élu au suffrage universel.\nArticle 74 : Imputabilité\nTexte.',
    ).articles;
    expect(premiersMots(a)).toBe('Le Président de la République est élu au suffrage universel.');
    expect(premiersMots(b)).toBe('Imputabilité');
    const long = decouperLeTexte(`Article 1.- ${'mot '.repeat(80)}`).articles[0];
    expect(premiersMots(long)).toHaveLength(160);
    expect(premiersMots(long)).not.toContain('…');
  });

  it('retire toutes les numérotations empilées des premiers mots (Constitution)', () => {
    // « - (1) » : un tiret, puis le numéro d'alinéa. Une seule passe laissait
    // « (1) Le Président… » aux articles 5 à 9 (vérification r1 du 29/10).
    const [cinq, vide] = decouperLeTexte(
      ['Article 5.-', '- (1) Le Président de la République est le Chef de l’État.', 'Article 7.-', '- (1)', 'Il prête serment.'].join(
        '\n',
      ),
    ).articles;
    expect(premiersMots(cinq)).toBe('Le Président de la République est le Chef de l’État.');
    // Un paragraphe qui n'était qu'un numéro : le suivant.
    expect(premiersMots(vide)).toBe('Il prête serment.');
  });

  it('lit « Article - 78.- » (tiret de l’OCR) comme l’article 78 (Code du travail)', () => {
    const [article] = decouperLeTexte('Article - 78.- (1) Est considérée comme "économat" toute organisation…').articles;
    expect(article.numero).toBe('78');
    expect(article.titre).toBe('(1) Est considérée comme "économat" toute organisation…');
  });
});

/**
 * Les en-têtes que l'OCR range loin de leur place, sur des extraits RÉELS de
 * la base locale (29/10/2026), marqueurs de page compris.
 */
describe('en-têtes déplacés par l’OCR', () => {
  /** La Constitution (/laws/2143), pages 6 à 9 et 12 à 15, réduites. */
  const CONSTITUTION = [
    '<<PAGE:6>>',
    '一',
    'Article premier:',
    '- (1) La République Unie du Cameroun prend la dénomination de RÉPUBLIQUE DU CAMEROUN.',
    '- (7) Le Sceau de la République du Cameroun est une médaille circulaire.',
    "TITRE PREMIER DE L'ÉTAT ET DE LA SOUVERAINETÉ",
    '<<PAGE:7>>',
    'Les armoiries de la République du Cameroun sont constituées par un écu chapé.',
    "L'écu est composé d'une étoile d'or.",
    '- (8) Le siège des institutions est à Yaoundé.',
    'Article. 2.-',
    '- (1) La souveraineté nationale appartient au peuple camerounais.',
    '<<PAGE:8>>',
    'Article 5.-',
    "- (1) Le Président de la République est le Chef de l'État.",
    'Article 6.-',
    '- (4) En cas de vacance de Présidence de la République, le scrutin a lieu.',
    "- a) l'intérim du Président de la République est exercé de plein droit.",
    'TITRE I1 DU POUVOIR EXÉCUTIF',
    'CHAPITRE 1: DU PRÉSIDENT DE LA RÉPUBLIQUE',
    '<<PAGE:9>>',
    '- b) le Président de la République par intérim ne peut modifier ni la Constitution.',
    '- (5) Les candidats aux fonctions de Président de la République doivent être des citoyens.',
    '- (6) Le régime de l’élection à la Présidence de la République est fixé par la loi.',
    'Article 7.-',
    '- (1) Le Président de la République élu entre en fonction dès sa prestation de serment.',
    '<<PAGE:12>>',
    'Article 11.-',
    '- (1) Le Gouvernement est chargé de la mise en oeuvre de la politique de la Nation.',
    'Article 13.- Les fonctions de membre du Gouvernement sont incompatibles avec tout mandat.',
    'CHAPITRE 11:',
    'DU GOUVERNEMENT',
    '<<PAGE:13>>',
    'THERELORLIE',
    'TITRE I11 DU POUVOIR LÉGISLATIF',
    'Article 14.-',
    '- (1) Le pouvoir législatif est exercé par le Parlement.',
  ].join('\n');

  it('rend la fin de l’article interrompu par un en-tête de bas de page (art. 1er et 6)', () => {
    const { articles } = decouperLeTexte(CONSTITUTION);
    const [premier, , , six] = articles;
    expect(premier.numero).toBe('1');
    expect(premier.lignes).toEqual([
      '- (1) La République Unie du Cameroun prend la dénomination de RÉPUBLIQUE DU CAMEROUN.',
      '- (7) Le Sceau de la République du Cameroun est une médaille circulaire.',
      'Les armoiries de la République du Cameroun sont constituées par un écu chapé.',
      "L'écu est composé d'une étoile d'or.",
      '- (8) Le siège des institutions est à Yaoundé.',
    ]);
    expect(six.numero).toBe('6');
    expect(six.lignes.slice(-3)).toEqual([
      '- b) le Président de la République par intérim ne peut modifier ni la Constitution.',
      '- (5) Les candidats aux fonctions de Président de la République doivent être des citoyens.',
      '- (6) Le régime de l’élection à la Présidence de la République est fixé par la loi.',
    ]);
    // Ce qu'affiche et copie « Copier le texte » : sans la puce que la
    // conversion du PDF pose devant les alinéas numérotés. L'extrait envoyé
    // avec « Expliquer l'article » la garde (`extraitDeLArticle`).
    expect(texteDeLArticle(six)).toContain('(6) Le régime de l’élection');
    expect(texteDeLArticle(six)).not.toMatch(/^- \(|\n- \(|\n- b\)/);
    expect(extraitDeLArticle(six)).toContain('\n- (6) Le régime de l’élection');
  });

  it('retire la puce posée devant un alinéa numéroté, pas les tirets d’énumération', () => {
    const [article] = decouperLeTexte(
      [
        'Article 1er.-',
        '- (1) La République Unie du Cameroun prend la dénomination de République du Cameroun.',
        '(2) La République du Cameroun est un État unitaire.',
        "- a) l'intérim du Président de la République est exercé de plein droit.",
        '- la participation à la création et à la gestion des zones industrielles ;',
      ].join('\n'),
    ).articles;
    expect(paragraphesDeLArticle(article)).toEqual([
      '(1) La République Unie du Cameroun prend la dénomination de République du Cameroun.',
      '(2) La République du Cameroun est un État unitaire.',
      "a) l'intérim du Président de la République est exercé de plein droit.",
      '- la participation à la création et à la gestion des zones industrielles ;',
    ]);
  });

  it('remet l’en-tête avant le premier article de sa page, et ses voisins avec lui', () => {
    const texte = decouperLeTexte(CONSTITUTION);
    const division = (numero: string) =>
      enTetesDuSommaire(texte.divisions[texte.articles.find((a) => a.numero === numero)!.division]).map((e) =>
        libelleDeDivision(e, traduire),
      );
    expect(division('1')).toEqual(['Titre premier']);
    expect(division('2')).toEqual(['Titre premier']);
    // L'en-tête de la page 8 revient avant l'article 5, premier de sa page.
    expect(division('5')).toEqual(['Titre II', 'Chapitre 1']);
    expect(division('6')).toEqual(['Titre II', 'Chapitre 1']);
    // Prouvé une fois, le déplacement vaut pour le texte : « CHAPITRE 11 »,
    // suivi du seul tampon, remonte avant l'article 11, et se lit « 2 ».
    expect(division('11')).toEqual(['Chapitre 2']);
    expect(enTetePrincipal(texte.divisions[texte.articles.find((a) => a.numero === '11')!.division])?.intitule).toBe(
      'DU GOUVERNEMENT',
    );
    expect(division('13')).toEqual(['Chapitre 2']);
    expect(division('14')).toEqual(['Titre III']);
    // Le tampon reste hors de l'article 13.
    expect(texte.articles.find((a) => a.numero === '13')?.lignes).toEqual([]);
  });

  it('laisse en place un vrai titre de fin de page, sans preuve de déplacement', () => {
    const texte = decouperLeTexte(
      [
        '<<PAGE:13>>',
        'ARTICLE 47.- (1) Le suivi de la gestion est assuré par le Ministre chargé des finances.',
        'ARTiCLE 48.- (1) Le Ministre peut demander la production d’états financiers.',
        '- (2) Des audits indépendants peuvent être demandés par le Conseil d’Administration.',
        'CHAPITRE VI DES MARCHES PUBLICS',
        '<<PAGE:14>>',
        '- (2) Le Directeur Général est l’autorité contractante de tous les marchés publics.',
        'ARTICLE 50.- (1) Les biens du domaine public sont transférés.',
      ].join('\n'),
    );
    // « (2) » après « (2) » : un autre article commence, dont l'OCR a perdu
    // la ligne « ARTICLE 49 ». Le chapitre VI reste après l'article 48.
    const [quarante7, quarante8, cinquante] = texte.articles;
    expect(quarante7.division).toBe(quarante8.division);
    expect(enTetePrincipal(texte.divisions[cinquante.division])?.numeral).toBe('VI');
    expect(quarante8.lignes).toEqual(['- (2) Des audits indépendants peuvent être demandés par le Conseil d’Administration.']);
  });

  it('ne fait pas remonter une section au-dessus du chapitre qui la précède sur la page (loi 90/052)', () => {
    const texte = decouperLeTexte(
      [
        '<<PAGE:9>>',
        'Article 56',
        'Les organes de communication audiovisuelle sont tenus de diffuser la réponse.',
        'CHAPITRE X DES INFRACTIONS',
        'Article 62',
        'Est puni de la même amende qu’à l’article 61 ci-dessus :',
        'SECTION II DANS LES ORGANES DE COMMUNICATION AUDIOVISUELLE',
        '<<PAGE:10>>',
        '3',
        '- (1) quiconque publie un organe de presse sans la déclaration prévue à l’article 7 ;',
        'Article 63',
        'Est puni d’une amende tout exploitant d’une radio.',
      ].join('\n'),
    );
    const [cinquante6, soixante2, soixante3] = texte.articles;
    // La liste annoncée par « : » revient à l'article 62 ; la section passe
    // après elle, et ouvre l'article 63.
    expect(soixante2.lignes).toEqual([
      'Est puni de la même amende qu’à l’article 61 ci-dessus :',
      '- (1) quiconque publie un organe de presse sans la déclaration prévue à l’article 7 ;',
    ]);
    expect(enTetePrincipal(texte.divisions[cinquante6.division])).toBeNull();
    expect(enTetePrincipal(texte.divisions[soixante2.division])?.mot).toBe('chapitre');
    expect(enTetePrincipal(texte.divisions[soixante3.division])?.mot).toBe('section');
  });

  it('remet avant l’article l’en-tête lu entre son intitulé et son texte (Code pénal)', () => {
    const texte = decouperLeTexte(
      [
        'ARTICLE 12.- Compétence générale des juridictions de la République',
        'Sous réserve des exceptions prévues au présent Chapitre, les juridictions sont compétentes.',
        'ARTICLE 13.- Exclusion de la loi étrangère',
        'PRESIDENCE DE LA REPUBLIQUE',
        'SECRETARIAT GENERAL',
        'CHAPITRE IV',
        'DE LA LOI ET DES SENTENCES PENALES ETRANGERES',
        'Sous réserve des articles 9 et 10 et du présent Chapitre, la loi pénale étrangère est sans effet.',
        'ARTICLE 14.- Sentences étrangères',
      ].join('\n'),
    );
    const [douze, treize, quatorze] = texte.articles;
    expect(treize.titre).toBe('Exclusion de la loi étrangère');
    expect(treize.lignes).toEqual([
      'Sous réserve des articles 9 et 10 et du présent Chapitre, la loi pénale étrangère est sans effet.',
    ]);
    expect(enTetePrincipal(texte.divisions[douze.division])).toBeNull();
    const chapitre = enTetePrincipal(texte.divisions[treize.division]);
    expect(chapitre).toMatchObject({ numeral: 'IV', intitule: 'DE LA LOI ET DES SENTENCES PENALES ETRANGERES' });
    // Le tampon suit l'en-tête, hors de l'article.
    expect(chapitre?.lignes).toEqual(['PRESIDENCE DE LA REPUBLIQUE', 'SECRETARIAT GENERAL']);
    expect(quatorze.division).toBe(treize.division);
  });

  it('ne prend pas pour un intitulé l’abrogation écrite sur la ligne de l’article (Code civil)', () => {
    const texte = decouperLeTexte(
      [
        'Art. 773. - Abrogé par L. 25 mars 1896',
        "CHAP. V De l'acceptation et de la répudiation des successions.",
        "SECT. I De l'acceptation.",
        'Art. 775. - Nul n’est tenu d’accepter une succession qui lui est échue.',
      ].join('\n'),
    );
    const [abroge, suivant] = texte.articles;
    expect(abroge.lignes).toEqual([]);
    expect(enTetePrincipal(texte.divisions[abroge.division])).toBeNull();
    expect(enTetePrincipal(texte.divisions[suivant.division])?.numeral).toBe('V');
  });
});

describe('numéros des divisions', () => {
  const titres = (contenu: string) =>
    decouperLeTexte(contenu).divisions.flatMap((d) => d.entetes.map((e) => libelleDeDivision(e, traduire)));

  it('lit « 11 » après « 1 » comme le II romain, écrit comme son voisin', () => {
    expect(
      titres('CHAPITRE 1: DU PRÉSIDENT\nArticle 5.- a\nCHAPITRE 11: DU GOUVERNEMENT\nArticle 11.- b'),
    ).toEqual(['Chapitre 1', 'Chapitre 2']);
  });

  it('répare un numéro illisible ou déjà pris, encadré par la suite (Constitution)', () => {
    expect(
      titres(
        [
          'TITRE UII DU CONSEIL CONSTITUTIONNEL',
          'Article 46.- a',
          'TITRE UIL DE LA HAUTE COUR DE JUSTICE',
          'Article 53.- b',
          'TITRE IX DU CONSEIL ÉCONOMIQUE ET SOCIAL',
          'Article 54.- c',
          'TITRE X DES COLLECTIVITÉS TERRITORIALES',
          'Article 55.- d',
          'TITRE IX DE LA RÉVISION DE LA CONSTITUTION',
          'Article 63.- e',
          'TITRE XII DES DISPOSITIONS SPÉCIALES',
          'Article 65.- f',
        ].join('\n'),
      ),
    ).toEqual(['Titre VII', 'Titre VIII', 'Titre IX', 'Titre X', 'Titre XI', 'Titre XII']);
    expect(titres('CHAPITRE II A\nArticle 1.- a\nCHAPITRE II B\nArticle 2.- b\nCHAPITRE IV C\nArticle 3.- c')).toEqual([
      'Chapitre II',
      'Chapitre III',
      'Chapitre IV',
    ]);
  });

  it('laisse un numéro lisible et neuf, même hors de la suite (loi de finances)', () => {
    expect(titres('TITRE II A\nArticle 1.- a\nTITRE V B\nArticle 2.- b\nTITRE IV C\nArticle 3.- c')).toEqual([
      'Titre II',
      'Titre V',
      'Titre IV',
    ]);
  });
});

describe('divisions', () => {
  it('reconnaît les en-têtes que l’ancienne règle ratait', () => {
    expect(lireEnTete('CHAPITREI DISPOSITIONS GENERALES')).toMatchObject({
      mot: 'chapitre',
      numeral: 'I',
      intitule: 'DISPOSITIONS GENERALES',
    });
    expect(lireEnTete("TITRE PREMIER DE L'ÉTAT ET DE LA SOUVERAINETÉ")).toMatchObject({
      mot: 'titre',
      numeral: 'PREMIER',
    });
    expect(lireEnTete("Section 1 – Le champ d'application et les définitions")).toMatchObject({
      mot: 'section',
      numeral: '1',
      intitule: "Le champ d'application et les définitions",
    });
    expect(lireEnTete('TITRE I.- DISPOSITIONS GENERALES')?.intitule).toBe('DISPOSITIONS GENERALES');
    expect(lireEnTete('CHAP. IV Des actes de décès.')).toMatchObject({ mot: 'chapitre', numeral: 'IV' });
    expect(lireEnTete('CHAPITRE 12 DES INFRACTIONS')?.numeral).toBe('12');
    expect(lireEnTete('CHAPITRE V')?.intitule).toBe('');
  });

  it('répare les chiffres romains mal lus, pas les nombres', () => {
    expect(lireEnTete('TITRE I1 DU POUVOIR EXÉCUTIF')?.numeral).toBe('II');
    expect(lireEnTete('TITRE I11 DU POUVOIR LÉGISLATIF')?.numeral).toBe('III');
    expect(lireEnTete('TITRE IU DES RAPPORTS')?.numeral).toBe('IV');
    expect(lireEnTete('TITREU DU POUVOIR JUDICIAIRE')?.numeral).toBe('V');
    expect(lireEnTete('CHAPITRE 11 : DUSENAT')?.numeral).toBe('11');
  });

  it('laisse les phrases qui commencent par un mot de division', () => {
    expect(lireEnTete('Section 2 du présent chapitre est abrogée.')).toBeNull();
    expect(lireEnTete('Titre II du code général des impôts')).toBeNull();
    expect(lireEnTete('TITRES ET DIPLÔMES')).toBeNull();
  });

  it('prend la ligne suivante pour intitulé, et les visas pour l’ouverture', () => {
    const texte = decouperLeTexte(
      [
        'LE PRESIDENT DE LA REPUBLIQUE,',
        'Vu la Constitution ;',
        'DECRETE :',
        'CHAPITREI DISPOSITIONS GENERALES',
        'Article 1er.- Le présent décret.',
        'CHAPITRE V',
        'DE LA DELIVRANCE DE CERTAINS DOCUMENTS DE TRANSPORT',
        'Article 12.- La Région assure la délivrance.',
      ].join('\n'),
    );
    expect(texte.structure).toBe(true);
    expect(texte.divisions).toHaveLength(3);
    expect(texte.divisions[0].introduction).toEqual(['LE PRESIDENT DE LA REPUBLIQUE,', 'Vu la Constitution ;', 'DECRETE :']);
    expect(texte.divisions[0].articles).toEqual([]);
    expect(enTetePrincipal(texte.divisions[2])?.intitule).toBe('DE LA DELIVRANCE DE CERTAINS DOCUMENTS DE TRANSPORT');
    expect(texte.articles.map((a) => a.division)).toEqual([1, 2]);
  });

  it('enchaîne les en-têtes sans article, et ne garde au sommaire que ceux qui contiennent', () => {
    const texte = decouperLeTexte(
      [
        'TITRE I1 DU POUVOIR EXÉCUTIF',
        'CHAPITRE 1: DU PRÉSIDENT DE LA RÉPUBLIQUE',
        'Article 5.- Le Président.',
        'CHAPITRE 11:',
        'TITRE I11 DU POUVOIR LÉGISLATIF',
        'Article 14.- Le pouvoir législatif.',
      ].join('\n'),
    );
    const [executif, legislatif] = texte.divisions;
    expect(executif.entetes.map((e) => e.numeral)).toEqual(['II', '1']);
    expect(enTetesDuSommaire(executif).map((e) => e.mot)).toEqual(['titre', 'chapitre']);
    expect(legislatif.entetes.map((e) => e.mot)).toEqual(['chapitre', 'titre']);
    // Le chapitre resté vide finit le titre II : il ne nomme pas le titre III.
    expect(enTetesDuSommaire(legislatif).map((e) => e.numeral)).toEqual(['III']);
    expect(legislatif.ancetres.map((e) => e.numeral)).toEqual(['III']);
    expect(executif.ancetres.map((e) => e.numeral)).toEqual(['II', '1']);
  });

  it('coupe un article collé par l’OCR à une ligne de division (loi 90/053)', () => {
    const texte = decouperLeTexte(
      "CHAPITREI DE LA CREATION Art. 6: sous réserve des cas de nullité prévus à l'article 4 ci-dessus.",
    );
    expect(enTetePrincipal(texte.divisions[0])?.intitule).toBe('DE LA CREATION');
    expect(texte.articles.map((a) => [a.numero, a.titre])).toEqual([
      ['6', "sous réserve des cas de nullité prévus à l'article 4 ci-dessus."],
    ]);
  });

  it('résume le texte par ses divisions du plus haut rang (« 13 titres », « 7 chapitres »)', () => {
    // Titre II puis ses deux chapitres, titre III : deux titres, pas trois « parties ».
    const constitution = decouperLeTexte(
      [
        'TITRE PREMIER DE L’ÉTAT',
        'Article 1er.- a',
        'TITRE II DU POUVOIR EXÉCUTIF',
        'CHAPITRE 1 DU PRÉSIDENT',
        'Article 5.- b',
        'CHAPITRE 2 DU GOUVERNEMENT',
        'Article 11.- c',
        'TITRE III DU POUVOIR LÉGISLATIF',
        'Article 14.- d',
      ].join('\n'),
    );
    expect(divisionsPrincipales(constitution)).toEqual({ mot: 'titre', nombre: 3 });
    // Un seul titre : ses chapitres structurent le texte.
    const decret = decouperLeTexte('TITRE I X\nCHAPITRE I A\nArticle 1.- a\nCHAPITRE II B\nArticle 2.- b');
    expect(divisionsPrincipales(decret)).toEqual({ mot: 'chapitre', nombre: 2 });
    expect(divisionsPrincipales(decouperLeTexte('Article 1.- a\nArticle 2.- b'))).toBeNull();
  });

  it('donne une plage croissante, sinon rien', () => {
    const texte = decouperLeTexte('TITRE I X\nArticle 7.- a\nArticle 11.- b\nTITRE II Y\nArticle 34.- c\nArticle 11.- d');
    expect(plageDArticles(texte.divisions[0])).toEqual({ de: '7', a: '11' });
    expect(plageDArticles(texte.divisions[1])).toBeNull();
  });

  it('nomme une division dans la langue de l’interface', () => {
    expect(libelleDeDivision({ mot: 'chapitre', numeral: 'III' }, traduire)).toBe('Chapitre III');
    expect(libelleDeDivision({ mot: 'titre', numeral: 'PREMIER' }, traduire)).toBe('Titre premier');
    expect(libelleDeDivision({ mot: 'section', numeral: 'PREMIÈRE' }, traduire)).toBe('Section première');
    expect(libelleDeDivision({ mot: 'titre', numeral: 'PRELIMINAIRE' }, traduire)).toBe('Titre préliminaire');
    expect(libelleDeDivision({ mot: 'titre', numeral: 'PREMIER' }, anglais)).toBe('Title I');
    expect(libelleDeDivision({ mot: 'chapitre', numeral: 'PRÉLIMINAIRE' }, anglais)).toBe('Preliminary chapter');
  });

  it('rend un texte vide sans planter', () => {
    expect(decouperLeTexte('')).toEqual({ divisions: [], articles: [], structure: false });
    expect(decouperLeTexte(null).articles).toEqual([]);
    const sansArticle = decouperLeTexte('Texte sans structure.\nDeuxième ligne.');
    expect(sansArticle.structure).toBe(false);
    expect(sansArticle.divisions[0].introduction).toEqual(['Texte sans structure.', 'Deuxième ligne.']);
  });
});

describe('filtre du sommaire', () => {
  const [securite, douze] = decouperLeTexte(
    [
      'Article 7.- La Région participe aux actions de PRÉVENTION et de SÉCURITÉ routières.',
      'Article 12.- Le délai est de 12 mois.',
    ].join('\n'),
  ).articles;

  it('plie sans changer la longueur', () => {
    expect(plier('SÉCURITÉ Œuvre')).toBe('securite œuvre');
    expect(plier('SÉCURITÉ Œuvre')).toHaveLength('SÉCURITÉ Œuvre'.length);
  });

  it('ignore casse et accents, et rend l’occurrence mot pour mot', () => {
    const trouve = filtrerLArticle(securite, 'securite');
    expect(trouve).toMatchObject({ trouve: 'SÉCURITÉ' });
    if (typeof trouve === 'object') {
      expect(`${trouve.avant}${trouve.trouve}${trouve.apres}`).toContain('PRÉVENTION et de SÉCURITÉ routières.');
    }
    expect(filtrerLArticle(securite, 'santé')).toBe(false);
  });

  it('cherche aussi le numéro d’un article', () => {
    expect(filtrerLArticle(douze, '12')).toBe(true);
    expect(filtrerLArticle(securite, '  ')).toBe(true);
  });
});
