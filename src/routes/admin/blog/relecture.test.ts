import { describe, expect, it } from 'vitest';
import { t } from '$lib/stores/language';
import { ARTICLE_ANCIEN } from '$lib/data/blog-anciens-de-test';
import {
  BROUILLON as BROUILLON_CONTROLE,
  CITATION_SUITE,
  PHRASES_AVEC_CONTRADICTION,
  PHRASES_A_CONFIRMER,
  PUBLIE as PUBLIE_CONTROLE,
  RELECTURE_COMPLETE,
  SOURCES,
} from './donnees-de-test';
import {
  articleAdminDepuis,
  articleDuFormulaire,
  autreControle,
  avertissementsDeGenerationValables,
  avertissementsDeRepriseValables,
  blocagesDePublication,
  casesApresUnAutreControle,
  casesSansRetourDesPartiesARelire,
  champsManquants,
  citationDepuisSource,
  confirmationsApresUnAutreControle,
  controleAJour,
  corpsDeLaModification,
  dejaCitee,
  empreinte,
  estAncien,
  etapesDeReprise,
  formulaireDepuis,
  nomDeCitation,
  partieRelue,
  partieVide,
  partiesModifiees,
  partiesRelues,
  phrasesRestantesAConfirmer,
  pointsAVerifier,
  resultatDeGeneration,
  resultatDeReconstruction,
  sansSources,
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

  it('les parties relues que la saisie change, TITRE COMPRIS ; ni la rubrique, ni l’adresse, ni la durée, ni les mots-clés', () => {
    const form = formulaireDepuis(article);
    expect(partiesModifiees(form, article)).toEqual([]);
    form.rubrique = 'Logement';
    form.slug = 'autre';
    form.duree = '7 min';
    form.motsCles = 'loyer';
    expect(partiesModifiees(form, article)).toEqual([]);
    for (const [changer, partie] of [
      // Le titre de l'essai réel du 30/10, qui présupposait ce que
      // l'article 133 de l'AUDCG contredit (avenant du tour 4).
      [(f: typeof form) => (f.titre = 'Expulsion locative sans jugement : quels cas au Cameroun ?'), 'titre'],
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
    expect(brouillon.controleIa?.phrases).toHaveLength(8);
    expect(brouillon.relecture.parties.resume).toBe(false);
    expect(brouillon.etatPublication).toBe('relecture_incomplete');
    expect(controleAJour(brouillon)).toBe(true);
    // Un état inconnu ou absent n'est jamais un accord.
    expect(articleAdminDepuis({ ...BROUILLON_CONTROLE, etat_publication: 'ok' })!.etatPublication).toBeNull();
    expect(controleAJour(articleAdminDepuis({ ...BROUILLON_CONTROLE, etat_publication: 'controle_a_relancer' })!)).toBe(false);
  });

  it('rien de relu : la seule raison est la relecture, partie par partie', () => {
    const form = formulaireDepuis(brouillon);
    expect(blocagesDePublication(form, brouillon)).toEqual([{ code: 'relecture_incomplete', n: 0, total: 7 }]);
    form.relecture.resume = true;
    expect(blocagesDePublication(form, brouillon)).toEqual([{ code: 'relecture_incomplete', n: 1, total: 7 }]);
    // Six cases sur sept : le titre reste à relire.
    const sansLeTitre = tout(formulaireDepuis(brouillon));
    sansLeTitre.relecture.titre = false;
    expect(blocagesDePublication(sansLeTitre, brouillon)).toEqual([{ code: 'relecture_incomplete', n: 6, total: 7 }]);
    // Les sept cases cochées dans le formulaire : on peut publier, elles partent avec la publication.
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
      { code: 'relecture_incomplete', n: 6, total: 7 },
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

    // Un article d'avant la vérification : sans sources enregistrées, en tête.
    const ancien = articleAdminDepuis({ ...ARTICLE_ANCIEN, etat_publication: 'citations_non_verifiees' })!;
    expect(blocagesDePublication(formulaireDepuis(ancien), ancien)).toEqual([
      { code: 'sources_absentes' },
      { code: 'citations_non_verifiees', n: 2 },
      { code: 'controle_a_relancer', cause: 'absent' },
      { code: 'relecture_incomplete', n: 0, total: 7 },
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
      relecture: {
        parties: { titre: false, contexte: true, resume: false, points_cles: false, impact: false, explications: false, question: false },
      },
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

/* -------------------------------------------------------------------------- */
/* Avenant du tour 4 : le titre, les sources gardées, le parcours de reprise   */
/* -------------------------------------------------------------------------- */

describe('les sources gardées avec l’article (avenant du tour 4)', () => {
  it('toute lecture de l’administration les rend : le brouillon rouvert les a encore', () => {
    const rouvert = articleAdminDepuis(BROUILLON_CONTROLE)!;
    expect(rouvert.sources.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(rouvert.sources[2]).toMatchObject({ lawId: 2277, articleNumber: '133', articleId: 89451, suite: false });
    expect(sansSources(rouvert)).toBe(false);
    // Un article qui n'en a pas : aucune, jamais d'erreur.
    const ancien = articleAdminDepuis(ARTICLE_ANCIEN)!;
    expect(ancien.sources).toEqual([]);
    expect(sansSources(ancien)).toBe(true);
    // L'état du serveur fait foi, même si des sources sont connues ailleurs.
    expect(sansSources({ ...rouvert, etatPublication: 'sources_absentes' })).toBe(true);
  });

  it('la génération : l’article prend les sources de la réponse si `post` ne les porte pas', () => {
    const { sources: _sans, ...post } = BROUILLON_CONTROLE;
    const resultat = resultatDeGeneration({ post, sources: SOURCES, avertissements: [] })!;
    expect(resultat.article.sources).toHaveLength(3);
    expect(resultat.sources).toHaveLength(3);
    // `post` les porte : ce sont les siennes.
    const avecLesSiennes = resultatDeGeneration({ post: BROUILLON_CONTROLE, sources: [], avertissements: [] })!;
    expect(avecLesSiennes.article.sources).toHaveLength(3);
    expect(avecLesSiennes.sources).toHaveLength(3);
  });

  it('la reconstruction : l’article lui-même, ou {post, sources, avertissements} ; seuls ses propres avertissements', () => {
    const avecSources = { ...ARTICLE_ANCIEN, sources: SOURCES, avertissements: ['Aucune citation : l’article ne s’appuie sur aucun texte de la base.'] };
    // Comme POST /controle : l'article seul.
    const direct = resultatDeReconstruction(avecSources)!;
    expect(direct.article.sources).toHaveLength(3);
    expect(direct.avertissements).toEqual([]);
    // Comme la génération.
    const retiree = 'Citation « Article 299 · Loi portant Code Pénal camerounais » retirée : aucune source reconstruite ne la porte.';
    const enveloppe = resultatDeReconstruction({
      post: { ...ARTICLE_ANCIEN, botAnalysis: { ...ARTICLE_ANCIEN.botAnalysis, citations: [] }, avertissements: [] },
      sources: SOURCES,
      avertissements: [retiree, retiree],
    })!;
    expect(enveloppe.article.sources.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(enveloppe.article.citations).toEqual([]);
    expect(enveloppe.avertissements).toEqual([retiree]);
    // Sans article identifié : rien n'est reconstruit.
    expect(resultatDeReconstruction({ sources: SOURCES })).toBeNull();
    expect(resultatDeReconstruction('x')).toBeNull();
  });
});

describe('ce qui bloque, et le parcours de reprise (avenant du tour 4)', () => {
  const brouillon = articleAdminDepuis(BROUILLON_CONTROLE)!;
  const tout = (f: ReturnType<typeof formulaireDepuis>) => {
    f.relecture = { ...RELECTURE_COMPLETE.parties };
    return f;
  };

  it('le titre d’un article EN LIGNE changé : le contrôle est à relancer, il faut retirer l’article d’abord', () => {
    // Revue du tour 3 : changer le seul titre ne bloquait rien, et un PUT le
    // mettait en ligne aussitôt, sans contrôle ni relecture.
    const enLigne = articleAdminDepuis(PUBLIE_CONTROLE)!;
    const form = formulaireDepuis(enLigne);
    form.titre = 'Licenciement abusif : le salarié doit prouver l’abus pour être indemnisé';
    expect(partiesModifiees(form, enLigne)).toEqual(['titre']);
    expect(blocagesDePublication(form, enLigne)).toEqual([
      { code: 'controle_a_relancer', cause: 'modifie' },
      { code: 'relecture_incomplete', n: 6, total: 7 },
    ]);
    // Et sa case part décochée.
    const corps = corpsDeLaModification(form, enLigne, false) as { relecture: { parties: Record<string, boolean> } };
    expect(corps.relecture.parties.titre).toBe(false);
  });

  it('sans aucune citation : « citez au moins un article », et non l’état brut du serveur', () => {
    // Revue du tour 3 : le front ne disait que « Le serveur ne le juge pas
    // publiable : Citations non vérifiées », sans dire d'en AJOUTER une.
    const sansCitation = articleAdminDepuis({
      ...BROUILLON_CONTROLE,
      botAnalysis: { ...BROUILLON_CONTROLE.botAnalysis, citations: [] },
      etat_publication: 'citations_non_verifiees',
    })!;
    const blocages = blocagesDePublication(tout(formulaireDepuis(sansCitation)), sansCitation);
    expect(blocages[0]).toEqual({ code: 'aucune_citation' });
    expect(blocages.some((b) => b.code === 'serveur')).toBe(false);
  });

  it('une citation tout juste citée depuis une source n’est pas « à retirer » : la modification dit de l’enregistrer', () => {
    const sansCitation = articleAdminDepuis({
      ...BROUILLON_CONTROLE,
      botAnalysis: { ...BROUILLON_CONTROLE.botAnalysis, citations: [] },
      etat_publication: 'citations_non_verifiees',
    })!;
    const form = formulaireDepuis(sansCitation);
    const [source] = sansCitation.sources;
    form.citations = [citationDepuisSource(source)];
    expect(form.citations[0].ajoutee).toBe(true);
    const blocages = blocagesDePublication(form, sansCitation);
    expect(blocages.find((b) => b.code === 'citations_non_verifiees')).toBeUndefined();
    expect(blocages.find((b) => b.code === 'aucune_citation')).toBeUndefined();
    expect(blocages).toContainEqual({ code: 'controle_a_relancer', cause: 'modifie' });
    // Les citations reçues du serveur ne sont jamais « ajoutées ».
    expect(formulaireDepuis(brouillon).citations.map((c) => c.ajoutee)).toEqual([false, false]);
  });

  it('les cinq étapes, de l’article d’avant jusqu’à la publication', () => {
    const statuts = (blocages: Parameters<typeof etapesDeReprise>[0]) => etapesDeReprise(blocages).map((e) => `${e.etape}:${e.statut}`);
    // 1. L'article d'avant, tel qu'il est : tout reste à faire, les sources d'abord.
    const ancien = articleAdminDepuis({ ...ARTICLE_ANCIEN, etat_publication: 'sources_absentes' })!;
    const depart = etapesDeReprise(blocagesDePublication(formulaireDepuis(ancien), ancien));
    expect(depart.map((e) => `${e.etape}:${e.statut}`)).toEqual([
      'sources:en_cours',
      'citations:a_venir',
      'controle:a_venir',
      'relecture:a_venir',
      'publication:a_venir',
    ]);
    expect(depart[0].blocages).toEqual([{ code: 'sources_absentes' }]);
    expect(depart[1].blocages).toEqual([{ code: 'citations_non_verifiees', n: 2 }]);
    // 2. Sources reconstruites, citations d'avant retirées : citer.
    expect(statuts([{ code: 'aucune_citation' }, { code: 'controle_a_relancer', cause: 'absent' }, { code: 'relecture_incomplete', n: 2, total: 7 }])).toEqual([
      'sources:faite',
      'citations:en_cours',
      'controle:a_venir',
      'relecture:a_venir',
      'publication:a_venir',
    ]);
    // 3. Citée et enregistrée : le contrôle.
    expect(statuts([{ code: 'controle_a_relancer', cause: 'absent' }, { code: 'relecture_incomplete', n: 0, total: 7 }])[2]).toBe('controle:en_cours');
    // Une phrase contredite se règle à l'étape du contrôle.
    expect(statuts([{ code: 'phrases_contredites', n: 1 }])[2]).toBe('controle:en_cours');
    // 4. La relecture.
    expect(statuts([{ code: 'relecture_incomplete', n: 3, total: 7 }])[3]).toBe('relecture:en_cours');
    // 5. Plus rien : publier.
    expect(statuts([])).toEqual(['sources:faite', 'citations:faite', 'controle:faite', 'relecture:faite', 'publication:en_cours']);
    // L'état du serveur inexpliqué se range à son étape.
    expect(statuts([{ code: 'serveur', etat: 'citations_non_verifiees' }])[1]).toBe('citations:en_cours');
    expect(statuts([{ code: 'etat_inconnu' }])[4]).toBe('publication:en_cours');
  });

  it('« le contrôle IA n’a pas pu être fait » ne vaut plus une fois un contrôle enregistré', () => {
    const generation = [
      'Le contrôle IA n’a pas pu être fait (quota du modèle). Le brouillon est enregistré, sans contrôle : relancez le contrôle IA avant de publier.',
      'Citation de l’extrait 3 : ce passage porte aussi l’en-tête de l’article 39.',
    ];
    const sansControle = articleAdminDepuis({ ...BROUILLON_CONTROLE, controle_ia: null })!;
    expect(avertissementsDeGenerationValables(generation, sansControle)).toEqual(generation);
    expect(avertissementsDeGenerationValables(generation, brouillon)).toEqual([generation[1]]);
  });

  it('ce que la reconstruction a relevé reste à vérifier, marqué comme tel', () => {
    const retiree = 'Citation « Article 299 » retirée : aucune source reconstruite ne la porte.';
    expect(pointsAVerifier([], BROUILLON_CONTROLE.botAnalysis.citations, fr, [], [retiree, retiree])).toEqual([
      `Relevé à la reconstruction des sources — ${retiree}`,
    ]);
  });

  it('« le contrôle d’avant est effacé, relancez-le » ne vaut plus une fois un nouveau contrôle enregistré', () => {
    // Les phrases de routes/blog.py (reconstruire_les_sources), API du tour 4.
    const reconstruction = [
      'Citation 2 (Article 1736 · Code civil) : aucune des sources reconstruites ne porte cet article. Retirée : citez un article parmi les sources, ou ajoutez-le à nouveau par son numéro.',
      "Les sources ont changé : le contrôle IA d'avant, fait sur les anciennes, est effacé. Relancez-le, puis relisez chaque partie.",
    ];
    const sansControle = articleAdminDepuis({ ...BROUILLON_CONTROLE, controle_ia: null })!;
    expect(avertissementsDeRepriseValables(reconstruction, sansControle)).toEqual(reconstruction);
    expect(avertissementsDeRepriseValables(reconstruction, brouillon)).toEqual([reconstruction[0]]);
  });

  it('« Sources absentes : … » du serveur n’est pas compté en double : le front le dit déjà', () => {
    // _avertissements_d_etat (routes/blog.py, tour 4), pour tout article sans sources.
    const sansSources =
      "Sources absentes : l'article n'a pas les extraits sur lesquels il a été écrit (article d'avant le contrôle IA, ou écrit à la main). Reconstruisez ses sources, citez des articles parmi elles, puis lancez le contrôle IA et relisez chaque partie : il n'est pas publiable avant.";
    const prose = 'L’article 286 du Code pénal n’est porté par aucune source.';
    expect(pointsAVerifier([sansSources, prose], BROUILLON_CONTROLE.botAnalysis.citations, fr)).toEqual([prose]);
  });
});

describe('une partie vide n’a rien à relire (API du tour 4, parties_relues)', () => {
  const brouillon = articleAdminDepuis(BROUILLON_CONTROLE)!;

  it('vide, elle compte comme relue, même décochée ; modifiée, jamais', () => {
    const form = formulaireDepuis({ ...brouillon, suggestedQuestion: '' });
    form.relecture.question = false;
    expect(partieVide(form, 'question')).toBe(true);
    expect(partieRelue(form, 'question', [])).toBe(true);
    // Un champ d'espaces est vide aussi.
    form.question = '   ';
    expect(partieRelue(form, 'question', [])).toBe(true);
    // Vider une partie est une modification : le contrôle est à relancer d'abord.
    const videe = formulaireDepuis(brouillon);
    videe.question = '';
    const modifiees = partiesModifiees(videe, brouillon);
    expect(modifiees).toEqual(['question']);
    expect(partieRelue(videe, 'question', modifiees)).toBe(false);
    // Des parties à plusieurs éléments : aucun point clé, aucune citation.
    const sansRien = formulaireDepuis({ ...brouillon, keyPoints: [], citations: [] });
    expect(partieVide(sansRien, 'points_cles')).toBe(true);
    expect(partieVide(sansRien, 'explications')).toBe(true);
    expect(partieVide(formulaireDepuis(brouillon), 'explications')).toBe(false);
  });

  it('le compte de la relecture et ce qui bloque la publication en tiennent compte', () => {
    const sansQuestion = { ...brouillon, suggestedQuestion: '' };
    const form = formulaireDepuis(sansQuestion);
    form.relecture = { ...RELECTURE_COMPLETE.parties, question: false };
    expect(blocagesDePublication(form, sansQuestion)).toEqual([]);
  });
});

describe('lisible du public : la règle des pages publiques, au moins une citation', () => {
  it('publié et publiable, mais sans citation : caché du public', () => {
    const enLigne = articleAdminDepuis(PUBLIE_CONTROLE)!;
    expect(visibleDuPublic(enLigne)).toBe(true);
    expect(visibleDuPublic({ ...enLigne, citations: [] })).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Avenant du tour 5 : une case cochée nomme le contrôle relu                  */
/* -------------------------------------------------------------------------- */

describe('une case cochée part avec le contrôle relu (avenant du tour 5)', () => {
  const brouillon = articleAdminDepuis(BROUILLON_CONTROLE)!;
  const FAIT_LE = BROUILLON_CONTROLE.controle_ia.fait_le;

  it('toute case cochée envoie relecture.controle, le fait_le du contrôle affiché', () => {
    const form = formulaireDepuis(brouillon);
    form.relecture.contexte = true;
    expect(corpsDeLaModification(form, brouillon, true)).toMatchObject({
      relecture: { parties: { contexte: true, titre: false }, controle: FAIT_LE },
      is_published: true,
    });
    // Rien ne change dans les cases : ni relecture, ni contrôle.
    expect(corpsDeLaModification(formulaireDepuis(brouillon), brouillon, false)).not.toHaveProperty('relecture');
  });

  it('des cases toutes décochées partent sans contrôle : elles n’attestent rien', () => {
    const relu = articleAdminDepuis({ ...BROUILLON_CONTROLE, relecture: { parties: { contexte: true } } })!;
    const form = formulaireDepuis(relu);
    form.relecture.contexte = false;
    const corps = corpsDeLaModification(form, relu, false) as { relecture: Record<string, unknown> };
    expect(corps.relecture.parties).toMatchObject({ contexte: false });
    expect(corps.relecture).not.toHaveProperty('controle');
  });

  it('sans contrôle, aucune case n’atteste rien : elles partent décochées, une partie vide comprise', () => {
    // Une partie vide est « relue » pour le serveur ; la cocher sans contrôle
    // serait refusé (422 relecture_perimee), et l'enregistrement avec.
    const sansControle = articleAdminDepuis({
      ...BROUILLON_CONTROLE,
      suggestedQuestion: '',
      controle_ia: null,
      relecture: { parties: { question: true, contexte: true } },
      etat_publication: 'controle_a_relancer',
    })!;
    const form = formulaireDepuis(sansControle);
    form.contexte = 'Un bailleur de Yaoundé a coupé l’eau.';
    const corps = corpsDeLaModification(form, sansControle, false) as { relecture: Record<string, unknown> };
    expect(Object.values(corps.relecture.parties as Record<string, boolean>).some(Boolean)).toBe(false);
    expect(corps.relecture).not.toHaveProperty('controle');
  });

  it('un autre contrôle : fait_le différent, apparu ou effacé', () => {
    const autre = articleAdminDepuis({ ...BROUILLON_CONTROLE, controle_ia: { ...BROUILLON_CONTROLE.controle_ia, fait_le: '2026-11-04T10:12:00+00:00' } })!;
    const efface = articleAdminDepuis({ ...BROUILLON_CONTROLE, controle_ia: null })!;
    expect(autreControle(brouillon, articleAdminDepuis(BROUILLON_CONTROLE)!)).toBe(false);
    expect(autreControle(brouillon, autre)).toBe(true);
    expect(autreControle(brouillon, efface)).toBe(true);
    expect(autreControle(efface, brouillon)).toBe(true);
    expect(autreControle(efface, efface)).toBe(false);
  });

  it('les cases refaites : cochées seulement si le serveur les compte encore ET si elles l’étaient dans la fenêtre', () => {
    const relu = articleAdminDepuis({
      ...BROUILLON_CONTROLE,
      relecture: { parties: { titre: true, contexte: false, resume: true, points_cles: true } },
    })!;
    const cochees = { ...RELECTURE_COMPLETE.parties, resume: false };
    expect(casesApresUnAutreControle(cochees, relu)).toEqual({
      titre: true,
      contexte: false,
      // Décochée dans la fenêtre : elle le reste, même comptée par le serveur.
      resume: false,
      points_cles: true,
      impact: false,
      explications: false,
      question: false,
    });
  });

  it('les parties qui comptent comme relues dans la fenêtre', () => {
    const form = formulaireDepuis({ ...brouillon, suggestedQuestion: '' });
    form.relecture.titre = true;
    form.relecture.resume = true;
    form.resume = 'Autre résumé.';
    expect(partiesRelues(form, { ...brouillon, suggestedQuestion: '' })).toEqual(['titre', 'question']);
  });

  it('une partie à relire de nouveau ne revient pas cochée parce que le serveur la recompte (revue du front du tour 5)', () => {
    // Le contrôle Y a fait tomber le contexte ; le contrôle Z (2026-11-04T10:20)
    // redonne les verdicts de X, et un serveur d'avant le correctif fait
    // revivre la case cochée contre X : elle ne compte pas dans la fenêtre.
    const controleZ = { ...BROUILLON_CONTROLE.controle_ia, fait_le: '2026-11-04T10:20:00+00:00' };
    const revivante = articleAdminDepuis({
      ...BROUILLON_CONTROLE,
      controle_ia: controleZ,
      relecture: { ...RELECTURE_COMPLETE, controle: FAIT_LE },
    })!;
    const cases = revivante.relecture.parties;
    expect(casesSansRetourDesPartiesARelire(cases, ['contexte'], revivante)).toEqual({ ...cases, contexte: false });
    // Recochée ailleurs CONTRE Z, le contrôle enregistré : elle compte.
    const recochee = articleAdminDepuis({
      ...BROUILLON_CONTROLE,
      controle_ia: controleZ,
      relecture: { ...RELECTURE_COMPLETE, controle: controleZ.fait_le },
    })!;
    expect(casesSansRetourDesPartiesARelire(recochee.relecture.parties, ['contexte'], recochee)).toEqual(cases);
    // Rien à relire de nouveau : les cases du serveur, telles quelles.
    expect(casesSansRetourDesPartiesARelire(cases, [], revivante)).toEqual(cases);
  });
});

describe('les phrases de règle confirmées une à une (décision du 04/11, avenant du tour 7)', () => {
  const FAIT_LE = BROUILLON_CONTROLE.controle_ia.fait_le;
  const AVEC_REGLES = { ...BROUILLON_CONTROLE, controle_ia: { ...BROUILLON_CONTROLE.controle_ia, phrases: PHRASES_A_CONFIRMER }, etat_publication: 'phrases_a_confirmer' };
  const article = articleAdminDepuis(AVEC_REGLES)!;
  const toutCoche = (form: ReturnType<typeof formulaireDepuis>) => {
    for (const p of Object.keys(form.relecture) as (keyof typeof form.relecture)[]) form.relecture[p] = true;
  };

  it('le formulaire part des confirmations du serveur, dans l’ordre de l’article, sans celles qui ne confirment rien', () => {
    const lu = articleAdminDepuis({ ...AVEC_REGLES, relecture: { ...AVEC_REGLES.relecture, phrases_confirmees: ['p3', 'p0', 'x', 'p2'] } })!;
    expect(lu.relecture.phrasesConfirmees).toEqual(['p3', 'p0', 'x', 'p2']);
    expect(formulaireDepuis(lu).confirmees).toEqual(['p2', 'p3']);
    expect(formulaireDepuis(article).confirmees).toEqual([]);
  });

  it('« phrases_a_confirmer » : le contrôle est à jour, ses verdicts s’affichent', () => {
    expect(controleAJour(article)).toBe(true);
  });

  it('bloque après les contredites et avant la relecture, à l’étape de la relecture ; confirmées, plus rien', () => {
    const form = formulaireDepuis(article);
    toutCoche(form);
    expect(blocagesDePublication(form, article)).toEqual([{ code: 'phrases_a_confirmer', n: 2 }]);
    const etape = etapesDeReprise(blocagesDePublication(form, article)).find((e) => e.statut === 'en_cours');
    expect(etape?.etape).toBe('relecture');
    form.confirmees = ['p2'];
    expect(blocagesDePublication(form, article)).toEqual([{ code: 'phrases_a_confirmer', n: 1 }]);
    form.confirmees = ['p2', 'p3'];
    // L'état enregistré « phrases_a_confirmer » ne bloque plus : les
    // confirmations partent avec la publication, comme les cases.
    expect(blocagesDePublication(form, article)).toEqual([]);
    form.relecture.titre = false;
    expect(blocagesDePublication(form, article).map((b) => b.code)).toEqual(['relecture_incomplete']);
  });

  it('une phrase d’une partie modifiée ne se confirme plus : sa réécriture se fera juger par un nouveau contrôle', () => {
    const form = formulaireDepuis(article);
    toutCoche(form);
    form.resume = 'Le bailleur doit saisir la juridiction compétente.';
    expect(phrasesRestantesAConfirmer(form, article).map((p) => p.id)).toEqual(['p3']);
    expect(blocagesDePublication(form, article).map((b) => b.code)).toEqual(['controle_a_relancer', 'phrases_a_confirmer', 'relecture_incomplete']);
  });

  it('sans contrôle à jour, rien à confirmer : « relancez le contrôle » le dit', () => {
    const perime = articleAdminDepuis({ ...AVEC_REGLES, etat_publication: 'controle_a_relancer' })!;
    expect(phrasesRestantesAConfirmer(formulaireDepuis(perime), perime)).toEqual([]);
  });

  it('le PUT : `phrases_confirmees` (la liste entière) TOUJOURS avec `controle`, seulement si elles changent', () => {
    const form = formulaireDepuis(article);
    expect(corpsDeLaModification(form, article, false)).not.toHaveProperty('relecture');
    form.confirmees = ['p2'];
    expect(corpsDeLaModification(form, article, false)).toMatchObject({
      relecture: { parties: { titre: false }, controle: FAIT_LE, phrases_confirmees: ['p2'] },
    });
    // Retirer la dernière : la liste vide part, avec le contrôle relu.
    const confirme = articleAdminDepuis({ ...AVEC_REGLES, relecture: { ...AVEC_REGLES.relecture, controle: FAIT_LE, phrases_confirmees: ['p2'] } })!;
    const retire = formulaireDepuis(confirme);
    expect(corpsDeLaModification(retire, confirme, false)).not.toHaveProperty('relecture');
    retire.confirmees = [];
    expect(corpsDeLaModification(retire, confirme, false)).toMatchObject({ relecture: { controle: FAIT_LE, phrases_confirmees: [] } });
    // Une partie réécrite : sa phrase quitte la liste envoyée.
    const reecrit = formulaireDepuis(confirme);
    reecrit.resume = 'Le bailleur doit saisir le juge.';
    expect(corpsDeLaModification(reecrit, confirme, false)).toMatchObject({ relecture: { controle: FAIT_LE, phrases_confirmees: [] } });
    // Les cases, si elles changent aussi, partent avec.
    const tout = formulaireDepuis(article);
    toutCoche(tout);
    tout.confirmees = ['p2', 'p3'];
    expect(corpsDeLaModification(tout, article, true)).toMatchObject({
      relecture: { parties: RELECTURE_COMPLETE.parties, controle: FAIT_LE, phrases_confirmees: ['p2', 'p3'] },
      is_published: true,
    });
  });

  it('confirmer change le formulaire ; y revenir ne le change plus', () => {
    const form = formulaireDepuis(article);
    const avant = empreinte(form);
    form.confirmees = ['p2'];
    expect(empreinte(form)).not.toBe(avant);
    form.confirmees = [];
    expect(empreinte(form)).toBe(avant);
  });

  it('après un autre contrôle : seule reste confirmée la phrase que les deux jugent de même sous le même identifiant', () => {
    const autre = (phrases: typeof PHRASES_A_CONFIRMER, confirmees: string[]) =>
      articleAdminDepuis({
        ...AVEC_REGLES,
        controle_ia: { ...AVEC_REGLES.controle_ia, fait_le: '2026-11-04T10:12:00+00:00', phrases },
        relecture: { ...AVEC_REGLES.relecture, phrases_confirmees: confirmees },
      })!;
    expect(confirmationsApresUnAutreControle(['p2', 'p3'], article, autre(PHRASES_A_CONFIRMER, ['p2', 'p3']))).toEqual(['p2', 'p3']);
    // Le serveur ne la garde plus, ou la fenêtre ne l'avait pas : non confirmée.
    expect(confirmationsApresUnAutreControle(['p2', 'p3'], article, autre(PHRASES_A_CONFIRMER, ['p3']))).toEqual(['p3']);
    expect(confirmationsApresUnAutreControle(['p3'], article, autre(PHRASES_A_CONFIRMER, ['p2', 'p3']))).toEqual(['p3']);
    // « p3 » donné à une autre phrase, ou jugé autrement : jamais repris.
    const renumerote = PHRASES_A_CONFIRMER.map((p) => (p.id === 'p3' ? { ...p, texte: 'Une autre règle.' } : p));
    expect(confirmationsApresUnAutreControle(['p2', 'p3'], article, autre(renumerote, ['p2', 'p3']))).toEqual(['p2']);
    const rejuge = PHRASES_A_CONFIRMER.map((p) => (p.id === 'p2' ? { ...p, verdict: 'hors_sources' } : p));
    expect(confirmationsApresUnAutreControle(['p2', 'p3'], article, autre(rejuge, ['p2', 'p3']))).toEqual(['p3']);
    // Devenue soutenue : plus rien à confirmer.
    const soutenue = PHRASES_A_CONFIRMER.map((p) => (p.id === 'p2' ? { ...p, verdict: 'soutenue', extraits: [3] } : p));
    expect(confirmationsApresUnAutreControle(['p2', 'p3'], article, autre(soutenue, ['p2', 'p3']))).toEqual(['p3']);
  });
});
