/**
 * L'administration du blog, montée avec ses vrais textes et une API simulée
 * (`apiFetch`) : le parcours du contrat du 29/10 (générer un BROUILLON, le
 * relire, le publier), chaque défaut relevé par les revues du 29/10, et le
 * contrat du 30/10 (« Relecture + contrôle IA ») : verdict de chaque phrase,
 * case de relecture par partie, « Publier » désactivé tant que l'article
 * n'est pas publiable, un seul PUT pour publier, « Retirer du site » réduit à
 * `{"is_published": false}`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { tick } from 'svelte';

const simule = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('$lib/api', () => ({ apiFetch: simule.apiFetch, API_URL: 'http://api.test/api/v1', authHeaders: () => ({}) }));

import Page from './+page.svelte';
import { switchLanguage } from '$lib/stores/language';
import { ARTICLE_ANCIEN, ECRIT_PAR_LE_MODELE } from '$lib/data/blog-anciens-de-test';
import {
  BROUILLON,
  CITATION_VERIFIEE,
  PARTIES,
  PHRASES,
  PHRASES_AVEC_CONTRADICTION,
  PHRASES_A_CONFIRMER,
  PUBLIE as PUBLIE_DE_TEST,
  SOURCES,
  avecLeControleAJour,
  phrase,
  phrasesDe,
  serveurDuBlog,
} from './donnees-de-test';

type Gestionnaire = (init: RequestInit | undefined) => Response | Promise<Response>;
let routes: Record<string, Gestionnaire> = {};
/** Les corps envoyés, par « MÉTHODE /chemin ». */
let corps: Record<string, unknown[]> = {};

const json = (donnees: unknown, statut = 200, entetes: Record<string, string> = {}) =>
  new Response(JSON.stringify(donnees), { status: statut, headers: { 'content-type': 'application/json', ...entetes } });

/** Une requête qui ne répond jamais, et rejette comme fetch quand on l'interrompt. */
const sansReponse: Gestionnaire = (init) =>
  new Promise<Response>((_resoudre, rejeter) => {
    init?.signal?.addEventListener('abort', () => rejeter(new DOMException('The operation was aborted.', 'AbortError')));
  });

function differe() {
  let resoudre!: (r: Response) => void;
  const promesse = new Promise<Response>((r) => (resoudre = r));
  return { promesse, resoudre };
}

/**
 * En ligne et lisible du public, à une adresse à caractères spéciaux. Le titre
 * est une partie contrôlée (avenant du tour 4) : son contrôle est remis à
 * jour avec lui, sans quoi la doublure le dirait « à relancer ».
 */
const PUBLIE = avecLeControleAJour({ ...PUBLIE_DE_TEST, slug: 'coupure d’eau', title: 'Coupure d’eau' });

function brancher() {
  simule.apiFetch.mockImplementation(async (chemin: string, init?: RequestInit) => {
    const cle = `${init?.method ?? 'GET'} ${chemin}`;
    (corps[cle] ??= []).push(init?.body ? JSON.parse(String(init.body)) : undefined);
    const gestionnaire = routes[cle];
    if (!gestionnaire) throw new Error(`appel non simulé : ${cle}`);
    return gestionnaire(init);
  });
}

/**
 * Le serveur du contrat du 30/10 pour un article (donnees-de-test.ts) : la
 * liste, le PUT (validé en entier, 422 au code de l'état), le contrôle, la
 * relecture de l'article.
 */
function brancherLeServeur(depart: Record<string, unknown> & { id: number }, options?: Parameters<typeof serveurDuBlog>[1]) {
  const serveur = serveurDuBlog(depart, options);
  const relayer = (methode: string, chemin: string): Gestionnaire => (init) => {
    const reponse = serveur.repondre(methode, chemin, init?.body ? JSON.parse(String(init.body)) : undefined);
    return json(reponse.corps, reponse.statut);
  };
  routes['GET /blog/admin/all'] = relayer('GET', '/blog/admin/all');
  routes[`PUT /blog/${depart.id}`] = relayer('PUT', `/blog/${depart.id}`);
  routes[`POST /blog/${depart.id}/controle`] = relayer('POST', `/blog/${depart.id}/controle`);
  routes[`POST /blog/${depart.id}/sources`] = relayer('POST', `/blog/${depart.id}/sources`);
  routes[`GET /blog/admin/${depart.id}`] = relayer('GET', `/blog/admin/${depart.id}`);
  return serveur;
}

const appels = (cle: string) => corps[cle] ?? [];

