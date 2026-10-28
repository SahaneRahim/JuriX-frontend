<script lang="ts">
  import Icone from '$lib/components/Icone.svelte';
  import type { NomIcone } from '$lib/icones';
  import { tr } from '$lib/stores/language';
  export let title: string;
  export let value: string;
  export let change: string | null = null;
  export let trend: 'up' | 'down' | 'neutral' = 'neutral';
  /**
   * Icône Lucide de la tuile. C'était un émoji, dessiné et colorié autrement
   * sur chaque système. La prop `color` a disparu avec lui : en noir et blanc,
   * les quatre tuiles avaient toutes la même teinte.
   */
  export let icon: NomIcone;
  /**
   * Ligne sous la valeur, pour une carte sans tendance : la période mesurée
   * (« Les 7 derniers jours »). Seule la carte des documents avait une ligne
   * sous sa valeur ; les trois autres, étirées à la hauteur de la rangée,
   * gardaient un tiers vide en bas. La ligne dit aussi ce que la valeur
   * seule taisait : ces chiffres ne portent que sur la fenêtre de mesure.
   */
  export let detail: string | null = null;

  // Hausse et baisse ont la même couleur : une baisse n'est pas une erreur, le
  // rouge (réservé aux erreurs) ne lui revient pas. Le sens passe par la
  // flèche et par le signe de `change`.
  $: couleurTendance = trend === 'neutral' ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-950 dark:text-white';
</script>

<!-- La tuile de l'icône n'est affichée que si la carte lui laisse la place,
     sinon le titre prend toute la largeur, sans icône. Dessous, un titre
     passait sur deux lignes dans les quatre cartes à la fois :
     - au téléphone (deux cartes par rangée, 171 px à 390 px de large), la
       petite icône posée devant le titre (22 px avec son écart) ne lui
       laissait que 117 px : « Documents au / total », « Utilisateurs /
       actifs » ;
     - sur quatre colonnes de 222 px (1 024 px de large, et 1 280 px où la
       barre latérale devient une colonne), la tuile et sa marge (60 px) ne
       laissaient que 114 px au titre.
     Sans icône, le titre a 139 px au téléphone et 174 px sur quatre
     colonnes : « Temps de réponse », le plus long (124 px à 14 px), tient sur
     une ligne. L'icône est décorative (le titre porte le sens) : elle cède sa
     place plutôt que de couper les titres.
     Quand la place revient-elle ? Sur deux colonnes (de sm à lg), toujours ;
     sur quatre, quand la rangée des chiffres clés fait au moins 65 rem
     (1 040 px), soit des cartes de 242 px qui gardent 134 px au titre à côté
     de la tuile. La rangée est le conteneur de la requête
     (`[container-type:inline-size]`, admin/+page.svelte) : la largeur de
     l'écran ne dit pas celle des cartes, puisque la barre latérale prend
     256 px à partir de xl. La carte elle-même ne peut pas l'être : un
     conteneur établit un contexte de mise en page indépendant, ce qui
     annulerait sa sous-grille (CSS Grid 2, § 9). Navigateur sans requêtes de
     conteneur : pas de tuile sur quatre colonnes, et rien ne se coupe.

     La carte est une sous-grille de trois rangées (titre, valeur, ligne du
     bas) prises dans la grille des chiffres clés : un titre sur deux lignes
     abaisse la valeur et la ligne du bas de TOUTES les cartes de sa rangée.
     En flex, chaque carte posait sa valeur sous son propre titre : à 222 px
     (quatre colonnes dans 960 px de contenu, à 1 024 comme à 1 280 px),
     « Documents Total » tenait sur une ligne, ses trois voisins sur deux, et
     « 1 284 » flottait 20 px au-dessus de « 3 480 ». De même sur un
     téléphone, quand un seul des deux titres d'une rangée passe à la ligne.
     Hors d'une grille, `subgrid` vaut `none` : la carte reste une grille
     ordinaire. `gap-y-0` : sans lui, la sous-grille reprendrait l'écart de la
     grille parente (16 ou 24 px) entre titre, valeur et ligne du bas. Aucun
     écart de colonne non plus : la tuile cachée laisse une colonne vide,
     dont l'écart aurait pris 12 px au titre ; la marge est sur la tuile. -->
<div
  class="row-span-3 grid grid-cols-[minmax(0,1fr)_auto] grid-rows-subgrid gap-y-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:p-6"
>
  <p class="col-start-1 row-start-1 min-w-0 text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
  <!-- Chiffres tabulaires (guide § 4.2, les nombres) : en chiffres
       proportionnels et `tracking-tight`, le « 1 » étroit avalait l'espace
       fine qui le suit, et « 1 284 » se lisait « 1284 » à côté de « 3 480 ». -->
  <h3 class="coupe-mots col-start-1 row-start-2 mt-2 min-w-0 text-xl font-bold tabular-nums tracking-tight text-zinc-950 dark:text-white sm:text-2xl">{value}</h3>
  <div
    class="col-start-2 row-span-2 row-start-1 ml-3 hidden h-12 w-12 items-center justify-center self-start rounded-xl border border-zinc-200/70 bg-zinc-100 text-zinc-800 dark:border-zinc-700/60 dark:bg-zinc-800 dark:text-zinc-200 sm:flex lg:hidden lg:[@container(min-width:65rem)]:flex"
  >
    <Icone nom={icon} class="text-xl" />
  </div>

  <!-- « +37 en 30 jours » : `recent_laws` compte les textes créés dans les
       30 derniers jours (app/api/routes/analytics.py), ce que « depuis le
       mois dernier » ne disait qu'à peu près. La formule tient aussi sur une
       ligne (127 px à 14 px, contre 197) : longue, elle passait seule à la
       ligne, et la carte des documents finissait plus bas que ses voisines
       (« Les 7 derniers jours »). -->
  {#if change}
    <div class="col-span-full row-start-3 mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:mt-4 sm:text-sm">
      <span class="flex items-center font-medium {couleurTendance}">
        {#if trend === 'up'}
          <Icone nom="trending-up" class="mr-1 h-4 w-4" />
        {:else if trend === 'down'}
          <Icone nom="trending-down" class="mr-1 h-4 w-4" />
        {/if}
        {change}
      </span>
      <span class="text-zinc-500 dark:text-zinc-400">{$tr("admin.inLast30Days")}</span>
    </div>
  {:else if detail}
    <p class="col-span-full row-start-3 mt-3 text-xs text-zinc-500 dark:text-zinc-400 sm:mt-4 sm:text-sm">{detail}</p>
  {/if}
</div>
