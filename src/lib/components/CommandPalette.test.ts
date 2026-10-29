import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
import type { BeforeNavigate } from '@sveltejs/kit';
import { annonceDansLaPalette, commandPaletteOpen } from '$lib/stores/commandPalette';
import { choixPersonaOuvert } from '$lib/stores/persona';
import CommandPalette from './CommandPalette.svelte';

/**
 * La palette Ctrl K, avec les vrais textes de l'interface : la nature de
 * chaque texte proposé par l'API vient de la table commune
 * ($lib/type-de-texte), jamais « Loi » pour tous, et sa cote interne
 * (« PRC-4722 », `reference`) ne s'affiche pas (P2). Son « N° » s'écrit
 * comme dans les listes (« n° 92/007 »). Deux voix au plus (Q5 A) : rien en
 * chasse fixe hors des touches du clavier.
 */

// `afterNavigate` simulé comme `beforeNavigate` : à l'arrivée d'une
// navigation, la palette ouverte rend le focus à son champ (« une navigation
// sans keepFocus, arrivée palette ouverte… »). Un retour à la fermeture en fin
// de navigation ferait échouer « une navigation commencée palette fermée ne la
// referme pas à son arrivée ».
vi.mock('$app/navigation', () => ({ afterNavigate: vi.fn(), beforeNavigate: vi.fn(), goto: vi.fn() }));

// jsdom n'a pas l'API Web Animations, dont les transitions de Svelte 5 ont besoin.
Element.prototype.animate = vi.fn(() => ({
  onfinish: null,
  cancel: vi.fn(),
  finished: Promise.resolve(),
  currentTime: 0,
})) as unknown as typeof Element.prototype.animate;

/** GET /search/suggest : `id`, `title`, `reference` (la cote), rien d'autre. Intitulés de jurix_dev. */
const SUGGESTIONS = [
  { id: 2274, title: 'Loi N°92/007 du 14 août 1992 portant Code du travail', reference: 'LOI-1992-007' },
  {
    id: 1806,
    title: 'Décret N°2018/9387/CAB/PM du 30 décembre 2018 fixant les modalités d’application du Code du travail',
    reference: 'PRC-6914',
  },
  { id: 2153, title: 'Ordonnance N°2020/001 du 03 juin 2020 modifiant et complétant certaines dispositions', reference: 'ORD-2020-001' },
];

/** Les mêmes intitulés tels que la palette les écrit : « n° », puis une espace insécable. */
const AFFICHES = [
  'Loi n°\u00a092/007 du 14 août 1992 portant Code du travail',
  'Décret n°\u00a02018/9387/CAB/PM du 30 décembre 2018 fixant les modalités d’application du Code du travail',
  'Ordonnance n°\u00a02020/001 du 03 juin 2020 modifiant et complétant certaines dispositions',
];

/**
 * Ce que GET /search/suggest rend ensuite pour une saisie plus longue :
 * d'autres textes, aux rangs des premiers.
 */
const AUTRES_SUGGESTIONS = [
  { id: 2301, title: 'Loi N° 2016/007 du 12 juillet 2016 portant Code Pénal', reference: 'LOI-2016-007' },
];
const AUTRE_AFFICHE = 'Loi n°\u00a02016/007 du 12 juillet 2016 portant Code Pénal';

/** Une réponse de /search/suggest qui n'arrive que sur demande (`repondre`), comme sur un réseau lent. */
function reponseDifferee(suggestions: unknown[]) {
  let repondre!: () => void;
  const promesse = new Promise<Response>((resolve) => {
    repondre = () => resolve({ ok: true, json: async () => ({ suggestions }) } as Response);
  });
  return { promesse, repondre };
}