beforeEach(() => {
  routes = {};
  corps = {};
  simule.apiFetch.mockReset();
  brancher();
  document.body.style.overflow = '';
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Ouvre le générateur (requêtes sur tout le document : la page est montée dans <body>). */
async function ouvrirLePanneau() {
  await fireEvent.click(await screen.findByRole('button', { name: /Générer un article IA/ }));
  return screen.getByLabelText(/Sujet ou question d’actualité/);
}

/** Ouvre la fenêtre d'un article de la liste, dans la vue demandée. */
async function ouvrir(article: { title: string }, vue: 'Relecture' | 'Aperçu' | 'Édition' = 'Relecture') {
  const ecran = render(Page);
  await ecran.findByText(article.title, { selector: 'h3' });
  await fireEvent.click(ecran.getByRole('button', { name: 'Modifier' }));
  const fenetre = ecran.getByRole('dialog');
  if (vue !== 'Édition') await fireEvent.click(within(fenetre).getByRole('button', { name: new RegExp(vue) }));
  return { ecran, fenetre };
}

/** Coche les sept cases « J'ai relu cette partie contre les sources », titre compris. */
async function toutRelire(fenetre: HTMLElement) {
  for (const partie of PARTIES) await fireEvent.click(within(fenetre).getByTestId(`blog-case-${partie}`));
}

describe('la liste', () => {
  it('API sans blog (production du 29/10) : le dire, sans « Générer » ni « Articles (0) »', async () => {
    routes['GET /blog/admin/all'] = () => json({ detail: 'Not Found' }, 404);
    const ecran = render(Page);
    expect(await ecran.findByTestId('blog-non-active')).toHaveTextContent('pas encore activé sur l’API');
    expect(ecran.queryByRole('button', { name: /Générer un article IA/ })).toBeNull();
    expect(ecran.queryByText(/Aucun article/)).toBeNull();
    expect(ecran.queryByText(/Articles \(0\)/)).toBeNull();
    expect(ecran.container.textContent).not.toMatch(/Erreur HTTP|Not Found/);
  });

  it('chargement en échec : l’erreur et « Réessayer », jamais l’état vide', async () => {
    routes['GET /blog/admin/all'] = () => json({ detail: 'x', code: 'saturation' }, 503);
    const ecran = render(Page);
    expect(await ecran.findByTestId('blog-liste-erreur')).toHaveTextContent('Le modèle est saturé');
    expect(ecran.queryByText(/Aucun article/)).toBeNull();
    expect(ecran.getByRole('heading', { level: 2, name: 'Articles' })).toBeInTheDocument();
    routes['GET /blog/admin/all'] = () => json([BROUILLON]);
    await fireEvent.click(ecran.getByRole('button', { name: 'Réessayer' }));
    expect(await ecran.findByText('Expulsion sans juge')).toBeInTheDocument();
  });

  it('« Voir » d’un brouillon ouvre l’aperçu de l’administration, jamais l’adresse publique', async () => {
    routes['GET /blog/admin/all'] = () => json([BROUILLON, PUBLIE]);
    const ecran = render(Page);
    await ecran.findByText('Expulsion sans juge');
    expect(ecran.container.querySelector(`a[href="/blog/${BROUILLON.slug}"]`)).toBeNull();
    // Le lien d'un article publié et publiable encode l'adresse.
    expect(ecran.container.querySelector('a[href="/blog/coupure%20d%E2%80%99eau"]')).not.toBeNull();
    await fireEvent.click(ecran.getByRole('button', { name: 'Voir l’aperçu du brouillon' }));
    const fenetre = ecran.getByRole('dialog', { name: 'Aperçu de l’article' });
    expect(within(fenetre).getByTestId('blog-apercu')).toHaveTextContent('Expulsion sans juge');
    expect(within(fenetre).getAllByTestId('citation-verification')[0]).toHaveTextContent('Vérifiée dans la base');
  });

  it('chaque ligne dit où en est l’article : « Prêt à publier », « Relecture incomplète »…', async () => {
    routes['GET /blog/admin/all'] = () =>
      json([BROUILLON, { ...BROUILLON, id: 14, title: 'Brouillon relu', etat_publication: 'publiable' }, PUBLIE]);
    const ecran = render(Page);
    await ecran.findByText('Brouillon relu');
    const ligne = (id: number) => ecran.container.querySelector(`#titre-article-${id}`)!.closest('li')!;
    expect(within(ligne(12)).getByTestId('blog-etat')).toHaveTextContent('Relecture incomplète');
    expect(within(ligne(14)).getByTestId('blog-etat')).toHaveTextContent('Prêt à publier');
    // En ligne et lisible : « Publié », sans état à afficher.
    expect(ligne(13)).toHaveTextContent('Publié');
    expect(within(ligne(13)).queryByTestId('blog-etat')).toBeNull();
  });

  it('les boutons d’une ligne nomment leur article (aria-describedby) sans changer de nom', async () => {
    routes['GET /blog/admin/all'] = () => json([BROUILLON]);
    const ecran = render(Page);
    await ecran.findByText('Expulsion sans juge');
    const modifier = ecran.getByRole('button', { name: 'Modifier' });
    expect(modifier).toHaveAccessibleDescription('Expulsion sans juge');
  });

  it('supprimer : la ligne part, le focus passe à la suivante', async () => {
    routes['GET /blog/admin/all'] = () => json([BROUILLON, PUBLIE]);
    routes['DELETE /blog/12'] = () => new Response(null, { status: 204 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const ecran = render(Page);
    await ecran.findByText('Expulsion sans juge');
    await fireEvent.click(ecran.getAllByRole('button', { name: 'Supprimer' })[0]);
    await waitFor(() => expect(ecran.queryByText('Expulsion sans juge')).toBeNull());
    expect(ecran.getByTestId('blog-avis')).toHaveTextContent('« Expulsion sans juge » est supprimé.');
    expect(document.activeElement?.id).toBe('modifier-13');
  });
});

describe('la génération', () => {
  it('sujet trop court : rien ne part, le champ le dit', async () => {
    routes['GET /blog/admin/all'] = () => json([]);
    const ecran = render(Page);
    const sujet = await ouvrirLePanneau();
    await fireEvent.input(sujet, { target: { value: 'ab' } });
    await fireEvent.click(ecran.getByRole('button', { name: /Générer le brouillon/ }));
    expect(appels('POST /blog/generate')).toHaveLength(0);
    expect(ecran.getByTestId('blog-generation-erreur')).toHaveTextContent('De 3 à 300 caractères.');
    expect(sujet).toHaveAttribute('aria-invalid', 'true');
  });

  it('attente honnête, puis la fenêtre s’ouvre sur la RELECTURE du brouillon enregistré, sources à côté', async () => {
    routes['GET /blog/admin/all'] = () => json([]);
    const reponse = differe();
    routes['POST /blog/generate'] = () => reponse.promesse;
    const ecran = render(Page);
    const sujet = await ouvrirLePanneau();
    await fireEvent.input(sujet, { target: { value: 'Bail' } });
    await fireEvent.input(ecran.getByLabelText(/^Rubrique/), { target: { value: 'Immobilier' } });
    await fireEvent.click(ecran.getByRole('button', { name: /Générer le brouillon/ }));

    // Le corps du contrat, et un signal pour pouvoir arrêter.
    expect(appels('POST /blog/generate')).toEqual([{ topic: 'Bail', category: 'Immobilier' }]);
    const attente = ecran.getByTestId('blog-generation-en-cours');
    expect(attente).toHaveTextContent('le contrôle IA juge chaque phrase');
    // La durée mesurée avec mistral-large-4 (essai réel du 04/11 : 121,7 et
    // 124,4 s côté client), et non plus « 30 à 90 secondes ».
    expect(attente).toHaveTextContent('environ deux minutes (120 à 125 secondes mesurées)');
    expect(attente).toHaveTextContent('200 secondes');
    // Le focus ne tombe pas sur <body> : il est sur « Arrêter ».
    expect(document.activeElement).toBe(within(attente).getByRole('button', { name: 'Arrêter' }));
    // Le bouton qui fermerait le panneau est masqué pendant l'attente.
    expect(ecran.queryByRole('button', { name: /Fermer le générateur/ })).toBeNull();

    reponse.resoudre(
      json(
        {
          post: { ...BROUILLON, avertissements: ['L’article 286 du Code pénal n’est porté par aucune source.'] },
          sources: SOURCES,
          avertissements: ['Le préavis de 3 mois n’est porté par aucune source.'],
        },
        201,
      ),
    );
    const fenetre = await ecran.findByRole('dialog', { name: 'Relecture de l’article' });
    const points = within(fenetre).getByTestId('blog-points-a-verifier');
    expect(points).toHaveTextContent('L’article 286 du Code pénal');
    expect(points).toHaveTextContent('Le préavis de 3 mois');
    expect(within(fenetre).getByTestId('blog-sources')).toHaveTextContent('Sources retrouvées (3)');
    // Un brouillon généré a ses sources : pas de parcours de reprise.
    expect(within(fenetre).queryByTestId('blog-reprise')).toBeNull();
    expect(within(fenetre).getByTestId('blog-relecture')).toBeInTheDocument();
    expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent('Brouillon : invisible du public');
    // Le brouillon est dans la liste, en brouillon.
    const ligne = ecran.container.querySelector('#titre-article-12')!.closest('li')!;
    expect(ligne).toHaveTextContent('Brouillon');
    expect(ligne).toHaveTextContent('2 à vérifier');
  });

  it('contrôle IA en échec à la génération : le brouillon est là, sans contrôle, et l’avertissement le dit', async () => {
    routes['GET /blog/admin/all'] = () => json([]);
    routes['POST /blog/generate'] = () =>
      json(
        {
          post: { ...BROUILLON, controle_ia: null, etat_publication: 'controle_a_relancer' },
          sources: SOURCES,
          avertissements: ['Le contrôle IA n’a pas abouti (quota du modèle) : relancez-le avant de publier.'],
        },
        201,
      );
    const ecran = render(Page);
    const sujet = await ouvrirLePanneau();
    await fireEvent.input(sujet, { target: { value: 'Expulsion' } });
    await fireEvent.click(ecran.getByRole('button', { name: /Générer le brouillon/ }));
    const fenetre = await ecran.findByRole('dialog', { name: 'Relecture de l’article' });
    expect(within(fenetre).getByTestId('blog-points-a-verifier')).toHaveTextContent('Relevé à la génération — Le contrôle IA n’a pas abouti');
    expect(within(fenetre).getByTestId('blog-controle')).toHaveTextContent('Aucun contrôle IA pour ce texte.');
    // Sans verdict : chaque partie montre son texte, « Non contrôlé ».
    expect(within(fenetre).queryAllByTestId('blog-phrase')).toHaveLength(0);
    expect(within(fenetre).getByTestId('blog-partie-resume')).toHaveTextContent('Non contrôlé');
    expect(within(fenetre).getByTestId('blog-partie-resume')).toHaveTextContent(BROUILLON.botAnalysis.summary);
    expect(within(fenetre).getByTestId('blog-blocages')).toHaveTextContent('Aucun contrôle IA : lancez-le.');
  });

  const ERREURS: [string, Gestionnaire, RegExp][] = [
    ['422 sans_source', () => json({ detail: 'Aucune source', code: 'sans_source' }, 422), /Aucun texte publié dans JuriX ne couvre ce sujet/],
    [
      '422 de FastAPI (liste)',
      () => json({ detail: [{ loc: ['body', 'topic'], msg: 'String should have at most 300 characters', type: 'string_too_long' }] }, 422),
      /Saisie refusée par le serveur : Sujet : trop long/,
    ],
    ['429 quota', () => json({ detail: 'q', code: 'quota' }, 429, { 'Retry-After': '120' }), /quota du modèle est épuisé. Réessayez dans 2 min/],
    ['503 saturation', () => json({ detail: 's', code: 'saturation' }, 503, { 'Retry-After': '10' }), /saturé. Réessayez dans 10 s/],
    ['503 recherche', () => json({ detail: 'r', code: 'recherche_indisponible' }, 503), /recherche dans les textes/],
    ['502 réponse invalide', () => json({ detail: 'j', code: 'reponse_invalide' }, 502), /pas rendu un article lisible/],
    ['504 délai', () => json({ detail: 'd', code: 'delai' }, 504), /150 secondes/],
    ['réseau', () => Promise.reject(new TypeError('Failed to fetch')), /n’a pas pu être joint/],
    ['ancienne API (article non enregistré)', () => json({ title: 'x', summary: 'y' }, 200), /Réponse inattendue du serveur/],
  ];

  it.each(ERREURS)('%s : un message lisible, jamais « [object Object] » ni « Failed to fetch »', async (_nom, gestionnaire, attendu) => {
    routes['GET /blog/admin/all'] = () => json([]);
    routes['POST /blog/generate'] = gestionnaire;
    const ecran = render(Page);
    const sujet = await ouvrirLePanneau();
    await fireEvent.input(sujet, { target: { value: 'Coupure d’eau par le bailleur' } });
    await fireEvent.click(ecran.getByRole('button', { name: /Générer le brouillon/ }));
    const alerte = await ecran.findByTestId('blog-generation-erreur');
    expect(alerte).toHaveTextContent(attendu);
    expect(alerte.textContent).not.toMatch(/\[object Object\]|Failed to fetch/);
    // Le sujet reste saisi pour réessayer ; aucune fenêtre ne s'ouvre.
    expect(sujet).toHaveValue('Coupure d’eau par le bailleur');
    expect(ecran.queryByRole('dialog')).toBeNull();
  });

  it('« Arrêter » coupe la requête, prévient, et relit la liste (le serveur a pu enregistrer)', async () => {
    routes['GET /blog/admin/all'] = () => json([]);
    routes['POST /blog/generate'] = sansReponse;
    const ecran = render(Page);
    const sujet = await ouvrirLePanneau();
    await fireEvent.input(sujet, { target: { value: 'Bail commercial' } });
    await fireEvent.click(ecran.getByRole('button', { name: /Générer le brouillon/ }));
    await fireEvent.click(ecran.getByRole('button', { name: 'Arrêter' }));
    expect(await ecran.findByTestId('blog-generation-avis')).toHaveTextContent('Génération arrêtée');
    await waitFor(() => expect(appels('GET /blog/admin/all')).toHaveLength(2));
    expect(ecran.queryByTestId('blog-generation-erreur')).toBeNull();
  });

  it('délai du client : « plus long que d’habitude » passé 130 s (pas avant : 120 à 125 s mesurées), abandon à 200 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    routes['GET /blog/admin/all'] = () => json([]);
    routes['POST /blog/generate'] = sansReponse;
    const ecran = render(Page);
    await vi.advanceTimersByTimeAsync(0);
    await fireEvent.click(ecran.getByRole('button', { name: /Générer un article IA/ }));
    await fireEvent.input(ecran.getByLabelText(/Sujet ou question d’actualité/), { target: { value: 'Licenciement économique' } });
    await fireEvent.click(ecran.getByRole('button', { name: /Générer le brouillon/ }));
    // D2 : la requête ne dit pas où elle en est ; le message suit l'horloge, et n'annonce plus
    // la rédaction pendant le contrôle (10 à 20 s de rédaction, puis jusqu'à 105 s de contrôle).
    await vi.advanceTimersByTimeAsync(19_000);
    expect(ecran.getByTestId('blog-generation-en-cours')).toHaveTextContent('Rédaction du brouillon…');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(ecran.getByTestId('blog-generation-en-cours')).not.toHaveTextContent('Rédaction du brouillon…');
    expect(ecran.getByTestId('blog-generation-en-cours')).toHaveTextContent('contrôle IA de chaque phrase…');
    await vi.advanceTimersByTimeAsync(104_000);
    // 125 s : la durée habituelle d'une génération et de son contrôle.
    expect(ecran.getByTestId('blog-generation-en-cours')).not.toHaveTextContent('Plus long que d’habitude');
    await vi.advanceTimersByTimeAsync(6_000);
    expect(ecran.getByTestId('blog-generation-en-cours')).toHaveTextContent('Plus long que d’habitude');
    expect(ecran.getByTestId('blog-chrono')).toHaveTextContent('2:11');
    await vi.advanceTimersByTimeAsync(69_000);
    await tick();
    expect(ecran.queryByTestId('blog-generation-en-cours')).toBeNull();
    expect(ecran.getByTestId('blog-generation-erreur')).toHaveTextContent('Pas de réponse du serveur au bout de 200 secondes');
  });
});

describe('la fenêtre de relecture', () => {
  async function ouvrirEnEdition(article: { id: number; title: string } & Record<string, unknown> = BROUILLON) {
    routes['GET /blog/admin/all'] = () => json([article]);
    const ecran = render(Page);
    await ecran.findByText(article.title, { selector: 'h3' });
    const bouton = ecran.getByRole('button', { name: 'Modifier' });
    bouton.focus();
    await fireEvent.click(bouton);
    const fenetre = ecran.getByRole('dialog', { name: 'Modifier l’article' });
    return { ecran, fenetre, bouton };
  }

  it('une sélection glissée d’un champ jusqu’au voile ne ferme pas la fenêtre', async () => {
    const { ecran, fenetre } = await ouvrirEnEdition();
    const voile = ecran.getByTestId('blog-voile');
    await fireEvent.pointerDown(within(fenetre).getByLabelText(/^Titre/));
    await fireEvent.click(voile);
    expect(ecran.queryByRole('dialog')).not.toBeNull();
    // Appui ET relâchement sur le voile, sans modification : elle se ferme.
    await fireEvent.pointerDown(voile);
    await fireEvent.click(voile);
    expect(ecran.queryByRole('dialog')).toBeNull();
  });

  it('Échap avec des modifications : confirmation, et rien n’est perdu si on refuse', async () => {
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { ecran, fenetre } = await ouvrirEnEdition();
    await fireEvent.input(within(fenetre).getByLabelText(/^Titre/), { target: { value: 'Titre modifié' } });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(confirmer).toHaveBeenCalledWith('Fermer sans enregistrer vos modifications\u00a0?');
    expect(within(ecran.getByRole('dialog')).getByLabelText(/^Titre/)).toHaveValue('Titre modifié');
  });

  it('la fermeture rend le focus au bouton qui l’a ouverte', async () => {
    const { ecran, fenetre, bouton } = await ouvrirEnEdition();
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Fermer' }));
    expect(ecran.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(bouton);
  });

  it('une erreur d’enregistrement s’affiche DANS la fenêtre', async () => {
    const { ecran, fenetre } = await ouvrirEnEdition();
    routes['PUT /blog/12'] = () => json({ detail: 's', code: 'saturation' }, 503);
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Enregistrer le brouillon' }));
    const alerte = await within(fenetre).findByRole('alert');
    expect(alerte).toHaveTextContent('Le modèle est saturé');
    // Rien sous le voile.
    expect(ecran.getAllByRole('alert')).toHaveLength(1);
  });

  it('champs obligatoires vides : nommés, le premier reçoit le focus, rien ne part', async () => {
    const { fenetre } = await ouvrirEnEdition();
    const titre = within(fenetre).getByLabelText(/^Titre/);
    await fireEvent.input(titre, { target: { value: '  ' } });
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(within(fenetre).getByRole('alert')).toHaveTextContent('Champs obligatoires vides : Titre.');
    expect(titre).toHaveAttribute('aria-invalid', 'true');
    expect(document.activeElement).toBe(titre);
    expect(appels('PUT /blog/12')).toHaveLength(0);
  });

  it('adresse prise (409) : le champ de l’adresse est désigné', async () => {
    const { fenetre } = await ouvrirEnEdition();
    routes['PUT /blog/12'] = () => json({ detail: 'pris', code: 'slug_pris' }, 409);
    await fireEvent.input(within(fenetre).getByLabelText(/^Adresse/), { target: { value: 'autre-article' } });
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await within(fenetre).findByRole('alert')).toHaveTextContent('déjà celle d’un autre article');
    expect(within(fenetre).getByLabelText(/^Adresse/)).toHaveAttribute('aria-invalid', 'true');
    expect(appels('PUT /blog/12')[0]).toMatchObject({ slug: 'autre-article', is_published: false });
  });

  it('citations : en retirer une, réécrire l’explication d’une autre ; le reste repart tel quel', async () => {
    const { fenetre } = await ouvrirEnEdition();
    routes['PUT /blog/12'] = (init) => json({ ...BROUILLON, botAnalysis: { ...BROUILLON.botAnalysis, ...JSON.parse(String(init!.body)).bot_analysis } });
    const [premiere, seconde] = within(fenetre).getAllByTestId('blog-citation');
    // Aucun champ pour le texte, l'article ou l'extrait : seulement l'explication.
    expect(within(premiere).getAllByRole('textbox')).toHaveLength(1);
    await fireEvent.input(within(premiere).getByLabelText('Explication'), { target: { value: 'Entrer chez autrui est puni.' } });
    await fireEvent.click(within(seconde).getByRole('button', { name: 'Retirer' }));
    expect(within(fenetre).getAllByTestId('blog-citation')).toHaveLength(1);
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(appels('PUT /blog/12')).toHaveLength(1));
    const envoye = appels('PUT /blog/12')[0] as { bot_analysis: { citations: unknown[] }; is_published: boolean };
    expect(envoye.bot_analysis.citations).toEqual([{ ...CITATION_VERIFIEE, title: 'Entrer chez autrui est puni.' }]);
    expect(envoye.is_published).toBe(false);
    expect(await within(fenetre).findByTestId('blog-fenetre-statut')).toHaveTextContent(/Enregistré à/);
  });

  it('l’aperçu suit la saisie, Markdown retiré ; une citation non vérifiée est marquée, sans son extrait', async () => {
    const ancien = {
      ...BROUILLON,
      botAnalysis: { ...BROUILLON.botAnalysis, citations: [{ law_id: 1, article_number: '?', reference: 'PRC-4722', title: 'Article ? - PRC-4722', excerpt: 'Paraphrase…' }] },
    };
    const { fenetre } = await ouvrirEnEdition(ancien);
    await fireEvent.input(within(fenetre).getByLabelText(/^Titre/), { target: { value: '**Nouveau** titre' } });
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Aperçu/ }));
    const apercu = within(fenetre).getByTestId('blog-apercu');
    expect(apercu).toHaveTextContent('Nouveau titre');
    expect(apercu.textContent).not.toContain('**');
    expect(apercu.textContent).not.toMatch(/PRC-\d/);
    expect(within(apercu).getByTestId('citation-non-verifiee')).toHaveTextContent('Citation non vérifiée');
    expect(within(apercu).getByTestId('blog-avis-non-verifie')).toBeInTheDocument();
    expect(apercu.textContent).not.toContain('Paraphrase');
    // Pas de lien vers un texte deviné (law_id 1).
    expect(apercu.querySelector('a[href^="/laws/1"]')).toBeNull();
    expect(within(fenetre).getByTestId('blog-points-a-verifier')).toHaveTextContent('Citation non vérifiée dans la base');
  });

  it('l’explication d’une citation s’arrête à 500 caractères, la limite du serveur', async () => {
    // À 300 (tour 2), une explication générée de 301 à 500 caractères ne se
    // complétait plus sans être raccourcie (revue du tour 3).
    const { fenetre } = await ouvrirEnEdition();
    for (const champ of within(fenetre).getAllByLabelText('Explication')) expect(champ).toHaveAttribute('maxlength', '500');
  });
});

/* -------------------------------------------------------------------------- */
/* Contrat du 30/10 : contrôle IA de chaque phrase, relecture humaine          */
/* -------------------------------------------------------------------------- */

