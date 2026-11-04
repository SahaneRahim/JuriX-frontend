import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { elementsIcone } from '$lib/icones';
import BalanceAnimee from './BalanceAnimee.svelte';

/**
 * La balance animée (logo, attente de l'IA).
 *
 * POURQUOI. Le geste repose sur la répartition des cinq tracés de l'icône
 * `scale` : le fléau pivote et porte les deux plateaux, qui contre-pivotent ;
 * le mât et la base ne bougent pas. Si le registre changeait de version et
 * d'ordre, un plateau se retrouverait hors du fléau, ou le mât dans le
 * fléau, et la balance « danserait » en morceaux sans qu'aucune erreur ne le
 * dise : ces tests le disent. Ils figent aussi ce qui la rend sûre :
 * décorative, sans rôle, et lisible sans animation.
 */

const D = {
  mat: 'M12 3v18',
  base: 'M7 21h10',
  fleau: 'M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1',
  plateauGauche: 'm5 8 3 8a5 5 0 0 1-6 0zV7',
  plateauDroit: 'm19 8 3 8a5 5 0 0 1-6 0zV7',
};

function svg(props: Record<string, unknown> = {}) {
  const { container } = render(BalanceAnimee, { props });
  const element = container.querySelector('svg');
  if (!element) throw new Error('pas de <svg>');
  return element;
}

const tracesDe = (racine: Element, selecteur = ':scope > path') =>
  [...racine.querySelectorAll(selecteur)].map((p) => p.getAttribute('d'));

type Etat = 'repos' | 'intro' | 'attente';

/**
 * Un document neuf, comme au chargement d'une page : le module de la balance
 * est relu (`vi.resetModules()`), et avec lui sa mémoire de l'introduction
 * (`introDejaJouee`), que les montages précédents du fichier ont pu
 * consommer. `svelte` est relu avec lui, pour monter le composant avec le
 * même moteur que celui qui l'a compilé. `defaire` démonte tout ce qui a été
 * monté dans ce document : à appeler en fin de test.
 */
async function documentNeuf() {
  vi.resetModules();
  const { flushSync, mount, unmount } = await import('svelte');
  const { default: Balance } = await import('./BalanceAnimee.svelte');
  /** Les balances encore montées, et leur conteneur. */
  const montees = new Map<Record<string, unknown>, HTMLElement>();
  const monter = (etat: Etat) => {
    const cible = document.body.appendChild(document.createElement('div'));
    const instance = mount(Balance, { target: cible, props: { etat } });
    // `mount` diffère les effets, onMount compris : `flushSync` les joue.
    flushSync();
    montees.set(instance, cible);
    const dessin = cible.querySelector('svg');
    if (!dessin) throw new Error('pas de <svg>');
    return {
      dessin,
      /** Les classes d'état, lues au moment de l'appel. */
      etats: () => [...dessin.classList].filter((c) => c.startsWith('mv-balance--')),
      donnee: () => dessin.getAttribute('data-etat'),
      demonter: () => {
        unmount(instance);
        montees.delete(instance);
        cible.remove();
      },
    };
  };
  const defaire = () => {
    for (const [instance, cible] of montees) {
      unmount(instance);
      cible.remove();
    }
    montees.clear();
  };
  return { monter, defaire, flushSync };
}