/** Ouvre la palette sur « travail » et attend les textes de l'API. */
async function chercherTravail() {
  const rendu = render(CommandPalette);
  await fireEvent.input(rendu.getByRole('textbox'), { target: { value: 'travail' } });
  await waitFor(() => expect(rendu.container.textContent).toContain(AFFICHES[2]), { timeout: 2000 });
  return rendu;
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ suggestions: SUGGESTIONS }), { status: 200 })),
    );
    commandPaletteOpen.set(true);
  });

  afterEach(() => {
    cleanup();
    commandPaletteOpen.set(false);
    vi.unstubAllGlobals();
  });

  it('nomme chaque texte par sa nature, sans cote interne', async () => {
    const { container } = await chercherTravail();
    const lignes = Array.from(container.querySelectorAll('[role="dialog"] button')).filter((b) =>
      AFFICHES.some((titre) => b.textContent?.includes(titre.slice(0, 30))),
    );
    const badges = lignes.map((b) => b.querySelector('span.rounded-full')?.textContent?.trim());
    expect(badges).toEqual(['Loi', 'Décret', 'Ordonnance']);

    // Ni la cote, ni « toutes les lois », ni la casse anglaise du surtitre.
    expect(container.textContent).not.toMatch(/PRC-\d|LOI-1992|ORD-2020/);
    expect(container.textContent).toContain('Rechercher « travail » dans tous les textes');
    expect(container.textContent).toContain('Résultats et actions');
    expect(container.textContent).not.toContain('&');
  });

  it('écrit « n° 92/007 » comme les listes, et sépare les repères d’un point médian', async () => {
    const { container } = await chercherTravail();
    const texte = container.textContent ?? '';
    for (const titre of AFFICHES) expect(texte).toContain(titre);
    // Plus d'intitulé brut, « N » capital collé au numéro.
    expect(texte).not.toMatch(/N°\s*\d/);
    // L'article de blog « Travail » : le point médian des listes, plus la puce.
    expect(texte).toContain('Article de blog\u00a0· Travail');
    expect(texte).not.toContain('•');
  });

  it('au téléphone, pas de pied : les touches n’y servent à rien', () => {
    const { getByText } = render(CommandPalette);
    const pied = getByText('Palette universelle JuriX').parentElement;
    // Plus rien sous sm ; à partir de sm, les touches sous un pointeur fin seulement.
    expect(pied?.classList.contains('hidden')).toBe(true);
    expect(pied?.classList.contains('sm:flex')).toBe(true);
    expect(getByText('Naviguer').closest('div')?.classList.contains('[@media(pointer:coarse)]:hidden')).toBe(true);
  });

  it('deux voix au plus : la chasse fixe ne sert qu’aux touches', async () => {
    const { container } = render(CommandPalette);
    const enChasseFixe = Array.from(container.querySelectorAll('.font-mono')).filter((el) => el.tagName !== 'KBD');
    expect(enChasseFixe).toEqual([]);
    expect(container.querySelector('.uppercase')).toBeNull();
  });
});

/** La ligne surlignée : fond zinc-100, celui de la sélection. */
const surlignee = (ligne: HTMLElement): boolean => ligne.classList.contains('bg-zinc-100');

/**
 * Entrée comme dans un navigateur, sur ce qui a le focus : non retenue
 * (`preventDefault`), elle active le bouton ou le lien (son clic), ce que
 * jsdom ne fait pas de lui-même.
 */
async function entree(): Promise<void> {
  const cible = document.activeElement as HTMLElement;
  const suivie = await fireEvent.keyDown(cible, { key: 'Enter' });
  if (suivie && (cible instanceof HTMLButtonElement || cible instanceof HTMLAnchorElement)) await fireEvent.click(cible);
}

/**
 * Une navigation de SvelteKit, simulée : les rappels que la palette a
 * inscrits au départ (`beforeNavigate`) puis à l'arrivée (`afterNavigate`).
 * Les deux listes sont vidées avant chaque rendu (`beforeEach`).
 */
function navigation(type: BeforeNavigate['type']) {
  const nav = { type, from: null, to: null, willUnload: false, cancel: vi.fn(), complete: Promise.resolve() };
  return {
    depart: () => vi.mocked(beforeNavigate).mock.calls.forEach(([rappel]) => rappel(nav as BeforeNavigate)),
    arrivee: () => vi.mocked(afterNavigate).mock.calls.forEach(([rappel]) => rappel(nav as never)),
  };
}

