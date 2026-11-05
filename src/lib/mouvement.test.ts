import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

/**
 * Le module de mouvement (src/lib/mouvement.css et mouvement.ts).
 *
 * POURQUOI CES TESTS. La sûreté du « mouvement réduit » repose sur une règle
 * de construction, pas sur une règle globale qui couperait tout : chaque
 * @keyframes, chaque animation et chaque transition du module est déclaré
 * dans @media (prefers-reduced-motion: no-preference). Un seul @keyframes
 * écrit hors du bloc animerait la page pour qui a demandé moins de mouvement,
 * sans qu'aucun écran ne le montre en revue. Un @keyframes sans préfixe
 * (spin, pulse), chargé après app.css, remplacerait en silence celui d'un
 * utilitaire de Tailwind (animate-spin de la palette, de StatusBadge…). Et une
 * feuille importée ailleurs qu'au layout racine changerait l'ordre des
 * feuilles en production.
 */

const etat = vi.hoisted(() => ({ current: false }));
vi.mock('svelte/motion', () => ({ prefersReducedMotion: etat }));

import { COURBE, DUREES, duree } from './mouvement';

// Chemins tirés du fichier de test, comme icones.test.ts : sous jsdom, `new URL`
// rend un objet que fileURLToPath de Node refuse.
const ICI = dirname(fileURLToPath(import.meta.url));
const lire = (relatif: string) => readFileSync(join(ICI, relatif), 'utf8');
const sansCommentaires = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const normaliserCourbe = (s: string) => s.replace(/\s+/g, '').replace(/(^|[(,])0\./g, '$1.');

const CSS = sansCommentaires(lire('./mouvement.css'));

/** Les intervalles [début, fin[ des blocs `@media (prefers-reduced-motion: no-preference)`. */
function blocsDeMouvement(css: string): Array<[number, number]> {
  const blocs: Array<[number, number]> = [];
  const ouverture = /@media\s*\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)\s*\{/g;
  for (const m of css.matchAll(ouverture)) {
    const debut = (m.index ?? 0) + m[0].length;
    let profondeur = 1;
    let i = debut;
    for (; i < css.length && profondeur > 0; i++) {
      if (css[i] === '{') profondeur++;
      else if (css[i] === '}') profondeur--;
    }
    blocs.push([debut, i]);
  }
  return blocs;
}

/** Les @keyframes d'une feuille, préfixe de fournisseur et nom entre guillemets compris. */
const KEYFRAMES = /@(?:-[a-z]+-)?keyframes\s+["']?([\w-]+)["']?/g;
/** Les déclarations d'animation et de transition, préfixe de fournisseur compris. */
const MOUVEMENTS = /(?:^|[\s;{])((?:-[a-z]+-)?(?:animation|transition)(?:-[a-z-]+)?)\s*:/g;

function dansUnBloc(css: string) {
  const blocs = blocsDeMouvement(css);
  return (index: number) => blocs.some(([debut, fin]) => index >= debut && index < fin);
}

/** Ce que la règle « tout dans le bloc » reproche à une feuille. */
function horsDuBloc(css: string) {
  const dedans = dansUnBloc(css);
  return {
    keyframes: [...css.matchAll(KEYFRAMES)].filter((m) => !dedans(m.index ?? 0)).map((m) => m[1]),
    sansPrefixe: [...css.matchAll(KEYFRAMES)].filter((m) => !m[1].startsWith('mv-')).map((m) => m[1]),
    mouvements: [...css.matchAll(MOUVEMENTS)].filter((m) => !dedans(m.index ?? 0)).map((m) => m[1]),
  };
}

describe('mouvement.css', () => {
  it('a un bloc « no-preference », et il porte les @keyframes, animations et transitions', () => {
    const dedans = dansUnBloc(CSS);
    expect(blocsDeMouvement(CSS).length).toBeGreaterThan(0);
    // Témoin positif : la règle voit bien ce qu'elle doit trouver.
    expect([...CSS.matchAll(KEYFRAMES)].filter((m) => dedans(m.index ?? 0)).length).toBeGreaterThan(10);
    expect([...CSS.matchAll(MOUVEMENTS)].filter((m) => dedans(m.index ?? 0)).length).toBeGreaterThan(10);
  });

  it('déclare chaque @keyframes, animation et transition dans le bloc « no-preference », préfixé mv-', () => {
    expect(horsDuBloc(CSS)).toEqual({ keyframes: [], sansPrefixe: [], mouvements: [] });
  });

  it('voit les fautes que la règle interdit, préfixes de fournisseur et guillemets compris', () => {
    const fautive = `${CSS}
      @-webkit-keyframes spin { to { transform: rotate(1turn); } }
      @keyframes "mv-glisse" { from { opacity: 0; } }
      .mv-x { -webkit-animation: spin 1s; transition: opacity 0.2s; }`;
    expect(horsDuBloc(fautive)).toEqual({
      keyframes: ['spin', 'mv-glisse'],
      sansPrefixe: ['spin'],
      mouvements: ['-webkit-animation', 'transition'],
    });
  });

  it("n'emploie ni `both` ni `forwards` : une entrée s'efface devant le style réel (A2 § 2.2)", () => {
    expect(CSS.match(/\b(?:both|forwards)\b/g)).toBeNull();
  });

  it('préfixe toutes ses classes par mv- (seule exception : .dark, le thème sombre)', () => {
    const classes = new Set([...CSS.matchAll(/\.([_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
    const fautives = [...classes].filter((nom) => nom !== 'dark' && !nom.startsWith('mv-'));
    expect(fautives).toEqual([]);
  });

  it('prend la courbe commune pour variable, la même que COURBE et que le jeton ease-jx de Tailwind', () => {
    const variable = CSS.match(/--mv-courbe:\s*([^;]+);/)?.[1] ?? '';
    const jeton = lire('../../tailwind.config.js').match(/\bjx:\s*'([^']+)'/)?.[1] ?? '';
    expect(normaliserCourbe(variable)).toBe(normaliserCourbe(COURBE));
    expect(normaliserCourbe(jeton)).toBe(normaliserCourbe(COURBE));
  });

  it('est importé par le layout racine, juste après app.css', () => {
    const layout = lire('../routes/+layout.svelte');
    const ligneAppCss = 'import "../app.css";';
    const appCss = layout.indexOf(ligneAppCss);
    const mouvement = layout.indexOf('import "$lib/mouvement.css";');
    expect(appCss).toBeGreaterThan(-1);
    expect(mouvement).toBeGreaterThan(appCss);
    // Entre les deux, des commentaires seulement : aucune autre instruction
    // d'import, dont la feuille passerait entre app.css et le mouvement.
    const entre = layout.slice(appCss + ligneAppCss.length, mouvement);
    expect(entre.match(/^\s*import\s/gm)).toBeNull();
  });

  it("n'a pour app.css et le mouvement qu'un seul importateur : le layout racine", () => {
    // Une seconde importation de app.css (les pages de compte et
    // l'administration en avaient une) en fait une feuille partagée, que
    // SvelteKit sert APRÈS celle du layout : le mouvement passait alors
    // avant app.css en production, et chaque page chargeait une feuille
    // bloquante de plus.
    const racine = join(ICI, '..') + '/';
    const fichiers: string[] = [];
    const parcourir = (dossier: string) => {
      for (const nom of readdirSync(dossier)) {
        const chemin = join(dossier, nom);
        if (statSync(chemin).isDirectory()) parcourir(chemin);
        else if (/\.(svelte|ts|js)$/.test(nom) && !/\.test\.ts$/.test(nom)) fichiers.push(chemin);
      }
    };
    parcourir(racine);
    const importateurs = fichiers
      .filter((f) => /^\s*import\s+["'][^"']*\/(?:app|mouvement)\.css["']/m.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(racine.length).replace(/\\/g, '/'));
    expect(importateurs).toEqual(['routes/+layout.svelte']);
  });
});

describe('mouvement.ts', () => {
  it('rend la durée demandée quand le mouvement est permis', () => {
    etat.current = false;
    expect(duree(350)).toBe(350);
  });

  it('rend 0 en mouvement réduit, lu à chaque appel', () => {
    etat.current = true;
    expect(duree(350)).toBe(0);
    etat.current = false;
    expect(duree(350)).toBe(350);
  });

  it('garde les trois repères de durée de A2', () => {
    expect(DUREES).toEqual({ toucher: 150, changement: 300, arrivee: 800 });
  });
});
