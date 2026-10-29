import { describe, expect, it } from 'vitest';
import type { Changement, StatutJuridique, TexteLie } from '$lib/types';
import { decouperLeTexte } from './decoupage';
import {
  articlesEcrits,
  articlesSourceLisibles,
  changementsParArticle,
  cibleDuChangement,
  detailDesChangements,
  etatDuBloc,
  historiqueDuTexte,
  lienDuTexteLie,
  marqueDuSommaire,
  mentionDuTexteAffiche,
  nomDuTexteLie,
} from './statut';

/**
 * Le statut tel que la page le montre (P1). Fixture : le statut RÉEL de la
 * Constitution (`GET /laws/2143`, data/ux-impl/notes/api/exemples/), réduit
 * aux champs utiles : c1 à c5, dont c3 dépassé par la loi 2026/002.
 */

const FR: Record<string, string> = {
  'loi.lie.loi': 'la loi n°\u00a0{numero}',
  'loi.lie.ordonnance': 'l’ordonnance n°\u00a0{numero}',
  'loi.lie.autre': 'le texte n°\u00a0{numero}',
  'loi.lie.date': '{texte} du {date}',
  'loi.lie.annee': '{texte} de {annee}',
  'loi.lie.jo': '{texte} publié au Journal officiel le {date}',
  'loi.lie.sans_numero': 'le texte « {titre} »',
  'loi.art': 'art.',
  'loi.participe.complete': 'complété',
  'loi.participe.reecrit_en_entier': 'réécrit en entier',
  'loi.participe.reecrit_en_entier.pluriel': 'réécrits en entier',
  'loi.participe.remplace': 'remplacé',
  'loi.historique.texte_entier': 'texte entier',
  'loi.historique.articles_inconnus': 'articles non précisés',
};
const EN: Record<string, string> = {
  'loi.lie.loi': 'Law No.\u00a0{numero}',
  'loi.lie.date': '{texte} of {date}',
  'loi.art': 'art.',
  'loi.participe.reecrit_en_entier': 'rewritten in full',
};
const fr = (cle: string) => FR[cle] ?? cle;
const en = (cle: string) => EN[cle] ?? cle;

function texte(numero: string | null, date: string | null, id: number | null = 1, nature = 'loi'): TexteLie {
  return {
    id,
    reference: id ? `PRC-${id}` : null,
    nature,
    numero,
    titre: numero ? `Loi N°${numero} du …` : 'Code civil applicable au Cameroun',
    date_signature: date,
    annee: date ? Number(date.slice(0, 4)) : null,
    date_publication_jo: null,
    consultable: id !== null,
  };
}

const L2008 = texte('2008/001', '2008-04-14', 1541);
const L2026 = texte('2026/002', '2026-04-14', 1761);

function changement(id: string, partiel: Partial<Changement>): Changement {
  return {
    id,
    sens: 'modifie_par',
    type: 'modifie',
    nature_modification: 'modifie',
    libelle: 'modifié',
    texte: L2008,
    etendue: 'articles',
    articles_cibles: [],
    section: null,
    articles_source: [],
    portee: null,
    depasse: false,
    depasse_par: null,
    integre_au_texte: false,
    ...partiel,
  };
}

const CONSTITUTION: StatutJuridique = {
  releve_le: '2026-10-14',
  etat: 'modifie',
  types: ['modifie', 'complete'],
  abroge: false,
  abroge_par: null,
  version_en_base: null,
  modifie_par: [
    changement('c1', { articles_cibles: ['14', '15', '51'] }),
    changement('c2', { type: 'complete', nature_modification: 'complete', libelle: 'complété', articles_cibles: ['67'] }),
    changement('c3', { articles_cibles: ['6', '53'], depasse: true, depasse_par: L2026 }),
    changement('c4', {
      texte: L2026,
      nature_modification: 'reecrit_en_entier',
      libelle: 'réécrit en entier',
      articles_cibles: ['6'],
    }),
    changement('c5', { texte: L2026, articles_cibles: ['5', '7', '10', '53', '66'] }),
  ],
  modifie: [],
  par_article: {
    '14': ['c1'],
    '15': ['c1'],
    '51': ['c1'],
    '67': ['c2'],
    '6': ['c3', 'c4'],
    '53': ['c3', 'c5'],
    '5': ['c5'],
    '7': ['c5'],
    '10': ['c5'],
    '66': ['c5'],
  },
  par_morceau: {},
};

