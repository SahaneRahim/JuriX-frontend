<script lang="ts">
  /**
   * Le statut prouvé d'un texte, en une ligne, sur une ligne de liste ou de
   * recherche : « Abrogé en partie par 11 textes et complété par 1 · voir
   * l'historique » (maquette recherche-p7a, contrat §1.3).
   *
   * POURQUOI SI DISCRET. Il ne dit que ce que le relevé des liens entre textes
   * prouve (14 oct. 2026), et rien quand il n'en sait rien : un texte sans
   * statut n'est pas « en vigueur », il n'a simplement aucun lien relevé. Ni
   * pastille « En vigueur », ni rouge (P1 : icône et mot, jamais de rouge) ;
   * l'historique complet est sur la page du texte, où mène toute la ligne.
   *
   * Rien n'est rendu sans statut (ancienne API, ou aucun lien connu).
   */
  import { phraseDuStatutEnBref } from "$lib/api-publique";
  import Icone from "$lib/components/Icone.svelte";
  import { tr } from "$lib/stores/language";
  import type { StatutEnBref } from "$lib/types";

  export let statut: StatutEnBref | null | undefined;

  // `$tr` dans le bloc : la phrase se refait au changement de langue.
  $: phrase = phraseDuStatutEnBref(statut, $tr);
</script>

{#if phrase}
  <!-- Fond zinc-100 et texte zinc-700 (9,5:1), zinc-300 sur zinc-800 en
       sombre (10:1). Icône calée sur la première ligne : sur téléphone, la
       phrase passe parfois sur deux. -->
  <p
    class="mt-2 inline-flex items-start gap-1.5 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
  >
    <Icone nom="rotate-ccw-clock" class="mt-px shrink-0 text-sm" />
    <span>{phrase} · {$tr("listes.voirHistorique")}</span>
  </p>
{/if}
