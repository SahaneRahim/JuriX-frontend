/**
 * La page du chat, branchée : accueil (P4), étapes et « Arrêter » (P4),
 * citations et aperçu (P3), question du profil dans le fil (P5), et le
 * comportement d'avant sur l'ancienne API.
 *
 * Le réseau est simulé (`apiFetch`, `GET /corpus`, aperçu) : aucun appel réel,
 * aucun modèle. Le routage « shallow » de SvelteKit (pushState) est imité par
 * un store de page dont l'état suit pushState et history.back.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get, writable } from 'svelte/store';

const simule = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  chiffres: vi.fn(),
  apercu: vi.fn(),
  changerPersona: vi.fn(),
  refuser: vi.fn(),
  lecture: vi.fn(),
  pushState: vi.fn(),
  replaceState: vi.fn(),
}));

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('$app/stores', async () => {
  const { writable: w } = await import('svelte/store');
  return {
    page: w({
      url: new URL('http://localhost/chat'),
      params: {},
      route: { id: '/(main)/chat' },
      status: 200,
      error: null,
      data: {},
      form: null,
      state: {},
    }),
  };
});
vi.mock('$app/navigation', () => ({
  afterNavigate: vi.fn(),
  goto: vi.fn(),
  pushState: simule.pushState,
  replaceState: simule.replaceState,
}));
vi.mock('$lib/api', () => ({
  apiFetch: simule.apiFetch,
  API_URL: 'http://api.test/api/v1',
  authHeaders: () => ({}),
}));
vi.mock('$lib/persona-compte', () => ({
  changerPersona: simule.changerPersona,
  refuserPourCetteSession: simule.refuser,
  lectureDuCompteEnCours: simule.lecture,
}));
vi.mock('$lib/components/chat/apercus', () => ({
  chargerLesChiffresDuCorpus: simule.chiffres,
  chiffresDejaLus: () => null,
  apercuDeLArticle: simule.apercu,
}));
vi.mock('$lib/stores/language', async () => {
  const { readable, writable: w } = await import('svelte/store');
  const { traduireEnTest } = await import('$lib/components/chat/traductions-de-test');
  return { tr: readable(traduireEnTest), language: w({ current: 'fr' }), switchLanguage: () => {} };
});

import { page } from '$app/stores';
import { authStore } from '$lib/stores/auth';
import { annonceDansLaPalette, commandPaletteOpen } from '$lib/stores/commandPalette';
import {
  annonceDuChat,
  choixPersonaOuvert,
  conversationDuChatEnCours,
  fermerChoixPersona,
  personaStore,
} from '$lib/stores/persona';
import Page from './+page.svelte';

// jsdom : ni animations Web, ni image suivante, ni défilement d'élément.
Element.prototype.animate = vi.fn(() => ({
  onfinish: null,
  cancel: vi.fn(),
  finished: Promise.resolve(),
  currentTime: 0,
})) as unknown as typeof Element.prototype.animate;
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
globalThis.requestAnimationFrame ??= ((rappel: FrameRequestCallback) =>
  setTimeout(() => rappel(0), 0) as unknown as number) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame ??= ((id: number) => clearTimeout(id)) as typeof cancelAnimationFrame;

const pageEnTest = page as unknown as ReturnType<typeof writable<{ state: Record<string, unknown> }>>;

/** Une réponse en flux SSE ; `ouverte` : le flux reste ouvert jusqu'à l'arrêt du lecteur. */
function flux(evenements: object[], ouverte = false, signal?: AbortSignal | null): Response {
  const encodeur = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controleur) {
        for (const e of evenements) controleur.enqueue(encodeur.encode(`data: ${JSON.stringify(e)}\n\n`));
        if (!ouverte) controleur.close();
        else signal?.addEventListener('abort', () => controleur.error(new DOMException('Arrêt', 'AbortError')));
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

/** Un flux qu'on alimente à la main, pour voir le fil entre deux événements. */
function fluxPilote(signal?: AbortSignal | null) {
  const encodeur = new TextEncoder();
  let controleur!: ReadableStreamDefaultController<Uint8Array>;
  const corps = new ReadableStream<Uint8Array>({
    start(c) {
      controleur = c;
      signal?.addEventListener('abort', () => c.error(new DOMException('Arrêt', 'AbortError')));
    },
  });
  return {
    reponse: new Response(corps, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    envoyer: (e: object) => controleur.enqueue(encodeur.encode(`data: ${JSON.stringify(e)}\n\n`)),
    fermer: () => controleur.close(),
  };
}

let retour: ReturnType<typeof vi.spyOn>;

/** Les requêtes envoyées au chat, et la réponse à rendre. */
let questions: Record<string, unknown>[] = [];
let reponse: (init: RequestInit) => Response = () => flux([]);

const PROGRESSION = [
  { chunk: '', done: false, session_id: 'sid-neuve', persona: 'citoyen', progression: { etape: 'recherche', libelle: 'Recherche dans les textes…' } },
  {
    chunk: '',
    done: false,
    session_id: 'sid-neuve',
    persona: 'citoyen',
    progression: {
      etape: 'textes_trouves',
      libelle: '6 articles trouvés dans 3 textes',
      nb_articles: 6,
      nb_textes: 3,
      textes: [
        { law_id: 2274, law_reference: 'LOI-1992-007', law_title: 'Loi N°92/007 du 14 août 1992 portant Code du travail', date_du_texte: '1992-08-14', nb_articles: 4 },
        { law_id: 2279, law_reference: 'DEC-1994-199', law_title: 'Décret N°94/199 du 07 octobre 1994 portant Statut Général', date_du_texte: '1994-10-07', nb_articles: 1 },
      ],
    },
  },
];

const TEXTE = "Selon l'article 35 de la loi n° 92/007, l'indemnité est due. L'article 312 du Code pénal réprime les abus.";
const FIN_NOUVELLE_API = {
  chunk: '',
  done: true,
  session_id: 'sid-neuve',
  persona: 'citoyen',
  intent: 'juridique',
  sources: [],
  citations: [
    {
      debut: TEXTE.indexOf('article 35'),
      fin: TEXTE.indexOf('article 35') + 30,
      texte_cite: 'article 35 de la loi n° 92/007',
      law_id: 2274,
      article: '35',
      article_id: 97421,
      reference: 'LOI-1992-007',
      titre: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
      date_du_texte: '1992-08-14',
      statut: { etat: null, liens: [], lignes: [] },
    },
  ],
  citations_introuvables: [{ debut: TEXTE.indexOf('article 312'), fin: TEXTE.indexOf('article 312') + 25, texte_cite: 'article 312 du Code pénal', raison: 'texte_non_consulte' }],
  articles_cites: [
    {
      law_id: 2274,
      law_reference: 'LOI-1992-007',
      law_title: 'Loi N°92/007 du 14 août 1992 portant Code du travail',
      article_number: '35',
      article_id: 97421,
      excerpt: '(6) Le salaire…',
      relevance_score: 0.9,
      date_du_texte: '1992-08-14',
      statut: { etat: null, liens: [], lignes: [] },
    },
  ],
  textes_consultes_non_cites: [],
};

/** Écrit la question et l'envoie par Entrée, comme un lecteur. */
async function poser(question: string, ecran: { getByRole: (role: 'textbox') => HTMLElement }) {
  const champ = ecran.getByRole('textbox');
  await fireEvent.input(champ, { target: { value: question } });
  await fireEvent.keyDown(champ, { key: 'Enter' });
}

const fil = () => document.querySelector('[role="log"]') as HTMLElement;
/** Un ancêtre inerte : jsdom pose la propriété `inert` sans l'attribut. */
const inerte = (element: Element | null): boolean => {
  for (let n = element; n; n = n.parentElement) {
    if ((n as HTMLElement & { inert?: boolean }).inert === true || n.hasAttribute('inert')) return true;
  }
  return false;
};
const annonce = () => document.querySelector('[data-testid="chat-announce"]')?.textContent?.trim() ?? '';

beforeEach(() => {
  questions = [];
  reponse = () => flux([]);
  simule.apiFetch.mockReset().mockImplementation(async (chemin: string, init: RequestInit = {}) => {
    if (chemin === '/rag/ask/stream') {
      questions.push(JSON.parse(String(init.body)));
      return reponse(init);
    }
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  simule.chiffres.mockReset().mockResolvedValue(null);
  simule.apercu.mockReset().mockResolvedValue(null);
  simule.changerPersona.mockReset();
  simule.refuser.mockReset();
  // Anonyme, ou compte déjà lu : la question du profil n'attend rien.
  simule.lecture.mockReset().mockReturnValue(null);
  simule.pushState.mockReset().mockImplementation((_url: string, state: Record<string, unknown>) =>
    pageEnTest.update((p) => ({ ...p, state })),
  );
  simule.replaceState.mockReset().mockImplementation((_url: string, state: Record<string, unknown>) =>
    pageEnTest.update((p) => ({ ...p, state })),
  );
  retour = vi.spyOn(history, 'back').mockImplementation(() => pageEnTest.update((p) => ({ ...p, state: {} })));
  pageEnTest.update((p) => ({ ...p, state: {} }));
  localStorage.setItem('jurix-persona', 'citoyen');
  // Chaque test arrive en nouveau visiteur : ni repère d'accueil (P4), ni
  // conversation gardée par le test d'avant.
  localStorage.removeItem('jurix-chat-accueil-vu');
  localStorage.removeItem('jurix-chat-session');
  localStorage.removeItem('jurix-chat-persona');
  // Ni refus de session laissé par un test d'avant (cookie, voir persona.ts).
  document.cookie = 'jurix-persona-refus=; Path=/; Max-Age=0';
  personaStore._reinitialiser();
});

afterEach(() => {
  cleanup();
  // Seul `history.back` est restauré : `vi.restoreAllMocks` viderait aussi le
  // `matchMedia` simulé de src/tests/setup.ts.
  retour.mockRestore();
});

describe('accueil en trois messages (P4)', () => {
  it('ancienne API : périmètre générique, sans chiffre ni date ; trois questions ; avertissement sous le champ', async () => {
    const ecran = render(Page);
    await waitFor(() => expect(simule.chiffres).toHaveBeenCalled());

    const texte = fil().textContent ?? '';
    expect(texte).toContain('Je réponds à partir des textes officiels publiés dans JuriX.');
    expect(texte).toContain('Chaque réponse indique ses sources');
    expect(texte).toContain('N’écrivez ni nom ni numéro de téléphone.');
    expect(texte).not.toMatch(/\d{4}/);
    expect(ecran.getAllByTestId('chat-suggestion')).toHaveLength(3);
    expect(ecran.getByTestId('chat-disclaimer').textContent).toContain(
      'Information juridique générale, pas un avis sur votre cas.',
    );
    // Plus de point qui pulse dans la barre.
    expect(document.querySelector('.animate-pulse, [class*="animate-pulse"]')).toBeNull();
  });

  it('nouvelle API : le nombre de textes, leur périmètre et la date de GET /corpus', async () => {
    simule.chiffres.mockResolvedValue({
      textes: 2275,
      articles: 27157,
      dernier_ajout_le: '2026-10-14',
      liens_releves_le: '2026-10-14',
      libelle_sources: { fr: 'textes officiels camerounais, OHADA et CIMA', en: 'official texts' },
      textes_par_nature: [],
      sources: [],
    });
    render(Page);

    await waitFor(() =>
      expect(fil().textContent).toContain(
        'Je réponds à partir de 2\u202F275 textes officiels camerounais, OHADA et CIMA (dernier texte ajouté à JuriX le 14 octobre 2026).',
      ),
    );
    expect(fil().textContent).toContain('Chaque réponse cite ses articles : touchez-les pour lire le texte officiel.');
  });
});

describe('l’accueil entier à la première visite seulement (P4, variante A)', () => {
  it('un habitué (une question déjà posée) : le périmètre et les trois questions, sans les deux autres messages', async () => {
    localStorage.setItem('jurix-chat-accueil-vu', '1');
    const ecran = render(Page);

    await waitFor(() => expect(fil().textContent).not.toContain('N’écrivez ni nom ni numéro de téléphone.'));
    expect(fil().textContent).toContain('Je réponds à partir des textes officiels publiés dans JuriX.');
    expect(fil().textContent).not.toContain('Chaque réponse indique ses sources');
    expect(ecran.getAllByTestId('chat-suggestion')).toHaveLength(3);
    // L'avertissement sous le champ, lui, reste.
    expect(ecran.getByTestId('chat-disclaimer')).toBeTruthy();
  });

  it('une conversation gardée d’une visite d’avant le repère compte aussi comme une visite', async () => {
    localStorage.setItem('jurix-chat-session', 'sid-ancienne');
    render(Page);

    await waitFor(() => expect(fil().textContent).not.toContain('N’écrivez ni nom ni numéro de téléphone.'));
  });

  it('la première question retient le repère, sans retirer un message de l’accueil affiché', async () => {
    reponse = () => flux([{ chunk: 'Voici la réponse.', done: false }, { chunk: '', done: true, sources: [] }]);
    const ecran = render(Page);

    await poser('Quelles indemnités en cas de licenciement ?', ecran);

    expect(await ecran.findByText('Voici la réponse.')).toBeTruthy();
    expect(localStorage.getItem('jurix-chat-accueil-vu')).toBe('1');
    expect(fil().textContent).toContain('N’écrivez ni nom ni numéro de téléphone.');
  });

  it('sur l’accueil, pas de bouton « Aller au dernier message » : il n’y a rien à rejoindre', async () => {
    const ecran = render(Page);
    await waitFor(() => expect(simule.chiffres).toHaveBeenCalled());
    // L'accueil dépasse la hauteur du fil (écran court) : la vue n'est pas en bas.
    Object.defineProperty(fil(), 'scrollHeight', { configurable: true, value: 900 });
    Object.defineProperty(fil(), 'clientHeight', { configurable: true, value: 200 });
    await fireEvent.scroll(fil());

    expect(ecran.queryByTestId('chat-scroll-latest')).toBeNull();
  });
});

describe('défilement du fil', () => {
  /**
   * Le fil de 740 × 360 (capture chat-attente r1), sans moteur de mise en
   * page : 207 px de haut, la question 12 px sous son bord (sa butée est donc
   * à 0), et un contenu dont la hauteur est réglée par le test.
   */
  function fixerLaMiseEnPage(hauteurDuContenu: { valeur: number }) {
    const el = fil();
    let defilement = 0;
    Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => defilement, set: (v: number) => (defilement = v) });
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => hauteurDuContenu.valeur });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: 207 });
    const boite = (top: number) => ({ top, bottom: top, height: 0, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    const rectangle = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this === el) return boite(54);
      if (this.hasAttribute('data-message-id') && el.contains(this)) return boite(54 + 12 - defilement);
      return boite(0);
    };
    return { defilement: () => defilement, restaurer: () => (HTMLElement.prototype.getBoundingClientRect = rectangle) };
  }

  it('l’attente se lit en entier, puis la réponse part de là, sans remonter ni suivre', async () => {
    let pilote!: ReturnType<typeof fluxPilote>;
    reponse = (init) => {
      pilote = fluxPilote(init.signal);
      return pilote.reponse;
    };
    const ecran = render(Page);
    const contenu = { valeur: 168 };
    const page = fixerLaMiseEnPage(contenu);
    try {
      await poser('Quelles indemnités en cas de licenciement ?', ecran);
      await ecran.findByTestId('chat-progress');

      // Trois étapes : la bulle d'état dépasse le fil de 9 px. Arrêtée à la
      // question, la vue la laissait rognée contre le filet de la saisie.
      contenu.valeur = 216;
      for (const e of PROGRESSION) pilote.envoyer(e);
      pilote.envoyer({ chunk: '', done: false, progression: { etape: 'redaction', libelle: 'Rédaction de la réponse…' } });
      await waitFor(() => expect(ecran.getByTestId('chat-progress').textContent).toContain('Rédaction'));
      await waitFor(() => expect(page.defilement()).toBe(9));

      // La réponse, longue, remplace la bulle : la vue reste où l'attente
      // l'a laissée, elle ne la suit pas jusqu'au bout.
      contenu.valeur = 600;
      pilote.envoyer({ chunk: 'Voici une longue réponse.', done: false });
      await ecran.findByText('Voici une longue réponse.');
      await waitFor(() => expect(ecran.queryByTestId('chat-progress')).toBeNull());
      expect(page.defilement()).toBe(9);
      pilote.envoyer({ chunk: '', done: true, sources: [] });
      pilote.fermer();
      await waitFor(() => expect(fil().getAttribute('aria-busy')).toBeNull());
      expect(page.defilement()).toBe(9);
    } finally {
      page.restaurer();
    }
  });

  it('arrêtée seule sur la question, la vue n’ouvre pas la bande ; le lecteur qui fait défiler, si', async () => {
    let pilote!: ReturnType<typeof fluxPilote>;
    reponse = (init) => {
      pilote = fluxPilote(init.signal);
      return pilote.reponse;
    };
    const ecran = render(Page);
    const contenu = { valeur: 168 };
    const page = fixerLaMiseEnPage(contenu);
    try {
      await poser('Quelles indemnités en cas de licenciement ?', ecran);
      await ecran.findByTestId('chat-progress');

      // La réponse dépasse le fil : la vue s'arrête à la butée de la question
      // (0), la fin reste cachée, et le lecteur n'a pas bougé.
      contenu.valeur = 600;
      pilote.envoyer({ chunk: 'Voici une longue réponse.', done: false });
      await ecran.findByText('Voici une longue réponse.');
      pilote.envoyer({ chunk: '', done: true, sources: [] });
      pilote.fermer();
      await waitFor(() => expect(fil().getAttribute('aria-busy')).toBeNull());
      expect(page.defilement()).toBe(0);
      // Le défilement que la vue arrêtée produit elle-même ne compte pas : à
      // 740 × 360, la bande couvrait la réponse dès son premier mot.
      await fireEvent.scroll(fil());
      expect(ecran.queryByTestId('chat-scroll-band')).toBeNull();
      // La marge de défilement est déjà posée : une citation atteinte au
      // clavier fait défiler le fil, et la bande qui s'ouvre ne la cache pas.
      expect(fil().className).toContain('scroll-pb-14');

      // Le lecteur fait défiler, même vers le bas, la fin encore cachée : la bande.
      fil().scrollTop = 120;
      await fireEvent.scroll(fil());
      expect(await ecran.findByTestId('chat-scroll-band')).toBeTruthy();
    } finally {
      page.restaurer();
    }
  });

  it('dans une conversation, remonté : le bouton, dans une bande opaque au-dessus du champ, jamais sur le texte', async () => {
    reponse = () => flux([{ chunk: 'Voici la réponse.', done: false }, { chunk: '', done: true, sources: [] }]);
    const ecran = render(Page);
    await poser('Quelles indemnités en cas de licenciement ?', ecran);
    await ecran.findByText('Voici la réponse.');

    Object.defineProperty(fil(), 'scrollHeight', { configurable: true, value: 900 });
    Object.defineProperty(fil(), 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(fil(), 'scrollTop', { configurable: true, value: 0 });
    await fireEvent.scroll(fil());

    const bouton = await ecran.findByTestId('chat-scroll-latest');
    // Nommé par son libellé, visible, et non par une flèche seule.
    expect(bouton.textContent?.trim()).toBe('Aller au dernier message');
    // La bande couvre toute la largeur du bas du fil, sur un fond plein : le
    // texte s'arrête à son filet au lieu de passer sous un bouton (reste r3
    // n° 39). Hors du fil, pour que le défilement ne bouge pas.
    const bande = ecran.getByTestId('chat-scroll-band');
    expect(bande.contains(bouton)).toBe(true);
    expect(bande.className).toContain('inset-x-0');
    expect(bande.className).toContain('bottom-0');
    expect(bande.className).toContain('bg-white');
    expect(fil().contains(bande)).toBe(false);
    // Le filet passe de la zone de saisie à la bande, et le fil garde une
    // marge de défilement pour qu'un lien atteint au clavier ne passe pas dessous.
    expect(fil().className).toContain('scroll-pb-14');

    // Revenu en bas : la bande s'en va (son fondu de sortie ne finit pas
    // sous jsdom, sans animations Web : ce qu'elle porte sur le fil et la
    // saisie, si), et la zone de saisie reprend son filet.
    Object.defineProperty(fil(), 'scrollTop', { configurable: true, value: 700 });
    await fireEvent.scroll(fil());
    await waitFor(() => expect(fil().className).not.toContain('scroll-pb-14'));
  });
});

