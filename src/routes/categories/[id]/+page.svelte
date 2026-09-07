<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import { language, tr } from "$lib/stores/language";
  import { descriptionCategorie, nomCategorie } from "$lib/categories";
  import { formatDate } from "$lib/format";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { descriptionDepuis, urlCanonique } from "$lib/seo";
  import type { FiltreLangue } from "$lib/types";
  import { fly } from "svelte/transition";

  /** Rempli par `+page.ts`. Une catégorie absente n'arrive plus ici : 404. */
  export let data;

  // L'identifiant vient de la BASE, plus d'un slug devine.
  //
  // L'ancienne version recevait un slug (« lois », « decrets ») et cherchait
  // une categorie dont le nom le CONTIENNE. Quand rien ne correspondait — et
  // rien ne correspondait jamais pour les types de texte — elle basculait sur
  // une recherche plein texte du mot « loi », qui remonte tous les decrets :
  // d'ou des decrets affiches dans « Lois ». Ce repli est supprime, et la
  // validation de l'identifiant a rejoint `+page.ts` : une categorie
  // introuvable repond desormais 404 au lieu de rendre une page vide en 200.

  /** Filtre de texte, purement client : il n'y a pas d'endpoint pour cela. */
  let searchQuery = "";

  // Tout vient du `load` et se re-derive a chaque navigation : sans `$:`, passer
  // de /categories/3 a /categories/7 laisserait le titre et la liste de la
  // categorie precedente a l'ecran, SvelteKit reutilisant le composant.
  $: documents = data.documents;
  $: categoryTitle = nomCategorie(data.categorie?.name, $language.current);
  $: categoryDesc = descriptionCategorie(
    data.categorie?.name,
    data.categorie?.description,
    $language.current,
  );
  $: categoryIcon = data.categorie?.icon || "📄";
  $: error = data.erreur ? $tr(data.erreur) : "";

  /**
   * Langue du filtre : les deux langues du site, plus « toutes ».
   *
   * Le type était inféré depuis `$language.current`, donc `Language` — alors
   * que le troisième bouton assigne `"all"`. Le type mentait ; `FiltreLangue`
   * du module de types partagés dit exactement ce que la valeur peut valoir.
   *
   * La valeur vit désormais dans l'URL : une catégorie filtrée en anglais
   * n'était pas partageable, les trois vues partageant la même adresse.
   */
  $: selectedLanguage = data.lang as FiltreLangue;

  function choisirLangue(valeur: FiltreLangue) {
    const params = new URLSearchParams($page.url.searchParams);
    // « toutes » est l'etat par defaut : ne pas l'ecrire garde l'URL propre, et
    // c'est celle-la que la canonique designe.
    if (valeur === "all") params.delete("lang");
    else params.set("lang", valeur);
    const requete = params.toString();
    goto(requete ? `?${requete}` : "?", { keepFocus: true, noScroll: true });
  }


  $: filteredDocuments = documents.filter(
    (doc) =>
      searchQuery === "" ||
      doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  $: currentStyle = { icon: categoryIcon, bg: "bg-white/20 text-white" };

  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
</script>

<!--
  Description : celle de la catégorie quand elle existe, sinon une phrase
  construite depuis son nom et son volume. Une `meta description` vide serait
  indexée telle quelle, et la plupart des catégories du corpus n'ont pas de
  description saisie.
-->
<MetaSeo
  titre={categoryTitle}
  description={descriptionDepuis(categoryDesc) ||
    (data.categorie
      ? `${data.categorie.law_count} ${$tr("categories.documentsShort")} — ${categoryTitle}`
      : "")}
  canonique={urlCanonique($page.url)}
/>

<SiteHeader />

<main id="contenu">
<div class="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
  <!-- Blue Header Section -->
  <div
    class="bg-blue-600 dark:bg-blue-800 text-white pb-32 pt-8 px-4 relative overflow-hidden"
  >
    <!-- Background Pattern/Gradient (Optional) -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-700 opacity-50"
    ></div>

    <div class="max-w-7xl mx-auto relative z-10">
      <!-- Back Link -->
      <a
        href="/"
        class="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-8 font-medium"
      >
        <span class="material-icons text-sm" aria-hidden="true">arrow_back</span>
        {$tr("categories.backHome")}
      </a>

      <!-- Icon & Title -->
      <div class="flex items-center gap-6">
        <div
          class="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-inner"
        >
          <span class="text-4xl leading-none">{currentStyle.icon}</span>
        </div>
        <div>
          <h1
            class="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight"
          >
            {categoryTitle}
          </h1>
          <p class="text-blue-100 text-lg opacity-90 max-w-2xl">
            {categoryDesc}
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content overlap -->
  <div class="max-w-7xl mx-auto px-4 -mt-24 relative z-20">
    <!-- Search Bar Card -->
    <div
      class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 p-2 mb-8 flex flex-col md:flex-row items-center gap-4"
    >
      <!-- Input -->
      <div class="flex-1 relative w-full">
        <span
          class="absolute left-4 top-1/2 -translate-y-1/2 material-icons text-slate-500"
           aria-hidden="true">search</span
        >
        <input
          type="text"
          bind:value={searchQuery}
          aria-label={$tr("a11y.searchField")}
          placeholder={$tr("categories.searchPlaceholder")}
          class="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl focus:ring-2 focus:ring-blue-500/50 text-slate-700 dark:text-slate-200 placeholder-slate-400 font-medium transition-shadow"
        />
      </div>

      <!-- Language Filter -->
      <div
        class="flex items-center gap-3 px-4 py-2 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-700 w-full md:w-auto justify-between md:justify-start"
      >
        <span class="text-sm font-semibold text-slate-500 mr-2"
          >{$tr("categories.langLabel")} :</span
        >
        <div class="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
          <button
            class="px-3 py-1.5 rounded-md text-xs font-bold transition-all {selectedLanguage ===
            'fr'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}"
            on:click={() => choisirLangue("fr")}>FR</button
          >
          <button
            class="px-3 py-1.5 rounded-md text-xs font-bold transition-all {selectedLanguage ===
            'en'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}"
            on:click={() => choisirLangue("en")}>EN</button
          >
          <button
            class="px-3 py-1.5 rounded-md text-xs font-bold transition-all {selectedLanguage ===
            'all'
              ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}"
            on:click={() => choisirLangue("all")}
            >{$tr("categories.all")}</button
          >
        </div>
      </div>
    </div>

    <!-- Results Section -->
    <div>
      <!--
        L'indicateur de chargement a disparu avec le bloc reactif qui chargeait :
        la page n'est plus rendue avant que ses donnees soient la.

        La reprise passe par `invalidateAll()`, qui rejoue le `load`. Le bouton
        appelait auparavant `fetchCategoryDocuments`, une fonction qui n'a jamais
        existe dans ce fichier : le SEUL moyen de recuperation de la page levait
        une ReferenceError. Ne pas reintroduire d'appel a une fonction locale ici.
      -->
      {#if error}
        <div
          role="alert"
          class="bg-red-50 dark:bg-red-900/20 text-red-600 p-8 rounded-2xl text-center border border-red-100 dark:border-red-900/30"
        >
          <span class="material-icons text-4xl mb-2" aria-hidden="true">error_outline</span>
          <p class="font-medium mb-4">{error}</p>
          <button
            class="px-6 py-2 bg-white text-red-600 font-semibold rounded-lg shadow-sm border border-red-100 hover:bg-red-50 transition-colors"
            on:click={() => invalidateAll()}
            data-testid="category-retry"
          >
            {$tr("categories.retry")}
          </button>
        </div>
      {:else if filteredDocuments.length === 0}
        <div
          class="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100"
        >
          <div
            class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <span class="material-icons text-3xl text-slate-500"
               aria-hidden="true">search_off</span
            >
          </div>
          <p class="text-slate-900 font-medium mb-1">
            {$tr("categories.noDocsTitle")}
          </p>
          <p class="text-slate-500 text-sm">{$tr("categories.noDocsDesc")}</p>
        </div>
      {:else}
        <p class="text-sm font-medium text-slate-500 mb-4 pl-1">
          {filteredDocuments.length}
          {$tr("categories.docsCount")}
        </p>

        <div class="grid gap-4">
          <!--
            Les replis `doc.law_id ?? doc.id` et `doc.date || doc.publication_date`
            ont ete retires : cet endpoint rend des LawResponse, qui n'ont ni
            `law_id` ni `date`. Les deux branches gauches etaient donc toujours
            indefinies — du code defensif contre une forme qui n'existe pas, que
            le typage a rendu visible.
          -->
          {#each filteredDocuments as doc, i}
            <a
              href="/laws/{doc.id}"
              class="group block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
              in:fly={{ y: 20, duration: 400, delay: i * 50 }}
            >
              <div class="p-5 flex gap-5 items-start">
                <!-- Icon Box -->
                <div
                  class="shrink-0 w-12 h-12 rounded-xl {currentStyle.bg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                >
                  <span class="text-2xl leading-none">{currentStyle.icon}</span>
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0 pt-0.5">
                  <h3
                    class="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-2 group-hover:text-blue-600 transition-colors"
                  >
                    {doc.title || $tr("search.noTitle")}
                  </h3>

                  <p
                    class="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed"
                  >
                    {(doc.content || $tr("categories.noPreview"))
                      .replace(/<<PAGE:?\s*\d+>>/gi, "")
                      .replace(/\s+/g, " ")
                      .trim()}
                  </p>

                  <!-- Footer Tags -->
                  <div class="flex items-center gap-3">
                    <!-- Language Tag (Mock) -->
                    <span
                      class="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wide"
                    >
                      FR
                    </span>

                    <!-- Date -->
                    {#if doc.publication_date}
                      <span
                        class="flex items-center gap-1.5 text-xs font-medium text-slate-500"
                      >
                        <span class="material-icons text-[14px]"
                           aria-hidden="true">calendar_today</span
                        >
                        {formatDate(doc.publication_date, $language.current)}
                      </span>
                    {/if}
                  </div>
                </div>

                <!-- Chevron -->
                <div class="self-center pl-2">
                  <span
                    class="material-icons text-slate-300 group-hover:text-blue-500 transition-colors"
                     aria-hidden="true">chevron_right</span
                  >
                </div>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

</main>

<SiteFooter />
