import { describe, expect, it } from 'vitest';
import {
  PARTIES_DE_RELECTURE,
  PARTIES_DU_CONTROLE,
  PARTIE_DE_RELECTURE,
  aConfirmer,
  compteDesVerdicts,
  confirmationsValables,
  controleDepuis,
  groupesDePhrases,
  identiteDuControle,
  phrasesAConfirmer,
  raisonLue,
  relectureDepuis,
} from './controle';
import { BROUILLON, PHRASES, PHRASES_A_CONFIRMER, phrase } from './donnees-de-test';

/**
 * Le contrôle IA et la relecture, tels que les rend l'API (contrat du 30/10),
 * lus défensivement : un verdict inconnu n'est jamais un accord, une case
 * absente n'est jamais cochée.
 */

describe('controleDepuis', () => {
  it('lit le contrôle du contrat', () => {
    const controle = controleDepuis(BROUILLON.controle_ia)!;
    expect(controle.modele).toBe('ministral-14b-latest');
    expect(controle.faitLe).toBe('2026-10-30T09:12:00+00:00');
    expect(controle.phrases).toHaveLength(PHRASES.length);
    expect(controle.phrases.find((p) => p.id === 'p3')).toEqual({
      id: 'p3',
      partie: 'point_cle',
      index: 0,
      texte: 'Pas d’expulsion sans décision de justice.',
      verdict: 'soutenue',
      extraits: [2, 3],
      raison: 'Les extraits 2 et 3 encadrent la fin du bail.',
      nature: 'regle',
    });
  });

  it('le titre est une partie contrôlée (avenant du tour 4), en tête', () => {
    const controle = controleDepuis(BROUILLON.controle_ia)!;
    expect(controle.phrases[0]).toMatchObject({ id: 'p0', partie: 'titre', index: 0, texte: 'Expulsion sans juge', verdict: 'soutenue', extraits: [3] });
    expect(PARTIES_DU_CONTROLE[0]).toBe('titre');
    expect(PARTIES_DE_RELECTURE[0]).toBe('titre');
    expect(PARTIE_DE_RELECTURE.titre).toBe('titre');
    // Une partie d'un seul texte : un seul groupe.
    expect(groupesDePhrases(controle, 'titre')).toEqual([{ rang: null, phrases: [controle.phrases[0]] }]);
  });

  it('pas de contrôle (génération dont le contrôle a échoué, article ancien) : null', () => {
    expect(controleDepuis(null)).toBeNull();
    expect(controleDepuis(undefined)).toBeNull();
    expect(controleDepuis({ phrases: 'x' })).toBeNull();
  });

  it('un verdict inconnu se lit « non soutenue », jamais « soutenue »', () => {
    const controle = controleDepuis({ phrases: [phrase('a', 'resume', 0, 'Texte.', 'plausible', [1])] })!;
    expect(controle.phrases[0].verdict).toBe('non_soutenue');
  });

  it('écarte une phrase sans texte ou d’une partie inconnue ; un identifiant en double est remplacé', () => {
    const controle = controleDepuis({
      phrases: [
        phrase('a', 'resume', 0, 'Première.', 'soutenue'),
        phrase('a', 'resume', 0, 'Seconde, même identifiant.', 'soutenue'),
        // La rubrique ne dit rien du droit : elle n'est pas contrôlée.
        phrase('b', 'rubrique', 0, 'Partie inconnue.', 'soutenue'),
        phrase('c', 'impact', 0, '  ', 'soutenue'),
        null,
        { id: 'd', partie: 'impact', index: 'x', texte: 'Index illisible.', verdict: 'contredite', extraits: [2, '3', 0, -1, 2], raison: 7 },
      ],
    })!;
    expect(controle.phrases.map((p) => p.texte)).toEqual(['Première.', 'Seconde, même identifiant.', 'Index illisible.']);
    expect(new Set(controle.phrases.map((p) => p.id)).size).toBe(3);
    // Les numéros d'extraits : entiers positifs, sans doublon, dans l'ordre.
    expect(controle.phrases[2]).toMatchObject({ index: 0, extraits: [2, 3], raison: '7' });
  });

  it('les numéros d’extraits gardent l’ordre du serveur : celui du passage retrouvé d’abord (API du tour 4)', () => {
    // lire_les_verdicts : les extraits où figure le passage copié viennent en
    // tête, et la raison le cite (« — Extrait 5 : « … » »).
    const controle = controleDepuis({
      phrases: [
        phrase('p1', 'resume', 0, 'Le bailleur doit saisir le juge.', 'soutenue', [5, 2, 5], 'L’extrait 5 le dit. — Extrait 5 : « La juridiction compétente statuant à bref délai »'),
      ],
    })!;
    expect(controle.phrases[0].extraits).toEqual([5, 2]);
    expect(controle.phrases[0].raison).toMatch(/— Extrait 5 : « La juridiction compétente statuant à bref délai »$/);
  });

  it('compte les verdicts', () => {
    expect(compteDesVerdicts(controleDepuis(BROUILLON.controle_ia))).toEqual({ soutenue: 6, non_soutenue: 1, contredite: 0, hors_sources: 1 });
    expect(compteDesVerdicts(null)).toEqual({ soutenue: 0, non_soutenue: 0, contredite: 0, hors_sources: 0 });
  });
});

