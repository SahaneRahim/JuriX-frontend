/**
 * La doublure du serveur du blog (donnees-de-test.ts, `serveurDuBlog`), tenue
 * à l'API ÉCRITE du tour 4 : dépôt du backend, worktree wt-fix,
 * app/api/routes/blog.py et app/services/controle_du_billet.py, lus le
 * 04/11, et leurs tests (tests/test_api/test_blog_sources_routes.py), dont
 * ces cas reprennent les principaux ; et à l'avenant du tour 5 (worktree
 * wt-blog) : `relecture.controle`, 422 `relecture_perimee`, 409
 * `article_en_ligne`. Les tests de la page (page.test.ts, et la spec
 * Playwright du blog) passent par elle : si elle s'écarte de l'API, ils
 * prouvent un autre contrat que le vrai.
 *
 * Avenant du tour 7 (décision du propriétaire du 04/11) : `nature` des
 * phrases, `relecture.phrases_confirmees` (422 `relecture_perimee` pour un
 * identifiant inconnu ou un autre contrôle), l'état « phrases_a_confirmer »,
 * les confirmations qu'un nouveau contrôle efface, et les réponses publiques
 * sans rien de la relecture.
 */
import { describe, expect, it } from 'vitest';
import { ARTICLE_ANCIEN } from '$lib/data/blog-anciens-de-test';
import {
  BROUILLON,
  CITATION_VERIFIEE,
  PARTIES,
  PHRASES,
  PHRASES_A_CONFIRMER,
  PUBLIE,
  RELECTURE_COMPLETE,
  SOURCES,
  avecLeControleAJour,
  phrasesDe,
  serveurDuBlog,
} from './donnees-de-test';

type Objet = Record<string, unknown>;
/** Les sept cases cochées contre le contrôle `controle` (son `fait_le`), comme les envoie le front. */
const toutRelu = (controle: unknown) => ({ parties: RELECTURE_COMPLETE.parties, controle });
/** Le `fait_le` du contrôle enregistré. */
const faitLe = (article: Objet) => (article.controle_ia as { fait_le: string }).fait_le;
/** La ligne 1 de jurix_dev telle que la garde la base : publiée, sans sources, ni contrôle, ni relecture. */
const ANCIEN = { ...ARTICLE_ANCIEN, controle_ia: null, relecture: { parties: {}, par: null, le: null } };

const corpsDe = (reponse: { corps: unknown }) => reponse.corps as Objet;
const parties = (article: Objet) => (article.relecture as { parties: Record<string, boolean> }).parties;

