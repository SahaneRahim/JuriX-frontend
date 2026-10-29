import { describe, expect, it } from 'vitest';
import { corpsDeRecherche } from '$lib/api-publique';
import { _ordreProvisoire } from '$lib/categories';
import type { SearchResult } from '$lib/types';
import {
  adresseDeRecherche,
  aDesAffinages,
  aDesFiltres,
  anneeDeDebut,
  demandeAffinee,
  demandeClassique,
  filtresDuPanneau,
  lireParametres,
  LONGUEUR_MAX_REQUETE,
  natureDuType,
  PAGE_MAX,
  type ParametresDeRecherche,
} from './parametres';
import {
  domainesDuPanneau,
  effectifsParNature,
  extraitPropre,
  idsDesFacettes,
  LONGUEUR_EXTRAIT,
  resultatAffiche,
} from './resultats';

/**
 * Paramètres de /search (P7, P8) et mise en forme des résultats, sur les
 * réponses RÉELLES du contrat (data/ux-impl/notes/api/exemples,
 * recherche-affinee.json et recherche-classique.json, « indemnité de
 * licenciement »).
 */

const lire = (requete: string) => lireParametres(new URLSearchParams(requete));

const BASE: ParametresDeRecherche = {
  q: 'bail',
  perimetre: [],
  nature: null,
  categories: [],
  periode: null,
  tri: null,
  page: 1,
};

describe('lireParametres', () => {
  it('lit chaque paramètre', () => {
    expect(
      lire('q=+bail+commercial+&perimetre=8&nature=decret&categorie=8&categorie=4&periode=5ans&tri=recent&page=2'),
    ).toEqual({
      q: 'bail commercial',
      perimetre: [8],
      nature: 'decret',
      categories: [4, 8],
      periode: '5ans',
      tri: 'recent',
      page: 2,
    });
  });

  it('ignore toute valeur inconnue plutôt que de la laisser partir vers l’API (422)', () => {
    expect(
      lire(
        'q=bail&nature=nature&categorie=abc&categorie=012&categorie=99999999999&perimetre=x&perimetre=0&periode=10ans&tri=pertinence',
      ),
    ).toEqual(BASE);
  });

  it('le périmètre d’une page de domaine se lit à part des cases de la colonne', () => {
    // Le champ caché de /categories/17 : on cherche DANS le domaine.
    expect(lire('q=nomination&perimetre=17')).toMatchObject({ perimetre: [17], categories: [] });
    // Une case cochée dans la colonne : on affine ce que la recherche a trouvé.
    expect(lire('q=nomination&categorie=17')).toMatchObject({ perimetre: [], categories: [17] });
    expect(lire('q=x&perimetre=13&perimetre=4&perimetre=13').perimetre).toEqual([4, 13]);
  });

  it('sans requête, rien à chercher', () => {
    expect(lire('').q).toBe('');
    expect(lire('q=%20%20').q).toBe('');
  });

  it('borne la requête à 500 caractères (au-delà, l’API répond 422)', () => {
    expect(lire(`q=${'a'.repeat(600)}`).q).toHaveLength(LONGUEUR_MAX_REQUETE);
  });

  it('une page en forme canonique, bornée', () => {
    for (const brut of ['0', '-1', '1e3', '02', 'abc', '2.5', '']) expect(lire(`q=x&page=${brut}`).page).toBe(1);
    expect(lire('q=x&page=99999').page).toBe(PAGE_MAX);
  });

  it('domaines triés et sans doublon : une même recherche, une même adresse', () => {
    expect(lire('q=x&categorie=13&categorie=4&categorie=13').categories).toEqual([4, 13]);
  });
});

describe('adresseDeRecherche', () => {
  it('sans les valeurs par défaut', () => {
    expect(adresseDeRecherche(BASE)).toBe('/search?q=bail');
  });

  it('le périmètre juste après la requête : l’ordre du formulaire de la page d’un domaine', () => {
    expect(adresseDeRecherche({ ...BASE, perimetre: [17], nature: 'loi' })).toBe('/search?q=bail&perimetre=17&nature=loi');
  });

  it('relit ce qu’elle écrit', () => {
    const p: ParametresDeRecherche = {
      q: 'indemnité de licenciement',
      perimetre: [4],
      nature: 'acte-uniforme',
      categories: [4, 8],
      periode: 'annee',
      tri: 'ancien',
      page: 3,
    };
    const adresse = adresseDeRecherche(p, 'resultats');
    expect(adresse.endsWith('#resultats')).toBe(true);
    expect(lire(new URL(adresse, 'http://site').search.slice(1))).toEqual(p);
  });
});

