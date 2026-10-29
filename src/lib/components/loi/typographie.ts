/**
 * Polices de la page d'un texte (Q5, variante A, les deux temps), en UN
 * endroit : revenir à Inter pour le texte officiel, si le test auprès des
 * lecteurs le demande, tient en une ligne (`POLICE_DU_TEXTE_OFFICIEL = ''`).
 *
 * - Titres en Literata 600 (taille optique 72) : le titre officiel du texte
 *   et les intitulés « Article N ». L'instance n'existe qu'en graisse 600 :
 *   `font-semibold` l'accompagne toujours (un `font-bold` donnerait un faux
 *   gras), et jamais `tracking-tight` (interlettrage nul).
 * - Texte officiel en Literata texte (taille optique 16, graisse 400) : le
 *   corps des articles, en lecture article par article comme en texte entier.
 *
 * Jamais sur ce que l'IA rédige (« Expliquer l'article ») : habillée de la
 * serif officielle, une réponse générée paraîtrait plus sûre qu'elle ne l'est.
 *
 * Les classes sont écrites en entier ici : Tailwind lit ce fichier
 * (`content` de tailwind.config.js) et génère `font-titre` et `font-texte`.
 */

/** Titre officiel et intitulés « Article N ». */
export const POLICE_DES_TITRES = 'font-titre font-semibold';

/** Corps des articles et texte entier. Chaîne vide : retour à Inter. */
export const POLICE_DU_TEXTE_OFFICIEL = 'font-texte';

/**
 * Lien dans une phrase (encadrés de statut, historique) : souligné zinc-400,
 * comme sur les maquettes P1 et P3. Le soulignement, et non la couleur, dit
 * que c'est un lien : la page est en noir et blanc.
 */
export const LIEN_DANS_LE_TEXTE =
  'font-medium text-zinc-950 underline decoration-zinc-400 underline-offset-4 hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-500 dark:hover:decoration-white';

/**
 * Bouton secondaire de la page (Partager, Copier…), 44 px de haut au doigt :
 * réduit seulement sous un pointeur fin à partir de `lg`, la règle des autres
 * boutons de la page. Trois actions tiennent sur une rangée dès 320 px (P10) :
 * libellé court en 12 px sous 400 px, icône et libellé côte à côte comme la
 * maquette loi-p10a, l'icône au-dessus du libellé sous 360 px seulement, où
 * « Partager » ne tient plus à côté de son icône. Empilés jusqu'à 400 px, ils
 * faisaient 56 px de haut à 390 px et repoussaient le premier mot de
 * l'article sous le pli (vérification r1 du 29/10/2026).
 */
export const BOUTON_SECONDAIRE =
  'inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-2 py-2 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white sm:gap-2 sm:px-4 lg:[@media(pointer:fine)]:min-h-9 max-[399px]:text-xs max-[359px]:flex-col max-[359px]:gap-0.5';

/** Le bouton principal de la page (Télécharger), au même gabarit. */
export const BOUTON_PRINCIPAL =
  'inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-zinc-950 px-2 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-black dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200 sm:gap-2 sm:px-4 lg:[@media(pointer:fine)]:min-h-9 max-[399px]:text-xs max-[359px]:flex-col max-[359px]:gap-0.5';
