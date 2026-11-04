import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
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

  it.each(['repos', 'intro', 'attente'] as const)("porte la classe de l'état « %s », et elle seule", (etat) => {
    const dessin = svg({ etat });
    expect(dessin.classList.contains('mv-balance')).toBe(true);
    // Une seule animation à la fois : au repos, aucune classe d'animation.
    expect([...dessin.classList].filter((c) => c.startsWith('mv-balance--'))).toEqual([`mv-balance--${etat}`]);
    expect(dessin.getAttribute('data-etat')).toBe(etat);
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
});
