/**
 * Les passages surlignés d'un article (refonte A, page de lecture) : découpe
 * un paragraphe en segments, marqués ou non, que la page rend en NŒUDS Svelte
 * (`<mark>` pour un passage, texte brut sinon).
 *
 * POURQUOI DES SEGMENTS, ET JAMAIS DE HTML. Le passage vient d'ailleurs que
 * du texte (aujourd'hui de nulle part, demain de l'explication du modèle :
 * PASSATION § 9, B3). Insérer un `<mark>` dans une chaîne puis la rendre par
 * `{@html}` ouvrirait la page à toute balise glissée dans un passage ou dans
 * le texte d'une loi ; le dépôt l'interdit (eslint.config.js,
 * src/lib/highlight.ts). Ici, rien n'est réécrit : chaque segment est un
 * morceau du paragraphe tel quel, et la concaténation des segments rend le
 * paragraphe à l'identique (surlignage.test.ts le vérifie).
 *
 * POURQUOI v1 SANS EFFET. Le produit n'a aujourd'hui aucune donnée de passage
 * (décision L2) : sans passage, `segmenter` rend le paragraphe en un seul
 * segment non marqué, et la page s'affiche comme avant. Le module est livré,
 * testé, et prêt pour le jour où l'API en fournira.
 *
 * LA RECHERCHE. Mot pour mot, mais sans tenir compte de la casse, des accents
 * (`plier`, decoupage.ts, qui garde la longueur : une lettre pour une
 * lettre), des espaces (une suite de blancs, insécables comprises, vaut une
 * espace) ni de la forme de l'apostrophe (’ ou ') : un modèle recopie un
 * passage avec ses propres espaces et apostrophes. Le pliage ne sert qu'à
 * TROUVER la position ; le texte affiché reste celui du paragraphe.
 */
import { plier } from './decoupage';

/** Un passage à surligner : `cle` ancre la note de l'IA ; `sous` l'accompagne. */
export interface Passage {
  texte: string;
  role: 'cle' | 'sous';
}

/** Un morceau du paragraphe, tel quel, marqué par son passage ou non. */
export interface Segment {
  texte: string;
  passage: Passage | null;
}

/** Apostrophes qu'un modèle ou l'OCR emploie l'une pour l'autre. */
const APOSTROPHES = /[’‘ʼ`´]/;

/**
 * Le paragraphe plié pour la recherche, et pour chaque caractère plié, sa
 * position dans le paragraphe d'origine. Une suite de blancs ne garde qu'une
 * espace, qui pointe vers le premier blanc de la suite.
 */
function plierAvecPositions(texte: string): { plie: string; positions: number[] } {
  let plie = '';
  const positions: number[] = [];
  for (let i = 0; i < texte.length; i++) {
    const caractere = texte[i];
    if (/\s/.test(caractere)) {
      // `\s` couvre l'espace insécable (U+00A0) et l'espace fine (U+202F).
      if (plie.endsWith(' ')) continue;
      plie += ' ';
    } else {
      plie += APOSTROPHES.test(caractere) ? "'" : plier(caractere);
    }
    positions.push(i);
  }
  return { plie, positions };
}

/** Le passage plié, sans blancs aux bords. */
function plierLePassage(texte: string): string {
  return plierAvecPositions(texte.trim()).plie;
}

interface Etendue {
  debut: number;
  fin: number;
  passage: Passage;
}

/** La première occurrence du passage dans le paragraphe, en positions d'origine, ou null. */
function trouver(paragraphe: { plie: string; positions: number[] }, passage: Passage): Etendue | null {
  const cherche = plierLePassage(passage.texte);
  if (!cherche) return null;
  const debut = paragraphe.plie.indexOf(cherche);
  if (debut < 0) return null;
  const dernier = debut + cherche.length - 1;
  return { debut: paragraphe.positions[debut], fin: paragraphe.positions[dernier] + 1, passage };
}

/**
 * Le paragraphe en segments. Chaque passage n'est marqué qu'à sa première
 * occurrence. Deux passages qui se chevauchent : la clé l'emporte, et le
 * sous-passage ne garde que ce qui dépasse d'elle (rien quand la clé le
 * contient) ; deux passages de même rôle : le premier trouvé l'emporte.
 */
export function segmenter(paragraphe: string, passages: readonly Passage[]): Segment[] {
  if (!paragraphe) return [];
  if (passages.length === 0) return [{ texte: paragraphe, passage: null }];

  const plie = plierAvecPositions(paragraphe);
  const trouvees = passages
    .map((passage, rang) => ({ etendue: trouver(plie, passage), rang }))
    .filter((t): t is { etendue: Etendue; rang: number } => t.etendue !== null)
    // Les clés d'abord, puis l'ordre donné : ce qui est retenu en premier
    // n'est jamais rogné.
    .sort((a, b) => Number(a.etendue.passage.role !== 'cle') - Number(b.etendue.passage.role !== 'cle') || a.rang - b.rang)
    .map((t) => t.etendue);

  // Les étendues retenues, sans chevauchement : chacune perd ce qu'une
  // étendue déjà retenue couvre (elle peut s'y couper en deux morceaux).
  let retenues: Etendue[] = [];
  for (const etendue of trouvees) {
    let morceaux: Etendue[] = [etendue];
    for (const prise of retenues) {
      morceaux = morceaux.flatMap((m) => {
        if (m.fin <= prise.debut || m.debut >= prise.fin) return [m];
        const reste: Etendue[] = [];
        if (m.debut < prise.debut) reste.push({ ...m, fin: prise.debut });
        if (m.fin > prise.fin) reste.push({ ...m, debut: prise.fin });
        return reste;
      });
    }
    retenues = [...retenues, ...morceaux.filter((m) => paragraphe.slice(m.debut, m.fin).trim() !== '')];
  }
  retenues.sort((a, b) => a.debut - b.debut);

  const segments: Segment[] = [];
  let curseur = 0;
  for (const { debut, fin, passage } of retenues) {
    if (debut > curseur) segments.push({ texte: paragraphe.slice(curseur, debut), passage: null });
    segments.push({ texte: paragraphe.slice(debut, fin), passage });
    curseur = fin;
  }
  if (curseur < paragraphe.length) segments.push({ texte: paragraphe.slice(curseur), passage: null });
  return segments;
}

/**
 * Les passages lus dans une réponse de l'API, s'il y en a : une liste de
 * `{ texte, role }` (`role` absent ou inconnu : une clé). Tout le reste est
 * ignoré, sans erreur : aujourd'hui, `POST /laws/{id}/explain-article` ne
 * renvoie pas ce champ (PASSATION § 9, B3), et la page n'en surligne aucun.
 */
export function lirePassages(valeur: unknown): Passage[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.flatMap((element): Passage[] => {
    if (!element || typeof element !== 'object') return [];
    const { texte, role } = element as Record<string, unknown>;
    if (typeof texte !== 'string' || !texte.trim()) return [];
    return [{ texte, role: role === 'sous' ? 'sous' : 'cle' }];
  });
}