describe('relectureDepuis', () => {
  it('seul `true` coche une case ; qui et quand, notés par le serveur', () => {
    const relecture = relectureDepuis({
      parties: { titre: true, contexte: true, resume: 'true', points_cles: 1, impact: true },
      par: 'admin@jurix.cm',
      le: '2026-10-30T09:40:00+00:00',
    });
    expect(relecture.parties).toEqual({
      titre: true,
      contexte: true,
      resume: false,
      points_cles: false,
      impact: true,
      explications: false,
      question: false,
    });
    expect(relecture.par).toBe('admin@jurix.cm');
    // Sans case du titre (API d'avant l'avenant) : le titre n'est pas relu.
    expect(relectureDepuis({ parties: { contexte: true } }).parties.titre).toBe(false);
    expect(relectureDepuis(undefined)).toEqual({
      parties: { titre: false, contexte: false, resume: false, points_cles: false, impact: false, explications: false, question: false },
      par: null,
      le: null,
      controle: null,
      phrasesConfirmees: [],
    });
  });

  it('les phrases confirmées, telles que l’API les rend (avenant du tour 7) : des identifiants texte, chacun une fois', () => {
    expect(relectureDepuis({ parties: {}, phrases_confirmees: ['p2', ' p3 ', 'p2', 4, null, '', { id: 'p5' }] }).phrasesConfirmees).toEqual(['p2', 'p3']);
    expect(relectureDepuis({ parties: {}, phrases_confirmees: 'p2' }).phrasesConfirmees).toEqual([]);
    expect(relectureDepuis({ parties: {} }).phrasesConfirmees).toEqual([]);
  });
});

