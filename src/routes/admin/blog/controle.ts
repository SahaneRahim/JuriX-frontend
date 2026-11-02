/**
 * Le contrôle IA d'un article du blog et sa relecture humaine, tels que les
 * rend l'API (contrat du 30/10), lus défensivement.
 *
 * POURQUOI (décision du propriétaire du 30/10, « Relecture + contrôle IA »).
 * Des citations vérifiées ne rendent pas la prose juste. L'essai réel du
 * 30/10 a publié, sans le moindre avertissement :
 * - un article sur le bail qui disait l'expulsion possible sans juge, alors
 *   que les extraits cités (AUDCG, art. 127, 128 et 133) disent le contraire
 *   ou parlent d'autre chose ;
 * - un article sur le licenciement qui inversait la charge de la preuve,
 *   contre l'article 39, alinéa 3, du Code du travail cité dans le même
 *   article ;
 * - une explication de citation contraire à l'article 1752 du Code civil.
 * Désormais, le serveur fait juger chaque phrase par le modèle contre les
 * extraits numérotés (« soutenue », « non soutenue », « contredite », « hors
 * des sources »), et une personne coche chaque partie relue contre les
 * sources. On ne publie qu'un article « publiable » : citations vérifiées,
 * contrôle à jour sans phrase contredite, relecture complète.
 */

type Objet = Record<string, unknown>;
const estObjet = (v: unknown): v is Objet => typeof v === 'object' && v !== null && !Array.isArray(v);
const chaine = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

/** La partie de l'article d'où vient une phrase contrôlée. */
export const PARTIES_DU_CONTROLE = ['contexte', 'resume', 'point_cle', 'impact', 'explication', 'question'] as const;
export type PartieDuControle = (typeof PARTIES_DU_CONTROLE)[number];

export const VERDICTS = ['soutenue', 'non_soutenue', 'contredite', 'hors_sources'] as const;
export type Verdict = (typeof VERDICTS)[number];

export interface PhraseControlee {
  /** Identifiant donné par le serveur, unique dans le contrôle. */
  id: string;
  partie: PartieDuControle;
  /** Le rang de l'élément dans sa partie : point clé ou citation (0 pour une partie d'un seul texte). */
  index: number;
  texte: string;
  verdict: Verdict;
  /** Les numéros des extraits sur lesquels le verdict s'appuie (« soutenue par l'extrait 3 »). */
  extraits: number[];
  /** La raison du verdict, en une phrase, montrée à la demande. */
  raison: string;
}

export interface ControleIA {
  faitLe: string;
  modele: string;
  /** L'empreinte du texte contrôlé : le serveur la compare au texte actuel. */
  empreinte: string;
  phrases: PhraseControlee[];
}

/** Les six parties que l'administrateur relit, chacune avec sa case à cocher. */
export const PARTIES_DE_RELECTURE = ['contexte', 'resume', 'points_cles', 'impact', 'explications', 'question'] as const;
export type PartieDeRelecture = (typeof PARTIES_DE_RELECTURE)[number];

export interface Relecture {
  parties: Record<PartieDeRelecture, boolean>;
  /** Qui a enregistré la relecture, et quand : noté par le serveur. */
  par: string | null;
  le: string | null;
}

/** La partie relue à laquelle appartient une phrase contrôlée. */
export const PARTIE_DE_RELECTURE: Record<PartieDuControle, PartieDeRelecture> = {
  contexte: 'contexte',
  resume: 'resume',
  point_cle: 'points_cles',
  impact: 'impact',
  explication: 'explications',
  question: 'question',
};

/** Un verdict inconnu se lit « non soutenue » (« À vérifier ») : jamais un accord par défaut. */
function verdictDepuis(valeur: unknown): Verdict {
  return (VERDICTS as readonly unknown[]).includes(valeur) ? (valeur as Verdict) : 'non_soutenue';
}

function numerosDExtraits(valeur: unknown): number[] {
  if (!Array.isArray(valeur)) return [];
  const numeros = valeur.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(numeros)].sort((a, b) => a - b);
}

/**
 * Le contrôle IA d'un article (`controle_ia`), ou `null` s'il n'y en a pas ou
 * s'il est illisible. Une phrase d'une partie inconnue, ou sans texte, est
 * écartée ; un identifiant manquant ou en double est remplacé, pour que
 * chaque phrase garde sa propre ligne (et sa propre raison) à l'écran.
 */
