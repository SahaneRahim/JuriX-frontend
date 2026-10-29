import { describe, expect, it } from 'vitest';

import { blocsDeReponse } from '$lib/texte';
import type { CitationIntrouvable, CitationPositionnee, StatutProuve } from '$lib/types';
import {
  articleDuPassage,
  bruitDeNumerisation,
  langueProbable,
  marquerLesCitations,
  paragraphesDeLArticle,
  passageLePlusProche,
  phraseAutour,
  rattacherLesElisions,
  sansMarques,
  segmentsDuTexte,
  type Segment,
} from './citations';

/**
 * La réponse réelle du contrat (contrat-api.md §7.3, flux de
 * notes/api/exemples/chat-flux.txt) : trois citations retrouvées, deux
 * introuvables, un émoji (deux unités UTF-16) en tête pour éprouver les bornes.
 */
const REPONSE =
  "📌 **Réponse directe** : selon l'article 35 de la loi n° 92/007, l'indemnité est due. L'article 120 du décret n° 94/199 précise les conditions. L'article 9999 de la loi n° 92/007 fixerait le barème, et l'article 312 du Code pénal réprime les abus. Voir aussi la loi n° 92/007.";

const RIEN: StatutProuve = { etat: null, liens: [], lignes: [] };

function citation(debut: number, fin: number, texte_cite: string, article: string | null): CitationPositionnee {
  return {
    debut,
    fin,
    texte_cite,
    law_id: 2274,
    article,
    article_id: article ? 97421 : null,
    reference: 'LOI-1992-007',
    titre: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
    date_du_texte: '1992-08-14',
    statut: RIEN,
  };
}

const CITATIONS: CitationPositionnee[] = [
  citation(33, 63, 'article 35 de la loi n° 92/007', '35'),
  citation(88, 119, 'article 120 du décret n° 94/199', '120'),
  citation(262, 275, 'loi n° 92/007', null),
];
const INTROUVABLES: CitationIntrouvable[] = [
  { debut: 146, fin: 178, texte_cite: 'article 9999 de la loi n° 92/007', raison: 'article_non_consulte' },
  { debut: 204, fin: 229, texte_cite: 'article 312 du Code pénal', raison: 'texte_non_consulte' },
];

/** Les segments d'un texte marqué, réduits à ce qu'on lit : « [c0:…] », « [i1:…] ». */
function lecture(segments: Segment[]): string {
  return segments
    .map((s) => (s.genre === 'texte' ? s.texte : `[${s.genre === 'citation' ? 'c' : 'i'}${s.index}:${s.texte}]`))
    .join('');
}

