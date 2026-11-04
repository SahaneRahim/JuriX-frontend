# A3 — Jetons de la maquette → classes du dépôt (couleurs, rayons, ombres, polices)

**Règle d'or : la palette ne change pas.** La refonte garde le noir et blanc sur l'échelle ZINC de Tailwind, en clair comme en sombre ; le rouge reste réservé aux erreurs et aux actions qui suppriment. Aucune teinte nouvelle (les tests `monochrome.spec.ts` et `palette.spec.ts` relèvent chaque couleur peinte et échouent sur une teinte saturée hors du rouge).

Les maquettes sont écrites avec des variables CSS (`--bg`, `--card`, `--ink`…) définies sur la racine `.jx` (clair) et `.jx[data-theme=dark]` (sombre). Le dépôt n'utilise PAS de variables : il écrit des classes Tailwind (`bg-white dark:bg-zinc-900`). Ce tableau donne la traduction. En cas de doute, **imitez le composant voisin du dépôt** (`SearchResultCard.svelte`, `SiteHeader.svelte`, `StatusBadge.svelte`…) : une maquette est une intention, le dépôt fait foi pour les recettes.

## 1. Couleurs

| Variable | Rôle dans la maquette | Clair → sombre (valeurs des maquettes) | Classes Tailwind du dépôt |
|---|---|---|---|
| `--bg` | fond de page | `#FAFAFA` → `#09090B` | `bg-zinc-50 dark:bg-zinc-950` (déjà posé sur `html` par `src/app.css` ; jeton `background-light/dark`) |
| `--hd` | surface de l'en-tête | `#FFFFFF` → `#09090B` | **garder celle de `SiteHeader.svelte`** (la maquette ne change que la navigation) |
| `--card` | cartes, panneaux, feuille, champ unique | `#FFFFFF` → `#18181B` | `bg-white dark:bg-zinc-900` (usage dominant du dépôt : 113 occurrences de `dark:bg-zinc-900` ; le jeton `card-dark` `#121215` du `tailwind.config.js` n'est utilisé nulle part) |
| `--tx` | texte principal | `#09090B` → `#F4F4F5` | `text-zinc-950 dark:text-zinc-100` |
| `--tx1` | texte courant | `#3F3F46` → `#D4D4D8` | `text-zinc-700 dark:text-zinc-300` |
| `--tx2` | texte secondaire | `#52525B` → `#A1A1AA` | `text-zinc-600 dark:text-zinc-400` |
| `--tx3` | texte tertiaire (légendes) | `#71717A` → `#A1A1AA` | `text-zinc-500 dark:text-zinc-400`. **Ne pas poser sur un fond zinc-100 ou plus foncé** (4,4:1 : sous le seuil AA) : y prendre `text-zinc-600` (règle écrite dans `tailwind.config.js`) |
| `--bd` | filets, bordures de cartes | `#E4E4E7` → `#27272A` | `border-zinc-200 dark:border-zinc-800` |
| `--bd2` | bordures de contrôles (boutons, puces) | `#D4D4D8` → `#3F3F46` | `border-zinc-300 dark:border-zinc-700` |
| `--fill` | pastilles, fonds de bascules, barres de squelette | `#F4F4F5` → `#27272A` | `bg-zinc-100 dark:bg-zinc-800` |
| `--fill2` | fond légèrement creusé (survol de ligne, zone d'aperçu) | `#FAFAFA` / `#F7F7F8` → `#0F0F12` / `rgba(39,39,42,.5)` | `bg-zinc-50 dark:bg-zinc-800/50` (**`#F7F7F8` et `#0F0F12` ne sont pas dans l'échelle zinc : ne pas les reprendre**) |
| `--hl` | marqueur de surlignage | `#D4D4D8` → `#52525B` | dégradé `zinc-300` / `dark:zinc-600` (couleurs de fond du `linear-gradient`, voir A2 § 3.2) |
| `--ink` / `--inkt` | éléments ACTIFS : bouton plein, pastille choisie, soulignement, curseur / texte posé dessus | `#09090B` / `#FFFFFF` → `#FFFFFF` / `#09090B` | `bg-zinc-950 text-white dark:bg-white dark:text-zinc-950` (« tout élément actif du site s'inverse » : commentaire de `src/app.css`) ; survol `hover:bg-zinc-800 dark:hover:bg-zinc-200` |
| `--ph` | icônes DÉCORATIVES (flèche ↗, chevrons ; jamais du texte) | `#A1A1AA` → `#71717A` | `text-zinc-400 dark:text-zinc-500` |
| `--phx` | texte indicatif (placeholder, exemple tapé) | `#71717A` → `#A1A1AA` | déjà posé par `src/app.css` sur `input::placeholder` / `textarea::placeholder` (zinc-500 / zinc-400) ; pour l'exemple tapé superposé : `text-zinc-500 dark:text-zinc-400` |
| `--off` / `--offt` | bouton d'envoi inactif (champ vide) | `#E4E4E7` / `#A1A1AA` → `#27272A` / `#71717A` | `bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500` (+ `aria-disabled`, pas seulement la couleur) |
| `--dim` | voile derrière la feuille mobile | `rgba(9,9,11,.38)` → `rgba(0,0,0,.6)` | `bg-zinc-950/40 dark:bg-black/60` |
| `--glow` | halo du héros de l'accueil | `rgba(228,228,231,.6)` → `rgba(39,39,42,.5)` | `radial-gradient` zinc très léger derrière le titre ; décor facultatif, à supprimer plutôt que le durcir |
| `--sheet` | ombre des cartes posées | `0 1px 2px rgba(9,9,11,.05), 0 18px 40px -22px rgba(9,9,11,.22)` (sombre : `rgba(0,0,0,.4)` / `.8`) | ajouter une entrée `boxShadow.feuille` à `tailwind.config.js` (les ombres `soft`/`card` existantes sont plus courtes) |
| `--field` | fond du champ d'envoi du chat en sombre | `#FFFFFF` → `#121215` | **recette des champs du dépôt** : `dark:bg-zinc-950` (voir § 5) |
| `--ease` | courbe | `cubic-bezier(.22,1,.36,1)` | `ease-[cubic-bezier(.22,1,.36,1)]` ou `theme.extend.transitionTimingFunction` |

Contrastes vérifiés dans les maquettes (à garder) : `--tx3` sur `--bg`/blanc ≥ 4,6:1 ; placeholder `--phx` ≥ 4,8:1 (clair) et 6,9:1 (sombre) ; le marqueur `--hl` (1,5:1 sur blanc) n'est jamais le seul porteur du sens (soulignement 2 px en plus).

## 2. Rayons, espacements, ombres

Les maquettes emploient 12 rayons différents (3 à 24 px). **Ramener à l'échelle Tailwind du dépôt** (tolérance ±4 px) :

| Maquette | Classe |
|---|---|
| 999 px (pastilles, puces) | `rounded-full` |
| 24 px (haut de la feuille mobile) ; 22 px (champ unique, bureau) ; 20 px (champ unique, mobile et résultats) | `rounded-3xl` (`rounded-t-3xl` pour la feuille) — le champ unique est ramené à 24 px (écart ≤ 4 px) ; première utilisation dans le dépôt, c'est voulu |
| 18–22 px (cartes, panneaux, listes de résultats, note IA) | `rounded-2xl` (16 px) |
| 12–14 px (boutons, bascules, champs, pilules de segment) | `rounded-xl` (12 px) |
| 9–10 px (pilule INTERNE d'un segment) | `rounded-lg` (8 px) |
| 5–6 px (barres de squelette, kbd) | `rounded-md`/`rounded` |

Cibles tactiles : **44 px minimum** (`min-h-11 min-w-11`) pour tout bouton et lien d'action (les puces de citation sont des liens en ligne exemptés : `PASSATION.md` C1 et § 8.10). Le test `redimensionnement.spec.ts` mesure ces cibles au doigt.

Écrans courts (téléphone en paysage) : le dépôt a la variante `court:` (`@media (max-height: 500px)`). Les maquettes ont une règle équivalente (`.eyebrow` masqué et titre à 24 px sous 520 px de haut sur l'accueil mobile) : l'écrire avec `court:`.

Survol : `future.hoverOnlyWhenSupported` est activé : les `hover:` ne s'appliquent qu'aux appareils qui survolent. Les états « actif » tactiles (`active:scale-95`) restent permis.

## 3. Polices

| Rôle | Dans les maquettes | Dans le dépôt (à utiliser) |
|---|---|---|
| Interface, réponses de l'IA | `Inter` | `font-sans` (Inter Variable, auto-hébergée). **Tout ce que l'IA rédige reste en Inter** (commentaire de `src/app.css` : une réponse générée en serif paraîtrait plus sûre qu'elle ne l'est) |
| Titres d'affichage (h1 de l'accueil, des résultats, de la lecture ; « Article N ») | `Literata`, `opsz 72`, graisse 600 | `font-titre font-semibold`, **sans** `tracking-tight`, interligne 1,15–1,25 (1,12 pour le h1 mot à mot de l'accueil : `A2` § 3.5), `text-balance` |
| Texte officiel (corps des articles, aperçu dans le panneau des articles cités, extraits cités mot pour mot) | `Literata`, `opsz 16`, graisse 400 ; le passage cité garde la même graisse (fond + soulignement de 2 px : `A2` § 3.2) | `font-texte`, **pas de `font-semibold` sur les `<mark>`** (la graisse 600 de « Literata Texte » est servie par le fichier « titre » : voir `src/app.css`). Le chat demande les deux graisses au repos (`src/lib/components/chat/polices.ts`) |
| Surtitres, fil d'Ariane, dates, références, compteurs | `Geist Mono` (classe `.mono` des maquettes) | **Inter**, pas la chasse fixe. Sur les pages publiques, `font-mono` n'est utilisée que pour les touches (`<kbd>` « Ctrl K ») ; les surtitres se font en Inter (`text-xs uppercase tracking-wide` si besoin). Décision `tailwind.config.js` (Q5 A) : « surtitres, dates et compteurs passent en Inter ». **Écart volontaire avec les maquettes** |
| Chiffres | `tabular-nums` sur les compteurs | idem (et jamais sur les numéros d'article : « Art. 45-1 » deviendrait « Art. 45 - 1 » : commentaire de `SearchResultCard.svelte`) |

Échelle utilisée par les maquettes (px → classe) : 11 `text-[11px]` · 12 `text-xs` · 13 `text-[13px]` · 14 `text-sm` · 15 `text-[15px]` · 16 `text-base` · 17 `text-[17px]` · 18 `text-lg` · 19 `text-[19px]` (corps des articles) · 20 `text-xl` · 24 `text-2xl` · 26 `text-[26px]` (titre des résultats sous 640 px) · 30 `text-3xl` (titres de section de l'accueil) · 32 `text-[32px]` · 36 `text-4xl` (titre de l'accueil mobile) · titres fluides `clamp(2.25rem,4.2vw + .5rem,3.5rem)` (accueil) et `clamp(1.75rem,3vw + .5rem,2.5rem)` (lecture). Les valeurs exactes de chaque classe sont dans le CSS de chaque maquette (`<helmet><style>`) : traduire classe par classe.

Typographie française (déjà gérée par `src/lib/components/loi/typographie.ts` pour les textes de loi ; à respecter dans les chaînes neuves, écrites en séquences d'échappement `\u202F` / `\u00a0` dans `language.ts` : voir `A4` § 1) : espace fine insécable (U+202F) avant `?` `!` `;` `:` et dans « 2 275 » ; espace insécable (U+00A0) dans « n° 92/007 », « 14 août 1992 », « Art. 37 », « Section III : » ; apostrophe typographique `’` ; « Loi n° 92/007 », pas « Loi N°92/007 » (le titre officiel d'un texte vient du corpus et n'est pas retouché ; les chaînes de l'interface, si).

## 4. Surfaces et motifs récurrents

| Motif | Recette |
|---|---|
| Carte posée | `rounded-2xl border border-zinc-200 bg-white shadow-feuille dark:border-zinc-800 dark:bg-zinc-900` |
| Pile de cartes sous le champ unique (accueil, résultats) | deux pseudo-éléments décalés (accueil bureau : `translateY(9px) scale(.972)` et `translateY(18px) scale(.944)` ; mobile et résultats : `7px scale(.97)` et `14px scale(.94)` ; opacités .85 et .55) derrière un conteneur à `z-index: 0` ; le champ lui-même est un **élément interne** (un pseudo-élément à `z-index:-1` passerait AU-DESSUS du fond de son propre parent) |
| Pastille de profil / de mode | piste `rounded-xl bg-zinc-100 p-[3px] dark:bg-zinc-800`, pastille `absolute rounded-lg bg-zinc-950 dark:bg-white` qui glisse (A2 § 4), boutons `relative z-10 min-h-11` ; `aria-pressed` (jamais seulement la couleur) |
| Puce de citation | `rounded-full border border-zinc-300 bg-white px-2.5 text-xs font-semibold` ; active : `bg-zinc-950 text-white` (inversé en sombre) ; élément `<a>` **en ligne** (`display: inline`, `data-testid="chat-puce"`, décision C1), jamais `<button>` ni `inline-block` : seul un `<a>` en ligne dans une phrase est exempté des 44 px par `redimensionnement.spec.ts` (`dansUnePhrase`, ≈ l. 961-966) |
| Statut d'un texte | pastille `rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs` + icône (`circle-dashed` origine, `rotate-ccw-clock` modifié, `archive` abrogé) + mot ; **réutiliser `StatusBadge.svelte` / `StatutEnBref.svelte`** (ne pas dupliquer les libellés) |
| Lien étendu | `<a>` du titre avec `after:absolute after:inset-0` sur un parent `relative` (déjà la recette de `SearchResultCard.svelte`) ; anneau de focus dessiné par ce pseudo-élément |
| Focus | `outline: 2px solid <encre>; outline-offset: 2px` dans les maquettes ; dans le dépôt, reprendre la recette en usage dans les composants voisins (anneau zinc-950 / zinc-200 en sombre, `focus-visible:`) |
| Feuille / voile / menu mobile | feuille `fixed inset-x-0 bottom-0 z-[…] rounded-t-3xl`, voile `fixed inset-0`, tous deux `visibility:hidden` fermés ; focus piégé par l'action **`piegerFocus`** du dépôt (`src/lib/actions/pieger-focus.ts`) pour les fenêtres modales fixes (palette, choix du profil, sommaire, menus) : ne pas réécrire un piège de focus. **Exception : la feuille « Articles cités »**, qui devient un panneau permanent au-dessus de 1 024 px : reprendre la fonction `surTabulation` d'`ApercuDeCitation.svelte` (son commentaire explique pourquoi `piegerFocus` ne convient pas : il rend le focus à son point de départ quand on le retire, ce qui sortirait le focus du panneau au passage feuille → panneau pendant un redimensionnement) |

## 5. Écarts de recette entre maquette et dépôt à ARBITRER (ne pas les trancher en silence)

1. **Contour du champ unique.** Le dépôt impose pour tout champ une bordure `zinc-500` (≥ 3:1 contre la carte et la page : critère WCAG 1.4.11, `src/app.css`). La maquette dessine le champ unique comme une carte à contour discret (`--bd`, 1,3:1) avec ombre. À trancher avec le propriétaire : soit le contour du CHAMP (la zone de saisie) respecte la recette (`border-zinc-500`), soit une dérogation motivée est écrite dans le code (commentaire « POURQUOI ») et validée par `accessibilite.spec.ts`. Recommandation (= défaut X1 de `PASSATION.md`) : garder la carte discrète et poser la bordure `zinc-500` sur la zone de saisie elle-même, au repos et au focus (contrastes mesurés : 4,8:1 sur blanc, 3,7:1 en sombre sur `zinc-900`). **`zinc-400` ne convient pas en clair** (2,6:1 sur blanc : sous le seuil de 3:1).
2. **Fond du champ en sombre** : la recette du dépôt est `zinc-950` (un cran sous la carte `zinc-900` qui le porte). La maquette du chat utilise `#121215` : appliquer la recette du dépôt.
3. **Mono → Inter** (§ 3).
4. **Gris hors échelle** `#F7F7F8`, `#0F0F12`, `#121215` : remplacer comme au § 1.
5. **Animation de balance au survol du logo** : supprimée (A2 § 2.3).
6. **Fonts** : les maquettes appellent `fonts.googleapis.com` ; le dépôt est auto-hébergé (`@font-face` dans `src/app.css`, `font-display: optional`) et l'interdit : ne jamais reprendre le `<link>` des maquettes.