describe('la relecture : chaque phrase et son verdict, une case par partie', () => {
  /** Génère le brouillon d'exemple (sources connues), et rend la fenêtre de relecture. */
  async function genererPuisRelire(post: Record<string, unknown> = BROUILLON) {
    routes['GET /blog/admin/all'] = () => json([]);
    routes['POST /blog/generate'] = () => json({ post, sources: SOURCES, avertissements: [] }, 201);
    const ecran = render(Page);
    const sujet = await ouvrirLePanneau();
    await fireEvent.input(sujet, { target: { value: 'Expulsion sans juge' } });
    await fireEvent.click(ecran.getByRole('button', { name: /Générer le brouillon/ }));
    const fenetre = await ecran.findByRole('dialog', { name: 'Relecture de l’article' });
    return { ecran, fenetre };
  }

  const verdictDe = (fenetre: HTMLElement, texte: string) =>
    within(within(fenetre).getByText(texte, { selector: '[data-testid="blog-phrase"] > p' }).closest('li')!).getByTestId('blog-verdict');

  it('« Soutenue par l’extrait 3 », « À vérifier », « Hors des sources » ; la raison à la demande', async () => {
    const { fenetre } = await genererPuisRelire();
    expect(within(fenetre).getByTestId('blog-controle')).toHaveTextContent('modèle ministral-14b-latest');
    expect(within(fenetre).getByTestId('blog-compte-des-verdicts')).toHaveTextContent(
      'Soutenues : 6 · À vérifier : 1 · Contredites : 0 · Hors des sources : 1',
    );
    expect(within(fenetre).getAllByTestId('blog-phrase')).toHaveLength(8);
    // Le titre aussi, en tête (avenant du tour 4).
    expect(verdictDe(fenetre, 'Expulsion sans juge')).toHaveTextContent('Soutenue par l’extrait 3');
    expect(verdictDe(fenetre, 'Le bailleur ne peut pas expulser seul.')).toHaveTextContent('Soutenue par l’extrait 3');
    expect(verdictDe(fenetre, 'Pas d’expulsion sans décision de justice.')).toHaveTextContent('Soutenue par les extraits 2 et 3');
    expect(verdictDe(fenetre, 'Saisissez le juge des référés.')).toHaveTextContent('À vérifier');
    expect(verdictDe(fenetre, 'Un bailleur de Douala a changé la serrure.')).toHaveTextContent('Hors des sources');
    // Aucune teinte hors des erreurs : rien de rouge sans contradiction.
    expect(within(fenetre).getByTestId('blog-relecture').querySelector('[class*="red-"]')).toBeNull();

    // La raison, à la demande.
    const ligne = within(fenetre).getByText('Saisissez le juge des référés.').closest('li')!;
    // « Pourquoi ? » : espace fine insécable, que la recherche par nom ne ramène pas à une espace.
    const pourquoi = within(ligne).getByRole('button', { name: /^Pourquoi\s\?$/ });
    const raison = ligne.querySelector('[id^="raison-"]')!;
    expect(raison).not.toBeVisible();
    expect(pourquoi).toHaveAttribute('aria-expanded', 'false');
    await fireEvent.click(pourquoi);
    expect(raison).toBeVisible();
    expect(raison).toHaveTextContent('Aucun extrait ne parle du juge des référés.');
  });

  it('l’explication d’une citation se relit sous SA citation, avec son extrait', async () => {
    const { fenetre } = await genererPuisRelire();
    const explications = within(fenetre).getByTestId('blog-partie-explications');
    expect(explications).toHaveTextContent('Citation 1 · Article 299 · Code pénal (loi n° 2016/007)');
    expect(explications).toHaveTextContent('« Est puni d’un emprisonnement de dix (10) jours à un (01) an… »');
    expect(explications).toHaveTextContent('Citation 2 · Article 1736 · Code civil');
  });

  it('le numéro d’un extrait ouvre la source dans le panneau, et lui donne le focus', async () => {
    const { fenetre } = await genererPuisRelire();
    const verdict = verdictDe(fenetre, 'Le bailleur ne peut pas expulser seul.');
    await fireEvent.click(within(verdict).getByRole('button', { name: 'Afficher l’extrait 3' }));
    // Dans le panneau : la raison du verdict cite aussi ce passage (« — Extrait 3 : « … » »).
    const source = within(within(fenetre).getByTestId('blog-sources')).getByText(/La juridiction compétente statuant à bref délai/).closest('li')!;
    expect(source.id).toBe('source-3');
    await waitFor(() => expect(document.activeElement).toBe(source));
    // L'extrait long est déplié en entier.
    expect(within(source).getByRole('button', { name: 'Réduire l’extrait' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('une phrase contredite : en rouge, « Contredite par l’extrait 3 », et la publication bloquée', async () => {
    const { fenetre } = await genererPuisRelire({
      ...BROUILLON,
      controle_ia: { ...BROUILLON.controle_ia, phrases: PHRASES_AVEC_CONTRADICTION },
      etat_publication: 'phrases_contredites',
    });
    const verdict = verdictDe(fenetre, 'Le bailleur ne peut pas expulser seul.');
    expect(verdict).toHaveTextContent('Contredite par l’extrait 3');
    expect(verdict.className).toContain('text-red-700');
    expect(verdict.closest('li')!.className).toContain('border-red-300');
    await toutRelire(fenetre);
    expect(within(fenetre).getByTestId('blog-blocages')).toHaveTextContent(
      '1 phrase(s) contredite(s) par les sources : corrigez-les, puis relancez le contrôle IA.',
    );
    const publier = within(fenetre).getByRole('button', { name: 'Publier' });
    expect(publier).toHaveAttribute('aria-disabled', 'true');
    await fireEvent.click(publier);
    expect(appels('PUT /blog/12')).toHaveLength(0);
  });

  it('les sept cases cochées, titre compris, « Publier » s’active et envoie UN SEUL PUT : formulaire entier, cases, is_published', async () => {
    routes['GET /blog/admin/all'] = () => json([]);
    routes['POST /blog/generate'] = () => json({ post: BROUILLON, sources: SOURCES, avertissements: [] }, 201);
    const serveur = brancherLeServeur(BROUILLON);
    routes['GET /blog/admin/all'] = () => json([]);
    const ecran = render(Page);
    const sujet = await ouvrirLePanneau();
    await fireEvent.input(sujet, { target: { value: 'Expulsion sans juge' } });
    await fireEvent.click(ecran.getByRole('button', { name: /Générer le brouillon/ }));
    const fenetre = await ecran.findByRole('dialog', { name: 'Relecture de l’article' });

    // Rien de relu : désactivé, la raison écrite à côté.
    const publier = within(fenetre).getByRole('button', { name: 'Publier' });
    expect(publier).toHaveAttribute('aria-disabled', 'true');
    expect(publier).toHaveAccessibleDescription(/Relecture incomplète\s:\s0 partie\(s\) relue\(s\) sur 7/);
    await fireEvent.click(publier);
    expect(appels('PUT /blog/12')).toHaveLength(0);
    await waitFor(() => expect(document.activeElement).toBe(within(fenetre).getByTestId('blog-blocages')));

    await toutRelire(fenetre);
    expect(within(fenetre).getByTestId('blog-progression')).toHaveTextContent('Parties relues : 7 sur 7');
    expect(within(fenetre).queryByTestId('blog-blocages')).toBeNull();
    expect(within(fenetre).getByTestId('blog-publiable')).toHaveTextContent('Prêt à publier');
    expect(publier).not.toHaveAttribute('aria-disabled');

    await fireEvent.click(publier);
    await waitFor(() => expect(ecran.queryByRole('dialog')).toBeNull());
    const envois = appels('PUT /blog/12') as Record<string, unknown>[];
    expect(envois).toHaveLength(1);
    expect(envois[0]).toMatchObject({
      title: BROUILLON.title,
      context: BROUILLON.context,
      bot_analysis: { summary: BROUILLON.botAnalysis.summary, citations: BROUILLON.botAnalysis.citations },
      relecture: { parties: { titre: true, contexte: true, resume: true, points_cles: true, impact: true, explications: true, question: true } },
      is_published: true,
    });
    expect(serveur.article().isPublished).toBe(true);
    expect(ecran.getByTestId('blog-avis')).toHaveTextContent('est publié sur /blog');
    expect(ecran.container.querySelector('#titre-article-12')!.closest('li')).toHaveTextContent('Publié');
  });

  it('modifier une partie la décoche, et le contrôle est à relancer ; « Enregistrer et relancer » fait les deux', async () => {
    // Le contrôle juge à nouveau TOUTES les phrases : celles qui n'ont pas
    // changé gardent leur verdict (la case du contexte, qui l'atteste, reste
    // donc cochée), le nouveau résumé a le sien.
    const serveur = brancherLeServeur(BROUILLON, {
      phrasesDuControle: (article) =>
        PHRASES.map((p) =>
          p.partie === 'resume'
            ? phrase('n1', 'resume', 0, String((article.botAnalysis as { summary: string }).summary), 'soutenue', [3], 'Conforme à l’extrait 3.')
            : p,
        ),
    });
    const { fenetre } = await ouvrir(BROUILLON);
    await fireEvent.click(within(fenetre).getByTestId('blog-case-contexte'));
    await fireEvent.click(within(fenetre).getByTestId('blog-case-resume'));
    expect(within(fenetre).getByTestId('blog-case-resume')).toBeChecked();

    await fireEvent.click(within(fenetre).getByRole('button', { name: /Édition/ }));
    await fireEvent.input(within(fenetre).getByLabelText(/^Analyse juridique/), {
      target: { value: 'Le bailleur doit saisir la juridiction compétente pour expulser.' },
    });
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Relecture/ }));
    const partie = within(fenetre).getByTestId('blog-partie-resume');
    // Le texte montré est le NOUVEAU texte, sans les anciens verdicts.
    expect(partie).toHaveTextContent('Modifié, non enregistré');
    expect(partie).toHaveTextContent('Le bailleur doit saisir la juridiction compétente pour expulser.');
    expect(within(partie).queryAllByTestId('blog-phrase')).toHaveLength(0);
    const caseResume = within(fenetre).getByTestId('blog-case-resume');
    expect(caseResume).not.toBeChecked();
    expect(caseResume).toBeDisabled();
    expect(within(fenetre).getByTestId('blog-blocages')).toHaveTextContent('Texte modifié : enregistrez-le, puis relancez le contrôle IA.');

    const relancer = within(fenetre).getByTestId('blog-relancer-controle');
    expect(relancer).toHaveTextContent('Enregistrer et relancer le contrôle IA');
    await fireEvent.click(relancer);
    await waitFor(() => expect(appels('POST /blog/12/controle')).toHaveLength(1));
    // Le brouillon est parti d'abord : la case du contexte cochée, celle de la partie modifiée décochée.
    expect(appels('PUT /blog/12')).toHaveLength(1);
    expect(appels('PUT /blog/12')[0]).toMatchObject({
      bot_analysis: { summary: 'Le bailleur doit saisir la juridiction compétente pour expulser.' },
      relecture: { parties: { contexte: true, resume: false } },
      is_published: false,
    });
    expect(await within(fenetre).findByTestId('blog-fenetre-statut')).toHaveTextContent(/Contrôle IA terminé à/);
    expect(serveur.envois.map((e) => `${e.methode} ${e.chemin}`)).toEqual(['GET /blog/admin/all', 'PUT /blog/12', 'POST /blog/12/controle']);
    // Les nouveaux verdicts portent sur le nouveau texte.
    expect(within(fenetre).getByTestId('blog-partie-resume')).toHaveTextContent('Soutenue par l’extrait 3');
    expect(within(fenetre).getByTestId('blog-case-resume')).not.toBeDisabled();
    expect(within(fenetre).getByTestId('blog-case-resume')).not.toBeChecked();
    expect(within(fenetre).getByTestId('blog-case-contexte')).toBeChecked();
  });

  it('« Relancer le contrôle IA » : une attente qui se voit, le formulaire figé, puis les verdicts', async () => {
    routes['GET /blog/admin/all'] = () => json([BROUILLON]);
    const reponse = differe();
    routes['POST /blog/12/controle'] = () => reponse.promesse;
    const { fenetre } = await ouvrir(BROUILLON);
    const relancer = within(fenetre).getByTestId('blog-relancer-controle');
    expect(relancer).toHaveTextContent('Relancer le contrôle IA');
    await fireEvent.click(relancer);
    expect(relancer).toHaveTextContent(/Contrôle IA en cours…\s*0:00/);
    expect(relancer).toHaveAttribute('aria-disabled', 'true');
    expect(within(fenetre).getByTestId('blog-controle')).toHaveTextContent('Le modèle compare chaque phrase aux extraits');
    expect(within(fenetre).getByTestId('blog-case-contexte')).toBeDisabled();
    expect(within(fenetre).getByRole('button', { name: 'Publier' })).toHaveAttribute('aria-disabled', 'true');
    expect(appels('POST /blog/12/controle')).toEqual([undefined]);

    reponse.resoudre(
      json({
        ...BROUILLON,
        controle_ia: { ...BROUILLON.controle_ia, fait_le: '2026-10-30T11:00:00+00:00', phrases: PHRASES_AVEC_CONTRADICTION },
        etat_publication: 'phrases_contredites',
      }),
    );
    await waitFor(() => expect(relancer).toHaveTextContent('Relancer le contrôle IA'));
    expect(within(fenetre).getByTestId('blog-compte-des-verdicts')).toHaveTextContent('Contredites : 1');
    expect(within(fenetre).getByTestId('blog-case-contexte')).not.toBeDisabled();
  });

  it('contrôle en échec (502) : un message propre au contrôle, rien de perdu, l’article relu', async () => {
    brancherLeServeur(BROUILLON);
    routes['POST /blog/12/controle'] = () => json({ detail: 'j', code: 'reponse_invalide' }, 502);
    const { fenetre } = await ouvrir(BROUILLON);
    await fireEvent.click(within(fenetre).getByTestId('blog-case-contexte'));
    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
    const alerte = await within(fenetre).findByRole('alert');
    expect(alerte).toHaveTextContent('Le modèle n’a pas rendu un contrôle lisible. Rien n’est perdu');
    expect(alerte).not.toHaveTextContent('aucun brouillon');
    await waitFor(() => expect(appels('GET /blog/admin/12')).toHaveLength(1));
    // La case cochée, enregistrée avant le contrôle (« Enregistrer et
    // relancer »), est restée : aucun autre contrôle n'est arrivé.
    expect(appels('PUT /blog/12')[0]).toMatchObject({ relecture: { parties: { contexte: true }, controle: BROUILLON.controle_ia.fait_le } });
    expect(within(fenetre).getByTestId('blog-case-contexte')).toBeChecked();
    expect(within(fenetre).queryByTestId('blog-a-relire')).toBeNull();
  });

  it('refus du serveur (422) : sa raison s’affiche, rien n’est publié, l’article est relu', async () => {
    brancherLeServeur(BROUILLON);
    // Le front croit l'article publiable ; le serveur, lui, juge le contrôle périmé.
    routes['PUT /blog/12'] = () =>
      json({ detail: 'Le texte a changé depuis le contrôle IA : relancez-le.', code: 'controle_a_relancer' }, 422);
    const { ecran, fenetre } = await ouvrir(BROUILLON);
    await toutRelire(fenetre);
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Publier' }));
    expect(await within(fenetre).findByRole('alert')).toHaveTextContent(
      'Publication refusée par le serveur : Le texte a changé depuis le contrôle IA : relancez-le.',
    );
    await waitFor(() => expect(appels('GET /blog/admin/12')).toHaveLength(1));
    expect(ecran.getByRole('dialog')).toBeInTheDocument();
    expect(ecran.container.querySelector('#titre-article-12')!.closest('li')).toHaveTextContent('Brouillon');
  });
});

describe('« Retirer du site » envoie exactement {"is_published": false}', () => {
  /**
   * La doublure applique la règle de l'API : des citations ENVOYÉES sont
   * toujours revérifiées en base, et refusées ici (le Code civil, cité, a
   * été dépublié) ; `{is_published: false}` seul ne vérifie rien.
   */
  const LOI_DEPUBLIEE = 2285;
  function brancherLaRegleDeLApi(article: typeof PUBLIE) {
    let enLigne = true;
    routes['GET /blog/admin/all'] = () => json([{ ...article, isPublished: enLigne }]);
    routes[`PUT /blog/${article.id}`] = (init) => {
      const envoye = JSON.parse(String(init!.body)) as { bot_analysis?: { citations?: { law_id: number }[] }; is_published?: boolean };
      const rang = (envoye.bot_analysis?.citations ?? []).findIndex((c) => c.law_id === LOI_DEPUBLIEE);
      if (rang >= 0) {
        return json({ detail: `Citation ${rang + 1} : le texte « Code civil » n'est pas publié.`, code: 'entree_invalide' }, 422);
      }
      enLigne = envoye.is_published ?? enLigne;
      return json({ ...article, isPublished: enLigne });
    };
    return { enLigne: () => enLigne };
  }

  async function ouvrirLArticleEnLigne() {
    const ecran = render(Page);
    await ecran.findByText(PUBLIE.title, { selector: 'h3' });
    await fireEvent.click(ecran.getByRole('button', { name: 'Modifier' }));
    return { ecran, fenetre: ecran.getByRole('dialog', { name: 'Modifier l’article' }) };
  }

  it('résumé réécrit, citations refusées par l’API : seule la publication part, l’article est retiré', async () => {
    const api = brancherLaRegleDeLApi(PUBLIE);
    const { ecran, fenetre } = await ouvrirLArticleEnLigne();
    const resume = within(fenetre).getByLabelText(/^Analyse juridique/);
    await fireEvent.input(resume, { target: { value: 'Je réécris ce résumé faux.' } });
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Retirer du site' }));

    await waitFor(() => expect(api.enLigne()).toBe(false));
    expect(appels('PUT /blog/13')).toEqual([{ is_published: false }]);
    expect(within(fenetre).queryByRole('alert')).toBeNull();
    // La ligne est à jour, la page le dit.
    const ligne = ecran.container.querySelector('#titre-article-13')!.closest('li')!;
    expect(ligne).toHaveTextContent('Brouillon');
    expect(ecran.getByTestId('blog-avis')).toHaveTextContent('est retiré du site');
    // La modification n'est pas perdue : toujours dans le champ, non enregistrée.
    expect(resume).toHaveValue('Je réécris ce résumé faux.');
    expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent('vos modifications sont restées dans le formulaire');
    // L'article est maintenant un brouillon : ses boutons sont ceux d'un brouillon.
    expect(within(fenetre).getByRole('button', { name: 'Enregistrer le brouillon' })).toBeInTheDocument();
  });

  it('un champ obligatoire vidé pour être réécrit n’empêche pas le retrait', async () => {
    const api = brancherLaRegleDeLApi(PUBLIE);
    const { fenetre } = await ouvrirLArticleEnLigne();
    await fireEvent.input(within(fenetre).getByLabelText(/^Analyse juridique/), { target: { value: '' } });
    await fireEvent.input(within(fenetre).getByLabelText(/^Impact citoyen/), { target: { value: '' } });
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Retirer du site' }));
    await waitFor(() => expect(api.enLigne()).toBe(false));
    expect(appels('PUT /blog/13')).toEqual([{ is_published: false }]);
    expect(within(fenetre).queryByRole('alert')).toBeNull();
  });

  it('sans modification : le retrait, et le formulaire repart de l’article enregistré', async () => {
    const api = brancherLaRegleDeLApi(PUBLIE);
    const { fenetre } = await ouvrirLArticleEnLigne();
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Retirer du site' }));
    await waitFor(() => expect(api.enLigne()).toBe(false));
    expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent('Retiré du site');
    expect(within(fenetre).getByTestId('blog-fenetre-statut')).not.toHaveTextContent('modifications');
  });
});

describe('« Publier les modifications » d’un article en ligne : un seul PUT, s’il reste publiable', () => {
  it('la rubrique seule : le formulaire entier et is_published true, en une fois ; l’article reste en ligne', async () => {
    const serveur = brancherLeServeur(PUBLIE);
    const { ecran, fenetre } = await ouvrir(PUBLIE, 'Édition');
    await fireEvent.input(within(fenetre).getByLabelText(/^Rubrique/), { target: { value: 'Logement' } });
    expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent('Modifications non publiées');
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Publier les modifications' }));
    await waitFor(() => expect(ecran.queryByRole('dialog')).toBeNull());
    const envois = appels('PUT /blog/13') as Record<string, unknown>[];
    expect(envois).toHaveLength(1);
    expect(envois[0]).toMatchObject({ category: 'Logement', title: PUBLIE.title, bot_analysis: { summary: PUBLIE.botAnalysis.summary }, is_published: true });
    expect(envois[0]).not.toHaveProperty('relecture');
    expect(serveur.article()).toMatchObject({ category: 'Logement', isPublished: true, etat_publication: 'publiable' });
    expect(ecran.getByTestId('blog-avis')).toHaveTextContent('est publié sur /blog');
  });

  it('le texte relu changé : désactivé, la raison dit de retirer l’article d’abord ; rien ne part', async () => {
    brancherLeServeur(PUBLIE);
    const { fenetre } = await ouvrir(PUBLIE, 'Édition');
    await fireEvent.input(within(fenetre).getByLabelText(/^Analyse juridique/), { target: { value: 'Selon l’article 312 du Code pénal…' } });
    const publier = within(fenetre).getByRole('button', { name: 'Publier les modifications' });
    expect(publier).toHaveAttribute('aria-disabled', 'true');
    expect(within(fenetre).getByTestId('blog-blocages')).toHaveTextContent(
      'Texte modifié : retirez l’article du site, enregistrez le brouillon, puis relancez le contrôle IA.',
    );
    await fireEvent.click(publier);
    expect(appels('PUT /blog/13')).toHaveLength(0);
    // Le contrôle ne se relance pas non plus : il jugerait l'ancien texte.
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Relecture/ }));
    const relancer = within(fenetre).getByTestId('blog-relancer-controle');
    expect(relancer).toHaveAttribute('aria-disabled', 'true');
    expect(relancer).toHaveAccessibleDescription(/retirez d’abord l’article du site/);
    await fireEvent.click(relancer);
    expect(appels('POST /blog/13/controle')).toHaveLength(0);
  });

  it('refusé par l’API : la raison du serveur, rien n’est changé, l’article reste en ligne', async () => {
    brancherLeServeur(PUBLIE);
    routes['PUT /blog/13'] = () => json({ detail: 'Une citation n’est plus vérifiée : son texte a été dépublié.', code: 'citations_non_verifiees' }, 422);
    const { ecran, fenetre } = await ouvrir(PUBLIE, 'Édition');
    await fireEvent.input(within(fenetre).getByLabelText(/^Rubrique/), { target: { value: 'Logement' } });
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Publier les modifications' }));
    expect(await within(fenetre).findByRole('alert')).toHaveTextContent(
      'Publication refusée par le serveur : Une citation n’est plus vérifiée : son texte a été dépublié.',
    );
    await waitFor(() => expect(appels('GET /blog/admin/13')).toHaveLength(1));
    expect(ecran.container.querySelector('#titre-article-13')!.closest('li')).toHaveTextContent('Publié');
    // La saisie reste.
    expect(within(fenetre).getByLabelText(/^Rubrique/)).toHaveValue('Logement');
  });

  it('une API qui aurait retiré l’article malgré le refus : la relecture le montre, la liste aussi', async () => {
    const serveur = brancherLeServeur(PUBLIE);
    routes['PUT /blog/13'] = () => {
      // Le défaut du tour 2 : retirer d'abord, puis refuser.
      serveur.repondre('PUT', '/blog/13', { is_published: false });
      return json({ detail: 'Adresse prise.', code: 'slug_pris' }, 409);
    };
    const { ecran, fenetre } = await ouvrir(PUBLIE, 'Édition');
    await fireEvent.input(within(fenetre).getByLabelText(/^Adresse/), { target: { value: 'expulsion-locative-loi-cameroun' } });
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Publier les modifications' }));
    await waitFor(() => expect(ecran.container.querySelector('#titre-article-13')!.closest('li')).toHaveTextContent('Brouillon'));
    expect(within(fenetre).getByRole('alert')).toHaveTextContent('déjà celle d’un autre article');
    expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent('Retiré du site');
    expect(within(fenetre).getByRole('button', { name: 'Enregistrer le brouillon' })).toBeInTheDocument();
  });

  it('sans modification : rien ne part', async () => {
    routes['GET /blog/admin/all'] = () => json([PUBLIE]);
    const { fenetre } = await ouvrir(PUBLIE, 'Édition');
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Publier les modifications' }));
    expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent('Aucune modification à publier.');
    expect(appels('PUT /blog/13')).toHaveLength(0);
  });

  it('pendant l’envoi, le formulaire est figé : rien de ce qui serait saisi ne se perd', async () => {
    const reponse = differe();
    routes['PUT /blog/12'] = () => reponse.promesse;
    routes['GET /blog/admin/all'] = () => json([BROUILLON]);
    const { fenetre } = await ouvrir(BROUILLON, 'Édition');
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(within(fenetre).getByTestId('blog-edition')).toBeDisabled();
    expect(within(fenetre).getByLabelText(/^Analyse juridique/)).toBeDisabled();
    expect(within(fenetre).getAllByRole('button', { name: 'Retirer' })[0]).toBeDisabled();
    reponse.resoudre(json(BROUILLON));
    await waitFor(() => expect(within(fenetre).getByTestId('blog-edition')).not.toBeDisabled());
  });
});

