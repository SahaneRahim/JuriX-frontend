/**
 * Citations d'une réponse du chat (P3) : les repérer dans le texte, retrouver
 * la phrase qui les porte, et le passage de l'article qui lui répond.
 *
 * Fonctions pures, sans store ni traduction : testées une à une
 * (citations.test.ts). S'y ajoutent, pour l'aperçu, l'article seul dans le
 * passage que l'API rend pour lui, et le bruit de numérisation.
 *
 * LE PROBLÈME DES POSITIONS. Le serveur donne chaque citation par ses bornes
 * (`debut`, `fin`, en unités UTF-16) dans le texte BRUT de la réponse,
 * markdown compris (contrat-api.md §7.4). Or `blocsDeReponse` ($lib/texte)
 * transforme ce texte : il recolle les lignes, retire l'emphase, les puces,
 * les barres des tableaux. Les bornes ne correspondent plus à rien une fois
 * les blocs faits.
 *
 * D'où des MARQUES posées dans le texte brut AVANT le découpage en blocs : un
 * caractère d'ouverture suivi de l'indice de la citation, puis un caractère de
 * fermeture. Ce sont des caractères de la zone d'usage privé d'Unicode, que ni
 * le modèle ni un texte de loi n'écrivent : `blocsDeReponse` les traite comme
 * des lettres quelconques (ni espace, ni ponctuation, ni marque d'emphase) et
 * les laisse à leur place. L'affichage découpe ensuite le texte de chaque bloc
 * sur ces marques (`segmentsDuTexte`). Réécrire le lecteur de markdown pour
 * qu'il garde les positions aurait dupliqué 300 lignes testées.
 *
 * Seule différence possible avec le texte sans marques : un souligné collé à
 * une citation (`loi n° 92/007_x_`) peut devenir une emphase. Le contrat
 * garantit qu'un passage cité ne contient ni `*` ni `_` ; ce collage n'existe
 * pas dans les 323 réponses réelles relues par l'API.
 */

import { normaliserNumeroArticle } from '$lib/article';
import { FERME_GRAS, OUVRE_GRAS } from '$lib/texte';
import type { CitationIntrouvable, CitationPositionnee, CitationsDeLaReponse } from '$lib/types';

/* -------------------------------------------------------------------------- */
/* Marques                                                                     */
/* -------------------------------------------------------------------------- */

/** Ouvre une citation retrouvée ; suivi du caractère qui porte son indice. */
const OUVRE_CITATION = '\uE000';
/** Ouvre une citation introuvable ; suivi du caractère qui porte son indice. */
const OUVRE_INTROUVABLE = '\uE001';
/** Ferme la citation ouverte. */
const FERME = '\uE002';
/** L'indice `i` s'écrit `String.fromCharCode(BASE_DES_INDICES + i)`. */
const BASE_DES_INDICES = 0xe100;
/** Dernier caractère de la zone d'usage privé du plan de base. */
const FIN_DE_LA_ZONE = 0xf8ff;
const INDICE_MAX = FIN_DE_LA_ZONE - BASE_DES_INDICES;

/** Un caractère de la zone d'usage privé : le texte d'origine ne doit pas en contenir. */
const ZONE_PRIVEE = /[\uE000-\uF8FF]/;
const ZONE_PRIVEE_PARTOUT = /[\uE000-\uF8FF]/g;

/** Un texte de réponse avec ses citations repérées, prêtes à afficher. */
export interface TexteMarque {
  /** Le texte brut, marques comprises : à passer à `blocsDeReponse`. */
  texte: string;
  /** Les citations retrouvées, dans l'ordre de leurs indices de marque. */
  citations: CitationPositionnee[];
  /** Les citations introuvables, dans l'ordre de leurs indices de marque. */
  introuvables: CitationIntrouvable[];
}

interface Repere {
  debut: number;
  fin: number;
  genre: 'citation' | 'introuvable';
  index: number;
}