describe('POST /{id}/controle', () => {
  it('sans sources : 422 sources_absentes, et le modèle n’est pas appelé', () => {
    let appele = false;
    const serveur = serveurDuBlog(ANCIEN, {
      phrasesDuControle: (article) => {
        appele = true;
        return phrasesDe(article);
      },
    });
    const reponse = serveur.repondre('POST', '/blog/1/controle');
    expect(reponse.statut).toBe(422);
    expect(corpsDe(reponse).code).toBe('sources_absentes');
    expect(String(corpsDe(reponse).detail)).toContain('Reconstruisez d\'abord ses sources');
    expect(appele).toBe(false);
    expect(serveur.article().controle_ia).toBeNull();
  });

  it('sans contrôle enregistré, aucune case ne se coche (422 relecture_perimee) ; après lui, rien n’est relu', () => {
    // Le tour 4 acceptait des cases cochées avant tout contrôle (le brouillon
    // dont le contrôle avait échoué) ; elles ne comptaient plus après lui.
    const serveur = serveurDuBlog({ ...BROUILLON, controle_ia: null });
    const refus = serveur.repondre('PUT', '/blog/12', { relecture: toutRelu(undefined) });
    expect(refus.statut).toBe(422);
    expect(corpsDe(refus).code).toBe('relecture_perimee');
    expect(Object.values(parties(serveur.article())).some(Boolean)).toBe(false);
    const controle = corpsDe(serveur.repondre('POST', '/blog/12/controle'));
    expect(controle.etat_publication).toBe('relecture_incomplete');
    expect(Object.values(parties(controle)).some(Boolean)).toBe(false);
  });

  it('les mêmes verdicts gardent la relecture ; un nouveau verdict ne fait relire que sa partie', () => {
    let phrases: unknown[] = PHRASES;
    const serveur = serveurDuBlog(BROUILLON, { phrasesDuControle: () => phrases });
    expect(corpsDe(serveur.repondre('PUT', '/blog/12', { relecture: toutRelu(faitLe(BROUILLON)) })).etat_publication).toBe('publiable');
    expect(corpsDe(serveur.repondre('POST', '/blog/12/controle')).etat_publication).toBe('publiable');
    phrases = PHRASES.map((p) => (p.partie === 'point_cle' ? { ...p, verdict: 'non_soutenue', extraits: [] } : p));
    const controle = corpsDe(serveur.repondre('POST', '/blog/12/controle'));
    // Le point clé énonce une règle : « À vérifier », il est aussi à confirmer
    // (avenant du tour 7), état qui passe avant la relecture.
    expect(controle.etat_publication).toBe('phrases_a_confirmer');
    expect(parties(controle)).toEqual(Object.fromEntries(PARTIES.map((p) => [p, p !== 'points_cles'])));
  });

  it('une case qu’un contrôle fait tomber est effacée : le suivant, aux verdicts d’avant, ne la fait pas revivre', () => {
    // Revue du front du tour 5, par la vraie API : le contrôle Y cachait
    // l'article (contexte contredit), le contrôle Z redonnait les verdicts de
    // X, et la case du contexte, cochée contre X, revivait : l'article
    // revenait en ligne sans relecture ni « Publier ». L'API l'efface.
    // Les verdicts de X : ceux du contrôle enregistré (la phrase du titre est son titre).
    const x = (PUBLIE.controle_ia as { phrases: Objet[] }).phrases;
    let phrases: unknown[] = x.map((p) => (p.partie === 'contexte' ? { ...p, verdict: 'contredite', extraits: [3] } : p));
    const serveur = serveurDuBlog(PUBLIE, { phrasesDuControle: () => phrases });
    const y = corpsDe(serveur.repondre('POST', '/blog/13/controle', { confirmer: true }));
    expect(y.etat_publication).toBe('phrases_contredites');
    expect(parties(y)).toEqual(Object.fromEntries(PARTIES.map((p) => [p, p !== 'contexte'])));
    phrases = x;
    const z = corpsDe(serveur.repondre('POST', '/blog/13/controle', { confirmer: true }));
    expect(parties(z)).toEqual(Object.fromEntries(PARTIES.map((p) => [p, p !== 'contexte'])));
    expect(z.etat_publication).toBe('relecture_incomplete');
    // Recochée contre Z, le contrôle enregistré : publiable, et en ligne.
    const relu = corpsDe(serveur.repondre('PUT', '/blog/13', { relecture: { parties: { contexte: true }, controle: faitLe(z) } }));
    expect(relu).toMatchObject({ etat_publication: 'publiable', isPublished: true });
  });

  it('chaque contrôle a son propre fait_le', () => {
    const serveur = serveurDuBlog(BROUILLON);
    const premier = faitLe(corpsDe(serveur.repondre('POST', '/blog/12/controle')));
    const second = faitLe(corpsDe(serveur.repondre('POST', '/blog/12/controle')));
    expect(new Set([faitLe(BROUILLON), premier, second]).size).toBe(3);
  });

  it('un article publié : 409 article_en_ligne sans {"confirmer": true}, le modèle n’est pas appelé ; confirmé, 200', () => {
    let appels = 0;
    const serveur = serveurDuBlog(PUBLIE, {
      phrasesDuControle: () => {
        appels++;
        return PHRASES;
      },
    });
    for (const corps of [undefined, {}, { confirmer: false }, { confirmer: 'oui' }]) {
      const refus = serveur.repondre('POST', '/blog/13/controle', corps);
      expect(refus.statut, JSON.stringify(corps)).toBe(409);
      expect(corpsDe(refus).code).toBe('article_en_ligne');
    }
    expect(appels).toBe(0);
    expect(faitLe(serveur.article())).toBe(faitLe(PUBLIE));
    const confirme = serveur.repondre('POST', '/blog/13/controle', { confirmer: true });
    expect(confirme.statut).toBe(200);
    expect(appels).toBe(1);
    expect(faitLe(corpsDe(confirme))).not.toBe(faitLe(PUBLIE));
    // Un brouillon n'a rien à confirmer.
    expect(serveurDuBlog(BROUILLON).repondre('POST', '/blog/12/controle').statut).toBe(200);
  });
});

