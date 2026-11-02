import { describe, expect, it } from 'vitest';
import {
  adresseDeCitation,
  adresseDuServeur,
  articleDeCitation,
  articleDepuisLApi,
  articleNomme,
  articlesDepuisLApi,
  avecLesArticlesDeLaRedaction,
  BLOG_POSTS,
  citationBruteVerifiee,
  citationDepuisLApi,
  citationsNonVerifiees,
  cleDExplication,
  estUneCoteInterne,
  etatDePublication,
  insecables,
  lienDeCitation,
  numeroDeLaCitation,
  referenceAffichable,
  sansMarkdown,
  sansRenvoisAuxExtraits,
  servableAuPublic,
  texteAffiche,
  titreDeCitation,
} from './blog';
import { t } from '$lib/stores/language';
import { ARTICLE_ANCIEN, ARTICLE_ANCIEN_PUBLIC, ECRIT_PAR_LE_MODELE } from './blog-anciens-de-test';

/**
 * Les citations d'un article du blog : ni cote interne (P2), un lien vers
 * l'article cité (`?article=N`), et, pour les articles de la rédaction, des
 * extraits relevés mot pour mot dans la base.
 */

describe('estUneCoteInterne', () => {
  it('reconnaît toutes les formes de cote de jurix_dev (relevé du 29/10/2026)', () => {
    for (const cote of [
      'PRC-4722',
      'PRC-10679',
      'LOI-1992-007',
      'LOI-2019-LF-9',
      'ORD-2020-001',
      'DEC-1994-199',
      'OHADA-AUDCG-2010',
      'OHADA-TRAITE-1993',
      'CODE-CIVIL',
      'CIMA-CODE-2019',
    ]) {
      expect(estUneCoteInterne(cote), cote).toBe(true);
    }
  });

  it('laisse les noms, et les sigles qui ne sont pas des cotes', () => {
    expect(estUneCoteInterne('Code civil applicable au Cameroun')).toBe(false);
    expect(estUneCoteInterne('Loi n° 2010/012 relative à la cybersécurité et la cybercriminalité')).toBe(false);
    expect(estUneCoteInterne('N°2018/9387/CAB/PM')).toBe(false);
    expect(estUneCoteInterne('COVID-19')).toBe(false);
    expect(estUneCoteInterne('')).toBe(false);
    expect(estUneCoteInterne(null)).toBe(false);
  });
});

describe('ce qu’une citation affiche', () => {
  it('écarte la cote que le générateur met dans `reference`', () => {
    expect(referenceAffichable({ reference: 'PRC-4722' })).toBeNull();
    expect(referenceAffichable({ reference: ' LOI-1992-007 ' })).toBeNull();
    expect(referenceAffichable({ reference: 'Code du travail (loi n° 92/007)' })).toBe('Code du travail (loi n° 92/007)');
    expect(referenceAffichable({ reference: '' })).toBeNull();
  });

  it('retire la cote de l’intitulé par défaut du générateur (« Article 35.1 - PRC-4722 »)', () => {
    expect(titreDeCitation({ title: 'Article 35.1 - PRC-4722' })).toBe('Article 35.1');
    expect(titreDeCitation({ title: 'Violation de domicile (PRC-4722)' })).toBe('Violation de domicile');
    expect(titreDeCitation({ title: 'PRC-4722' })).toBe('');
    expect(titreDeCitation({ title: 'Du préavis — Code du travail' })).toBe('Du préavis — Code du travail');
  });

  it('un numéro d’article, ou rien (« ? » du générateur)', () => {
    expect(articleDeCitation({ articleNumber: '299' })).toBe('299');
    expect(articleDeCitation({ articleNumber: ' 35.1 ' })).toBe('35.1');
    expect(articleDeCitation({ articleNumber: '?' })).toBeNull();
    expect(articleDeCitation({})).toBeNull();
  });

  it('le lien vise l’article cité (P2), jamais un texte deviné', () => {
    expect(adresseDeCitation({ lawId: 2236, articleNumber: '299' })).toBe('/laws/2236?article=299');
    expect(adresseDeCitation({ lawId: 2271 })).toBe('/laws/2271');
    expect(adresseDeCitation({ lawId: 2274, articleNumber: '?' })).toBe('/laws/2274');
    // 1 : la valeur par défaut du schéma et de l'exemple du prompt, pas un texte sûr.
    expect(adresseDeCitation({ lawId: 1, articleNumber: '12' })).toBeNull();
    expect(adresseDeCitation({ lawId: 0 })).toBeNull();
    expect(adresseDeCitation({ lawId: Number.NaN })).toBeNull();
  });
});

