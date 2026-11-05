/**
 * La liste à filets : une carte posée, une ligne par texte, un filet entre
 * deux lignes. Celle des résultats de /search et celle des listes de textes
 * (/laws, page d'un domaine : ListeDeTextes).
 *
 * POURQUOI UNE CONSTANTE PARTAGÉE. Les deux pages écrivaient la même chaîne
 * de classes, chacune de son côté : la refonte (E4a) change le rayon et
 * l'ombre de la carte, et deux copies auraient dérivé. Recette de la « carte
 * posée » de la refonte (docs/refonte/annexes/A3 § 2 et § 4) : rayon de 16 px
 * (`rounded-2xl`, la maquette dit 20 px : ramené à l'échelle du dépôt, D3),
 * ombre `feuille` (le `--sheet` des maquettes), fond de carte, filets zinc.
 *
 * `overflow-hidden` : les lignes, à fond plein, ne débordent pas des coins
 * arrondis. Il ne coupe pas l'ombre, peinte hors de la boîte de la liste.
 */
export const LISTE_A_FILETS =
  'divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-feuille dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-feuille-sombre';