describe('la barre du chat', () => {
  it('sans profil choisi : « Profil : Général », le mot « profil » une seule fois', () => {
    localStorage.removeItem('jurix-persona');
    personaStore._reinitialiser();
    const ecran = render(Page);

    const profil = ecran.getByTestId('chat-persona');
    expect(profil.getAttribute('data-persona')).toBe('general');
    expect(profil.textContent?.replace(/\s+/g, ' ')).toContain('Profil : Général');
    expect(profil.textContent).not.toContain('Profil général');
  });
});

describe('attente lisible et « Arrêter » (P4)', () => {
  it('les étapes du serveur, aria-busy sur le fil, « Arrêter » à la place d’« Envoyer »', async () => {
    reponse = (init) => flux(PROGRESSION, true, init.signal);
    const ecran = render(Page);

    await poser('Quelles indemnités en cas de licenciement ?', ecran);

    const etapes = await ecran.findByTestId('chat-progress');
    // L'objet du décret (« Statut Général »), comme la maquette chat-attente-p4a.
    await waitFor(() => expect(etapes.textContent).toContain('6 articles trouvés : Code du travail, Statut Général'));
    expect(fil().getAttribute('aria-busy')).toBe('true');
    expect(fil().getAttribute('aria-live')).toBe('off');
    const arreter = ecran.getByTestId('chat-stop');
    expect(arreter.getAttribute('aria-label')).toBe('Arrêter la réponse');
    expect((arreter as HTMLButtonElement).disabled).toBe(false);
    // La session arrive avec la première étape.
    expect(localStorage.getItem('jurix-chat-session')).toBe('sid-neuve');

    await fireEvent.click(arreter);

    await waitFor(() => expect(ecran.getByTestId('chat-stopped').textContent).toContain('Réponse arrêtée avant la fin.'));
    expect(ecran.queryByTestId('chat-error')).toBeNull();
    expect(ecran.queryByTestId('chat-progress')).toBeNull();
    expect(fil().getAttribute('aria-busy')).toBeNull();
    expect(ecran.getByRole('button', { name: 'Envoyer' })).toBeTruthy();
    await waitFor(() => expect(annonce()).toBe('Réponse arrêtée.'));
  });
});

