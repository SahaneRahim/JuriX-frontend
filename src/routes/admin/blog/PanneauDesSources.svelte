<script lang="ts">
  /**
   * Le panneau des sources de la fenêtre de relecture : les extraits remis au
   * modèle, numérotés comme dans les verdicts du contrôle IA (« Soutenue par
   * l'extrait 3 »), à côté du texte relu.
   *
   * POURQUOI À CÔTÉ (contrat du 30/10). La relecture humaine est obligatoire
   * et se fait CONTRE LES SOURCES : l'explication de l'article 1752 du Code
   * civil, publiée le 30/10, disait le contraire de son extrait, qui était
   * pourtant à l'écran, mais replié en tête de la fenêtre et coupé à quatre
   * lignes. Au bureau, le panneau est une colonne qui défile seule, à droite
   * du texte ; au téléphone, un volet qui se déplie au-dessus.
   *
   * Les extraits sont GARDÉS AVEC L'ARTICLE (avenant du tour 4) : le panneau
   * les montre à chaque ouverture, le lendemain comme pendant la visite de la
   * génération. Au tour 3, l'API ne les rendait pas : un brouillon rouvert
   * affichait « Contredite par l'extrait 5 » sans l'extrait 5 nulle part, et
   * disait à tort qu'ils n'étaient gardés que pendant la visite. Un article
   * qui n'en a pas (d'avant la vérification, ou écrit à la main) montre ici
   * les textes qu'il cite, et dit de reconstruire les sources (parcours de
   * reprise de la fenêtre).
   */
  import Icone from "$lib/components/Icone.svelte";
  import { adresseDeCitation, citationBruteVerifiee } from "$lib/data/blog";
  import { tr } from "$lib/stores/language";
  import { dejaCitee, nomDeCitation, type Formulaire, type SourceDeGeneration } from "./relecture";

  /** Les sources de l'article, gardées avec lui (`ArticleAdmin.sources`). */
  export let sources: SourceDeGeneration[] = [];
  /** Les citations de l'article : ce que le panneau montre quand il n'a pas de sources. */
  export let citations: Record<string, unknown>[] = [];
  /** Le volet ouvert, au téléphone (au bureau, le panneau est toujours visible). */
  export let ouvert = false;
  /** Les extraits dépliés en entier (numéros). */
  export let deplies: number[] = [];
  /** Vue d'édition : chaque source peut être citée. */
  export let edition = false;
  export let form: Formulaire | null = null;
  export let occupe = false;
  export let onOuvrir: (ouvert: boolean) => void = () => {};
  export let onDeplier: (n: number, deplie: boolean) => void = () => {};
  export let onCiter: (source: SourceDeGeneration) => void = () => {};

  const AIDE = "text-xs text-zinc-500 dark:text-zinc-400";
  const BOUTON_DISCRET =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white";

  /** Un extrait long se replie à six lignes ; un court se lit d'un coup. */
  const long = (texte: string) => texte.length > 360 || texte.split("\n").length > 6;

  $: titre =
    sources.length > 0
      ? $tr("admin.blog.sourcesTitle").replace("{n}", String(sources.length))
      : $tr("admin.blog.citedTexts").replace("{n}", String(citations.length));
</script>

<!-- Une `div` et non une `section` nommée : la fenêtre la pose dans un
     <aside> déjà nommé par ce titre ; deux repères du même nom, l'un dans
     l'autre, se liraient deux fois. -->