describe('articles de la rédaction (servis sans l’API)', () => {
  const citations = BLOG_POSTS.flatMap((post) => post.botAnalysis.citations.map((c) => ({ post: post.slug, ...c })));

  it('chaque citation vise un article précis d’un texte vérifié, sans cote', () => {
    expect(citations.length).toBeGreaterThan(0);
    for (const c of citations) {
      expect(adresseDeCitation(c), `${c.post} : ${c.title}`).toMatch(/^\/laws\/\d+\?article=\d+$/);
      expect(referenceAffichable(c), `${c.post} : ${c.title}`).not.toBeNull();
      expect(c.verifie, `${c.post} : ${c.title}`).toBe(true);
    }
  });

  it('les identifiants relevés dans jurix_dev, et non plus ceux d’autres textes', () => {
    // /laws/2 (convocation du corps électoral), /laws/1, /laws/14 et /laws/18
    // (décrets de 2013) étaient cités pour le Code civil, le Code pénal, le
    // Code du travail et la loi sur la cybersécurité.
    const textes = new Set(citations.map((c) => c.lawId));
    for (const ancien of [1, 2, 14, 18]) expect(textes.has(ancien)).toBe(false);
    // 2281 : l'Acte uniforme OHADA sur les voies d'exécution (article 29),
    // cité depuis l'audit r2 pour le concours de la force publique.
    expect([...textes].sort()).toEqual([2236, 2271, 2274, 2281, 2285]);
  });

  it('aucune règle de l’audit r2 sans appui : ni huissier, ni indexation, ni « 6 mois »', () => {
    // Phrases sans article à l'appui, dont l'une contredisait le Code du
    // travail (articles 69 et 74) : retirées, et elles ne doivent pas revenir.
    const texte = JSON.stringify(BLOG_POSTS);
    expect(texte).not.toMatch(/huissier|clause d’indexation|sous réserve de mes droits|délai de 6 mois/);
    const cites = (slug: string) =>
      BLOG_POSTS.find((p) => p.slug === slug)!.botAnalysis.citations.map((c) => c.articleNumber);
    expect(cites('litiges-locatifs-resiliation-bail-expulsion-abusive')).toEqual(['1736', '299', '1737', '1134', '29']);
  });

  it('ni « en vigueur », ni casse anglaise dans les noms de codes', () => {
    const texte = JSON.stringify(BLOG_POSTS);
    expect(texte).not.toMatch(/en vigueur/i);
    expect(texte).not.toMatch(/Code (Civil|Pénal|du Travail)/);
  });
});

/* -------------------------------------------------------------------------- */
/* Revue du 29/10 : ce que le run réel et la doublure ont montré               */
/* -------------------------------------------------------------------------- */