describe('nom d’un texte lié', () => {
  it('sépare le déterminant du nom, qui porte le lien', () => {
    expect(nomDuTexteLie(L2008, 'fr', fr)).toEqual({
      determinant: 'la ',
      avant: '',
      nom: 'loi n°\u00a02008/001 du 14 avril 2008',
      apres: '',
    });
    expect(nomDuTexteLie(texte('2025/002', '2025-07-18', 2106, 'ordonnance'), 'fr', fr)).toMatchObject({
      determinant: 'l’',
      nom: 'ordonnance n°\u00a02025/002 du 18 juillet 2025',
    });
    expect(nomDuTexteLie(L2008, 'en', en)).toMatchObject({ determinant: '', nom: 'Law No.\u00a02008/001 of April 14, 2008' });
  });

  it('nomme un texte sans numéro par son intitulé, et l’année quand le jour manque', () => {
    // L'intitulé, mot pour mot, seul dans son élément.
    expect(nomDuTexteLie(texte(null, null, 2285, 'autre'), 'fr', fr)).toEqual({
      determinant: 'le ',
      avant: 'texte « ',
      nom: 'Code civil applicable au Cameroun',
      apres: ' »',
    });
    expect(nomDuTexteLie({ ...L2008, date_signature: null, annee: 2008 }, 'fr', fr).nom).toBe('loi n°\u00a02008/001 de 2008');
  });

  it('ne fait un lien que vers un texte publié dans JuriX', () => {
    expect(lienDuTexteLie(L2008)).toBe('/laws/1541');
    expect(lienDuTexteLie(texte('99/011', '1999-07-20', null))).toBeNull();
    expect(lienDuTexteLie({ ...L2008, consultable: false })).toBeNull();
  });
});

describe('encadré en tête', () => {
  it('sans statut : version d’origine, sans date ni « en vigueur »', () => {
    expect(etatDuBloc(null)).toEqual({ genre: 'inconnu' });
  });

  it('sans lien relevé : la date du relevé', () => {
    const vide: StatutJuridique = { ...CONSTITUTION, etat: 'aucune_modification_connue', types: [], modifie_par: [], par_article: {} };
    expect(etatDuBloc(vide)).toEqual({ genre: 'origine', releveLe: '2026-10-14' });
  });

  it('modifié : les textes actuels, regroupés, sans le changement dépassé', () => {
    const etat = etatDuBloc(CONSTITUTION);
    expect(etat.genre).toBe('modifie');
    if (etat.genre !== 'modifie') return;
    expect(etat.groupes.map((g) => [g.texte.numero, g.changements.map((c) => c.id)])).toEqual([
      ['2008/001', ['c1', 'c2']],
      ['2026/002', ['c4', 'c5']],
    ]);
    expect(detailDesChangements(etat.groupes[0].changements, 'fr', fr)).toBe('art. 14, 15, 51\u00a0; art. 67 complété');
    // Les articles simplement modifiés d'abord : dans l'ordre de l'API
    // (c4 puis c5), « art. 6 réécrit en entier ; art. 5, 7… » laissait croire
    // les articles 5, 7, 10, 53 et 66 réécrits eux aussi.
    expect(detailDesChangements(etat.groupes[1].changements, 'fr', fr)).toBe(
      'art. 5, 7, 10, 53, 66\u00a0; art. 6 réécrit en entier',
    );
    expect(detailDesChangements(etat.groupes[1].changements, 'en', en)).toBe(
      'art. 5, 7, 10, 53, 66; art. 6 rewritten in full',
    );
  });

  it('détail : chaque groupe garde l’ordre de l’API, modifications simples en tête', () => {
    const changements = [
      changement('a', { nature_modification: 'complete', articles_cibles: ['2'] }),
      changement('b', { articles_cibles: ['9'] }),
      changement('c', { nature_modification: 'reecrit_en_entier', articles_cibles: ['3', '4'] }),
      changement('d', { articles_cibles: ['1'] }),
      changement('e', { nature_modification: 'remplace', etendue: 'texte' }),
    ];
    expect(detailDesChangements(changements, 'fr', fr)).toBe(
      'art. 9\u00a0; art. 1\u00a0; art. 2 complété\u00a0; art. 3, 4 réécrits en entier\u00a0; texte entier remplacé',
    );
  });

  it('abrogé ou remplacé : le texte qui l’abroge, pas de « version d’origine »', () => {
    const ordonnance = texte('2025/002', '2025-07-18', 2106, 'ordonnance');
    const remplace: StatutJuridique = {
      ...CONSTITUTION,
      etat: 'remplace',
      abroge: true,
      abroge_par: ordonnance,
      modifie_par: [changement('c4', { type: 'remplace', nature_modification: 'remplace', etendue: 'texte', texte: ordonnance })],
    };
    expect(etatDuBloc(remplace)).toEqual({ genre: 'remplace', releveLe: '2026-10-14', par: ordonnance });
  });

  it('version consolidée en base : les textes intégrés', () => {
    const consolide: StatutJuridique = {
      ...CONSTITUTION,
      etat: 'aucune_modification_connue',
      modifie_par: [changement('c1', { integre_au_texte: true })],
      version_en_base: { consolidee: true, textes_integres: [L2008] },
    };
    expect(etatDuBloc(consolide)).toEqual({ genre: 'consolide', releveLe: '2026-10-14', integres: [L2008] });
  });
});

