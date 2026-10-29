/**
 * L'objet d'un texte cité par le chat, tiré de son intitulé officiel :
 * « Décret N°94/199 du 07 octobre 1994 portant Statut Général de la Fonction
 * Publique de l'État » donne « Statut Général de la Fonction Publique de
 * l'État ».
 *
 * POURQUOI. « Articles cités » lisait « Art. 120 — Décret n° 94/199 », puis
 * « Décret n° 94/199 du 07 octobre 1994 · … » : le numéro deux fois, et l'objet
 * nulle part. La ligne d'état faisait de même (« 6 articles trouvés : Code du
 * travail, Décret n° 94/199… ») là où la maquette chat-attente-p4a nommait
 * l'objet (« Statut général de la fonction publique… »). Un code se nommait
 * déjà ainsi : « Code du travail » EST l'objet de la loi n° 92/007. Les autres
 * textes suivent maintenant la même règle, celle des listes (P11 : « l'objet
 * devient le titre »), et les repères (nature, numéro, date) passent dessous.
 *
 * D'OÙ VIENT LA DÉCOUPE. Les listes et la recherche reçoivent l'objet de l'API
 * (`objet`, contrat-api.md §1.2) ; les citations du chat, non : elles ne
 * portent que l'intitulé (`titre`, `law_title`). La découpe est donc refaite
 * ici, à l'image de `objet_du_titre` du serveur (app/utils/titre_officiel.py,
 * branche feat/ux-api), éprouvée sur les 2 287 intitulés de la base : même
 * en-tête (nature, numéro, date et rien d'autre), mêmes verbes, mêmes
 * nominalisations, même prudence. Sur ces 2 287 intitulés, chaque objet rendu
 * ici est celui du serveur, au caractère près (vérifié le 29/10/2026). Un
 * même texte porte donc le même nom dans le chat et dans les listes.
 *
 * Trois verbes ne sont pas repris : « autorisant », « habilitant » et
 * « déclarant ». Leur découpe demande des règles propres (qui est autorisé, à
 * quoi faire ; quel jour est férié), et `null` laisse au chat le nom court
 * d'avant (« Loi n° 2019/012 »), qui n'est pas faux. Comme au serveur, le
 * moindre doute rend `null` : une découpe ratée ferait dire au texte ce qu'il
 * ne fait pas, ce qui est pire qu'un nom court.
 *
 * Fonctions pures, sans assertion arrière : Safari ne les lit que depuis la
 * 16.4, et plus ancien, il refusait le module entier (voir $lib/texte).
 */

/* -------------------------------------------------------------------------- */
/* Nettoyage de l'intitulé                                                     */
/* -------------------------------------------------------------------------- */

/** Une lettre, un chiffre ou un souligné : le `\w` Unicode du serveur. */
const MOT = '[\\p{L}\\p{N}_]';

/**
 * Le trait d'union conditionnel (U+00AD), selon sa place : retiré dans un
 * mot (« disposi(U+00AD)tions »), rendu en trait d'union entre deux noms
 * (« Extrême(U+00AD)Nord », « Ngaoundéré (U+00AD) Garoua »), comme au serveur.
 */
function traitDUnionConditionnel(titre: string): string {
  return titre.replace(/\u00AD/g, (_trait: string, position: number) => {
    const avant = position > 0 ? titre[position - 1] : ' ';
    const apres = position + 1 < titre.length ? titre[position + 1] : ' ';
    if (avant === '-' || apres === '-') return '';
    if (/\s/.test(avant) || /\s/.test(apres) || /\p{Lu}/u.test(apres)) return '-';
    return '';
  });
}

