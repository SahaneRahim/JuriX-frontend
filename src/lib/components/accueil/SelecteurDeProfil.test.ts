import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * « Je suis » sur l'accueil (refonte A, E3b, décision H2) : le même profil
 * que le chat, écrit seulement au clic, et « Sans profil » pour la visite.
 *
 * Les vrais modules du profil : `changerPersona` (navigateur, puis compte
 * d'un utilisateur connecté ; personne ne l'est ici, aucun appel ne part) et
 * `refuserPourCetteSession` (le cookie de session, jamais le compte).
 */

vi.mock('$app/environment', () => ({ browser: true, building: false, dev: false, version: 'test' }));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), afterNavigate: vi.fn() }));
const mouvement = vi.hoisted(() => ({ current: false }));
vi.mock('svelte/motion', () => ({ prefersReducedMotion: mouvement }));

import { personaStore } from '$lib/stores/persona';
import SelecteurDeProfil from './SelecteurDeProfil.svelte';

const bouton = (container: HTMLElement, slug: string) =>
  container.querySelector<HTMLButtonElement>(`[data-testid="accueil-profil-${slug}"]`)!;
const presses = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLButtonElement>('button[aria-pressed="true"]')].map((b) => b.dataset.testid);
const pastille = (container: HTMLElement) => container.querySelector('[data-testid="accueil-profil-pastille"]')!;

/** La mise en page, que jsdom ne calcule pas : la place d'un bouton dans la piste. */
function poser(element: HTMLElement, offsetLeft: number, offsetWidth: number) {
  Object.defineProperties(element, {
    offsetLeft: { value: offsetLeft, configurable: true },
    offsetWidth: { value: offsetWidth, configurable: true },
    offsetTop: { value: 3, configurable: true },
    offsetHeight: { value: 34, configurable: true },
  });
}

beforeEach(() => {
  mouvement.current = false;
  document.cookie = 'jurix-persona-refus=; Path=/; Max-Age=0';
  localStorage.clear();
  personaStore._reinitialiser();
});

afterEach(() => cleanup());