describe('les phrases de règle à confirmer (décision du 04/11, avenant du tour 7)', () => {
  it('nature : « regle » sauf « autre » dit en toutes lettres (comme lire_la_nature de l’API)', () => {
    const controle = controleDepuis({
      phrases: [
        phrase('a', 'resume', 0, 'Une règle.', 'non_soutenue', [], '', 'regle'),
        { ...phrase('b', 'resume', 0, 'Sans nature.', 'non_soutenue'), nature: undefined },
        { ...phrase('c', 'resume', 0, 'Nature illisible.', 'non_soutenue'), nature: 'plausible' },
        phrase('d', 'impact', 0, 'Un conseil.', 'non_soutenue', [], '', 'autre'),
        { ...phrase('e', 'impact', 0, 'Autre, en capitales.', 'hors_sources'), nature: ' AUTRE ' },
      ],
    })!;
    expect(controle.phrases.map((p) => p.nature)).toEqual(['regle', 'regle', 'regle', 'autre', 'autre']);
  });

  it('une règle « À vérifier » ou « Hors des sources » se confirme ; ni une phrase soutenue, ni une contredite, ni un fait', () => {
    const regle = (verdict: string) => ({ nature: 'regle' as const, verdict: verdict as 'soutenue' });
    expect(aConfirmer(regle('non_soutenue'))).toBe(true);
    expect(aConfirmer(regle('hors_sources'))).toBe(true);
    expect(aConfirmer(regle('soutenue'))).toBe(false);
    // Une contradiction ne se confirme pas : elle bloque jusqu'à sa correction.
    expect(aConfirmer(regle('contredite'))).toBe(false);
    expect(aConfirmer({ nature: 'autre', verdict: 'non_soutenue' })).toBe(false);
    expect(aConfirmer({ nature: 'autre', verdict: 'hors_sources' })).toBe(false);
  });

  it('celles d’un contrôle, dans l’ordre de l’article ; le brouillon d’exemple n’en a pas (un fait, un conseil)', () => {
    expect(phrasesAConfirmer(controleDepuis(BROUILLON.controle_ia))).toEqual([]);
    const controle = controleDepuis({ ...BROUILLON.controle_ia, phrases: PHRASES_A_CONFIRMER })!;
    expect(phrasesAConfirmer(controle).map((p) => p.id)).toEqual(['p2', 'p3']);
    expect(phrasesAConfirmer(null)).toEqual([]);
  });

  it('confirmationsValables : seules celles d’une phrase à confirmer de CE contrôle comptent, dans l’ordre, une fois', () => {
    const controle = controleDepuis({ ...BROUILLON.controle_ia, phrases: PHRASES_A_CONFIRMER })!;
    expect(confirmationsValables(['p3', 'p0', 'inconnue', 'p2', 'p3'], controle)).toEqual(['p2', 'p3']);
    expect(confirmationsValables(['p2'], controleDepuis(BROUILLON.controle_ia))).toEqual([]);
    expect(confirmationsValables(['p2'], null)).toEqual([]);
  });
});

describe('relectureDepuis (suite)', () => {

  it('le contrôle contre lequel les cases ont été cochées, tel que l’API le rend (avenant du tour 5)', () => {
    expect(relectureDepuis({ parties: { titre: true }, controle: '2026-11-04T10:12:00+00:00' }).controle).toBe('2026-11-04T10:12:00+00:00');
    expect(relectureDepuis({ parties: {}, controle: '' }).controle).toBeNull();
    expect(relectureDepuis({ parties: {}, controle: { fait_le: 'x' } }).controle).toBeNull();
  });
});

describe('identiteDuControle : le contrôle que nomme une case cochée (avenant du tour 5)', () => {
  it('son fait_le, ou null sans contrôle lisible', () => {
    expect(identiteDuControle(controleDepuis(BROUILLON.controle_ia))).toBe('2026-10-30T09:12:00+00:00');
    expect(identiteDuControle(null)).toBeNull();
    expect(identiteDuControle(controleDepuis({ phrases: [] }))).toBeNull();
  });
});