/**
 * Un bouton activé au clavier garde le focus ; désactivé par l'envoi, il le
 * perdait, et la tabulation suivante repartait du haut de la page. Sous jsdom,
 * un clic sans `detail` est un clic au clavier.
 */
describe('le focus, quand l’envoi désactive le bouton qui l’avait', () => {
  it('à la fin de la réponse, « Envoyer » désactivé rend le focus au champ', async () => {
    reponse = () => flux([{ chunk: 'Voici la réponse.', done: false }, { chunk: '', done: true, sources: [] }]);
    const ecran = render(Page);
    const champ = ecran.getByRole('textbox');
    await fireEvent.input(champ, { target: { value: 'Quelles indemnités en cas de licenciement ?' } });
    const bouton = ecran.getByTestId('chat-send') as HTMLButtonElement;

    bouton.focus();
    await fireEvent.click(bouton);

    await ecran.findByText('Voici la réponse.');
    await waitFor(() => expect(bouton.disabled).toBe(true));
    await waitFor(() => expect(document.activeElement).toBe(champ));
  });

  it('la question attend son profil (P5) : le focus passe au premier profil', async () => {
    localStorage.removeItem('jurix-persona');
    personaStore._reinitialiser();
    const ecran = render(Page);
    await fireEvent.input(ecran.getByRole('textbox'), { target: { value: 'Quels sont mes droits en garde à vue ?' } });
    const bouton = ecran.getByTestId('chat-send');

    bouton.focus();
    await fireEvent.click(bouton);

    await ecran.findByTestId('chat-profile-question');
    await waitFor(() => expect(document.activeElement).toBe(ecran.getByTestId('chat-profile-citoyen')));
  });

  it('une suggestion, puis « Reposer la question » : le focus passe au champ', async () => {
    reponse = (init) => flux(PROGRESSION, true, init.signal);
    const ecran = render(Page);
    const champ = ecran.getByRole('textbox');
    const suggestion = ecran.getAllByTestId('chat-suggestion')[0] as HTMLButtonElement;

    suggestion.focus();
    await fireEvent.click(suggestion);

    await waitFor(() => expect(suggestion.disabled).toBe(true));
    await waitFor(() => expect(document.activeElement).toBe(champ));

    await fireEvent.click(ecran.getByTestId('chat-stop'));
    const reposer = (await ecran.findByTestId('chat-ask-again')) as HTMLButtonElement;
    reposer.focus();
    await fireEvent.click(reposer);

    await waitFor(() => expect(reposer.disabled).toBe(true));
    await waitFor(() => expect(document.activeElement).toBe(champ));
  });

  it('au doigt ou à la souris, le focus ne va pas au champ : il ouvrirait le clavier d’un téléphone', async () => {
    reponse = (init) => flux(PROGRESSION, true, init.signal);
    const ecran = render(Page);
    const suggestion = ecran.getAllByTestId('chat-suggestion')[0];

    // Chrome et Android donnent le focus au bouton touché.
    suggestion.focus();
    await fireEvent.click(suggestion, { detail: 1 });

    await waitFor(() => expect(questions).toHaveLength(1));
    await tick();
    expect(document.activeElement).not.toBe(ecran.getByRole('textbox'));
  });
});