describe('PUT /{id} : une case cochée nomme le contrôle relu (avenant du tour 5)', () => {
  it('sans relecture.controle, ou un autre que celui enregistré : 422 relecture_perimee, RIEN d’appliqué', () => {
    const serveur = serveurDuBlog(BROUILLON);
    const avant = serveur.article();
    for (const controle of [undefined, '2026-10-30T08:00:00+00:00']) {
      const refus = serveur.repondre('PUT', '/blog/12', { category: 'Logement', relecture: toutRelu(controle), is_published: true });
      expect(refus.statut, String(controle)).toBe(422);
      expect(corpsDe(refus).code).toBe('relecture_perimee');
    }
    // Une seule case cochée suffit à l'exiger.
    const une = serveur.repondre('PUT', '/blog/12', { relecture: { parties: { contexte: true } } });
    expect(corpsDe(une).code).toBe('relecture_perimee');
    expect(serveur.article()).toEqual(avant);
  });

  it('le contrôle enregistré : accepté, et chaque réponse rend relecture.controle', () => {
    const serveur = serveurDuBlog(BROUILLON);
    expect((serveur.article().relecture as Objet).controle).toBeNull();
    const publie = serveur.repondre('PUT', '/blog/12', { relecture: toutRelu(faitLe(BROUILLON)), is_published: true });
    expect(publie.statut).toBe(200);
    expect(corpsDe(publie)).toMatchObject({ isPublished: true, etat_publication: 'publiable' });
    expect((corpsDe(publie).relecture as Objet).controle).toBe(faitLe(BROUILLON));
    expect((serveur.repondre('GET', '/blog/admin/12').corps as Objet).relecture).toMatchObject({ controle: faitLe(BROUILLON) });
  });

  it('des cases toutes décochées n’ont rien à attester : acceptées sans controle', () => {
    const serveur = serveurDuBlog(avecLeControleAJour({ ...PUBLIE, isPublished: false }));
    const corps = corpsDe(serveur.repondre('PUT', '/blog/13', { relecture: { parties: { contexte: false } } }));
    expect(parties(corps)).toMatchObject({ contexte: false, resume: true });
  });

  it('deux onglets : le contrôle relancé dans l’un refuse les cases que l’autre a cochées contre l’ancien', () => {
    // Revue du tour 4 : l'onglet A publiait, en un seul PUT, des verdicts que
    // personne n'avait lus.
    const serveur = serveurDuBlog(BROUILLON, {
      phrasesDuControle: () => PHRASES.map((p) => (p.partie === 'contexte' ? { ...p, verdict: 'non_soutenue', extraits: [] } : p)),
    });
    const vuParA = faitLe(serveur.article());
    const nouveau = faitLe(corpsDe(serveur.repondre('POST', '/blog/12/controle')));
    const refus = serveur.repondre('PUT', '/blog/12', { relecture: toutRelu(vuParA), is_published: true });
    expect(refus.statut).toBe(422);
    expect(corpsDe(refus).code).toBe('relecture_perimee');
    expect(serveur.article()).toMatchObject({ isPublished: false, etat_publication: 'relecture_incomplete' });
    // Relu par A contre le nouveau contrôle : accepté.
    expect(serveur.repondre('PUT', '/blog/12', { relecture: toutRelu(nouveau), is_published: true }).statut).toBe(200);
  });
});