describe('article publié avant la vérification (lignes 1 à 3 de jurix_dev, décision du 30/10)', () => {
  // Les avertissements de l'API du tour 4, « Sources absentes » compris : le
  // front le dit à sa façon, sans le compter parmi les points à vérifier.
  const ANCIEN_ADMIN = {
    ...ARTICLE_ANCIEN,
    avertissements: [
      "Citation 1 : non vérifiée (écrite avant la vérification par le serveur). L'article ne peut pas être publié tant qu'elle y est : retirez-la, ou remplacez-la par un article de la base.",
      "Citation 2 : non vérifiée (écrite avant la vérification par le serveur). L'article ne peut pas être publié tant qu'elle y est : retirez-la, ou remplacez-la par un article de la base.",
      "Sources absentes : l'article n'a pas les extraits sur lesquels il a été écrit (article d'avant le contrôle IA, ou écrit à la main). Reconstruisez ses sources, citez des articles parmi elles, puis lancez le contrôle IA et relisez chaque partie : il n'est pas publiable avant.",
    ],
    controle_ia: null,
    relecture: { parties: {}, par: null, le: null },
    etat_publication: 'citations_non_verifiees',
  };

  it('la liste le dit « À reprendre : publié avant la vérification », caché du public ; « Voir » ouvre l’aperçu', async () => {
    routes['GET /blog/admin/all'] = () => json([ANCIEN_ADMIN]);
    const ecran = render(Page);
    await ecran.findByText(ANCIEN_ADMIN.title, { selector: 'h3' });
    const ligne = ecran.container.querySelector('#titre-article-1')!.closest('li')!;
    expect(within(ligne).getByTestId('blog-a-reprendre')).toHaveTextContent('À reprendre : publié avant la vérification');
    expect(ligne).not.toHaveTextContent('Publié ');
    expect(ligne).toHaveTextContent(
      'Caché du public : il n’y revient qu’une fois publiable (sources, citations vérifiées, contrôle IA, relecture de chaque partie).',
    );
    // Pas de lien vers son adresse publique, qui répond 404.
    expect(ligne.querySelector('a[href^="/blog/"]')).toBeNull();
    await fireEvent.click(within(ligne).getByRole('button', { name: 'Voir l’aperçu de l’article caché du public' }));
    expect(ecran.getByRole('dialog', { name: 'Aperçu de l’article' })).toBeInTheDocument();
  });

  it('« Citation non vérifiée », sans extrait, en édition comme en aperçu ; la publication bloquée et dite', async () => {
    routes['GET /blog/admin/all'] = () => json([ANCIEN_ADMIN]);
    const ecran = render(Page);
    await ecran.findByText(ANCIEN_ADMIN.title, { selector: 'h3' });
    // Deux citations, deux points : le serveur et le front ne s'additionnent plus.
    expect(ecran.container.querySelector('#titre-article-1')!.closest('li')).toHaveTextContent('2 à vérifier');
    await fireEvent.click(ecran.getByRole('button', { name: 'Modifier' }));
    const fenetre = ecran.getByRole('dialog');

    expect(within(fenetre).getByTestId('blog-points-a-verifier')).toHaveTextContent('À vérifier avant publication (2)');
    const citations = within(fenetre).getAllByTestId('blog-citation');
    expect(citations).toHaveLength(2);
    for (const citation of citations) {
      expect(within(citation).getByTestId('blog-citation-etat')).toHaveTextContent('Citation non vérifiée');
      expect(citation.querySelector('blockquote')).toBeNull();
    }
    for (const ecrit of ECRIT_PAR_LE_MODELE.filter((e) => !e.startsWith('Obligations'))) {
      expect(within(fenetre).getByTestId('blog-edition').textContent, ecrit).not.toContain(ecrit);
    }
    // Ni « Publié » ni lien public dans la fenêtre.
    expect(within(fenetre).getByTestId('blog-a-reprendre')).toBeInTheDocument();
    expect(within(fenetre).queryByRole('link', { name: /Voir sur le site/ })).toBeNull();
    const raisons = within(fenetre).getByTestId('blog-blocages');
    expect(raisons).toHaveTextContent('Sources absentes : reconstruisez-les (bouton « Reconstruire les sources » de la vue Relecture).');
    expect(raisons).toHaveTextContent('2 citation(s) non vérifiée(s) dans la base : retirez-les (vue Édition).');
    expect(raisons).toHaveTextContent('Aucun contrôle IA : lancez-le.');
    expect(raisons).toHaveTextContent('Relecture incomplète : 0 partie(s) relue(s) sur 7.');
    // Caché du public, il se reprend comme un brouillon : ni « Retirer du
    // site » (il n'y est pas), ni « Publier les modifications ».
    expect(within(fenetre).queryByRole('button', { name: 'Retirer du site' })).toBeNull();
    expect(within(fenetre).getByRole('button', { name: 'Enregistrer le brouillon' })).toBeInTheDocument();
    expect(within(fenetre).getByRole('button', { name: 'Publier' })).toHaveAttribute('aria-disabled', 'true');

    await fireEvent.click(within(fenetre).getByRole('button', { name: /Aperçu/ }));
    const apercu = within(fenetre).getByTestId('blog-apercu');
    expect(within(apercu).getAllByTestId('citation-non-verifiee')).toHaveLength(2);
    expect(within(apercu).getByTestId('blog-avis-non-verifie')).toBeInTheDocument();
    for (const ecrit of ECRIT_PAR_LE_MODELE) expect(apercu.textContent, ecrit).not.toContain(ecrit);
    expect(apercu.querySelector('a[href^="/laws"]')).toBeNull();

    // Sans sources enregistrées : les textes cités, et dire comment en sortir.
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Relecture/ }));
    expect(within(fenetre).getByTestId('blog-sources-absentes')).toHaveTextContent(
      'Cet article n’a pas de sources enregistrées : il a été écrit avant leur enregistrement, ou à la main. Reconstruisez-les',
    );
    expect(within(fenetre).getByTestId('blog-sources')).not.toHaveTextContent('pendant la visite');
  });
});

/* -------------------------------------------------------------------------- */
/* Avenant du tour 4 : le titre, les sources gardées, le parcours de reprise   */
/* -------------------------------------------------------------------------- */

describe('le titre se relit et se contrôle comme les autres parties (avenant du tour 4)', () => {
  it('en tête de la Relecture, avec son verdict et sa case ; sept parties à relire', async () => {
    brancherLeServeur(BROUILLON);
    const { fenetre } = await ouvrir(BROUILLON);
    const titre = within(fenetre).getByTestId('blog-partie-titre');
    // La première partie de la vue, avant le contexte.
    expect(within(fenetre).getByTestId('blog-relecture').querySelector('section')).toBe(titre);
    expect(within(titre).getByRole('heading', { name: 'Titre' })).toBeInTheDocument();
    expect(within(titre).getByTestId('blog-verdict')).toHaveTextContent('Soutenue par l’extrait 3');
    expect(within(fenetre).getByTestId('blog-progression')).toHaveTextContent('Parties relues : 0 sur 7');
    // Six parties sur sept : le titre manque encore, et la raison le compte.
    for (const partie of PARTIES.filter((p) => p !== 'titre')) await fireEvent.click(within(fenetre).getByTestId(`blog-case-${partie}`));
    expect(within(fenetre).getByTestId('blog-blocages')).toHaveTextContent('Relecture incomplète : 6 partie(s) relue(s) sur 7.');
    expect(within(fenetre).getByRole('button', { name: 'Publier' })).toHaveAttribute('aria-disabled', 'true');
    // La case du titre se nomme par sa partie.
    const caseDuTitre = within(fenetre).getByTestId('blog-case-titre');
    expect(caseDuTitre).toHaveAccessibleDescription('Titre');
    await fireEvent.click(caseDuTitre);
    expect(within(fenetre).queryByTestId('blog-blocages')).toBeNull();
    expect(within(fenetre).getByRole('button', { name: 'Publier' })).not.toHaveAttribute('aria-disabled');
  });

  it('un titre contredit par une source : en rouge, et la publication bloquée', async () => {
    const titreContredit = avecLeControleAJour({
      ...BROUILLON,
      title: 'Expulsion locative sans jugement : quels cas au Cameroun ?',
      controle_ia: {
        ...BROUILLON.controle_ia,
        phrases: BROUILLON.controle_ia.phrases.map((p) =>
          p.partie === 'titre'
            ? phrase('p0', 'titre', 0, '', 'contredite', [3], 'L’extrait 3 confie l’expulsion à la juridiction : le titre présuppose des cas sans jugement.')
            : p,
        ),
      },
    });
    brancherLeServeur(titreContredit);
    const { fenetre } = await ouvrir(titreContredit);
    const verdict = within(within(fenetre).getByTestId('blog-partie-titre')).getByTestId('blog-verdict');
    expect(verdict).toHaveTextContent('Contredite par l’extrait 3');
    expect(verdict.className).toContain('text-red-700');
    await toutRelire(fenetre);
    expect(within(fenetre).getByTestId('blog-blocages')).toHaveTextContent('1 phrase(s) contredite(s) par les sources');
  });

  it('article EN LIGNE : changer le SEUL titre bloque « Publier les modifications », et rien ne part', async () => {
    // Revue du tour 3 : le titre changé partait en ligne en un seul PUT, sans
    // contrôle ni relecture.
    brancherLeServeur(PUBLIE);
    const { fenetre } = await ouvrir(PUBLIE, 'Édition');
    await fireEvent.input(within(fenetre).getByLabelText(/^Titre/), {
      target: { value: 'Licenciement abusif : le salarié doit prouver l’abus pour être indemnisé' },
    });
    const publier = within(fenetre).getByRole('button', { name: 'Publier les modifications' });
    expect(publier).toHaveAttribute('aria-disabled', 'true');
    expect(within(fenetre).getByTestId('blog-blocages')).toHaveTextContent(
      'Texte modifié : retirez l’article du site, enregistrez le brouillon, puis relancez le contrôle IA.',
    );
    await fireEvent.click(publier);
    expect(appels('PUT /blog/13')).toHaveLength(0);
    // Dans la Relecture : le nouveau titre, « Modifié, non enregistré », sa case bloquée.
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Relecture/ }));
    const titre = within(fenetre).getByTestId('blog-partie-titre');
    expect(titre).toHaveTextContent('Modifié, non enregistré');
    expect(titre).toHaveTextContent('Licenciement abusif : le salarié doit prouver l’abus pour être indemnisé');
    expect(within(titre).queryAllByTestId('blog-phrase')).toHaveLength(0);
    expect(within(fenetre).getByTestId('blog-case-titre')).toBeDisabled();
    expect(within(fenetre).getByTestId('blog-case-titre')).not.toBeChecked();
  });
});