describe('citations dans la phrase et aperçu (P3)', () => {
  it('liens dans la phrase, citation introuvable signalée, articles cités, annonce de fin', async () => {
    reponse = () => flux([...PROGRESSION, { chunk: TEXTE, done: false }, FIN_NOUVELLE_API]);
    const ecran = render(Page);

    await poser('Quelles indemnités en cas de licenciement ?', ecran);

    const lien = await ecran.findByTestId('chat-citation');
    // Le lien commence au mot élidé : l'icône § ne se glisse plus entre
    // « l' » et « article ».
    // « n° » et « article » ne se séparent pas de leur numéro en fin de
    // ligne : espace insécable.
    expect(lien.textContent).toBe("l'article\u00A035 de la loi n°\u00A092/007");
    // L'introuvable aussi part du mot élidé, sous ses tirets.
    expect(ecran.getByTestId('chat-citation-introuvable').textContent).toBe("L'article\u00A0312 du Code pénal");
    expect(fil().querySelector('[data-citation-introuvable]')?.textContent).toContain('Citation non retrouvée');
    expect(ecran.getAllByTestId('chat-article-cite')).toHaveLength(1);
    // Ni l'ancienne liste « Sources » ni aria-busy après la fin.
    expect(ecran.queryByTestId('chat-source')).toBeNull();
    await waitFor(() => expect(fil().getAttribute('aria-busy')).toBeNull());
    await waitFor(() => expect(annonce()).toBe('Réponse terminée, 1 article cité. 1 citation non retrouvée.'));
  });

  it('toucher la citation ouvre l’aperçu ; « Fermer » revient en arrière et rend le focus', async () => {
    reponse = () => flux([{ chunk: TEXTE, done: false }, FIN_NOUVELLE_API]);
    const ecran = render(Page);
    await poser('Quelles indemnités en cas de licenciement ?', ecran);
    const lien = await ecran.findByTestId('chat-citation');

    await fireEvent.click(lien);

    const apercu = await ecran.findByTestId('chat-preview');
    expect(simule.pushState).toHaveBeenCalledTimes(1);
    expect(apercu.getAttribute('aria-modal')).toBe('true');
    expect(apercu.textContent).toContain('Art. 35 — Code du travail');
    expect(simule.apercu).toHaveBeenCalledWith(2274, '35', 97421, expect.any(AbortSignal));
    // Feuille modale : la conversation derrière est inerte.
    expect(inerte(fil())).toBe(true);

    await fireEvent.click(ecran.getByTestId('chat-preview-close'));

    expect(history.back).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(ecran.queryByTestId('chat-preview')).toBeNull());
    expect(inerte(fil())).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(lien));
  });

  it('le retour système ferme l’aperçu ; Échap aussi', async () => {
    reponse = () => flux([{ chunk: TEXTE, done: false }, FIN_NOUVELLE_API]);
    const ecran = render(Page);
    await poser('Quelles indemnités en cas de licenciement ?', ecran);
    await fireEvent.click(await ecran.findByTestId('chat-citation'));
    await ecran.findByTestId('chat-preview');

    // Retour système : l'entrée d'historique de l'aperçu disparaît.
    pageEnTest.update((p) => ({ ...p, state: {} }));
    await waitFor(() => expect(ecran.queryByTestId('chat-preview')).toBeNull());

    await fireEvent.click(ecran.getAllByTestId('chat-article-cite')[0]);
    await ecran.findByTestId('chat-preview');
    await fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(ecran.queryByTestId('chat-preview')).toBeNull());
  });

  // L'historique garde l'état des entrées d'une vue précédente du chat : la
  // page quittée aperçu ouvert puis retrouvée par le retour, ou rechargée
  // (F5 : `page.state` repart vide, l'entrée garde le sien). Le compteur des
  // aperçus repartait de 1 à chaque montage : la clé d'un aperçu neuf était
  // celle de l'entrée périmée, et « Fermer », revenu sur elle, croyait
  // l'aperçu encore là. Il fallait deux appuis.
  const VUES_PRECEDENTES: Array<[string, Record<string, unknown>]> = [
    ['retour depuis une autre page', { apercuCitation: '1' }],
    ['F5 aperçu ouvert', {}],
  ];
  for (const [cas, etatAuMontage] of VUES_PRECEDENTES) {
    it(`une entrée laissée par une vue précédente (${cas}) : « Fermer » ferme du premier coup`, async () => {
      pageEnTest.update((p) => ({ ...p, state: etatAuMontage }));
      retour.mockImplementation(() => pageEnTest.update((p) => ({ ...p, state: { apercuCitation: '1' } })));
      reponse = () => flux([{ chunk: TEXTE, done: false }, FIN_NOUVELLE_API]);
      const ecran = render(Page);
      await poser('Quelles indemnités en cas de licenciement ?', ecran);
      await fireEvent.click(await ecran.findByTestId('chat-citation'));
      await ecran.findByTestId('chat-preview');

      await fireEvent.click(ecran.getByTestId('chat-preview-close'));

      expect(history.back).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(ecran.queryByTestId('chat-preview')).toBeNull());
    });
  }

  it('ancienne API : la réponse et ses « Sources » comme avant, sans lien dans la phrase', async () => {
    reponse = () =>
      flux([
        { chunk: 'Selon l’article 33 du Code Minier, le permis dure trois ans.', done: false },
        {
          chunk: '',
          done: true,
          session_id: 'sid-ancienne',
          sources: [
            { law_id: 42, law_reference: 'LOI-2023-014', law_title: 'Code Minier', article_number: '33', article_id: 900, excerpt: 'Le permis…', relevance_score: 0.9 },
          ],
        },
      ]);
    const ecran = render(Page);

    await poser('Quelle est la durée du permis ?', ecran);

    expect(await ecran.findByTestId('chat-source')).toBeTruthy();
    expect(ecran.queryByTestId('chat-citation')).toBeNull();
    expect(ecran.queryByTestId('chat-article-cite')).toBeNull();
    // Sans étape du serveur, l'attente disait « Préparation de la réponse… » : finie, plus rien.
    expect(ecran.queryByTestId('chat-progress')).toBeNull();
    await waitFor(() => expect(annonce()).toBe('Réponse terminée.'));
  });
});

