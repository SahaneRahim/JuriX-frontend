import { describe, expect, it } from 'vitest';
import { t } from '$lib/stores/language';
import { ARTICLE_ANCIEN } from '$lib/data/blog-anciens-de-test';
import {
  BROUILLON as BROUILLON_CONTROLE,
  CITATION_SUITE,
  PHRASES_AVEC_CONTRADICTION,
  PUBLIE as PUBLIE_CONTROLE,
  RELECTURE_COMPLETE,
} from './donnees-de-test';
import {
  articleAdminDepuis,
  articleDuFormulaire,
  blocagesDePublication,
  champsManquants,
  citationDepuisSource,
  controleAJour,
  corpsDeLaModification,
  dejaCitee,
  empreinte,
  estAncien,
  formulaireDepuis,
  nomDeCitation,
  partieRelue,
  partiesModifiees,
  pointsAVerifier,
  resultatDeGeneration,
  sourcesDepuis,
  visibleDuPublic,
} from './relecture';

const fr = (cle: string) => t(cle, 'fr');

/** Un brouillon tel que le rend l'API du contrat du 29/10 (to_dict + avertissements). */
const BROUILLON = {
  id: 12,
  slug: 'bail-expulsion',
  title: 'Expulsion sans juge',
  category: 'Immobilier',
  publishedAt: '2026-10-29',
  readingTime: '4 min',
  context: 'Un bailleur de Douala a changé la serrure.',
  botAnalysis: {
    summary: 'Le bailleur ne peut pas expulser seul.',
    keyPoints: ['Pas d’expulsion sans juge.', { point: 'objet' }],
    citations: [
      {
        law_id: 2236,
        article_id: 501,
        article_number: '299',
        reference: 'Code pénal (loi n° 2016/007)',
        title: 'Violation de domicile',
        excerpt: 'Est puni…',
        url: '/laws/2236?article=299',
        verifie: true,
      },
      {
        law_id: 2285,
        article_number: '1736',
        reference: 'Code civil',
        explication: 'Le congé',
        excerpt: 'Si le bail…',
        url: '/laws/2285?article=1736',
        verifie: true,
      },
    ],
    citizenImpact: 'Saisissez le juge.',
  },
  suggestedQuestion: 'Que faire ?',
  tags: ['bail'],
  isPublished: false,
  avertissements: ['L’article 286 du Code pénal n’est porté par aucune source.'],
};

describe('lecture de l’administration', () => {
  it('un article de l’API, lu défensivement ; sans identifiant, rien', () => {
    const article = articleAdminDepuis(BROUILLON)!;
    expect(article.keyPoints).toEqual(['Pas d’expulsion sans juge.']);
    expect(article.citations).toHaveLength(2);
    expect(article.isPublished).toBe(false);
    expect(article.avertissements).toHaveLength(1);
    expect(articleAdminDepuis({ ...BROUILLON, id: undefined })).toBeNull();
    expect(articleAdminDepuis({ ...BROUILLON, avertissements: undefined })!.avertissements).toEqual([]);
  });

  it('la génération rend un brouillon ENREGISTRÉ : sans `post` identifié, ce n’en est pas un', () => {
    const resultat = resultatDeGeneration({
      post: BROUILLON,
      sources: [{ n: 1, law_id: 2236, law_title: 'Code pénal', article_number: '299', article_id: 501, extrait: 'Est puni…' }],
      avertissements: ['Le préavis de 3 mois n’est porté par aucune source.'],
    })!;
    expect(resultat.article.id).toBe(12);
    // Ceux de l'article, recalculés à chaque lecture ; ceux de la seule
    // génération, à part : l'API ne les garde pas.
    expect(resultat.article.avertissements).toEqual(['L’article 286 du Code pénal n’est porté par aucune source.']);
    expect(resultat.avertissementsDeGeneration).toEqual(['Le préavis de 3 mois n’est porté par aucune source.']);
    expect(resultat.sources).toEqual([
      { n: 1, lawId: 2236, lawTitle: 'Code pénal', articleNumber: '299', articleId: 501, suite: false, extrait: 'Est puni…' },
    ]);
    // L'API d'origine rendait l'article généré, sans l'enregistrer.
    expect(resultatDeGeneration({ title: 'x', summary: 'y', citations: [] })).toBeNull();
    expect(resultatDeGeneration(null)).toBeNull();
    expect(sourcesDepuis('x')).toEqual([]);
  });
});

