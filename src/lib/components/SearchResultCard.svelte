<script lang="ts">
  /**
   * Une carte de résultat de recherche.
   *
   * Extraite de src/routes/search/+page.svelte au moment où la page a été
   * scindée en deux sections (« titre » et « mentions dans le texte »).
   * L'en-tête de cette page-là garde la trace d'une divergence provoquée par un
   * copier-coller de balisage, corrigée deux fois : dupliquer cent lignes de
   * carte pour une seconde section aurait recommencé.
   */
  import { tr, language } from "$lib/stores/language";
  import { nomCategorie } from "$lib/categories";
  import { formatDate } from "$lib/format";
  import { highlightSegments } from "$lib/highlight";
  import Icone from "$lib/components/Icone.svelte";
  import CategoryIcon from "$lib/components/CategoryIcon.svelte";
  import type { NomIcone } from "$lib/icones";
  import type { SearchResult } from '$lib/types';

  /**
   * Un `SearchResult` de `app/schemas/search.py` — plus un objet libre.
   *
   * Les replis `result.law_id || result.id` et `result.publication_date ||
   * result.date` ont ete retires : ni `id` ni `date` n'existent sur ce type, et
   * la branche gauche etait donc toujours celle qui gagnait. Du code defensif
   * contre une forme que l'API n'a jamais renvoyee.
   */
  export let result: SearchResult;
  /** `icon` typé : un nom absent du registre d'icônes ne passe pas la vérification. */
  export let badge: { color: string; icon: NomIcone; labelKey: string };
  export let copied = false;
  export let onCopy: (result: SearchResult) => void = () => {};

  /**
   * Le titre, découpé après chaque barre oblique, pour y permettre une coupure
   * de ligne (`<wbr>`). Une cote comme « N°00000127/MINFI/MINCOMMERCE » n'a
   * aucune espace, et Chrome ne coupe pas après « / » devant une lettre :
   * sur un téléphone, `break-words` la coupait en plein mot (« …/MINCOMM »
   * puis « ERCE »). Coupée à la barre, elle reste lisible.
   */
  $: morceauxDuTitre = (result.title || $tr("search.noTitle")).split("/");
</script>