describe('filtres', () => {
  it('le tri n’est pas un filtre ; le panneau compte domaines et période', () => {
    expect(aDesFiltres({ ...BASE, tri: 'recent' })).toBe(false);
    expect(aDesFiltres({ ...BASE, nature: 'loi' })).toBe(true);
    expect(filtresDuPanneau({ ...BASE, nature: 'loi', categories: [1, 2], periode: 'annee' })).toBe(3);
  });

  it('le périmètre est un filtre du panneau, mais pas un affinage (il part en `filters`)', () => {
    const domaine = { ...BASE, perimetre: [17] };
    expect(aDesFiltres(domaine)).toBe(true);
    expect(aDesAffinages(domaine)).toBe(false);
    // La colonne le montre coché parmi les domaines : la pastille le compte.
    expect(filtresDuPanneau(domaine)).toBe(1);
    expect(aDesAffinages({ ...domaine, periode: 'annee' })).toBe(true);
  });

  it('période : l’année en cours, ou les cinq dernières années, elle comprise', () => {
    expect(anneeDeDebut('annee', 2026)).toBe(2026);
    expect(anneeDeDebut('5ans', 2026)).toBe(2022);
    expect(anneeDeDebut(null, 2026)).toBeUndefined();
  });

  it('la nature d’un type, accents, casse et tirets ignorés', () => {
    expect(natureDuType('décret')).toBe('decret');
    expect(natureDuType('Acte_uniforme')).toBe('acte-uniforme');
    expect(natureDuType('arrêté')).toBe('arrete');
    expect(natureDuType('ordonnance')).toBe('autres');
    expect(natureDuType(undefined)).toBe('autres');
  });
});

describe('demandes à l’API', () => {
  const p: ParametresDeRecherche = {
    q: 'bail',
    perimetre: [],
    nature: 'autres',
    categories: [8],
    periode: '5ans',
    tri: 'recent',
    page: 2,
  };

  it('nouvelle API : refine, sort et facets, jamais de clé inconnue', () => {
    const corps = corpsDeRecherche(demandeAffinee(p, 2026));
    expect(corps).toEqual({
      query: 'bail',
      mode: 'hybrid',
      limit: 20,
      offset: 20,
      filters: { status: 'published' },
      sort: 'date_desc',
      refine: {
        types: ['ordonnance', 'circulaire', 'décision', 'instruction', 'autre'],
        category_ids: [8],
        year_from: 2022,
      },
      facets: true,
    });
  });

  it('nouvelle API sans filtre : les effectifs seuls, sans refine vide', () => {
    const corps = corpsDeRecherche(demandeAffinee(BASE, 2026));
    expect(corps.refine).toBeUndefined();
    expect(corps.sort).toBeUndefined();
    expect(corps.facets).toBe(true);
  });

  it('ancienne API : les mêmes filtres, en SQL (filters), qu’elle applique depuis toujours', () => {
    const corps = corpsDeRecherche(demandeClassique(p, 2026));
    expect(corps).toEqual({
      query: 'bail',
      mode: 'hybrid',
      limit: 20,
      offset: 20,
      filters: {
        types: ['ordonnance', 'circulaire', 'décision', 'instruction', 'autre'],
        category_ids: [8],
        year_from: 2022,
        status: 'published',
      },
    });
  });

  it('nouvelle API, page d’un domaine : le périmètre délimite l’ensemble en SQL, jamais en refine', () => {
    // « nomination » depuis Santé publique (17) : en `refine`, l'API ne
    // gardait que les textes du domaine parmi les vingt premiers de TOUT le
    // corpus (52 décrets de la Fonction publique) : aucun résultat. En
    // `filters`, elle les cherche dans le domaine : 10 (API de test, 29/10).
    const corps = corpsDeRecherche(demandeAffinee(lire('q=nomination&perimetre=17'), 2026));
    expect(corps.filters).toEqual({ category_ids: [17], status: 'published' });
    expect(corps.refine).toBeUndefined();
    expect(corps.facets).toBe(true);
  });

  it('nouvelle API : le périmètre en filters, les cases et la période affinent ce qu’il trouve', () => {
    const corps = corpsDeRecherche(
      demandeAffinee({ ...BASE, perimetre: [17], nature: 'decret', categories: [4], periode: 'annee' }, 2026),
    );
    expect(corps.filters).toEqual({ category_ids: [17], status: 'published' });
    expect(corps.refine).toEqual({ types: ['décret'], category_ids: [4], year_from: 2026 });
  });

  it('ancienne API : périmètre et cases réunis dans filters, triés et sans doublon', () => {
    const corps = corpsDeRecherche(demandeClassique({ ...BASE, perimetre: [17, 4], categories: [4, 2] }, 2026));
    expect(corps.filters).toEqual({ category_ids: [2, 4, 17], status: 'published' });
  });
});