/**
 * Au clavier, Entrée active ce qui a le focus. La palette retenait toute
 * Entrée pour ouvrir la ligne surlignée, que la tabulation ne déplaçait pas :
 * Tab jusqu'au blog puis Entrée menait au chat, et Entrée sur « Effacer »
 * lançait la recherche au lieu d'effacer.
 *
 * La ligne surlignée reste celle qu'Entrée active : après les flèches depuis
 * « Effacer », à l'arrivée de résultats sous une ligne qui a le focus, après
 * un effacement au clavier, et quand arrive la réponse d'une saisie passée.
 */
describe('CommandPalette au clavier', () => {
  beforeEach(() => {
    vi.mocked(goto).mockClear();
    vi.mocked(beforeNavigate).mockClear();
    vi.mocked(afterNavigate).mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ suggestions: SUGGESTIONS }), { status: 200 })),
    );
    commandPaletteOpen.set(true);
  });

  afterEach(() => {
    cleanup();
    commandPaletteOpen.set(false);
    vi.unstubAllGlobals();
  });

  /** Ouverte, la palette donne le focus à son champ, une passe après son affichage : on l'attend. */
  async function ouvrir() {
    const rendu = render(CommandPalette);
    await waitFor(() => expect(document.activeElement).toBe(rendu.getByRole('textbox')));
    return rendu;
  }

  it('Entrée sur une ligne atteinte à la tabulation ouvre cette ligne, surlignée', async () => {
    const { getByRole } = await ouvrir();
    const assistant = getByRole('button', { name: /^Poser une question à l’assistant/ });
    const blog = getByRole('button', { name: /^L’actualité décryptée/ });
    blog.focus();
    await tick();
    // La ligne surlignée suit le focus.
    expect(surlignee(blog)).toBe(true);
    expect(surlignee(assistant)).toBe(false);
    // Entrée reste au bouton, qui s'active lui-même (son clic).
    expect(await fireEvent.keyDown(blog, { key: 'Enter' })).toBe(true);
    expect(goto).not.toHaveBeenCalled();
    await fireEvent.click(blog);
    expect(goto).toHaveBeenCalledWith('/blog');
  });

  it('Entrée sur « Effacer » efface la saisie, sans lancer la recherche', async () => {
    const { getAllByRole, getByRole } = await chercherTravail();
    vi.mocked(goto).mockClear();
    // La sélection sur la sixième ligne, au-delà des quatre raccourcis.
    const champDeSaisie = getByRole('textbox');
    for (let i = 0; i < 5; i++) await fireEvent.keyDown(champDeSaisie, { key: 'ArrowDown' });
    expect(surlignee(getByRole('button', { name: /^Rechercher « travail »/ }))).toBe(false);
    expect(getAllByRole('button').filter(surlignee)).toHaveLength(1);
    const effacer = getByRole('button', { name: 'Effacer' });
    effacer.focus();
    expect(await fireEvent.keyDown(effacer, { key: 'Enter' })).toBe(true);
    expect(goto).not.toHaveBeenCalled();
    await fireEvent.click(effacer);
    const champ = getByRole('textbox') as HTMLInputElement;
    expect(champ.value).toBe('');
    expect(document.activeElement).toBe(champ);
    // Les raccourcis reviennent, le premier surligné : Entrée dans le champ l'ouvrirait.
    expect(surlignee(getByRole('button', { name: /^Poser une question à l’assistant/ }))).toBe(true);
  });

  it('Entrée dans le champ ouvre toujours la ligne surlignée', async () => {
    const { getByRole } = await ouvrir();
    const champ = getByRole('textbox');
    await fireEvent.keyDown(champ, { key: 'ArrowDown' });
    expect(surlignee(getByRole('button', { name: /^L’actualité décryptée/ }))).toBe(true);
    expect(await fireEvent.keyDown(champ, { key: 'Enter' })).toBe(false);
    expect(goto).toHaveBeenCalledWith('/blog');
  });

  it('les flèches, depuis une ligne, y emmènent le focus avec la sélection', async () => {
    const { getByRole } = await ouvrir();
    const blog = getByRole('button', { name: /^L’actualité décryptée/ });
    const textes = getByRole('button', { name: /^Explorer tous les textes/ });
    blog.focus();
    await fireEvent.keyDown(blog, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(textes);
    expect(surlignee(textes)).toBe(true);
    await fireEvent.keyDown(textes, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(blog);
    expect(surlignee(blog)).toBe(true);
    // Depuis le champ, le focus y reste : seule la sélection bouge.
    const champ = getByRole('textbox');
    champ.focus();
    await fireEvent.keyDown(champ, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(champ);
    expect(surlignee(textes)).toBe(true);
  });

  it('depuis « Effacer », les flèches emmènent le focus sur la ligne surlignée, qu’Entrée ouvre', async () => {
    const { getByRole } = await chercherTravail();
    vi.mocked(goto).mockClear();
    // Tab depuis le champ : « Effacer » est le premier arrêt dès qu'il y a une saisie.
    const effacer = getByRole('button', { name: 'Effacer' });
    effacer.focus();
    await fireEvent.keyDown(effacer, { key: 'ArrowDown' });
    const assistant = getByRole('button', { name: /^Demander à l’assistant : « travail »/ });
    expect(surlignee(assistant)).toBe(true);
    expect(document.activeElement).toBe(assistant);
    // Entrée, comme l'annonce le pied (↵ Ouvrir) : la ligne surlignée, sans rien effacer.
    await entree();
    expect(goto).toHaveBeenCalledWith('/chat?q=travail');
  });

  it('des résultats arrivés pendant qu’une ligne a le focus le rendent au champ, où Entrée suit la surbrillance', async () => {
    const lente = reponseDifferee(AUTRES_SUGGESTIONS);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ suggestions: SUGGESTIONS }), { status: 200 }))
        .mockReturnValueOnce(lente.promesse),
    );
    const { container, getByRole } = await ouvrir();
    const champ = getByRole('textbox');
    // « trav » affiche ses textes ; « travail » part, et sa réponse tarde.
    await fireEvent.input(champ, { target: { value: 'trav' } });
    await waitFor(() => expect(container.textContent).toContain(AFFICHES[2]), { timeout: 2000 });
    await fireEvent.input(champ, { target: { value: 'travail' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2), { timeout: 2000 });
    // Tab jusqu'à une loi de l'ancienne liste.
    const ligneDeLaLoi = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(
      (b) => b.textContent?.includes(AFFICHES[0]),
    );
    ligneDeLaLoi!.focus();
    await tick();
    expect(surlignee(ligneDeLaLoi!)).toBe(true);

    lente.repondre();
    await waitFor(() => expect(container.textContent).toContain(AUTRE_AFFICHE));
    // Sa ligne montre maintenant un autre texte : le focus n'y reste pas.
    expect(container.textContent).not.toContain(AFFICHES[0]);
    expect(document.activeElement).toBe(champ);
    expect(surlignee(getByRole('button', { name: /^Rechercher « travail »/ }))).toBe(true);
    await entree();
    expect(goto).toHaveBeenCalledWith('/search?q=travail');
  });

  it('effacée au clavier, la saisie rend les raccourcis, le premier surligné, qu’Entrée ouvre', async () => {
    const { getAllByRole, getByRole } = await chercherTravail();
    vi.mocked(goto).mockClear();
    const champ = getByRole('textbox');
    // La sélection sur la sixième ligne, au-delà des quatre raccourcis.
    for (let i = 0; i < 5; i++) await fireEvent.keyDown(champ, { key: 'ArrowDown' });
    // Ctrl A, puis Retour arrière : le champ vide, sans passer par « Effacer ».
    await fireEvent.input(champ, { target: { value: '' } });
    expect(surlignee(getByRole('button', { name: /^Poser une question à l’assistant/ }))).toBe(true);
    expect(getAllByRole('button').filter(surlignee)).toHaveLength(1);
    await entree();
    expect(goto).toHaveBeenCalledWith('/chat');
  });

  it('une réponse arrivée après l’effacement ne touche ni aux raccourcis, ni à la sélection, ni au focus', async () => {
    const lente = reponseDifferee(SUGGESTIONS);
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(lente.promesse));
    const { container, getByRole } = await ouvrir();
    const champ = getByRole('textbox');
    await fireEvent.input(champ, { target: { value: 'travail' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1), { timeout: 2000 });
    // Effacée avant la réponse, puis Tab jusqu'au raccourci du blog.
    await fireEvent.input(champ, { target: { value: '' } });
    const blog = getByRole('button', { name: /^L’actualité décryptée/ });
    blog.focus();

    lente.repondre();
    await new Promise((fin) => setTimeout(fin, 0));
    await tick();
    expect(container.textContent).toContain('Raccourcis');
    expect(container.textContent).not.toContain(AFFICHES[0]);
    expect(document.activeElement).toBe(blog);
    expect(surlignee(blog)).toBe(true);
    // Plus de sablier : la recherche abandonnée ne tourne plus.
    expect(container.querySelector('[data-icone="loader-circle"]')).toBeNull();
  });
});