<!-- La carte cliquable du guide (§ 4.1), la même que celles de /laws et de
     la page d'une catégorie : fond, bordure et rayon des cartes, 16 puis
     20 px de marge intérieure, aucune ombre, et le survol porté par la
     bordure (plus 2 px de déplacement si le système l'admet). Elle avait
     28 px de marge à partir de sm et une ombre qui passait de shadow-sm à
     shadow-lg au survol : un troisième dessin de la même carte de texte.
     Toute la carte mène au texte, comme sur les deux autres listes : le lien
     du titre la couvre (voir plus bas). Plus de barre verticale de 4 px sur
     la première carte : sans libellé, elle la faisait paraître
     sélectionnée ; aucune autre liste ne l'employait, et le guide ne la
     prévoit pas (c'était la place de l'ancien accent coloré). -->
<article
  class="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 transition-all duration-200 hover:border-zinc-950 motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-400"
>
  <!-- Le badge du type et le bouton de copie sur une même ligne, le titre
       EN DESSOUS, sur toute la largeur. Le bouton occupait une colonne de
       44 px le long de tout le titre : à 390 px, il restait 268 px sur 325
       pour un titre de cinq à sept lignes, avec un vide sous le bouton.
       Badge : la recette du guide (§ 4.8), en sans-serif comme le libellé
       qu'il est ; l'icône à 14 px, floue à 12. -->
  <div class="flex items-center justify-between gap-3 mb-3">
    <span
      class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium {badge.color}"
    >
      <Icone nom={badge.icon} class="text-sm" />
      {$tr(badge.labelKey)}
    </span>
    <!-- 44 px de côté : l'icône nue faisait 24 px, collée au titre. Les marges
         négatives gardent l'icône alignée sur le coin de la carte, et la
         ligne à la hauteur du badge : le bouton déborde de 10 px en haut,
         dans la marge de la carte, et en bas, dans l'espace (mb-3) qui le
         sépare du titre. Icône en zinc-600 et non 400 : seule dans le bouton,
         elle n'est pas décorative, et zinc-400 ne fait que 2,6:1 sur blanc.
         `relative z-10` : au-dessus du lien qui couvre la carte, sans quoi
         un appui sur le bouton ouvrirait le texte au lieu de copier. -->
    <button
      on:click={() => onCopy(result)}
      data-testid="search-copy-link"
      title={$tr("search.copyLink")}
      aria-label={$tr("search.copyLink")}
      class="relative z-10 -mr-2 -my-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
    >
      <Icone nom={copied ? "check" : "link"} class="text-2xl" />
    </button>
  </div>
  <!-- Le titre porte cursor-pointer depuis toujours, mais n'etait ni un lien
       ni muni d'un gestionnaire : cliquer dessus ne faisait rien, alors que
       le style annonçait le contraire. Seul le petit lien en bas de carte
       navigait.
       Titre de carte du guide (§ 4.2), celui des cartes de /laws et d'une
       catégorie : 16 px sur téléphone, 18 px ensuite, à l'interligne de sa
       taille. L'interligne serré (/snug) d'avant rapprochait les lignes d'un
       titre de loi plus que sur les deux autres listes. break-words reste le
       repli d'un mot sans barre trop long pour la ligne.
       Le lien couvre toute la carte : son ::after, en position absolue, se
       pose sur la boîte de l'article (le premier ancêtre positionné, le lien
       restant `static`). Il reste en ligne autour du titre, comme avant : la
       marge passe donc sur le titre, une marge verticale ne s'appliquant pas
       à un élément en ligne. Le survol de la carte (sa bordure) remplace le
       soulignement du titre, qui ne s'allumait plus que sous le titre.
       Focus clavier : un anneau de 2 px sur le bord intérieur de la carte,
       dessiné par le même ::after (guide, § 4.6 : il remplace le contour par
       défaut). Le contour d'un lien en ligne autour d'un bloc (le titre) ne se
       dessinait pas autour du titre : le focus ne se voyait pas. Anneau
       intérieur, et non décalé à l'extérieur : la carte coupe ce qui dépasse
       (overflow-hidden). -->
  <a
    href="/laws/{result.law_id}"
    class="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-zinc-950 dark:focus-visible:after:ring-white"
  >
    <h2
      class="mb-2 text-base sm:text-lg font-bold break-words text-zinc-950 dark:text-white"
    >
      {#each morceauxDuTitre as morceau, i (i)}{#if i}/<wbr />{/if}{morceau}{/each}
    </h2>
  </a>

  <!-- Trois lignes sous sm : deux lignes de 300 px ne disent presque rien du
       passage trouvé. -->
  <p
    class="text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed line-clamp-3 sm:line-clamp-2 text-sm font-normal"
  >
    {#if result.highlights?.content}
      <!-- Le surlignage vient de ts_headline, qui n'echappe PAS le
           texte source : on reconnait <mark> et on rend le reste en
           noeuds de texte, que Svelte echappe. Voir $lib/highlight. -->
      {#each highlightSegments(result.highlights.content) as seg, i (i)}
        {#if seg.marked}<mark class="bg-zinc-200 dark:bg-zinc-700 text-zinc-950 dark:text-white rounded px-0.5">{seg.text}</mark>{:else}{seg.text}{/if}
      {/each}
    {:else}
      {result.content?.substring(0, 200) ||
        $tr("search.noDescription")}{(result.content?.length ?? 0) > 200 ? "..." : ""}
    {/if}
  </p>

  <!-- matched_articles etait toujours vide : la recherche
       travaillait au niveau document. Elle rend desormais des
       articles, et chacun mene directement au bon endroit du
       texte. -->
  {#if result.matched_articles && result.matched_articles.length > 0}
    <!-- Puces de 44 px : à 26 px, viser « Article 12 » plutôt que son voisin
         demandait de s'y reprendre. Réduites dès sm, elles l'étaient aussi
         sur un téléphone en paysage et sur une tablette : elles ne le sont
         plus qu'à partir de lg ET sous un pointeur fin (souris, pavé) ; une
         tablette de 1 024 px garde ses 44 px. Même puce que les sources de
         /compare (un lien vers un article) : badge zinc, inversé au survol.
         Le « § » (section) dit « article de loi » ; le journal désigne le blog.
         `relative z-10` : au-dessus du lien qui couvre la carte, chaque puce
         garde sa destination (l'article, et non le début du texte). -->
    <div class="flex flex-wrap gap-2 mb-3">
      {#each result.matched_articles as article}
        <a
          href="/laws/{result.law_id}?article={encodeURIComponent(
            article.number,
          )}"
          class="relative z-10 inline-flex min-h-11 items-center gap-1 px-3 py-1 sm:px-2.5 lg:[@media(pointer:fine)]:min-h-0 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-sm sm:text-xs font-mono font-medium tabular-nums text-zinc-600 dark:text-zinc-300 hover:border-zinc-950 hover:bg-zinc-950 hover:text-white dark:hover:border-white dark:hover:bg-white dark:hover:text-zinc-950 transition-colors"
          title={article.title || ""}
        >
          <Icone nom="section" class="text-sm" />
          Article {article.number}
        </a>
      {/each}
    </div>
  {/if}

  <!-- UNE ligne de méta, celle du guide (§ 4.2) : font-mono tabular-nums
       text-xs, zinc-500 (zinc-400 en sombre), la cote puis la date comme sur
       /laws, sous le titre et l'extrait. Plus de filet au-dessus ni de lien
       « Lire le texte complet » à droite : la carte entière mène au texte,
       comme sur les deux autres listes, et ce lien de 44 px de haut ajoutait
       une ligne à chaque carte sur téléphone. Icônes à 14 px, la taille de la
       date d'une carte de catégorie. -->
  <div
    class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400"
  >
    {#if result.reference}
      <!-- Une cote comme « DÉCRET N°2018/9387/CAB/PM » n'a aucune espace où
           passer à la ligne : sans coupe-mots, elle débordait de la carte. -->
      <span class="flex min-w-0 items-center gap-1.5">
        <Icone nom="hash" class="text-sm" />
        <span class="min-w-0 coupe-mots">{result.reference}</span>
      </span>
    {/if}
    {#if result.publication_date}
      <span class="flex items-center gap-1.5">
        <Icone nom="calendar" class="text-sm" />
        {formatDate(result.publication_date, $language.current)}
      </span>
    {/if}
    {#if result.category_name}
      <!-- L'icône du domaine juridique, et non un dossier générique : la même
           que sur l'accueil et la page de la catégorie, elle situe le texte
           d'un coup d'œil. Nom français de l'API, comme l'attend
           CategoryIcon. Le domaine est un libellé, ni une date ni une cote :
           il reste en sans-serif. -->
      <span class="flex items-center gap-1.5 font-sans">
        <CategoryIcon category={result.category_name} class="text-sm" />
        {nomCategorie(result.category_name, $language.current)}
      </span>
    {/if}
  </div>
</article>
