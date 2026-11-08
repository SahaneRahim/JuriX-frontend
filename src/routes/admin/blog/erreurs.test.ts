import { describe, expect, it } from 'vitest';
import { t } from '$lib/stores/language';
import {
  ATTENTE_LONGUE_DE_GENERATION_S,
  ATTENTE_LONGUE_DU_CONTROLE_S,
  DELAI_DE_GENERATION_MS,
  DELAI_DU_CONTROLE_MS,
  erreurDeReponse,
  erreurDExecution,
  messageDErreur,
} from './erreurs';

/**
 * Chaque erreur du contrat du 29/10 a son message lisible, en français et en
 * anglais. Revue du 29/10 : un 422 de FastAPI s'affichait « [object Object] »
 * et une panne du modèle « Failed to fetch ».
 */

const fr = (cle: string) => t(cle, 'fr');
const en = (cle: string) => t(cle, 'en');
const json = (corps: unknown, statut: number, entetes: Record<string, string> = {}) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json', ...entetes } });

async function message(reponse: Response, traduire = fr) {
  return messageDErreur(await erreurDeReponse(reponse), traduire);
}

describe('erreurDeReponse : le code du contrat, où qu’il soit', () => {
  it('au premier niveau du corps, ou dans un `detail` objet', async () => {
    expect((await erreurDeReponse(json({ detail: 'Aucune source', code: 'sans_source' }, 422))).code).toBe('sans_source');
    const imbrique = await erreurDeReponse(json({ detail: { detail: 'Aucune source', code: 'sans_source' } }, 422));
    expect(imbrique.code).toBe('sans_source');
    expect(imbrique.detail).toBe('Aucune source');
    expect((await erreurDeReponse(json({ detail: { message: 'Saturé', code: 'saturation' } }, 503))).detail).toBe('Saturé');
  });

  it('sans code, le statut en donne un', async () => {
    const codes = await Promise.all(
      [422, 429, 502, 503, 504, 409, 403, 500].map(async (statut) => (await erreurDeReponse(json({ detail: 'x' }, statut))).code),
    );
    expect(codes).toEqual(['entree_invalide', 'quota', 'reponse_invalide', 'saturation', 'delai', 'slug_pris', 'interdit', 'serveur']);
  });

  it('« Not Found » de Starlette : le blog n’est pas déployé sur cette API', async () => {
    expect((await erreurDeReponse(json({ detail: 'Not Found' }, 404))).code).toBe('non_active');
    expect((await erreurDeReponse(json({ detail: 'Article introuvable' }, 404))).code).toBe('introuvable');
  });

  it('Retry-After (secondes ou date), sinon un délai du corps', async () => {
    expect((await erreurDeReponse(json({ detail: 'q' }, 429, { 'Retry-After': '60' }))).reessayerDans).toBe(60);
    const dans2min = new Date(Date.now() + 120_000).toUTCString();
    const delai = (await erreurDeReponse(json({ detail: 'q' }, 429, { 'Retry-After': dans2min }))).reessayerDans!;
    expect(delai).toBeGreaterThan(100);
    expect(delai).toBeLessThanOrEqual(120);
    expect((await erreurDeReponse(json({ detail: 'q', retry_after: 30 }, 503))).reessayerDans).toBe(30);
    expect((await erreurDeReponse(json({ detail: 'q' }, 503))).reessayerDans).toBeNull();
  });

  it('un corps illisible (proxy, page HTML) laisse parler le statut', async () => {
    const erreur = await erreurDeReponse(new Response('<html>Bad gateway</html>', { status: 502 }));
    expect(erreur.code).toBe('reponse_invalide');
    expect(erreur.detail).toBe('');
  });
});