describe('raisonLue : la raison d’un verdict, les passages retrouvés à part', () => {
  it('la raison du modèle, puis chaque passage avec son extrait (forme de l’API du tour 4)', () => {
    expect(
      raisonLue(
        'L’extrait 3 confie la résiliation au juge. — Extrait 3 : « La juridiction compétente statuant à bref délai est saisie » « de la demande en résiliation » ; extrait 5 : « Le preneur est tenu »',
      ),
    ).toEqual({
      texte: 'L’extrait 3 confie la résiliation au juge.',
      passages: [
        { n: 3, texte: 'La juridiction compétente statuant à bref délai est saisie' },
        { n: 3, texte: 'de la demande en résiliation' },
        { n: 5, texte: 'Le preneur est tenu' },
      ],
    });
  });

  it('« À vérifier : » en tête n’est pas répété : le badge du verdict le dit', () => {
    expect(
      raisonLue('À vérifier : le contrôle la disait soutenue, sans pouvoir copier un passage des extraits qui le dise. Sa raison : « Conforme. »'),
    ).toEqual({
      texte: 'Le contrôle la disait soutenue, sans pouvoir copier un passage des extraits qui le dise. Sa raison : « Conforme. »',
      passages: [],
    });
    expect(raisonLue('À\u00a0vérifier\u00a0: rien.').texte).toBe('Rien.');
  });

  it('un passage seul, des guillemets dans le texte de loi, un passage coupé par le serveur', () => {
    expect(raisonLue('Extrait 2 : « Le terme « bail » désigne la convention »')).toEqual({
      texte: '',
      passages: [{ n: 2, texte: 'Le terme « bail » désigne la convention' }],
    });
    expect(raisonLue('Conforme. — Extrait 4 : « Le licenciement abusif donne lieu à des dommages').passages).toEqual([
      { n: 4, texte: 'Le licenciement abusif donne lieu à des dommages', ouvert: true },
    ]);
  });

  describe('contre le texte des extraits : jamais un texte attribué à un extrait qui ne le porte pas (défaut D1)', () => {
    const textes = new Map([
      [3, 'Le preneur et le bailleur sont tenus… La juridiction compétente statuant à bref délai est saisie de la demande en résiliation du bail et d’expulsion du preneur.'],
      [4, 'En cas de contestation sur le motif ou l’ordre des licenciements, la charge de la preuve incombe à l’employeur.'],
    ]);

    it('les mots de l’extrait, à la casse, aux accents et à la ponctuation près, « […] » entre deux morceaux', () => {
      const lue = raisonLue(
        'Conforme. — Extrait 3 : « la juridiction competente statuant a bref delai […] en resiliation du bail » ; extrait 4 : « la charge de la preuve incombe à l’employeur. »',
        textes,
      );
      expect(lue.passages.map((p) => p.n)).toEqual([3, 4]);
      expect(lue.texte).toBe('Conforme.');
    });

    it('un mot inventé, même le dernier, ou un passage hors de son extrait : la raison reste du texte', () => {
      // La charge de la preuve inversée, essai réel du 30/10 : « au travailleur ».
      for (const raison of [
        'Conforme. — Extrait 4 : « la charge de la preuve incombe au travailleur »',
        'Conforme. — Extrait 3 : « la charge de la preuve incombe à l’employeur »',
        'Conforme. — Extrait 9 : « la juridiction compétente »',
        // Deux morceaux dans le désordre de l'extrait.
        'Conforme. — Extrait 3 : « en résiliation du bail […] la juridiction compétente »',
      ]) {
        const lue = raisonLue(raison, textes);
        expect(lue.passages, raison).toEqual([]);
        expect(lue.texte, raison).toBe(raison);
      }
    });

    it('un passage coupé par le serveur peut l’être au milieu de son dernier mot', () => {
      expect(raisonLue('Conforme. — Extrait 4 : « la charge de la preuve incombe à l’empl', textes).passages).toHaveLength(1);
      expect(raisonLue('Conforme. — Extrait 4 : « la charge de la preuve incombe à l’empl »', textes).passages).toEqual([]);
    });
  });

  it('une fin d’une autre forme reste dans le texte : rien n’est présenté comme le texte d’un extrait', () => {
    for (const raison of [
      'Conforme à l’extrait 3, qui dit « la juridiction compétente ».',
      'Conforme. — Extrait 3 : « la juridiction » (art. 133)',
      'Conforme. — Extrait : « la juridiction »',
      'Aucun extrait ne parle du juge des référés.',
    ]) {
      expect(raisonLue(raison), raison).toEqual({ texte: raison, passages: [] });
    }
  });
});

/*
 * Les extraits RÉELS du jeu fixe du tour 4 (dépôt du backend,
 * data/blog/tour4/jeu-controle.json, relevés dans jurix_dev le 04/11), OCR
 * compris : Code civil art. 1743 et 1752, AUDCG art. 127 et 133, Code du
 * travail art. 39.
 */
const ART_1743 =
  "Si le bailleur vend la chose louée, l'acquéreur ne peut expulser le fermier ou le locataire qui a un bail authentique ou dont la date est certaine à moins qu'il ne se soit réservé ce droit par le contrat de bail.";
