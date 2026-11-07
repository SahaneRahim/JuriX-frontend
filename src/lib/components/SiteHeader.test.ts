import { fireEvent, render, within } from '@testing-library/svelte';
import { flushSync, mount, unmount } from 'svelte';
import { get, type Writable } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * L'en-tête une fois monté dans le navigateur.
 *
 * Au rendu serveur, la loupe est un lien vers /search (proposition P8 :
 * SiteHeader.serveur.test.ts). Monté, le composant fait de ce même lien le
 * bouton de la palette (Ctrl K) : rôle de bouton, nommé comme avant, qui
 * ouvre une boîte de dialogue, et que tests/e2e/navigation/monochrome.spec.ts
 * retrouve par son rôle et son nom (« Recherche et actions rapides »).
 */

vi.mock('$app/environment', () => ({ browser: true, building: false, dev: false, version: 'test' }));
vi.mock('$app/navigation', () => ({ afterNavigate: () => {}, goto: async () => {} }));
vi.mock('$app/stores', async () => {
  const { writable } = await import('svelte/store');
  return {
    page: writable({ url: new URL('http://site/'), route: { id: '/(main)' }, params: {}, data: {}, error: null }),
  };
});

// jsdom n'a pas l'API Web Animations, dont les transitions de Svelte 5 ont
// besoin (le panneau du menu s'ouvre en glissant).
Element.prototype.animate = vi.fn(() => ({
  onfinish: null,
  cancel: vi.fn(),
  finished: Promise.resolve(),
  currentTime: 0,
})) as unknown as typeof Element.prototype.animate;

const { default: SiteHeader } = await import('./SiteHeader.svelte');
const { closeCommandPalette, commandPaletteOpen } = await import('$lib/stores/commandPalette');
const { page } = await import('$app/stores');

/** Ouvre l'en-tête sur `chemin` : la page courante, dont il dérive l'état actif. */
function allerSur(chemin: string) {
  (page as unknown as Writable<unknown>).set({
    url: new URL(chemin, 'http://site'),
    route: { id: null },
    params: {},
    data: {},
    error: null,
  });
}

afterEach(() => {
  closeCommandPalette();
  allerSur('/');
});

/** Les deux loupes (bureau, puis téléphone) : les éléments qui portent l'icône de recherche et ouvrent une boîte. */
function loupesDe(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[aria-haspopup="dialog"]')].filter((el) =>
    el.querySelector('[data-icone="search"]'),
  );
}

