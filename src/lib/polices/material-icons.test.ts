import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PERSONA_ICONE } from '$lib/stores/persona';

/**
 * Le sous-ensemble de Material Icons servi par le site couvre EXACTEMENT les
 * icônes que le code affiche.
 *
 * POURQUOI. La police complète pesait 125 Ko (2 122 icônes) pour 65 icônes
 * affichées, préchargée en priorité haute sur chaque page : sur une 4G lente,
 * elle disputait la bande passante à la feuille de style et retardait le
 * premier affichage de 0,6 à 1 s. Le sous-ensemble (material-icons.woff2, à
 * côté de ce fichier) ne garde que les ligatures de material-icons.txt. Une
 * icône ajoutée au code sans être ajoutée à la liste et à la police
 * s'afficherait en toutes lettres (« calendar_today ») au lieu de l'icône.
 *
 * Ce test lit les composants comme du texte : chaque élément de classe
 * `material-icons`, son contenu fixe (`<span …>search</span>`) ou son
 * expression (`{copied ? "check" : "link"}`, `{PERSONA_ICONE[…]}`,
 * `{tab.icon}`). Une expression qu'il ne sait pas résoudre le fait échouer :
 * mieux vaut lui apprendre la nouvelle forme qu'oublier une icône.
 *
 * Après un changement de la liste : relancer scripts/sous-ensemble-icones.py
 * (mode d'emploi en tête du script), qui régénère la police et son empreinte.
 */

const SOURCES = import.meta.glob('/src/**/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const TOUS_LES_FICHIERS = import.meta.glob(['/src/**/*.{svelte,ts}', '!/src/**/*.test.ts', '!/src/**/*.spec.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const NOM_D_ICONE = /^[a-z0-9_]+$/;

/** Ligatures du sous-ensemble : une par ligne, `#` pour un commentaire. */
function lireListe(texte: string): string[] {
  return texte
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne !== '' && !ligne.startsWith('#'));
}

// La liste, la police et leurs empreintes vivent à côté de ce fichier.
const ICI = dirname(fileURLToPath(import.meta.url));
const LISTE_BRUTE = readFileSync(join(ICI, 'material-icons.txt'));
const LISTE = lireListe(LISTE_BRUTE.toString('utf8'));
const POLICE = readFileSync(join(ICI, 'material-icons.woff2'));
const EMPREINTE = JSON.parse(readFileSync(join(ICI, 'material-icons.empreinte.json'), 'utf8')) as {
  liste: string;
  police: string;
};

const sha256 = (octets: Buffer) => createHash('sha256').update(octets).digest('hex');

/**
 * Position du `>` qui ferme la balise ouvrante commencée en `debut` (sur `<`).
 * Un `>` dans une valeur d'attribut, une expression (`on:click={() => …}`) ou
 * une chaîne JavaScript ne la ferme pas.
 */
function finDeBalise(source: string, debut: number): number {
  const pile: string[] = [];
  for (let i = debut + 1; i < source.length; i++) {
    const c = source[i];
    const haut = pile.at(-1);
    if (haut === undefined) {
      if (c === '>') return i;
      if (c === '"' || c === "'") pile.push(`attribut${c}`);
      else if (c === '{') pile.push('expression');
    } else if (haut.startsWith('attribut')) {
      if (c === haut.at(-1)) pile.pop();
      else if (c === '{') pile.push('expression');
    } else if (haut === 'expression') {
      if (c === '{') pile.push('expression');
      else if (c === '}') pile.pop();
      else if (c === '"' || c === "'" || c === '`') pile.push(`chaine${c}`);
    } else if (c === '\\') {
      i++;
    } else if (c === haut.at(-1)) {
      pile.pop();
    } else if (haut === 'chaine`' && c === '$' && source[i + 1] === '{') {
      pile.push('expression');
      i++;
    }
  }
  return -1;
}

/** Expressions `{…}` de premier niveau d'un contenu, et le texte hors d'elles. */
function expressions(contenu: string): { dedans: string[]; dehors: string } {
  const dedans: string[] = [];
  let dehors = '';
  let profondeur = 0;
  let courante = '';
  for (const c of contenu) {
    if (c === '{') {
      if (profondeur > 0) courante += c;
      profondeur++;
    } else if (c === '}' && profondeur > 0) {
      profondeur--;
      if (profondeur === 0) {
        dedans.push(courante);
        courante = '';
      } else {
        courante += c;
      }
    } else if (profondeur > 0) {
      courante += c;
    } else {
      dehors += c;
    }
  }
  return { dedans, dehors };
}