function bornesValides(texte: string, c: { debut: unknown; fin: unknown; texte_cite: unknown }): boolean {
  return (
    Number.isInteger(c.debut) &&
    Number.isInteger(c.fin) &&
    (c.debut as number) >= 0 &&
    (c.fin as number) > (c.debut as number) &&
    (c.fin as number) <= texte.length &&
    typeof c.texte_cite === 'string' &&
    // La garantie du contrat, vérifiée plutôt que crue : un texte affiché qui
    // diffère d'un caractère de celui du serveur (réponse vide remplacée,
    // flux tronqué) déplacerait tous les liens.
    texte.slice(c.debut as number, c.fin as number) === c.texte_cite
  );
}

/**
 * Pose les marques des citations dans le texte brut d'une réponse.
 *
 * `null` quand il n'y a rien à marquer : ancienne API (listes absentes),
 * aucune citation, aucune dont les bornes tombent juste, ou texte qui contient
 * déjà un caractère de la zone privée (les marques y seraient ambiguës).
 * L'appelant affiche alors la réponse comme avant, sans liens ni alertes.
 *
 * Les citations qui se chevauchent : la première garde sa place, l'autre est
 * ignorée. Retrouvées et introuvables sont classées ensemble, par position.
 */
export function marquerLesCitations(
  texte: string,
  listes: CitationsDeLaReponse | null | undefined,
): TexteMarque | null {
  if (!texte || !listes || ZONE_PRIVEE.test(texte)) return null;
  const citations = (Array.isArray(listes.citations) ? listes.citations : []).filter((c) =>
    bornesValides(texte, c),
  );
  const introuvables = (
    Array.isArray(listes.citations_introuvables) ? listes.citations_introuvables : []
  ).filter((c) => bornesValides(texte, c));

  const reperes: Repere[] = [
    ...citations.map((c, index): Repere => ({ debut: c.debut, fin: c.fin, genre: 'citation', index })),
    ...introuvables.map((c, index): Repere => ({ debut: c.debut, fin: c.fin, genre: 'introuvable', index })),
  ].sort((a, b) => a.debut - b.debut || b.fin - a.fin);

  const gardes: Repere[] = [];
  for (const r of reperes) {
    const precedent = gardes[gardes.length - 1];
    if (precedent && r.debut < precedent.fin) continue;
    if (r.index > INDICE_MAX) continue;
    gardes.push(r);
  }
  if (!gardes.length) return null;

  let marque = '';
  let curseur = 0;
  for (const r of gardes) {
    marque +=
      texte.slice(curseur, r.debut) +
      (r.genre === 'citation' ? OUVRE_CITATION : OUVRE_INTROUVABLE) +
      String.fromCharCode(BASE_DES_INDICES + r.index) +
      texte.slice(r.debut, r.fin) +
      FERME;
    curseur = r.fin;
  }
  marque += texte.slice(curseur);
  return { texte: marque, citations, introuvables };
}

/**
 * Un morceau du texte d'un bloc : du texte simple, ou une citation. `gras` :
 * le morceau est dans un gras de la réponse (« **Réponse directe** »,
 * $lib/texte, `blocsDeReponse` en mode `gras`) ; absent ailleurs.
 */
export type Segment =
  | { genre: 'texte'; texte: string; gras?: boolean }
  | { genre: 'citation'; texte: string; index: number; gras?: boolean }
  | { genre: 'introuvable'; texte: string; index: number; gras?: boolean };

/**
 * Découpe le texte d'un bloc (ou d'une cellule) sur les marques posées par
 * `marquerLesCitations`, et sur celles du gras ($lib/texte, `OUVRE_GRAS`,
 * `FERME_GRAS`) : une citation peut se trouver DANS un gras (contrat §7.4),
 * jamais à cheval sur lui.
 *
 * Une citation qu'une ligne vide coupe en deux blocs perd sa marque de
 * fermeture dans le premier et son ouverture dans le second : elle court
 * jusqu'à la fin du premier, et le début du second reste du texte simple.
 * Toute autre marque égarée est retirée, jamais affichée.
 */