describe('POST /{id}/sources', () => {
  it('les mêmes sources : citations et contrôle gardés ; l’article repasse quand même en brouillon', () => {
    const serveur = serveurDuBlog(PUBLIE);
    const reponse = serveur.repondre('POST', '/blog/13/sources');
    expect(reponse.statut).toBe(200);
    const corps = corpsDe(reponse);
    expect(Object.keys(corps).sort()).toEqual(['avertissements', 'post', 'sources']);
    const post = corps.post as Objet;
    expect(corps.sources).toEqual(post.sources);
    expect((post.botAnalysis as Objet).citations).toEqual(PUBLIE.botAnalysis.citations);
    expect(post.controle_ia).toEqual(PUBLIE.controle_ia);
    expect(post).toMatchObject({ isPublished: false, etat_publication: 'publiable' });
    expect((corps.avertissements as string[]).some((a) => a.includes('Retirée'))).toBe(false);
    expect((corps.avertissements as string[]).some((a) => a.includes('repasse en brouillon'))).toBe(true);
  });

  it('une citation qu’aucune source reconstruite ne porte est retirée ; le contrôle d’avant est effacé, tout est à relire', () => {
    const serveur = serveurDuBlog(PUBLIE, { sourcesReconstruites: [SOURCES[0]] });
    const corps = corpsDe(serveur.repondre('POST', '/blog/13/sources'));
    const post = corps.post as Objet;
    expect((corps.sources as Objet[]).map((s) => [s.n, s.article_number])).toEqual([[1, '299']]);
    expect(((post.botAnalysis as Objet).citations as Objet[]).map((c) => c.article_number)).toEqual(['299']);
    const [retiree] = (corps.avertissements as string[]).filter((a) => a.includes('Retirée'));
    expect(retiree).toMatch(/^Citation 2 \(Article 1736 · Code civil\) : aucune des sources reconstruites ne porte cet article\./);
    expect((corps.avertissements as string[]).some((a) => a.includes("contrôle IA d'avant"))).toBe(true);
    expect(post.controle_ia).toBeNull();
    expect(post.etat_publication).toBe('controle_a_relancer');
    expect(Object.values(parties(post)).some(Boolean)).toBe(false);
  });

  it('un article d’avant, sans contrôle, ne se coche pas ; reconstruit, seules ses parties vides comptent comme relues', () => {
    const serveur = serveurDuBlog({ ...ANCIEN, isPublished: false });
    expect(corpsDe(serveur.repondre('PUT', '/blog/1', { relecture: toutRelu(undefined) })).code).toBe('relecture_perimee');
    const post = corpsDe(serveur.repondre('POST', '/blog/1/sources')).post as Objet;
    // Ses citations d'avant retirées, les explications sont vides : rien à y relire.
    expect(parties(post)).toEqual(Object.fromEntries(PARTIES.map((p) => [p, p === 'explications'])));
  });

  it('aucun texte ne couvre le sujet : 422 sans_source, rien n’est changé', () => {
    const serveur = serveurDuBlog(ANCIEN, { sourcesReconstruites: [] });
    const avant = serveur.article();
    const reponse = serveur.repondre('POST', '/blog/1/sources');
    expect(reponse.statut).toBe(422);
    expect(corpsDe(reponse).code).toBe('sans_source');
    expect(String(corpsDe(reponse).detail)).toContain("rien n'a changé");
    expect(serveur.article()).toEqual(avant);
  });
});