describe('citations du générateur d’origine (run réel du 29/10)', () => {
  it('seul un vrai numéro d’article passe : ni phrase, ni parenthèse, ni « ? »', () => {
    // Les trois numéros du run réel : aucun n'était un numéro.
    expect(articleDeCitation({ articleNumber: 'Non numéroté explicitement dans l’extrait, mais inspiré de l’article 10' })).toBeNull();
    expect(articleDeCitation({ articleNumber: '1351 (et jurisprudence)' })).toBeNull();
    expect(articleDeCitation({ articleNumber: '?' })).toBeNull();
    // Ceux que la page d'un texte sait ouvrir.
    expect(articleDeCitation({ articleNumber: '12 BIS' })).toBe('12 bis');
    expect(articleDeCitation({ articleNumber: '1er' })).toBe('1');
    expect(articleDeCitation({ articleNumber: '55.2' })).toBe('55.2');
    // Le lien d'une citation sans numéro sûr vise le texte, jamais un article deviné.
    expect(adresseDeCitation({ lawId: 2285, articleNumber: '1351 (et jurisprudence)' })).toBe('/laws/2285');
    expect(adresseDeCitation({ lawId: 2274, articleNumber: '12 bis' })).toBe('/laws/2274?article=12%20bis');
  });

  it('la cote interne est retirée même à l’intérieur d’un nom inventé', () => {
    expect(referenceAffichable({ reference: 'Prescription relative aux conditions de validité des contrats de location (PRC-4722)' })).toBe(
      'Prescription relative aux conditions de validité des contrats de location',
    );
    expect(referenceAffichable({ reference: 'Code civil (CODE-CIVIL)' })).toBe('Code civil');
  });
});

describe('articleDepuisLApi : une sortie mal formée ne fait plus planter la page', () => {
  const BRUT = {
    id: 7,
    slug: 'bail-expulsion',
    title: '**Expulsion** sans juge : ce que dit la loi',
    category: 'Immobilier',
    publishedAt: '2026-10-29',
    readingTime: '5 min',
    context: 'Un bailleur de Douala…',
    botAnalysis: {
      summary: 'Le bailleur ne peut pas expulser seul.',
      // Un point clé rendu en objet par le modèle : la page répondait 500.
      keyPoints: ['Pas d’expulsion sans décision de justice.', { point: 'objet' }, null, '  '],
      // Une citation `null` : le loader échouait et la page devenait un 404.
      citations: [
        null,
        {
          law_id: 2236,
          article_id: 98765,
          article_number: '299',
          reference: 'Code pénal (loi n° 2016/007)',
          explication: 'Entrer chez autrui contre son gré est puni.',
          title: 'Article 299',
          excerpt: 'Est puni d’un emprisonnement…',
          url: '/laws/2236?article=299',
          verifie: true,
        },
        'texte libre',
      ],
      citizenImpact: 'Saisissez le juge des référés.',
    },
    suggestedQuestion: 'Mon bailleur peut-il changer la serrure ?',
    tags: ['bail', 3, null],
    isPublished: true,
    avertissements: ['L’article 286 du Code pénal n’est porté par aucune source.'],
    etat_publication: 'publiable',
  };

  it('ne garde que des textes et des citations-objets', () => {
    const post = articleDepuisLApi(BRUT)!;
    expect(post.botAnalysis.keyPoints).toEqual(['Pas d’expulsion sans décision de justice.']);
    expect(post.botAnalysis.citations).toHaveLength(1);
    expect(post.tags).toEqual(['bail']);
    const [citation] = post.botAnalysis.citations;
    // L'explication relue est l'intitulé de la carte ; l'extrait vérifié par le serveur le reste.
    expect(citation).toEqual({
      lawId: 2236,
      articleNumber: '299',
      reference: 'Code pénal (loi n° 2016/007)',
      title: 'Entrer chez autrui contre son gré est puni.',
      excerpt: 'Est puni d’un emprisonnement…',
      url: '/laws/2236?article=299',
      verifie: true,
    });
    expect(post.genereParIA).toBe(true);
    expect(post.publie).toBe(true);
    expect(post.id).toBe(7);
    // Les avertissements de la relecture ne vont pas dans les données publiques.
    expect(JSON.stringify(post)).not.toContain('286');
  });

  it('tolère l’absence de tout champ facultatif, et refuse un article sans adresse ni titre', () => {
    const post = articleDepuisLApi({ slug: 'a', title: 'T' })!;
    expect(post.botAnalysis).toEqual({ summary: '', keyPoints: [], citations: [], citizenImpact: '' });
    expect(post.category).toBe('Actualité juridique');
    expect(post.readingTime).toBe('4 min');
    expect(post.date).toBe('');
    expect(articleDepuisLApi({ title: 'sans adresse' })).toBeNull();
    expect(articleDepuisLApi({ slug: 'sans-titre' })).toBeNull();
    expect(articleDepuisLApi(null)).toBeNull();
    expect(articleDepuisLApi('texte')).toBeNull();
    // Une date illisible n'est pas une date (la page écrit « Récemment »).
    expect(articleDepuisLApi({ slug: 'a', title: 'T', publishedAt: 'hier' })!.date).toBe('');
  });

  it('un brouillon est marqué, et la liste publique l’écarte', () => {
    expect(articleDepuisLApi({ ...BRUT, isPublished: false })!.publie).toBe(false);
    const liste = articlesDepuisLApi([BRUT, { ...BRUT, slug: 'brouillon', isPublished: false }, { ...BRUT }, 'x']);
    // Le brouillon est écarté, le doublon d'adresse aussi.
    expect(liste.map((p) => p.slug)).toEqual(['bail-expulsion']);
    expect(articlesDepuisLApi({ detail: 'Not Found' })).toEqual([]);
  });

  it('le champ d’explication présent est celui qu’on réécrit, `title` à défaut', () => {
    expect(cleDExplication({ explication: '', title: 'Article 5' })).toBe('explication');
    expect(cleDExplication({ explanation: 'x' })).toBe('explanation');
    expect(cleDExplication({ title: 'x' })).toBe('title');
    expect(cleDExplication({})).toBe('title');
  });
});