/** Le Code civil dans recherche-affinee.json : extrait à blancs multiples, statut en bref. */
const CODE_CIVIL = {
  law_id: 2285,
  reference: 'CODE-CIVIL',
  title: 'Code civil applicable au Cameroun, annoté de la jurisprudence de la Cour suprême',
  type: 'autre',
  language: 'fr',
  status: 'published',
  category_id: 1,
  category_name: 'Droit Civil et Procédure Civile',
  publication_date: null,
  relevance_score: 0.82,
  match_scope: 'body',
  matched_articles: [
    { article_id: 95171, number: '107', title: null, content_snippet: 'mais sans préjudice…', relevance_score: 0.82 },
    { article_id: 94848, number: '1794', title: null, content_snippet: 'Le maître peut résilier…', relevance_score: 0.36 },
    { article_id: 94869, number: '1816', title: null, content_snippet: 'Le bailleur peut…', relevance_score: 0.31 },
  ],
  highlights: {
    content:
      "mais sans préjudice du droit au préavis et aux <mark>indemnités</mark> liées à la résiliation du contrat de travail. Avant la saisine du Juge-commissaire, le syndic établit l'ordre des <mark>licenciements</mark> conformément aux dispositions du\n\ndroit du travail applicable.\n\n\nSont",
  },
  content: 'Hormis pour les contrats conclus en considération de la personne du débiteur…',
  objet: null,
  numero: null,
  date_signature: null,
  annee: null,
  date_publication_jo: null,
  statut: { abroge: false, textes: 12, natures: { abroge_partiellement: 11, complete: 1 }, date_dernier_texte: '2024-12-23' },
} as unknown as SearchResult;

describe('resultatAffiche', () => {
  it('ne garde que ce que la ligne affiche', () => {
    const r = resultatAffiche(CODE_CIVIL);
    expect(Object.keys(r).sort()).toEqual(
      [
        'annee',
        'articles',
        'category_id',
        'category_name',
        'date_publication_jo',
        'date_signature',
        'extrait',
        'id',
        'numero',
        'objet',
        'publication_date',
        'statut',
        'title',
        'type',
      ].sort(),
    );
    expect(r.id).toBe(2285);
    expect(r.articles).toEqual(['107', '1794', '1816']);
    expect(r.statut?.textes).toBe(12);
  });

  it('ancienne API : aucune clé de repère inventée (dateDeLActe les teste par leur présence)', () => {
    const ancien = { ...CODE_CIVIL } as Record<string, unknown>;
    for (const cle of ['objet', 'numero', 'date_signature', 'annee', 'date_publication_jo', 'statut']) delete ancien[cle];
    const r = resultatAffiche(ancien as unknown as SearchResult);
    expect('date_signature' in r).toBe(false);
    expect('statut' in r).toBe(false);
  });

  it('extrait : mots cherchés en gras, blancs de l’OCR ramenés à un seul', () => {
    const { extrait } = resultatAffiche(CODE_CIVIL);
    expect(extrait.filter((s) => s.gras).map((s) => s.texte)).toEqual(['indemnités', 'licenciements']);
    const texte = extrait.map((s) => s.texte).join('');
    expect(texte).not.toMatch(/\s{2,}|\n/);
    expect(texte.startsWith('mais sans préjudice')).toBe(true);
  });

  it('extrait sans surlignage : le premier extrait d’article, puis le texte', () => {
    const sansSurlignage = { ...CODE_CIVIL, highlights: {} } as SearchResult;
    expect(resultatAffiche(sansSurlignage).extrait[0].texte).toBe('mais sans préjudice…');
    const sansRien = { ...CODE_CIVIL, highlights: {}, matched_articles: [] } as unknown as SearchResult;
    expect(resultatAffiche(sansRien).extrait[0].texte.startsWith('Hormis')).toBe(true);
  });
});

