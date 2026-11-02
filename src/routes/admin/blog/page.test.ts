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
import { ARTICLE_ANCIEN, ECRIT_PAR_LE_MODELE } from '$lib/data/blog-anciens-de-test';
import {
  BROUILLON,
  CITATION_VERIFIEE,
  PARTIES,
  PHRASES_AVEC_CONTRADICTION,
  PUBLIE as PUBLIE_DE_TEST,
  SOURCES,
  phrase,
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

/** En ligne et lisible du public, à une adresse à caractères spéciaux. */
const PUBLIE = { ...PUBLIE_DE_TEST, slug: 'coupure d’eau', title: 'Coupure d’eau' };

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

/** Coche les six cases « J'ai relu cette partie contre les sources ». */
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
    expect(attente).toHaveTextContent('contrôle IA de chaque phrase compris');
    expect(attente).toHaveTextContent('30 à 90 secondes');
    expect(attente).toHaveTextContent('160 secondes');
    // Le focus ne tombe pas sur <body> : il est sur « Arrêter ».
    expect(document.activeElement).toBe(within(attente).getByRole('button', { name: 'Arrêter' }));
    // Le bouton qui fermerait le panneau est masqué pendant l'attente.
    expect(ecran.queryByRole('button', { name: /Fermer le générateur/ })).toBeNull();

    reponse.resoudre(
      json(
        {
          post: { ...BROUILLON, avertissements: ['L’article 286 du Code pénal n’est porté par aucune source.'] },
          sources: SOURCES.slice(0, 2),
          avertissements: ['Le préavis de 3 mois n’est porté par aucune source.'],
        },
        201,
      ),
    );
    const fenetre = await ecran.findByRole('dialog', { name: 'Relecture de l’article' });
    const points = within(fenetre).getByTestId('blog-points-a-verifier');
    expect(points).toHaveTextContent('L’article 286 du Code pénal');
    expect(points).toHaveTextContent('Le préavis de 3 mois');
    expect(within(fenetre).getByTestId('blog-sources')).toHaveTextContent('Sources retrouvées (2)');
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

  it('délai du client : « plus long que d’habitude » après 90 s, abandon à 160 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    routes['GET /blog/admin/all'] = () => json([]);
    routes['POST /blog/generate'] = sansReponse;
    const ecran = render(Page);
    await vi.advanceTimersByTimeAsync(0);
    await fireEvent.click(ecran.getByRole('button', { name: /Générer un article IA/ }));
    await fireEvent.input(ecran.getByLabelText(/Sujet ou question d’actualité/), { target: { value: 'Licenciement économique' } });
    await fireEvent.click(ecran.getByRole('button', { name: /Générer le brouillon/ }));
    await vi.advanceTimersByTimeAsync(95_000);
    expect(ecran.getByTestId('blog-generation-en-cours')).toHaveTextContent('Plus long que d’habitude');
    expect(ecran.getByTestId('blog-chrono')).toHaveTextContent('1:35');
    await vi.advanceTimersByTimeAsync(65_000);
    await tick();
    expect(ecran.queryByTestId('blog-generation-en-cours')).toBeNull();
    expect(ecran.getByTestId('blog-generation-erreur')).toHaveTextContent('Pas de réponse du serveur au bout de 160 secondes');
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

  it('l’explication d’une citation s’arrête à 300 caractères, où le serveur la couperait sans le dire', async () => {
    const { fenetre } = await ouvrirEnEdition();
    for (const champ of within(fenetre).getAllByLabelText('Explication')) expect(champ).toHaveAttribute('maxlength', '300');
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
      'Soutenues : 5 · À vérifier : 1 · Contredites : 0 · Hors des sources : 1',
    );
    expect(within(fenetre).getAllByTestId('blog-phrase')).toHaveLength(7);
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
    const source = within(fenetre).getByText(/La juridiction compétente statuant à bref délai/).closest('li')!;
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

  it('les six cases cochées, « Publier » s’active et envoie UN SEUL PUT : formulaire entier, cases, is_published', async () => {
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
    expect(publier).toHaveAccessibleDescription(/Relecture incomplète\s:\s0 partie\(s\) relue\(s\) sur 6/);
    await fireEvent.click(publier);
    expect(appels('PUT /blog/12')).toHaveLength(0);
    await waitFor(() => expect(document.activeElement).toBe(within(fenetre).getByTestId('blog-blocages')));

    await toutRelire(fenetre);
    expect(within(fenetre).getByTestId('blog-progression')).toHaveTextContent('Parties relues : 6 sur 6');
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
      relecture: { parties: { contexte: true, resume: true, points_cles: true, impact: true, explications: true, question: true } },
      is_published: true,
    });
    expect(serveur.article().isPublished).toBe(true);
    expect(ecran.getByTestId('blog-avis')).toHaveTextContent('est publié sur /blog');
    expect(ecran.container.querySelector('#titre-article-12')!.closest('li')).toHaveTextContent('Publié');
  });

  it('modifier une partie la décoche, et le contrôle est à relancer ; « Enregistrer et relancer » fait les deux', async () => {
    const serveur = brancherLeServeur(BROUILLON, {
      phrasesDuControle: (article) => [
        phrase('n1', 'resume', 0, String((article.botAnalysis as { summary: string }).summary), 'soutenue', [3], 'Conforme à l’extrait 3.'),
      ],
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
    // La case cochée, non enregistrée, est restée.
    expect(within(fenetre).getByTestId('blog-case-contexte')).toBeChecked();
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
  const ANCIEN_ADMIN = {
    ...ARTICLE_ANCIEN,
    avertissements: [
      'Citation 1 : non vérifiée (écrite avant la vérification par le serveur). Retirez-la, ou remplacez-la par un article de la base.',
      'Citation 2 : non vérifiée (écrite avant la vérification par le serveur). Retirez-la, ou remplacez-la par un article de la base.',
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
    expect(ligne).toHaveTextContent('Caché du public : il n’y revient qu’après le contrôle IA et la relecture de chaque partie.');
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
    expect(raisons).toHaveTextContent('2 citation(s) non vérifiée(s) dans la base : retirez-les.');
    expect(raisons).toHaveTextContent('Aucun contrôle IA : lancez-le.');
    expect(raisons).toHaveTextContent('Relecture incomplète : 0 partie(s) relue(s) sur 6.');
    expect(within(fenetre).getByRole('button', { name: 'Publier les modifications' })).toHaveAttribute('aria-disabled', 'true');

    await fireEvent.click(within(fenetre).getByRole('button', { name: /Aperçu/ }));
    const apercu = within(fenetre).getByTestId('blog-apercu');
    expect(within(apercu).getAllByTestId('citation-non-verifiee')).toHaveLength(2);
    expect(within(apercu).getByTestId('blog-avis-non-verifie')).toBeInTheDocument();
    for (const ecrit of ECRIT_PAR_LE_MODELE) expect(apercu.textContent, ecrit).not.toContain(ecrit);
    expect(apercu.querySelector('a[href^="/laws"]')).toBeNull();

    // Sans les sources de sa génération : les textes cités, et le dire.
    await fireEvent.click(within(fenetre).getByRole('button', { name: /Relecture/ }));
    expect(within(fenetre).getByTestId('blog-sources')).toHaveTextContent('ne sont gardés que pendant la visite');
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