/**
 * Fermée, la palette rend le focus à l'élément qui l'avait ouverte. Il
 * tombait sur <body>, et la tabulation suivante repartait du bout du
 * document (la palette est le dernier élément du layout racine) au lieu de
 * reprendre à la loupe de l'en-tête.
 */
describe('CommandPalette, focus rendu à la fermeture', () => {
  let loupe: HTMLButtonElement;

  beforeEach(() => {
    vi.mocked(goto).mockClear();
    vi.mocked(beforeNavigate).mockClear();
    vi.mocked(afterNavigate).mockClear();
    // Une saisie lance GET /search/suggest : jamais vers une vraie API.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ suggestions: SUGGESTIONS }), { status: 200 })),
    );
    commandPaletteOpen.set(false);
    loupe = document.body.appendChild(document.createElement('button'));
    loupe.textContent = 'Loupe';
  });

  afterEach(() => {
    cleanup();
    commandPaletteOpen.set(false);
    loupe.remove();
    vi.unstubAllGlobals();
  });

  /** La loupe a le focus et ouvre la palette ; le champ prend le focus. */
  async function ouvrirDepuisLaLoupe() {
    const rendu = render(CommandPalette);
    loupe.focus();
    commandPaletteOpen.set(true);
    const champ = await waitFor(() => rendu.getByRole('textbox'));
    await waitFor(() => expect(document.activeElement).toBe(champ));
    return { ...rendu, champ };
  }

  it('Échap le rend à la loupe', async () => {
    const { champ } = await ouvrirDepuisLaLoupe();
    await fireEvent.keyDown(champ, { key: 'Escape' });
    await tick();
    expect(get(commandPaletteOpen)).toBe(false);
    expect(document.activeElement).toBe(loupe);
  });

  it('un clic sur le fond aussi', async () => {
    const { container } = await ouvrirDepuisLaLoupe();
    const fond = container.querySelector<HTMLElement>('[role="dialog"] > .backdrop-blur-sm');
    expect(fond).not.toBeNull();
    await fireEvent.click(fond!);
    await tick();
    expect(get(commandPaletteOpen)).toBe(false);
    expect(document.activeElement).toBe(loupe);
  });

  it('Ctrl K, qui la referme, aussi', async () => {
    const { champ } = await ouvrirDepuisLaLoupe();
    await fireEvent.keyDown(champ, { key: 'k', ctrlKey: true });
    await tick();
    expect(get(commandPaletteOpen)).toBe(false);
    expect(document.activeElement).toBe(loupe);
  });

  it('pas avant une navigation : SvelteKit pose le focus sur la page d’arrivée', async () => {
    const { getByRole } = await ouvrirDepuisLaLoupe();
    await fireEvent.click(getByRole('button', { name: /^Explorer tous les textes/ }));
    await tick();
    expect(goto).toHaveBeenCalledWith('/laws');
    expect(get(commandPaletteOpen)).toBe(false);
    expect(document.activeElement).not.toBe(loupe);
  });

  it('la page inerte, sous la palette, ne garde ni le focus ni Entrée : le champ les reprend', async () => {
    // Un navigateur qui ignore `inert` (Safari avant 15.5, Firefox avant
    // 112) : la page du layout n'y porte que la propriété, que Svelte pose
    // sans attribut, comme ici. Maj+Tab menait du champ au bouton d'envoi
    // du chat, brouillon en attente, invisible sous le fond, qu'Espace
    // activait.
    const { champ } = await ouvrirDepuisLaLoupe();
    const pageInerte = document.body.appendChild(document.createElement('div'));
    pageInerte.inert = true;
    const envoi = pageInerte.appendChild(document.createElement('button'));
    const envoyer = vi.fn();
    envoi.addEventListener('click', envoyer);
    try {
      envoi.focus();
      expect(document.activeElement).toBe(champ);
      // Une Entrée qui l'atteindrait quand même est retenue, le focus au champ.
      expect(await fireEvent.keyDown(envoi, { key: 'Enter' })).toBe(false);
      expect(envoyer).not.toHaveBeenCalled();
      expect(get(commandPaletteOpen)).toBe(true);
      expect(document.activeElement).toBe(champ);
      expect(goto).not.toHaveBeenCalled();
      // Revenue au champ, Entrée ouvre la ligne surlignée.
      await entree();
      expect(goto).toHaveBeenCalledWith('/chat');
    } finally {
      pageInerte.remove();
    }
  });

  it('hors de la page inerte, Entrée garde son effet : seule la page cachée est retenue', async () => {
    // Un contrôle ni dans la palette ni dans la page inerte, comme les
    // boutons de la boîte « Changer de profil », posée au-dessus de la
    // palette : Entrée y était retenue, et le focus renvoyé au champ caché
    // dessous.
    await ouvrirDepuisLaLoupe();
    const choix = document.body.appendChild(document.createElement('button'));
    try {
      choix.focus();
      expect(document.activeElement).toBe(choix);
      expect(await fireEvent.keyDown(choix, { key: 'Enter' })).toBe(true);
      expect(document.activeElement).toBe(choix);
    } finally {
      choix.remove();
    }
  });

  it('une navigation qui démarre palette ouverte la ferme, sans reprendre le focus', async () => {
    // Retour du navigateur : la palette, dans le layout racine, restait
    // ouverte par-dessus la page d'arrivée.
    await ouvrirDepuisLaLoupe();
    const retour = navigation('popstate');
    retour.depart();
    await tick();
    expect(get(commandPaletteOpen)).toBe(false);
    expect(document.activeElement).not.toBe(loupe);
    retour.arrivee();
    expect(get(commandPaletteOpen)).toBe(false);
  });

  it('une navigation commencée palette fermée ne la referme pas à son arrivée', async () => {
    // Une case de filtre cochée sur /search (`goto`, `keepFocus`) : la
    // recherche tarde, on ouvre la palette et l'on tape. Les résultats
    // arrivés, elle se fermait en pleine frappe.
    const { getByRole } = render(CommandPalette);
    const filtre = navigation('goto');
    filtre.depart();
    loupe.focus();
    commandPaletteOpen.set(true);
    const champ = await waitFor(() => getByRole('textbox'));
    await waitFor(() => expect(document.activeElement).toBe(champ));
    await fireEvent.input(champ, { target: { value: 'code du travail' } });
    filtre.arrivee();
    await tick();
    expect(get(commandPaletteOpen)).toBe(true);
    expect((getByRole('textbox') as HTMLInputElement).value).toBe('code du travail');
    expect(document.activeElement).toBe(champ);
    // Et la recherche de la saisie suit son cours.
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it('une navigation sans keepFocus, arrivée palette ouverte, rend le focus au champ', async () => {
    // Un lien lent (un texte d'une liste, la navigation du site) : on ouvre
    // la palette pendant l'attente, et l'on tape. À l'arrivée, SvelteKit
    // remet le focus sur <body> (`reset_focus`, simulé par `blur`), juste
    // avant les rappels `afterNavigate` : la suite de la frappe n'allait
    // nulle part, et le clavier du téléphone se fermait.
    const { getByRole } = render(CommandPalette);
    const lien = navigation('link');
    lien.depart();
    loupe.focus();
    commandPaletteOpen.set(true);
    const champ = (await waitFor(() => getByRole('textbox'))) as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(champ));
    await fireEvent.input(champ, { target: { value: 'code du' } });
    champ.blur();
    expect(document.activeElement).toBe(document.body);
    lien.arrivee();
    expect(document.activeElement).toBe(champ);
    expect(get(commandPaletteOpen)).toBe(true);
    expect(champ.value).toBe('code du');
  });

  it('un focus posé ailleurs entre-temps garde sa place', async () => {
    await ouvrirDepuisLaLoupe();
    // Un contrôle hors de la palette et hors de la page inerte, d'où le
    // focus n'est pas renvoyé au champ, puis Échap.
    const ailleurs = document.body.appendChild(document.createElement('button'));
    try {
      ailleurs.focus();
      await fireEvent.keyDown(ailleurs, { key: 'Escape' });
      await tick();
      expect(get(commandPaletteOpen)).toBe(false);
      expect(document.activeElement).toBe(ailleurs);
    } finally {
      ailleurs.remove();
    }
  });
});

