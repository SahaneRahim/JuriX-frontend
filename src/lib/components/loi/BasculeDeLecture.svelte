<script lang="ts">
  /**
   * « Article par article | Texte entier » (P10, variante A) : deux boutons
   * à bascule (`aria-pressed`), le mode choisi inversé (fond zinc-950), comme
   * sur la maquette loi-p10a. Le texte entier ne coûte aucun octet de plus :
   * `law.content` est déjà chargé en entier.
   *
   * Le mode par défaut reste « article par article » : la proposition le
   * laisse à un test auprès des lecteurs, et les liens profonds (`?article=`)
   * comme le bouton « Expliquer l'article » y vivent.
   */
  import { createEventDispatcher } from "svelte";
  import { tr } from "$lib/stores/language";

  export let mode: "article" | "texte";

  const dispatch = createEventDispatcher<{ change: "article" | "texte" }>();

  const MODES = [
    { valeur: "article", cle: "loi.lecture.article", testid: "law-mode-article" },
    { valeur: "texte", cle: "loi.lecture.texte", testid: "law-mode-texte" },
  ] as const;

  function choisir(valeur: "article" | "texte") {
    if (valeur !== mode) dispatch("change", valeur);
  }
</script>

<!-- Les libellés passent à la ligne sous 360 px plutôt que d'élargir la page
     (« Article par article » demande 157 px, une demi-largeur en offre 126). -->
<div
  class="grid grid-cols-2 rounded-xl border border-zinc-300 p-0.5 dark:border-zinc-700 sm:inline-grid"
  role="group"
  aria-label={$tr("loi.lecture.mode")}
>
  {#each MODES as choix (choix.valeur)}
    {@const actif = mode === choix.valeur}
    <button
      type="button"
      aria-pressed={actif}
      data-testid={choix.testid}
      class="min-h-11 rounded-[10px] px-2 py-1.5 text-sm leading-tight transition-colors sm:px-4 lg:[@media(pointer:fine)]:min-h-9 {actif
        ? 'bg-zinc-950 font-semibold text-white dark:bg-white dark:text-zinc-950'
        : 'font-medium text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white'}"
      on:click={() => choisir(choix.valeur)}
    >
      {$tr(choix.cle)}
    </button>
  {/each}
</div>