export function segmentsDuTexte(texte: string): Segment[] {
  if (!ZONE_PRIVEE.test(texte)) return texte ? [{ genre: 'texte', texte }] : [];

  const segments: Segment[] = [];
  let gras = false;
  let courant: Segment = { genre: 'texte', texte: '' };
  // Le gras est celui du moment où le morceau s'écrit : on pousse AVANT de
  // le changer.
  const pousser = () => {
    if (courant.texte) segments.push(gras ? { ...courant, gras: true } : courant);
  };

  for (let i = 0; i < texte.length; i += 1) {
    const c = texte[i];
    if ((c === OUVRE_CITATION || c === OUVRE_INTROUVABLE) && i + 1 < texte.length) {
      const code = texte.charCodeAt(i + 1) - BASE_DES_INDICES;
      if (code >= 0 && code <= INDICE_MAX) {
        pousser();
        courant = { genre: c === OUVRE_CITATION ? 'citation' : 'introuvable', texte: '', index: code };
        i += 1;
        continue;
      }
    }
    if (c === FERME) {
      pousser();
      courant = { genre: 'texte', texte: '' };
      continue;
    }
    if (c === OUVRE_GRAS || c === FERME_GRAS) {
      // Le morceau en cours continue (citation comprise), de l'autre graisse.
      pousser();
      gras = c === OUVRE_GRAS;
      courant = { ...courant, texte: '' };
      continue;
    }
    if (ZONE_PRIVEE.test(c)) continue;
    courant.texte += c;
  }
  pousser();
  return segments;
}

/** Le texte sans aucune marque : blocs de code, noms de tableau. */
export function sansMarques(texte: string): string {
  return texte.replace(ZONE_PRIVEE_PARTOUT, '');
}

/**
 * Le mot élidé qui finit un texte (« selon l’ », « de l’ », « d’ », « qu’ »),
 * capturé avec le caractère d'avant : pas d'assertion arrière (voir $lib/texte,
 * Safari avant la 16.4).
 */
