/**
 * Identifiant lu dans une URL (/laws/<id>, /categories/<id>).
 *
 * Seule la forme canonique d'un entier positif est acceptée, et pas au-delà de
 * ce que la base stocke (entier 32 bits signé). `Number()` laissait passer
 * `012`, `1e3` ou `0x10` : /laws/012 rendait la loi 12 sous une canonique
 * /laws/012, un doublon indexable. Et /laws/99999999999 faisait échouer l'API
 * (500), que le rendu serveur prendrait pour une panne et servirait en 503.
 *
 * @returns l'identifiant, ou null si l'adresse ne peut désigner aucune ressource
 */
export function identifiantDepuis(brut: string): number | null {
  if (!/^[1-9]\d{0,9}$/.test(brut)) return null;
  const id = Number(brut);
  return id <= 2_147_483_647 ? id : null;
}
