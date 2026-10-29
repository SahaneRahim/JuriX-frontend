/**
 * Le nom d'une source du chat, tel qu'un lecteur le reconnaît.
 *
 * Les sources s'affichaient sous leur cote interne (« PRC-4722 — article
 * 94 ») : rien ne disait qu'il s'agissait du Code pénal. Le nom court est
 * celui sous lequel on cite le texte :
 * - un code : « Code Pénal », quand le texte EST le code (« Loi N° 2016/007
 *   du 12 juillet 2016 portant Code Pénal ») ; une loi qui MODIFIE le code
 *   (« … modifiant … la loi n° 2016/007 … portant code pénal ») garde son
 *   propre nom, sinon le lien dirait « Code pénal » et ouvrirait autre chose ;
 * - sinon l'acte et son numéro : « Décret N°2019/143 », « Arrêté N° 0924/CAB/PR ».
 * L'intitulé complet reste affiché en dessous.
 */

export interface SourceAffichable {
  law_reference: string;
  law_title: string;
  article_number?: string | null;
}

// « … N° 2016/007 du 12 juillet 2016 portant Code Pénal » : entre le numéro et
// « portant », une date et rien d'autre.
const TEXTE_QUI_EST_UN_CODE =
  /^\S+(?:\s+\S+)?\s+N[°o]?\.?\s*\S+\s+du\s+\d{1,2}(?:er)?\s+\S+\s+\d{4}\s*,?\s+portant\s+(code\b[^,.;(]*)/i;
const ACTE_ET_NUMERO = /^(\D{1,40}?\bN[°o]?\.?\s*\d[\w/.-]*)/i;

function majuscule(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * La cote interne d'un texte (« PRC-4722 », « LOI-1992-007 »,
 * « OHADA-AUDCG-2010 », « CODE-CIVIL ») : toutes les références de jurix_dev
 * ont cette forme (relevé du 29/10/2026). Un identifiant de collecte, qui ne
 * dit rien au lecteur : plus aucun écran ne l'affiche (P2, P11). Ici et non
 * dans $lib/data/blog, qui la reprend : le chat n'a pas à charger les
 * articles du blog pour la reconnaître.
 */
const COTE_INTERNE = /^(?:PRC|LOI|ORD|DEC|OHADA|CODE|CIMA)(?:-[A-Z0-9]+)+$/;

/** Vrai pour une cote interne (« PRC-4722 »), faux pour un nom (« Code civil applicable au Cameroun »). */
export function estUneCoteInterne(texte: string | null | undefined): boolean {
  return COTE_INTERNE.test((texte ?? '').trim());
}

/**
 * « N°92/007 » devient « n° 92/007 », avec une espace insécable : la graphie
 * des maquettes et de l'usage typographique français. Le numéro lui-même
 * n'est pas touché. Ici, et non dans les libellés du chat, pour la palette
 * (montée sur chaque page), la comparaison et la barre de recherche : passer
 * par $lib/components/chat/libelles leur ajoutait des tables du chat
 * qu'aucune n'emploie.
 */
export function typographieDesNumeros(texte: string): string {
  return texte.replace(/\b[Nn]\s*[°º]\s*\.?\s*(?=\S)/g, 'n°\u00A0');
}

/**
 * Le nom court d'un texte, ou une chaîne vide quand il n'a pas d'intitulé.
 *
 * Sans intitulé, la cote n'est PAS un repli : « Art. 12 — PRC-9153 » se serait
 * affiché dans « Articles cités », « Textes consultés » et la ligne d'état du
 * chat, alors que P2 et P11 retirent PRC-xxxx de tout écran. L'appelant nomme
 * alors le texte lui-même (`chat.citation.sansIntitule`, « Texte sans
 * intitulé ») ou l'omet. Une référence qui n'est pas une cote (« Décret
 * N°2024/PM/123 », saisie à l'ajout d'un document) reste un nom.
 */
export function nomCourtDuTexte(titre: string | null | undefined, reference = ''): string {
  const t = (titre ?? '').replace(/\s+/g, ' ').trim();
  if (!t) {
    const ref = reference.trim();
    return ref && !estUneCoteInterne(ref) ? ref : '';
  }

  const code = t.match(TEXTE_QUI_EST_UN_CODE);
  if (code) return majuscule(code[1].trim());

  const acte = t.match(ACTE_ET_NUMERO);
  // « N°0096/CAB/PR/du 16 février » : la barre colle parfois le « du » au numéro.
  if (acte) return acte[1].replace(/\/du$/i, '').trim();

  return t;
}

/**
 * « Article 94 — Code Pénal », ou le nom seul sans numéro d'article. Sans
 * intitulé, `sansIntitule` (traduit par l'appelant) tient lieu de nom, et à
 * défaut l'article se nomme seul : jamais la cote.
 */
export function libelleDeSource(source: SourceAffichable, sansIntitule = ''): string {
  const nom = nomCourtDuTexte(source.law_title, source.law_reference) || sansIntitule;
  if (!source.article_number) return nom;
  return nom ? `Article ${source.article_number} — ${nom}` : `Article ${source.article_number}`;
}
