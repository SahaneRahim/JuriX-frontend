import { describe, expect, it } from 'vitest';

import type { ArticleApercu, Changement, ChiffresDuCorpus, StatutProuve, TexteLie } from '$lib/types';
import {
  annonceDeFin,
  designationDuTexte,
  designationDuTexteCite,
  enPhrase,
  identiteDuTitre,
  joursSansZero,
  libelleDeLaCitation,
  libelleDeLEtape,
  lignesDuStatutDeLArticle,
  mentionDuStatut,
  nomRaccourci,
  phraseDuPerimetre,
  ponctuationFrancaise,
  typographieDesNumeros,
} from './libelles';

/** Les textes français proposés pour language.ts (clés listées au retour de l'agent). */
const FR: Record<string, string> = {
  'chat.citation.article': 'Art. {n} — {nom}',
  'chat.statut.aucune': 'aucune modification relevée par JuriX',
  'chat.statut.aucuneAu': 'aucune modification relevée par JuriX au {date}',
  'chat.statut.desArticles': 'des articles de ce texte ont été modifiés depuis',
  'chat.statut.par': '{etat} par {texte}',
  'chat.statut.etat.abroge': 'abrogé',
  'chat.statut.etat.remplace': 'remplacé',
  'chat.statut.etat.abroge_partiellement': 'abrogé en partie',
  'chat.statut.etat.modifie': 'modifié',
  'chat.statut.etat.complete': 'complété',
  'chat.apercu.article': 'Article {etat} par {texte}.',
  'chat.apercu.articleReecrit': 'Article {etat} par {texte} : réécrit en entier.',
  'chat.apercu.texte': 'Texte {etat} par {texte}.',
  'chat.apercu.texteEtat': 'Texte {etat}.',
  'chat.apercu.afficheOrigine': 'Texte affiché : version d’origine, non consolidée.',
  'chat.apercu.afficheConsolidee': 'Texte affiché : version qui intègre déjà les modifications de {textes}.',
  'chat.apercu.origine': 'Version d’origine, non consolidée.',
  'chat.apercu.consolidee': 'Version qui intègre déjà les modifications de {textes}.',
  'chat.apercu.aucune': 'Aucune modification relevée par JuriX au {date}.',
  'chat.apercu.aucunePourLArticle':
    'Aucune modification de cet article relevée par JuriX au {date} ; d’autres articles du texte ont été modifiés.',
  'chat.progress.waiting': 'Préparation de la réponse…',
  'chat.progress.found': '{n} articles trouvés : {textes}',
  'chat.progress.foundOne': '1 article trouvé : {textes}',
  'chat.announce.done': 'Réponse terminée.',
  'chat.announce.doneCited': 'Réponse terminée, {n} articles cités.',
  'chat.announce.doneCitedOne': 'Réponse terminée, 1 article cité.',
  'chat.announce.unfound': '{n} citations non retrouvées.',
  'chat.announce.unfoundOne': '1 citation non retrouvée.',
  'chat.welcome.scopeLastAdded':
    'Je réponds à partir de {n} {sources} (dernier texte ajouté à JuriX le {date}). Je ne connais ni la jurisprudence ni votre dossier.',
  'chat.welcome.scopeNoDate': 'Je réponds à partir de {n} {sources}. Je ne connais ni la jurisprudence ni votre dossier.',
  'chat.welcome.scopeGeneric':
    'Je réponds à partir des textes officiels publiés dans JuriX. Je ne connais ni la jurisprudence ni votre dossier.',
};
const t = (cle: string) => FR[cle] ?? cle;

const LOI_2026_002: TexteLie = {
  id: 1761,
  reference: 'PRC-10679',
  nature: 'loi',
  numero: '2026/002',
  titre: 'Loi N°2026/002 du 14 avril 2026 modifiant et complétant certaines dispositions de la Constitution',
  date_signature: '2026-04-14',
  annee: 2026,
  date_publication_jo: null,
  consultable: true,
};