/**
 * La feuille d'aperçu est modale sous lg : la conversation derrière elle est
 * inerte, et hors d'une boîte aria-modal les lecteurs d'écran des téléphones
 * ne lisent plus rien. Une citation d'une réponse précédente s'ouvre pendant
 * que la suivante arrive : ce qui s'annonçait dans la conversation (étapes,
 * fin, arrêt, erreurs) se taisait.
 */
describe('sous la feuille d’aperçu modale', () => {
  const annonceDeLaFeuille = () =>
    document.querySelector('[data-testid="chat-preview-announce"]')?.textContent?.trim() ?? '';

  /** Une réponse finie, la suivante qui arrive, et une citation de la première ouverte. */
  async function feuilleOuvertePendantUneReponse() {
    reponse = () => flux([{ chunk: TEXTE, done: false }, FIN_NOUVELLE_API]);
    const ecran = render(Page);
    await poser('Quelles indemnités en cas de licenciement ?', ecran);
    await ecran.findByTestId('chat-citation');
    await waitFor(() => expect(annonce()).toBe('Réponse terminée, 1 article cité. 1 citation non retrouvée.'));

    let pilote!: ReturnType<typeof fluxPilote>;
    reponse = (init) => {
      pilote = fluxPilote(init.signal);
      return pilote.reponse;
    };
    await poser('Et pour un licenciement économique ?', ecran);
    await waitFor(() => expect(fil().getAttribute('aria-busy')).toBe('true'));
    await fireEvent.click(ecran.getAllByTestId('chat-citation')[0]);
    const feuille = await ecran.findByTestId('chat-preview');
    expect(feuille.getAttribute('aria-modal')).toBe('true');
    expect(inerte(fil())).toBe(true);
    return { ecran, feuille, pilote };
  }

  it('la fin de la réponse est dite par la région de la feuille, dans la boîte modale', async () => {
    const { feuille, pilote } = await feuilleOuvertePendantUneReponse();
    const region = feuille.querySelector('[data-testid="chat-preview-announce"]');
    expect(region?.getAttribute('role')).toBe('status');
    expect(inerte(region)).toBe(false);

    pilote.envoyer({ chunk: 'Voici la suite.', done: false });
    pilote.envoyer({ chunk: '', done: true, sources: [] });
    pilote.fermer();

    await waitFor(() => expect(annonceDeLaFeuille()).toBe('Réponse terminée.'));
    // Jamais deux fois : la région de la page garde sa phrase d'avant.
    expect(annonce()).toBe('Réponse terminée, 1 article cité. 1 citation non retrouvée.');
  });

  it('une erreur arrivée sous la feuille y est dite aussi', async () => {
    const { ecran, pilote } = await feuilleOuvertePendantUneReponse();

    pilote.envoyer({ chunk: '', done: false, error: 'Service saturé', error_code: 'overloaded' });

    const erreur = await ecran.findByTestId('chat-error');
    const texte = erreur.querySelector('p')?.textContent?.trim() ?? '';
    expect(texte).not.toBe('');
    await waitFor(() => expect(annonceDeLaFeuille()).toBe(texte));
  });

  it('la feuille refermée puis rouverte part d’une région vide', async () => {
    const { ecran, pilote } = await feuilleOuvertePendantUneReponse();
    pilote.envoyer({ chunk: '', done: true, sources: [] });
    pilote.fermer();
    await waitFor(() => expect(annonceDeLaFeuille()).toBe('Réponse terminée.'));

    await fireEvent.click(ecran.getByTestId('chat-preview-close'));
    await waitFor(() => expect(ecran.queryByTestId('chat-preview')).toBeNull());
    await fireEvent.click(ecran.getAllByTestId('chat-citation')[0]);
    await ecran.findByTestId('chat-preview');

    expect(annonceDeLaFeuille()).toBe('');
  });

  it('sans feuille, une erreur n’est dite qu’une fois, par son role="alert"', async () => {
    reponse = () => flux([{ chunk: '', done: false, error: 'Service saturé', error_code: 'overloaded' }]);
    const ecran = render(Page);
    await poser('Quelles indemnités en cas de licenciement ?', ecran);

    const erreur = await ecran.findByTestId('chat-error');
    expect(erreur.getAttribute('role')).toBe('alert');
    const texte = erreur.querySelector('p')?.textContent?.trim() ?? '';
    expect(texte).not.toBe('');
    await waitFor(() => expect(fil().getAttribute('aria-busy')).toBeNull());
    await tick();
    expect(annonce()).not.toContain(texte);
  });
});

/** Une réponse qui arrive, pilotée à la main, et la page qui l'attend. */
async function uneReponseQuiArrive() {
  let pilote!: ReturnType<typeof fluxPilote>;
  reponse = (init) => {
    pilote = fluxPilote(init.signal);
    return pilote.reponse;
  };
  const ecran = render(Page);
  await poser('Quelles indemnités en cas de licenciement ?', ecran);
  await waitFor(() => expect(questions).toHaveLength(1));
  expect(fil().getAttribute('aria-busy')).toBe('true');
  return { ecran, pilote };
}

/**
 * Sous lg, connecté, les conversations sont un tiroir aria-modal : hors de
 * lui, les lecteurs d'écran des téléphones ne lisent plus rien, région
 * d'annonce de la page comprise. Ouvert pendant une réponse, il taisait ses
 * étapes, sa fin, son arrêt et ses erreurs.
 */