describe('les sources gardées avec l’article : un brouillon rouvert se relit contre elles (avenant du tour 4)', () => {
  it('sans génération dans la visite : le panneau, les numéros des verdicts et « Citer » en édition', async () => {
    // Revue du tour 3 : rouvert le lendemain, le brouillon montrait « Soutenue
    // par l'extrait 3 » sans l'extrait 3 nulle part, et aucun « Citer ».
    brancherLeServeur(BROUILLON);
    const { fenetre } = await ouvrir(BROUILLON);
    expect(appels('POST /blog/generate')).toHaveLength(0);
    expect(within(fenetre).getByTestId('blog-sources')).toHaveTextContent('Sources retrouvées (3)');
    expect(within(fenetre).queryByTestId('blog-sources-absentes')).toBeNull();
    expect(within(fenetre).queryByTestId('blog-reprise')).toBeNull();
    const resume = within(fenetre).getByTestId('blog-partie-resume');
    await fireEvent.click(within(resume).getByRole('button', { name: 'Afficher l’extrait 3' }));
    await waitFor(() => expect(document.activeElement?.id).toBe('source-3'));
    expect(document.activeElement).toHaveTextContent('La juridiction compétente statuant à bref délai');

    await fireEvent.click(within(fenetre).getByRole('button', { name: /Édition/ }));
    const panneau = within(fenetre).getByTestId('blog-sources');
    // Les articles 299 et 1736 sont cités ; le 133 peut l'être.
    expect(within(panneau).getAllByText('Déjà citée')).toHaveLength(2);
    await fireEvent.click(within(panneau).getByRole('button', { name: 'Citer' }));
    expect(within(fenetre).getAllByTestId('blog-citation')).toHaveLength(3);
  });

  it('la liste rechargée garde les sources : la fenêtre rouverte les montre encore', async () => {
    const serveur = brancherLeServeur(BROUILLON);
    const ecran = render(Page);
    await ecran.findByText(BROUILLON.title, { selector: 'h3' });
    await fireEvent.click(ecran.getByRole('button', { name: 'Actualiser' }));
    await waitFor(() => expect(serveur.envois.filter((e) => e.chemin === '/blog/admin/all')).toHaveLength(2));
    await fireEvent.click(ecran.getByRole('button', { name: 'Modifier' }));
    expect(within(ecran.getByRole('dialog')).getByTestId('blog-sources')).toHaveTextContent('Sources retrouvées (3)');
  });
});

describe('un article d’avant la vérification revient en ligne par le nouveau parcours (décision du 30/10, b)', () => {
  /**
   * La ligne 1 de jurix_dev telle que la rendrait l'administration de
   * l'avenant du tour 4 : publiée dans la base, cachée du public, sans
   * sources, ni contrôle, ni relecture ; citations écrites par le modèle.
   */
  const A_REPRENDRE = {
    ...ARTICLE_ANCIEN,
    avertissements: [
      'Citation 1 : non vérifiée (écrite avant la vérification par le serveur). Retirez-la, ou remplacez-la par un article de la base.',
      'Citation 2 : non vérifiée (écrite avant la vérification par le serveur). Retirez-la, ou remplacez-la par un article de la base.',
    ],
    controle_ia: null,
    relecture: { parties: {}, par: null, le: null },
  };

  const etapes = (fenetre: HTMLElement) =>
    within(fenetre)
      .getAllByTestId(/^blog-etape-(sources|citations|controle|relecture|publication)$/)
      .map((e) => `${e.dataset.testid!.replace('blog-etape-', '')}:${e.dataset.statut}`);

  it('« Reconstruire les sources » → citer → « Relancer le contrôle IA » → relire les sept parties → publier', async () => {
    const serveur = brancherLeServeur(A_REPRENDRE, { phrasesDuControle: (article) => phrasesDe(article) });
    const ecran = render(Page);
    await ecran.findByText(A_REPRENDRE.title, { selector: 'h3' });
    await fireEvent.click(ecran.getByRole('button', { name: 'Modifier' }));
    const fenetre = ecran.getByRole('dialog');

    // 1. Le parcours, en tête : tout reste à faire, les sources d'abord.
    const reprise = within(fenetre).getByTestId('blog-reprise');
    expect(reprise).toHaveTextContent('Remettre l’article en ligne');
    expect(reprise).toHaveTextContent('Publié avant la vérification, cet article est caché du public.');
    expect(etapes(fenetre)).toEqual(['sources:en_cours', 'citations:a_venir', 'controle:a_venir', 'relecture:a_venir', 'publication:a_venir']);
    expect(within(fenetre).getByTestId('blog-etape-sources')).toHaveAttribute('aria-current', 'step');
    // « Sources absentes : … », que l'API ajoute aux avertissements de l'article :
    // le front le dit déjà (parcours, raison du pied), sans le compter en double.
    expect((serveur.article().avertissements as string[]).some((a) => a.startsWith('Sources absentes'))).toBe(true);
    expect(within(fenetre).getByTestId('blog-points-a-verifier')).not.toHaveTextContent('Sources absentes');
    expect(within(fenetre).getByTestId('blog-points-a-verifier')).toHaveTextContent('À vérifier avant publication (2)');
    // Le contrôle ne part pas sans sources, et le dit.
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Relecture/ }));
    const relancer = within(fenetre).getByTestId('blog-relancer-controle');
    expect(relancer).toHaveAttribute('aria-disabled', 'true');
    expect(relancer).toHaveAccessibleDescription(/reconstruisez-les d’abord/);
    await fireEvent.click(relancer);
    expect(appels('POST /blog/1/controle')).toHaveLength(0);
    // Ni case à cocher sans contrôle : la relecture se fait avec ses verdicts.
    expect(within(fenetre).getByTestId('blog-relecture-attend')).toHaveTextContent('Les cases se cochent avec les verdicts d’un contrôle IA à jour');
    expect(within(fenetre).getByTestId('blog-case-titre')).toBeDisabled();

    // 2. Reconstruire : les citations d'avant, qu'aucune source ne porte, sont retirées.
    const reconstruire = within(fenetre).getByTestId('blog-reconstruire-sources');
    expect(reconstruire).toHaveTextContent('Reconstruire les sources');
    expect(reconstruire).toHaveAccessibleDescription(/JuriX refait la recherche de la génération/);
    await fireEvent.click(reconstruire);
    await waitFor(() => expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent(/Sources reconstruites à .* : 3 extrait\(s\)/));
    expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent('2 citation(s) retirée(s), qu’aucune source reconstruite ne portait.');
    expect(appels('POST /blog/1/sources')).toEqual([undefined]);
    // Les avertissements de l'API du tour 4, marqués comme ceux de la reconstruction.
    const points = within(fenetre).getByTestId('blog-points-a-verifier');
    expect(points).toHaveTextContent(
      'Relevé à la reconstruction des sources — Citation 1 (Article 1719 · Code Civil / Droit des obligations) : écrite avant la vérification par le serveur',
    );
    expect(points).toHaveTextContent('Relevé à la reconstruction des sources — L\'article repasse en brouillon');
    // Le bouton est parti avec l'étape faite : le focus passe à l'étape suivante.
    await waitFor(() => expect(document.activeElement).toBe(within(fenetre).getByTestId('blog-etape-citations')));
    expect(within(fenetre).getByTestId('blog-etape-citations')).toHaveAttribute('tabindex', '-1');
    // Repassé en brouillon par la reconstruction (API du tour 4).
    expect(serveur.article().isPublished).toBe(false);
    expect(within(fenetre).getByTestId('blog-sources')).toHaveTextContent('Sources retrouvées (3)');
    expect(etapes(fenetre)).toEqual(['sources:faite', 'citations:en_cours', 'controle:a_venir', 'relecture:a_venir', 'publication:a_venir']);
    expect(within(fenetre).getByTestId('blog-etape-citations')).toHaveTextContent(
      'Aucune citation de la base : citez au moins un article des sources (vue Édition, « Citer »), puis enregistrez.',
    );
    expect(within(fenetre).getByTestId('blog-blocages')).not.toHaveTextContent('Le serveur ne le juge pas publiable');

    // 3. Citer : l'étape mène à l'édition, où chaque source se cite.
    await fireEvent.click(within(within(fenetre).getByTestId('blog-etape-citations')).getByRole('button', { name: 'Ouvrir l’édition' }));
    expect(ecran.getByRole('dialog', { name: 'Modifier l’article' })).toBeInTheDocument();
    const panneau = within(fenetre).getByTestId('blog-sources');
    await fireEvent.click(within(panneau).getAllByRole('button', { name: 'Citer' })[0]);
    const [citation] = within(fenetre).getAllByTestId('blog-citation');
    await fireEvent.input(within(citation).getByLabelText('Explication'), {
      target: { value: 'Entrer chez autrui contre son gré est puni de dix jours à un an d’emprisonnement.' },
    });
    // Citée mais pas encore enregistrée : rien à « retirer », il faut l'enregistrer.
    expect(within(fenetre).getByTestId('blog-blocages')).not.toHaveTextContent('retirez-les');
    expect(within(fenetre).getByTestId('blog-blocages')).toHaveTextContent('Texte modifié : enregistrez-le, puis relancez le contrôle IA.');

    // 4. « Enregistrer et relancer le contrôle IA » : le brouillon, puis le contrôle.
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Relecture/ }));
    const relancerEnfin = within(fenetre).getByTestId('blog-relancer-controle');
    expect(relancerEnfin).not.toHaveAttribute('aria-disabled');
    expect(relancerEnfin).toHaveTextContent('Enregistrer et relancer le contrôle IA');
    await fireEvent.click(relancerEnfin);
    await waitFor(() => expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent(/Contrôle IA terminé à/));
    const enregistrement = appels('PUT /blog/1')[0] as { is_published: boolean; bot_analysis: { citations: Record<string, unknown>[] } };
    expect(enregistrement.is_published).toBe(false);
    expect(enregistrement.bot_analysis.citations).toEqual([
      expect.objectContaining({ law_id: 2236, article_number: '299', title: 'Entrer chez autrui contre son gré est puni de dix jours à un an d’emprisonnement.' }),
    ]);
    expect(etapes(fenetre)).toEqual(['sources:faite', 'citations:faite', 'controle:faite', 'relecture:en_cours', 'publication:a_venir']);
    // Les verdicts, titre compris, et les cases désormais ouvertes.
    expect(within(within(fenetre).getByTestId('blog-partie-titre')).getByTestId('blog-verdict')).toHaveTextContent('Soutenue par l’extrait 1');
    expect(within(fenetre).queryByTestId('blog-relecture-attend')).toBeNull();
    expect(within(fenetre).getByTestId('blog-case-titre')).not.toBeDisabled();

    // 5. Relire les sept parties, puis publier : un seul PUT.
    await toutRelire(fenetre);
    expect(etapes(fenetre).at(-1)).toBe('publication:en_cours');
    expect(within(fenetre).getByTestId('blog-etape-publication')).toHaveTextContent('Rien n’empêche plus de publier');
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(ecran.queryByRole('dialog')).toBeNull());
    expect(serveur.envois.map((e) => `${e.methode} ${e.chemin}`)).toEqual([
      'GET /blog/admin/all',
      'POST /blog/1/sources',
      'PUT /blog/1',
      'POST /blog/1/controle',
      'PUT /blog/1',
    ]);
    expect(serveur.envois.at(-1)!.corps).toMatchObject({
      is_published: true,
      relecture: { parties: { titre: true, contexte: true, resume: true, points_cles: true, impact: true, explications: true, question: true } },
    });
    expect(serveur.article()).toMatchObject({ isPublished: true, etat_publication: 'publiable' });
    // Aucune citation écrite par le modèle n'a survécu.
    const publiees = ((serveur.article().botAnalysis as { citations: { verifie: boolean }[] }).citations);
    expect(publiees.every((c) => c.verifie === true)).toBe(true);
    expect(ecran.getByTestId('blog-avis')).toHaveTextContent('est publié sur /blog');
    const ligne = ecran.container.querySelector('#titre-article-1')!.closest('li')!;
    expect(ligne).toHaveTextContent('Publié');
    expect(within(ligne).queryByTestId('blog-a-reprendre')).toBeNull();
  });

  it('une saisie en cours : « Enregistrer et reconstruire les sources » enregistre d’abord le brouillon', async () => {
    const serveur = brancherLeServeur(A_REPRENDRE);
    const ecran = render(Page);
    await ecran.findByText(A_REPRENDRE.title, { selector: 'h3' });
    await fireEvent.click(ecran.getByRole('button', { name: 'Modifier' }));
    const fenetre = ecran.getByRole('dialog');
    // Le contexte guide la recherche : l'administrateur le précise d'abord.
    await fireEvent.input(within(fenetre).getByLabelText(/^Contexte/), {
      target: { value: 'Un bailleur de Douala coupe l’eau d’un locataire en retard de loyer.' },
    });
    const reconstruire = within(fenetre).getByTestId('blog-reconstruire-sources');
    expect(reconstruire).toHaveTextContent('Enregistrer et reconstruire les sources');
    await fireEvent.click(reconstruire);
    await waitFor(() => expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent(/Sources reconstruites/));
    expect(serveur.envois.filter((e) => e.methode !== 'GET').map((e) => `${e.methode} ${e.chemin}`)).toEqual(['PUT /blog/1', 'POST /blog/1/sources']);
    expect(appels('PUT /blog/1')[0]).toMatchObject({ context: 'Un bailleur de Douala coupe l’eau d’un locataire en retard de loyer.', is_published: false });
    // Le formulaire repart de l'article reconstruit : sans les citations retirées.
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Édition/ }));
    expect(within(fenetre).queryAllByTestId('blog-citation')).toHaveLength(0);
    expect(within(fenetre).getByLabelText(/^Contexte/)).toHaveValue('Un bailleur de Douala coupe l’eau d’un locataire en retard de loyer.');
  });

  it('aucun texte ne couvre le sujet (422 sans_source) : dit, rien de perdu, l’article relu', async () => {
    brancherLeServeur(A_REPRENDRE, { sourcesReconstruites: [] });
    const ecran = render(Page);
    await ecran.findByText(A_REPRENDRE.title, { selector: 'h3' });
    await fireEvent.click(ecran.getByRole('button', { name: 'Modifier' }));
    const fenetre = ecran.getByRole('dialog');
    await fireEvent.click(within(fenetre).getByTestId('blog-reconstruire-sources'));
    const alerte = await within(fenetre).findByRole('alert');
    expect(alerte).toHaveTextContent('Aucun texte publié dans JuriX ne couvre clairement le sujet de cet article');
    expect(alerte).toHaveTextContent('précisez-les dans la vue Édition, enregistrez, puis réessayez.');
    await waitFor(() => expect(appels('GET /blog/admin/1')).toHaveLength(1));
    // Toujours à la première étape, les deux citations là.
    expect(etapes(fenetre)[0]).toBe('sources:en_cours');
    expect(within(fenetre).getAllByTestId('blog-citation')).toHaveLength(2);
  });

  it('pendant la reconstruction : une attente qui se voit, tout est figé', async () => {
    brancherLeServeur(A_REPRENDRE);
    const reponse = differe();
    routes['POST /blog/1/sources'] = () => reponse.promesse;
    const ecran = render(Page);
    await ecran.findByText(A_REPRENDRE.title, { selector: 'h3' });
    await fireEvent.click(ecran.getByRole('button', { name: 'Modifier' }));
    const fenetre = ecran.getByRole('dialog');
    const reconstruire = within(fenetre).getByTestId('blog-reconstruire-sources');
    await fireEvent.click(reconstruire);
    expect(reconstruire).toHaveTextContent(/Recherche des sources…\s*0:00/);
    expect(reconstruire).toHaveAttribute('aria-disabled', 'true');
    expect(within(fenetre).getByTestId('blog-edition')).toBeDisabled();
    expect(within(fenetre).getByRole('button', { name: 'Enregistrer le brouillon' })).toHaveAttribute('aria-disabled', 'true');
    // Un second appui n'envoie rien.
    await fireEvent.click(reconstruire);
    expect(appels('POST /blog/1/sources')).toHaveLength(1);
    reponse.resoudre(json({ ...A_REPRENDRE, sources: SOURCES, botAnalysis: { ...A_REPRENDRE.botAnalysis, citations: [] } }));
    // La forme « article seul » est lue aussi.
    await waitFor(() => expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent(/Sources reconstruites/));
    expect(within(fenetre).getByTestId('blog-edition')).not.toBeDisabled();
  });

  it('un contrôle refusé faute d’extrait : la phrase du front, puis ce que dit le serveur', async () => {
    brancherLeServeur(BROUILLON);
    routes['POST /blog/12/controle'] = () =>
      json({ detail: 'Citez au moins un article de la base, puis relancez le contrôle.', code: 'sans_source' }, 422);
    const { fenetre } = await ouvrir(BROUILLON);
    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
    const alerte = await within(fenetre).findByRole('alert');
    expect(alerte).toHaveTextContent('Aucun extrait de la base à comparer au texte');
    expect(alerte).toHaveTextContent('Le serveur précise : « Citez au moins un article de la base, puis relancez le contrôle. »');
  });
});

