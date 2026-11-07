import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * La recette des champs (P6), verrouillée sur tout le code des pages.
 *
 * POURQUOI CE TEST. app.css donne aux champs une bordure zinc-500 (4,83:1 sur
 * blanc, ≥ 3:1 exigé par WCAG 1.4.11) et un texte indicatif zinc-500 (zinc-400
 * en sombre). Une classe de page pèse plus lourd que cette règle de base : un
 * `border-zinc-200` (1,27:1) ou un `placeholder-zinc-400` (2,56:1) recopié
 * d'un ancien champ la défaisait en silence, sur la connexion, l'inscription,
 * la réinitialisation, /search et les fenêtres d'administration (mesures du
 * 28/10/2026). Ces deux régressions ne se voient pas en revue.
 */

const ICI = dirname(fileURLToPath(import.meta.url));
const SRC = join(ICI, '..');

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return nom.endsWith('.svelte') || (nom.endsWith('.ts') && !nom.includes('.test.')) ? [chemin] : [];
  });
}

const lignes = fichiers(SRC).flatMap((chemin) =>
  readFileSync(chemin, 'utf8')
    .split('\n')
    .map((ligne, i) => ({ ou: `${relative(SRC, chemin)}:${i + 1}`, ligne })),
);

describe('recette des champs', () => {
  it('aucune classe ne remplace la couleur du texte indicatif', () => {
    expect(lignes.filter(({ ligne }) => /(?:^|[\s"'`:])placeholder-zinc-\d+/.test(ligne)).map(({ ou }) => ou)).toEqual([]);
  });

  it('aucun champ (ni son cadre) ne repasse sous la bordure zinc-500', () => {
    // Un champ du dépôt se reconnaît à son focus noir (`focus:` ou
    // `focus-within:border-zinc-950`) ; sa bordure au repos ne peut pas être
    // plus pâle que zinc-500 en clair.
    const pales = lignes.filter(
      ({ ligne }) =>
        /focus(?:-within)?:border-zinc-950/.test(ligne) && /(?:^|[\s"'`])border-zinc-(?:50|100|200|300|400)(?=[\s"'`])/.test(ligne),
    );
    expect(pales.map(({ ou }) => ou)).toEqual([]);
  });
});