describe('PUT /{id}', () => {
  it('le titre d’un article en ligne : 422 controle_a_relancer, rien d’appliqué ; avec is_published false, accepté', () => {
    const serveur = serveurDuBlog(PUBLIE);
    const refus = serveur.repondre('PUT', '/blog/13', { title: 'Expulsion locative sans jugement : quels cas au Cameroun ?' });
    expect(refus.statut).toBe(422);
    expect(corpsDe(refus).code).toBe('controle_a_relancer');
    expect(serveur.article()).toMatchObject({ title: PUBLIE.title, isPublished: true, etat_publication: 'publiable' });
    const retire = corpsDe(
      serveur.repondre('PUT', '/blog/13', { title: 'Expulsion locative sans jugement : quels cas au Cameroun ?', is_published: false }),
    );
    expect(retire).toMatchObject({ isPublished: false, etat_publication: 'controle_a_relancer' });
    expect(parties(retire).titre).toBe(false);
    expect(parties(retire).contexte).toBe(true);
  });

  it('l’identité d’une citation comprend son extrait : un autre extrait périme le contrôle et décoche les explications', () => {
    const serveur = serveurDuBlog(PUBLIE);
    const autreExtrait = { ...CITATION_VERIFIEE, excerpt: 'Est puni d’un emprisonnement de dix (10) jours à un (01) an et d’une amende…' };
    const corps = corpsDe(
      serveur.repondre('PUT', '/blog/13', { bot_analysis: { citations: [autreExtrait, PUBLIE.botAnalysis.citations[1]] }, is_published: false }),
    );
    expect(corps.etat_publication).toBe('controle_a_relancer');
    expect(parties(corps).explications).toBe(false);
    expect(parties(corps).resume).toBe(true);
  });

  it('les blancs ne sont pas une modification', () => {
    const serveur = serveurDuBlog(PUBLIE);
    const corps = corpsDe(serveur.repondre('PUT', '/blog/13', { context: `  ${PUBLIE.context.replace(' ', '\n\n ')}  ` }));
    expect(corps).toMatchObject({ isPublished: true, etat_publication: 'publiable' });
  });

  it('une partie inconnue, ou une case qui n’est pas un booléen : 422 entree_invalide, rien d’appliqué', () => {
    const serveur = serveurDuBlog(BROUILLON);
    const inconnue = serveur.repondre('PUT', '/blog/12', { relecture: { parties: { titre: true, rubrique: true } } });
    expect(inconnue.statut).toBe(422);
    expect(corpsDe(inconnue)).toMatchObject({ code: 'entree_invalide' });
    expect(String(corpsDe(inconnue).detail)).toContain('partie(s) inconnue(s) : rubrique');
    expect(serveur.repondre('PUT', '/blog/12', { relecture: { parties: { titre: 'oui' } } }).statut).toBe(422);
    expect(parties(serveur.article()).titre).toBe(false);
  });

  it('exactement {"is_published": false} retire un article, même non publiable', () => {
    const serveur = serveurDuBlog(ANCIEN);
    const corps = corpsDe(serveur.repondre('PUT', '/blog/1', { is_published: false }));
    expect(corps).toMatchObject({ isPublished: false, etat_publication: 'sources_absentes' });
  });
});

describe('ce que rend chaque réponse', () => {
  it('`sources` dans toute réponse d’administration, et un article sans sources n’en a aucune', () => {
    const serveur = serveurDuBlog(BROUILLON);
    const sourcesDe = (reponse: { corps: unknown }) => (corpsDe(reponse).sources as Objet[]).map((s) => s.n);
    expect(sourcesDe(serveur.repondre('GET', '/blog/admin/12'))).toEqual([1, 2, 3]);
    expect(sourcesDe(serveur.repondre('PUT', '/blog/12', { category: 'Logement' }))).toEqual([1, 2, 3]);
    expect(sourcesDe(serveur.repondre('POST', '/blog/12/controle'))).toEqual([1, 2, 3]);
    expect(((serveur.repondre('GET', '/blog/admin/all').corps as Objet[])[0].sources as Objet[]).length).toBe(3);
    expect(serveurDuBlog(ANCIEN).article().sources).toEqual([]);
  });

  it('une partie vide est toujours relue', () => {
    const serveur = serveurDuBlog(avecLeControleAJour({ ...BROUILLON, suggestedQuestion: '' }));
    expect(parties(serveur.article())).toMatchObject({ question: true, titre: false });
  });

  it('les avertissements sont ceux de l’article tel qu’il est : « Sources absentes », puis plus rien à leur sujet une fois reconstruites', () => {
    const serveur = serveurDuBlog(ANCIEN);
    const avant = serveur.article().avertissements as string[];
    expect(avant.filter((a) => /^Citation \d+ : non vérifiée/.test(a))).toHaveLength(2);
    expect(avant.some((a) => a.startsWith('Sources absentes'))).toBe(true);
    const apres = (corpsDe(serveur.repondre('POST', '/blog/1/sources')).post as Objet).avertissements as string[];
    expect(apres.some((a) => a.startsWith('Sources absentes'))).toBe(false);
    expect(apres.some((a) => a.startsWith('Aucune citation'))).toBe(true);
  });
});