describe('SelecteurDeProfil', () => {
  it('un groupe « Je suis » : quatre profils nommés et « Sans profil », aucun choisi à la première visite (H2)', async () => {
    const { container, getByRole } = render(SelecteurDeProfil);
    await tick();
    expect(getByRole('group', { name: 'Je suis' })).toBeTruthy();
    for (const nom of ['Citoyen', 'Étudiant en droit', 'Avocat ou juriste', 'Entrepreneur', 'Sans profil']) {
      expect(getByRole('button', { name: nom }).getAttribute('aria-pressed')).toBe('false');
    }
    expect(bouton(container, 'sans').getAttribute('title')).toBe('Continuer sans profil');
    // Sans profil choisi, la pastille d'encre n'est pas affichée.
    expect(pastille(container).classList).toContain('opacity-0');
    expect(localStorage.getItem('jurix-persona')).toBeNull();
  });

  it('un clic choisit le profil, pour tout le site (personaStore), et la pastille s’y pose', async () => {
    const { container } = render(SelecteurDeProfil);
    await tick();
    await fireEvent.click(bouton(container, 'avocat'));
    await tick();
    expect(get(personaStore).persona).toBe('avocat');
    expect(get(personaStore).refuseCetteSession).toBe(false);
    expect(localStorage.getItem('jurix-persona')).toBe('avocat');
    expect(presses(container)).toEqual(['accueil-profil-avocat']);
    expect(pastille(container).classList).toContain('opacity-100');
  });

  it('la pastille est posée sur le bouton choisi : sa boîte réelle, et aucune découpe (axe ne lit pas `clip-path`)', async () => {
    const { container } = render(SelecteurDeProfil);
    await tick();
    poser(bouton(container, 'avocat'), 203, 150);
    await fireEvent.click(bouton(container, 'avocat'));
    await tick();
    await tick();
    const style = (pastille(container) as HTMLElement).style;
    expect([style.left, style.top, style.width, style.height]).toEqual(['203px', '3px', '150px', '34px']);
    expect(style.clipPath).toBe('');
  });

  it('elle glisse d’un profil à l’autre par `transform` seul, en courbe commune (A2 § 4, X2)', async () => {
    const { container } = render(SelecteurDeProfil);
    await tick();
    const animer = vi.fn();
    (pastille(container) as HTMLElement).animate = animer;
    poser(bouton(container, 'citoyen'), 3, 100);
    poser(bouton(container, 'avocat'), 203, 200);

    // La première place : elle apparaît en fondu, sans venir de nulle part.
    await fireEvent.click(bouton(container, 'citoyen'));
    await tick();
    await tick();
    expect(animer).not.toHaveBeenCalled();

    await fireEvent.click(bouton(container, 'avocat'));
    await tick();
    await tick();
    expect(animer).toHaveBeenCalledTimes(1);
    expect(animer.mock.calls[0][0]).toEqual([{ transform: 'translateX(-200px) scaleX(0.5)' }, { transform: 'none' }]);
    expect(animer.mock.calls[0][1]).toEqual({ duration: 500, easing: 'cubic-bezier(.22,1,.36,1)' });
  });

  it('en mouvement réduit, ou après « Sans profil », elle ne glisse pas : elle est à sa place', async () => {
    const { container } = render(SelecteurDeProfil);
    await tick();
    const animer = vi.fn();
    (pastille(container) as HTMLElement).animate = animer;
    poser(bouton(container, 'citoyen'), 3, 100);
    poser(bouton(container, 'avocat'), 203, 200);
    await fireEvent.click(bouton(container, 'citoyen'));
    await tick();
    await tick();

    await fireEvent.click(bouton(container, 'sans'));
    await tick();
    await tick();
    await fireEvent.click(bouton(container, 'avocat'));
    await tick();
    await tick();
    expect(animer).not.toHaveBeenCalled();
    expect((pastille(container) as HTMLElement).style.left).toBe('203px');

    mouvement.current = true;
    await fireEvent.click(bouton(container, 'citoyen'));
    await tick();
    await tick();
    expect(animer).not.toHaveBeenCalled();
    expect((pastille(container) as HTMLElement).style.left).toBe('3px');
  });

  it('« Sans profil » vaut pour la visite : le cookie de refus, jamais le profil gardé', async () => {
    localStorage.setItem('jurix-persona', 'citoyen');
    personaStore._reinitialiser();
    const { container } = render(SelecteurDeProfil);
    await tick();
    expect(presses(container)).toEqual(['accueil-profil-citoyen']);

    await fireEvent.click(bouton(container, 'sans'));
    await tick();
    expect(get(personaStore)).toMatchObject({ persona: null, refuseCetteSession: true });
    expect(document.cookie).toContain('jurix-persona-refus=1');
    expect(localStorage.getItem('jurix-persona')).toBeNull();
    expect(presses(container)).toEqual(['accueil-profil-sans']);
    expect(pastille(container).classList).toContain('opacity-0');
  });

  it('aria-pressed suit le profil, d’où qu’il vienne (en-tête, autre onglet, compte)', async () => {
    const { container } = render(SelecteurDeProfil);
    await tick();
    personaStore.choisir('entrepreneur');
    await tick();
    expect(presses(container)).toEqual(['accueil-profil-entrepreneur']);
    personaStore.appliquerDepuisCompte('étudiant');
    await tick();
    expect(presses(container)).toEqual(['accueil-profil-etudiant']);
    // La ligne du téléphone dit le profil choisi.
    expect(container.textContent).toContain('Je suis : Étudiant en droit');
  });

  it('un second clic sur le profil choisi ne réécrit rien', async () => {
    const { container } = render(SelecteurDeProfil);
    await tick();
    await fireEvent.click(bouton(container, 'citoyen'));
    const choixApres = get(personaStore).choix;
    await fireEvent.click(bouton(container, 'citoyen'));
    expect(get(personaStore).choix).toBe(choixApres);
  });

  it('des cibles de 44 px au doigt, et le nom de chaque profil même quand seule son icône se voit', async () => {
    const { container } = render(SelecteurDeProfil);
    await tick();
    for (const slug of ['citoyen', 'etudiant', 'avocat', 'entrepreneur', 'sans']) {
      expect(bouton(container, slug).className, slug).toMatch(/\bmin-h-11\b/);
      expect(bouton(container, slug).type).toBe('button');
    }
    // Sous md, le libellé est réservé aux lecteurs d'écran (`sr-only`), pas retiré.
    expect(bouton(container, 'etudiant').querySelector('.sr-only')?.textContent).toBe('Étudiant en droit');
  });
});