describe('CommandPalette à l’ouverture', () => {
  beforeEach(() => {
    vi.mocked(goto).mockClear();
    vi.mocked(beforeNavigate).mockClear();
    vi.mocked(afterNavigate).mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ suggestions: SUGGESTIONS }), { status: 200 })),
    );
    commandPaletteOpen.set(false);
  });

  afterEach(() => {
    cleanup();
    commandPaletteOpen.set(false);
    choixPersonaOuvert.set(false);
    annonceDansLaPalette.set('');
    vi.unstubAllGlobals();
  });

  it('Ctrl K ne l’ouvre pas sous la boîte « Changer de profil »', async () => {
    // La boîte (z-[60]) passe au-dessus de la palette (z-50) : ouverte
    // dessous, la palette prenait le focus dans son champ, caché sous le fond
    // de la boîte.
    render(CommandPalette);
    choixPersonaOuvert.set(true);
    await fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await tick();
    expect(get(commandPaletteOpen)).toBe(false);
    // La boîte refermée, Ctrl K ouvre la palette.
    choixPersonaOuvert.set(false);
    await fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(get(commandPaletteOpen)).toBe(true);
  });

  it('porte la région d’annonce du chat : vide à l’ouverture, puis ce que le chat y écrit, vidée à la fermeture', async () => {
    // La page derrière est inerte, région du chat comprise : la fin d'une
    // réponse arrivée pendant une recherche se taisait. Une phrase restée
    // d'une ouverture précédente ne doit pas être redite.
    annonceDansLaPalette.set('Réponse terminée.');
    const { getByTestId } = render(CommandPalette);
    commandPaletteOpen.set(true);
    const region = await waitFor(() => getByTestId('palette-announce'));
    expect(region.closest('[role="dialog"]')).not.toBeNull();
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
    expect(region.classList.contains('sr-only')).toBe(true);
    expect(region.textContent?.trim()).toBe('');

    annonceDansLaPalette.set('Réponse terminée, 3 articles cités.');
    await tick();
    expect(region.textContent?.trim()).toBe('Réponse terminée, 3 articles cités.');

    commandPaletteOpen.set(false);
    await tick();
    expect(get(annonceDansLaPalette)).toBe('');
  });
});