describe('SiteHeader monté', () => {
  it('fait des deux loupes les boutons de la palette, nommés, sans perdre leur lien', () => {
    const { container, getAllByRole } = render(SiteHeader);
    const loupes = loupesDe(container);
    expect(loupes).toHaveLength(2);
    expect(loupes.map((l) => l.getAttribute('aria-label'))).toEqual([
      'Recherche et actions rapides (Ctrl+K)',
      'Recherche et actions rapides',
    ]);
    // Le rôle de bouton, que les tests e2e cherchent (monochrome.spec.ts).
    expect(getAllByRole('button', { name: /^Recherche et actions rapides/ })).toEqual(loupes);
    // Toujours le lien du rendu serveur, sans préchargement de /search : le
    // clic n'y mène plus.
    for (const loupe of loupes) {
      expect(loupe.tagName).toBe('A');
      expect(loupe.getAttribute('href')).toBe('/search');
      expect(loupe.getAttribute('data-sveltekit-preload-data')).toBe('off');
    }
    // La navigation n'a plus de lien « Recherche » (refonte A, décision H3) :
    // les loupes sont les seuls accès à /search de l'en-tête.
    expect(container.querySelector('nav a[href="/search"]')).toBeNull();
  });

  it('ouvre la palette au clic sur chacune des loupes, sans suivre le lien', async () => {
    const { container } = render(SiteHeader);
    for (const loupe of loupesDe(container)) {
      closeCommandPalette();
      // `false` : le clic est annulé, ni le navigateur ni SvelteKit ne vont sur /search.
      expect(await fireEvent.click(loupe)).toBe(false);
      expect(get(commandPaletteOpen)).toBe(true);
    }
  });

  it('laisse un clic modifié ouvrir /search dans un nouvel onglet', async () => {
    const { container } = render(SiteHeader);
    // Relevé au niveau du document, après la loupe : le clic lui arrive-t-il
    // intact ? Puis annulé ici, jsdom ne sachant pas suivre un lien.
    const intacts: boolean[] = [];
    const releve = (event: Event) => {
      intacts.push(!event.defaultPrevented);
      event.preventDefault();
    };
    document.addEventListener('click', releve);
    try {
      for (const modificateur of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
        for (const loupe of loupesDe(container)) {
          await fireEvent.click(loupe, { [modificateur]: true });
          expect(get(commandPaletteOpen), modificateur).toBe(false);
        }
      }
    } finally {
      document.removeEventListener('click', releve);
    }
    expect(intacts).toEqual(Array(8).fill(true));
  });

  it('répond à Espace comme un bouton : la palette au relâchement, sans défiler', async () => {
    const { container } = render(SiteHeader);
    for (const loupe of loupesDe(container)) {
      closeCommandPalette();
      // À l'appui, le défilement de la page est retenu, rien ne s'ouvre encore.
      expect(await fireEvent.keyDown(loupe, { key: ' ' })).toBe(false);
      expect(get(commandPaletteOpen)).toBe(false);
      await fireEvent.keyUp(loupe, { key: ' ' });
      expect(get(commandPaletteOpen)).toBe(true);
    }
    // Les autres touches gardent leur effet (Tab, Entrée par le clic du lien).
    closeCommandPalette();
    expect(await fireEvent.keyDown(loupesDe(container)[0], { key: 'Tab' })).toBe(true);
    await fireEvent.keyUp(loupesDe(container)[0], { key: 'Enter' });
    expect(get(commandPaletteOpen)).toBe(false);
  });

  it('garde la loupe du premier rendu au montage : le focus clavier y reste', () => {
    // Sur un téléphone lent, on atteint la loupe au clavier (ou au lecteur
    // d'écran) avant l'hydratation. Échangée contre un <button> au montage,
    // elle sortait du document avec le focus, qui tombait sur <body>.
    // `mount` diffère les effets, `onMount` compris : la loupe est d'abord
    // telle que le serveur l'envoie, `flushSync` la monte ensuite.
    const cible = document.body.appendChild(document.createElement('div'));
    const entete = mount(SiteHeader, { target: cible });
    try {
      const loupes = [...cible.querySelectorAll<HTMLElement>('a[href="/search"][aria-label]')];
      expect(loupes).toHaveLength(2);
      for (const loupe of loupes) {
        loupe.focus();
        expect(document.activeElement).toBe(loupe);
      }
      const [, loupeMobile] = loupes;
      expect(loupeMobile.getAttribute('aria-label')).toBe('Ouvrir la page de recherche');
      expect(loupeMobile.getAttribute('role')).toBeNull();
      loupeMobile.focus();
      flushSync();
      expect(loupeMobile.isConnected).toBe(true);
      expect(document.activeElement).toBe(loupeMobile);
      // Le même élément est devenu le bouton de la palette.
      expect(loupeMobile.getAttribute('role')).toBe('button');
      expect(loupeMobile.getAttribute('aria-haspopup')).toBe('dialog');
      expect(loupeMobile.getAttribute('aria-label')).toBe('Recherche et actions rapides');
    } finally {
      unmount(entete);
      cible.remove();
    }
  });

  it('n’accepte plus de prop `variant` et garde la même surface partout', () => {
    // La variante transparente faisait changer l'en-tête d'aspect entre
    // l'accueil et les autres pages (reste r3 n° 41).
    const { container } = render(SiteHeader);
    const entete = container.querySelector('[data-testid="site-header"]');
    expect(entete?.className).toContain('bg-white');
    expect(entete?.className).toContain('border-b');
    expect(entete?.className).not.toContain('bg-transparent');
  });

  it('chaque lien de la navigation réserve la largeur de son libellé en demi-gras', () => {
    // Le lien actif passait en demi-gras et s'élargissait : ses voisins
    // glissaient de 3 à 4 px d'une page à l'autre. La copie en demi-gras est
    // un `::after` invisible : le texte du lien, et donc son nom, restent le
    // libellé seul.
    const { container, getByTestId } = render(SiteHeader);
    const liens = [...container.querySelectorAll('[data-testid="site-header"] nav a')];
    // Les quatre liens de la refonte A (décision H3).
    expect(liens).toHaveLength(4);
    for (const lien of liens) {
      const libelle = lien.textContent?.trim();
      expect(lien.getAttribute('data-libelle'), lien.getAttribute('href') ?? '').toBe(libelle);
      for (const classe of ['flex-col', 'after:content-[attr(data-libelle)]', 'after:font-semibold', 'after:invisible', 'after:h-0']) {
        expect(lien.classList.contains(classe), `${libelle} : ${classe}`).toBe(true);
      }
    }
    // L'accueil, page courante du test : « Accueil » a quitté la navigation,
    // c'est le logo, lien d'accueil, qui porte `aria-current` ; aucun lien de
    // la navigation n'est actif.
    expect(getByTestId('site-logo').getAttribute('href')).toBe('/');
    expect(getByTestId('site-logo').getAttribute('aria-current')).toBe('page');
    expect(liens.filter((lien) => lien.hasAttribute('aria-current'))).toEqual([]);
    expect(liens.filter((lien) => lien.classList.contains('font-semibold'))).toEqual([]);
  });

  it('dans le menu mobile, le profil a son libellé visible, comme au bureau', async () => {
    const { getByTestId } = render(SiteHeader);
    await fireEvent.click(getByTestId('nav-mobile-toggle'));
    const profil = getByTestId('persona-toggle-mobile');
    // L'icône seule passait pour le bouton du compte, posé juste dessous.
    expect(profil.textContent?.trim()).toBe('Profil');
    // Le libellé visible est dans le nom accessible (WCAG 2.5.3).
    expect(profil.getAttribute('aria-label')).toMatch(/^Changer de profil \(actuel/);
    expect(profil.getAttribute('aria-label')?.toLowerCase()).toContain('profil');
  });

  it('ouvre l’assistant depuis la barre : « Assistant IA », lien vers /chat', () => {
    // La demande d'origine du projet : le bouton « Assistant IA » ouvre le
    // chat. Un lien, et non un bouton : il marche avant l'hydratation.
    const { getByTestId } = render(SiteHeader);
    const barre = getByTestId('site-header').querySelector('nav') as HTMLElement;
    expect(within(barre).getByRole('link', { name: 'Assistant IA' }).getAttribute('href')).toBe('/chat');
  });

  it('ouvre aussi l’assistant depuis le menu mobile, qu’Échap referme', async () => {
    const { getByTestId, queryByTestId } = render(SiteHeader);
    const bascule = getByTestId('nav-mobile-toggle');
    expect(bascule.getAttribute('aria-expanded')).toBe('false');
    // Fermé, le panneau n'est pas dans la page : rien n'y est focalisable.
    expect(queryByTestId('nav-mobile-panel')).toBeNull();

    await fireEvent.click(bascule);
    expect(bascule.getAttribute('aria-expanded')).toBe('true');
    const panneau = getByTestId('nav-mobile-panel');
    expect(within(panneau).getByRole('link', { name: 'Assistant IA' }).getAttribute('href')).toBe('/chat');

    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(bascule.getAttribute('aria-expanded')).toBe('false');
    expect(queryByTestId('nav-mobile-panel')).toBeNull();
  });

  it('Échap depuis le panneau rend le focus au bouton du menu, et non à <body>', async () => {
    // Le panneau est monté par {#if} : le refermer retire du document le lien
    // qui avait le focus, et le focus tombait sur <body> (le clavier perdait
    // sa place, WCAG 2.4.3). jsdom ne met rien en page :
    // le bouton du menu est dit affiché (une boîte), comme sous lg, et celui
    // des réglages ne l'est pas.
    const { container, getByTestId, queryByTestId } = render(SiteHeader);
    const bascule = getByTestId('nav-mobile-toggle');
    vi.spyOn(bascule, 'getClientRects').mockReturnValue([{ width: 44, height: 44 }] as unknown as DOMRectList);
    await fireEvent.click(bascule);
    const lien = within(getByTestId('nav-mobile-panel')).getByRole('link', { name: 'Assistant IA' });
    lien.focus();
    expect(document.activeElement).toBe(lien);

    await fireEvent.keyDown(lien, { key: 'Escape' });
    expect(queryByTestId('nav-mobile-panel')).toBeNull();
    expect(bascule.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(bascule);

    // Le focus hors du panneau (ici, la loupe), Échap le laisse où il est.
    await fireEvent.click(bascule);
    const loupe = loupesDe(container)[1];
    loupe.focus();
    await fireEvent.keyDown(loupe, { key: 'Escape' });
    expect(queryByTestId('nav-mobile-panel')).toBeNull();
    expect(document.activeElement).toBe(loupe);
  });

  it('la langue active se dit sans la couleur : aria-pressed, lang et le trait (P6)', async () => {
    const { getByTestId } = render(SiteHeader);
    const fr = getByTestId('lang-fr');
    const en = getByTestId('lang-en');
    expect(fr.getAttribute('aria-pressed')).toBe('true');
    expect(en.getAttribute('aria-pressed')).toBe('false');
    expect(fr.getAttribute('lang')).toBe('fr');
    expect(en.getAttribute('lang')).toBe('en');
    // Le trait de 2 px sous la langue active, gardé en contraste élevé.
    expect(fr.className).toContain('before:h-0.5');
    expect(fr.className).toContain('forced-colors:before:!bg-[CanvasText]');
    expect(en.className).not.toContain('before:h-0.5');
    await fireEvent.click(getByTestId('nav-mobile-toggle'));
    expect(getByTestId('lang-fr-mobile').getAttribute('aria-pressed')).toBe('true');
    expect(getByTestId('lang-en-mobile').getAttribute('aria-pressed')).toBe('false');
    expect(getByTestId('lang-en-mobile').getAttribute('lang')).toBe('en');
  });

  it('range FR et EN dans la ligne « Langue » du menu mobile, nommée par son libellé', async () => {
    const { getByTestId } = render(SiteHeader);
    await fireEvent.click(getByTestId('nav-mobile-toggle'));
    const langue = within(getByTestId('nav-mobile-panel')).getByRole('group', { name: 'Langue' });
    expect(within(langue).getAllByRole('button').map((b) => b.getAttribute('data-testid'))).toEqual([
      'lang-fr-mobile',
      'lang-en-mobile',
    ]);
    // Le thème reste dans le panneau (décision D15), hors de la ligne de la langue.
    expect(langue.contains(getByTestId('theme-toggle-mobile'))).toBe(false);
  });

  it('sur une page de la navigation, son lien est le lien courant, et le logo ne l’est plus', async () => {
    // Une catégorie est rangée sous « Parcourir » (/laws), comme dans le fil
    // d'Ariane d'un texte.
    allerSur('/categories/13');
    const { container, getByTestId } = render(SiteHeader);
    const courants = [...container.querySelectorAll('[data-testid="site-header"] nav a[aria-current="page"]')];
    expect(courants.map((lien) => lien.getAttribute('href'))).toEqual(['/laws']);
    // L'encre et le demi-gras, plus le trait déjà tracé sous le libellé : pas
    // la couleur seule.
    expect(courants[0].classList.contains('font-semibold')).toBe(true);
    expect(courants[0].querySelector('span')?.classList.contains('before:scale-x-100')).toBe(true);
    expect(getByTestId('site-logo').hasAttribute('aria-current')).toBe(false);
    // Dans le menu mobile aussi.
    await fireEvent.click(getByTestId('nav-mobile-toggle'));
    const panneau = getByTestId('nav-mobile-panel');
    expect([...panneau.querySelectorAll('a[aria-current="page"]')].map((lien) => lien.getAttribute('href'))).toEqual([
      '/laws',
    ]);
  });

  it('souligne les autres liens au survol ET au focus clavier du lien, sous le libellé', () => {
    // Le trait est le `::before` du <span> du libellé : posé au bas du lien,
    // haut de 44 px sous xl, il flotterait loin du texte. Le survol et le
    // focus sont ceux du lien (`group`), pas du <span>.
    const { container } = render(SiteHeader);
    for (const lien of container.querySelectorAll('[data-testid="site-header"] nav a')) {
      expect(lien.classList.contains('group')).toBe(true);
      const libelle = lien.querySelector(':scope > span');
      expect(libelle?.textContent).toBe(lien.textContent);
      for (const classe of [
        'relative',
        'before:h-0.5',
        'before:origin-left',
        'before:scale-x-0',
        'group-hover:before:scale-x-100',
        'group-focus-visible:before:scale-x-100',
        'motion-safe:before:transition-transform',
        // Contraste élevé de Windows : le fond du trait y devient celui de la
        // page, sauf en couleur système.
        'forced-colors:before:!bg-[CanvasText]',
      ]) {
        expect(libelle?.classList.contains(classe), `${lien.textContent} : ${classe}`).toBe(true);
      }
    }
  });

  it('porte la balance animée dans la tuile du logo, et non l’icône fixe', () => {
    const { getByTestId } = render(SiteHeader);
    const logo = getByTestId('site-logo');
    const balance = logo.querySelector('svg.mv-balance');
    expect(balance).not.toBeNull();
    expect(balance?.getAttribute('aria-hidden')).toBe('true');
    // Une seule balance : celle de BalanceAnimee (le registre la dessine à plat).
    expect(logo.querySelectorAll('svg')).toHaveLength(1);
    // Le nom accessible du lien reste « JuriX ».
    expect(logo.textContent?.trim()).toBe('JuriX');
  });
});