describe('messageDErreur : jamais « [object Object] » ni « Failed to fetch »', () => {
  it('422 de FastAPI (detail tableau) : le champ et la règle, traduits', async () => {
    const corps = {
      detail: [
        { loc: ['body', 'topic'], msg: 'String should have at least 3 characters', type: 'string_too_short' },
        { loc: ['body', 'category'], msg: 'Field required', type: 'missing' },
        { loc: ['body', 'additional_context'], msg: 'String should have at most 4000 characters', type: 'string_too_long' },
      ],
    };
    const texte = await message(json(corps, 422));
    expect(texte).not.toContain('[object Object]');
    expect(texte).toBe('Saisie refusée par le serveur\u00a0: Sujet\u00a0: trop court ; Rubrique\u00a0: obligatoire ; Contexte supplémentaire\u00a0: trop long');
    expect(await message(json(corps, 422), en)).toBe(
      'Input rejected by the server: Topic: too short ; Section: required ; Additional context: too long',
    );
  });

  it('422 `entree_invalide` au detail texte : le detail de l’API', async () => {
    expect(await message(json({ detail: 'Le sujet doit faire de 3 à 300 caractères.', code: 'entree_invalide' }, 422))).toBe(
      'Saisie refusée par le serveur\u00a0: Le sujet doit faire de 3 à 300 caractères.',
    );
    expect(await message(json({}, 422))).toBe('Saisie refusée par le serveur. Vérifiez les champs.');
  });

  it('un détail de l’API qui contient « $& » reste intact', async () => {
    expect(await message(json({ detail: 'Montant de 5 $& plus', code: 'entree_invalide' }, 422))).toBe(
      'Saisie refusée par le serveur\u00a0: Montant de 5 $& plus',
    );
  });

  it('chaque code du contrat a sa phrase', async () => {
    const cas: [Response, RegExp][] = [
      [json({ detail: 'x', code: 'sans_source' }, 422), /Aucun texte publié dans JuriX ne couvre ce sujet/],
      [json({ detail: 'x', code: 'quota' }, 429, { 'Retry-After': '60' }), /quota du modèle est épuisé. Réessayez dans 60\u00a0s/],
      [json({ detail: 'x', code: 'quota' }, 429, { 'Retry-After': '600' }), /Réessayez dans 10\u00a0min/],
      [json({ detail: 'x', code: 'quota' }, 429), /Réessayez plus tard/],
      [json({ detail: 'x', code: 'saturation' }, 503, { 'Retry-After': '10' }), /modèle est saturé. Réessayez dans 10\u00a0s/],
      [json({ detail: 'x', code: 'recherche_indisponible' }, 503), /recherche dans les textes est momentanément indisponible/],
      [json({ detail: 'x', code: 'reponse_invalide' }, 502), /pas rendu un article lisible.*aucun brouillon/],
      [json({ detail: 'x', code: 'delai' }, 504), /au bout de 150 secondes/],
      [json({ detail: 'x', code: 'slug_pris' }, 409), /adresse est déjà celle d’un autre article/],
      [json({ detail: 'Not Found' }, 404), /pas encore activé sur l’API/],
      [json({ detail: 'x' }, 500), /Erreur du serveur \(HTTP 500\)/],
    ];
    for (const [reponse, attendu] of cas) expect(await message(reponse)).toMatch(attendu);
  });

  it('refus de publication (contrat du 30/10) : la raison du serveur, sinon celle de l’état', async () => {
    const refus = await erreurDeReponse(
      json({ detail: 'Deux parties ne sont pas relues : contexte, impact.', code: 'relecture_incomplete' }, 422),
    );
    expect(refus.code).toBe('relecture_incomplete');
    expect(messageDErreur(refus, fr)).toBe('Publication refusée par le serveur\u00a0: Deux parties ne sont pas relues : contexte, impact.');
    expect(messageDErreur(refus, en)).toBe('Publishing refused by the server: Deux parties ne sont pas relues : contexte, impact.');
    for (const [code, attendu] of [
      ['controle_a_relancer', /Contrôle IA à relancer/],
      ['phrases_contredites', /Phrases contredites par les sources/],
      ['citations_non_verifiees', /Citations non vérifiées/],
      // Avenant du tour 4.
      ['sources_absentes', /Sources absentes/],
    ] as const) {
      expect(await message(json({ code }, 422)), code).toMatch(attendu);
    }
  });

  it('refus de publication : « Publication refusée » une seule fois (revue du tour 3)', async () => {
    // La raison de l'API (motif_du_refus) commence elle-même par « Publication refusée : ».
    const detail = 'Publication refusée : la relecture n’est pas complète. À relire, puis à cocher : titre.';
    expect(await message(json({ detail, code: 'relecture_incomplete' }, 422))).toBe(
      'Publication refusée par le serveur\u00a0: la relecture n’est pas complète. À relire, puis à cocher : titre.',
    );
    // Un « Publication refusée. » sans raison : celle de l'état.
    expect(await message(json({ detail: 'Publication refusée.', code: 'sources_absentes' }, 422))).toMatch(/Sources absentes/);
  });

  it('le contrôle IA a ses phrases : rien n’est perdu, le brouillon reste', async () => {
    const pourLeControle = async (reponse: Response) => messageDErreur(await erreurDeReponse(reponse), fr, 'controle');
    expect(await pourLeControle(json({ detail: 'j', code: 'reponse_invalide' }, 502))).toMatch(/pas rendu un contrôle lisible. Rien n’est perdu/);
    expect(await pourLeControle(json({ detail: 'd', code: 'delai' }, 504))).toMatch(/abandonné le contrôle IA/);
    expect(await pourLeControle(json({ detail: 's', code: 'sans_source' }, 422))).toMatch(/Aucun extrait de la base à comparer/);
    expect(await pourLeControle(json({ detail: 'Not Found' }, 404))).toBe('Le contrôle IA n’existe pas sur cette API.');
    // Quota et saturation : les mêmes phrases que pour la génération.
    expect(await pourLeControle(json({ detail: 'q', code: 'quota' }, 429, { 'Retry-After': '60' }))).toMatch(/quota du modèle est épuisé/);
    expect(await pourLeControle(json({ detail: 's', code: 'saturation' }, 503))).toMatch(/modèle est saturé/);
    const abandon = new DOMException('The operation was aborted.', 'AbortError');
    expect(messageDErreur(erreurDExecution(abandon, 'delai'), fr, 'controle')).toMatch(/le contrôle IA a été abandonné/);
    // Ni « aucun brouillon n'a été créé », faux pour un contrôle.
    expect(await pourLeControle(json({ code: 'reponse_invalide' }, 502))).not.toMatch(/aucun brouillon/);
    // Ni « sans contrôle » : l'API garde le contrôle précédent (revue du tour 3).
    expect(await pourLeControle(json({ code: 'reponse_invalide' }, 502))).not.toMatch(/sans contrôle/);
  });

  it('contrôle d’un article sans sources (API du tour 4 : 422 sources_absentes) : pas lancé, et non « publication refusée »', async () => {
    // SourcesAbsentesError de controle_du_billet : le même code que le refus de publier.
    const detail =
      "L'article n'a pas de sources enregistrées (article d'avant le contrôle IA, ou écrit à la main) : rien contre quoi juger ses phrases. Reconstruisez d'abord ses sources, citez des articles parmi elles, puis relancez le contrôle.";
    const refus = await erreurDeReponse(json({ detail, code: 'sources_absentes' }, 422));
    expect(refus.code).toBe('sources_absentes');
    expect(messageDErreur(refus, fr, 'controle')).toBe(
      'Le contrôle IA n’a pas été lancé : l’article n’a pas de sources enregistrées, rien contre quoi juger ses phrases. Reconstruisez-les d’abord (« Reconstruire les sources »), puis relancez-le.',
    );
    expect(messageDErreur(refus, en, 'controle')).toMatch(/^The AI check was not run: the post has no saved sources/);
    // Pour une publication, le même code reste un refus de publier.
    expect(messageDErreur(refus, fr)).toMatch(/^Publication refusée par le serveur/);
  });

  it('contrôle sans extrait : la phrase du front, puis ce que le serveur dit de faire (revue du tour 3)', async () => {
    const detail = 'Aucun extrait à comparer : l’article ne cite aucun article vérifié de la base, et n’a pas de sources de génération. Citez au moins un article de la base, puis relancez le contrôle.';
    const texte = messageDErreur(await erreurDeReponse(json({ detail, code: 'sans_source' }, 422)), fr, 'controle');
    expect(texte).toMatch(/^Aucun extrait de la base à comparer au texte\u00a0: le contrôle IA n’a pas pu se faire\. Reconstruisez les sources/);
    expect(texte).toContain(`Le serveur précise\u00a0: «\u00a0${detail}\u00a0»`);
    expect(messageDErreur(await erreurDeReponse(json({ detail, code: 'sans_source' }, 422)), en, 'controle')).toMatch(/^No extract from the database.*The server adds: “Aucun extrait/);
  });

  it('reconstruire les sources (avenant du tour 4) : ses propres phrases, rien de perdu', async () => {
    const pourLesSources = async (reponse: Response, traduire = fr) => messageDErreur(await erreurDeReponse(reponse), traduire, 'sources');
    expect(await pourLesSources(json({ detail: 'x', code: 'sans_source' }, 422))).toMatch(
      /Aucun texte publié dans JuriX ne couvre clairement le sujet de cet article.*rien n’a changé.*titre et du contexte/,
    );
    expect(await pourLesSources(json({ detail: 'x', code: 'sans_source' }, 422), en)).toMatch(/No text published in JuriX clearly covers/);
    expect(await pourLesSources(json({ detail: 'd', code: 'delai' }, 504))).toMatch(/abandonné la reconstruction des sources/);
    expect(await pourLesSources(json({ detail: 'Not Found' }, 404))).toBe('La reconstruction des sources n’existe pas encore sur cette API.');
    // Un refus du serveur, en 422 ou en 409 : sa raison, jamais « adresse déjà prise ».
    expect(await pourLesSources(json({ detail: 'L’article a déjà ses sources.', code: 'entree_invalide' }, 422))).toBe(
      'Reconstruction refusée par le serveur\u00a0: L’article a déjà ses sources.',
    );
    const conflit = await pourLesSources(json({ detail: 'L’article a déjà ses sources.' }, 409));
    expect(conflit).toBe('Reconstruction refusée par le serveur\u00a0: L’article a déjà ses sources.');
    expect(conflit).not.toMatch(/adresse/);
    // La recherche en panne : la phrase de la génération, qui dit de réessayer.
    expect(await pourLesSources(json({ detail: 'r', code: 'recherche_indisponible' }, 503))).toMatch(/recherche dans les textes/);
    const abandon = new DOMException('The operation was aborted.', 'AbortError');
    expect(messageDErreur(erreurDExecution(abandon, 'delai'), fr, 'sources')).toMatch(/au bout de 70 secondes.*reconstruction des sources a été abandonnée/);
  });

  it('avenant du tour 5 : relecture périmée, article en ligne, contrôle refusé faute de place', async () => {
    // 422 relecture_perimee : rien n'est enregistré, et pourquoi ; jamais
    // « Saisie refusée » ni « Publication refusée : Relecture incomplète ».
    const perimee = await erreurDeReponse(json({ detail: 'Relecture périmée : …', code: 'relecture_perimee' }, 422));
    expect(perimee.code).toBe('relecture_perimee');
    for (const action of ['generation', 'controle'] as const) {
      expect(messageDErreur(perimee, fr, action)).toMatch(/^Rien n’a été enregistré\u00a0: le contrôle IA a été relancé depuis votre lecture/);
    }
    expect(messageDErreur(perimee, en)).toMatch(/^Nothing was saved: the AI check was run again since you read it/);
    // 409 article_en_ligne : ce n'est pas une adresse prise.
    const enLigne = await erreurDeReponse(json({ detail: 'L’article est publié…', code: 'article_en_ligne' }, 409));
    expect(enLigne.code).toBe('article_en_ligne');
    expect(messageDErreur(enLigne, fr, 'controle')).toBe(
      'Le contrôle IA n’a pas été relancé\u00a0: l’article a été publié entre-temps. Relancez-le\u00a0: une confirmation vous sera demandée.',
    );
    expect(messageDErreur(enLigne, fr, 'controle')).not.toMatch(/adresse/);
    // 422 entree_invalide d'un contrôle trop long : « pas lancé », la raison du serveur ensuite.
    const tropLong = await erreurDeReponse(
      json({ detail: 'L’article compte 35 phrases, 25 au plus pour le contrôle IA : raccourcissez-le, puis relancez le contrôle.', code: 'entree_invalide' }, 422),
    );
    expect(messageDErreur(tropLong, fr, 'controle')).toBe(
      'Le contrôle IA n’a pas été lancé\u00a0: L’article compte 35 phrases, 25 au plus pour le contrôle IA : raccourcissez-le, puis relancez le contrôle.',
    );
    expect(messageDErreur(tropLong, en, 'controle')).toMatch(/^The AI check was not run: L’article compte 35 phrases/);
    // Pour un enregistrement, la même erreur reste une saisie refusée.
    expect(messageDErreur(tropLong, fr)).toMatch(/^Saisie refusée par le serveur/);
  });

  it('sans réponse : réseau, délai du client, arrêt demandé', () => {
    expect(messageDErreur(erreurDExecution(new TypeError('Failed to fetch')), fr)).toMatch(/n’a pas pu être joint/);
    const abandon = new DOMException('The operation was aborted.', 'AbortError');
    expect(messageDErreur(erreurDExecution(abandon, 'delai'), fr)).toMatch(/au bout de 215 secondes/);
    expect(messageDErreur(erreurDExecution(abandon, 'admin'), fr)).toMatch(/Génération arrêtée/);
    expect(messageDErreur(erreurDExecution(new Error('?')), fr)).toBe('Réponse inattendue du serveur. Actualisez la liste.');
    expect(messageDErreur(erreurDExecution(new TypeError('Failed to fetch')), en)).toMatch(/could not be reached/);
  });
});