describe('désignation des textes', () => {
  it('écrit « n° » avec une espace insécable', () => {
    expect(typographieDesNumeros('Loi N°92/007 et décret n°2000/287')).toBe('Loi n°\u00A092/007 et décret n°\u00A02000/287');
  });

  it('tire l’identité de l’intitulé, jusqu’à sa date', () => {
    expect(identiteDuTitre('Loi N°92/007 du 14 août 1992 portant Code du travail')).toBe('Loi n°\u00A092/007 du 14 août 1992');
    expect(identiteDuTitre('Code civil applicable au Cameroun, annoté de la jurisprudence')).toBeNull();
    expect(identiteDuTitre(null)).toBeNull();
  });

  it('écrit le jour sans son zéro, et le premier du mois « 1er » (capture chat-citations r2)', () => {
    expect(identiteDuTitre('Décret N°94/199 du 07 octobre 1994 portant Statut Général')).toBe(
      'Décret n°\u00A094/199 du 7 octobre 1994',
    );
    expect(joursSansZero('du 01 janvier 2020 et du 1 mars 2021')).toBe('du 1er janvier 2020 et du 1er mars 2021');
    // Deux chiffres sans zéro, une année, un numéro : rien ne bouge.
    expect(joursSansZero('du 10 octobre 2018, du 21 juin 2019, n° 2018/09')).toBe('du 10 octobre 2018, du 21 juin 2019, n° 2018/09');
    expect(joursSansZero('October 1, 2026')).toBe('October 1, 2026');
  });

  it('désigne un texte lié pour une phrase, avec son article en français', () => {
    expect(designationDuTexte(LOI_2026_002, 'fr')).toBe('la loi n°\u00A02026/002 du 14 avril 2026');
    expect(designationDuTexte({ ...LOI_2026_002, nature: 'décret' }, 'fr')).toMatch(/^le décret/);
    expect(designationDuTexte({ ...LOI_2026_002, nature: 'ordonnance' }, 'fr')).toMatch(/^l’ordonnance/);
    expect(designationDuTexte(LOI_2026_002, 'en')).toBe('Loi n°\u00A02026/002 du 14 avril 2026');
  });

  it('un premier du mois s’écrit « 1er », une date inconnue donne l’année', () => {
    expect(designationDuTexte({ ...LOI_2026_002, date_signature: '2026-04-01' }, 'fr')).toContain('du 1er avril 2026');
    expect(designationDuTexte({ ...LOI_2026_002, date_signature: null }, 'fr')).toBe('la loi n°\u00A02026/002 de 2026');
  });

  it('sans numéro, l’identité ou le titre', () => {
    expect(
      designationDuTexte({ ...LOI_2026_002, numero: null, nature: 'autre', titre: 'Code civil applicable au Cameroun' }, 'fr'),
    ).toBe('Code civil applicable au Cameroun');
  });

  it('nomme un article cité par l’objet de son texte, comme un code', () => {
    expect(libelleDeLaCitation('37', 'Loi N°92/007 du 14 août 1992 portant Code du travail', 'LOI-1992-007', t)).toBe(
      'Art. 37 — Code du travail',
    );
    // L'intitulé réel du décret 94/199 (base locale), note de consolidation comprise.
    expect(libelleDeLaCitation('120', DECRET_94_199, 'DEC-1994-199', t)).toBe(
      'Art. 120 — Statut Général de la Fonction Publique de l’État',
    );
    expect(libelleDeLaCitation(null, DECRET_94_199, 'DEC-1994-199', t)).toBe('Statut Général de la Fonction Publique de l’État');
  });
});

/** L'intitulé du décret 94/199 dans la base (laws.id 2279). */
const DECRET_94_199 =
  'Décret N°94/199 du 07 octobre 1994 portant Statut Général de la Fonction Publique de l’État, modifié et complété par le décret n°2000/287 du 12 octobre 2000';