const ELISION_FINALE = /(^|[^\p{L}\p{N}])((?:l|d|qu|jusqu|lorsqu|puisqu|quoiqu)['’])$/iu;

/**
 * Rattache à chaque citation, retrouvée ou introuvable, le mot élidé qui la
 * précède : « l’ » passe du texte simple au début du lien, ou du soulignement
 * en tirets.
 *
 * POURQUOI. Le serveur borne la citation au mot « article » (contrat §7.4), et
 * le prompt impose la forme « l’article X du Code Y » (prompts.py, _FORME_FR) :
 * presque chaque citation suit une élision. L'icône § posée devant le lien se
 * glissait donc entre l’élision et le nom, et l'on lisait « selon l’ § article
 * 35 ». Le lien commence maintenant au mot élidé, et l'icône le précède,
 * comme dans la maquette chat-p3a (« ( § Code du travail, art. 37) ») : « selon
 * § l’article 35 de la loi n° 92/007 ». Le nom accessible du lien se lit
 * d'une traite, et le surlignage de l'aperçu ouvert couvre le groupe entier.
 *
 * Les introuvables de même : leurs tirets laissaient « l’ » dehors quand le
 * lien d'à côté l'englobait, deux rendus pour une même forme dans une même
 * phrase (revue du chat, 29/10). La maquette chat-p3a souligne le groupe
 * entier, « l’arrêté n° 016/MTPS/SG/CJ du 26 mai 1993 », et le lecteur
 * d'écran entend « l’article 312 du Code pénal (citation non retrouvée) ».
 */
export function rattacherLesElisions(segments: Segment[]): Segment[] {
  const resultat: Segment[] = [];
  for (const segment of segments) {
    const precedent = resultat[resultat.length - 1];
    const elision = segment.genre !== 'texte' && precedent?.genre === 'texte' ? ELISION_FINALE.exec(precedent.texte) : null;
    if (elision && precedent) {
      const reste = precedent.texte.slice(0, precedent.texte.length - elision[2].length);
      // Le texte d'avant garde sa graisse (« **selon** l’article… »).
      if (reste) resultat[resultat.length - 1] = { ...precedent, texte: reste };
      else resultat.pop();
      resultat.push({ ...segment, texte: elision[2] + segment.texte });
      continue;
    }
    resultat.push(segment);
  }
  return resultat;
}

/* -------------------------------------------------------------------------- */
/* La phrase qui porte une citation                                            */
/* -------------------------------------------------------------------------- */

/**
 * Abréviations dont le point ne finit pas une phrase : « art. 37 », « al. 2 »,
 * « cf. ». Sans elles, « (Code du travail, art. 37) » coupait la phrase en
 * deux au milieu de la citation.
 */
const ABREVIATIONS = /(?:^|[\s(])(?:art|arts|al|cf|ex|p|pp|ss|chap|n|no|vol|sect|ord|déc|dec|réf|ref)\.$/i;

/** Longueur maximale gardée de chaque côté : une phrase de 2 000 caractères n'apprend rien de plus. */
const PORTEE_DE_LA_PHRASE = 600;

function finDePhrase(texte: string, i: number): boolean {
  const c = texte[i];
  if (c === '\n') return true;
  if (!/[.!?…]/.test(c)) return false;
  const suivant = texte[i + 1];
  if (suivant !== undefined && !/\s/.test(suivant)) return false;
  return !(c === '.' && ABREVIATIONS.test(texte.slice(Math.max(0, i - 8), i + 1)));
}

/**
 * La phrase de la réponse qui porte la citation `[debut, fin)`, SANS la
 * citation elle-même : ses mots (« Code du travail », « 1992 ») ne doivent
 * pas compter quand on cherche le passage de l'article qui lui répond.
 */
export function phraseAutour(texte: string, debut: number, fin: number): string {
  if (!(debut >= 0 && fin > debut && fin <= texte.length)) return '';
  let gauche = debut;
  while (gauche > 0 && debut - gauche < PORTEE_DE_LA_PHRASE && !finDePhrase(texte, gauche - 1)) gauche -= 1;
  let droite = fin;
  while (droite < texte.length && droite - fin < PORTEE_DE_LA_PHRASE && !finDePhrase(texte, droite)) droite += 1;
  return `${texte.slice(gauche, debut)} ${texte.slice(fin, droite)}`.replace(/\s+/g, ' ').trim();
}

/* -------------------------------------------------------------------------- */
/* Le passage de l'article qui répond à la phrase                              */
/* -------------------------------------------------------------------------- */

/**
 * Mots qui ne disent rien du sujet, sans accents et en minuscules (le français
 * et l'anglais des textes). Les mots du vocabulaire des renvois (« article »,
 * « loi », « décret ») en font partie : présents dans presque tout article et
 * dans la citation, ils feraient se ressembler n'importe quoi.
 */
const MOTS_VIDES = new Set(
  (
    'les des une aux par pour sur dans qui que quoi dont est sont cet cette ces son ses leur leurs ' +
    'elle ils elles pas plus avec sans sous entre vous votre vos nous notre nos mais donc car ainsi ' +
    'tout tous toute toutes peut peuvent doit doivent etre avoir avez avons ont fait faire cas lorsque ' +
    'lors quand comme meme selon apres avant aussi celle celui ceux celles autre autres lui ici tres ' +
    'bien alors non oui deja encore notamment article articles loi lois decret decrets code codes ' +
    'arrete ordonnance texte textes alinea alineas present presente presentes disposition dispositions ' +
    'the and for with that this which shall may any are was were has have had not from under such its ' +
    'his her their been being into upon where when than other section act law laws'
  ).split(' '),
);

/** Radicaux des mots porteurs de sens : sans accents, minuscules, 5 premières lettres. */
function radicaux(texte: string): string[] {
  return texte
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot.length >= 3 && !MOTS_VIDES.has(mot))
    .map((mot) => mot.slice(0, 5));
}

/** Un passage d'un texte, fin exclue. */
export interface Passage {
  debut: number;
  fin: number;
}

/**
 * Le passage de l'article qui correspond le mieux à la phrase (ou aux
 * phrases) de la réponse qui le citent, à mettre en gras dans l'aperçu (P3).
 *
 * Le contrat laisse ce choix au front (§4, « Mise en gras du passage cité ») :
 * le serveur ne dit pas quel passage la réponse reprend. L'article est coupé
 * en propositions (virgules, points-virgules, deux-points, points, retours à
 * la ligne), et chacune est notée par les mots de sens qu'elle partage avec la
 * phrase. Le passage retenu est la suite de propositions voisines qui en
 * partagent assez (au moins deux mots, et 30 % des siens), autour de la mieux
 * notée.
 *
 * Prudent par construction, car un gras mal placé ferait dire à l'article ce
 * que la réponse avance : `null` si la phrase a trop peu de mots, si le
 * passage en reprend moins de trois ou moins du quart, ou s'il couvre presque
 * tout l'article (il ne désignerait plus rien).
 */
export function passageLePlusProche(contenu: string, phrases: readonly string[]): Passage | null {
  const cherches = new Set(phrases.flatMap(radicaux));
  if (cherches.size < 3 || !contenu) return null;

  const propositions: { debut: number; fin: number; radicaux: Set<string> }[] = [];
  let debut = 0;
  for (let i = 0; i <= contenu.length; i += 1) {
    const c = contenu[i];
    if (i === contenu.length || c === '\n' || /[,;:.!?]/.test(c)) {
      const fin = i === contenu.length || c === '\n' ? i : i + 1;
      if (fin > debut) propositions.push({ debut, fin, radicaux: new Set(radicaux(contenu.slice(debut, fin))) });
      debut = i + 1;
    }
  }

  const communs = propositions.map((p) => [...p.radicaux].filter((r) => cherches.has(r)).length);
  const pertinente = propositions.map(
    (p, i) => communs[i] >= 2 && communs[i] / Math.max(1, p.radicaux.size) >= 0.3,
  );

  let meilleure = -1;
  for (let i = 0; i < propositions.length; i += 1) {
    if (pertinente[i] && (meilleure === -1 || communs[i] > communs[meilleure])) meilleure = i;
  }
  if (meilleure === -1) return null;

  let premiere = meilleure;
  while (premiere > 0 && pertinente[premiere - 1]) premiere -= 1;
  let derniere = meilleure;
  while (derniere < propositions.length - 1 && pertinente[derniere + 1]) derniere += 1;

  const repris = new Set<string>();
  for (let i = premiere; i <= derniere; i += 1) {
    for (const r of propositions[i].radicaux) if (cherches.has(r)) repris.add(r);
  }
  if (repris.size < 3 || repris.size < cherches.size * 0.25) return null;

  // Sans les blancs du début, ni le numéro d'alinéa (« (2) », « a) », « - »),
  // ni la ponctuation de la fin : le gras commence et finit sur des mots.
  let a = propositions[premiere].debut;
  let b = propositions[derniere].fin;
  while (a < b && /\s/.test(contenu[a])) a += 1;
  const numero = /^(?:\(\d+\)|\d+[.)]|[a-z]\)|[-–•])\s+/i.exec(contenu.slice(a, b));
  if (numero) a += numero[0].length;
  while (b > a && /[\s,;:.]/.test(contenu[b - 1])) b -= 1;
  const utile = contenu.replace(/\s+/g, '').length;
  if (b <= a || contenu.slice(a, b).replace(/\s+/g, '').length > utile * 0.85) return null;
  return { debut: a, fin: b };
}