describe('marquerLesCitations', () => {
  it('pose les marques aux bornes du serveur, emoji compris', () => {
    const marque = marquerLesCitations(REPONSE, { citations: CITATIONS, citations_introuvables: INTROUVABLES });

    expect(marque).not.toBeNull();
    expect(lecture(segmentsDuTexte(marque!.texte))).toBe(
      "📌 **Réponse directe** : selon l'[c0:article 35 de la loi n° 92/007], l'indemnité est due. L'[c1:article 120 du décret n° 94/199] précise les conditions. L'[i0:article 9999 de la loi n° 92/007] fixerait le barème, et l'[i1:article 312 du Code pénal] réprime les abus. Voir aussi la [c2:loi n° 92/007].",
    );
    expect(sansMarques(marque!.texte)).toBe(REPONSE);
  });

  it('les marques traversent le découpage en blocs, emphase retirée', () => {
    const marque = marquerLesCitations(REPONSE, { citations: CITATIONS, citations_introuvables: INTROUVABLES })!;
    const blocs = blocsDeReponse(marque.texte);

    expect(blocs).toHaveLength(1);
    const segments = segmentsDuTexte(blocs[0].texte);
    expect(segments.filter((s) => s.genre === 'citation').map((s) => s.texte)).toEqual([
      'article 35 de la loi n° 92/007',
      'article 120 du décret n° 94/199',
      'loi n° 92/007',
    ]);
    expect(segments.filter((s) => s.genre === 'introuvable')).toHaveLength(2);
    // La punaise de tête est retirée au découpage ($lib/texte.sansPictogrammes) :
    // les marques, posées avant, restent à leur place.
    expect(lecture(segments)).toMatch(/^Réponse directe : selon l'\[c0:article 35/);
  });

  it('une citation dans une emphase, une puce ou un tableau garde sa marque', () => {
    const texte = '- voir _le décret n° 94/199_ ici\n\n| Texte | Article |\n|---|---|\n| Code du travail | article 37 |';
    const debut = texte.indexOf('décret');
    const debutTableau = texte.indexOf('article 37');
    const marque = marquerLesCitations(texte, {
      citations: [
        { ...citation(debut, debut + 'décret n° 94/199'.length, 'décret n° 94/199', null) },
        { ...citation(debutTableau, debutTableau + 10, 'article 37', '37') },
      ],
    })!;
    const blocs = blocsDeReponse(marque.texte);

    expect(blocs[0].type).toBe('puce');
    expect(lecture(segmentsDuTexte(blocs[0].texte))).toBe('voir le [c0:décret n° 94/199] ici');
    expect(blocs[1].type).toBe('tableau');
    expect(lecture(segmentsDuTexte(blocs[1].lignes![0][1]))).toBe('[c1:article 37]');
  });

  it('ignore une citation dont les bornes ne tombent pas sur son texte', () => {
    const marque = marquerLesCitations(REPONSE, {
      citations: [citation(34, 63, 'article 35 de la loi n° 92/007', '35'), CITATIONS[1]],
    })!;

    expect(marque.citations).toHaveLength(1);
    expect(lecture(segmentsDuTexte(marque.texte))).toContain('[c0:article 120 du décret n° 94/199]');
  });

  it('rend null sans rien à marquer : ancienne API, listes vides, bornes fausses', () => {
    expect(marquerLesCitations(REPONSE, undefined)).toBeNull();
    expect(marquerLesCitations(REPONSE, {})).toBeNull();
    expect(marquerLesCitations(REPONSE, { citations: [], citations_introuvables: [] })).toBeNull();
    expect(marquerLesCitations('Réponse vide remplacée', { citations: CITATIONS })).toBeNull();
    expect(marquerLesCitations('', { citations: CITATIONS })).toBeNull();
  });

  it('refuse un texte qui contient déjà un caractère de la zone privée', () => {
    expect(marquerLesCitations(`\uE000${REPONSE}`, { citations: CITATIONS })).toBeNull();
  });

  it('garde la première de deux citations qui se chevauchent', () => {
    const marque = marquerLesCitations(REPONSE, {
      citations: [CITATIONS[0]],
      citations_introuvables: [{ debut: 50, fin: 63, texte_cite: 'loi n° 92/007', raison: 'texte_non_consulte' }],
    })!;

    expect(lecture(segmentsDuTexte(marque.texte))).toContain('[c0:article 35 de la loi n° 92/007]');
    expect(segmentsDuTexte(marque.texte).some((s) => s.genre === 'introuvable')).toBe(false);
  });
});

describe('segmentsDuTexte', () => {
  it('un texte sans marque reste un seul segment', () => {
    expect(segmentsDuTexte('Texte simple.')).toEqual([{ genre: 'texte', texte: 'Texte simple.' }]);
    expect(segmentsDuTexte('')).toEqual([]);
  });

  it('une citation coupée par une ligne vide court jusqu’à la fin du premier bloc', () => {
    const texte = 'avant article 5\n\nde la loi après';
    const marque = marquerLesCitations(texte, {
      citations: [citation(6, 26, 'article 5\n\nde la loi', '5')],
    })!;
    const blocs = blocsDeReponse(marque.texte);

    expect(lecture(segmentsDuTexte(blocs[0].texte))).toBe('avant [c0:article 5]');
    expect(lecture(segmentsDuTexte(blocs[1].texte))).toBe('de la loi après');
  });

  it('retire une marque égarée sans l’afficher', () => {
    expect(lecture(segmentsDuTexte('a\uE002b\uE123c'))).toBe('abc');
  });
});

describe('segmentsDuTexte et le gras ($lib/texte, mode `gras`)', () => {
  it('la graisse suit le texte, et la citation qu’il contient', () => {
    const texte = '**Selon l’article 5**, rien.';
    const debut = texte.indexOf('article 5');
    const marque = marquerLesCitations(texte, { citations: [citation(debut, debut + 9, 'article 5', '5')] })!;
    const [bloc] = blocsDeReponse(marque.texte, { gras: true });

    expect(segmentsDuTexte(bloc.texte)).toEqual([
      { genre: 'texte', texte: 'Selon l’', gras: true },
      { genre: 'citation', texte: 'article 5', index: 0, gras: true },
      { genre: 'texte', texte: ', rien.' },
    ]);
    // Le mot élidé passe au lien, le reste du texte garde sa graisse.
    expect(rattacherLesElisions(segmentsDuTexte(bloc.texte))).toEqual([
      { genre: 'texte', texte: 'Selon ', gras: true },
      { genre: 'citation', texte: 'l’article 5', index: 0, gras: true },
      { genre: 'texte', texte: ', rien.' },
    ]);
  });

  it('sans le mode `gras`, rien ne change : l’emphase est retirée, sans marque', () => {
    expect(segmentsDuTexte(blocsDeReponse('**Réponse directe** : oui.')[0].texte)).toEqual([
      { genre: 'texte', texte: 'Réponse directe : oui.' },
    ]);
  });
});

describe('rattacherLesElisions', () => {
  it('fait commencer chaque citation, retrouvée ou introuvable, au mot élidé qui la précède', () => {
    const marque = marquerLesCitations(REPONSE, { citations: CITATIONS, citations_introuvables: INTROUVABLES })!;
    const segments = rattacherLesElisions(segmentsDuTexte(blocsDeReponse(marque.texte)[0].texte));

    // « selon l’ § article 35 » se lisait l’icône entre l’élision et le nom ;
    // « l’ » restait hors des tirets d'une introuvable, et dans le lien d'une
    // retrouvée : deux rendus pour la même forme (revue du chat, 29/10).
    expect(lecture(segments)).toBe(
      "Réponse directe : selon [c0:l'article 35 de la loi n° 92/007], l'indemnité est due. [c1:L'article 120 du décret n° 94/199] précise les conditions. [i0:L'article 9999 de la loi n° 92/007] fixerait le barème, et [i1:l'article 312 du Code pénal] réprime les abus. Voir aussi la [c2:loi n° 92/007].",
    );
  });

  it('apostrophe typographique, « d’ », « qu’ » ; pas d’élision, rien ne bouge', () => {
    const c = (texte: string): Segment => ({ genre: 'citation', texte, index: 0 });
    const i = (texte: string): Segment => ({ genre: 'introuvable', texte, index: 0 });
    const t = (texte: string): Segment => ({ genre: 'texte', texte });

    expect(lecture(rattacherLesElisions([t('en vertu de l’'), c('article 5')]))).toBe('en vertu de [c0:l’article 5]');
    expect(lecture(rattacherLesElisions([t('au sens d’'), c('Acte uniforme')]))).toBe('au sens [c0:d’Acte uniforme]');
    expect(lecture(rattacherLesElisions([t('l’'), c('article 5')]))).toBe('[c0:l’article 5]');
    expect(lecture(rattacherLesElisions([t('selon la '), c('loi n° 92/007')]))).toBe('selon la [c0:loi n° 92/007]');
    // Une apostrophe qui ferme une citation entre guillemets simples n'est pas une élision.
    expect(lecture(rattacherLesElisions([t("le mot 'loi'"), c('article 5')]))).toBe("le mot 'loi'[c0:article 5]");
    // Une introuvable, comme la maquette chat-p3a : le groupe entier sous les tirets.
    expect(lecture(rattacherLesElisions([t('prévu par l’'), i('arrêté n° 016/MTPS/SG/CJ du 26 mai 1993')]))).toBe(
      'prévu par [i0:l’arrêté n° 016/MTPS/SG/CJ du 26 mai 1993]',
    );
    expect(lecture(rattacherLesElisions([t('selon la '), i('loi n° 92/007')]))).toBe('selon la [i0:loi n° 92/007]');
  });

  it('une introuvable dans un gras prend le mot élidé ; le texte d’avant garde sa graisse', () => {
    expect(
      rattacherLesElisions([
        { genre: 'texte', texte: 'Selon l’', gras: true },
        { genre: 'introuvable', texte: 'article 9999', index: 0, gras: true },
        { genre: 'texte', texte: ', rien.' },
      ]),
    ).toEqual([
      { genre: 'texte', texte: 'Selon ', gras: true },
      { genre: 'introuvable', texte: 'l’article 9999', index: 0, gras: true },
      { genre: 'texte', texte: ', rien.' },
    ]);
  });
});

describe('articleDuPassage', () => {
  /** Le morceau « 35.1 » du Code du travail (loi 2274, base locale), raccourci : cinq articles d'un bloc. */
  const CODE_DU_TRAVAIL_35 =
    "(1) Pendant la durée du préavis, l'employeur et le travailleur sont tenus au respect de toutes les obligations réciproques qui leur incombent. (3) La partie à l'égard de laquelle ces obligations ne seraient pas respectées ne pourra se voir imposer un délai de préavis, sans préjudice des dommages-intérêts qu'elle jugerait bon de demander. Article 36.- (1) Toute rupture de contrat à durée indéterminée, sans préavis, emporte obligation pour la partie responsable de verser à lu se e e o n u ne out,l nature dont aurait bénéficié le travailleur. Article 37.- (1) En cas de rupture de contrat à durée indéterminée du fait de l'employeur, le travailleur ayant accompli dans l'entreprise une durée de service continue au moins égale à deux (2) ans, a droit à une indemnité de licenciement. Article 38.- Le contrat de travail à durée déterminée ne peut cesser avant terme qu'en cas de faute lourde.";

  it('s’arrête au premier en-tête d’un autre article', () => {
    const decoupe = articleDuPassage(CODE_DU_TRAVAIL_35, '35');

    expect(decoupe.suivant).toBe('36');
    expect(decoupe.recadre).toBe(false);
    const article = CODE_DU_TRAVAIL_35.slice(decoupe.debut, decoupe.fin).trim();
    expect(article.endsWith("qu'elle jugerait bon de demander.")).toBe(true);
    expect(article).not.toContain('Article 36');
    // Le passage de l'article 37 ne peut plus être mis en gras sous « Art. 35 ».
    expect(passageLePlusProche(article, ["l'indemnité de licenciement est due après deux ans de service continu"])).toBeNull();
  });

  it('formes réelles d’en-tête : « Art..5- », « ARTICLE 2 : », « Article 7 bis.- »', () => {
    expect(articleDuPassage('Texte du 4. Art..5- (1) Texte du 5.', '4').suivant).toBe('5');
    expect(articleDuPassage('Texte du 1er. ARTICLE 2 : texte du 2.', '1er').suivant).toBe('2');
    expect(articleDuPassage('Texte du 7. Article 7 bis.- Texte du 7 bis.', '7').suivant).toBe('7 bis');
    expect(articleDuPassage('Texte du 7 bis. Article 8.- Texte du 8.', '7 bis').suivant).toBe('8');
    expect(articleDuPassage('Article premier.- Texte du 1. Article 2.- Texte du 2.', '1').suivant).toBe('2');
  });

  it('ni une nomenclature de budget, ni un numéro à trait d’union, ni un débris d’OCR (base locale)', () => {
    // Loi de finances 2200, article 7 ; décrets de répartition 2208 et 2220.
    const budget =
      "Crédits inscrits au budget de l'Etat-Exercice 2023-Chapitre 02-Article 101-Paragraphe 100. Exercice 2021 – Chapitre 12 – Article 390000 – Paragraphe 6220.";
    expect(articleDuPassage(budget, '7').suivant).toBeNull();
    // Code CIMA (2287) : un sommaire dans le morceau.
    expect(articleDuPassage('Valeurs de réduction et de rachat, avances Article 74-1 Avance sur police.', '65').suivant).toBeNull();
    // Décret 2138 : la date d'un visa coupée par l'OCR.
    expect(articleDuPassage("Vu l'article 72 du Décret n°2012/539 du 19 Article 3: Novembre 2012 susvisé.", '1').suivant).toBeNull();
    // Un intitulé de division en capitales, lui, précède un vrai en-tête (Code de procédure pénale, 2283).
    expect(
      articleDuPassage('Fin de l’article 243. Chapitre IX DE LA SURVEILLANCE JUDICIAIRE Article 246 — Le Juge d’Instruction…', '243')
        .suivant,
    ).toBe('246');
  });

  it('un renvoi, ou le texte qu’une loi modificative cite, ne coupe rien', () => {
    const renvois =
      "Les dispositions de l'article 34 alinéa (1) ci-dessus ne s'appliquent pas, ni celles prévues à l’article 36 : voir article 37 - en entier.";
    expect(articleDuPassage(renvois, '40')).toEqual({ debut: 0, fin: renvois.length, suivant: null, recadre: false });

    const modificative =
      'Les articles 5 et 6 de la loi n° 90/053 sont modifiés ainsi qu’il suit : « Article 5.- Nouveau texte du 5. » Article 6 (nouveau).- Nouveau texte du 6. Article 2.- La présente loi sera enregistrée.';
    const decoupe = articleDuPassage(modificative, '1');
    expect(decoupe.suivant).toBe('2');
    expect(modificative.slice(decoupe.debut, decoupe.fin)).toContain('Nouveau texte du 6.');
  });

  it('un passage englobant se recadre sur l’en-tête de l’article, et seulement sur lui', () => {
    // Loi 90/053 : l'article 5 est collé à la fin du morceau « 2 ».
    const morceau = 'Texte de l’article 2. Art..5- (1) Le texte du 5. ARTICLE 6.- Le texte du 6.';
    const decoupe = articleDuPassage(morceau, '5', true);

    expect(decoupe.recadre).toBe(true);
    expect(morceau.slice(decoupe.debut, decoupe.fin).trim()).toBe('Art..5- (1) Le texte du 5.');
    // Sans son en-tête, rien ne dit où l'article commence : tout le passage.
    const sansEnTete = 'Texte du 2. Texte du 5 sans en-tête.';
    expect(articleDuPassage(sansEnTete, '5', true)).toEqual({ debut: 0, fin: sansEnTete.length, suivant: null, recadre: false });
  });

  it('rien à couper : pas d’autre en-tête, numéro absent, ou coupe qui ne laisserait rien', () => {
    expect(articleDuPassage('(1) Un seul article.\n(2) Suite.', '9').suivant).toBeNull();
    expect(articleDuPassage(CODE_DU_TRAVAIL_35, null).suivant).toBeNull();
    expect(articleDuPassage('Article 36.- Le texte du 36.', '35').suivant).toBeNull();
    expect(articleDuPassage('', '35').suivant).toBeNull();
  });
});

describe('bruitDeNumerisation', () => {
  it('reconnaît les lettres isolées qu’un OCR laisse à la place d’un passage', () => {
    expect(bruitDeNumerisation('verser à lu se e e o n u ne out,l nature dont aurait bénéficié')).toBe(true);
    expect(bruitDeNumerisation('Sont no s s s s s du tras sn sa-s s no sae s nlecat (2) La juridiction')).toBe(true);
  });

  it('pas sur un texte propre, ni sur une énumération ponctuée', () => {
    expect(bruitDeNumerisation(ARTICLE_37)).toBe(false);
    expect(bruitDeNumerisation('il y a à payer une indemnité')).toBe(false);
    expect(bruitDeNumerisation('aux alinéas a, b, c et d ci-dessus')).toBe(false);
    expect(bruitDeNumerisation('')).toBe(false);
  });
});

describe('phraseAutour', () => {
  it('rend la phrase qui porte la citation, sans la citation', () => {
    expect(phraseAutour(REPONSE, 33, 63)).toBe("📌 **Réponse directe** : selon l' , l'indemnité est due");
  });

  it('ne coupe pas la phrase sur « art. »', () => {
    const texte =
      'Préambule. Vous avez droit à une indemnité distincte du préavis (Code du travail, art. 37). Elle n’est pas due en cas de faute lourde.';
    const debut = texte.indexOf('Code du travail');

    expect(phraseAutour(texte, debut, debut + 'Code du travail, art. 37'.length)).toBe(
      'Vous avez droit à une indemnité distincte du préavis ( )',
    );
  });

  it('s’arrête aux retours à la ligne', () => {
    const texte = '**Titre**\nPremière ligne avec article 5\nSeconde ligne';
    const debut = texte.indexOf('article 5');

    expect(phraseAutour(texte, debut, debut + 9)).toBe('Première ligne avec');
  });

  it('rend une chaîne vide sur des bornes impossibles', () => {
    expect(phraseAutour('abc', 2, 1)).toBe('');
    expect(phraseAutour('abc', 0, 9)).toBe('');
  });
});

/** L'article 37 du Code du travail, tel que l'aperçu le rend (maquette chat-p3a-apercu). */
const ARTICLE_37 =
  "(1) En cas de rupture de contrat à durée indéterminée du fait de l'employeur, hormis le cas de faute lourde, le travailleur ayant accompli dans l'entreprise une durée de service continue au moins égale à deux (2) ans, a droit à une indemnité de licenciement distincte de celle du préavis dont la détermination tient compte de l'ancienneté.\n(2) Un arrêté du ministre chargé du Travail, pris après avis de la Commission nationale consultative du travail, fixe les modalités d'attribution et de calcul de l'indemnité de licenciement.";

describe('passageLePlusProche', () => {
  it('met en gras le passage de l’article que la phrase reprend', () => {
    // Telle que `phraseAutour` la rend : la phrase seule, sans la citation.
    const phrase =
      'Si vous comptez au moins deux ans de service continu dans l’entreprise, vous avez droit à une indemnité de licenciement, distincte de l’indemnité de préavis ( )';
    const passage = passageLePlusProche(ARTICLE_37, [phrase]);

    expect(passage).not.toBeNull();
    const gras = ARTICLE_37.slice(passage!.debut, passage!.fin);
    expect(gras.startsWith('le travailleur ayant accompli')).toBe(true);
    expect(gras).toContain('a droit à une indemnité de licenciement distincte de celle du préavis');
    // Ni le cas de rupture, ni l'alinéa 2.
    expect(gras).not.toContain('rupture');
    expect(gras).not.toContain('arrêté du ministre');
  });

  it('ne met rien en gras sur une phrase trop courte ou sans rapport', () => {
    expect(passageLePlusProche(ARTICLE_37, ['Voir aussi ( ).'])).toBeNull();
    expect(passageLePlusProche(ARTICLE_37, ['Le bail commercial se renouvelle tous les deux ans au moins'])).toBeNull();
    expect(passageLePlusProche(ARTICLE_37, [])).toBeNull();
    expect(passageLePlusProche('', ['indemnité de licenciement distincte du préavis'])).toBeNull();
  });

  it('ne met pas en gras un article presque entier : le gras ne désignerait plus rien', () => {
    const court = 'Le travailleur licencié a droit à une indemnité de licenciement distincte du préavis.';
    expect(
      passageLePlusProche(court, ['Le travailleur licencié a droit à une indemnité de licenciement distincte du préavis']),
    ).toBeNull();
  });
});

describe('paragraphesDeLArticle', () => {
  it('coupe chaque paragraphe autour de sa part du passage', () => {
    const contenu = 'Premier alinéa.\n\nSecond alinéa, très long.';
    const debut = contenu.indexOf('alinéa.');
    const fin = contenu.indexOf(', très');

    expect(paragraphesDeLArticle(contenu, { debut, fin })).toEqual([
      { avant: 'Premier ', gras: 'alinéa.', apres: '' },
      { avant: '', gras: 'Second alinéa', apres: ', très long.' },
    ]);
  });

  it('sans passage, rend les paragraphes tels quels, lignes vides retirées', () => {
    expect(paragraphesDeLArticle('a\n\n  \nb', null)).toEqual([
      { avant: 'a', gras: '', apres: '' },
      { avant: 'b', gras: '', apres: '' },
    ]);
  });
});

describe('paragraphesDeLArticle : les alinéas collés sur une ligne', () => {
  it('un paragraphe par alinéa numéroté, coupé après une fin de phrase seulement (capture chat-apercu r2)', () => {
    const contenu =
      '(1) Pendant la durée du préavis, les parties sont tenues de leurs obligations. (2) En vue de la recherche d’un autre emploi, le travailleur bénéficie de deux (2) jours ; (3) La partie lésée peut demander réparation selon l’alinéa (1) ci-dessus.';

    expect(paragraphesDeLArticle(contenu, null).map((p) => p.avant)).toEqual([
      '(1) Pendant la durée du préavis, les parties sont tenues de leurs obligations.',
      '(2) En vue de la recherche d’un autre emploi, le travailleur bénéficie de deux (2) jours ;',
      '(3) La partie lésée peut demander réparation selon l’alinéa (1) ci-dessus.',
    ]);
  });

  it('un numéro qui ne continue pas la numérotation reste dans sa phrase', () => {
    expect(paragraphesDeLArticle('(1) Voir le chapitre. (7) Sans suite.', null)).toHaveLength(1);
    // Un alinéa perdu par l'OCR (« (2) ») ne retient pas le suivant.
    expect(paragraphesDeLArticle('(1) Premier. (3) Troisième.', null)).toHaveLength(2);
    // Sans numéro en tête (en-tête d'article recadré), la numérotation part de (1) ou (2).
    expect(paragraphesDeLArticle('Art..5- (1) Le texte. (2) La suite.', null).map((p) => p.avant)).toEqual([
      'Art..5- (1) Le texte.',
      '(2) La suite.',
    ]);
  });

  it('le gras suit les alinéas coupés, aux mêmes positions', () => {
    const contenu = '(1) Premier alinéa. (2) Second alinéa, très long.';
    const debut = contenu.indexOf('Second');
    const fin = contenu.indexOf(', très');

    expect(paragraphesDeLArticle(contenu, { debut, fin })).toEqual([
      { avant: '(1) Premier alinéa.', gras: '', apres: '' },
      { avant: '(2) ', gras: 'Second alinéa', apres: ', très long.' },
    ]);
  });
});

describe('langueProbable', () => {
  it('reconnaît un article en français et un article en anglais', () => {
    expect(langueProbable(ARTICLE_37)).toBe('fr');
    expect(
      langueProbable(
        'Where the contract of employment is terminated by the employer, the worker shall be entitled to a severance allowance of any amount fixed by the Minister.',
      ),
    ).toBe('en');
  });

  it('ne tranche pas sur trop peu de mots', () => {
    expect(langueProbable('Article 5')).toBeNull();
    expect(langueProbable('')).toBeNull();
  });
});
