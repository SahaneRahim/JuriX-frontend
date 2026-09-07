<script lang="ts">
  import { API_URL } from "$lib/api";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import { tr } from "$lib/stores/language";
  import { language } from "$lib/stores/language";
  import type { ComparisonCell, ComparisonResponse, ComparisonRow } from "$lib/types";

  let sujetA = "";
  let sujetB = "";
  let resultat: ComparisonResponse | null = null;
  let enCours = false;
  let erreur = "";

  /**
   * Cellules dont le texte source est déplié, par clé « ligne:colonne ».
   *
   * Un Set réaffecté et non muté : Svelte n'observe que les affectations.
   */
  let depliees = new Set<string>();

  $: currentLanguage = $language.current;

  /**
   * Les deux colonnes d'une ligne, typees.
   *
   * Un tableau litteral `[["a", ligne.a], ["b", ligne.b]]` dans le `{#each}`
   * donne a Svelte un type `string | ComparisonCell` et casse la verification.
   */
  function colonnes(ligne: ComparisonRow): { cote: "a" | "b"; cellule: ComparisonCell }[] {
    return [
      { cote: "a", cellule: ligne.a },
      { cote: "b", cellule: ligne.b },
    ];
  }

  function basculer(cle: string) {
    const copie = new Set(depliees);
    if (copie.has(cle)) copie.delete(cle);
    else copie.add(cle);
    depliees = copie;
  }

  async function comparer() {
    // Memes bornes que ComparisonRequest cote backend (2 a 200 caracteres) :
    // sans ce controle, un sujet d'une lettre partait au serveur et revenait en
    // 422, affiche comme une « erreur serveur » qui n'en est pas une.
    if (sujetA.trim().length < 2 || sujetB.trim().length < 2) {
      erreur = $tr("compare.errorEmpty");
      return;
    }

    enCours = true;
    erreur = "";
    resultat = null;
    depliees = new Set();

    try {
      const reponse = await fetch(`${API_URL}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_a: sujetA.trim(),
          subject_b: sujetB.trim(),
          language: currentLanguage,
        }),
      });

      if (reponse.ok) {
        resultat = await reponse.json();
      } else if (reponse.status === 404) {
        erreur = $tr("compare.errorNotFound");
      } else if (reponse.status === 429) {
        erreur = $tr("chat.errorQuota");
      } else if (reponse.status === 503) {
        erreur = $tr("chat.errorOverloaded");
      } else {
        erreur = $tr("chat.errorServer");
      }
    } catch {
      erreur = $tr("chat.errorNetwork");
    } finally {
      enCours = false;
    }
  }
</script>

<MetaSeo
  titre={$tr("compare.title")}
  description={$tr("compare.subtitle")}
  indexable={false}
/>

<div class="min-h-screen bg-background-light dark:bg-background-dark flex flex-col">
  <SiteHeader />

  <main id="contenu" class="flex-1 max-w-6xl w-full mx-auto px-4 py-10">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
      {$tr("compare.title")}
    </h1>
    <p class="text-gray-600 dark:text-gray-300 mb-8">{$tr("compare.subtitle")}</p>

    <form
      class="grid gap-4 md:grid-cols-[1fr_1fr_auto] items-end mb-10"
      on:submit|preventDefault={comparer}
      data-testid="compare-form"
      novalidate
    >
      <label class="block">
        <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {$tr("compare.subjectA")}
        </span>
        <input
          bind:value={sujetA}
          data-testid="compare-a"
          required
          minlength="2"
          maxlength="200"
          placeholder={$tr("compare.placeholderA")}
          class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      <label class="block">
        <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {$tr("compare.subjectB")}
        </span>
        <input
          bind:value={sujetB}
          data-testid="compare-b"
          required
          minlength="2"
          maxlength="200"
          placeholder={$tr("compare.placeholderB")}
          class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      <button
        type="submit"
        disabled={enCours}
        data-testid="compare-submit"
        class="px-6 py-2.5 bg-primary hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-medium transition-colors"
      >
        {enCours ? $tr("compare.loading") : $tr("compare.submit")}
      </button>
    </form>

    {#if enCours}
      <div
        role="status"
        aria-live="polite"
        data-testid="compare-loading"
        class="flex items-center gap-3 text-gray-600 dark:text-gray-300"
      >
        <span class="flex items-center gap-1" aria-hidden="true">
          <span class="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
          <span class="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
          <span class="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
        </span>
        {$tr("compare.loading")}
      </div>
    {:else if erreur}
      <div
        role="alert"
        data-testid="compare-error"
        class="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300"
      >
        <p>{erreur}</p>
        <button
          on:click={comparer}
          data-testid="compare-retry"
          class="mt-2 underline font-medium hover:no-underline"
        >
          {$tr("common.retry")}
        </button>
      </div>
    {:else if resultat}
      <div data-testid="compare-result">
        <!--
          Les citations orphelines passent AVANT la grille, et en rouge.
          Un numéro que le modèle a inventé doit se voir immédiatement, pas
          après avoir lu sept lignes de tableau.
        -->
        {#if resultat.unmatched_citations.length}
          <div
            role="alert"
            data-testid="compare-unmatched"
            class="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
          >
            <p class="font-semibold">
              {$tr("compare.unmatched")} : {resultat.unmatched_citations.join(", ")}
            </p>
            <p class="text-sm mt-1">{$tr("compare.unmatchedHelp")}</p>
          </div>
        {/if}

        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <caption class="sr-only">
              {$tr("compare.title")} : {resultat.subject_a} / {resultat.subject_b}
            </caption>
            <thead>
              <tr class="border-b-2 border-gray-300 dark:border-slate-600">
                <th scope="col" class="text-left p-3 font-semibold text-gray-500 dark:text-gray-400 w-48">
                  {$tr("compare.criterion")}
                </th>
                <th scope="col" class="text-left p-3 font-semibold text-gray-900 dark:text-white">
                  {resultat.subject_a}
                </th>
                <th scope="col" class="text-left p-3 font-semibold text-gray-900 dark:text-white">
                  {resultat.subject_b}
                </th>
              </tr>
            </thead>
            <tbody>
              {#each resultat.rows as ligne, i}
                <tr class="border-b border-gray-200 dark:border-slate-700 align-top">
                  <th
                    scope="row"
                    class="p-3 text-left font-medium text-gray-500 dark:text-gray-400"
                  >
                    {ligne.criterion}
                  </th>
                  {#each colonnes(ligne) as { cote, cellule }}
                    <td class="p-3 text-gray-800 dark:text-gray-200">
                      <p class:italic={!cellule.sources.length}
                         class:text-gray-500={!cellule.sources.length}
                         class:dark:text-gray-500={!cellule.sources.length}>
                        {cellule.value}
                      </p>
                      {#if cellule.sources.length}
                        <div
                          class="mt-2 flex flex-wrap gap-2 items-center"
                          aria-label={$tr("compare.sources")}
                        >
                          {#each cellule.sources as source}
                            <a
                              href="/laws/{source.law_id}?article={encodeURIComponent(source.number)}"
                              title={source.law_title}
                              class="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 hover:underline"
                            >
                              {source.reference} · art. {source.number}
                            </a>
                          {/each}
                          <button
                            on:click={() => basculer(`${i}:${cote}`)}
                            data-testid="compare-toggle-{i}-{cote}"
                            aria-expanded={depliees.has(`${i}:${cote}`)}
                            aria-controls="src-{i}-{cote}"
                            aria-label="{depliees.has(`${i}:${cote}`)
                              ? $tr('compare.hideText')
                              : $tr('compare.showText')} — {ligne.criterion}, {cote === 'a'
                              ? resultat.subject_a
                              : resultat.subject_b}"
                            class="text-xs underline text-gray-500 dark:text-gray-400 hover:no-underline"
                          >
                            {depliees.has(`${i}:${cote}`)
                              ? $tr("compare.hideText")
                              : $tr("compare.showText")}
                          </button>
                        </div>
                        {#if depliees.has(`${i}:${cote}`)}
                          <!--
                            Le texte intégral de l'article cité, sous la cellule.
                            C'est ce qui rend visible une citation surnuméraire :
                            un article réel qui ne dit pas ce que la cellule
                            affirme. Aucun autre mécanisme ne l'attrape.
                          -->
                          <div
                            id="src-{i}-{cote}"
                            data-testid="compare-source-{i}-{cote}"
                            class="mt-2 space-y-3 p-3 rounded bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700"
                          >
                            {#each cellule.sources as source}
                              <div>
                                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                  {source.reference} — Art. {source.number}
                                  {#if source.page_number}· p. {source.page_number}{/if}
                                </p>
                                <p class="text-xs leading-relaxed whitespace-pre-line text-gray-700 dark:text-gray-300">
                                  {source.content}
                                </p>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        {#if resultat.key_differences.length}
          <section class="mt-8">
            <h2 class="font-bold text-gray-900 dark:text-white mb-2">
              {$tr("compare.differences")}
            </h2>
            <ul class="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
              {#each resultat.key_differences as d}<li>{d}</li>{/each}
            </ul>
          </section>
        {/if}

        {#if resultat.blind_spots.length}
          <section class="mt-6" data-testid="compare-blindspots">
            <h2 class="font-bold text-gray-900 dark:text-white mb-2">
              {$tr("compare.blindSpots")}
            </h2>
            <ul class="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-400">
              {#each resultat.blind_spots as b}<li>{b}</li>{/each}
            </ul>
          </section>
        {/if}

        <p class="mt-8 text-xs italic text-gray-500 dark:text-gray-400">
          {$tr("compare.disclaimer")}
          <span class="not-italic">
            ({$tr("compare.articlesRead")} :
            {resultat.articles_a.length} + {resultat.articles_b.length} ·
            {$tr("compare.timing")
              .replace("{r}", String(resultat.retrieval_time_ms))
              .replace("{g}", String(resultat.generation_time_ms))})
          </span>
        </p>
      </div>
    {/if}
  </main>

  <SiteFooter />
</div>