const ART_127 =
  "Le bailleur peut s'opposer au droit au renouvellement du bail à durée déterminée ou indéterminée, sans avoir à régler d'indemnité d'éviction, dans les cas suivants :\n\n- 1°) s'il justifie d'un motif grave et légitime à l'encontre du preneur sortant.\n\nCe motif doit consister soit dans l'inexécution par le locataire d'une obligation substantielle du bail, soit encore dans la cessation de l'exploitation de l'activité ; Ce motif ne peut être invoqué que si les faits se sont poursuivis ou rnon m s n e s e ss d s oe notification par tout moyen permettant d'établir la réception effective par le destinataire, d'avoir à les faire cesser.\n\n- 2°) s'il envisage de démolir l'immeuble comprenant les lieux loués, et de le reconstruire. Le bailleur doit dans ce cas justifier de la nature et de la description des travaux projetés.\n\nLler r b rr r ie d'un droit de priorité pour se voir attribuer un nouveau bail dans l'immeuble reconstruit. Si les locaux reconstruits ont une destination différente de celle des locaux objet du bail, ou s'il n'est pas offert au preneur un bail dans les nouveaux locaux, le bailleur doit verser au preneur l'indemnité d'éviction prévue à l'article 126 ci-dessus.";
const ART_133 =
  "Le preneur et le bailleur sont tenus chacun en ce qui le concerne au respect de chacune des clauses et conditions du bail sous peine de résiliation.\n\nLa demande en justice aux fins de résiliation du bail doit être précédée d'une mise en demeure d'avoir à respecter la ou les clauses ou conditions violées. La mise en demeure est faite par acte d'huissier ou notifiée par tout moyen permettant d'établir sa réception effective par le destinataire.\n\nA peine de nullité, la mise en demeure doit indiquer la ou les clauses et conditions du bail non respectées et informer le destinataire qu'à défaut de s'exécuter dans un délai d'un mois à compter de sa réception, la juridiction compétente statuant à bref délai est saisie aux fins de résiliation du bail et d'expulsion, le cas échéant, du preneur et de tout occupant de son chef.\n\nLe contrat de bail peut prévoir une clause résolutoire de plein droit. La juridiction compétente statuant à bref délai constate la résiliation du bail et prononce, le cas échéant, l'expulsion du preneur et de tout occupant de son chef, en cas d'inexécution d'une clause ou d'une condition du bail après la mise en demeure visée aux alinéas précédents.\n\nLa partie qui entend poursuivre la résiliation du bail doit notifier aux créanciers inscrits une copie de l'acte introductif d'instance. La décision prononçant ou constatant la résiliation du bail ne peut intervenir qu'après I si a ot ins s , oit,s\n\n\nChapitre 8 - Dispositions d'ordre public";
const ART_1752 =
  "Le locataire qui ne garnit pas la maison de meubles suffisants, peut être expulsé, à moins qu'il ne donne des sûretés capables de répondre du loyer.";
const ART_39 =
  "Article 39.- (1) Toute rupture abusive du contrat peut donner lieu à des dommages-intérêts. Sont no s s s s s du tras sn sa-s s no sae s nlecat (2) La juridiction compétente peut constater l'abus par une enquête sur les causes et les cirt t a t t n t t a t nte par la partie qui a rompu le contrat. (3) Dans tous cas de licenciement, il appartient à l'employeur d'apporter la preuve du caractère légitime du motif qu'il allègue. (4) Le montant des dommages-intérêts est fixé compte-tenu, en général, de tous les éléments qui peuvent justifier l'existence et déterminer l'étendue du préjudice causé et notamment:\n\n- a) lorsque la responsabilité incombe au travailleur, de son niveau de qualification et de l'emploi occupé;\n- b) lorsque la responsabilité incombe à l'employeur, de la nature des services engagés, de l'ancienneté des services, de l'âge du travailleur et des droits à quelque titre que ce soit.\n\nToutefois, le montant des dommages-intérêts, sans excéder un (1) mois de salaire par année d'ancienneté dans l'entreprise, ne peut être inférieur à trois (3) mois de salaire. (5) En cas de licenciement légitime d'un travailleur survenu sans observation par l'employeur des formalités prévues, le montant des dommages-intérêts ne peut excéder un (1) mois de salaire.";