<div class="space-y-3 p-4 sm:px-6 lg:p-5" data-testid="blog-sources">
  <!-- Au téléphone, titre et bouton tiennent sur une ligne (320 px) : sans
       l'icône, le bouton sans retour à la ligne. -->
  <div class="flex items-center justify-between gap-2">
    <h3 id="titre-des-sources" class="flex min-w-0 items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
      <Icone nom="files" class="hidden shrink-0 text-base sm:inline-block" />
      {titre}
    </h3>
    <!-- Au téléphone seulement : au bureau, la colonne est toujours là. -->
    <button
      type="button"
      class="{BOUTON_DISCRET} shrink-0 whitespace-nowrap lg:hidden"
      aria-expanded={ouvert}
      aria-controls="liste-des-sources"
      on:click={() => onOuvrir(!ouvert)}
    >
      {ouvert ? $tr("admin.blog.sourcesHide") : $tr("admin.blog.sourcesShow")}
      <Icone nom="chevron-down" class="text-base transition-transform {ouvert ? 'rotate-180' : ''}" />
    </button>
  </div>

  <div id="liste-des-sources" class="space-y-3 {ouvert ? '' : 'hidden'} lg:block">
    {#if sources.length > 0}
      <p class={AIDE}>{$tr("admin.blog.sourcesHelp")}</p>
      <ol class="space-y-3">
        {#each sources as source, i (`${source.n}-${i}`)}
          {@const adresse = adresseDeCitation({ lawId: source.lawId, articleNumber: source.articleNumber })}
          {@const deplie = deplies.includes(source.n)}
          <!-- Cible des boutons « extrait N » des verdicts : il reçoit le focus. -->
          <li
            id="source-{source.n}"
            tabindex="-1"
            class="scroll-mt-4 space-y-1 rounded-lg bg-zinc-50 p-3 outline-none ring-zinc-950 focus:ring-2 dark:bg-zinc-800/60 dark:ring-white"
            data-testid="blog-source"
          >
            <p class="coupe-mots text-sm font-medium text-zinc-950 dark:text-white">
              [{source.n}]
              {nomDeCitation(
                { law_title: source.lawTitle, article_number: source.articleNumber, ...(source.suite ? { suite: true } : {}) },
                $tr,
              )}
            </p>
            <p
              id="extrait-de-la-source-{source.n}"
              class="whitespace-pre-line text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 {deplie ? '' : 'line-clamp-6'}"
            >
              {source.extrait}
            </p>
            <div class="flex flex-wrap items-center gap-x-1">
              {#if long(source.extrait)}
                <button
                  type="button"
                  class={BOUTON_DISCRET}
                  aria-expanded={deplie}
                  aria-controls="extrait-de-la-source-{source.n}"
                  on:click={() => onDeplier(source.n, !deplie)}
                >
                  {deplie ? $tr("admin.blog.sourceLess") : $tr("admin.blog.sourceMore")}
                </button>
              {/if}
              {#if adresse}
                <a href={adresse} target="_blank" rel="noopener" class={BOUTON_DISCRET}>
                  {$tr("admin.blog.sourceOpen")}
                  <Icone nom="external-link" class="text-sm" />
                </a>
              {/if}
              {#if edition && form}
                {#if dejaCitee(form, source)}
                  <span class="px-3 text-xs text-zinc-500 dark:text-zinc-400">{$tr("admin.blog.cited")}</span>
                {:else}
                  <button type="button" class={BOUTON_DISCRET} disabled={occupe} on:click={() => onCiter(source)}>
                    <Icone nom="plus" class="text-sm" />
                    {$tr("admin.blog.cite")}
                  </button>
                {/if}
              {/if}
            </div>
          </li>
        {/each}
      </ol>
    {:else}
      <!-- Sans sources enregistrées (article d'avant la vérification, ou écrit
           à la main) : les textes cités, extrait vérifié et lien compris, et
           de quoi en sortir (« Reconstruire les sources »). -->
      <p class={AIDE} data-testid="blog-sources-absentes">{$tr("admin.blog.sourcesMissing")}</p>
      {#if citations.length > 0}
        <ol class="space-y-3">
          {#each citations as citation, i (i)}
            {@const verifiee = citationBruteVerifiee(citation)}
            {@const adresse = verifiee && typeof citation.url === "string" ? citation.url : null}
            <li class="space-y-1 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60">
              <p class="coupe-mots text-sm font-medium text-zinc-950 dark:text-white">{nomDeCitation(citation, $tr)}</p>
              {#if verifiee && typeof citation.excerpt === "string"}
                <p class="whitespace-pre-line text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">{citation.excerpt}</p>
              {:else}
                <p class={AIDE}>{$tr("blog.unverifiedCitation")}</p>
              {/if}
              {#if adresse}
                <a href={adresse} target="_blank" rel="noopener" class={BOUTON_DISCRET}>
                  {$tr("admin.blog.sourceOpen")}
                  <Icone nom="external-link" class="text-sm" />
                </a>
              {/if}
            </li>
          {/each}
        </ol>
      {/if}
    {/if}
  </div>
</div>
