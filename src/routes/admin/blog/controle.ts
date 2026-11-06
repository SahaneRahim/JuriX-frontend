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
 *
 * LE TITRE EST UNE PARTIE COMME LES AUTRES (avenant du tour 4, des deux
 * côtés). Au tour 3, il partait en ligne sans contrôle ni relecture, et la
 * vue Relecture ne le montrait même pas. C'est pourtant la phrase la plus lue
 * (titre de la page, carte de /blog, onglet, partage), et celle de l'essai
 * réel du 30/10 portait l'erreur : « Expulsion locative sans jugement : quels
 * cas au Cameroun ? » présuppose ce que l'article 133 de l'AUDCG contredit.
 */

type Objet = Record<string, unknown>;
const estObjet = (v: unknown): v is Objet => typeof v === 'object' && v !== null && !Array.isArray(v);
const chaine = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

/** La partie de l'article d'où vient une phrase contrôlée. */
export const PARTIES_DU_CONTROLE = ['titre', 'contexte', 'resume', 'point_cle', 'impact', 'explication', 'question'] as const;
export type PartieDuControle = (typeof PARTIES_DU_CONTROLE)[number];

export const VERDICTS = ['soutenue', 'non_soutenue', 'contredite', 'hors_sources'] as const;
export type Verdict = (typeof VERDICTS)[number];

/**
 * Ce que la phrase prête au droit, selon le contrôle : « regle » (un droit,
 * une obligation, une interdiction, une condition, une exception, un délai,
 * un montant, une procédure, qui décide, qui doit prouver), ou « autre » (un
 * fait de la situation du lecteur, un conseil pratique, une question qui ne
 * présuppose aucune règle).
 */
export type NatureDeLaPhrase = 'regle' | 'autre';

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
  /** « regle » ou « autre » (avenant du tour 7) ; absente ou illisible, « regle » (`natureDepuis`). */
  nature: NatureDeLaPhrase;
}

export interface ControleIA {
  faitLe: string;
  modele: string;
  /** L'empreinte du texte contrôlé : le serveur la compare au texte actuel. */
  empreinte: string;
  phrases: PhraseControlee[];
}

/**
 * Les sept parties que l'administrateur relit, chacune avec sa case à cocher,
 * dans l'ordre de lecture de la page publique : le titre d'abord.
 */
export const PARTIES_DE_RELECTURE = ['titre', 'contexte', 'resume', 'points_cles', 'impact', 'explications', 'question'] as const;
export type PartieDeRelecture = (typeof PARTIES_DE_RELECTURE)[number];

export interface Relecture {
  parties: Record<PartieDeRelecture, boolean>;
  /** Qui a enregistré la relecture, et quand : noté par le serveur. */
  par: string | null;
  le: string | null;
  /**
   * Le contrôle contre lequel les cases enregistrées ont été cochées : le
   * `controle_ia.fait_le` que le front a envoyé avec elles, que l'API rend
   * tel quel (avenant du tour 5). `null` s'il n'y en a pas.
   */
  controle: string | null;
  /**
   * Les phrases de règle que l'administrateur a confirmées, une à une (« J'ai
   * vérifié cette phrase dans le texte ») : les `id` de `controle_ia.phrases`,
   * tels que l'API les rend (`relecture.phrases_confirmees`, avenant du tour
   * 7). Vide sans confirmation.
   */
  phrasesConfirmees: string[];
}