/** Un paragraphe de l'article, découpé autour du passage en gras. */
export interface ParagrapheDeLArticle {
  avant: string;
  gras: string;
  apres: string;
}

/** Un numéro d'alinéa entre parenthèses, suivi d'un blanc : « (2) En vue de… ». */
const NUMERO_D_ALINEA = /\((\d{1,2})\)(?=\s)/g;

/** Ce qui finit une phrase, juste avant un alinéa collé au précédent. */
const FIN_DE_PHRASE_AVANT_L_ALINEA = /[.;:!?…»”"]\s*$/;

/**
 * Où commencent, DANS une ligne, les alinéas que la base a collés au
 * précédent : « … qui leur incombent. (2) En vue de … (3) La partie … ».
 *
 * POURQUOI. Les morceaux de la base gardent souvent l'article sur une seule
 * ligne : l'aperçu en faisait un bloc de treize lignes sur un téléphone
 * (capture chat-apercu r2), là où la maquette chat-p3a-apercu et la page du
 * texte posent chaque alinéa dans son paragraphe.
 *
 * Prudent : un « (n) » ne coupe que s'il suit une fin de phrase (« deux (2)
 * ans » ou « l'alinéa (1) ci-dessus » restent dans leur phrase) et s'il
 * continue la numérotation, à un numéro manquant près (l'OCR en perd) :
 * « (2) » après « (1) », pas un « (1) » ni un « (7) » cités plus loin.
 */
function debutsDAlineas(ligne: string): number[] {
  const debuts: number[] = [];
  let numero = 0;
  for (const m of ligne.matchAll(NUMERO_D_ALINEA)) {
    const position = m.index ?? 0;
    const lu = Number(m[1]);
    if (!ligne.slice(0, position).trim()) {
      // Le numéro qui ouvre la ligne : la numérotation part de lui.
      numero = lu;
      continue;
    }
    if (lu > numero && lu <= numero + 2 && FIN_DE_PHRASE_AVANT_L_ALINEA.test(ligne.slice(0, position))) {
      debuts.push(position);
      numero = lu;
    }
  }
  return debuts;
}

/**
 * Les paragraphes de l'article (une ligne de `contenu` chacun, lignes vides
 * retirées, et un par alinéa numéroté quand la base les a collés sur une même
 * ligne : `debutsDAlineas`), chacun coupé en trois autour de sa part du
 * passage en gras. Un passage qui court sur deux paragraphes est en gras dans
 * les deux. Les positions du passage portent sur `contenu` : elles restent
 * justes, les paragraphes n'étant que des tranches de ses lignes.
 */
export function paragraphesDeLArticle(contenu: string, passage: Passage | null): ParagrapheDeLArticle[] {
  const paragraphes: ParagrapheDeLArticle[] = [];
  let position = 0;
  for (const ligne of contenu.split('\n')) {
    const debutDeLaLigne = position;
    position += ligne.length + 1;
    const bornes = [0, ...debutsDAlineas(ligne), ligne.length];
    for (let i = 0; i < bornes.length - 1; i += 1) {
      // Sans les blancs des deux bords : l'espace d'avant « (2) » finissait
      // le paragraphe précédent.
      let a = bornes[i];
      let b = bornes[i + 1];
      while (a < b && /\s/.test(ligne[a])) a += 1;
      while (b > a && /\s/.test(ligne[b - 1])) b -= 1;
      if (a >= b) continue;
      const morceau = ligne.slice(a, b);
      const debut = debutDeLaLigne + a;
      if (!passage || passage.fin <= debut || passage.debut >= debut + morceau.length) {
        paragraphes.push({ avant: morceau, gras: '', apres: '' });
        continue;
      }
      const x = Math.max(0, passage.debut - debut);
      const y = Math.min(morceau.length, passage.fin - debut);
      paragraphes.push({ avant: morceau.slice(0, x), gras: morceau.slice(x, y), apres: morceau.slice(y) });
    }
  }
  return paragraphes;
}

/* -------------------------------------------------------------------------- */
/* L'article dans le passage enregistré                                        */
/* -------------------------------------------------------------------------- */

/**
 * L'en-tête d'un article DANS le texte d'un passage, quel que soit son numéro :
 * « Article 36.- », « ARTICLE 142 (nouveau).- », « Art..5- (1) »,
 * « ARTICLE 6. (2) (nouveau) : », « Article premier.- ». La forme que le
 * serveur reconnaît pour un numéro donné (lecture_des_citations,
 * `_entete_d_article`) : un séparateur après le numéro, et ni lettre ni
 * apostrophe juste avant, pour que « prévus à l’article 36 ci-dessus » ou
 * « l’article 34 alinéa (1) » ne passent pas pour un en-tête.
 *
 * Groupes : 1, le caractère d'avant (pas d'assertion arrière, voir $lib/texte) ;
 * 2, « Article N » ; 3, le numéro ; 4, « bis », « ter »… ; 5, « (nouveau) ».
 *
 * Resserrée sur les 43 383 morceaux de la base locale (29/10/2026) : un blanc
 * après le séparateur, quatre chiffres au plus, et pas de « Paragraphe » à la
 * suite. Sans cela, la nomenclature d'un budget (« Chapitre 02-Article
 * 101-Paragraphe 100 », « Article 390000 – Paragraphe 6220 ») et un numéro à
 * trait d'union (« Article 74-1 », Code CIMA) passaient pour des en-têtes.
 */
const EN_TETE_D_ARTICLE =
  /(^|[^\p{L}\p{N}_'’])(art(?:icle)?\.{0,2}\s*(\d{1,4}|premi(?:er|ère))(?:\s*(?:er|ère|re))?(?:\s*(bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies))?)(?![\p{L}\p{N}]|\.\d)(?:\.?\s*\(\d+\))?\s*(\((?:nouveau|nouvelle|new)\)\s*)?(?:\.\s*[-–—]|[-–—:])(?=\s|$)(?!\s*paragraphe)/giu;

/**
 * Ce qui précède un vrai en-tête : la fin d'une phrase (« … de demander.
 * Article 36.- »), un guillemet ou une parenthèse fermants, l'emphase du
 * markdown, ou l'intitulé en capitales d'une division (« DE LA SURVEILLANCE
 * JUDICIAIRE Article 246 — »). Une minuscule ou un chiffre juste avant, c'est
 * une phrase qui continue : « … n°2012/539 du 19 Article 3: Novembre 2012 »,
 * débris d'OCR, ne coupe rien.
 */
const AVANT_UN_EN_TETE = /[.;:!?»)\]”"*#\p{Lu}]$/u;

/** Un numéro d'article ramené à une clé comparable : « 1er », « premier » et « 1 » ; « 5 bis » et « 5 BIS ». */
function cleDuNumero(numero: string | null | undefined): string {
  const cle = normaliserNumeroArticle(numero).replace(/\s+/g, ' ');
  return /^PREMI(?:ER|ÈRE|ERE)$/.test(cle) ? '1' : cle;
}

/** Ce que l'aperçu montre du passage que l'API a rendu pour un article. */
export interface ArticleDuPassage {
  /** Début et fin (exclue) de l'article dans le passage. */
  debut: number;
  fin: number;
  /** Le numéro de l'article devant lequel l'aperçu s'arrête ; `null` : rien n'est coupé. */
  suivant: string | null;
  /** Le passage « englobant » a été recadré sur l'en-tête de l'article. */
  recadre: boolean;
}

/**
 * L'article seul, dans le passage que l'API rend pour lui (`contenu` de
 * l'aperçu) : du début, ou de son propre en-tête pour un passage englobant,
 * jusqu'à l'en-tête d'un AUTRE article.
 *
 * POURQUOI. Le découpage de la base a laissé des articles collés les uns aux
 * autres : le morceau rangé sous « 35 » du Code du travail (loi 2274) porte
 * aussi les articles 36 à 40, en-têtes compris (« … de demander. Article
 * 36.- (1) Toute rupture… »). L'API le rend tel quel, sans le dire
 * « englobant » (`GET /laws/2274/articles/35?article_id=97421`) : l'aperçu
 * titré « Art. 35 » montrait cinq articles d'un bloc, et mettait en gras un
 * passage de l'article 37, que le lecteur prenait pour l'article 35. Couper
 * au premier autre en-tête rend l'aperçu à ce qu'il promet : l'article cité,
 * et lui seul. La page dit où il s'arrête, et le texte intégral garde la suite.
 *
 * Prudent par construction :
 * - un en-tête marqué « (nouveau) », ou ouvert par un guillemet, appartient
 *   au texte qu'une loi modificative cite (« sont modifiés ainsi qu'il suit :
 *   « Article 5 (nouveau).- … » ») : il ne coupe rien ;
 * - « article » en minuscule est un renvoi dans une phrase, jamais un
 *   en-tête : seuls « Article », « ARTICLE » et « Art. » comptent, et
 *   seulement en début de phrase, de ligne, ou après un intitulé en
 *   capitales (`AVANT_UN_EN_TETE`) ;
 * - un passage englobant (l'article n'a pas de morceau propre) ne se recadre
 *   que sur l'en-tête de l'article lui-même ; sans lui, rien ne dit où
 *   l'article commence, et tout le passage reste, avec l'avertissement ;
 * - une coupe qui ne laisserait rien à lire n'est pas faite.
 */
export function articleDuPassage(
  contenu: string,
  numero: string | null | undefined,
  englobant = false,
): ArticleDuPassage {
  const tout: ArticleDuPassage = { debut: 0, fin: contenu.length, suivant: null, recadre: false };
  const voulu = cleDuNumero(numero);
  if (!contenu || !voulu) return tout;

  const entetes: { position: number; cle: string; numero: string }[] = [];
  for (const m of contenu.matchAll(EN_TETE_D_ARTICLE)) {
    const position = (m.index ?? 0) + m[1].length;
    if (m[2][0] !== 'A' || m[5]) continue;
    if (/[«“"]\s*$/.test(contenu.slice(Math.max(0, position - 3), position))) continue;
    const avant = contenu.slice(Math.max(0, position - 80), position).replace(/[ \t]+$/, '');
    if (avant && !avant.endsWith('\n') && !AVANT_UN_EN_TETE.test(avant)) continue;
    const affiche = m[4] ? `${m[3]} ${m[4]}` : m[3];
    entetes.push({ position, cle: cleDuNumero(affiche), numero: affiche });
  }

  let debut = 0;
  let recadre = false;
  if (englobant) {
    const propre = entetes.find((e) => e.cle === voulu);
    if (!propre) return tout;
    debut = propre.position;
    recadre = true;
  }
  const autre = entetes.find((e) => e.position > debut && e.cle !== voulu);
  if (!autre || !contenu.slice(debut, autre.position).trim()) return { ...tout, debut, recadre };
  return { debut, fin: autre.position, suivant: autre.numero, recadre };
}

/* -------------------------------------------------------------------------- */
/* Bruit de numérisation                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Quatre lettres isolées de suite, séparées par des blancs : « à lu se e e o
 * n u ne out,l nature », « Sont no s s s s s du tras », la trace que laisse un
 * passage que l'OCR n'a pas su lire (Code du travail, articles 36 et 39). Un
 * texte de loi n'en écrit pas trois : « il y a à » en a trois, « a, b, c et
 * d » est ponctué.
 */
const LETTRES_ISOLEES = /(?:^|\s)\p{Ll}(?:\s+\p{Ll}){3,}(?=$|[\s,.;:!?)])/u;

/**
 * Le texte porte-t-il un passage mal lu à la numérisation ? L'aperçu le dit
 * alors au lecteur, sans rien retirer : le texte officiel s'affiche tel que la
 * base le garde, et le lecteur sait que ces lettres ne sont pas la loi.
 */
export function bruitDeNumerisation(texte: string): boolean {
  return LETTRES_ISOLEES.test(texte);
}

/* -------------------------------------------------------------------------- */
/* Langue d'un texte officiel                                                  */
/* -------------------------------------------------------------------------- */

const MOTS_FRANCAIS = /(?:^|[\s(])(?:le|la|les|des|du|est|sont|et|en|un|une|au|aux|par|pour|qui)(?=[\s,.;:)])/gi;
const MOTS_ANGLAIS = /(?:^|[\s(])(?:the|of|and|shall|is|are|to|be|by|for|which|any)(?=[\s,.;:)])/gi;

/**
 * La langue probable d'un texte officiel, pour son attribut `lang`, ou `null`
 * si le texte ne permet pas de trancher (l'élément hérite alors de la page).
 *
 * L'aperçu ne dit pas la langue du texte, et le corpus en contient en anglais :
 * poser `lang="fr"` partout ferait lire un texte anglais avec la prononciation
 * française par les lecteurs d'écran, et l'inverse en interface anglaise.
 */
export function langueProbable(texte: string): 'fr' | 'en' | null {
  const fr = texte.match(MOTS_FRANCAIS)?.length ?? 0;
  const en = texte.match(MOTS_ANGLAIS)?.length ?? 0;
  if (fr >= 3 && fr > en * 1.5) return 'fr';
  if (en >= 3 && en > fr * 1.5) return 'en';
  return null;
}