describe('sous le tiroir des conversations (connecté, sous lg)', () => {
  const annonceDuTiroir = () =>
    document.querySelector('[data-testid="chat-drawer-announce"]')?.textContent?.trim() ?? '';

  beforeEach(() => authStore.login({ id: 1, email: 'a@b.cm', role: 'user' }, 'jeton'));
  afterEach(() => {
    cleanup();
    // La déconnexion prévient le serveur : pas de réseau dans un test.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
    authStore.logout();
    vi.unstubAllGlobals();
  });

  async function tiroirOuvertPendantUneReponse() {
    const { ecran, pilote } = await uneReponseQuiArrive();
    await fireEvent.click(ecran.getByTestId('conversations-toggle'));
    const tiroir = ecran.getByTestId('conversations-panel');
    await waitFor(() => expect(tiroir.getAttribute('aria-modal')).toBe('true'));
    return { ecran, tiroir, pilote };
  }

  it('la fin de la réponse est dite par la région du tiroir, dans la boîte modale', async () => {
    const { tiroir, pilote } = await tiroirOuvertPendantUneReponse();
    const region = tiroir.querySelector('[data-testid="chat-drawer-announce"]');
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(inerte(region)).toBe(false);
    // Présente et vide dès l'ouverture : connue avant sa première phrase.
    expect(annonceDuTiroir()).toBe('');

    pilote.envoyer({ chunk: 'Voici la réponse.', done: false });
    pilote.envoyer({ chunk: '', done: true, sources: [] });
    pilote.fermer();

    await waitFor(() => expect(annonceDuTiroir()).toBe('Réponse terminée.'));
    // Jamais deux fois : la région de la page n'a rien dit.
    expect(annonce()).toBe('');
  });

  it('une erreur arrivée sous le tiroir y est dite aussi', async () => {
    const { ecran, pilote } = await tiroirOuvertPendantUneReponse();

    pilote.envoyer({ chunk: '', done: false, error: 'Service saturé', error_code: 'overloaded' });

    const erreur = await ecran.findByTestId('chat-error');
    const texte = erreur.querySelector('p')?.textContent?.trim() ?? '';
    expect(texte).not.toBe('');
    await waitFor(() => expect(annonceDuTiroir()).toBe(texte));
  });

  it('refermé, il rend la parole à la page ; rouvert, il part d’une région vide', async () => {
    const { ecran, pilote } = await tiroirOuvertPendantUneReponse();
    pilote.envoyer({ chunk: 'Voici la réponse.', done: false });
    pilote.envoyer({ chunk: '', done: true, sources: [] });
    pilote.fermer();
    await waitFor(() => expect(annonceDuTiroir()).toBe('Réponse terminée.'));

    await fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(ecran.queryByTestId('chat-drawer-announce')).toBeNull());
    await fireEvent.click(ecran.getByTestId('conversations-toggle'));
    await waitFor(() => expect(ecran.queryByTestId('chat-drawer-announce')).not.toBeNull());
    expect(annonceDuTiroir()).toBe('');

    // Refermé, la réponse suivante est dite par la région de la page.
    await fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(ecran.queryByTestId('chat-drawer-announce')).toBeNull());
    reponse = () => flux([{ chunk: 'Autre réponse.', done: false }, { chunk: '', done: true, sources: [] }]);
    await poser('Et pour un licenciement économique ?', ecran);
    await waitFor(() => expect(annonce()).toBe('Réponse terminée.'));
  });

  /**
   * La conversation derrière le tiroir n'était pas inerte : l'alerte d'une
   * erreur (role="alert") restait dans l'arbre d'accessibilité, et Firefox
   * avec NVDA, qui ne retire pas la page sous aria-modal, la lisait en plus
   * de la région du tiroir : deux fois la même phrase.
   */
  it('la conversation derrière lui est inerte : une erreur n’y est dite que par la région du tiroir', async () => {
    const { ecran, pilote } = await tiroirOuvertPendantUneReponse();

    pilote.envoyer({ chunk: '', done: false, error: 'Service saturé', error_code: 'overloaded' });

    const erreur = await ecran.findByTestId('chat-error');
    const texte = erreur.querySelector('p')?.textContent?.trim() ?? '';
    await waitFor(() => expect(annonceDuTiroir()).toBe(texte));
    expect(inerte(erreur)).toBe(true);
    expect(inerte(ecran.getByTestId('chat-drawer-announce'))).toBe(false);
  });

  it('refermé par Échap, il rend le focus au bouton des conversations, la conversation redevenue active', async () => {
    // Le bouton est dans la conversation, inerte sous le tiroir, qui ne
    // cesse de l'être qu'après la mise à jour qui referme le tiroir : le
    // focus rendu pendant celle-ci était refusé, et retombait sur <body>.
    // jsdom ne connaît pas `inert` : un élément inerte y refuse le focus,
    // comme dans un navigateur.
    const focusDeJsdom = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
      if (!inerte(this)) focusDeJsdom.call(this, options);
    };
    try {
      const ecran = render(Page);
      const bascule = ecran.getByTestId('conversations-toggle');
      bascule.focus();
      await fireEvent.click(bascule);
      const tiroir = ecran.getByTestId('conversations-panel');
      await waitFor(() => expect(tiroir.contains(document.activeElement)).toBe(true));
      expect(inerte(bascule)).toBe(true);

      await fireEvent.keyDown(window, { key: 'Escape' });

      await waitFor(() => expect(document.activeElement).toBe(bascule));
      expect(inerte(bascule)).toBe(false);
    } finally {
      HTMLElement.prototype.focus = focusDeJsdom;
    }
  });

  /**
   * Recharger la liste la remplace par « Chargement… » le temps de la
   * requête : la ligne ou le bouton « Réessayer » qui avait le focus
   * disparaissait, et le focus retombait sur <body>, hors du tiroir et de son
   * piège.
   */
  describe('le focus dans la liste, pendant son rechargement', () => {
    const ANCIENNE = {
      session_id: 'sid-ancienne',
      title: 'Licenciement abusif',
      persona: 'citoyen',
      language: 'fr',
      created_at: '2026-10-20T10:00:00Z',
      updated_at: '2026-10-20T10:00:00Z',
    };
    const NEUVE = { ...ANCIENNE, session_id: 'sid-neuve', title: 'Indemnités de licenciement' };

    /** GET /rag/conversations répond tour à tour ces listes (un nombre : ce statut d'erreur), puis la dernière. */
    function conversationsServies(...reponses: (object[] | number)[]) {
      const parDefaut = simule.apiFetch.getMockImplementation()!;
      simule.apiFetch.mockImplementation(async (chemin: string, init?: RequestInit) => {
        if (chemin !== '/rag/conversations') return parDefaut(chemin, init);
        const suivante = reponses.length > 1 ? reponses.shift()! : reponses[0];
        return typeof suivante === 'number'
          ? new Response('{}', { status: suivante })
          : new Response(JSON.stringify(suivante), { status: 200, headers: { 'Content-Type': 'application/json' } });
      });
    }

    it('une ligne qui avait le focus le retrouve quand la réponse ajoute sa conversation', async () => {
      conversationsServies([ANCIENNE], [NEUVE, ANCIENNE]);
      const { ecran, pilote } = await tiroirOuvertPendantUneReponse();
      const ligne = await ecran.findByRole('button', { name: 'Licenciement abusif' });
      ligne.focus();

      // La première réponse d'une conversation neuve : la liste se recharge.
      pilote.envoyer({ chunk: 'Voici la réponse.', done: false });
      pilote.envoyer({ chunk: '', done: true, sources: [], session_id: 'sid-neuve' });
      pilote.fermer();

      await waitFor(() => expect(ecran.getAllByTestId('conversation-item')).toHaveLength(2));
      await waitFor(() =>
        expect(document.activeElement).toBe(ecran.getByRole('button', { name: 'Licenciement abusif' })),
      );
    });

    it('« Réessayer » réussi rend le focus à la première ligne', async () => {
      conversationsServies(500, [ANCIENNE]);
      const ecran = render(Page);
      await fireEvent.click(ecran.getByTestId('conversations-toggle'));
      const reessayer = await ecran.findByTestId('conversations-retry');
      reessayer.focus();

      await fireEvent.click(reessayer);

      const ligne = await ecran.findByRole('button', { name: 'Licenciement abusif' });
      await waitFor(() => expect(document.activeElement).toBe(ligne));
    });
  });

  it('la palette (Ctrl K), ouverte par-dessus le tiroir, dit la fin de la réponse à sa place', async () => {
    const { pilote } = await tiroirOuvertPendantUneReponse();
    commandPaletteOpen.set(true);
    try {
      pilote.envoyer({ chunk: 'Voici la réponse.', done: false });
      pilote.envoyer({ chunk: '', done: true, sources: [] });
      pilote.fermer();

      await waitFor(() => expect(get(annonceDansLaPalette)).toBe('Réponse terminée.'));
      expect(annonceDuTiroir()).toBe('');
      expect(annonce()).toBe('');
    } finally {
      commandPaletteOpen.set(false);
      annonceDansLaPalette.set('');
    }
  });
});