export function controleDepuis(brut: unknown): ControleIA | null {
  if (!estObjet(brut) || !Array.isArray(brut.phrases)) return null;
  const vus = new Set<string>();
  const phrases: PhraseControlee[] = [];
  brut.phrases.forEach((p, rang) => {
    if (!estObjet(p)) return;
    const partie = p.partie;
    const texte = chaine(p.texte).trim();
    if (!(PARTIES_DU_CONTROLE as readonly unknown[]).includes(partie) || !texte) return;
    let id = chaine(p.id).trim();
    if (!id || vus.has(id)) id = `phrase-${rang}`;
    vus.add(id);
    const index = Number(p.index);
    phrases.push({
      id,
      partie: partie as PartieDuControle,
      index: Number.isInteger(index) && index >= 0 ? index : 0,
      texte,
      verdict: verdictDepuis(p.verdict),
      extraits: numerosDExtraits(p.extraits),
      raison: chaine(p.raison).trim(),
    });
  });
  return {
    faitLe: chaine(brut.fait_le ?? brut.faitLe),
    modele: chaine(brut.modele),
    empreinte: chaine(brut.empreinte),
    phrases,
  };
}

/** Aucune partie relue. */
export function relectureVide(): Record<PartieDeRelecture, boolean> {
  return { contexte: false, resume: false, points_cles: false, impact: false, explications: false, question: false };
}

/**
 * La relecture enregistrée (`relecture`). Seul `true` coche une case : une
 * valeur absente ou d'une autre forme n'est jamais une relecture faite.
 */
export function relectureDepuis(brut: unknown): Relecture {
  const relecture: Relecture = { parties: relectureVide(), par: null, le: null };
  if (!estObjet(brut)) return relecture;
  const parties = estObjet(brut.parties) ? brut.parties : {};
  for (const partie of PARTIES_DE_RELECTURE) relecture.parties[partie] = parties[partie] === true;
  // `points_cles` est le nom du contrat ; la forme camelCase est lue aussi.
  if (parties.pointsCles === true) relecture.parties.points_cles = true;
  relecture.par = chaine(brut.par).trim() || null;
  relecture.le = chaine(brut.le).trim() || null;
  return relecture;
}

/** Le nombre de phrases par verdict. */
export function compteDesVerdicts(controle: ControleIA | null): Record<Verdict, number> {
  const compte: Record<Verdict, number> = { soutenue: 0, non_soutenue: 0, contredite: 0, hors_sources: 0 };
  for (const phrase of controle?.phrases ?? []) compte[phrase.verdict]++;
  return compte;
}

/** Un groupe de phrases à l'écran : un point clé, une citation, ou toute une partie d'un seul texte. */
export interface GroupeDePhrases {
  /** Le rang de l'élément dans sa partie (point clé, citation), ou `null` pour une partie d'un seul texte. */
  rang: number | null;
  phrases: PhraseControlee[];
}

/** Pour comparer des textes : sans espaces ni différence d'apostrophe. */
const compacte = (texte: string) => texte.normalize('NFC').replace(/[’ʼ]/g, "'").replace(/\s+/g, '');

/**
 * Les phrases contrôlées d'une partie relue, groupées par élément dans
 * l'ordre du texte : par point clé, par citation, ou en un seul groupe.
 *
 * L'élément d'une phrase est celui dont le TEXTE la contient (`elements`,
 * les textes des points clés ou des explications) ; à défaut, son `index`
 * pris comme un rang à partir de 0. POURQUOI : sous l'explication de la
 * citation 2 s'affiche l'extrait de la citation 2 ; rattachée par erreur à
 * une autre citation (un index compté à partir de 1), la phrase serait relue
 * contre le mauvais extrait.
 */
export function groupesDePhrases(
  controle: ControleIA | null,
  partie: PartieDeRelecture,
  elements: readonly string[] = [],
): GroupeDePhrases[] {
  const phrases = (controle?.phrases ?? []).filter((p) => PARTIE_DE_RELECTURE[p.partie] === partie);
  if (partie !== 'points_cles' && partie !== 'explications') {
    return phrases.length > 0 ? [{ rang: null, phrases }] : [];
  }
  const textes = elements.map(compacte);
  const groupes = new Map<number, PhraseControlee[]>();
  for (const phrase of phrases) {
    const morceau = compacte(phrase.texte);
    const parLeTexte = morceau ? textes.findIndex((t) => t.includes(morceau)) : -1;
    const rang = parLeTexte >= 0 ? parLeTexte : phrase.index;
    groupes.set(rang, [...(groupes.get(rang) ?? []), phrase]);
  }
  return [...groupes.entries()].sort(([a], [b]) => a - b).map(([rang, liste]) => ({ rang, phrases: liste }));
}