describe('designationDuTexteCite : le nom, puis les repères, sans redite', () => {
  it('un objet : le nom, et dessous la nature, le numéro et la date, une fois', () => {
    expect(designationDuTexteCite(DECRET_94_199, 'DEC-1994-199')).toEqual({
      nom: 'Statut Général de la Fonction Publique de l’État',
      reperes: 'Décret n°\u00A094/199 du 7 octobre 1994',
    });
    expect(designationDuTexteCite('Loi N°92/007 du 14 août 1992 portant Code du travail', 'LOI-1992-007')).toEqual({
      nom: 'Code du travail',
      reperes: 'Loi n°\u00A092/007 du 14 août 1992',
    });
  });

  it('les repères sont l’en-tête vérifié, jamais la date d’un autre acte cité dans l’objet', () => {
    // laws.id 219 : sans « du » devant sa propre date, l'identité courait
    // jusqu'à celle du décret 2001/066, et répétait l'objet sous le nom.
    expect(
      designationDuTexteCite(
        "Décret N°2017/591 04 décembre 2017 modifiant et complétant certaines dispositions du décret n°2001/066 du 12 mars 2001 fixant l'échelonnement indiciaire des cadres de la Sûreté Nationale.",
        'PRC-1',
      ),
    ).toEqual({
      nom: "Modification de certaines dispositions du décret n°\u00A02001/066 du 12 mars 2001 fixant l'échelonnement indiciaire des cadres de la Sûreté Nationale",
      reperes: 'Décret n°\u00A02017/591 4 décembre 2017',
    });
    // laws.id 594 : le mois collé au jour est séparé.
    expect(
      designationDuTexteCite(
        'Décret N°82/408 du 07septembre 1982 complétant certaines dispositions du décret n° 74/759 du 26 août 1974 portant organisation du régime des Pensions Civiles',
        'PRC-2',
      ).reperes,
    ).toBe('Décret n°\u00A082/408 du 7 septembre 1982');
  });

  it('sans objet sûr (verbe non repris) : la nature et le numéro, et dessous la seule date', () => {
    const habilitation =
      'Décret N°2018/9387/CAB/PM du 30 novembre 2018 habilitant le Ministre des Finances à signer un accord de prêt';
    expect(designationDuTexteCite(habilitation, 'PRC-1')).toEqual({
      nom: 'Décret n°\u00A02018/9387/CAB/PM',
      reperes: '30 novembre 2018',
    });
  });

  it('un nom qui n’est ni un acte numéroté ni un objet : le titre, sans repères', () => {
    expect(
      designationDuTexteCite('Code civil applicable au Cameroun, annoté de la jurisprudence de la Cour suprême', 'CODE-CIVIL'),
    ).toEqual({ nom: 'Code civil applicable au Cameroun, annoté de la jurisprudence de la Cour suprême', reperes: null });
  });

  it('nomRaccourci : coupé entre deux mots, marqué d’un « … »', () => {
    expect(nomRaccourci('Code du travail', 70)).toBe('Code du travail');
    // À la virgule plutôt qu'au milieu d'un complément.
    expect(nomRaccourci('Code civil applicable au Cameroun, annoté de la jurisprudence de la Cour suprême', 70)).toBe(
      'Code civil applicable au Cameroun…',
    );
    expect(nomRaccourci('Modalités d’application de certaines dispositions de la loi portant Code pénal', 40)).toBe(
      'Modalités d’application de certaines…',
    );
  });
});