/** La partie relue à laquelle appartient une phrase contrôlée. */
export const PARTIE_DE_RELECTURE: Record<PartieDuControle, PartieDeRelecture> = {
  titre: 'titre',
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

/**
 * Seul « autre » dit qu'une phrase ne prête rien au droit. POURQUOI « regle »
 * dans le doute (comme `lire_la_nature` de l'API) : une phrase de nature
 * absente (contrôle d'avant le tour 7, phrase que le modèle n'a pas jugée) ou
 * illisible qui n'est pas soutenue est une règle à confirmer, jamais une
 * phrase qu'on publierait sans l'avoir vérifiée.
 */
function natureDepuis(valeur: unknown): NatureDeLaPhrase {
  return typeof valeur === 'string' && valeur.trim().toLowerCase() === 'autre' ? 'autre' : 'regle';
}

/**
 * LES PHRASES DE RÈGLE À CONFIRMER (décision du propriétaire du 04/11,
 * « Confirmer phrase par phrase » ; avenant du tour 7, des deux côtés). Une
 * phrase qui énonce une règle de droit (nature « regle ») et que le contrôle
 * juge « non soutenue » (les « À vérifier » rabattus faute de passage réel
 * compris) ou « hors des sources » se RÉÉCRIT (un nouveau contrôle la juge),
 * ou se CONFIRME une à une, par une personne, avant toute publication.
 *
 * POURQUOI (essai réel du tour 6). Les dix phrases du bail qui disaient
 * l'expulsion possible sans juge étaient toutes « À vérifier », avec le même
 * badge gris que les fausses alertes : rien ne les bloquait, et sept cases
 * cochées suffisaient à publier « peut être expulsé sans décision de
 * justice ». Une phrase « contredite » ne se confirme pas : elle bloque
 * jusqu'à sa correction (« phrases_contredites »).
 */
export function aConfirmer(phrase: Pick<PhraseControlee, 'nature' | 'verdict'>): boolean {
  return phrase.nature === 'regle' && (phrase.verdict === 'non_soutenue' || phrase.verdict === 'hors_sources');
}

/** Les phrases de règle à confirmer d'un contrôle, dans l'ordre de l'article. */
export function phrasesAConfirmer(controle: ControleIA | null): PhraseControlee[] {
  return (controle?.phrases ?? []).filter(aConfirmer);
}

/**
 * Parmi `ids`, ceux qui confirment une phrase de règle à confirmer de ce
 * contrôle, dans l'ordre de l'article, chacun une fois : un identifiant
 * inconnu du contrôle, ou celui d'une phrase qui n'est plus à confirmer
 * (jugée soutenue par un nouveau contrôle), ne confirme rien.
 */
export function confirmationsValables(ids: readonly string[], controle: ControleIA | null): string[] {
  const vus = new Set(ids);
  return phrasesAConfirmer(controle)
    .map((p) => p.id)
    .filter((id) => vus.has(id));
}

/**
 * Les numéros d'extraits d'un verdict, sans doublon, DANS L'ORDRE DU SERVEUR :
 * l'API du tour 4 met en tête ceux où elle a retrouvé, mot pour mot, le
 * passage que le modèle dit avoir lu (cité à la fin de la raison, « — Extrait
 * 5 : « … » »). Triés, « Soutenue par les extraits 2 et 5 » ne disait plus
 * lequel porte l'appui.
 */
function numerosDExtraits(valeur: unknown): number[] {
  if (!Array.isArray(valeur)) return [];
  const numeros = valeur.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(numeros)];
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
      nature: natureDepuis(p.nature),
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
  return { titre: false, contexte: false, resume: false, points_cles: false, impact: false, explications: false, question: false };
}

/**
 * La relecture enregistrée (`relecture`). Seul `true` coche une case : une
 * valeur absente ou d'une autre forme n'est jamais une relecture faite.
 */
export function relectureDepuis(brut: unknown): Relecture {
  const relecture: Relecture = { parties: relectureVide(), par: null, le: null, controle: null, phrasesConfirmees: [] };
  if (!estObjet(brut)) return relecture;
  const parties = estObjet(brut.parties) ? brut.parties : {};
  for (const partie of PARTIES_DE_RELECTURE) relecture.parties[partie] = parties[partie] === true;
  // `points_cles` est le nom du contrat ; la forme camelCase est lue aussi.
  if (parties.pointsCles === true) relecture.parties.points_cles = true;
  relecture.par = chaine(brut.par).trim() || null;
  relecture.le = chaine(brut.le).trim() || null;
  relecture.controle = chaine(brut.controle).trim() || null;
  // Seuls des identifiants texte confirment une phrase : un nombre, un objet
  // ou une liste mal formée ne confirment rien.
  const confirmees = brut.phrases_confirmees ?? brut.phrasesConfirmees;
  relecture.phrasesConfirmees = Array.isArray(confirmees)
    ? [...new Set(confirmees.filter((id): id is string => typeof id === 'string').map((id) => id.trim()).filter(Boolean))]
    : [];
  return relecture;
}

/**
 * Le contrôle affiché, désigné comme le contrat le demande pour une case
 * cochée (avenant du tour 5) : son `fait_le`, ou `null` sans contrôle lisible.
 */
export function identiteDuControle(controle: ControleIA | null): string | null {
  return controle?.faitLe.trim() || null;
}

/* -------------------------------------------------------------------------- */
/* La raison d'un verdict, lisible                                             */
/* -------------------------------------------------------------------------- */

/** Un passage d'un extrait que le serveur a retrouvé à l'appui d'un verdict. */
export interface PassageCite {
  /** Le numéro de l'extrait (celui des sources). */
  n: number;
  texte: string;
  /** Coupé par le serveur (raison de 600 caractères au plus) : sans « » » final. */
  ouvert?: boolean;
}