describe('le formulaire de relecture', () => {
  const article = articleAdminDepuis(BROUILLON)!;

  it('renvoie chaque citation telle quelle, l’explication réécrite dans SON champ', () => {
    const form = formulaireDepuis(article);
    form.citations[0].explication = 'Entrer chez autrui contre son gré est puni.';
    form.citations[1].explication = 'Le congé suit l’usage des lieux.';
    const corps = corpsDeLaModification(form, article) as { bot_analysis: { citations: Record<string, unknown>[] } };
    const [premiere, seconde] = corps.bot_analysis.citations;
    // `title` pour la première (champ d'aujourd'hui), `explication` pour la seconde.
    expect(premiere).toEqual({ ...BROUILLON.botAnalysis.citations[0], title: 'Entrer chez autrui contre son gré est puni.' });
    expect(seconde.explication).toBe('Le congé suit l’usage des lieux.');
    expect(seconde.title).toBeUndefined();
  });

  it('une citation retirée disparaît du corps ; rien d’autre ne change', () => {
    const form = formulaireDepuis(article);
    form.citations = form.citations.slice(1);
    const corps = corpsDeLaModification(form, article) as { bot_analysis: { citations: unknown[] } };
    expect(corps.bot_analysis.citations).toHaveLength(1);
  });

  it('tous les champs de texte partent ; l’adresse et la durée seulement si elles ont changé ; la publication si demandée', () => {
    const form = formulaireDepuis(article);
    expect(corpsDeLaModification(form, article)).not.toHaveProperty('slug');
    expect(corpsDeLaModification(form, article)).not.toHaveProperty('is_published');
    // La durée inchangée ne part pas : le serveur la recalcule quand le texte
    // change (revues du 29/10 : « 4 min » partait toujours).
    expect(corpsDeLaModification(form, article)).not.toHaveProperty('reading_time');
    form.duree = '';
    expect(corpsDeLaModification(form, article)).not.toHaveProperty('reading_time');
    form.duree = '6 min';
    form.slug = 'Nouvelle adresse';
    form.pointsCles = 'Un\n\n  Deux  \n';
    form.motsCles = 'bail, , loyer ';
    const corps = corpsDeLaModification(form, article, true) as Record<string, unknown> & { bot_analysis: Record<string, unknown> };
    expect(corps.slug).toBe('Nouvelle adresse');
    expect(corps.reading_time).toBe('6 min');
    expect(corps.is_published).toBe(true);
    expect(corps.bot_analysis.keyPoints).toEqual(['Un', 'Deux']);
    expect(corps.tags).toEqual(['bail', 'loyer']);
    expect(Object.keys(corps).sort()).toEqual(
      ['bot_analysis', 'category', 'context', 'is_published', 'reading_time', 'slug', 'suggested_question', 'tags', 'title'].sort(),
    );
  });

  it('un point clé à retour à la ligne reste UN point après l’enregistrement', () => {
    // Le serveur garde les retours à la ligne d'un point (texte_brut) ; joint
    // puis redécoupé ligne à ligne, il devenait deux points (revue du 29/10).
    const avecRetour = articleAdminDepuis({
      ...BROUILLON,
      botAnalysis: { ...BROUILLON.botAnalysis, keyPoints: ['Pas d’expulsion :\nsauf décision de justice.', 'Second point.'] },
    })!;
    const corps = corpsDeLaModification(formulaireDepuis(avecRetour), avecRetour) as { bot_analysis: { keyPoints: string[] } };
    expect(corps.bot_analysis.keyPoints).toEqual(['Pas d’expulsion : sauf décision de justice.', 'Second point.']);
  });

  it('les parties relues que la saisie change ; ni le titre, ni la rubrique, ni l’adresse, ni la durée, ni les mots-clés', () => {
    const form = formulaireDepuis(article);
    expect(partiesModifiees(form, article)).toEqual([]);
    form.titre = 'Autre titre';
    form.rubrique = 'Logement';
    form.slug = 'autre';
    form.duree = '7 min';
    form.motsCles = 'loyer';
    expect(partiesModifiees(form, article)).toEqual([]);
    for (const [changer, partie] of [
      [(f: typeof form) => (f.contexte = 'Autre contexte.'), 'contexte'],
      [(f: typeof form) => (f.resume = 'Selon l’article 312 du Code pénal…'), 'resume'],
      [(f: typeof form) => (f.pointsCles = 'Un autre point.'), 'points_cles'],
      [(f: typeof form) => (f.impact = 'Autre impact.'), 'impact'],
      [(f: typeof form) => (f.question = 'Autre question ?'), 'question'],
      [(f: typeof form) => (f.citations[0].explication = 'Autre explication.'), 'explications'],
      // Retirer une citation retire son explication.
      [(f: typeof form) => (f.citations = f.citations.slice(1)), 'explications'],
    ] as const) {
      const modifie = formulaireDepuis(article);
      changer(modifie);
      expect(partiesModifiees(modifie, article), String(changer)).toEqual([partie]);
    }
    // Des espaces autour du texte ne sont pas une modification.
    const espaces = formulaireDepuis(article);
    espaces.resume = `  ${article.summary}  `;
    expect(partiesModifiees(espaces, article)).toEqual([]);
  });

  it('l’empreinte change avec la saisie, pas avec les clés techniques', () => {
    const a = formulaireDepuis(article);
    const b = formulaireDepuis(article);
    expect(empreinte(a)).toBe(empreinte(b));
    b.citations[0].explication += ' !';
    expect(empreinte(a)).not.toBe(empreinte(b));
  });

  it('champs obligatoires : ceux que l’API refuse vides, impact compris, pour enregistrer comme pour publier', () => {
    const form = formulaireDepuis(article);
    expect(champsManquants(form)).toEqual([]);
    form.titre = '  ';
    form.impact = '';
    // L'impact n'était exigé que pour publier, et un enregistrement sans lui
    // revenait en 422 (revue croisée du 29/10).
    expect(champsManquants(form)).toEqual(['titre', 'impact']);
    form.rubrique = '';
    form.contexte = ' ';
    form.resume = '';
    expect(champsManquants(form)).toEqual(['titre', 'rubrique', 'contexte', 'resume', 'impact']);
  });

  it('l’aperçu suit la saisie, par la lecture de la page publique', () => {
    const form = formulaireDepuis(article);
    form.titre = '**Nouveau titre**';
    form.citations = form.citations.slice(0, 1);
    const apercu = articleDuFormulaire(form, article);
    expect(apercu.title).toBe('**Nouveau titre**');
    expect(apercu.botAnalysis.citations).toHaveLength(1);
    expect(apercu.botAnalysis.citations[0].verifie).toBe(true);
    // Titre vidé pendant la saisie : l'aperçu se montre quand même.
    form.titre = '';
    expect(articleDuFormulaire(form, article).title).toBe('…');
  });
});