describe('extraitPropre', () => {
  it('retire le markdown des tableaux sans perdre le gras', () => {
    const brut = 'Primes et gratifications |\n| 6623 | Congés payés |\n| 6624 | <mark>Indemnités</mark> de préavis et de <mark>licenciement</mark> |';
    const extrait = extraitPropre(brut);
    expect(extrait.map((s) => s.texte).join('')).toBe(
      'Primes et gratifications 6623 Congés payés 6624 Indemnités de préavis et de licenciement',
    );
    expect(extrait.filter((s) => s.gras).map((s) => s.texte)).toEqual(['Indemnités', 'licenciement']);
  });

  it('coupé sur une fin de mot, « … » à la coupe, jamais au-delà de la longueur', () => {
    const brut = `${'mot '.repeat(100)}<mark>loin</mark>`;
    const extrait = extraitPropre(brut);
    const texte = extrait.map((s) => s.texte).join('');
    expect(texte.endsWith('mot…')).toBe(true);
    expect(texte.length).toBeLessThanOrEqual(LONGUEUR_EXTRAIT + 1);
    expect(extrait.some((s) => s.gras)).toBe(false);
  });

  it('une balise autre que <mark> reste du texte', () => {
    expect(extraitPropre('<script>x</script> <mark>y</mark>').map((s) => s.texte).join('')).toBe('<script>x</script> y');
  });

  it('vide pour un extrait vide', () => {
    expect(extraitPropre(null)).toEqual([]);
    expect(extraitPropre('  \n ')).toEqual([]);
  });
});

/** facets de recherche-affinee.json. */
const FACETTES = {
  types: [
    { value: 'décret', count: 12 },
    { value: 'loi', count: 7 },
    { value: 'acte uniforme', count: 4 },
    { value: 'autre', count: 2 },
  ],
  categories: [
    { id: 8, name: 'Droit des Affaires, Banque et OHADA', count: 15 },
    { id: 6, name: 'Droit Administratif', count: 2 },
    { id: 16, name: "Droit de l'Environnement et des Ressources Naturelles", count: 2 },
    { id: 13, name: 'Fonction Publique', count: 2 },
    { id: 1, name: 'Droit Civil et Procédure Civile', count: 1 },
    { id: 14, name: 'Droit International', count: 1 },
    { id: 2, name: 'Droit Pénal et Procédure Pénale', count: 1 },
    { id: 4, name: 'Droit du Travail et Sécurité Sociale', count: 1 },
  ],
};

describe('effectifs', () => {
  it('par nature ; « tous » est leur somme', () => {
    expect(effectifsParNature(FACETTES.types)).toEqual({
      tous: 25,
      decret: 12,
      loi: 7,
      arrete: 0,
      'acte-uniforme': 4,
      autres: 2,
    });
    expect(effectifsParNature(null).tous).toBe(0);
  });

  it('les 14 domaines dans l’ordre fixe de l’accueil, zéro pour ceux qui manquent', () => {
    const cases = domainesDuPanneau(FACETTES.categories, [4]);
    expect(cases).toHaveLength(14);
    // L'ordre de l'accueil (Q2 A) : le travail en tête, et non plus la Constitution.
    expect(cases[0]).toEqual({ id: 4, nom: 'Droit du Travail et Sécurité Sociale', n: 1, coche: true });
    expect(cases.find((c) => c.nom === 'droit constitutionnel')).toEqual({
      id: null,
      nom: 'droit constitutionnel',
      n: 0,
      coche: false,
    });
    expect(cases.find((c) => c.id === 8)).toMatchObject({ n: 15, coche: false });
    // L'ordre ne dépend pas des effectifs : la case ne saute pas d'une ligne à l'autre.
    expect(cases.map((c) => c.nom.toLowerCase())).toEqual([..._ordreProvisoire()]);
  });

  it('un domaine coché sans effectif reste visible et décochable', () => {
    const cases = domainesDuPanneau(FACETTES.categories, [9], new Map([[9, 'Droit Constitutionnel']]));
    expect(cases.find((c) => c.id === 9)).toEqual({ id: 9, nom: 'droit constitutionnel', n: 0, coche: true });
    const inconnu = domainesDuPanneau([], [77]);
    expect(inconnu.at(-1)).toEqual({ id: 77, nom: '', n: 0, coche: true });
  });

  it('un domaine que la liste fermée ne connaît pas vient à la fin', () => {
    const cases = domainesDuPanneau([...FACETTES.categories, { id: 30, name: 'Droit spatial', count: 3 }], []);
    expect(cases.at(-1)).toEqual({ id: 30, nom: 'Droit spatial', n: 3, coche: false });
    expect(idsDesFacettes(FACETTES.categories).has(13)).toBe(true);
  });
});