export interface RaisonLue {
  /** La raison du modèle, sans les passages cités. */
  texte: string;
  /** Les passages retrouvés dans les extraits, dans l'ordre du serveur. */
  passages: PassageCite[];
}

/** « À vérifier : » en tête : le badge du verdict le dit déjà (revue du tour 4 : deux fois à l'écran). */
const A_VERIFIER_EN_TETE = /^À\s+vérifier\s*:\s*/u;
/** Le début des passages cités, en fin de raison : « — Extrait 5 : « », ou la raison entière. */
const DEBUT_DES_PASSAGES = /(?:^|\s[—–]\s)(?=[Ee]xtrait\s+\d+\s*:\s*«)/gu;
const UN_EXTRAIT = /^;?\s*[Ee]xtrait\s+(\d+)\s*:\s*/u;

/**
 * Les passages cités en fin de raison : « Extrait 5 : « … » « … » ; extrait
 * 10 : « … » ». `null` si la fin de la raison n'a pas exactement cette forme :
 * elle s'affiche alors telle quelle, sans rien attribuer à un extrait.
 * Un texte de loi porte parfois ses propres guillemets (« le terme « bail »
 * désigne… ») : un passage se ferme au » qui équilibre son «. Coupé par le
 * serveur (600 caractères au plus), le dernier passage reste ouvert : il va
 * jusqu'à la fin.
 */
function passagesCites(fin: string): PassageCite[] | null {
  const passages: PassageCite[] = [];
  let reste = fin.trim();
  let n: number | null = null;
  while (reste) {
    const extrait = UN_EXTRAIT.exec(reste);
    if (extrait) {
      n = Number(extrait[1]);
      reste = reste.slice(extrait[0].length);
      continue;
    }
    if (n === null || !reste.startsWith('«')) return null;
    let profondeur = 0;
    let i = 0;
    for (; i < reste.length; i++) {
      if (reste[i] === '«') profondeur++;
      else if (reste[i] === '»' && --profondeur === 0) break;
    }
    const texte = reste.slice(1, i).trim();
    if (texte) passages.push(i < reste.length ? { n, texte } : { n, texte, ouvert: true });
    reste = reste.slice(i + 1).trimStart();
  }
  return passages.length > 0 ? passages : null;
}