describe('avenant du tour 7 : les phrases de règle à confirmer, et des attentes à la mesure de mistral-large-4', () => {
  it('« phrases_a_confirmer » (422) est un refus de publication : la raison du serveur, sinon celle de l’état', async () => {
    const detail =
      'Publication refusée : 2 phrases de règle que le contrôle IA n’a pas trouvées dans les extraits ne sont ni réécrites ni confirmées.';
    const refus = await erreurDeReponse(json({ detail, code: 'phrases_a_confirmer' }, 422));
    expect(refus.code).toBe('phrases_a_confirmer');
    expect(messageDErreur(refus, fr)).toBe(
      'Publication refusée par le serveur\u00a0: 2 phrases de règle que le contrôle IA n’a pas trouvées dans les extraits ne sont ni réécrites ni confirmées.',
    );
    expect(await message(json({ detail: 'Publication refusée.', code: 'phrases_a_confirmer' }, 422))).toMatch(/Phrases de règle à confirmer/);
    expect(await message(json({ detail: '', code: 'phrases_a_confirmer' }, 422), en)).toMatch(/Rule sentences to confirm/);
  });

  it('des confirmations contre un autre contrôle (422 relecture_perimee) : rien d’enregistré, cases ou confirmations', async () => {
    const perimee = await erreurDeReponse(json({ detail: 'Relecture refusée : le contrôle IA enregistré n’a pas la phrase P31.', code: 'relecture_perimee' }, 422));
    expect(messageDErreur(perimee, fr)).toMatch(/vos cases ou vos confirmations portaient sur l’ancien\.$/);
    expect(messageDErreur(perimee, en)).toMatch(/your ticks or confirmations were for the previous one\.$/);
  });

  it('les délais du client dépassent ceux du serveur (205 s, 180 s), et les textes disent les mêmes nombres', () => {
    // Le serveur : 205 s pour une génération et son contrôle, 180 s pour un
    // contrôle seul (DELAI_CONTROLE_S, plafond de 15 500 jetons du 08/11). Le client attend 10 s de plus : la
    // phrase du serveur (504 « délai ») arrive avant la sienne.
    expect(DELAI_DE_GENERATION_MS).toBe(215_000);
    expect(DELAI_DU_CONTROLE_MS).toBe(190_000);
    for (const traduire of [fr, en]) {
      expect(traduire('admin.blog.waitHint')).toContain(String(DELAI_DE_GENERATION_MS / 1000));
      expect(traduire('admin.blog.check.waitHint')).toContain(String(DELAI_DU_CONTROLE_MS / 1000));
      expect(traduire('admin.blog.err.clientTimeout')).toContain(String(DELAI_DE_GENERATION_MS / 1000));
      expect(traduire('admin.blog.err.checkClientTimeout')).toContain(String(DELAI_DU_CONTROLE_MS / 1000));
    }
    // Les durées mesurées le 04/11 : 120 à 125 s pour une génération, 40 à 105 s pour un contrôle.
    expect(fr('admin.blog.waitHint')).toContain('120 à 125 secondes');
    expect(en('admin.blog.waitHint')).toContain('120 to 125 seconds');
    expect(fr('admin.blog.check.waitHint')).toContain('40 à 105 secondes');
    expect(en('admin.blog.check.waitHint')).toContain('40 to 105 seconds');
    expect(fr('admin.blog.check.announceStart')).toContain('40 à 105 secondes');
    expect(en('admin.blog.check.announceStart')).toContain('40 to 105 seconds');
    // « Plus long que d'habitude » après le plus long mesuré et l'appel au pire prévu (140 s),
    // avant l'abandon.
    expect(ATTENTE_LONGUE_DE_GENERATION_S).toBeGreaterThanOrEqual(20 + 140);
    expect(ATTENTE_LONGUE_DE_GENERATION_S * 1000).toBeLessThan(DELAI_DE_GENERATION_MS);
    expect(ATTENTE_LONGUE_DU_CONTROLE_S).toBeGreaterThanOrEqual(140);
    expect(ATTENTE_LONGUE_DU_CONTROLE_S * 1000).toBeLessThan(DELAI_DU_CONTROLE_MS);
  });

  it('les clés de la confirmation existent dans les deux langues', () => {
    for (const cle of [
      'admin.blog.confirmPhrase',
      'admin.blog.confirmPhraseHelp',
      'admin.blog.verdict.regle_non_soutenue',
      'admin.blog.verdict.regle_hors_sources',
      'admin.blog.verdict.reason',
      'admin.blog.blocked.toConfirm',
      'admin.blog.check.toConfirm',
      'admin.blog.etat.phrases_a_confirmer',
    ]) {
      expect(fr(cle), cle).not.toBe(cle);
      expect(en(cle), cle).not.toBe(cle);
      expect(en(cle), cle).not.toBe(fr(cle));
    }
    expect(fr('admin.blog.confirmPhrase')).toBe('J’ai vérifié cette phrase dans le texte');
    expect(fr('admin.blog.blocked.toConfirm').replace('{n}', '3')).toMatch(/^3 phrase\(s\) de règle à confirmer/);
  });
});