/** Valeurs littérales des propriétés `icon:` du code (onglets, badges…). */
const VALEURS_ICON = new Set(
  Object.values(TOUS_LES_FICHIERS).flatMap((source) =>
    [...source.matchAll(/\bicon\s*:\s*(["'])([a-z0-9_]+)\1/g)].map((m) => m[2]),
  ),
);

/** Noms d'icônes d'une expression, ou `null` si elle n'est pas résolue. */
function nomsDeLExpression(expression: string): string[] | null {
  const noms: string[] = [];
  let reste = expression;
  if (/\bPERSONA_ICONE\s*\[/.test(reste)) {
    noms.push(...Object.values(PERSONA_ICONE));
    // L'indice (`personaAffiche ?? "general"`) est une clé, pas une icône.
    reste = reste.replace(/\bPERSONA_ICONE\s*\[[^\]]*\]/g, ' ');
  }
  if (/\b[\w$.]+\.icon\b/.test(reste)) {
    noms.push(...VALEURS_ICON);
    reste = reste.replace(/\b[\w$.]+\.icon\b/g, ' ');
  }
  for (const [, , chaine] of reste.matchAll(/(["'`])([^"'`\\]*)\1/g)) {
    if (NOM_D_ICONE.test(chaine)) noms.push(chaine);
  }
  return noms.length > 0 ? noms : null;
}

/** Ce que les composants affichent avec la police, et ce qui n'a pas pu être lu. */
function iconesDuCode(): { utilisees: Map<string, Set<string>>; nonResolues: string[] } {
  const utilisees = new Map<string, Set<string>>();
  const nonResolues: string[] = [];
  const noter = (nom: string, fichier: string) => {
    if (!utilisees.has(nom)) utilisees.set(nom, new Set());
    utilisees.get(nom)?.add(fichier);
  };

  for (const [fichier, brut] of Object.entries(SOURCES)) {
    // Ni le script, ni le style, ni les commentaires : un `<` de TypeScript
    // (`Record<…>`) y passerait pour une balise. Une seule expression, pour
    // que le premier ouvert l'emporte : un commentaire qui cite `<style>`
    // emportait sinon tout le balisage jusqu'au vrai `</style>`.
    const source = brut.replace(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/g, '');
    for (const balise of source.matchAll(/<([a-zA-Z][\w-]*)\b/g)) {
      const debut = balise.index ?? 0;
      const fin = finDeBalise(source, debut);
      if (fin < 0) continue;
      if (!/(^|[\s"'{])material-icons(?![\w-])/.test(source.slice(debut, fin))) continue;

      const fermeture = source.indexOf(`</${balise[1]}`, fin);
      const contenu = source.slice(fin + 1, fermeture < 0 ? undefined : fermeture);
      const { dedans, dehors } = expressions(contenu);
      const fixe = dehors.trim();
      if (fixe !== '') {
        if (NOM_D_ICONE.test(fixe) && dedans.length === 0) noter(fixe, fichier);
        else nonResolues.push(`${fichier} : « ${contenu.trim()} »`);
        continue;
      }
      for (const expression of dedans) {
        const noms = nomsDeLExpression(expression);
        if (noms === null) nonResolues.push(`${fichier} : {${expression.trim()}}`);
        else for (const nom of noms) noter(nom, fichier);
      }
    }
  }
  return { utilisees, nonResolues };
}

describe('sous-ensemble de Material Icons', () => {
  const { utilisees, nonResolues } = iconesDuCode();

  it('lit toutes les icônes du code', () => {
    expect(nonResolues, 'expressions d’icône à apprendre à ce test').toEqual([]);
    // Garde-fou : un extracteur cassé qui ne trouverait rien rendrait le test
    // suivant vrai pour une liste vide.
    expect(utilisees.size).toBeGreaterThan(40);
  });

  it('contient chaque icône affichée, et seulement elles', () => {
    const manquantes = [...utilisees.keys()].filter((nom) => !LISTE.includes(nom)).sort();
    const inutiles = LISTE.filter((nom) => !utilisees.has(nom));
    expect(
      manquantes.map((nom) => `${nom} (${[...(utilisees.get(nom) ?? [])].join(', ')})`),
      'icônes affichées absentes de material-icons.txt : les ajouter, puis régénérer la police',
    ).toEqual([]);
    expect(inutiles, 'icônes de material-icons.txt que plus rien n’affiche : les retirer, puis régénérer').toEqual([]);
  });

  it('a une liste triée et sans doublon', () => {
    expect(LISTE).toEqual([...new Set(LISTE)].sort());
  });

  it('a une police générée depuis cette liste exacte', () => {
    // Empreintes écrites par scripts/sous-ensemble-icones.py : une liste
    // modifiée sans régénérer la police, ou une police remplacée à la main,
    // ne passent pas.
    expect(sha256(LISTE_BRUTE), 'material-icons.txt modifiée : relancer scripts/sous-ensemble-icones.py').toBe(
      EMPREINTE.liste,
    );
    expect(sha256(POLICE), 'material-icons.woff2 ne vient pas du script').toBe(EMPREINTE.police);
    // Un sous-ensemble, pas la police complète (125 Ko).
    expect(POLICE.byteLength).toBeLessThan(16_000);
  });
});