describe('l’API écrite du tour 4 : une case atteste les verdicts de sa partie, une partie vide est relue', () => {
  it('cochée avant un contrôle qui juge autrement sa partie, elle ne compte plus ; les mêmes verdicts gardent les autres', async () => {
    const serveur = brancherLeServeur(BROUILLON, {
      phrasesDuControle: () =>
        PHRASES.map((p) =>
          p.partie === 'titre'
            ? { ...p, verdict: 'non_soutenue', extraits: [], raison: 'À vérifier : le contrôle la disait soutenue, sans pouvoir copier un passage des extraits qui le dise.' }
            : p,
        ),
    });
    const { fenetre } = await ouvrir(BROUILLON);
    await fireEvent.click(within(fenetre).getByTestId('blog-case-titre'));
    await fireEvent.click(within(fenetre).getByTestId('blog-case-contexte'));
    // Les cases cochées sont une saisie : « Enregistrer et relancer ».
    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
    await waitFor(() => expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent(/Contrôle IA terminé à/));
    expect(appels('PUT /blog/12')[0]).toMatchObject({ relecture: { parties: { titre: true, contexte: true, resume: false } }, is_published: false });
    // Le titre a un nouveau verdict : sa case tombe, côté serveur comme à l'écran.
    expect(serveur.article().relecture).toMatchObject({ parties: { titre: false, contexte: true } });
    expect(within(fenetre).getByTestId('blog-case-titre')).not.toBeChecked();
    // Le titre énonce une règle : « Règle à vérifier », à confirmer (tour 7).
    expect(within(within(fenetre).getByTestId('blog-partie-titre')).getByTestId('blog-verdict')).toHaveTextContent('Règle à vérifier');
    expect(within(fenetre).getByTestId('blog-case-contexte')).toBeChecked();
    expect(within(fenetre).getByTestId('blog-progression')).toHaveTextContent('Parties relues : 1 sur 7');
  });

  it('article en ligne, une saisie en cours : après le contrôle, ses cases sont celles que le serveur compte encore', async () => {
    // Sans quoi « Publier » renvoyait la case de l'impact, cochée avant ce
    // contrôle, et le serveur l'aurait prise pour la relecture du nouveau verdict.
    const serveur = brancherLeServeur(PUBLIE, {
      phrasesDuControle: (article) =>
        ((article.controle_ia as { phrases: Record<string, unknown>[] }).phrases).map((p) =>
          p.partie === 'impact' ? { ...p, verdict: 'soutenue', extraits: [3], raison: 'Conforme à l’extrait 3.' } : p,
        ),
    });
    // En ligne : le contrôle se confirme (avenant du tour 5).
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { fenetre } = await ouvrir(PUBLIE, 'Édition');
    await fireEvent.input(within(fenetre).getByLabelText(/^Rubrique/), { target: { value: 'Logement' } });
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Relecture/ }));
    // En ligne : le contrôle part sans enregistrer (l'enregistrer le retirerait du site).
    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
    await waitFor(() => expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent(/Contrôle IA terminé à/));
    expect(confirmer).toHaveBeenCalledTimes(1);
    expect(appels('POST /blog/13/controle')).toEqual([{ confirmer: true }]);
    expect(appels('PUT /blog/13')).toHaveLength(0);
    // Un verdict a changé : l'article a quitté le public, la fenêtre le dit.
    expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent('Des verdicts ont changé : l’article est caché du public');
    expect(within(fenetre).getByTestId('blog-a-relire')).toHaveTextContent('À relire de nouveau : Impact citoyen.');
    expect(within(fenetre).getByTestId('blog-a-relire-impact')).toBeInTheDocument();
    expect(within(fenetre).getByTestId('blog-case-impact')).not.toBeChecked();
    expect(within(fenetre).getByTestId('blog-case-contexte')).toBeChecked();
    expect(within(fenetre).getByTestId('blog-blocages')).toHaveTextContent('Relecture incomplète : 6 partie(s) relue(s) sur 7.');
    const publier = within(fenetre).getByRole('button', { name: 'Publier' });
    expect(publier).toHaveAttribute('aria-disabled', 'true');
    // La saisie en cours est restée.
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Édition/ }));
    expect(within(fenetre).getByLabelText(/^Rubrique/)).toHaveValue('Logement');

    // Relu avec son nouveau verdict, l'impact se coche ; un seul PUT publie le
    // tout, contre le contrôle qui vient d'être fait.
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Relecture/ }));
    await fireEvent.click(within(fenetre).getByTestId('blog-case-impact'));
    expect(within(fenetre).queryByTestId('blog-a-relire')).toBeNull();
    expect(publier).not.toHaveAttribute('aria-disabled');
    await fireEvent.click(publier);
    await waitFor(() => expect(appels('PUT /blog/13')).toHaveLength(1));
    expect(appels('PUT /blog/13')[0]).toMatchObject({
      category: 'Logement',
      relecture: { parties: { impact: true }, controle: '2026-10-30T10:10:00+00:00' },
      is_published: true,
    });
    await waitFor(() => expect(serveur.article()).toMatchObject({ isPublished: true, etat_publication: 'publiable', category: 'Logement' }));
  });

  it('une partie vide n’a rien à relire : sans case, comptée relue, et l’article se publie', async () => {
    const sansQuestion = avecLeControleAJour({
      ...BROUILLON,
      suggestedQuestion: '',
      controle_ia: { ...BROUILLON.controle_ia, phrases: PHRASES.filter((p) => p.partie !== 'question') },
    });
    const serveur = brancherLeServeur(sansQuestion);
    const { fenetre } = await ouvrir(sansQuestion);
    // Le serveur la rend relue, comme l'API (« une partie vide n'a rien à relire »).
    expect(serveur.article().relecture).toMatchObject({ parties: { question: true, titre: false } });
    const question = within(fenetre).getByTestId('blog-partie-question');
    expect(question).toHaveTextContent('Vide.');
    expect(within(question).getByTestId('blog-rien-a-relire-question')).toHaveTextContent('Partie vide : rien à relire.');
    expect(within(question).queryByTestId('blog-case-question')).toBeNull();
    expect(question).not.toHaveTextContent('Non contrôlé');
    expect(within(fenetre).getByTestId('blog-progression')).toHaveTextContent('Parties relues : 1 sur 7');
    for (const partie of PARTIES.filter((p) => p !== 'question')) await fireEvent.click(within(fenetre).getByTestId(`blog-case-${partie}`));
    expect(within(fenetre).getByTestId('blog-progression')).toHaveTextContent('Parties relues : 7 sur 7');
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(serveur.article()).toMatchObject({ isPublished: true, etat_publication: 'publiable' }));
  });

  it('« Soutenue par les extraits 3 et 2 » : l’ordre du serveur, l’extrait du passage retrouvé d’abord', async () => {
    const article = {
      ...BROUILLON,
      controle_ia: { ...BROUILLON.controle_ia, phrases: PHRASES.map((p) => (p.id === 'p3' ? { ...p, extraits: [3, 2] } : p)) },
    };
    brancherLeServeur(article);
    const { fenetre } = await ouvrir(article);
    const verdict = within(within(fenetre).getByTestId('blog-partie-points_cles')).getByTestId('blog-verdict');
    expect(verdict).toHaveTextContent('Soutenue par les extraits 3 et 2');
    expect(within(verdict).getAllByRole('button').map((b) => b.textContent)).toEqual(['3', '2']);
  });

  it('contrôle d’un article sans sources (422 sources_absentes) : « pas lancé, reconstruisez-les », jamais « Publication refusée »', async () => {
    brancherLeServeur(BROUILLON);
    routes['POST /blog/12/controle'] = () =>
      json(
        {
          detail:
            "L'article n'a pas de sources enregistrées (article d'avant le contrôle IA, ou écrit à la main) : rien contre quoi juger ses phrases. Reconstruisez d'abord ses sources, citez des articles parmi elles, puis relancez le contrôle.",
          code: 'sources_absentes',
        },
        422,
      );
    const { fenetre } = await ouvrir(BROUILLON);
    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
    const alerte = await within(fenetre).findByRole('alert');
    expect(alerte).toHaveTextContent('Le contrôle IA n’a pas été lancé : l’article n’a pas de sources enregistrées');
    expect(alerte).toHaveTextContent('Reconstruisez-les d’abord');
    expect(alerte).not.toHaveTextContent('Publication refusée');
    // L'article est relu : le serveur fait foi.
    await waitFor(() => expect(appels('GET /blog/admin/12')).toHaveLength(1));
  });
});

describe('ce que seule la génération a relevé survit à l’enregistrement', () => {
  it('le point reste dans la fenêtre après l’enregistrement', async () => {
    const plusieursArticles = 'Citation de l’extrait 3 : ce passage de la base, rangé sous l’article 35, porte aussi l’en-tête de l’article 39.';
    routes['GET /blog/admin/all'] = () => json([]);
    routes['POST /blog/generate'] = () => json({ post: BROUILLON, sources: [], avertissements: [plusieursArticles] }, 201);
    // Le serveur recalcule les avertissements de l'article : sans ceux de la génération.
    routes['PUT /blog/12'] = () => json({ ...BROUILLON, avertissements: [] });
    const ecran = render(Page);
    const sujet = await ouvrirLePanneau();
    await fireEvent.input(sujet, { target: { value: 'Licenciement abusif' } });
    await fireEvent.click(ecran.getByRole('button', { name: /Générer le brouillon/ }));
    const fenetre = await ecran.findByRole('dialog');
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Édition/ }));
    await fireEvent.input(within(fenetre).getByLabelText(/^Titre/), { target: { value: 'Licenciement abusif : les recours' } });
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Enregistrer le brouillon' }));
    // Enregistré : la réponse (sans les avertissements de la génération) a remplacé l'article.
    expect(await within(fenetre).findByText(/Enregistré à/)).toBeInTheDocument();
    expect(appels('PUT /blog/12')).toHaveLength(1);
    expect(within(fenetre).getByTestId('blog-points-a-verifier')).toHaveTextContent(`Relevé à la génération — ${plusieursArticles}`);
  });
});

/* -------------------------------------------------------------------------- */
/* Avenant du tour 5 : la relecture liée au contrôle relu                      */
/* -------------------------------------------------------------------------- */