describe('le parcours complet d’un article d’avant (test_le_parcours_complet_avec_la_recherche_de_la_generation)', () => {
  it('sources_absentes → citations_non_verifiees → controle_a_relancer → relecture_incomplete → publiable, puis publié', () => {
    const serveur = serveurDuBlog(ANCIEN, { phrasesDuControle: (article) => phrasesDe(article) });
    const etapes = [serveur.article().etat_publication];
    const { sources } = corpsDe(serveur.repondre('POST', '/blog/1/sources')) as { sources: Objet[] };
    etapes.push(serveur.article().etat_publication);
    const source = sources.find((s) => s.article_number === '299')!;
    serveur.repondre('PUT', '/blog/1', {
      bot_analysis: {
        citations: [{ law_id: source.law_id, article_id: source.article_id, article_number: '299', title: 'La violation de domicile est punie.' }],
      },
    });
    etapes.push(serveur.article().etat_publication);
    const controle = corpsDe(serveur.repondre('POST', '/blog/1/controle'));
    etapes.push(serveur.article().etat_publication);
    serveur.repondre('PUT', '/blog/1', { relecture: toutRelu(faitLe(controle)) });
    etapes.push(serveur.article().etat_publication);
    const publie = serveur.repondre('PUT', '/blog/1', { is_published: true });
    expect(etapes).toEqual(['sources_absentes', 'citations_non_verifiees', 'controle_a_relancer', 'relecture_incomplete', 'publiable']);
    expect(publie.statut).toBe(200);
    expect(serveur.article()).toMatchObject({ isPublished: true, etat_publication: 'publiable' });
  });
});

