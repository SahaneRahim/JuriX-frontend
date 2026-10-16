/**
 * Numéro d'article ramené à une forme comparable : « Article 1er » et « 1 »,
 * « ART. 12 bis » et « 12 BIS » désignent le même article.
 *
 * LONGUEUR BORNÉE. La valeur vient aussi de l'URL (`/laws/<id>?article=…`), et
 * la page est rendue par le serveur : la dernière expression, ancrée en fin de
 * chaîne seulement, coûte un temps quadratique sur une longue suite de
 * séparateurs qui ne la termine pas. Une adresse piégée de 16 Ko bloquait le
 * processus Node, donc toutes les pages, pendant ce calcul. Aucun numéro réel
 * n'approche 64 caractères.
 */
export const LONGUEUR_MAX_NUMERO = 64;

export function normaliserNumeroArticle(valeur: string | number | null | undefined): string {
  if (valeur === undefined || valeur === null) return '';
  return String(valeur)
    .slice(0, LONGUEUR_MAX_NUMERO)
    .trim()
    .toUpperCase()
    .replace(/^(ARTICLE|ART\.?|SECTION)\s+/, '')
    .replace(/^(\d+)\s*(ER|ÈRE|ERE)$/, '$1')
    .replace(/[.:\-\s]+$/, '');
}
