import { describe, expect, it } from 'vitest';
import { t } from '$lib/stores/language';
import { erreurDeReponse, erreurDExecution, messageDErreur } from './erreurs';

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
    ] as const) {
      expect(await message(json({ code }, 422)), code).toMatch(attendu);
    }
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
  });

  it('sans réponse : réseau, délai du client, arrêt demandé', () => {
    expect(messageDErreur(erreurDExecution(new TypeError('Failed to fetch')), fr)).toMatch(/n’a pas pu être joint/);
    const abandon = new DOMException('The operation was aborted.', 'AbortError');
    expect(messageDErreur(erreurDExecution(abandon, 'delai'), fr)).toMatch(/au bout de 160 secondes/);
    expect(messageDErreur(erreurDExecution(abandon, 'admin'), fr)).toMatch(/Génération arrêtée/);
    expect(messageDErreur(erreurDExecution(new Error('?')), fr)).toBe('Réponse inattendue du serveur. Actualisez la liste.');
    expect(messageDErreur(erreurDExecution(new TypeError('Failed to fetch')), en)).toMatch(/could not be reached/);
  });
});