/**
 * La palette (Ctrl K), ouverte pendant une réponse pour chercher un texte,
 * rend toute la page inerte (src/routes/+layout.svelte), région d'annonce du
 * chat comprise : les étapes, la fin de la réponse et ses erreurs se
 * taisaient, et rien ne les redisait à sa fermeture. Elles passent par la
 * région de la palette (`annonceDansLaPalette`, rendue par CommandPalette).
 */
describe('sous la palette (Ctrl K)', () => {
  afterEach(() => {
    commandPaletteOpen.set(false);
    annonceDansLaPalette.set('');
  });

  it('la fin de la réponse est dite par la région de la palette, pas par celle de la page', async () => {
    const { pilote } = await uneReponseQuiArrive();
    commandPaletteOpen.set(true);

    pilote.envoyer({ chunk: 'Voici la réponse.', done: false });
    pilote.envoyer({ chunk: '', done: true, sources: [] });
    pilote.fermer();

    await waitFor(() => expect(get(annonceDansLaPalette)).toBe('Réponse terminée.'));
    expect(annonce()).toBe('');
  });

  it('une erreur arrivée sous la palette y est dite aussi', async () => {
    const { ecran, pilote } = await uneReponseQuiArrive();
    commandPaletteOpen.set(true);

    pilote.envoyer({ chunk: '', done: false, error: 'Service saturé', error_code: 'overloaded' });

    const erreur = await ecran.findByTestId('chat-error');
    const texte = erreur.querySelector('p')?.textContent?.trim() ?? '';
    expect(texte).not.toBe('');
    await waitFor(() => expect(get(annonceDansLaPalette)).toBe(texte));
  });

  it('refermée, elle rend la parole à la page', async () => {
    const { pilote } = await uneReponseQuiArrive();
    commandPaletteOpen.set(true);
    await tick();
    commandPaletteOpen.set(false);
    await tick();

    pilote.envoyer({ chunk: 'Voici la réponse.', done: false });
    pilote.envoyer({ chunk: '', done: true, sources: [] });
    pilote.fermer();

    await waitFor(() => expect(annonce()).toBe('Réponse terminée.'));
    expect(get(annonceDansLaPalette)).toBe('');
  });
});

/**
 * « Changer de profil », ouverte depuis le chat pendant une réponse, rend
 * toute la page inerte (src/routes/+layout.svelte), région d'annonce du chat
 * comprise : la fin de la réponse se taisait. Elle passe par la région de la
 * boîte (`annonceDuChat`, rendue par ChoixPersona).
 */
describe('sous la boîte « Changer de profil »', () => {
  afterEach(() => fermerChoixPersona());

  it('la fin de la réponse est dite par la région de la boîte, pas par celle de la page', async () => {
    const { ecran, pilote } = await uneReponseQuiArrive();
    await fireEvent.click(ecran.getByTestId('chat-persona-change'));
    expect(get(choixPersonaOuvert)).toBe(true);

    pilote.envoyer({ chunk: 'Voici la réponse.', done: false });
    pilote.envoyer({ chunk: '', done: true, sources: [] });
    pilote.fermer();

    await waitFor(() => expect(get(annonceDuChat)).toBe('Réponse terminée.'));
    expect(annonce()).toBe('');
  });

  it('une erreur arrivée sous la boîte y est dite aussi', async () => {
    const { ecran, pilote } = await uneReponseQuiArrive();
    await fireEvent.click(ecran.getByTestId('chat-persona-change'));

    pilote.envoyer({ chunk: '', done: false, error: 'Service saturé', error_code: 'overloaded' });

    const erreur = await ecran.findByTestId('chat-error');
    const texte = erreur.querySelector('p')?.textContent?.trim() ?? '';
    expect(texte).not.toBe('');
    await waitFor(() => expect(get(annonceDuChat)).toBe(texte));
  });

  it('refermée sans rien changer, elle rend la parole à la page', async () => {
    const { ecran, pilote } = await uneReponseQuiArrive();
    await fireEvent.click(ecran.getByTestId('chat-persona-change'));
    fermerChoixPersona();
    await tick();

    pilote.envoyer({ chunk: 'Voici la réponse.', done: false });
    pilote.envoyer({ chunk: '', done: true, sources: [] });
    pilote.fermer();

    await waitFor(() => expect(annonce()).toBe('Réponse terminée.'));
    expect(get(annonceDuChat)).toBe('');
  });
});