describe('raisonLue : une coupure ne cache pas ce qui décide (revue de l’API du tour 5, extraits réels)', () => {
  // Tenu mot à mot, un passage ne l'était pas pour le sens : autour de « […] »,
  // des mots VRAIS de l'extrait recollés disaient la règle inverse, et la
  // fenêtre les montrait en citation vérifiée, « — Extrait 5 ». Ce sont
  // l'expulsion sans juge et la preuve inversée de l'essai réel.
  const textes = new Map<number, string>([
    [3, ART_1743],
    [5, ART_127],
    [6, ART_133],
    [7, ART_1752],
    [9, ART_39],
  ]);

  it('des mots vrais recollés en la règle inverse : la raison reste du texte, rien n’est attribué à l’extrait', () => {
    for (const raison of [
      // La preuve inversée : « au travailleur » vient de l'alinéa 4 a), une autre phrase.
      'Conforme. — Extrait 9 : « Dans tous cas de licenciement, il appartient […] au travailleur »',
      'Conforme. — Extrait 9 : « il appartient […] au travailleur, de son niveau de qualification »',
      // Deux phrases recollées dans l'autre ordre.
      'Conforme. — Extrait 9 : « Dans tous cas de licenciement, il appartient […] incombe au travailleur »',
      // L'expulsion sans juge : la coupure cache « ne », « ne … pas », « ne … que ».
      'Conforme. — Extrait 3 : « l’acquéreur […] peut expulser le fermier ou le locataire »',
      'Conforme. — Extrait 7 : « Le locataire qui […] peut être expulsé »',
      'Conforme. — Extrait 5 : « Ce motif […] peut être invoqué […] si les faits se sont poursuivis »',
      'Conforme. — Extrait 5 : « Ce motif ne peut être invoqué […] si les faits se sont poursuivis »',
      // La forme d'avant ce correctif : deux phrases de l'art. 133 en une citation.
      'Conforme. — Extrait 6 : « La demande en justice […] doit être précédée d’une mise en demeure […] La juridiction compétente […] prononce […] l’expulsion »',
    ]) {
      const lue = raisonLue(raison, textes);
      expect(lue.passages, raison).toEqual([]);
      expect(lue.texte, raison).toBe(raison);
    }
  });

  it('ce que rend l’API corrigée se lit en citation : une par phrase, la règle avec son exception, les mots du trou', () => {
    // Bail P12 : deux phrases de l'art. 133, deux citations.
    expect(
      raisonLue(
        'Conforme. — Extrait 6 : « La demande en justice […] doit être précédée d’une mise en demeure » « La juridiction compétente […] prononce […] l’expulsion »',
        textes,
      ).passages,
    ).toEqual([
      { n: 6, texte: 'La demande en justice […] doit être précédée d’une mise en demeure' },
      { n: 6, texte: 'La juridiction compétente […] prononce […] l’expulsion' },
    ]);
    for (const raison of [
      // La règle et son exception, d'une même phrase : le trou ne cache rien qui décide.
      'Conforme. — Extrait 3 : « l’acquéreur ne peut expulser le fermier ou le locataire […] à moins qu’il ne se soit réservé ce droit par le contrat de bail »',
      // Travail P14 : le plancher et le plafond, cités dans l'autre ordre, rendus d'un seul tenant.
      'Conforme. — Extrait 9 : « le montant des dommages-intérêts, sans excéder un (1) mois de salaire par année d’ancienneté dans l’entreprise, ne peut être inférieur à trois (3) mois de salaire »',
      // Deux phrases citées à part : chacune se vérifie seule.
      'Conforme. — Extrait 9 : « incombe au travailleur » « Dans tous cas de licenciement, il appartient »',
    ]) {
      expect(raisonLue(raison, textes).passages.length, raison).toBeGreaterThan(0);
    }
  });

  it('« trois (3) mois » ou « art. 39 » ne coupent pas une phrase ; « (2) La » et « ; » si', () => {
    const extrait = new Map([[1, 'Le juge statue dans trois (3) mois selon l’art. 39, puis il prononce l’expulsion ; il ne peut statuer avant. (2) Le preneur paie.']]);
    expect(raisonLue('Conforme. — Extrait 1 : « Le juge statue […] puis il prononce l’expulsion »', extrait).passages).toHaveLength(1);
    expect(raisonLue('Conforme. — Extrait 1 : « Le juge statue […] il ne peut statuer avant »', extrait).passages).toEqual([]);
    expect(raisonLue('Conforme. — Extrait 1 : « il ne peut statuer avant […] Le preneur paie »', extrait).passages).toEqual([]);
  });
});