describe('mentionDuStatut (StatutProuve)', () => {
  const rien: StatutProuve = { etat: null, liens: [], lignes: [] };
  const abroge: StatutProuve = {
    etat: 'abroge_partiellement',
    liens: [
      {
        nature: 'abroge_partiellement',
        libelle: 'abrogé en partie',
        par_titre: 'la Loi n° 2024/016 du 23 décembre 2024',
        par_date: '2024-12-23',
        par_reference: 'PRC-10257',
        par_law_id: 2156,
        articles: ['1 à 11'],
        par_articles: ['129'],
        portee: null,
      },
    ],
    lignes: ['Statut : … (PRC-10257) à ne pas afficher'],
  };

  it('rien de prouvé : jamais « en vigueur », la date du relevé quand elle est connue', () => {
    expect(mentionDuStatut(rien, t, 'fr')).toBe('aucune modification relevée par JuriX');
    expect(mentionDuStatut(rien, t, 'fr', '2026-10-14')).toBe('aucune modification relevée par JuriX au 14 oct. 2026');
    expect(mentionDuStatut(rien, t, 'fr')).not.toMatch(/vigueur/i);
  });

  it('un état prouvé, avec le texte qui l’établit, sans les lignes internes', () => {
    const mention = mentionDuStatut(abroge, t, 'fr');
    expect(mention).toBe('abrogé en partie par la Loi n°\u00A02024/016 du 23 décembre 2024');
    expect(mention).not.toContain('PRC');
    expect(mentionDuStatut(abroge, t, 'en')).toBe('abrogé en partie par Loi n°\u00A02024/016 du 23 décembre 2024');
  });

  it('des liens sans état sur le texte entier : des articles ont changé', () => {
    expect(mentionDuStatut({ ...abroge, etat: null }, t, 'fr')).toBe('des articles de ce texte ont été modifiés depuis');
  });

  it('statut absent (ancienne API) : rien', () => {
    expect(mentionDuStatut(undefined, t, 'fr')).toBe('');
    expect(mentionDuStatut(null, t, 'fr')).toBe('');
  });

  it('enPhrase : capitale et point final', () => {
    expect(enPhrase('aucune modification relevée par JuriX')).toBe('Aucune modification relevée par JuriX.');
    expect(enPhrase('')).toBe('');
  });
});

function changement(partiel: Partial<Changement>): Changement {
  return {
    id: 'c1',
    sens: 'modifie_par',
    type: 'modifie',
    nature_modification: 'modifie',
    libelle: 'modifié',
    texte: LOI_2026_002,
    etendue: 'articles',
    articles_cibles: ['6'],
    section: null,
    articles_source: ['6'],
    portee: null,
    depasse: false,
    depasse_par: null,
    integre_au_texte: false,
    ...partiel,
  };
}

function apercu(statut: Partial<ArticleApercu['statut']>): ArticleApercu {
  return {
    law_id: 2143,
    texte: { ...LOI_2026_002, id: 2143, titre: 'Loi N°96/06 du 18 janvier 1996 portant révision de la Constitution' },
    numero: '6',
    titre: null,
    section: null,
    page: 8,
    article_ids: [75144],
    contenu: '(1) Le Président de la République est élu au suffrage universel direct.',
    tronque: false,
    englobant: false,
    homonymes: [],
    statut: { releve_le: '2026-10-14', etat_du_texte: 'aucune_modification_connue', version_en_base: null, changements: [], ...statut },
  };
}

