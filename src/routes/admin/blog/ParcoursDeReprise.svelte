<script lang="ts">
  /**
   * Le parcours de reprise d'un article qui n'a pas de sources enregistrées :
   * un article publié avant la vérification (lignes 1 à 3 du 26/10), ou écrit
   * à la main. Cinq étapes, dans l'ordre : « Reconstruire les sources », citer
   * au moins un article des sources, « Relancer le contrôle IA », relire
   * chaque partie, publier. Chacune dit si elle est faite ; celle en cours dit
   * ce qui bloque et quoi faire, avec son bouton.
   *
   * POURQUOI (décision du propriétaire du 30/10, b ; revue du tour 3). Ces
   * articles sont cachés du public, gardés en base, visibles et corrigeables
   * dans l'administration, et ne reviennent en ligne que par le nouveau
   * parcours. Au tour 3, ce parcours n'existait pas : sans sources, aucun
   * « Citer », un contrôle IA qui répondait « aucun extrait », une
   * publication refusée, et pour seule issue la suppression de l'article.
   *
   * Noir et blanc, comme le reste de l'administration : l'étape en cours a le
   * cadre épais, les étapes à venir sont en tirets. Les raisons sont celles
   * du pied de la fenêtre (`blocagesDePublication`), rangées par étape.
   *
   * LE FOCUS. Chaque étape peut le recevoir (`tabindex="-1"`, hors de l'ordre
   * de tabulation) : après « Reconstruire les sources », réussie, le bouton
   * disparaît avec son étape, faite, et le focus tombait sur <body>. La
   * fenêtre le donne alors à l'étape désormais en cours (`etape-<nom>`), qui
   * dit ce qui bloque et porte son propre bouton.
   */
  import Icone from "$lib/components/Icone.svelte";
  import { tr } from "$lib/stores/language";
  import type { Blocage, Etape } from "./relecture";

  export let etapes: Etape[];
  /** Publié avant la vérification (« À reprendre »), et non un simple article sans sources. */
  export let ancien = false;
  /** La vue de la fenêtre : le bouton d'une étape mène à la vue où elle se fait. */
  export let vue: "relecture" | "apercu" | "edition" = "relecture";
  /** Un envoi en cours dans la fenêtre : les boutons attendent. */
  export let occupe = false;
  /** La reconstruction des sources est en cours. */
  export let reconstructionEnCours = false;
  /** Le temps écoulé de la reconstruction (« 0:04 »). */
  export let chrono = "";
  /** Des modifications non enregistrées : la reconstruction les enregistre d'abord. */
  export let modifie = false;
  /** La phrase d'une raison de blocage, celle du pied de la fenêtre. */
  export let phrase: (blocage: Blocage) => string;
  export let onReconstruire: () => void;
  export let onVue: (vue: "relecture" | "edition") => void;

  const BOUTON =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white";

  const CADRE: Record<Etape["statut"], string> = {
    faite: "border-zinc-200 dark:border-zinc-700",
    en_cours: "border-2 border-zinc-950 dark:border-white",
    a_venir: "border-dashed border-zinc-300 dark:border-zinc-600",
  };
</script>

<section
  class="space-y-3 rounded-xl border border-zinc-300 p-4 dark:border-zinc-600"
  aria-labelledby="titre-de-la-reprise"
  data-testid="blog-reprise"
>
  <div class="space-y-1">
    <h3 id="titre-de-la-reprise" class="flex items-center gap-2 text-sm font-bold text-zinc-950 dark:text-white">
      <Icone nom="rotate-ccw-clock" class="shrink-0 text-base" />
      {$tr("admin.blog.reprise.title")}
    </h3>
    <p class="text-xs text-zinc-700 dark:text-zinc-300">
      {ancien ? $tr("admin.blog.reprise.introLegacy") : $tr("admin.blog.reprise.introNoSources")}
    </p>
  </div>

  <ol class="space-y-2">
    {#each etapes as etape, i (etape.etape)}
      <li
        id="etape-{etape.etape}"
        tabindex="-1"
        class="rounded-lg border px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:focus-visible:ring-white dark:focus-visible:ring-offset-zinc-900 {CADRE[
          etape.statut
        ]}"
        aria-current={etape.statut === "en_cours" ? "step" : undefined}
        data-testid="blog-etape-{etape.etape}"
        data-statut={etape.statut}
      >
        <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p
            class="flex min-w-0 items-center gap-2 text-sm {etape.statut === 'a_venir'
              ? 'text-zinc-600 dark:text-zinc-400'
              : 'font-semibold text-zinc-950 dark:text-white'}"
          >
            {#if etape.statut === "faite"}
              <Icone nom="circle-check" class="shrink-0 text-base" />
            {:else}
              <span
                aria-hidden="true"
                class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums {etape.statut ===
                'en_cours'
                  ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                  : 'border-zinc-400 dark:border-zinc-500'}">{i + 1}</span
              >
            {/if}
            <span class="coupe-mots">{$tr(`admin.blog.reprise.step.${etape.etape}`)}</span>
          </p>
          <span class="shrink-0 text-xs font-medium text-zinc-600 dark:text-zinc-400" data-testid="blog-etape-statut">
            {etape.statut === "faite"
              ? $tr("admin.blog.reprise.done")
              : etape.statut === "en_cours"
                ? $tr("admin.blog.reprise.current")
                : $tr("admin.blog.reprise.next")}
          </span>
        </div>

        {#if etape.statut === "en_cours"}
          <div class="mt-2 space-y-2">
            <!-- Ce qui bloque à cette étape, puis comment la franchir. -->
            {#if etape.blocages.length > 0}
              <ul class="list-disc space-y-0.5 pl-5 text-xs text-zinc-800 dark:text-zinc-200">
                {#each etape.blocages as blocage, j (j)}
                  <li class="coupe-mots">{phrase(blocage)}</li>
                {/each}
              </ul>
            {/if}
            <p id="aide-etape-{etape.etape}" class="text-xs text-zinc-600 dark:text-zinc-400">
              {$tr(`admin.blog.reprise.hint.${etape.etape}`)}
            </p>
            {#if etape.etape === "sources"}
              <button
                type="button"
                class={BOUTON}
                aria-disabled={occupe ? "true" : undefined}
                aria-describedby="aide-etape-sources"
                data-testid="blog-reconstruire-sources"
                on:click={onReconstruire}
              >
                {#if reconstructionEnCours}
                  <Icone nom="loader-circle" class="h-4 w-4 motion-safe:animate-spin" />
                  {$tr("admin.blog.sources.rebuilding")}
                  <span class="font-normal tabular-nums" data-testid="blog-sources-chrono">{chrono}</span>
                {:else}
                  <Icone nom="search" class="text-base" />
                  {modifie ? $tr("admin.blog.sources.saveAndRebuild") : $tr("admin.blog.sources.rebuild")}
                {/if}
              </button>
            {:else if etape.etape === "citations" && vue !== "edition"}
              <button type="button" class={BOUTON} aria-describedby="aide-etape-citations" on:click={() => onVue("edition")}>
                <Icone nom="pen-line" class="text-base" />
                {$tr("admin.blog.reprise.goEdit")}
              </button>
            {:else if (etape.etape === "controle" || etape.etape === "relecture") && vue !== "relecture"}
              <button type="button" class={BOUTON} aria-describedby="aide-etape-{etape.etape}" on:click={() => onVue("relecture")}>
                <Icone nom="circle-check" class="text-base" />
                {$tr("admin.blog.reprise.goReview")}
              </button>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ol>
</section>