describe('groupesDePhrases : chaque phrase sous son point clé ou sa citation', () => {
  const controle = controleDepuis({
    phrases: [
      phrase('a', 'explication', 1, 'Le congé suit l’usage des lieux.', 'soutenue', [2]),
      phrase('b', 'explication', 0, 'Entrer chez autrui est puni.', 'soutenue', [1]),
      phrase('c', 'point_cle', 0, 'Premier point.', 'soutenue'),
      phrase('d', 'point_cle', 0, 'Il a deux phrases.', 'non_soutenue'),
      phrase('e', 'resume', 0, 'Résumé.', 'soutenue'),
      phrase('f', 'resume', 1, 'Seconde phrase du résumé.', 'hors_sources'),
    ],
  });

  it('une partie d’un seul texte : un seul groupe, dans l’ordre du contrôle', () => {
    expect(groupesDePhrases(controle, 'resume')).toEqual([{ rang: null, phrases: [controle!.phrases[4], controle!.phrases[5]] }]);
    expect(groupesDePhrases(controle, 'impact')).toEqual([]);
  });

  it('les explications, rangées par citation dans l’ordre des citations', () => {
    const groupes = groupesDePhrases(controle, 'explications', ['Entrer chez autrui est puni.', 'Le congé suit l’usage des lieux.']);
    expect(groupes.map((g) => [g.rang, g.phrases.map((p) => p.id)])).toEqual([
      [0, ['b']],
      [1, ['a']],
    ]);
  });

  it('un index décalé ne range pas l’explication sous la mauvaise citation : le texte le vérifie', () => {
    const decale = controleDepuis({
      phrases: [phrase('a', 'explication', 1, 'Entrer chez autrui est puni.', 'soutenue', [1])],
    });
    const [groupe] = groupesDePhrases(decale, 'explications', ['Entrer chez autrui est puni.', 'Le congé.']);
    expect(groupe.rang).toBe(0);
    // Apostrophes et espaces ne changent rien au rattachement.
    const typographie = controleDepuis({ phrases: [phrase('a', 'point_cle', 3, "Pas d'expulsion  sans juge.", 'soutenue')] });
    expect(groupesDePhrases(typographie, 'points_cles', ['Pas d’expulsion sans juge.'])[0].rang).toBe(0);
  });

  it('l’index exact d’abord : une phrase répétée, ou contenue dans un autre élément, reste sous le sien', () => {
    // Revue du tour 3 : rangée par le texte seul, la phrase du point 2 (ou
    // l'explication courte de la citation 2) tombait sous le PREMIER élément
    // qui la contient, et se relisait contre l'extrait d'une autre citation.
    const repetee = controleDepuis({
      phrases: [
        phrase('a', 'point_cle', 0, 'Le juge décide.', 'soutenue'),
        phrase('b', 'point_cle', 1, 'Le juge décide.', 'contredite', [2]),
      ],
    });
    expect(groupesDePhrases(repetee, 'points_cles', ['Le juge décide.', 'Le juge décide.']).map((g) => [g.rang, g.phrases.map((p) => p.id)])).toEqual([
      [0, ['a']],
      [1, ['b']],
    ]);
    const contenue = controleDepuis({ phrases: [phrase('c', 'explication', 1, 'Le congé.', 'soutenue', [2])] });
    expect(groupesDePhrases(contenue, 'explications', ['Le congé. Il suit l’usage des lieux.', 'Le congé.'])[0].rang).toBe(1);
  });

  it('les deux phrases d’un même point clé restent ensemble', () => {
    const [groupe] = groupesDePhrases(controle, 'points_cles', ['Premier point. Il a deux phrases.']);
    expect(groupe).toEqual({ rang: 0, phrases: [controle!.phrases[2], controle!.phrases[3]] });
  });
});