describe('lignesDuStatutDeLArticle', () => {
  it('sans changement : version d’origine et date du relevé', () => {
    expect(lignesDuStatutDeLArticle(apercu({}), t, 'fr')).toEqual([
      { texte: 'Version d’origine, non consolidée.', changement: false },
      { texte: 'Aucune modification relevée par JuriX au 14 oct. 2026.', changement: false },
    ]);
  });

  it('réécrit en entier : le changement actuel, pas celui qu’il a dépassé', () => {
    const lignes = lignesDuStatutDeLArticle(
      apercu({
        etat_du_texte: 'modifie',
        changements: [
          changement({ id: 'c3', depasse: true, texte: { ...LOI_2026_002, numero: '2008/001', date_signature: '2008-04-14' } }),
          changement({ id: 'c4', nature_modification: 'reecrit_en_entier', libelle: 'réécrit en entier' }),
        ],
      }),
      t,
      'fr',
    );
    expect(lignes).toEqual([
      { texte: 'Article modifié par la loi n°\u00A02026/002 du 14 avril 2026 : réécrit en entier.', changement: true },
      { texte: 'Texte affiché : version d’origine, non consolidée.', changement: false },
    ]);
  });

  it('un autre article modifié : l’article cité ne l’est pas', () => {
    const lignes = lignesDuStatutDeLArticle(apercu({ etat_du_texte: 'modifie' }), t, 'fr');
    expect(lignes[1].texte).toBe(
      'Aucune modification de cet article relevée par JuriX au 14 oct. 2026 ; d’autres articles du texte ont été modifiés.',
    );
  });

  it('texte entier abrogé, et document déjà consolidé', () => {
    const lignes = lignesDuStatutDeLArticle(
      apercu({
        etat_du_texte: 'abroge',
        version_en_base: { consolidee: true, textes_integres: [LOI_2026_002] },
        changements: [changement({ type: 'abroge', etendue: 'texte', articles_cibles: [] })],
      }),
      t,
      'fr',
    );
    expect(lignes[0]).toEqual({ texte: 'Texte abrogé par la loi n°\u00A02026/002 du 14 avril 2026.', changement: true });
    expect(lignes[1].texte).toBe(
      'Texte affiché : version qui intègre déjà les modifications de la loi n°\u00A02026/002 du 14 avril 2026.',
    );
  });

  it('ignore les changements déjà intégrés et ceux que l’article porte sur d’autres textes', () => {
    const lignes = lignesDuStatutDeLArticle(
      apercu({ changements: [changement({ integre_au_texte: true }), changement({ sens: 'modifie' })] }),
      t,
      'fr',
    );
    expect(lignes.every((l) => !l.changement)).toBe(true);
  });
});

describe('libelleDeLEtape', () => {
  it('nomme les deux premiers textes trouvés', () => {
    expect(
      libelleDeLEtape(
        {
          etape: 'textes_trouves',
          libelle: '6 articles trouvés dans 3 textes',
          nb_articles: 6,
          nb_textes: 3,
          textes: [
            { law_id: 2274, law_reference: 'LOI-1992-007', law_title: 'Loi N°92/007 du 14 août 1992 portant Code du travail', date_du_texte: '1992-08-14', nb_articles: 4 },
            { law_id: 2279, law_reference: 'DEC-1994-199', law_title: 'Décret N°94/199 du 07 octobre 1994 portant Statut Général', date_du_texte: '1994-10-07', nb_articles: 1 },
            { law_id: 2285, law_reference: 'CODE-CIVIL', law_title: 'Code civil applicable au Cameroun', date_du_texte: null, nb_articles: 1 },
          ],
        },
        t,
      ),
      // L'objet du décret, comme la maquette chat-attente-p4a, et non « Décret n° 94/199 ».
    ).toBe('6 articles trouvés : Code du travail, Statut Général…');
  });

  it('un nom très long est raccourci, sans second « … » quand d’autres textes suivent', () => {
    const long = {
      law_id: 1,
      law_reference: 'PRC-1',
      law_title:
        'Décret N°2018/9387/CAB/PM du 30 novembre 2018 fixant les modalités d’application de certaines dispositions de la loi n° 2016/007 du 12 juillet 2016 portant Code pénal',
      date_du_texte: '2018-11-30',
      nb_articles: 1,
    };
    const libelle = libelleDeLEtape(
      {
        etape: 'textes_trouves',
        libelle: '',
        nb_articles: 3,
        textes: [
          { ...long, law_id: 2, law_title: 'Loi N°92/007 du 14 août 1992 portant Code du travail' },
          long,
          { ...long, law_id: 3, law_title: 'Code civil applicable au Cameroun' },
        ],
      },
      t,
    );
    // Coupé à une espace ordinaire : « n° 2016/007 » (insécable) part entier.
    expect(libelle).toBe('3 articles trouvés : Code du travail, Modalités d’application de certaines dispositions de la loi…');
    expect(libelle.endsWith('……')).toBe(false);
  });

  it('garde le libellé du serveur ailleurs, et quand rien n’est trouvé', () => {
    expect(libelleDeLEtape({ etape: 'recherche', libelle: 'Recherche dans les textes…' }, t)).toBe('Recherche dans les textes…');
    expect(libelleDeLEtape({ etape: 'textes_trouves', libelle: 'Aucun texte trouvé', nb_articles: 0, textes: [] }, t)).toBe(
      'Aucun texte trouvé',
    );
    expect(libelleDeLEtape({ etape: 'redaction', libelle: '' }, t)).toBe('Préparation de la réponse…');
  });
});