describe('avenant du tour 5 : une case cochée nomme le contrôle relu, et un autre contrôle refait les cases', () => {
  /** Le contexte jugé « À vérifier » par un contrôle relancé ailleurs ; les autres phrases, telles quelles. */
  const CONTEXTE_A_VERIFIER = (article: Record<string, unknown>) =>
    ((article.controle_ia as { phrases: Record<string, unknown>[] } | null)?.phrases ?? PHRASES).map((p) =>
      p.partie === 'contexte'
        ? { ...p, verdict: 'non_soutenue', extraits: [], raison: 'À vérifier : le contrôle la disait soutenue, sans pouvoir copier un passage des extraits qui le dise.' }
        : p,
    );
  const TOUT_RELU = { parties: Object.fromEntries(PARTIES.map((p) => [p, true])) };
  const faitLe = (article: Record<string, unknown>) => (article.controle_ia as { fait_le: string }).fait_le;

  it('deux onglets, cases non enregistrées : « Publier » refusé (422 relecture_perimee), rien de publié, les parties à relire dites', async () => {
    // Revue du tour 4 : l'onglet A publiait, en un seul PUT, des verdicts
    // relancés dans l'onglet B que personne n'avait lus.
    const serveur = brancherLeServeur(BROUILLON, { phrasesDuControle: CONTEXTE_A_VERIFIER });
    const { fenetre } = await ouvrir(BROUILLON);
    await toutRelire(fenetre);
    // L'onglet B relance le contrôle : le contexte devient « À vérifier ».
    const nouveau = faitLe(serveur.repondre('POST', '/blog/12/controle').corps as Record<string, unknown>);
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Publier' }));
    const alerte = await within(fenetre).findByRole('alert');
    await waitFor(() => expect(alerte).toHaveTextContent('Rien n’a été enregistré : le contrôle IA a été relancé depuis votre lecture'));
    // Le PUT nommait le contrôle affiché, l'ancien : refusé, rien d'appliqué.
    expect(appels('PUT /blog/12')).toHaveLength(1);
    expect(appels('PUT /blog/12')[0]).toMatchObject({ relecture: { controle: BROUILLON.controle_ia.fait_le }, is_published: true });
    expect(serveur.article()).toMatchObject({ isPublished: false, etat_publication: 'relecture_incomplete' });
    // Relu : le nouveau contrôle, et aucune case que le serveur ne compte
    // (elles n'étaient pas enregistrées) ; l'erreur nomme les parties.
    await waitFor(() => expect(alerte).toHaveTextContent('À relire de nouveau : toutes les parties.'));
    expect(appels('GET /blog/admin/12')).toHaveLength(1);
    for (const partie of PARTIES) expect(within(fenetre).getByTestId(`blog-case-${partie}`)).not.toBeChecked();
    expect(within(fenetre).getByTestId('blog-a-relire')).toHaveTextContent('Parties à relire de nouveau (7)');
    expect(within(fenetre).getByTestId('blog-a-relire')).toHaveTextContent('À relire de nouveau : Titre, Contexte, Analyse juridique (résumé)');
    expect(within(within(fenetre).getByTestId('blog-partie-contexte')).getByTestId('blog-verdict')).toHaveTextContent('À vérifier');
    const publier = within(fenetre).getByRole('button', { name: 'Publier' });
    expect(publier).toHaveAttribute('aria-disabled', 'true');
    // Relues contre les nouveaux verdicts : publié, contre le nouveau contrôle.
    await toutRelire(fenetre);
    expect(within(fenetre).queryByTestId('blog-a-relire')).toBeNull();
    await fireEvent.click(publier);
    await waitFor(() => expect(serveur.article()).toMatchObject({ isPublished: true, etat_publication: 'publiable' }));
    expect(appels('PUT /blog/12')[1]).toMatchObject({ relecture: { controle: nouveau }, is_published: true });
  });

  it('deux onglets, cases enregistrées : le refus (relecture incomplète) relit l’article, et seule la partie au verdict changé est à relire', async () => {
    // Revue du tour 4 (b) : après le refus, relire() gardait la case du
    // contexte cochée, et un second clic republiait l'article.
    const serveur = brancherLeServeur(BROUILLON, { phrasesDuControle: CONTEXTE_A_VERIFIER });
    serveur.repondre('PUT', '/blog/12', { relecture: { ...TOUT_RELU, controle: faitLe(BROUILLON) } });
    const { fenetre } = await ouvrir(BROUILLON);
    expect(within(fenetre).getByTestId('blog-progression')).toHaveTextContent('Parties relues : 7 sur 7');
    serveur.repondre('POST', '/blog/12/controle');
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Publier' }));
    const alerte = await within(fenetre).findByRole('alert');
    expect(alerte).toHaveTextContent("Publication refusée par le serveur : la relecture n'est pas complète");
    // Les cases n'avaient pas changé : elles ne partaient pas, ni le contrôle.
    expect(appels('PUT /blog/12')[0]).not.toHaveProperty('relecture');
    await waitFor(() => expect(within(fenetre).getByTestId('blog-a-relire')).toHaveTextContent('À relire de nouveau : Contexte.'));
    expect(within(fenetre).getByTestId('blog-case-contexte')).not.toBeChecked();
    expect(within(fenetre).getByTestId('blog-case-titre')).toBeChecked();
    expect(within(fenetre).getByTestId('blog-a-relire-contexte')).toHaveTextContent('À relire de nouveau');
    expect(within(fenetre).getByTestId('blog-case-contexte')).toHaveAccessibleDescription(/Contexte\s+À relire de nouveau/);
    // Un second appui ne republie rien.
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Publier' }));
    expect(appels('PUT /blog/12')).toHaveLength(1);
    expect(serveur.article().isPublished).toBe(false);
  });

  it('la réponse du contrôle perdue (article en ligne, rubrique modifiée) : la relecture trouve le contrôle enregistré et refait les cases', async () => {
    // Revue du tour 4 (a) : le serveur avait enregistré un contrôle qui juge le
    // contexte « À vérifier » ; la fenêtre gardait sa case cochée, « Publier »
    // était actif, et l'article revenait en ligne sans que personne l'ait lu.
    const serveur = brancherLeServeur(PUBLIE, { phrasesDuControle: CONTEXTE_A_VERIFIER });
    routes['POST /blog/13/controle'] = (init) => {
      serveur.repondre('POST', '/blog/13/controle', JSON.parse(String(init!.body)));
      return Promise.reject(new TypeError('Failed to fetch'));
    };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { fenetre } = await ouvrir(PUBLIE, 'Édition');
    await fireEvent.input(within(fenetre).getByLabelText(/^Rubrique/), { target: { value: 'Logement' } });
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Relecture/ }));
    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
    await waitFor(() => expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent('La réponse du contrôle IA s’est perdue en route, mais le serveur l’a enregistré'));
    expect(within(fenetre).queryByRole('alert')).toBeNull();
    expect(within(fenetre).getByTestId('blog-case-contexte')).not.toBeChecked();
    expect(within(fenetre).getByTestId('blog-a-relire')).toHaveTextContent('À relire de nouveau : Contexte.');
    const publier = within(fenetre).getByRole('button', { name: 'Publier' });
    expect(publier).toHaveAttribute('aria-disabled', 'true');
    await fireEvent.click(publier);
    expect(appels('PUT /blog/13')).toHaveLength(0);
    // La saisie est restée ; relu, le contexte se coche, et tout part contre le contrôle enregistré.
    await fireEvent.click(within(fenetre).getByTestId('blog-case-contexte'));
    await fireEvent.click(publier);
    await waitFor(() => expect(serveur.article()).toMatchObject({ isPublished: true, etat_publication: 'publiable', category: 'Logement' }));
    expect(appels('PUT /blog/13')[0]).toMatchObject({ relecture: { parties: { contexte: true }, controle: '2026-10-30T10:10:00+00:00' } });
  });

  it('un article en ligne : la confirmation dit qu’il peut quitter le site ; refusée, rien ne part', async () => {
    brancherLeServeur(PUBLIE);
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { fenetre } = await ouvrir(PUBLIE);
    const relancer = within(fenetre).getByTestId('blog-relancer-controle');
    // Dit avant l'appui.
    expect(relancer).toHaveAccessibleDescription(/Article en ligne\s:\ssi le contrôle change un verdict, l’article quitte le site/);
    await fireEvent.click(relancer);
    expect(confirmer).toHaveBeenCalledWith(expect.stringMatching(/^Cet article est en ligne\. .*l’article quittera le site jusqu’à ce qu’elle le soit/));
    expect(appels('POST /blog/13/controle')).toHaveLength(0);
    expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent('Contrôle IA non relancé : l’article reste tel quel.');
  });

  it('publié ailleurs entre-temps (409 article_en_ligne) : dit, l’article relu, et le prochain appui demande confirmation', async () => {
    const serveur = brancherLeServeur(BROUILLON);
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { fenetre } = await ouvrir(BROUILLON);
    // Un autre onglet le relit et le publie.
    serveur.repondre('PUT', '/blog/12', { relecture: { ...TOUT_RELU, controle: faitLe(BROUILLON) }, is_published: true });
    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
    const alerte = await within(fenetre).findByRole('alert');
    expect(alerte).toHaveTextContent('Le contrôle IA n’a pas été relancé : l’article a été publié entre-temps.');
    expect(appels('POST /blog/12/controle')).toEqual([undefined]);
    expect(confirmer).not.toHaveBeenCalled();
    await waitFor(() => expect(within(fenetre).getByRole('button', { name: 'Retirer du site' })).toBeInTheDocument());
    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
    await waitFor(() => expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent(/Contrôle IA terminé à/));
    expect(confirmer).toHaveBeenCalledTimes(1);
    expect(appels('POST /blog/12/controle')).toEqual([undefined, { confirmer: true }]);
  });

  it('« Retirer du site » qui ramène un autre contrôle : les cases refaites, la partie à relire dite', async () => {
    const serveur = brancherLeServeur(PUBLIE, { phrasesDuControle: CONTEXTE_A_VERIFIER });
    const { fenetre } = await ouvrir(PUBLIE, 'Édition');
    await fireEvent.input(within(fenetre).getByLabelText(/^Analyse juridique/), { target: { value: 'Le bailleur doit saisir le juge.' } });
    // Relancé ailleurs pendant la saisie.
    serveur.repondre('POST', '/blog/13/controle', { confirmer: true });
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Retirer du site' }));
    await waitFor(() => expect(serveur.article().isPublished).toBe(false));
    expect(appels('PUT /blog/13')).toEqual([{ is_published: false }]);
    expect(within(fenetre).getByLabelText(/^Analyse juridique/)).toHaveValue('Le bailleur doit saisir le juge.');
    expect(within(fenetre).getByTestId('blog-a-relire')).toHaveTextContent('À relire de nouveau : Contexte.');
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Relecture/ }));
    expect(within(fenetre).getByTestId('blog-case-contexte')).not.toBeChecked();
    expect(within(fenetre).getByTestId('blog-case-titre')).toBeChecked();
  });

  it('la raison d’un verdict : la raison du modèle, puis le passage retrouvé en citation, son extrait cliquable ; « À vérifier » une fois', async () => {
    brancherLeServeur(BROUILLON);
    const { fenetre } = await ouvrir(BROUILLON);
    const resume = within(fenetre).getByTestId('blog-partie-resume');
    await fireEvent.click(within(resume).getByRole('button', { name: /^Pourquoi\s\?$/ }));
    const raison = resume.querySelector('[id^="raison-"]') as HTMLElement;
    expect(raison).toBeVisible();
    expect(within(raison).getByText('L’extrait 3 confie la résiliation et l’expulsion à la juridiction compétente.')).toBeInTheDocument();
    const [passage] = within(raison).getAllByTestId('blog-passage-cite');
    expect(passage.querySelector('blockquote')).toHaveTextContent(
      '« La juridiction compétente statuant à bref délai est saisie de la demande en résiliation du bail et d’expulsion du preneur. »',
    );
    await fireEvent.click(within(passage).getByRole('button', { name: 'Afficher l’extrait 3' }));
    await waitFor(() => expect(document.activeElement?.id).toBe('source-3'));
    // Rétrogradé faute de passage réel : « À vérifier » au badge, pas deux fois.
    const impact = within(fenetre).getByTestId('blog-partie-impact');
    await fireEvent.click(within(impact).getByRole('button', { name: /^Pourquoi\s\?$/ }));
    const raisonImpact = impact.querySelector('[id^="raison-"]') as HTMLElement;
    expect(raisonImpact).toHaveTextContent(/^Le contrôle la disait soutenue/);
    expect(impact.textContent!.match(/À vérifier/g)).toHaveLength(1);
  });

  it('un passage que son extrait ne porte pas ne s’affiche jamais comme le texte de cet extrait (défaut D1)', async () => {
    const invente = 'Conforme. — Extrait 3 : « la juridiction peut expulser sans jugement »';
    const article = {
      ...BROUILLON,
      controle_ia: { ...BROUILLON.controle_ia, phrases: PHRASES.map((p) => (p.id === 'p2' ? { ...p, raison: invente } : p)) },
    };
    brancherLeServeur(article);
    const { fenetre } = await ouvrir(article);
    const resume = within(fenetre).getByTestId('blog-partie-resume');
    await fireEvent.click(within(resume).getByRole('button', { name: /^Pourquoi\s\?$/ }));
    const raison = resume.querySelector('[id^="raison-"]') as HTMLElement;
    expect(within(raison).queryAllByTestId('blog-passage-cite')).toHaveLength(0);
    expect(raison).toHaveTextContent(invente);
  });

  it('un contrôle refusé faute de place (422 entree_invalide) : « pas lancé », la raison du serveur', async () => {
    brancherLeServeur(BROUILLON);
    routes['POST /blog/12/controle'] = () =>
      json({ detail: 'L’article compte 35 phrases, 25 au plus pour le contrôle IA : raccourcissez-le, puis relancez le contrôle.', code: 'entree_invalide' }, 422);
    const { fenetre } = await ouvrir(BROUILLON);
    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
    const alerte = await within(fenetre).findByRole('alert');
    expect(alerte).toHaveTextContent('Le contrôle IA n’a pas été lancé : L’article compte 35 phrases, 25 au plus pour le contrôle IA : raccourcissez-le');
    expect(alerte).not.toHaveTextContent('Saisie refusée');
  });
});