/** Espaces normalisés et fautes de saisie connues du corpus réparées (« p9rtant », « 2017portant »). */
function nettoyer(titre: string): string {
  let t = traitDUnionConditionnel(titre).replace(/\u00A0/g, ' ').replace(/_/g, ' ');
  t = t.replace(/ · /g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/\bp[o9]rt\s?an\s?t\b/gi, 'portant');
  t = t.replace(/\b(portant)\s+portant\b/gi, '$1');
  // « N°202l/345 » : un 1 lu comme un l dans l'année du numéro.
  t = t.replace(/\b(\d{3})l(?=\s*\/)/g, (_m: string, annee: string) => `${annee}1`);
  // « de I'Accord », « !'Hôpital » : un l lu comme un I ou un point d'exclamation.
  t = t.replace(new RegExp(`(^|[^\\p{L}\\p{N}_'’])[Ii!]\\s?['’‘]\\s?(?=${MOT})`, 'gu'), "$1l'");
  // « Conseil d' Administration » : une espace après l'élision.
  t = t.replace(new RegExp(`(^|[^\\p{L}\\p{N}_])(qu|[dlnjsc])(['’])\\s+(?=\\p{L})`, 'giu'), '$1$2$3');
  // « Créditn°72130 » : le numéro collé au mot qui le précède.
  t = t.replace(/(\p{L})(?=n\s*[°º]\s*\d)/giu, '$1 ');
  // « 06 septembre 2017portant » : l'année collée au verbe.
  return t.replace(/(\d)(portant|fixant|modifiant|autorisant|habilitant|ratifiant|relati(?:f|ve))\b/gi, '$1 $2');
}

/** Minuscules sans accents : « Arrêté » et « ARRETE » se comparent. */
function replier(texte: string): string {
  return texte.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
}

/* -------------------------------------------------------------------------- */
/* En-tête : nature, numéro, date                                              */
/* -------------------------------------------------------------------------- */

const NATURES = new Set([
  'decret',
  'arrete',
  'loi',
  'cadre',
  'ordonnance',
  'circulaire',
  'decision',
  'acte',
  'uniforme',
  'revise',
  'traite',
  'pleins',
  'pouvoirs',
]);
const MOIS = new Set([
  'janvier',
  'janv',
  'jan',
  'fevrier',
  'fevr',
  'fev',
  'mars',
  'mar',
  'avril',
  'avr',
  'mai',
  'juin',
  'juillet',
  'juil',
  'aout',
  'septembre',
  'sept',
  'sep',
  'octobre',
  'oct',
  'novembre',
  'nov',
  'decembre',
  'dec',
]);
/** Les quatre premières lettres suffisent, comme à l'ingestion : « juilet », « SEP. ». */
const MOIS_4 = new Set(['janv', 'fevr', 'mars', 'avri', 'juin', 'juil', 'aout', 'sept', 'octo', 'nove', 'dece']);
const MOTS_DE_DATE = new Set(['du', 'of', 'en', 'date', 'le', 'er', 'n', 'no', 'numero']);
/** Sigles écrits en minuscules (« N°0591/cab/pr ») ; en capitales, tout sigle court passe. */
const SIGLES = new Set(['cab', 'pr', 'pm', 'prc', 'sg', 'pn', 'rdpc', 'df', 'lf']);
const SIGLE = /^[A-Z]{1,6}$/;

/**
 * Vrai si l'en-tête ne contient qu'une nature, un numéro et une date. Le
 * premier mot doit être une nature : un intitulé qui commence par « Accord
 * entre … » ou « Code civil … » est un nom, pas un acte suivi de son objet.
 */
function enTeteSansDoute(enTete: string): boolean {
  const jetons: string[] = enTete.match(/\p{L}+|\d+/gu) ?? [];
  const premier = jetons[0];
  if (premier === undefined || !NATURES.has(replier(premier))) return false;
  return jetons.every((jeton) => {
    if (/^\d+$/.test(jeton) || SIGLE.test(jeton)) return true;
    const replie = replier(jeton);
    const mois = MOIS.has(replie) || (replie.length <= 9 && MOIS_4.has(replie.slice(0, 4)));
    return mois || NATURES.has(replie) || MOTS_DE_DATE.has(replie) || SIGLES.has(replie);
  });
}

/* -------------------------------------------------------------------------- */
/* Objet                                                                       */
/* -------------------------------------------------------------------------- */

/** Le verbe ne se découpe pas ici : le nom court d'avant reste. */
const DOUTE = 'DOUTE';
/** « relatif à » : sans l'article, ni les prépositions d'une énumération. */
const RELATIF = 'RELATIF';

/**
 * Verbe ou locution qui ouvre l'objet, et ce qu'on en fait (même table qu'au
 * serveur, les plus longues d'abord) :
 * - `null` : l'objet est ce qui suit, tel quel (« portant nomination de … ») ;
 * - `''` : ce qui suit, sans son article (« fixant les modalités … » donne
 *   « Modalités … ») ;
 * - un nom : nominalisation, avec « de » contracté (« modifiant le décret … »
 *   donne « Modification du décret … »).
 */
