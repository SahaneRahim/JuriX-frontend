import { fireEvent, render } from '@testing-library/svelte';
import { flushSync, mount, unmount } from 'svelte';
import { get } from 'svelte/store';
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
  const { readable } = await import('svelte/store');
  return {
    page: readable({ url: new URL('http://site/'), route: { id: '/(main)' }, params: {}, data: {}, error: null }),
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

afterEach(() => closeCommandPalette());

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
    // clic n'y mène plus. Le lien « Recherche » de la navigation, lui, reste
    // un lien ordinaire.
    for (const loupe of loupes) {
      expect(loupe.tagName).toBe('A');
      expect(loupe.getAttribute('href')).toBe('/search');
      expect(loupe.getAttribute('data-sveltekit-preload-data')).toBe('off');
    }
    const lienDeNavigation = container.querySelector('nav a[href="/search"]');
    expect(lienDeNavigation?.getAttribute('role')).toBeNull();
    expect(lienDeNavigation?.getAttribute('aria-label')).toBeNull();
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
    const { container } = render(SiteHeader);
    const liens = [...container.querySelectorAll('[data-testid="site-header"] nav a')];
    expect(liens.length).toBeGreaterThan(4);
    for (const lien of liens) {
      const libelle = lien.textContent?.trim();
      expect(lien.getAttribute('data-libelle'), lien.getAttribute('href') ?? '').toBe(libelle);
      for (const classe of ['flex-col', 'after:content-[attr(data-libelle)]', 'after:font-semibold', 'after:invisible', 'after:h-0']) {
        expect(lien.classList.contains(classe), `${libelle} : ${classe}`).toBe(true);
      }
    }
    // L'accueil, page courante du test : demi-gras et `aria-current`.
    const accueil = liens.find((lien) => lien.getAttribute('href') === '/');
    expect(accueil?.getAttribute('aria-current')).toBe('page');
    expect(accueil?.classList.contains('font-semibold')).toBe(true);
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
});