describe('les phrases de règle à confirmer (avenant du tour 7)', () => {
  const AVEC_REGLES = avecLeControleAJour({ ...BROUILLON, controle_ia: { ...BROUILLON.controle_ia, phrases: PHRASES_A_CONFIRMER } });
  const confirmer = (controle: unknown, ids: string[]) => ({ relecture: { parties: {}, controle, phrases_confirmees: ids } });

  it('l’état « phrases_a_confirmer » passe après les contredites et avant la relecture ; publier l’exige levé', () => {
    const serveur = serveurDuBlog(AVEC_REGLES);
    expect(serveur.article().etat_publication).toBe('phrases_a_confirmer');
    expect((serveur.article().relecture as Objet).phrases_confirmees).toEqual([]);
    // Les sept cases cochées ne suffisent pas : 422 avec l'état, rien d'appliqué.
    const refus = serveur.repondre('PUT', '/blog/12', { relecture: toutRelu(faitLe(AVEC_REGLES)), is_published: true });
    expect(refus.statut).toBe(422);
    expect(corpsDe(refus).code).toBe('phrases_a_confirmer');
    expect(String(corpsDe(refus).detail)).toMatch(/^Publication refusée : 2 phrases de règle/);
    expect(serveur.article().isPublished).toBe(false);
    expect(Object.values(parties(serveur.article())).some(Boolean)).toBe(false);
    // Une contradiction passe avant.
    const contredit = serveurDuBlog(
      avecLeControleAJour({
        ...AVEC_REGLES,
        controle_ia: { ...AVEC_REGLES.controle_ia, phrases: PHRASES_A_CONFIRMER.map((p) => (p.id === 'p0' ? { ...p, verdict: 'contredite' } : p)) },
      }),
    );
    expect(contredit.article().etat_publication).toBe('phrases_contredites');
  });

  it('confirmées une à une avec le contrôle relu : rendues dans l’ordre de l’article, puis publiable une fois relu', () => {
    const serveur = serveurDuBlog(AVEC_REGLES);
    const une = corpsDe(serveur.repondre('PUT', '/blog/12', confirmer(faitLe(AVEC_REGLES), ['p3'])));
    expect((une.relecture as Objet).phrases_confirmees).toEqual(['p3']);
    expect(une.etat_publication).toBe('phrases_a_confirmer');
    const deux = corpsDe(serveur.repondre('PUT', '/blog/12', confirmer(faitLe(AVEC_REGLES), ['p3', 'p2'])));
    expect((deux.relecture as Objet).phrases_confirmees).toEqual(['p2', 'p3']);
    expect(deux.etat_publication).toBe('relecture_incomplete');
    expect(deux.relecture).toMatchObject({ par: 'admin@jurix.cm', controle: faitLe(AVEC_REGLES) });
    const publie = serveur.repondre('PUT', '/blog/12', { relecture: toutRelu(faitLe(AVEC_REGLES)), is_published: true });
    expect(publie.statut).toBe(200);
    expect(corpsDe(publie).etat_publication).toBe('publiable');
    // Une phrase soutenue n'est pas « à confirmer » : sa confirmation n'est pas gardée.
    const soutenue = corpsDe(serveur.repondre('PUT', '/blog/12', confirmer(faitLe(AVEC_REGLES), ['p2', 'p3', 'p0'])));
    expect((soutenue.relecture as Objet).phrases_confirmees).toEqual(['p2', 'p3']);
    // La liste envoyée remplace la précédente.
    const retiree = corpsDe(serveur.repondre('PUT', '/blog/12', { ...confirmer(faitLe(AVEC_REGLES), ['p2']), is_published: false }));
    expect((retiree.relecture as Objet).phrases_confirmees).toEqual(['p2']);
    expect(retiree.etat_publication).toBe('phrases_a_confirmer');
  });

  it('sans le contrôle relu, avec un autre, ou un identifiant qu’il n’a pas : 422 relecture_perimee, RIEN d’appliqué', () => {
    for (const corps of [
      { title: 'Autre titre', relecture: { parties: {}, phrases_confirmees: ['p2'] } },
      { title: 'Autre titre', ...confirmer('2026-10-30T08:00:00+00:00', ['p2']) },
      { title: 'Autre titre', ...confirmer(faitLe(AVEC_REGLES), ['p2', 'P9']) },
      // Une liste vide nomme aussi le contrôle relu.
      { title: 'Autre titre', relecture: { parties: {}, phrases_confirmees: [] } },
    ]) {
      const serveur = serveurDuBlog(AVEC_REGLES);
      const refus = serveur.repondre('PUT', '/blog/12', corps);
      expect(refus.statut).toBe(422);
      expect(corpsDe(refus).code).toBe('relecture_perimee');
      expect(serveur.article().title).toBe(AVEC_REGLES.title);
      expect((serveur.article().relecture as Objet).phrases_confirmees).toEqual([]);
    }
    const illisible = serveurDuBlog(AVEC_REGLES).repondre('PUT', '/blog/12', confirmer(faitLe(AVEC_REGLES), [2 as unknown as string]));
    expect(corpsDe(illisible).code).toBe('entree_invalide');
    const vide = serveurDuBlog(AVEC_REGLES).repondre('PUT', '/blog/12', confirmer(faitLe(AVEC_REGLES), ['  ']));
    expect(corpsDe(vide).code).toBe('entree_invalide');
  });

  it('un nouveau contrôle : la phrase jugée de même reste confirmée ; jugée autrement, sa confirmation est effacée et ne revit pas', () => {
    let phrases: unknown[] = PHRASES_A_CONFIRMER;
    const serveur = serveurDuBlog(AVEC_REGLES, { phrasesDuControle: () => phrases });
    serveur.repondre('PUT', '/blog/12', confirmer(faitLe(AVEC_REGLES), ['p2', 'p3']));
    const meme = corpsDe(serveur.repondre('POST', '/blog/12/controle'));
    expect((meme.relecture as Objet).phrases_confirmees).toEqual(['p2', 'p3']);
    // Y : le résumé soutenu (plus à confirmer), puis Z : de nouveau « À vérifier ».
    phrases = PHRASES_A_CONFIRMER.map((p) => (p.id === 'p2' ? { ...p, verdict: 'soutenue', extraits: [3] } : p));
    const y = corpsDe(serveur.repondre('POST', '/blog/12/controle'));
    expect((y.relecture as Objet).phrases_confirmees).toEqual(['p3']);
    phrases = PHRASES_A_CONFIRMER;
    const z = corpsDe(serveur.repondre('POST', '/blog/12/controle'));
    expect((z.relecture as Objet).phrases_confirmees).toEqual(['p3']);
    expect(z.etat_publication).toBe('phrases_a_confirmer');
    // Le même identifiant donné à une autre phrase ne garde pas la confirmation.
    phrases = PHRASES_A_CONFIRMER.map((p) => (p.id === 'p3' ? { ...p, texte: 'Une autre règle.' } : p));
    const autre = corpsDe(serveur.repondre('POST', '/blog/12/controle'));
    expect((autre.relecture as Objet).phrases_confirmees).toEqual([]);
  });

  it('une phrase d’une partie dont le texte change perd sa confirmation, comme la case de sa partie (nouvelle_relecture)', () => {
    const serveur = serveurDuBlog(AVEC_REGLES);
    serveur.repondre('PUT', '/blog/12', confirmer(faitLe(AVEC_REGLES), ['p2', 'p3']));
    // Le résumé réécrit, sans liste envoyée : la confirmation de p2 tombe, celle de p3 reste.
    const reecrit = corpsDe(
      serveur.repondre('PUT', '/blog/12', { bot_analysis: { summary: 'Le bailleur doit saisir la juridiction compétente.' } }),
    );
    expect(reecrit.etat_publication).toBe('controle_a_relancer');
    const relu = serveurDuBlog(AVEC_REGLES);
    relu.repondre('PUT', '/blog/12', confirmer(faitLe(AVEC_REGLES), ['p2', 'p3']));
    // La même réécriture AVEC la liste : p2 n'est pas gardée non plus.
    relu.repondre('PUT', '/blog/12', { bot_analysis: { summary: 'Autre résumé.' }, ...confirmer(faitLe(AVEC_REGLES), ['p2', 'p3']) });
    // Le contrôle neuf, aux mêmes verdicts : seule p3 compte encore.
    expect((corpsDe(serveur.repondre('POST', '/blog/12/controle')).relecture as Objet).phrases_confirmees).toEqual(['p3']);
    expect((corpsDe(relu.repondre('POST', '/blog/12/controle')).relecture as Objet).phrases_confirmees).toEqual(['p3']);
  });

  it('les réponses publiques : ni contrôle, ni relecture, ni état, ni avertissements, ni sources ; un brouillon n’y est pas', () => {
    const serveur = serveurDuBlog(PUBLIE);
    const liste = serveur.repondre('GET', '/blog');
    expect(liste.statut).toBe(200);
    const article = (liste.corps as Objet[])[0];
    expect(article.slug).toBe(PUBLIE.slug);
    for (const champ of ['controle_ia', 'relecture', 'etat_publication', 'avertissements', 'sources']) expect(article).not.toHaveProperty(champ);
    expect(corpsDe(serveur.repondre('GET', `/blog/${PUBLIE.slug}`))).toEqual(article);
    const brouillon = serveurDuBlog(BROUILLON);
    expect(brouillon.repondre('GET', '/blog').corps).toEqual([]);
    expect(brouillon.repondre('GET', `/blog/${BROUILLON.slug}`).statut).toBe(404);
    // Publié dans la base mais plus publiable (une règle à confirmer) : caché.
    const cache = serveurDuBlog({ ...AVEC_REGLES, isPublished: true });
    expect(cache.repondre('GET', '/blog').corps).toEqual([]);
  });
});
