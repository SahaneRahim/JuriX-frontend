import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { createRawSnippet, tick } from 'svelte';
import { get } from 'svelte/store';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { commandPaletteOpen } from '$lib/stores/commandPalette';
import Layout from './+layout.svelte';

/**
 * Le layout racine pendant que la palette (Ctrl K) est ouverte : la page
 * derrière elle est inerte, comme derrière la boîte « Changer de profil ».
 * La palette se dit modale (`aria-modal`), mais Maj+Tab menait de son champ
 * à la page cachée sous son fond, où Entrée activait un contrôle invisible :
 * l'envoi du brouillon du chat, un lien vers une autre page.
 */

vi.mock('$app/navigation', () => ({ afterNavigate: vi.fn(), beforeNavigate: vi.fn(), goto: vi.fn() }));
// Au montage, le layout lit le profil du compte : aucun appel à l'API ici.
vi.mock('$lib/persona-compte', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/persona-compte')>()),
  synchroniserPersonaAuDemarrage: vi.fn(async () => {}),
}));

// jsdom n'a pas l'API Web Animations, dont les transitions de Svelte 5 ont besoin.
Element.prototype.animate = vi.fn(() => ({
  onfinish: null,
  cancel: vi.fn(),
  finished: Promise.resolve(),
  currentTime: 0,
})) as unknown as typeof Element.prototype.animate;

// jsdom ne connaît pas `inert` : la propriété n'y est qu'un champ, et le
// focus passe partout. Le minimum du navigateur : la propriété reflète
// l'attribut, et un élément inerte refuse le focus. Une palette qui
// rendrait le focus avant que la page cesse d'être inerte le perdrait.
const focusDeJsdom = HTMLElement.prototype.focus;
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'inert', {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute('inert');
    },
    set(this: HTMLElement, valeur: boolean) {
      this.toggleAttribute('inert', Boolean(valeur));
    },
  });
  HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
    if (!this.closest('[inert]')) focusDeJsdom.call(this, options);
  };
});
afterAll(() => {
  delete (HTMLElement.prototype as { inert?: boolean }).inert;
  HTMLElement.prototype.focus = focusDeJsdom;
});

/** Une page sous le layout : la loupe de l'en-tête et l'envoi du chat. */
const PAGE = createRawSnippet(() => ({
  render: () => '<main><button type="button">Loupe</button><button type="button">Envoyer</button></main>',
}));

function rendre() {
  // `$$slots` : le layout, en syntaxe d'avant les runes, rend son <slot />
  // depuis la propriété `children` seulement quand l'emplacement est déclaré.
  const rendu = render(Layout, { props: { children: PAGE, $$slots: { default: true } } as never });
  const page = rendu.container.querySelector<HTMLElement>('div[style="display: contents"]');
  expect(page).not.toBeNull();
  return { ...rendu, page: page! };
}

describe('layout racine et palette', () => {
  afterEach(() => {
    cleanup();
    commandPaletteOpen.set(false);
  });

  it('rend la page inerte tant que la palette est ouverte, la palette exceptée', async () => {
    const { container, page } = rendre();
    expect(page.inert).toBe(false);
    commandPaletteOpen.set(true);
    await tick();
    expect(page.inert).toBe(true);
    const palette = container.querySelector('[role="dialog"]');
    expect(palette).not.toBeNull();
    expect(page.contains(palette)).toBe(false);
    commandPaletteOpen.set(false);
    await tick();
    expect(page.inert).toBe(false);
  });

  it('ouverte depuis la loupe, la palette lui rend le focus, la page redevenue active', async () => {
    const { getByRole, page } = rendre();
    const loupe = getByRole('button', { name: 'Loupe' });
    loupe.focus();
    commandPaletteOpen.set(true);
    const champ = await waitFor(() => getByRole('textbox'));
    await waitFor(() => expect(document.activeElement).toBe(champ));
    // Maj+Tab ne mène plus à la page : inerte, elle refuse le focus.
    getByRole('button', { name: 'Envoyer' }).focus();
    expect(document.activeElement).toBe(champ);

    await fireEvent.keyDown(champ, { key: 'Escape' });
    await tick();
    expect(get(commandPaletteOpen)).toBe(false);
    expect(page.inert).toBe(false);
    expect(document.activeElement).toBe(loupe);
  });
});
