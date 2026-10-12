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

export function nomCourtDuTexte(titre: string | null | undefined, reference = ''): string {
  const t = (titre ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return reference;

  const code = t.match(TEXTE_QUI_EST_UN_CODE);
  if (code) return majuscule(code[1].trim());

  const acte = t.match(ACTE_ET_NUMERO);
  // « N°0096/CAB/PR/du 16 février » : la barre colle parfois le « du » au numéro.
  if (acte) return acte[1].replace(/\/du$/i, '').trim();

  return t;
}

/** « Article 94 — Code Pénal », ou le nom seul sans numéro d'article. */
export function libelleDeSource(source: SourceAffichable): string {
  const nom = nomCourtDuTexte(source.law_title, source.law_reference);
  return source.article_number ? `Article ${source.article_number} — ${nom}` : nom;
}
