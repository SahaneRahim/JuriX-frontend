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
  export let badge: { color: string; icon: string; labelKey: string };
  /** Barre d'accent verticale, réservée au premier résultat de la page. */
  export let highlight = false;
  export let copied = false;
  export let onCopy: (result: SearchResult) => void = () => {};

</script>

<article
  class="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden"
>
  {#if highlight}
    <div class="absolute top-0 left-0 w-1 h-full bg-primary"></div>
  {/if}

  <div class="flex justify-between items-start mb-2">
    <div>
      <span
        class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium mb-3 {badge.color}"
      >
        <span class="material-icons text-xs" aria-hidden="true">{badge.icon}</span>
        {$tr(badge.labelKey)}
      </span>
      <!-- Le titre porte cursor-pointer depuis toujours, mais
           n'etait ni un lien ni muni d'un gestionnaire : cliquer
           dessus ne faisait rien, alors que le style annonçait le
           contraire. Seul le petit lien en bas de carte navigait. -->
      <a href="/laws/{result.law_id}">
        <h2
          class="text-xl font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors cursor-pointer hover:underline"
        >
          {result.title || $tr("search.noTitle")}
        </h2>
      </a>
    </div>
    <button
      on:click={() => onCopy(result)}
      data-testid="search-copy-link"
      title={$tr("search.copyLink")}
      aria-label={$tr("search.copyLink")}
      class="text-slate-500 hover:text-primary transition-colors"
    >
      <span class="material-icons"
         aria-hidden="true">{copied
          ? "check"
          : "link"}</span
      >
    </button>
  </div>

  <p
    class="text-secondary-text-light dark:text-secondary-text-dark mb-4 leading-relaxed line-clamp-2"
  >
    {#if result.highlights?.content}
      <!-- Le surlignage vient de ts_headline, qui n'echappe PAS le
           texte source : on reconnait <mark> et on rend le reste en
           noeuds de texte, que Svelte echappe. Voir $lib/highlight. -->
      {#each highlightSegments(result.highlights.content) as seg, i (i)}
        {#if seg.marked}<mark>{seg.text}</mark>{:else}{seg.text}{/if}
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
    <div class="flex flex-wrap gap-2 mb-3">
      {#each result.matched_articles as article}
        <a
          href="/laws/{result.law_id}?article={encodeURIComponent(
            article.number,
          )}"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-primary hover:text-white transition-colors"
          title={article.title || ""}
        >
          <span class="material-icons text-sm" aria-hidden="true">article</span>
          Article {article.number}
        </a>
      {/each}
    </div>
  {/if}

  <div
    class="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-secondary-text-light dark:text-secondary-text-dark border-t border-slate-100 dark:border-slate-800 pt-4 mt-2"
  >
    {#if result.publication_date}
      <div class="flex items-center gap-1.5">
        <span class="material-icons text-base" aria-hidden="true">calendar_today</span>
        {formatDate(result.publication_date, $language.current)}
      </div>
    {/if}
    {#if result.category_name}
      <div class="flex items-center gap-1.5">
        <span class="material-icons text-base" aria-hidden="true">folder_open</span>
        {nomCategorie(result.category_name, $language.current)}
      </div>
    {/if}
    {#if result.reference}
      <div class="flex items-center gap-1.5">
        <span class="material-icons text-base" aria-hidden="true">tag</span>
        {result.reference}
      </div>
    {/if}

    <a
      href="/laws/{result.law_id}"
      class="ml-auto flex items-center gap-1 text-primary font-medium hover:underline"
    >
      {$tr("search.readFull")}
      <span class="material-icons text-sm" aria-hidden="true">arrow_forward</span>
    </a>
  </div>
</article>