describe('BalanceAnimee', () => {
  it('reprend les cinq tracés de `scale` du registre, sans en perdre ni en ajouter', () => {
    const dessin = svg();
    const registre = elementsIcone('scale').map((e) => e.attributs.d);
    expect([...dessin.querySelectorAll('path')].map((p) => p.getAttribute('d')).sort()).toEqual([...registre].sort());
  });

  it('laisse le mât et la base fixes, hors du fléau', () => {
    expect(tracesDe(svg())).toEqual([D.mat, D.base]);
  });

  it('pose le fléau à la racine de son groupe, avec un plateau dans chacun des deux sous-groupes', () => {
    const dessin = svg();
    const fleau = dessin.querySelector(':scope > g.mv-balance__fleau');
    expect(fleau).not.toBeNull();
    expect(tracesDe(fleau!)).toEqual([D.fleau]);
    expect(tracesDe(fleau!, ':scope > g.mv-balance__plateau-g > path')).toEqual([D.plateauGauche]);
    expect(tracesDe(fleau!, ':scope > g.mv-balance__plateau-d > path')).toEqual([D.plateauDroit]);
  });

  it.each(['repos', 'intro', 'attente'] as const)("porte la classe de l'état « %s », et elle seule", async (etat) => {
    // Dans un document neuf : l'introduction ne joue qu'au premier montage du
    // document (plus bas), et un test monté avant celui-ci aurait pu la
    // consommer. Le cas « intro » ne dépend ainsi d'aucun ordre des tests.
    const { monter, defaire } = await documentNeuf();
    try {
      const { dessin } = monter(etat);
      expect(dessin.classList.contains('mv-balance')).toBe(true);
      // Une seule animation à la fois : au repos, aucune classe d'animation.
      expect([...dessin.classList].filter((c) => c.startsWith('mv-balance--'))).toEqual([`mv-balance--${etat}`]);
      expect(dessin.getAttribute('data-etat')).toBe(etat);
    } finally {
      defaire();
    }
  });

  it("dessine dans l'espace de noms SVG, au rendu client comme au serveur", () => {
    const dessin = svg();
    const SVG = 'http://www.w3.org/2000/svg';
    expect(dessin.namespaceURI).toBe(SVG);
    expect([...dessin.querySelectorAll('g, path')].every((e) => e.namespaceURI === SVG)).toBe(true);
  });

  it('emploie les classes que mouvement.css anime, et elles y sont', () => {
    // Un renommage d'un côté seulement laisserait la balance immobile, sans
    // erreur : les deux côtés doivent parler des mêmes classes.
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'mouvement.css'), 'utf8');
    const dessin = svg({ etat: 'attente' });
    for (const classe of ['mv-balance__fleau', 'mv-balance__plateau-g', 'mv-balance__plateau-d']) {
      expect(dessin.querySelector(`.${classe}`)).not.toBeNull();
      expect(css).toContain(`.${classe}`);
    }
    for (const etat of ['intro', 'attente']) {
      expect(css).toContain(`.mv-balance--${etat} .mv-balance__fleau`);
      expect(css).toContain(`.mv-balance--${etat} .mv-balance__plateau-g`);
    }
  });

  it('est au repos par défaut', () => {
    expect(svg().classList.contains('mv-balance--repos')).toBe(true);
  });

  it("garde la recette d'Icone : 1em, trait 1,75, classe icone, et les classes ajoutées", () => {
    const dessin = svg({ class: 'text-xl text-white' });
    expect(dessin.getAttribute('width')).toBe('1em');
    expect(dessin.getAttribute('stroke-width')).toBe('1.75');
    expect([...dessin.classList]).toEqual(expect.arrayContaining(['icone', 'text-xl', 'text-white']));
  });

  it('est décorative : aria-hidden, jamais de rôle, jamais focalisable', () => {
    const dessin = svg({ etat: 'attente' });
    expect(dessin.getAttribute('aria-hidden')).toBe('true');
    expect(dessin.hasAttribute('role')).toBe(false);
    expect(dessin.getAttribute('focusable')).toBe('false');
    expect(dessin.querySelector('title')).toBeNull();
  });

  it("l'introduction ne joue qu'au premier montage", async () => {
    // L'en-tête, qui porte le logo, est recréé à chaque navigation interne :
    // sans la mémoire du module (`introDejaJouee`), la balance pèserait à
    // chaque page. Un module neuf, comme au chargement d'un document : les
    // tests précédents ont déjà monté la balance, et ce module garde
    // justement la trace de ce qu'ils ont fait.
    const { monter, defaire } = await documentNeuf();
    try {
      // Une attente ailleurs dans la page ne consomme pas l'introduction.
      expect(monter('attente').etats()).toEqual(['mv-balance--attente']);
      // Le premier logo du document pèse.
      const premier = monter('intro');
      expect(premier.etats()).toEqual(['mv-balance--intro']);
      expect(premier.donnee()).toBe('intro');
      // Navigation interne : l'en-tête est détruit, puis recréé.
      premier.demonter();
      const second = monter('intro');
      expect(second.etats()).toEqual(['mv-balance--repos']);
      expect(second.donnee()).toBe('repos');
      expect(monter('intro').etats()).toEqual(['mv-balance--repos']);
      // L'attente réelle, elle, pèse toujours.
      expect(monter('attente').etats()).toEqual(['mv-balance--attente']);
    } finally {
      defaire();
    }
  });

  it("finie ou coupée, l'introduction laisse la balance au repos : l'en-tête masqué sur /chat ne la rejoue pas", async () => {
    // L'en-tête du layout (main) n'est pas recréé entre / et /chat : sous lg,
    // il y est seulement masqué, et une animation CSS repart de zéro chaque
    // fois que son élément sort de `display: none`. Sa fin (`animationend`)
    // ou sa coupure par le masquage (`animationcancel`) fait donc tomber
    // l'instance au repos. jsdom n'anime rien : les événements sont émis à la
    // main, sur le fléau, d'où ils remontent jusqu'au <svg>, comme dans un
    // navigateur.
    for (const evenement of ['animationend', 'animationcancel']) {
      const { monter, defaire, flushSync } = await documentNeuf();
      try {
        const logo = monter('intro');
        expect(logo.etats(), evenement).toEqual(['mv-balance--intro']);
        logo.dessin.querySelector('.mv-balance__fleau')?.dispatchEvent(new Event(evenement, { bubbles: true }));
        flushSync();
        expect(logo.etats(), evenement).toEqual(['mv-balance--repos']);
        expect(logo.donnee(), evenement).toBe('repos');
        // Une attente qui s'arrête coupe aussi son animation : ce n'est pas
        // une introduction, la balance reste dans son état.
        const attente = monter('attente');
        attente.dessin.querySelector('.mv-balance__fleau')?.dispatchEvent(new Event(evenement, { bubbles: true }));
        flushSync();
        expect(attente.etats(), evenement).toEqual(['mv-balance--attente']);
      } finally {
        defaire();
      }
    }
  });

  it("finie avant l'hydratation (réseau lent), l'introduction laisse la balance au repos ; masquée, elle attend", async () => {
    // Sur un réseau lent, le JavaScript arrive après la fin de
    // l'introduction, partie sans lui avec le HTML du serveur : son
    // `animationend` est passé avant tout écouteur. Le montage le constate :
    // une balance affichée dont le fléau n'a plus d'animation en cours.
    // jsdom n'anime rien et ne met rien en page : on lui fait dire ce que
    // verrait un navigateur (des animations en cours ou non, une boîte ou
    // non).
    let animations: unknown[] = [];
    let boites: unknown[] = [];
    const avant = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
    Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: () => animations });
    const espion = vi
      .spyOn(Element.prototype, 'getClientRects')
      .mockImplementation(() => boites as unknown as DOMRectList);
    try {
      const cas = [
        { quoi: 'affichée, plus rien ne joue : finie', animations: [], boites: [{}], attendu: 'repos' },
        // Une animation dans son délai (0,35 s) compte déjà parmi celles en cours.
        { quoi: 'affichée, encore en cours', animations: [{}], boites: [{}], attendu: 'intro' },
        // Premier chargement sur /chat sous lg : jamais jouée, elle jouera au premier passage sur l'accueil.
        { quoi: 'masquée, sans boîte', animations: [], boites: [], attendu: 'intro' },
      ];
      for (const c of cas) {
        animations = c.animations;
        boites = c.boites;
        const { monter, defaire } = await documentNeuf();
        try {
          expect(monter('intro').etats(), c.quoi).toEqual([`mv-balance--${c.attendu}`]);
        } finally {
          defaire();
        }
      }
    } finally {
      espion.mockRestore();
      if (avant) Object.defineProperty(Element.prototype, 'getAnimations', avant);
      else delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
    }
  });
});