/** Les mots d'un texte, pour comparer : sans casse, accents ni ponctuation. */
function motsComparables(texte: string): string[] {
  return texte
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** « […] », « [...] », « … », « ... » : le serveur saute une partie de l'extrait. */
const COUPURE = /\[\s*(?:…|\.{2,})\s*\]|…|\.{3,}/u;

/*
 * UNE COUPURE NE CACHE PAS CE QUI DÉCIDE (revue de l'API du tour 5). Tenu mot
 * à mot, un passage ne l'était pas pour le sens : autour de « […] », des mots
 * VRAIS de l'extrait, recollés, disaient la règle inverse, et la fenêtre les
 * montrait en citation vérifiée : « l’acquéreur […] peut expulser le fermier
 * ou le locataire » (Code civil, art. 1743 : « ne peut expulser »), « Dans
 * tous cas de licenciement, il appartient […] au travailleur » (Code du
 * travail, art. 39 : « à l’employeur », et « au travailleur » pris à
 * l’alinéa 4). L'API ne cite plus que des morceaux d'une même phrase, dans
 * l'ordre de l'extrait, autour d'un trou qui ne cache ni négation ni
 * exception ; la fenêtre le vérifie avec les mêmes règles
 * (controle_du_billet.py : `_fins_de_phrase`, `_decide`), et sinon montre la
 * raison comme du texte.
 */

/** Ce qui sépare deux phrases : un retour à la ligne, « ; », « ! », « ? ». */
const SEPARATEUR_DE_PHRASES = /[\n;!?]/gu;
/** Un alinéa « (2) » devant une majuscule (« trois (3) mois » n'en est pas un). */
const ALINEA = /\(\s*\d{1,3}\s*\)(?=\s*[A-ZÀ-ÖØ-Þ])/gu;
/** Un point (ou « … ») qui finit une phrase : devant une majuscule, un chiffre ou un guillemet ouvrant. */
const FIN_DE_PHRASE = /[.!?…]+(?:[ ]*["»”’)\]])*(?=\s+[«"“([]?[A-ZÀ-ÖØ-Þ0-9])/gu;
/** Le mot qui précède ce point, s'il en finit un. */
const DERNIER_MOT = /(\p{L}+)[^\p{L}\p{N}_]*$/u;
/** Le point de ces mots ne finit pas une phrase (« art. 39 », « al. 3 ») ; celui d'une lettre seule non plus (« M. »). */
const ABREVIATIONS = new Set([
  'art', 'arts', 'al', 'alin', 'no', 'nos', 'cf', 'ex', 'pp', 'mm', 'mme', 'mmes', 'mlle', 'dr', 'me', 'st', 'ste', 'chap',
  'sect', 'vol', 'ss', 'op', 'cit', 'ord', 'jr', 'cass', 'civ', 'soc', 'crim', 'bull', 'ref', 'réf', 'spéc', 'spec', 'env',
  'max', 'min', 'doc', 'ann', 'anc', 'nouv',
]);
/** Les mots qu'une coupure ne cache jamais ; et « n’ » élidé, « à moins », le « que » d'un « ne … que » (`decide`). */
const MOTS_QU_UNE_COUPURE_NE_CACHE_PAS = new Set([
  'ne', 'pas', 'sans', 'sauf', 'ni', 'non', 'aucun', 'aucune', 'aucuns', 'aucunes', 'jamais', 'hormis', 'excepte', 'exceptee',
  'exceptes', 'exceptees',
]);

/** Les places, dans le texte, de ce qui sépare deux phrases ; triées. */
function finsDePhrase(texte: string): number[] {
  const fins = [...texte.matchAll(SEPARATEUR_DE_PHRASES), ...texte.matchAll(ALINEA)].map((m) => m.index ?? 0);
  for (const fin of texte.matchAll(FIN_DE_PHRASE)) {
    const debut = fin.index ?? 0;
    const mot = DERNIER_MOT.exec(texte.slice(Math.max(0, debut - 40), debut));
    if (mot && (mot[1].length === 1 || ABREVIATIONS.has(mot[1].toLowerCase()))) continue;
    fins.push(debut);
  }
  return fins.sort((a, b) => a - b);
}

/** Un extrait prêt à chercher : ses mots comparables, la phrase de chacun, et s'il est élidé (« n’ », « qu’ »). */
interface ExtraitLu {
  mots: string[];
  phrases: number[];
  elides: boolean[];
}

function lireLExtrait(texte: string): ExtraitLu {
  const fins = finsDePhrase(texte);
  const lu: ExtraitLu = { mots: [], phrases: [], elides: [] };
  let phrase = 0;
  for (const suite of texte.matchAll(/[\p{L}\p{N}]+/gu)) {
    const debut = suite.index ?? 0;
    while (phrase < fins.length && fins[phrase] <= debut) phrase++;
    const apostrophe = /['’ʼ]/u.test(texte.charAt(debut + suite[0].length));
    const mots = motsComparables(suite[0]);
    mots.forEach((mot, i) => {
      lu.mots.push(mot);
      lu.phrases.push(phrase);
      lu.elides.push(apostrophe && i === mots.length - 1);
    });
  }
  return lu;
}

/** Le mot `k` retourne-t-il la règle qu'on lirait sans lui ? */
function decide(lu: ExtraitLu, k: number): boolean {
  const mot = lu.mots[k];
  if (MOTS_QU_UNE_COUPURE_NE_CACHE_PAS.has(mot) || (mot === 'n' && lu.elides[k])) return true;
  if (mot === 'moins') return k > 0 && lu.mots[k - 1] === 'a' && lu.phrases[k - 1] === lu.phrases[k];
  if (mot === 'que' || (mot === 'qu' && lu.elides[k])) {
    for (let j = k - 1; j >= 0 && lu.phrases[j] === lu.phrases[k]; j--) {
      if (lu.mots[j] === 'ne' || (lu.mots[j] === 'n' && lu.elides[j])) return true;
    }
  }
  return false;
}

/** Vrai si `morceau` commence au mot `a` ; son dernier mot peut être coupé en son milieu (`coupe`). */
function commenceA(mots: readonly string[], morceau: readonly string[], a: number, coupe: boolean): boolean {
  return morceau.every(
    (mot, k) => a + k < mots.length && (coupe && k === morceau.length - 1 ? mots[a + k].startsWith(mot) : mots[a + k] === mot),
  );
}

/**
 * Vrai si le passage est fait des mots de l'extrait : un morceau seul, d'un
 * seul tenant ; plusieurs morceaux entre « […] », dans l'ordre de l'extrait,
 * DANS UNE MÊME PHRASE (chacun commence dans la phrase où finit le
 * précédent), et sans qu'un trou cache un mot qui décide. Le dernier mot d'un
 * passage coupé par le serveur peut l'être en son milieu.
 */
function passageDansLExtrait(passage: PassageCite, extrait: string): boolean {
  const lu = lireLExtrait(extrait);
  const morceaux = passage.texte.split(COUPURE).map(motsComparables).filter((m) => m.length > 0);
  if (morceaux.length === 0) return false;
  const placer = (i: number, depuis: number, phrase: number | null): boolean => {
    if (i === morceaux.length) return true;
    const coupe = passage.ouvert === true && i === morceaux.length - 1;
    for (let a = depuis; a + morceaux[i].length <= lu.mots.length; a++) {
      // Les phrases se suivent : passée celle du morceau précédent, plus rien.
      if (phrase !== null && lu.phrases[a] !== phrase) return false;
      if (!commenceA(lu.mots, morceaux[i], a, coupe)) continue;
      if (phrase !== null && lu.mots.slice(depuis, a).some((_, k) => decide(lu, depuis + k))) continue;
      const fin = a + morceaux[i].length - 1;
      if (placer(i + 1, fin + 1, lu.phrases[fin])) return true;
    }
    return false;
  };
  return placer(0, 0, null);
}

/**
 * La raison d'un verdict, prête à lire : le texte du modèle d'un côté, les
 * passages que le serveur a retrouvés dans les extraits de l'autre (l'API les
 * colle à la fin de la raison : « — Extrait 5 : « … » »). Montrés en
 * citation, chacun avec son extrait, ils se relisent contre le panneau des
 * sources.
 *
 * JAMAIS UN TEXTE PRÉSENTÉ COMME CELUI D'UN EXTRAIT SANS Y ÊTRE (défaut D1 de
 * la revue du tour 4 : l'API citait les mots du MODÈLE sous « Extrait N »).
 * L'API du tour 5 n'y met plus que les mots de l'extrait ; la fenêtre le
 * vérifie aussi, contre `textes` (le texte de chaque extrait, par numéro) :
 * une raison écrite par le modèle sous cette forme, sur un verdict auquel
 * l'API n'ajoute rien, ou un passage qu'on ne retrouve pas mot pour mot dans
 * son extrait, reste du texte, sans rien attribuer. Sans `textes`, aucune
 * vérification (tests de la forme seule).
 */
export function raisonLue(raison: string, textes?: ReadonlyMap<number, string>): RaisonLue {
  let texte = raison.trim().replace(A_VERIFIER_EN_TETE, '');
  texte = texte.charAt(0).toLocaleUpperCase('fr') + texte.slice(1);
  const debuts = [...texte.matchAll(DEBUT_DES_PASSAGES)];
  const debut = debuts.at(-1);
  if (debut?.index !== undefined) {
    const passages = passagesCites(texte.slice(debut.index + debut[0].length));
    const verifies =
      passages !== null &&
      (textes === undefined || passages.every((p) => textes.has(p.n) && passageDansLExtrait(p, textes.get(p.n)!)));
    if (passages && verifies) return { texte: texte.slice(0, debut.index).trim(), passages };
  }
  return { texte, passages: [] };
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
 * L'élément d'une phrase est d'abord celui de son `index` (le rang du
 * contrat, à partir de 0), s'il contient bien la phrase ; sinon le premier
 * élément dont le TEXTE la contient (`elements`, les textes des points clés
 * ou des explications) ; sinon l'index tel quel. POURQUOI : sous
 * l'explication de la citation 2 s'affiche l'extrait de la citation 2.
 * - Le texte seul (tour 3) rangeait une phrase répétée dans deux points clés,
 *   ou une explication courte contenue dans une autre, sous le PREMIER
 *   élément qui la contient : relue contre l'extrait d'une autre citation
 *   (revue du tour 3).
 * - L'index seul, s'il était décalé (compté à partir de 1, ou un point vide
 *   compté par le serveur), rangerait tout sous le voisin : le texte le
 *   vérifie.
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
    const parLIndex = morceau && textes[phrase.index]?.includes(morceau) ? phrase.index : -1;
    const parLeTexte = morceau ? textes.findIndex((t) => t.includes(morceau)) : -1;
    const rang = parLIndex >= 0 ? parLIndex : parLeTexte >= 0 ? parLeTexte : phrase.index;
    groupes.set(rang, [...(groupes.get(rang) ?? []), phrase]);
  }
  return [...groupes.entries()].sort(([a], [b]) => a - b).map(([rang, liste]) => ({ rang, phrases: liste }));
}
