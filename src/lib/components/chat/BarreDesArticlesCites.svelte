<script lang="ts">
  /**
   * La barre « N articles cités » (refonte A, sous 1 024 px), au-dessus de la
   * saisie : elle ouvre la feuille du panneau des preuves.
   *
   * POURQUOI ELLE RESTE MONTÉE, CACHÉE, FEUILLE OUVERTE. Elle reprend le focus
   * à la fermeture quand c'est elle qui a ouvert la feuille : recréée, elle
   * ne serait plus l'élément noté, et le focus retomberait sur <body>.
   *
   * Sans article cité, mais avec des textes consultés : la barre les annonce.
   * C6 ne la prévoit que pour les articles, mais ces textes n'ont plus d'autre
   * accès sur téléphone, et aucune fonction ne se retire (règle 3).
   */
  import Icone from "$lib/components/Icone.svelte";
  import { tr } from "$lib/stores/language";

  export let nombre: number;
  /** Les textes consultés, non cités : le libellé, à défaut d'article. */
  export let consultes = 0;
  export let ouverte: boolean;
  export let surOuvrir: (declencheur: HTMLElement) => void;

  $: t = $tr;
  $: libelle =
    nombre > 1
      ? t("chat.preuves.nombre").replace("{n}", String(nombre))
      : nombre === 1
        ? t("chat.preuves.nombreUn")
        : t("chat.consulted.title").replace("{n}", String(consultes));
</script>

{#if nombre > 0 || consultes > 0}
  <button
    type="button"
    data-testid="chat-barre-articles"
    aria-expanded={ouverte}
    aria-controls="cites"
    on:click={(event) => surOuvrir(event.currentTarget)}
    class="min-h-12 w-full shrink-0 items-center justify-between gap-2 border-t border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 lg:hidden {ouverte
      ? 'hidden'
      : 'flex'}"
  >
    <span class="coupe-mots min-w-0 text-left">{libelle}</span>
    <Icone nom="chevron-up" class="shrink-0 text-base" />
  </button>
{/if}