describe('annonceDeFin', () => {
  it('compte les articles cités et les citations non retrouvées', () => {
    expect(annonceDeFin(undefined, t)).toBe('Réponse terminée.');
    expect(annonceDeFin({ articles_cites: [], citations_introuvables: [] }, t)).toBe('Réponse terminée.');
    const deux = [{}, {}] as never[];
    expect(annonceDeFin({ articles_cites: deux, citations_introuvables: [{}] as never[] }, t)).toBe(
      'Réponse terminée, 2 articles cités. 1 citation non retrouvée.',
    );
  });
});

describe('phraseDuPerimetre', () => {
  const CHIFFRES = {
    textes: 2275,
    dernier_ajout_le: '2026-10-14',
    libelle_sources: { fr: 'textes officiels camerounais, OHADA et CIMA', en: 'official texts of Cameroon, OHADA and CIMA' },
  } as ChiffresDuCorpus;

  it('chiffres, périmètre, et la date telle qu’elle est : celle du dernier texte ajouté', () => {
    expect(phraseDuPerimetre(CHIFFRES, 'fr', t)).toBe(
      'Je réponds à partir de 2\u202F275 textes officiels camerounais, OHADA et CIMA (dernier texte ajouté à JuriX le 14 octobre 2026). Je ne connais ni la jurisprudence ni votre dossier.',
    );
    // Jamais « à jour au » : la date d'un ajout ne prouve pas un corpus complet.
    expect(phraseDuPerimetre(CHIFFRES, 'fr', t)).not.toContain('à jour');
    expect(phraseDuPerimetre({ ...CHIFFRES, dernier_ajout_le: '2026-10-01' }, 'fr', t)).toContain('le 1er octobre 2026');
  });

  it('sans date, sans la date ; sans chiffres, le texte générique', () => {
    expect(phraseDuPerimetre({ ...CHIFFRES, dernier_ajout_le: null }, 'fr', t)).not.toContain('ajouté');
    expect(phraseDuPerimetre(null, 'fr', t)).toBe(FR['chat.welcome.scopeGeneric']);
    expect(phraseDuPerimetre({ ...CHIFFRES, libelle_sources: {} } as unknown as ChiffresDuCorpus, 'en', t)).toBe(
      FR['chat.welcome.scopeGeneric'],
    );
  });
});

describe('ponctuationFrancaise', () => {
  const INSECABLE = String.fromCharCode(0xa0);
  const FINE = String.fromCharCode(0x202f);

  it('pose l’espace insécable devant le deux-points d’un intitulé de section', () => {
    expect(ponctuationFrancaise('Section III: De la suspension et de la résiliation du contrat de travail')).toBe(
      `Section III${INSECABLE}: De la suspension et de la résiliation du contrat de travail`,
    );
    // Une espace ordinaire devient insécable : le deux-points ne passe plus seul à la ligne.
    expect(ponctuationFrancaise('CHAPITRE 2 : Des contrats')).toBe(`CHAPITRE 2${INSECABLE}: Des contrats`);
    expect(ponctuationFrancaise('Titre; suite')).toBe(`Titre${FINE}; suite`);
  });

  it('ne touche ni une heure, ni une ponctuation déjà espacée à la française', () => {
    expect(ponctuationFrancaise('Ouverture à 16:00')).toBe('Ouverture à 16:00');
    const juste = `Section 1${INSECABLE}: Dispositions générales`;
    expect(ponctuationFrancaise(juste)).toBe(juste);
  });
});