describe('articles touchés', () => {
  const decoupe = decouperLeTexte(
    ['Article 5.- a', 'Article 6.- b', 'Article 14.- c', 'Article 53.- d', 'Article 54.- e'].join('\n'),
  );

  it('range les changements reçus, actuels et dépassés, par article', () => {
    const parRang = changementsParArticle(CONSTITUTION, decoupe);
    expect(parRang.get(1)?.actuels.map((c) => c.id)).toEqual(['c4']);
    expect(parRang.get(1)?.anciens.map((c) => c.id)).toEqual(['c3']);
    expect(parRang.get(3)?.actuels.map((c) => c.id)).toEqual(['c5']);
    expect(parRang.has(4)).toBe(false);
    expect(marqueDuSommaire(parRang.get(1))).toBe('modifie');
    expect(marqueDuSommaire(parRang.get(4))).toBeNull();
  });

  it('ne marque pas « modifié » l’article qui modifie un autre texte', () => {
    const porteur: StatutJuridique = {
      ...CONSTITUTION,
      etat: 'aucune_modification_connue',
      modifie_par: [],
      modifie: [
        changement('c1', {
          sens: 'modifie',
          type: 'abroge_partiellement',
          nature_modification: 'abroge_partiellement',
          articles_cibles: ['246 à 323'],
          articles_source: ['54'],
          texte: texte(null, null, 2285, 'autre'),
        }),
      ],
      par_article: { '54': ['c1'] },
    };
    const parRang = changementsParArticle(porteur, decoupe);
    expect(parRang.get(4)?.portes.map((c) => c.id)).toEqual(['c1']);
    expect(marqueDuSommaire(parRang.get(4))).toBeNull();
  });

  it('choisit l’homonyme de la section du changement (compilation)', () => {
    const code = decouperLeTexte(
      [
        "TITRE 2 Des actes de l'état civil.",
        'Art. 53. - Premier.',
        'TITRE 5 Du mariage.',
        'Art. 53. - Second.',
      ].join('\n'),
    );
    const statut: StatutJuridique = {
      ...CONSTITUTION,
      modifie_par: [changement('c1', { articles_cibles: ['53'], section: 'TITRE 5 Du mariage.' })],
      par_article: { '53': ['c1'] },
    };
    const parRang = changementsParArticle(statut, code);
    expect([...parRang.keys()]).toEqual([1]);
    // Une section que rien ne reconnaît : les deux homonymes sont prévenus.
    const ailleurs = { ...statut, modifie_par: [changement('c1', { articles_cibles: ['53'], section: 'LIVRE IX' })] };
    expect([...changementsParArticle(ailleurs, code).keys()].sort()).toEqual([0, 1]);
  });

  it('écrit les articles visés, plages comprises', () => {
    expect(articlesEcrits(['246 à 323', '2204'], 'fr')).toBe('246 à 323, 2204');
    expect(articlesEcrits(['246 à 323'], 'en')).toBe('246 to 323');
    expect(cibleDuChangement(changement('c9', { etendue: 'texte' }), 'fr', fr)).toBe('texte entier');
    expect(cibleDuChangement(changement('c9', { etendue: 'inconnue' }), 'fr', fr)).toBe('articles non précisés');
  });
});