describe('avecLesArticlesDeLaRedaction : les trois articles vérifiés restent listés', () => {
  const api = (slug: string, date: string) => articleDepuisLApi({ slug, title: slug, publishedAt: date })!;

  it('le premier article publié ne fait plus disparaître ceux de la rédaction', () => {
    const liste = avecLesArticlesDeLaRedaction([api('nouveau', '2026-10-29')]);
    expect(liste.map((p) => p.slug)).toEqual([
      'nouveau',
      'litiges-locatifs-resiliation-bail-expulsion-abusive',
      'rupture-contrat-travail-preavis-indemnites-licenciement',
      'arnaques-mobile-money-e-commerce-recours-legaux',
    ]);
  });

  it('du plus récent au plus ancien, une adresse une seule fois (celle de l’API l’emporte)', () => {
    const repris = { ...api(BLOG_POSTS[1].slug, '2026-10-18'), title: 'Version corrigée par l’administrateur' };
    const liste = avecLesArticlesDeLaRedaction([api('ancien', '2026-01-02'), repris, api('sans-date', '')]);
    expect(liste.map((p) => p.slug)).toEqual([
      BLOG_POSTS[0].slug,
      BLOG_POSTS[1].slug,
      BLOG_POSTS[2].slug,
      'ancien',
      'sans-date',
    ]);
    expect(liste.filter((p) => p.slug === BLOG_POSTS[1].slug)).toHaveLength(1);
    expect(liste[1].title).toBe('Version corrigée par l’administrateur');
  });

  it('sans article de l’API, les trois de la rédaction', () => {
    expect(avecLesArticlesDeLaRedaction([]).map((p) => p.slug)).toEqual(BLOG_POSTS.map((p) => p.slug));
  });
});