const OUVERTURES: readonly (readonly [string, string | null])[] = [
  ['portant\\s+sur', ''],
  ['portant', null],
  ['modifiant\\s+et\\s+compl[ée]tant', 'Modification'],
  ['modifiant\\s+et\\s+abrogeant', 'Modification et abrogation'],
  ['modifiant', 'Modification'],
  ['compl[ée]tant', 'Complément'],
  ['abrogeant', 'Abrogation'],
  ['ratifiant', 'Ratification'],
  ['approuvant\\s+et\\s+rendant\\s+ex[ée]cutoire', 'Approbation'],
  ['approuvant', 'Approbation'],
  ['transformant', 'Transformation'],
  ['cr[ée]ant', 'Création'],
  ['organisant', 'Organisation'],
  ['prorogeant', 'Prorogation'],
  ['r[ée]glementant', 'Réglementation'],
  ['convoquant', 'Convocation'],
  ['nommant', 'Nomination'],
  ['fixant', ''],
  ['d[ée]terminant', ''],
  ['pr[ée]cisant', ''],
  ['d[ée]finissant', ''],
  ['r[ée]gissant', ''],
  ['instituant', ''],
  ['ordonnant', ''],
  ['relati(?:f|ve)\\s+(?:à|a|au|aux)', RELATIF],
  ["d['’]orientation", 'Orientation'],
  ['autorisant', DOUTE],
  ['habilitant', DOUTE],
  ['d[ée]clarant', DOUTE],
];

/**
 * Le premier verbe de la table, en mot entier. Groupe 1 : le caractère
 * d'avant (capturé faute d'assertion arrière) ; groupes 2 et suivants : un
 * par ligne de la table.
 */
const OUVERTURE = new RegExp(
  `(^|[^\\p{L}\\p{N}_'’])(?:${OUVERTURES.map(([motif]) => `(${motif})`).join('|')})(?![\\p{L}\\p{N}_'’])`,
  'iu',
);

/**
 * Noms qui ouvrent l'objet quand le verbe manque (« Décret N°2019/233 du 08
 * mai 2019 nomination d'un Inspecteur Général … »).
 */
const NOMS_D_OBJET = new RegExp(
  '(^|[^\\p{L}\\p{N}_])(?:nomination|promotion|inscription|avancement|organisation|r[ée]organisation' +
    '|attribution|int[ée]gration|cr[ée]ation|approbation|titularisation|adh[ée]sion' +
    '|admission|agr[ée]ment|convocation|r[ée]vocation|rappel|classement' +
    `|renouvellement|ratification)(?!${MOT})`,
  'iu',
);

