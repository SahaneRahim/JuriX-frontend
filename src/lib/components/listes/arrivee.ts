/**
 * Les délais de l'arrivée des lignes de résultats (refonte A, E4a) : quand
 * chaque ligne monte, quand ses mots cherchés se soulignent, quand son statut
 * se pose. Des nombres purs, en millisecondes, que SearchResultCard écrit dans
 * la variable `--d` de chaque élément animé (src/lib/mouvement.css).
 *
 * POURQUOI UN PLAFOND À CINQ RANGS (décision R9). La maquette échelonne les
 * lignes de 120 ms chacune : sur une page de 20 résultats, la dernière
 * n'arrivait qu'après 2,4 s, alors que la maquette n'en montre que deux. Le
 * décalage est de 80 ms et cesse de croître au sixième rang : toutes les
 * lignes sont à l'écran en moins d'une seconde, et celles qui suivent, hors
 * de la première fenêtre, montent ensemble.
 *
 * POURQUOI AUCUN DÉLAI AU-DELÀ D'UNE SECONDE (décision D9). Les délais des
 * maquettes allaient jusqu'à 2,3 s : un mot souligné ou un statut qui se pose
 * si tard arrive quand on lit déjà. Tout est borné à 1 s.
 */

/** Décalage entre deux lignes (R9 ; la maquette disait 120 ms). */
export const PAS_DES_LIGNES_MS = 80;

/** Rang au-delà duquel le décalage ne croît plus (R9). */
export const RANG_PLAFOND = 5;

/** Aucun délai d'arrivée ne dépasse une seconde (D9). */
export const DELAI_MAX_MS = 1000;

/**
 * Le soulignement des mots cherchés part quand la ligne a fini de monter
 * (0,6 s, `mv-monter`) : « une seule chose animée à la fois » (A2 § 1).
 */
export const SOULIGNEMENT_APRES_MS = 600;

/** Puis un mot après l'autre, comme la maquette (0,6 s puis 0,8 s). */
export const PAS_DES_MOTS_MS = 200;

/** Le statut se pose quand la ligne est presque arrivée (A2 § 3.3, tampon). */
export const TAMPON_APRES_MS = 450;

/** Un rang lisible : entier, positif ; tout le reste compte comme le premier. */
function rangValide(rang: number): number {
  return Number.isFinite(rang) && rang > 0 ? Math.floor(rang) : 0;
}

/** Délai d'arrivée de la ligne de rang `rang` (0 pour la première) : `min(rang, 5) × 80 ms`. */
export function delaiDeLaLigne(rang: number): number {
  return Math.min(rangValide(rang), RANG_PLAFOND) * PAS_DES_LIGNES_MS;
}

/** Délai du soulignement du `mot`-ième mot en gras (0 pour le premier) de la ligne de rang `rang`. */
export function delaiDuSoulignement(rang: number, mot: number): number {
  return Math.min(delaiDeLaLigne(rang) + SOULIGNEMENT_APRES_MS + rangValide(mot) * PAS_DES_MOTS_MS, DELAI_MAX_MS);
}

/** Délai du tampon du statut de la ligne de rang `rang`. */
export function delaiDuTampon(rang: number): number {
  return Math.min(delaiDeLaLigne(rang) + TAMPON_APRES_MS, DELAI_MAX_MS);
}
