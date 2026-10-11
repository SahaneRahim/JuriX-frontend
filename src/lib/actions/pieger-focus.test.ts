import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { piegerFocus } from './pieger-focus';

/** jsdom ne calcule aucune mise en page : offsetParent est toujours null. */
function rendreVisibles() {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return document.body;
    },
  });
}

function boite() {
  const declencheur = document.createElement('button');
  declencheur.textContent = 'ouvrir';
  document.body.appendChild(declencheur);
  declencheur.focus();

  const noeud = document.createElement('div');
  noeud.innerHTML = `
    <h2 id="titre" tabindex="-1">Titre</h2>
    <button id="premier">A</button>
    <button id="dernier">B</button>`;
  document.body.appendChild(noeud);
  return { declencheur, noeud };
}

describe('piegerFocus', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    rendreVisibles();
  });
  afterEach(() => {
    delete (HTMLElement.prototype as { offsetParent?: unknown }).offsetParent;
  });

  it('pose le focus sur l element initial demande', () => {
    const { noeud } = boite();

    piegerFocus(noeud, { initial: '#titre' });

    expect(document.activeElement?.id).toBe('titre');
  });

  it('Maj+Tab depuis le titre boucle sur le dernier element, sans sortir', () => {
    const { noeud } = boite();
    piegerFocus(noeud, { initial: '#titre' });

    noeud.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));

    expect(document.activeElement?.id).toBe('dernier');
  });

  it('Tab depuis le titre va au premier element', () => {
    const { noeud } = boite();
    piegerFocus(noeud, { initial: '#titre' });

    noeud.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(document.activeElement?.id).toBe('premier');
  });

  it('rend le focus au declencheur a la fermeture', () => {
    const { declencheur, noeud } = boite();
    const action = piegerFocus(noeud, { initial: '#titre' });

    action.destroy();

    expect(document.activeElement).toBe(declencheur);
  });

  it('sans option, le premier element focusable', () => {
    const { noeud } = boite();

    piegerFocus(noeud);

    expect(document.activeElement?.id).toBe('premier');
  });
});