describe('un article caché par un contrôle ne revient pas en ligne au contrôle suivant (revue du front du tour 5)', () => {
  // Reproduit par l'interface contre la vraie API (data/blog/tour5/revue-front,
  // retour-en-ligne*.test.ts) : le contrôle Y cachait l'article (contexte
  // contredit ou « À vérifier »), le contrôle Z redonnait les verdicts de X à
  // la température 0, la case du contexte cochée contre X revivait, et
  // l'article revenait en ligne sans relecture ni « Publier », la fenêtre ne
  // disant que « Contrôle IA terminé ».
  const X = (PUBLIE.controle_ia as { phrases: Record<string, unknown>[] }).phrases;
  const contexte = (verdict: string) =>
    X.map((p) =>
      p.partie === 'contexte'
        ? { ...p, verdict, extraits: verdict === 'contredite' ? [3] : [], raison: 'L’extrait 3 dit le contraire.' }
        : p,
    );

  for (const verdictDeY of ['contredite', 'non_soutenue']) {
    it(`Y « ${verdictDeY} », Z comme X : caché, la partie toujours à relire, et la fenêtre le dit ; relue, « Publier » le remet en ligne`, async () => {
      let prochain = contexte(verdictDeY);
      const serveur = brancherLeServeur(PUBLIE, { phrasesDuControle: () => prochain });
      const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { fenetre } = await ouvrir(PUBLIE);
      const statut = () => within(fenetre).getByTestId('blog-fenetre-statut');

      await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
      await waitFor(() => expect(statut()).toHaveTextContent('Des verdicts ont changé : l’article est caché du public'));
      expect(within(fenetre).getByTestId('blog-a-relire')).toHaveTextContent('À relire de nouveau : Contexte.');

      // Z, sans rien cocher ni publier.
      prochain = X;
      await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
      await waitFor(() => expect(appels('POST /blog/13/controle')).toHaveLength(2));
      await waitFor(() => expect(statut()).toHaveTextContent('L’article reste caché du public jusqu’à ce que les parties à relire le soient'));
      expect(confirmer).toHaveBeenLastCalledWith(expect.stringMatching(/celles déjà à relire le restent, même si le contrôle les juge comme avant/));
      expect(appels('PUT /blog/13')).toHaveLength(0);
      // Le serveur n'a pas fait revivre la case : caché, à relire.
      expect(serveur.article()).toMatchObject({ isPublished: true, etat_publication: 'relecture_incomplete' });
      expect((serveur.article().relecture as { parties: Record<string, boolean> }).parties.contexte).toBe(false);
      expect(within(fenetre).getByTestId('blog-a-relire')).toHaveTextContent('À relire de nouveau : Contexte.');
      expect(within(fenetre).getByTestId('blog-case-contexte')).not.toBeChecked();
      expect(within(fenetre).queryByRole('button', { name: 'Retirer du site' })).toBeNull();
      const publier = within(fenetre).getByRole('button', { name: 'Publier' });
      expect(publier).toHaveAttribute('aria-disabled', 'true');

      // Relue par une personne, contre Z : « Publier » la remet en ligne, en un PUT.
      await fireEvent.click(within(fenetre).getByTestId('blog-case-contexte'));
      expect(within(fenetre).queryByTestId('blog-a-relire')).toBeNull();
      await fireEvent.click(publier);
      await waitFor(() => expect(serveur.article()).toMatchObject({ isPublished: true, etat_publication: 'publiable' }));
      expect(appels('PUT /blog/13')).toEqual([
        expect.objectContaining({ relecture: { parties: expect.objectContaining({ contexte: true }), controle: '2026-10-30T10:11:00+00:00' }, is_published: true }),
      ]);
    });
  }

  it('un serveur qui ferait revivre la case (l’API d’avant ce correctif) : la partie reste à relire, et le retour en ligne est dit', async () => {
    const enregistreLe = (PUBLIE.controle_ia as { fait_le: string }).fait_le;
    const tout = Object.fromEntries(PARTIES.map((p) => [p, true]));
    const apresY = {
      ...PUBLIE,
      controle_ia: { ...PUBLIE.controle_ia, fait_le: '2026-11-04T16:25:27+00:00', phrases: contexte('non_soutenue') },
      relecture: { par: 'admin@jurix.cm', le: '2026-10-30T09:40:00+00:00', controle: enregistreLe, parties: { ...tout, contexte: false } },
      etat_publication: 'relecture_incomplete',
    };
    // Z redonne les verdicts de X : la case cochée contre X revit, l'article redevient publiable.
    const apresZ = {
      ...apresY,
      controle_ia: { ...PUBLIE.controle_ia, fait_le: '2026-11-04T16:25:28+00:00' },
      relecture: { ...apresY.relecture, parties: tout },
      etat_publication: 'publiable',
    };
    const reponses = [apresY, apresZ];
    routes['GET /blog/admin/all'] = () => json([PUBLIE]);
    routes['POST /blog/13/controle'] = () => json(reponses.shift());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { fenetre } = await ouvrir(PUBLIE);
    const statut = () => within(fenetre).getByTestId('blog-fenetre-statut');

    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
    await waitFor(() => expect(statut()).toHaveTextContent('Des verdicts ont changé'));
    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
    await waitFor(() => expect(statut()).toHaveTextContent('L’article est de nouveau en ligne : le public le lit. Retirez-le du site si une partie reste à relire.'));

    expect(within(fenetre).getByTestId('blog-a-relire')).toHaveTextContent('À relire de nouveau : Contexte.');
    expect(within(fenetre).getByTestId('blog-case-contexte')).not.toBeChecked();
    expect(within(fenetre).getByTestId('blog-blocages')).toHaveTextContent('Relecture incomplète : 6 partie(s) relue(s) sur 7.');
    expect(within(fenetre).getByRole('button', { name: 'Publier les modifications' })).toHaveAttribute('aria-disabled', 'true');
    expect(within(fenetre).getByRole('button', { name: 'Retirer du site' })).toBeInTheDocument();
  });

  it('un contrôle qui le rend de nouveau lisible du public le dit, au lieu de « terminé » seul', async () => {
    // Publié et relu, mais son contrôle ne porte plus sur son texte (modifié hors
    // de l'API) : caché. Le contrôle neuf garde ses verdicts, donc ses cases.
    const perime = { ...PUBLIE, controle_ia: { ...PUBLIE.controle_ia, empreinte: 'un-autre-texte' } };
    const serveur = brancherLeServeur(perime);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { fenetre } = await ouvrir(perime);
    expect(within(fenetre).queryByRole('button', { name: 'Retirer du site' })).toBeNull();

    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));

    await waitFor(() =>
      expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent(/Contrôle IA terminé à .*L’article est de nouveau en ligne : le public le lit\./),
    );
    expect(serveur.article()).toMatchObject({ isPublished: true, etat_publication: 'publiable' });
    expect(within(fenetre).getByRole('button', { name: 'Retirer du site' })).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Avenant du tour 7 : « Confirmer phrase par phrase » (décision du 04/11)      */
/* -------------------------------------------------------------------------- */

describe('décision du 04/11 : une règle « À vérifier » ou « Hors des sources » se réécrit ou se confirme, une à une', () => {
  /** Le bail de l'essai réel : le résumé « À vérifier » et le point clé « Hors des sources », deux règles. */
  const AVEC_REGLES = avecLeControleAJour({ ...BROUILLON, controle_ia: { ...BROUILLON.controle_ia, phrases: PHRASES_A_CONFIRMER } });
  const FAIT_LE = BROUILLON.controle_ia.fait_le;
  const carte = (fenetre: HTMLElement, partie: string) => within(within(fenetre).getByTestId(`blog-partie-${partie}`)).getByTestId('blog-phrase');

  afterEach(() => switchLanguage('fr'));

  it('la phrase de règle : badge plein « Règle à vérifier », sa raison lisible d’emblée, et sa case de 44 px à côté', async () => {
    brancherLeServeur(AVEC_REGLES);
    const { fenetre } = await ouvrir(AVEC_REGLES);
    const resume = carte(fenetre, 'resume');
    expect(resume).toHaveAttribute('data-a-confirmer', 'true');
    const badge = within(resume).getByTestId('blog-verdict');
    expect(badge).toHaveTextContent('Règle à vérifier');
    // Jamais l'allure d'une simple remarque : plein, sans pointillé.
    expect(badge.className).toContain('bg-zinc-950');
    expect(badge.className).not.toContain('border-dashed');
    expect(resume.className).not.toContain('border-dashed');
    // La raison se lit sans « Pourquoi ? » : on confirme en connaissance de cause.
    const raison = within(resume).getByTestId('blog-raison');
    expect(raison).toBeVisible();
    expect(raison).toHaveTextContent('Raison du contrôle :');
    expect(raison).toHaveTextContent('introuvable tel quel dans les extraits');
    expect(within(resume).queryByRole('button', { name: 'Pourquoi ?' })).toBeNull();
    const caseDeLaPhrase = within(resume).getByRole('checkbox', { name: 'J’ai vérifié cette phrase dans le texte' });
    expect(caseDeLaPhrase).not.toBeChecked();
    expect(caseDeLaPhrase.closest('label')?.className).toContain('min-h-11');
    expect(caseDeLaPhrase.getAttribute('aria-describedby')?.split(' ')).toEqual(['verdict-p2', 'raison-p2', 'aide-confirmation-p2']);
    expect(within(resume).getByText(/énonce une règle de droit que le contrôle n’a pas retrouvée/)).toBeInTheDocument();
    // « Hors des sources » d'une règle : badge plein aussi, et sa case.
    const point = carte(fenetre, 'points_cles');
    expect(within(point).getByTestId('blog-verdict')).toHaveTextContent('Règle hors des sources');
    expect(within(point).getByRole('checkbox', { name: 'J’ai vérifié cette phrase dans le texte' })).toBeInTheDocument();
    // Un fait (contexte) ou un conseil (impact) ne prête rien au droit : sans case,
    // avec son badge d'avant (« Hors des sources », « À vérifier » en pointillé).
    for (const partie of ['contexte', 'impact']) {
      const autre = carte(fenetre, partie);
      expect(autre).not.toHaveAttribute('data-a-confirmer');
      expect(within(autre).queryByRole('checkbox')).toBeNull();
      expect(within(autre).getByTestId('blog-verdict').className).not.toContain('bg-zinc-950');
    }
    expect(within(carte(fenetre, 'contexte')).getByTestId('blog-verdict')).toHaveTextContent(/^Hors des sources$/);
    const conseil = within(carte(fenetre, 'impact')).getByTestId('blog-verdict');
    expect(conseil).toHaveTextContent(/^À vérifier$/);
    expect(conseil.className).toContain('border-dashed');
    expect(within(fenetre).getByTestId('blog-a-confirmer')).toHaveTextContent('Phrases de règle à confirmer : 0 confirmée(s) sur 2.');
  });

  it('sept parties relues ne suffisent pas : « N phrase(s) de règle à confirmer », puis un seul PUT les confirme et publie', async () => {
    const serveur = brancherLeServeur(AVEC_REGLES);
    const { fenetre } = await ouvrir(AVEC_REGLES);
    await toutRelire(fenetre);
    const publier = within(fenetre).getByRole('button', { name: 'Publier' });
    expect(within(fenetre).getByTestId('blog-blocages')).toHaveTextContent(
      '2 phrase(s) de règle à confirmer : cochez « J’ai vérifié cette phrase dans le texte » pour chacune (vue Relecture), ou réécrivez-la et relancez le contrôle IA.',
    );
    expect(publier).toHaveAttribute('aria-disabled', 'true');
    await fireEvent.click(publier);
    expect(appels('PUT /blog/12')).toHaveLength(0);

    await fireEvent.click(within(carte(fenetre, 'resume')).getByRole('checkbox', { name: 'J’ai vérifié cette phrase dans le texte' }));
    expect(within(fenetre).getByTestId('blog-blocages')).toHaveTextContent('1 phrase(s) de règle à confirmer');
    expect(within(fenetre).getByTestId('blog-a-confirmer')).toHaveTextContent('1 confirmée(s) sur 2');
    await fireEvent.click(within(carte(fenetre, 'points_cles')).getByRole('checkbox', { name: 'J’ai vérifié cette phrase dans le texte' }));
    expect(within(fenetre).queryByTestId('blog-blocages')).toBeNull();
    expect(publier).not.toHaveAttribute('aria-disabled');

    await fireEvent.click(publier);
    await waitFor(() => expect(serveur.article()).toMatchObject({ isPublished: true, etat_publication: 'publiable' }));
    expect(appels('PUT /blog/12')).toEqual([
      expect.objectContaining({
        relecture: { parties: Object.fromEntries(PARTIES.map((p) => [p, true])), controle: FAIT_LE, phrases_confirmees: ['p2', 'p3'] },
        is_published: true,
      }),
    ]);
    expect((serveur.article().relecture as { phrases_confirmees: string[] }).phrases_confirmees).toEqual(['p2', 'p3']);
  });

  it('en anglais : le badge, la case, la raison et ce qui bloque', async () => {
    switchLanguage('en');
    brancherLeServeur(AVEC_REGLES);
    const ecran = render(Page);
    await ecran.findByText(AVEC_REGLES.title, { selector: 'h3' });
    await fireEvent.click(ecran.getAllByRole('button', { name: 'Edit' })[0]);
    const fenetre = ecran.getByRole('dialog');
    await fireEvent.click(within(fenetre).getByRole('button', { name: /^Review/ }));
    const resume = carte(fenetre, 'resume');
    expect(within(resume).getByTestId('blog-verdict')).toHaveTextContent('Rule to check');
    expect(within(resume).getByTestId('blog-raison')).toHaveTextContent('Reason given by the check:');
    expect(within(resume).getByRole('checkbox', { name: 'I have checked this sentence in the text' })).toBeInTheDocument();
    expect(within(carte(fenetre, 'points_cles')).getByTestId('blog-verdict')).toHaveTextContent('Rule outside the sources');
    expect(within(fenetre).getByTestId('blog-blocages')).toHaveTextContent('2 rule sentence(s) to confirm: tick “I have checked this sentence in the text”');
    expect(within(fenetre).getByTestId('blog-a-confirmer')).toHaveTextContent('Rule sentences to confirm: 0 of 2 confirmed.');
  });

  it('réécrire la phrase est l’autre façon de la lever : une partie modifiée ne compte plus ses règles, le contrôle est à relancer', async () => {
    brancherLeServeur(AVEC_REGLES);
    const { fenetre } = await ouvrir(AVEC_REGLES, 'Édition');
    const resume = fenetre.querySelector<HTMLTextAreaElement>('#ed-sum')!;
    await fireEvent.input(resume, { target: { value: 'Le bailleur doit saisir la juridiction compétente.' } });
    const blocages = within(fenetre).getByTestId('blog-blocages');
    expect(blocages).toHaveTextContent('Texte modifié : enregistrez-le, puis relancez le contrôle IA.');
    // Il reste le point clé, que personne n'a réécrit.
    expect(blocages).toHaveTextContent('1 phrase(s) de règle à confirmer');
  });

  it('enregistrées avec le brouillon ; un contrôle neuf garde celle qu’il juge de même et efface l’autre', async () => {
    let phrases: unknown[] = PHRASES_A_CONFIRMER;
    const serveur = brancherLeServeur(AVEC_REGLES, { phrasesDuControle: () => phrases });
    const { fenetre } = await ouvrir(AVEC_REGLES);
    for (const partie of ['resume', 'points_cles']) {
      await fireEvent.click(within(carte(fenetre, partie)).getByRole('checkbox', { name: 'J’ai vérifié cette phrase dans le texte' }));
    }
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() => expect(appels('PUT /blog/12')).toHaveLength(1));
    expect(appels('PUT /blog/12')[0]).toMatchObject({ relecture: { controle: FAIT_LE, phrases_confirmees: ['p2', 'p3'] }, is_published: false });
    await waitFor(() => expect(serveur.article().etat_publication).toBe('relecture_incomplete'));

    // Le contrôle neuf donne « p3 » à une autre phrase : sa confirmation tombe.
    phrases = PHRASES_A_CONFIRMER.map((p) => (p.id === 'p3' ? { ...p, texte: 'Pas d’expulsion sans décision de justice.', verdict: 'non_soutenue' } : p));
    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
    await waitFor(() => expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent(/Contrôle IA terminé à/));
    expect(within(carte(fenetre, 'resume')).getByRole('checkbox', { name: 'J’ai vérifié cette phrase dans le texte' })).toBeChecked();
    expect(within(carte(fenetre, 'points_cles')).getByRole('checkbox', { name: 'J’ai vérifié cette phrase dans le texte' })).not.toBeChecked();
    expect(within(fenetre).getByTestId('blog-a-confirmer')).toHaveTextContent('1 confirmée(s) sur 2');
    expect(serveur.article().etat_publication).toBe('phrases_a_confirmer');
  });

  it('un serveur qui garderait la confirmation d’un identifiant donné à une autre phrase : la fenêtre ne la reprend pas', async () => {
    const confirme = { ...AVEC_REGLES, relecture: { ...AVEC_REGLES.relecture, controle: FAIT_LE, phrases_confirmees: ['p2', 'p3'] }, etat_publication: 'relecture_incomplete' };
    routes['GET /blog/admin/all'] = () => json([confirme]);
    // Le contrôle neuf a renuméroté : « p3 » est désormais une autre règle.
    const apres = {
      ...confirme,
      controle_ia: {
        ...confirme.controle_ia,
        fait_le: '2026-10-30T10:30:00+00:00',
        phrases: PHRASES_A_CONFIRMER.map((p) => (p.id === 'p3' ? { ...p, texte: 'Le juge statue à bref délai.' } : p)),
      },
    };
    routes['POST /blog/12/controle'] = () => json(apres);
    const { fenetre } = await ouvrir(confirme);
    expect(within(carte(fenetre, 'points_cles')).getByRole('checkbox', { name: 'J’ai vérifié cette phrase dans le texte' })).toBeChecked();
    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
    await waitFor(() => expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent(/Contrôle IA terminé à/));
    expect(within(carte(fenetre, 'points_cles')).getByRole('checkbox', { name: 'J’ai vérifié cette phrase dans le texte' })).not.toBeChecked();
    expect(within(carte(fenetre, 'resume')).getByRole('checkbox', { name: 'J’ai vérifié cette phrase dans le texte' })).toBeChecked();
    expect(within(fenetre).getByTestId('blog-blocages')).toHaveTextContent('1 phrase(s) de règle à confirmer');
  });

  it('deux onglets : des confirmations contre un contrôle relancé ailleurs sont refusées (422 relecture_perimee), rien d’appliqué', async () => {
    const serveur = brancherLeServeur(AVEC_REGLES);
    const { fenetre } = await ouvrir(AVEC_REGLES);
    await fireEvent.click(within(carte(fenetre, 'resume')).getByRole('checkbox', { name: 'J’ai vérifié cette phrase dans le texte' }));
    // L'onglet B relance le contrôle.
    serveur.repondre('POST', '/blog/12/controle');
    await fireEvent.click(within(fenetre).getByRole('button', { name: 'Enregistrer le brouillon' }));
    const alerte = await within(fenetre).findByRole('alert');
    await waitFor(() => expect(alerte).toHaveTextContent('vos cases ou vos confirmations portaient sur l’ancien'));
    expect(appels('PUT /blog/12')[0]).toMatchObject({ relecture: { controle: FAIT_LE, phrases_confirmees: ['p2'] } });
    expect((serveur.article().relecture as { phrases_confirmees: string[] }).phrases_confirmees).toEqual([]);
    // Relu : le contrôle enregistré, et la confirmation non enregistrée n'y est plus.
    await waitFor(() => expect(appels('GET /blog/admin/12')).toHaveLength(1));
    await waitFor(() =>
      expect(within(carte(fenetre, 'resume')).getByRole('checkbox', { name: 'J’ai vérifié cette phrase dans le texte' })).not.toBeChecked(),
    );
  });
});

describe('l’attente d’un contrôle seul, mesurée avec mistral-large-4 (40 à 105 s)', () => {
  it('l’annonce et l’aide le disent ; « plus long que d’habitude » passé 110 s ; le client abandonne à 175 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    brancherLeServeur(BROUILLON);
    routes['POST /blog/12/controle'] = sansReponse;
    routes['GET /blog/admin/12'] = () => json(BROUILLON);
    const ecran = render(Page);
    await vi.advanceTimersByTimeAsync(0);
    await ecran.findByText(BROUILLON.title, { selector: 'h3' });
    await fireEvent.click(ecran.getByRole('button', { name: 'Modifier' }));
    const fenetre = ecran.getByRole('dialog');
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Relecture/ }));
    await fireEvent.click(within(fenetre).getByTestId('blog-relancer-controle'));
    await vi.advanceTimersByTimeAsync(0);
    expect(within(fenetre).getByTestId('blog-fenetre-statut')).toHaveTextContent('Contrôle IA lancé. Il prend en général 40 à 105 secondes.');
    const controle = within(fenetre).getByTestId('blog-controle');
    expect(controle).toHaveTextContent('comptez 40 à 105 secondes. Sans réponse au bout de 175 secondes, le contrôle s’arrête.');
    await vi.advanceTimersByTimeAsync(105_000);
    expect(within(fenetre).queryByTestId('blog-controle-long')).toBeNull();
    await vi.advanceTimersByTimeAsync(6_000);
    expect(within(fenetre).getByTestId('blog-controle-long')).toHaveTextContent('Plus long que d’habitude');
    await vi.advanceTimersByTimeAsync(64_000);
    await tick();
    expect(await within(fenetre).findByRole('alert')).toHaveTextContent('Pas de réponse du serveur au bout de 175 secondes : le contrôle IA a été abandonné.');
  });
});
