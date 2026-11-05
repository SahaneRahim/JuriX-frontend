import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Le champ unique de l'accueil (refonte A, décisions H10 et H12) : ce que
 * valent Entrée, Maj+Entrée et l'envoi, une fois la page montée.
 *
 * POURQUOI CES TESTS, EN PLUS DES e2e. Le dépôt avait retiré tout gestionnaire
 * de touche du champ à cause de la composition IME : un Entrée qui valide un
 * mot d'un clavier à suggestions partait comme un envoi. Playwright ne sait
 * pas produire cette composition ; ici, l'événement la porte.
 */

const navigation = vi.hoisted(() => ({ goto: vi.fn(async () => {}) }));
vi.mock('$app/environment', () => ({ browser: true, building: false, dev: false, version: 'test' }));
vi.mock('$app/navigation', () => ({ goto: navigation.goto, afterNavigate: vi.fn() }));

import { personaStore } from '$lib/stores/persona';
import ChampUnique from './ChampUnique.svelte';

/** Le formulaire est gardé : jsdom ne navigue pas, et le GET natif se compte. */
let soumissionsNatives = 0;
function rendre() {
  const ecran = render(ChampUnique);
  const formulaire = ecran.container.querySelector('form')!;
  formulaire.addEventListener('submit', (event) => {
    if (!event.defaultPrevented) soumissionsNatives += 1;
    event.preventDefault();
  });
  return {
    ...ecran,
    champ: ecran.container.querySelector('textarea')!,
    envoi: ecran.container.querySelector<HTMLButtonElement>('button[type="submit"]')!,
  };
}

async function saisir(champ: HTMLTextAreaElement, texte: string) {
  await fireEvent.input(champ, { target: { value: texte } });
}

beforeEach(() => {
  navigation.goto.mockClear();
  soumissionsNatives = 0;
  localStorage.clear();
  personaStore._reinitialiser();
});

afterEach(() => cleanup());

describe('ChampUnique', () => {
  it('Entrée envoie à l’assistant, une fois, la question encodée (H1, H12)', async () => {
    const { champ } = rendre();
    await tick();
    await saisir(champ, 'Quels sont mes droits ?');
    await fireEvent.keyDown(champ, { key: 'Enter' });
    expect(navigation.goto).toHaveBeenCalledTimes(1);
    expect(navigation.goto).toHaveBeenCalledWith('/chat?q=Quels%20sont%20mes%20droits%20%3F&envoyer=1');
    expect(soumissionsNatives).toBe(0);
  });

  it('un Entrée de composition IME appartient à la saisie : rien ne part', async () => {
    const { champ } = rendre();
    await tick();
    await saisir(champ, 'licenciement');
    await fireEvent.keyDown(champ, { key: 'Enter', isComposing: true });
    // Safari : la composition se dit par le code 229.
    await fireEvent.keyDown(champ, { key: 'Enter', keyCode: 229 });
    expect(navigation.goto).not.toHaveBeenCalled();
    expect(soumissionsNatives).toBe(0);
  });

  it('Maj+Entrée va à la ligne : la touche n’est pas retenue, rien ne part', async () => {
    const { champ } = rendre();
    await tick();
    await saisir(champ, 'première ligne');
    // `fireEvent` rend faux quand le gestionnaire a retenu l'événement.
    expect(await fireEvent.keyDown(champ, { key: 'Enter', shiftKey: true })).toBe(true);
    expect(navigation.goto).not.toHaveBeenCalled();
  });

  it('les sauts de ligne et les espaces des bords quittent la question', async () => {
    const { champ, envoi } = rendre();
    await tick();
    await saisir(champ, '  Quelles indemnités\nen cas de licenciement ?  ');
    await fireEvent.click(envoi);
    expect(navigation.goto).toHaveBeenCalledWith(
      `/chat?q=${encodeURIComponent('Quelles indemnités en cas de licenciement ?')}&envoyer=1`,
    );
  });

  it('un champ vide ne part pas, et reprend le focus', async () => {
    const { champ, envoi } = rendre();
    await tick();
    await saisir(champ, '   ');
    await fireEvent.click(envoi);
    expect(navigation.goto).not.toHaveBeenCalled();
    expect(soumissionsNatives).toBe(0);
    expect(document.activeElement).toBe(champ);
  });

  it('en mode « Recherche », l’envoi garde son nom et le formulaire GET part tel quel (H10)', async () => {
    const { champ, envoi, getByTestId } = rendre();
    await tick();
    expect(envoi.getAttribute('aria-label')).toBe('Poser la question');
    await fireEvent.click(getByTestId('accueil-mode-recherche'));
    expect(envoi.getAttribute('aria-label')).toBe('Rechercher');
    expect(getByTestId('accueil-mode-recherche').getAttribute('aria-pressed')).toBe('true');
    await saisir(champ, '  garde à vue ');
    await fireEvent.keyDown(champ, { key: 'Enter' });
    expect(navigation.goto).not.toHaveBeenCalled();
    expect(soumissionsNatives).toBe(1);
    expect(champ.value).toBe('garde à vue');
  });

  it('en mode « Recherche », l’exemple tapé devient un mot-clé (H9)', async () => {
    const { getByTestId } = rendre();
    await tick();
    expect(getByTestId('accueil-exemple').textContent).toContain('Quelles indemnités');
    await fireEvent.click(getByTestId('accueil-mode-recherche'));
    await tick();
    expect(getByTestId('accueil-exemple').textContent).not.toContain('Quelles indemnités');
  });
});