/**
 * La phrase de l'encadré d'un article sur le texte affiché, d'après les
 * statuts RÉELS de l'API de test (29/10/2026) : l'ordonnance 74/1
 * (/laws/2242), dont le document intègre l'ordonnance 77/1 mais pas la loi
 * 83-19, et le Code électoral (/laws/2282), version consolidée par la loi
 * 2012/017 que la loi 2026/003 a modifiée depuis.
 */
describe('encadré d’un article : le texte affiché', () => {
  const O77 = changement('c1', { texte: texte('77/1', '1977-01-10', null, 'ordonnance'), integre_au_texte: true });
  const L83 = changement('c3', { texte: texte('83-19', '1983-11-26', null) });
  const L2026003 = changement('c2', { texte: texte('2026/003', '2026-04-14', 1703) });

  it('dit « version d’origine » seulement quand rien ne dit le contraire', () => {
    expect(mentionDuTexteAffiche([L83], false)).toBe('loi.article.version_origine');
    expect(mentionDuTexteAffiche([L83, L2026003], false)).toBe('loi.article.version_origine.pluriel');
  });

  it('art. 5 de l’ordonnance 74/1 : une modification intégrée, l’autre non', () => {
    // Le texte affiché commence par la réécriture de l'ordonnance 77/1.
    expect(mentionDuTexteAffiche([O77, L83], true)).toBe('loi.article.sans_modification');
    expect(mentionDuTexteAffiche([O77, L83], false)).toBe('loi.article.sans_modification');
  });

  it('art. 140 du Code électoral : version consolidée, modification non intégrée', () => {
    expect(mentionDuTexteAffiche([L2026003], true)).toBe('loi.article.sans_modification');
    expect(mentionDuTexteAffiche([L2026003, L83], true)).toBe('loi.article.sans_modification.pluriel');
  });

  it('toutes intégrées : « intègre déjà », accordé', () => {
    expect(mentionDuTexteAffiche([O77], true)).toBe('loi.article.deja_integre');
    expect(mentionDuTexteAffiche([O77, { ...O77, id: 'c9' }], true)).toBe('loi.article.deja_integre.pluriel');
  });

  it('rien sans changement actuel', () => {
    expect(mentionDuTexteAffiche([], true)).toBeNull();
  });
});

describe('articles du texte qui porte un changement', () => {
  it('retire les pseudo-numéros et ramène les morceaux à leur article (Code du travail, loi 2026/003)', () => {
    // `articles_source` réels de GET /laws/2274, /laws/1703 et /laws/1541.
    expect(articlesSourceLisibles(['SECTION_2', '25', '174'])).toEqual(['25', '174']);
    expect(articlesSourceLisibles(['67.3', '174'])).toEqual(['67', '174']);
    expect(articlesSourceLisibles(['1', '140', 'SECTION_1', '143', '144', '145'])).toEqual(['1', '140', '143', '144', '145']);
    expect(articlesSourceLisibles(['DISPOSITIF', '53'])).toEqual(['53']);
  });

  it('sans doublon, et rien quand il ne reste aucun numéro', () => {
    expect(articlesSourceLisibles(['35.1', '35.2', '12 bis'])).toEqual(['35', '12 bis']);
    expect(articlesSourceLisibles(['DISPOSITIF', 'LEGAL_BASIS.1'])).toEqual([]);
  });
});

describe('historique', () => {
  it('garde toute la chaîne, dépassés compris, un groupe par texte', () => {
    const { recus, portes } = historiqueDuTexte(CONSTITUTION);
    expect(recus.map((g) => [g.texte.numero, g.changements.map((c) => c.id)])).toEqual([
      ['2008/001', ['c1', 'c2', 'c3']],
      ['2026/002', ['c4', 'c5']],
    ]);
    expect(portes).toEqual([]);
  });
});