describe('la question du profil, dans le fil (P5)', () => {
  beforeEach(() => {
    localStorage.removeItem('jurix-persona');
    personaStore._reinitialiser();
  });

  it('sans profil, la première question attend « Qui êtes-vous ? », puis part avec le profil choisi', async () => {
    reponse = () => flux([{ chunk: 'Voici la réponse.', done: false }, { chunk: '', done: true, sources: [], session_id: 'sid-p5', persona: 'avocat' }]);
    const ecran = render(Page);

    await poser('Quels sont les éléments constitutifs de l’abus de confiance ?', ecran);

    expect(await ecran.findByTestId('chat-profile-question')).toBeTruthy();
    expect(questions).toHaveLength(0);
    // Ni boîte modale, ni envoi possible tant que la question attend.
    expect(document.querySelector('[data-testid="persona-dialog"]')).toBeNull();
    expect((ecran.getByRole('button', { name: 'Envoyer' }) as HTMLButtonElement).disabled).toBe(true);

    await fireEvent.click(ecran.getByTestId('chat-profile-avocat'));

    await waitFor(() => expect(questions).toHaveLength(1));
    expect(questions[0].persona).toBe('avocat');
    expect(questions[0].question).toBe('Quels sont les éléments constitutifs de l’abus de confiance ?');
    expect(simule.changerPersona).toHaveBeenCalledWith('avocat');
    expect(await ecran.findByText('Voici la réponse.')).toBeTruthy();
    expect(ecran.getByTestId('chat-profile-chosen').textContent).toContain('Avocat ou juriste');
    // La conversation n'a pas été remplacée par le changement de profil.
    expect(fil().textContent).toContain('abus de confiance');
  });

  it('« Continuer sans profil » : la question part en profil général, sans profil dans la requête', async () => {
    reponse = () => flux([{ chunk: 'Réponse générale.', done: false }, { chunk: '', done: true, sources: [] }]);
    const ecran = render(Page);

    await poser('Quels sont mes droits en garde à vue ?', ecran);
    await fireEvent.click(await ecran.findByTestId('chat-profile-skip'));

    await waitFor(() => expect(questions).toHaveLength(1));
    expect('persona' in questions[0]).toBe(false);
    expect(simule.refuser).toHaveBeenCalledTimes(1);
  });

  it('un profil déjà choisi : pas de question, la question part aussitôt', async () => {
    localStorage.setItem('jurix-persona', 'entrepreneur');
    personaStore._reinitialiser();
    reponse = () => flux([{ chunk: 'Réponse.', done: false }, { chunk: '', done: true, sources: [] }]);
    const ecran = render(Page);

    await poser('Comment obtenir une injonction de payer ?', ecran);

    await waitFor(() => expect(questions).toHaveLength(1));
    expect(questions[0].persona).toBe('entrepreneur');
    expect(ecran.queryByTestId('chat-profile-question')).toBeNull();
    expect(get(personaStore).persona).toBe('entrepreneur');
  });

  it('la question qui attend son profil n’est pas une conversation à perdre : « Changer de profil » ne prévient pas', async () => {
    reponse = () => flux([{ chunk: 'Voici la réponse.', done: false }, { chunk: '', done: true, sources: [] }]);
    const ecran = render(Page);

    await poser('Quels sont les éléments constitutifs de l’abus de confiance ?', ecran);
    await ecran.findByTestId('chat-profile-question');

    // Le profil choisi la fait partir dans le même fil : rien ne serait perdu.
    expect(get(conversationDuChatEnCours)).toBe(false);

    await fireEvent.click(ecran.getByTestId('chat-profile-avocat'));
    await waitFor(() => expect(questions).toHaveLength(1));
    expect(get(conversationDuChatEnCours)).toBe(true);
  });

  /**
   * Connecté, le profil du compte arrive au démarrage (`GET /auth/me`). Posée
   * avant, la question demandait un profil que le compte avait déjà, et le
   * choix fait dans le fil le remplaçait sur le compte ; « Continuer sans
   * profil » effaçait celui qui venait d'arriver.
   */
  it('connecté, la question attend la lecture du compte : son profil la fait partir, sans question ni envoi au compte', async () => {
    let finirLaLecture!: () => void;
    simule.lecture.mockReturnValue(new Promise<void>((r) => (finirLaLecture = r)));
    reponse = () => flux([{ chunk: 'Voici la réponse.', done: false }, { chunk: '', done: true, sources: [] }]);
    const ecran = render(Page);

    await poser('Quels sont les éléments constitutifs de l’abus de confiance ?', ecran);

    // Pendant la lecture : la question du lecteur et l'attente, pas « Qui êtes-vous ? ».
    expect(await ecran.findByTestId('chat-progress')).toBeTruthy();
    expect(fil().textContent).toContain('abus de confiance');
    expect(ecran.queryByTestId('chat-profile-question')).toBeNull();
    expect(questions).toHaveLength(0);

    // Le profil du compte arrive (changement passif), puis la lecture finit.
    personaStore.appliquerDepuisCompte('avocat');
    finirLaLecture();

    await waitFor(() => expect(questions).toHaveLength(1));
    expect(questions[0].persona).toBe('avocat');
    expect(await ecran.findByText('Voici la réponse.')).toBeTruthy();
    expect(ecran.queryByTestId('chat-profile-question')).toBeNull();
    expect(simule.changerPersona).not.toHaveBeenCalled();
    expect(simule.refuser).not.toHaveBeenCalled();
    expect(ecran.getByTestId('chat-persona').getAttribute('data-persona')).toBe('avocat');
  });

  it('connecté, un compte sans profil : « Qui êtes-vous ? » vient après la lecture', async () => {
    let finirLaLecture!: () => void;
    simule.lecture.mockReturnValue(new Promise<void>((r) => (finirLaLecture = r)));
    const ecran = render(Page);

    await poser('Quels sont mes droits en garde à vue ?', ecran);
    await ecran.findByTestId('chat-progress');
    expect(ecran.queryByTestId('chat-profile-question')).toBeNull();
    // L'envoi reste fermé pendant l'attente, comme pendant la question.
    expect((ecran.getByRole('button', { name: 'Envoyer' }) as HTMLButtonElement).disabled).toBe(true);

    finirLaLecture();

    expect(await ecran.findByTestId('chat-profile-question')).toBeTruthy();
    await waitFor(() => expect(ecran.queryByTestId('chat-progress')).toBeNull());
    expect(questions).toHaveLength(0);
    await waitFor(() => expect(annonce()).toBe('Choisissez votre profil pour obtenir la réponse.'));
  });

  it('un profil arrivé d’ailleurs (compte, autre onglet) répond à la question posée, sans rien écrire', async () => {
    reponse = () => flux([{ chunk: 'Voici la réponse.', done: false }, { chunk: '', done: true, sources: [] }]);
    const ecran = render(Page);
    await poser('Quels sont les éléments constitutifs de l’abus de confiance ?', ecran);
    await ecran.findByTestId('chat-profile-question');

    personaStore.appliquerDepuisCompte('avocat');

    await waitFor(() => expect(questions).toHaveLength(1));
    expect(questions[0].persona).toBe('avocat');
    expect(ecran.getByTestId('chat-profile-chosen').textContent).toContain('Avocat ou juriste');
    expect(simule.changerPersona).not.toHaveBeenCalled();
    expect(simule.refuser).not.toHaveBeenCalled();
  });

  /**
   * L'envoi au clavier pose le focus sur le premier profil. Un profil choisi
   * dans un autre onglet répond à la question à sa place : les boutons
   * disparaissaient avec le focus, retombé au début de la page.
   */
  it('un profil venu d’un autre onglet, le focus sur un bouton de profil : il passe à la réponse', async () => {
    reponse = () => flux([{ chunk: 'Voici la réponse.', done: false }, { chunk: '', done: true, sources: [] }]);
    const ecran = render(Page);
    await fireEvent.input(ecran.getByRole('textbox'), { target: { value: 'Quels sont mes droits en garde à vue ?' } });
    const bouton = ecran.getByTestId('chat-send');
    bouton.focus();
    await fireEvent.click(bouton);
    const citoyen = await ecran.findByTestId('chat-profile-citoyen');
    await waitFor(() => expect(document.activeElement).toBe(citoyen));

    // L'autre onglet écrit le profil, et l'événement `storage` le fait relire.
    localStorage.setItem('jurix-persona', 'avocat');
    personaStore.relire();

    await waitFor(() => expect(questions).toHaveLength(1));
    expect(questions[0].persona).toBe('avocat');
    await waitFor(() => expect(document.activeElement).toBe(ecran.getByTestId('chat-profile-chosen')));
    expect(await ecran.findByText('Voici la réponse.')).toBeTruthy();
    expect(document.activeElement).toBe(ecran.getByTestId('chat-profile-chosen'));
  });

  it('un refus venu d’un autre onglet ne répond pas à la place du lecteur : la question reste posée', async () => {
    const ecran = render(Page);
    await poser('Quels sont mes droits en garde à vue ?', ecran);
    await ecran.findByTestId('chat-profile-question');

    document.cookie = 'jurix-persona-refus=1; Path=/';
    personaStore.relire();
    await tick();

    expect(ecran.getByTestId('chat-profile-skip')).toBeTruthy();
    expect(questions).toHaveLength(0);
  });
});
