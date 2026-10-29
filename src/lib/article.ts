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

/** Un numéro d'article normalisé : des chiffres, puis un suffixe latin (« 12 BIS ») ou un morceau (« 55.2 »). */
const NUMERO_LISIBLE = /^(\d{1,9})(?:\s*(BIS|TER|QUATER|QUINQUIES|SEXIES|SEPTIES|OCTIES|NONIES|DECIES)|(\.\d{1,4}))?$/;

/**
 * Le numéro d'article qu'une page peut ÉCRIRE, tiré d'une valeur de l'adresse
 * (`?article=`) : « 36 », « 12 bis », « 55.2 », « 1 » pour « 1er ». `null`
 * pour tout le reste (« DISPOSITIF », une phrase, « $& ») : la valeur vient
 * d'un lien que n'importe qui peut écrire, et un avis de la page la citait
 * mot pour mot (« L'article abrogé, voir wa.me/… n'a pas été retrouvé dans
 * ce texte »).
 */
export function numeroAAfficher(valeur: string | null | undefined): string | null {
  const m = NUMERO_LISIBLE.exec(normaliserNumeroArticle(valeur));
  if (!m) return null;
  return m[2] ? `${m[1]} ${m[2].toLowerCase()}` : `${m[1]}${m[3] ?? ''}`;
}