describe('avant de publier', () => {
  it('avertissements du serveur, citations non vérifiées, aucune citation', () => {
    expect(pointsAVerifier([], BROUILLON.botAnalysis.citations, fr)).toEqual([]);
    const points = pointsAVerifier(
      ['L’article 286 n’est porté par aucune source.'],
      [{ law_id: 1, article_number: '?', reference: 'PRC-4722', title: 'x' }],
      fr,
    );
    expect(points).toEqual([
      'L’article 286 n’est porté par aucune source.',
      // Ni cote ni « ? » : la citation se nomme « Extrait légal ».
      'Citation non vérifiée dans la base\u00a0: Extrait légal.',
    ]);
    expect(pointsAVerifier([], [], fr)).toEqual(['L’article ne cite aucun texte.']);
  });

  it('une citation n’est vérifiée qu’avec `verifie`, un extrait et un lien du serveur (contrat du 30/10)', () => {
    const [verifiee] = BROUILLON.botAnalysis.citations;
    expect(pointsAVerifier([], [verifiee], fr)).toEqual([]);
    for (const incomplete of [
      { ...verifiee, url: undefined },
      { ...verifiee, excerpt: '' },
      { ...verifiee, verifie: undefined },
    ]) {
      expect(pointsAVerifier([], [incomplete], fr)).toEqual(['Citation non vérifiée dans la base\u00a0: Article 299\u00a0· Code pénal (loi n° 2016/007).']);
    }
  });

  it('les lignes du serveur que le front recalcule ne sont pas comptées deux fois', () => {
    // Un article d'avant le contrat, tel que le rend l'administration : le
    // serveur signale ses deux citations non vérifiées, le front aussi.
    const ancien = articleAdminDepuis({
      ...ARTICLE_ANCIEN,
      avertissements: [
        'Citation 1 : non vérifiée (écrite avant la vérification par le serveur). Retirez-la, ou remplacez-la par un article de la base.',
        'Citation 2 : non vérifiée (écrite avant la vérification par le serveur). Retirez-la, ou remplacez-la par un article de la base.',
        'Résumé : « article 312 du Code pénal » n’est appuyé par aucune citation de l’article.',
      ],
    })!;
    expect(pointsAVerifier(ancien.avertissements, ancien.citations, fr)).toEqual([
      'Résumé : « article 312 du Code pénal » n’est appuyé par aucune citation de l’article.',
      'Citation non vérifiée dans la base\u00a0: Article 1719\u00a0· Code Civil / Droit des obligations.',
      'Citation non vérifiée dans la base\u00a0: Article 299\u00a0· Loi portant Code Pénal camerounais.',
    ]);
    expect(pointsAVerifier(['Aucune citation : l’article ne s’appuie sur aucun texte de la base.'], [], fr)).toEqual([
      'L’article ne cite aucun texte.',
    ]);
  });

  it('ce que seule la génération a relevé reste à vérifier, marqué comme tel, une seule fois', () => {
    const plusieursArticles =
      'Citation de l’extrait 3 : ce passage de la base, rangé sous l’article 35, porte aussi l’en-tête des articles 36, 39.';
    const points = pointsAVerifier(
      ['L’article 286 n’est porté par aucune source.'],
      BROUILLON.botAnalysis.citations,
      fr,
      [plusieursArticles, 'L’article 286 n’est porté par aucune source.', plusieursArticles],
    );
    expect(points).toEqual(['L’article 286 n’est porté par aucune source.', `Relevé à la génération — ${plusieursArticles}`]);
  });

  it('citer une source retrouvée, sans rien taper ; une seule fois', () => {
    const article = articleAdminDepuis(BROUILLON)!;
    const form = formulaireDepuis(article);
    const source = {
      n: 3,
      lawId: 2281,
      lawTitle: 'Acte uniforme OHADA (voies d’exécution)',
      articleNumber: '29',
      articleId: 77,
      suite: false,
      extrait: 'L’État est tenu…',
    };
    expect(dejaCitee(form, source)).toBe(false);
    expect(dejaCitee(form, { ...source, lawId: 2236, articleNumber: '299' })).toBe(true);
    const citation = citationDepuisSource(source);
    expect(citation.origine).toEqual({
      law_id: 2281,
      article_id: 77,
      article_number: '29',
      reference: 'Acte uniforme OHADA (voies d’exécution)',
      excerpt: 'L’État est tenu…',
      title: '',
    });
    // Pas encore vérifiée par le serveur : à vérifier avant publication.
    expect(pointsAVerifier([], [citation.origine], fr)).toHaveLength(1);
  });

  it('la suite d’un article n’est pas son début : citée à part, nommée « (suite) »', () => {
    const article = articleAdminDepuis(BROUILLON)!;
    const form = formulaireDepuis(article);
    const debut = { n: 5, lawId: 2274, lawTitle: 'Code du travail', articleNumber: '39', articleId: 97420, suite: false, extrait: 'Article 39.- (1) Toute rupture abusive…' };
    const suite = { ...debut, n: 9, articleId: 97421, suite: true, extrait: '(6) Le salaire à prendre en considération…' };
    form.citations = [...form.citations, citationDepuisSource(debut)];
    // Le début est cité ; la suite, un autre extrait du même article, non.
    expect(dejaCitee(form, debut)).toBe(true);
    expect(dejaCitee(form, suite)).toBe(false);
    expect(citationDepuisSource(suite).origine.suite).toBe(true);
    expect(nomDeCitation(CITATION_SUITE, fr)).toBe('Article 39\u00a0(suite)\u00a0· Loi N°92/007 du 14 août 1992 portant Code du travail');
    expect(sourcesDepuis([{ n: 9, law_id: 2274, article_number: '39', suite: true, extrait: 'x' }])[0].suite).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Contrat du 30/10 : contrôle IA, relecture humaine, état de publication      */
/* -------------------------------------------------------------------------- */

describe('la relecture humaine et ce qui empêche de publier', () => {
  const brouillon = articleAdminDepuis(BROUILLON_CONTROLE)!;
  const tout = (f: ReturnType<typeof formulaireDepuis>) => {
    f.relecture = { ...RELECTURE_COMPLETE.parties };
    return f;
  };

  it('lit le contrôle, la relecture et l’état du serveur', () => {
    expect(brouillon.controleIa?.phrases).toHaveLength(7);
    expect(brouillon.relecture.parties.resume).toBe(false);
    expect(brouillon.etatPublication).toBe('relecture_incomplete');
    expect(controleAJour(brouillon)).toBe(true);
    // Un état inconnu ou absent n'est jamais un accord.
    expect(articleAdminDepuis({ ...BROUILLON_CONTROLE, etat_publication: 'ok' })!.etatPublication).toBeNull();
    expect(controleAJour(articleAdminDepuis({ ...BROUILLON_CONTROLE, etat_publication: 'controle_a_relancer' })!)).toBe(false);
  });

  it('rien de relu : la seule raison est la relecture, partie par partie', () => {
    const form = formulaireDepuis(brouillon);
    expect(blocagesDePublication(form, brouillon)).toEqual([{ code: 'relecture_incomplete', n: 0, total: 6 }]);
    form.relecture.resume = true;
    expect(blocagesDePublication(form, brouillon)).toEqual([{ code: 'relecture_incomplete', n: 1, total: 6 }]);
    // Les six cases cochées dans le formulaire : on peut publier, elles partent avec la publication.
    expect(blocagesDePublication(tout(formulaireDepuis(brouillon)), brouillon)).toEqual([]);
  });

  it('une partie modifiée : sa case ne compte plus, le contrôle est à relancer', () => {
    const form = tout(formulaireDepuis(brouillon));
    form.resume = 'Le bailleur peut expulser sans juge en cas de reprise.';
    const modifiees = partiesModifiees(form, brouillon);
    expect(modifiees).toEqual(['resume']);
    expect(partieRelue(form, 'resume', modifiees)).toBe(false);
    expect(partieRelue(form, 'contexte', modifiees)).toBe(true);
    expect(blocagesDePublication(form, brouillon)).toEqual([
      { code: 'controle_a_relancer', cause: 'modifie' },
      { code: 'relecture_incomplete', n: 5, total: 6 },
    ]);
    // Et la case de la partie modifiée part décochée.
    const corps = corpsDeLaModification(form, brouillon, false) as { relecture: { parties: Record<string, boolean> } };
    expect(corps.relecture.parties).toEqual({ ...RELECTURE_COMPLETE.parties, resume: false });
  });

  it('pas de contrôle, contrôle périmé, phrase contredite, citation non vérifiée, état absent', () => {
    const sans = articleAdminDepuis({ ...BROUILLON_CONTROLE, controle_ia: null, etat_publication: 'controle_a_relancer' })!;
    expect(blocagesDePublication(tout(formulaireDepuis(sans)), sans)).toEqual([{ code: 'controle_a_relancer', cause: 'absent' }]);

    const perime = articleAdminDepuis({ ...BROUILLON_CONTROLE, etat_publication: 'controle_a_relancer' })!;
    expect(blocagesDePublication(tout(formulaireDepuis(perime)), perime)).toEqual([{ code: 'controle_a_relancer', cause: 'perime' }]);

    const contredit = articleAdminDepuis({
      ...BROUILLON_CONTROLE,
      controle_ia: { ...BROUILLON_CONTROLE.controle_ia, phrases: PHRASES_AVEC_CONTRADICTION },
      etat_publication: 'phrases_contredites',
    })!;
    expect(blocagesDePublication(tout(formulaireDepuis(contredit)), contredit)).toEqual([{ code: 'phrases_contredites', n: 1 }]);

    const ancien = articleAdminDepuis({ ...ARTICLE_ANCIEN, etat_publication: 'citations_non_verifiees' })!;
    expect(blocagesDePublication(formulaireDepuis(ancien), ancien)).toEqual([
      { code: 'citations_non_verifiees', n: 2 },
      { code: 'controle_a_relancer', cause: 'absent' },
      { code: 'relecture_incomplete', n: 0, total: 6 },
    ]);

    const muet = articleAdminDepuis({ ...BROUILLON_CONTROLE, etat_publication: undefined })!;
    expect(blocagesDePublication(tout(formulaireDepuis(muet)), muet)).toEqual([{ code: 'etat_inconnu' }]);
  });

  it('l’état du serveur que le front ne sait pas expliquer reste une raison', () => {
    // Un texte cité dépublié depuis : le serveur le sait, pas le formulaire.
    const serveur = articleAdminDepuis({ ...BROUILLON_CONTROLE, relecture: RELECTURE_COMPLETE, etat_publication: 'citations_non_verifiees' })!;
    expect(blocagesDePublication(formulaireDepuis(serveur), serveur)).toEqual([{ code: 'serveur', etat: 'citations_non_verifiees' }]);
  });

  it('les cases ne partent que si elles changent', () => {
    const form = formulaireDepuis(brouillon);
    expect(corpsDeLaModification(form, brouillon, false)).not.toHaveProperty('relecture');
    form.relecture.contexte = true;
    expect(corpsDeLaModification(form, brouillon, true)).toMatchObject({
      relecture: { parties: { ...RELECTURE_COMPLETE.parties, contexte: true, resume: false, points_cles: false, impact: false, explications: false, question: false } },
      is_published: true,
    });
    // Cocher une case est une modification à enregistrer.
    expect(empreinte(form)).not.toBe(empreinte(formulaireDepuis(brouillon)));
  });

  it('publié avant la vérification : « à reprendre », caché du public ; publié et publiable : lisible', () => {
    const ancien = articleAdminDepuis({ ...ARTICLE_ANCIEN, etat_publication: 'citations_non_verifiees' })!;
    expect(estAncien(ancien)).toBe(true);
    expect(visibleDuPublic(ancien)).toBe(false);
    const enLigne = articleAdminDepuis(PUBLIE_CONTROLE)!;
    expect(estAncien(enLigne)).toBe(false);
    expect(visibleDuPublic(enLigne)).toBe(true);
    // Publié, contrôlé et relu, mais un contrôle relancé y a trouvé une contradiction : caché, pas « ancien ».
    const cache = articleAdminDepuis({ ...PUBLIE_CONTROLE, etat_publication: 'phrases_contredites' })!;
    expect(estAncien(cache)).toBe(false);
    expect(visibleDuPublic(cache)).toBe(false);
    // Un brouillon n'est ni l'un ni l'autre.
    expect(estAncien(brouillon)).toBe(false);
    expect(visibleDuPublic(brouillon)).toBe(false);
  });
});