describe('texte affiché : le Markdown résiduel du modèle', () => {
  it('retire gras, italique, titres et puces, garde le texte', () => {
    expect(sansMarkdown('**Important** : le *préavis* court.')).toBe('Important : le préavis court.');
    expect(sansMarkdown('### Ce que dit la loi\n* Premier point\n* Second')).toBe('Ce que dit la loi\n• Premier point\n• Second');
    // Une marque coupée par la limite de jetons ne laisse pas d'astérisques.
    expect(sansMarkdown('Le bailleur **doit saisir')).toBe('Le bailleur doit saisir');
    // Un astérisque seul peut avoir un sens : il reste.
    expect(sansMarkdown('article 5* et 6')).toBe('article 5* et 6');
    expect(sansMarkdown('2 * 3')).toBe('2 * 3');
  });

  it('retire les cotes internes entre parenthèses', () => {
    expect(sansMarkdown('L’expulsion est interdite (PRC-4722).')).toBe('L’expulsion est interdite.');
    expect(sansMarkdown('Bail professionnel (Art. OHADA-AUDCG) applicable')).toBe('Bail professionnel applicable');
  });

  it('ne plante sur aucune valeur', () => {
    for (const valeur of [null, undefined, { point: 'x' }, ['a'], 12]) {
      expect(() => texteAffiche(valeur)).not.toThrow();
      expect(() => insecables(valeur)).not.toThrow();
    }
    expect(texteAffiche({ point: 'x' })).toBe('');
    expect(insecables('Vraiment ?')).toBe('Vraiment\u202F?');
  });
});

/* -------------------------------------------------------------------------- */
/* Revue crois\u00E9e du 29/10 et contrat du 30/10 : les citations non v\u00E9rifi\u00E9es    */
/* -------------------------------------------------------------------------- */

describe('citation v\u00E9rifi\u00E9e : `verifie`, un extrait ET un lien du serveur (contrat du 30/10)', () => {
  const VERIFIEE = {
    law_id: 2236,
    article_id: 501,
    article_number: '299',
    reference: 'Code p\u00E9nal (loi n\u00B0 2016/007)',
    title: 'Violation de domicile',
    excerpt: 'Est puni d\u2019un emprisonnement de dix (10) jours \u00E0 un (01) an\u2026',
    url: '/laws/2236?article=299',
    verifie: true,
  };

  it('les trois marques, sinon non v\u00E9rifi\u00E9e ; `verifie` absent n\u2019est jamais un accord', () => {
    expect(citationBruteVerifiee(VERIFIEE)).toBe(true);
    expect(citationBruteVerifiee({ ...VERIFIEE, verifie: false })).toBe(false);
    expect(citationBruteVerifiee({ ...VERIFIEE, verifie: undefined })).toBe(false);
    expect(citationBruteVerifiee({ ...VERIFIEE, verifie: 'true' })).toBe(false);
    expect(citationBruteVerifiee({ ...VERIFIEE, excerpt: '  ' })).toBe(false);
    expect(citationBruteVerifiee({ ...VERIFIEE, url: undefined })).toBe(false);
  });

  it('le lien du serveur : une adresse interne du texte cit\u00E9, rien d\u2019autre', () => {
    expect(adresseDuServeur('/laws/2236?article=299', 2236)).toBe('/laws/2236?article=299');
    expect(adresseDuServeur('/laws/2236?article=L%20104', 2236)).toBe('/laws/2236?article=L%20104');
    expect(adresseDuServeur('/laws/2236', 2236)).toBe('/laws/2236');
    // Un autre texte que celui que la carte nomme, un autre site, un script.
    expect(adresseDuServeur('/laws/2285?article=299', 2236)).toBeNull();
    expect(adresseDuServeur('https://exemple.cm/laws/2236', 2236)).toBeNull();
    expect(adresseDuServeur('//exemple.cm/laws/2236', 2236)).toBeNull();
    expect(adresseDuServeur('javascript:alert(1)', 2236)).toBeNull();
    expect(adresseDuServeur('/laws/2236?article=299"><script>', 2236)).toBeNull();
    expect(adresseDuServeur(null, 2236)).toBeNull();
    // Un lien refus\u00E9 rend la citation non v\u00E9rifi\u00E9e.
    expect(citationBruteVerifiee({ ...VERIFIEE, url: 'https://exemple.cm' })).toBe(false);
  });

  it('non v\u00E9rifi\u00E9e : seuls le texte et le num\u00E9ro restent, d\u00E8s la lecture', () => {
    const lue = citationDepuisLApi({ ...VERIFIEE, verifie: false })!;
    expect(lue).toEqual({
      lawId: 2236,
      articleNumber: '299',
      reference: 'Code p\u00E9nal (loi n\u00B0 2016/007)',
      title: '',
      excerpt: '',
      verifie: false,
    });
    // V\u00E9rifi\u00E9e : le lien du serveur est gard\u00E9, c'est celui de la carte.
    expect(citationDepuisLApi(VERIFIEE)!.url).toBe('/laws/2236?article=299');
    expect(lienDeCitation(citationDepuisLApi(VERIFIEE)!)).toBe('/laws/2236?article=299');
    expect(lienDeCitation(lue)).toBeNull();
    // Article de la r\u00E9daction : v\u00E9rifi\u00E9, sans lien du serveur, lien calcul\u00E9.
    expect(lienDeCitation(BLOG_POSTS[0].botAnalysis.citations[0])).toBe('/laws/2285?article=1736');
  });

  it('le num\u00E9ro d\u2019une citation v\u00E9rifi\u00E9e s\u2019\u00E9crit m\u00EAme hors des formes que la page reconna\u00EEt', () => {
    // \u00AB L 104 \u00BB : 7 citations publi\u00E9es, que la carte montrait sans num\u00E9ro (revue du 29/10).
    expect(numeroDeLaCitation({ articleNumber: 'L 104', verifie: true })).toBe('L 104');
    expect(numeroDeLaCitation({ articleNumber: '12 BIS', verifie: true })).toBe('12 bis');
    // Ni un intitul\u00E9 de la base, ni une phrase.
    expect(numeroDeLaCitation({ articleNumber: 'CONTENU', verifie: true })).toBeNull();
    expect(numeroDeLaCitation({ articleNumber: 'Non num\u00E9rot\u00E9 explicitement dans l\u2019extrait, article 10', verifie: true })).toBeNull();
    // Non v\u00E9rifi\u00E9e : seulement un vrai num\u00E9ro.
    expect(numeroDeLaCitation({ articleNumber: 'L 104', verifie: false })).toBeNull();
    expect(numeroDeLaCitation({ articleNumber: '299', verifie: false })).toBe('299');
  });
});