const ARTICLE = new RegExp(`^(?:les|le|la|l['’]|des|du|une|un)\\s*(?=${MOT})`, 'iu');
const ARTICLE_ENUMERE = new RegExp(`(,\\s*|\\set\\s+)(?:les|le|la|l['’])\\s*(?=${MOT})`, 'giu');
const PREPOSITION_ENUMEREE = new RegExp(`(,\\s*|\\set\\s+)(?:à\\s+la|à\\s+l['’]|aux|au|à)\\s*(?=${MOT})`, 'giu');
const PREMIER_COMPLEMENT = /\s(?:du|des|de)\s|\sd['’]/i;
const VOYELLE = /^[aeiouyàâäéèêëîïôöùûüœæ]/iu;

const MOIS_RE =
  '(?:janv(?:ier)?|f[ée]v(?:r(?:ier)?)?|mars|avr(?:il)?|mai|juin|juil(?:l(?:et)?)?' +
  '|ao[uû]t|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|d[ée]c(?:embre)?)\\.?';
/** Date finale d'un acte uniforme ou d'un traité, qui ne la porte pas en tête. */
const DATE_FINALE = new RegExp(`,?\\s+du\\s+\\d{1,2}(?:er)?\\s+${MOIS_RE}\\s+\\d{4}\\.?$`, 'iu');
const PUBLIE_AU_JO = new RegExp(`,?\\s*publié\\s+au\\s+journal\\s+officiel(?!${MOT}).*$`, 'iu');
/** Un objet ne commence pas par une préposition : « portant de la médaille … » a perdu son nom. */
const DEBUT_DOUTEUX = new RegExp(
  `^(?:de|du|d['’]|à|au|aux|en|pour|par|sur|et|ou|avec|dans|entre|\\.\\.\\.|…)(?!${MOT})`,
  'iu',
);
/**
 * Un second verbe coordonné au premier (« précisant certaines attributions
 * et fixant les avantages … ») : l'objet en garderait la moitié conjuguée.
 * « modifiant et complétant » est une locution : un « et » qui suit
 * « modifiant » ne compte pas (vérifié à la main, faute d'assertion arrière).
 */
const SECOND_VERBE = new RegExp(
  '(,|\\set)\\s+(?:portant|fixant|modifiant|compl[ée]tant|abrogeant|ratifiant|approuvant|pr[ée]cisant' +
    `|d[ée]terminant|d[ée]finissant|r[ée]gissant|instituant|autorisant|habilitant)(?!${MOT})`,
  'giu',
);
const NOM_DE_FICHIER = new RegExp(`_${MOT}*_`, 'u');

/** Les intitulés du relevé sont coupés vers 255 caractères. */
const LONGUEUR_DE_COUPE = 254;

function aUnSecondVerbe(objet: string): boolean {
  for (const m of objet.matchAll(SECOND_VERBE)) {
    if (m[1] !== ',' && /modifiant$/i.test(objet.slice(0, m.index))) continue;
    return true;
  }
  return false;
}

/** Coupé à la longueur du relevé sans ponctuation finale, ou fini par « … » : l'objet garde la marque. */
function intituleCoupe(titre: string): boolean {
  const fin = titre.replace(/\s+$/, '');
  if (fin.endsWith('...') || fin.endsWith('…')) return true;
  return fin.length >= LONGUEUR_DE_COUPE && !/[.)»"]$/.test(fin);
}

function sansArticle(texte: string): string {
  return texte.replace(ARTICLE, '');
}

/** La fin de l'énumération de tête : son premier complément (« … du Conseil »). */
function finDeLEnumeration(texte: string): number {
  const complement = PREMIER_COMPLEMENT.exec(texte);
  return complement ? complement.index : texte.length;
}

/** « attributions, l'organisation et le fonctionnement du … » → « attributions, organisation et fonctionnement du … ». */
function sansArticlesDEnumeration(texte: string): string {
  const fin = finDeLEnumeration(texte);
  return texte.slice(0, fin).replace(ARTICLE_ENUMERE, '$1') + texte.slice(fin);
}

/** « don, au prélèvement et à la greffe de … » → « don, prélèvement et greffe de … ». */
function sansPrepositionsDEnumeration(texte: string): string {
  const fin = finDeLEnumeration(texte);
  return texte.slice(0, fin).replace(PREPOSITION_ENUMEREE, '$1') + texte.slice(fin);
}

/** « de » devant un groupe nominal, contracté : de le → du, de les → des, de un → d'un, de + voyelle → d'. */
function de(texte: string): string {
  const article = new RegExp(`^(?:(les|le|la|des|une|un)(?!${MOT})|(l['’])(?=${MOT}))\\s*`, 'iu').exec(texte);
  if (article) {
    const mot = (article[1] ?? article[2]).toLowerCase();
    const reste = texte.slice(article[0].length);
    if (mot === 'le') return `du ${reste}`;
    if (mot === 'les') return `des ${reste}`;
    if (mot === 'un' || mot === 'une') return `d'${mot} ${reste}`;
    if (mot === 'des') return (VOYELLE.test(reste) ? "d'" : 'de ') + reste;
    return `de ${texte}`;
  }
  return (VOYELLE.test(texte) ? "d'" : 'de ') + texte;
}

/** « à » devant un groupe nominal, contracté : à le → au, à les → aux. */
function a(texte: string): string {
  const article = new RegExp(`^(les|le)(?!${MOT})\\s*`, 'iu').exec(texte);
  if (article) return (article[1].toLowerCase() === 'le' ? 'au ' : 'aux ') + texte.slice(article[0].length);
  return `à ${texte}`;
}

function nominaliser(nom: string, reste: string): string {
  if (nom === 'Complément') return `Complément ${a(reste)}`;
  if (nom === 'Orientation') return `Orientation ${reste}`;
  return `${nom} ${de(reste)}`;
}

/** Un intitulé coupé en deux : son en-tête et son objet. */
export interface DecoupeDuTitre {
  /**
   * La nature, le numéro et la date, et rien d'autre (« Décret N°94/199 du
   * 07 octobre 1994 », « Décret N°2015/405 »), tels que l'intitulé les écrit,
   * espaces normalisés : les repères du texte, sous son nom.
   */
  enTete: string;
  /** L'objet, première lettre en capitale (« Statut Général de la Fonction Publique de l'État »). */
  objet: string;
}

/**
 * L'objet d'un texte, tiré de son intitulé officiel, ou `null` quand la
 * découpe n'est pas sûre (en-tête qui contient autre chose qu'une nature, un
 * numéro et une date, verbe non repris, intitulé tiré d'un nom de fichier).
 * La première lettre est mise en capitale ; le reste garde la casse de
 * l'intitulé, noms propres compris, comme au serveur.
 */
export function objetDuTitre(titre: string | null | undefined): string | null {
  return decoupeDuTitre(titre)?.objet ?? null;
}

/**
 * L'en-tête et l'objet d'un intitulé, ou `null` quand la découpe n'est pas
 * sûre (`objetDuTitre`). L'en-tête est celui que la découpe a vérifié :
 * chercher la date ailleurs dans l'intitulé prenait parfois celle d'un AUTRE
 * acte, cité dans l'objet (« Décret N°2017/591 4 décembre 2017 modifiant … le
 * décret n° 2001/066 du 12 mars 2001 »).
 */
export function decoupeDuTitre(titre: string | null | undefined): DecoupeDuTitre | null {
  if (!titre || NOM_DE_FICHIER.test(titre)) return null;
  const t = nettoyer(titre);

  let enTete: string;
  let reste: string;
  let traitement: string | null;
  const ouverture = OUVERTURE.exec(t);
  if (ouverture) {
    const debut = ouverture.index + ouverture[1].length;
    enTete = t.slice(0, debut);
    reste = t.slice(ouverture.index + ouverture[0].length).trim();
    const entree = OUVERTURES[ouverture.slice(2).findIndex((groupe) => groupe !== undefined)];
    if (!entree) return null;
    traitement = entree[1];
  } else {
    // Verbe absent : un nom d'objet fréquent peut ouvrir l'objet.
    const nom = NOMS_D_OBJET.exec(t);
    if (!nom) return null;
    const debut = nom.index + nom[1].length;
    enTete = t.slice(0, debut);
    reste = t.slice(debut);
    traitement = null;
  }

  enTete = enTete.replace(/^[ ,]+|[ ,]+$/g, '');
  if (traitement === DOUTE || !enTeteSansDoute(enTete)) return null;
  reste = reste.replace(/^[ ,:;\-–—]+/, '');
  if (reste.length < 3) return null;

  let objet: string;
  if (traitement === null) objet = reste;
  else if (traitement === '') objet = sansArticlesDEnumeration(sansArticle(reste));
  else if (traitement === RELATIF) objet = sansPrepositionsDEnumeration(sansArticle(reste));
  else objet = nominaliser(traitement, reste);

  objet = objet.replace(PUBLIE_AU_JO, '').replace(/,\s*révisé$/iu, '');
  // La date finale n'est retirée que pour un acte uniforme ou un traité, qui
  // la portent à la fin faute de la porter en tête. Ailleurs, « … du décret
  // n° 2013/092 du 03 avril 2013 » est la date d'un AUTRE acte.
  if (/^(?:acte|traite)/.test(replier(enTete))) objet = objet.replace(DATE_FINALE, '');
  objet = objet.replace(/[\s.;,:\-–—…]+$/u, '').trim();
  if (objet.length < 3 || DEBUT_DOUTEUX.test(objet) || aUnSecondVerbe(objet)) return null;
  if (intituleCoupe(titre)) objet += ' …';
  return { enTete, objet: objet.charAt(0).toUpperCase() + objet.slice(1) };
}

/**
 * L'objet sans la note de consolidation que porte parfois l'intitulé
 * (« Statut Général de la Fonction Publique de l'État, modifié et complété
 * par le décret n°2000/287 du 12 octobre 2000 ») : pour NOMMER un texte, la
 * note n'est pas l'objet, et elle doublait la longueur du nom dans la ligne
 * d'état et dans « Articles cités ». L'intitulé entier reste lisible dans
 * l'aperçu (encadré de statut) et sur la page du texte.
 */
export function sansNoteDeConsolidation(objet: string): string {
  const coupe = objet.replace(
    /,\s*(?:tel(?:le)?s?\s+que\s+)?(?:modifi|compl[ée]t)\p{L}*\s+(?:et\s+\p{L}+\s+)?par\s.*$/iu,
    '',
  );
  return coupe.length >= 3 ? coupe : objet;
}