describe('articles publi\u00E9s avant le contrat (lignes 1 \u00E0 3 de jurix_dev)', () => {
  it('rien de ce que le mod\u00E8le a \u00E9crit dans les citations ne reste dans les donn\u00E9es de la page', () => {
    // Les donn\u00E9es d'un chargement serveur sont recopi\u00E9es dans le HTML : un
    // extrait gard\u00E9 ici serait servi, m\u00EAme non affich\u00E9.
    for (const forme of [ARTICLE_ANCIEN, ARTICLE_ANCIEN_PUBLIC]) {
      const post = articleDepuisLApi(forme)!;
      const donnees = JSON.stringify(post);
      for (const texte of ECRIT_PAR_LE_MODELE) expect(donnees, texte).not.toContain(texte);
      expect(post.botAnalysis.citations).toEqual([
        { lawId: 1, articleNumber: '1719', reference: 'Code Civil / Droit des obligations', title: '', excerpt: '', verifie: false },
        { lawId: 1, articleNumber: '299', reference: 'Loi portant Code P\u00E9nal camerounais', title: '', excerpt: '', verifie: false },
      ]);
      expect(citationsNonVerifiees(post)).toBe(2);
    }
  });

  it('le compte des citations non v\u00E9rifi\u00E9es : z\u00E9ro pour les articles de la r\u00E9daction', () => {
    for (const post of BLOG_POSTS) expect(citationsNonVerifiees(post), post.slug).toBe(0);
    expect(citationsNonVerifiees({ botAnalysis: { citations: null } } as never)).toBe(0);
    expect(citationsNonVerifiees(null)).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Contrat du 30/10 : seuls les articles publiables, « (suite) », renvois       */
/* -------------------------------------------------------------------------- */

describe('pages publiques : un article de l’API n’est servi que publié ET publiable', () => {
  const PUBLIABLE = {
    slug: 'bail-expulsion',
    title: 'Expulsion sans juge',
    publishedAt: '2026-10-30',
    botAnalysis: {
      summary: 'Le bailleur ne peut pas expulser seul.',
      citations: [
        {
          law_id: 2236,
          article_number: '299',
          reference: 'Code pénal',
          title: 'Violation de domicile',
          excerpt: 'Est puni…',
          url: '/laws/2236?article=299',
          verifie: true,
        },
      ],
    },
    isPublished: true,
    etat_publication: 'publiable',
  };

  it('l’état du contrat, ou null', () => {
    for (const etat of ['publiable', 'relecture_incomplete', 'controle_a_relancer', 'phrases_contredites', 'citations_non_verifiees']) {
      expect(etatDePublication(etat)).toBe(etat);
    }
    expect(etatDePublication('publie')).toBeNull();
    expect(etatDePublication(undefined)).toBeNull();
  });

  it('publiable : l’état du serveur ET toutes les citations vérifiées', () => {
    expect(servableAuPublic(articleDepuisLApi(PUBLIABLE))).toBe(true);
    expect(servableAuPublic(articleDepuisLApi({ ...PUBLIABLE, etatPublication: 'publiable', etat_publication: undefined }))).toBe(true);
    for (const [nom, variante] of [
      ['relecture incomplète', { ...PUBLIABLE, etat_publication: 'relecture_incomplete' }],
      ['contrôle à relancer', { ...PUBLIABLE, etat_publication: 'controle_a_relancer' }],
      ['état absent (jamais un accord)', { ...PUBLIABLE, etat_publication: undefined }],
      ['état inconnu', { ...PUBLIABLE, etat_publication: 'ok' }],
      ['brouillon', { ...PUBLIABLE, isPublished: false }],
      [
        'citation non vérifiée, même si le serveur dit publiable',
        { ...PUBLIABLE, botAnalysis: { ...PUBLIABLE.botAnalysis, citations: [{ law_id: 1, article_number: '299', verifie: false }] } },
      ],
    ] as const) {
      expect(servableAuPublic(articleDepuisLApi(variante)), nom).toBe(false);
    }
  });

  it('la liste publique écarte les articles publiés avant la vérification, et tout article non publiable', () => {
    const liste = articlesDepuisLApi([
      PUBLIABLE,
      { ...ARTICLE_ANCIEN, etat_publication: 'citations_non_verifiees' },
      // Une API qui oublierait l'état, ou dirait « publiable » d'un article ancien.
      ARTICLE_ANCIEN,
      { ...ARTICLE_ANCIEN, slug: 'ancien-dit-publiable', etat_publication: 'publiable' },
      { ...PUBLIABLE, slug: 'a-relire', etat_publication: 'relecture_incomplete' },
    ]);
    expect(liste.map((p) => p.slug)).toEqual(['bail-expulsion']);
  });
});

describe('« (suite) » : l’extrait est la suite d’un article', () => {
  const fr = (cle: string) => t(cle, 'fr');
  const en = (cle: string) => t(cle, 'en');

  it('la citation garde `suite`, et son nom le dit à côté du numéro', () => {
    const suite = citationDepuisLApi({
      law_id: 2274,
      article_number: '39',
      reference: 'Code du travail',
      title: 'Le salaire de référence.',
      excerpt: '[…] (6) Le salaire à prendre en considération…',
      url: '/laws/2274?article=39',
      verifie: true,
      suite: true,
    })!;
    expect(suite.suite).toBe(true);
    expect(articleNomme(suite, fr)).toBe('Article 39\u00a0(suite)');
    expect(articleNomme(suite, en)).toBe('Article 39\u00a0(continued)');
    // Le début de l'article : rien de plus.
    expect(articleNomme({ ...suite, suite: undefined }, fr)).toBe('Article 39');
    // Sans numéro, vérifiée : « Extrait légal (suite) » ; non vérifiée : rien.
    expect(articleNomme({ articleNumber: '', verifie: true, suite: true }, fr)).toBe('Extrait légal\u00a0(suite)');
    expect(articleNomme({ articleNumber: '', verifie: false, suite: true }, fr)).toBe('');
  });
});

describe('les renvois à la numérotation interne des extraits ne s’affichent jamais', () => {
  it('« (extrait 2) », « (extraits 5 et 9) », « [3] »… retirés de la prose', () => {
    // Les cinq renvois des points clés de l'essai réel du 30/10 (licenciement).
    expect(sansRenvoisAuxExtraits('… une indemnité correspondant au salaire du délai non respecté (extrait 2).')).toBe(
      '… une indemnité correspondant au salaire du délai non respecté.',
    );
    expect(sansRenvoisAuxExtraits('Entre trois mois et un mois par année (extraits 5 et 9), selon le cas.')).toBe(
      'Entre trois mois et un mois par année, selon le cas.',
    );
    for (const [brut, propre] of [
      ['Voir la loi (extraits 2, 3 et 5).', 'Voir la loi.'],
      ['Le juge tranche [extrait 3].', 'Le juge tranche.'],
      ['Le juge tranche (Extrait n° 4).', 'Le juge tranche.'],
      ['Le juge tranche (cf. source 2).', 'Le juge tranche.'],
      ['Le juge tranche (voir l’extrait 7).', 'Le juge tranche.'],
      ['Le juge tranche [2].', 'Le juge tranche.'],
      ['Le juge tranche [2, 4].', 'Le juge tranche.'],
    ] as const) {
      expect(sansRenvoisAuxExtraits(brut), brut).toBe(propre);
    }
  });

  it('garde le reste : retours à la ligne, articles, parenthèses ordinaires, « […] »', () => {
    expect(sansRenvoisAuxExtraits('1. Écrivez (extrait 2).\n2. Saisissez le juge.')).toBe('1. Écrivez.\n2. Saisissez le juge.');
    expect(sansRenvoisAuxExtraits('(extrait 2) Le salarié prouve.')).toBe('Le salarié prouve.');
    for (const texte of ['L’article 39 (alinéa 3) le dit.', 'Un délai (3 mois) court.', '[…] la suite.', 'Le Code du travail (loi n° 92/007).']) {
      expect(sansRenvoisAuxExtraits(texte), texte).toBe(texte);
    }
    expect(sansRenvoisAuxExtraits(null)).toBe('');
  });

  it('retirés dès la lecture de l’article, de toute la prose ; jamais de l’extrait d’une citation', () => {
    const post = articleDepuisLApi({
      slug: 'licenciement',
      title: 'Licenciement abusif',
      context: 'Un salarié est licencié (extrait 1).',
      botAnalysis: {
        summary: 'L’employeur doit prouver le motif (extrait 5).',
        keyPoints: ['Indemnité de préavis (extrait 2).', '(extraits 5 et 9)'],
        citizenImpact: 'Saisissez la juridiction (extrait 5).',
        citations: [
          {
            law_id: 2274,
            article_number: '39',
            reference: 'Code du travail',
            title: 'Les dommages-intérêts (extrait 9).',
            excerpt: 'Article 39.- (1) Toute rupture abusive [1] du contrat peut donner lieu à des dommages-intérêts.',
            url: '/laws/2274?article=39',
            verifie: true,
          },
        ],
      },
      suggestedQuestion: 'Que faire (extrait 2) ?',
      isPublished: true,
      etat_publication: 'publiable',
    })!;
    const donnees = JSON.stringify({ ...post, botAnalysis: { ...post.botAnalysis, citations: [] } });
    expect(donnees).not.toMatch(/extraits?\s+\d/);
    // Un point clé qui n'était qu'un renvoi disparaît.
    expect(post.botAnalysis.keyPoints).toEqual(['Indemnité de préavis.']);
    expect(post.excerpt).toBe('L’employeur doit prouver le motif.');
    expect(post.botAnalysis.citations[0].title).toBe('Les dommages-intérêts.');
    // L'extrait, recopié mot pour mot de la base, reste tel quel.
    expect(post.botAnalysis.citations[0].excerpt).toContain('rupture abusive [1] du contrat');
  });
});
