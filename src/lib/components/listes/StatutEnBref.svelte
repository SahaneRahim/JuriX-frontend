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
   *
   * REFONTE A (E4a, décision R5) : restyle seul. La phrase et l'icône ne
   * changent pas ; la maquette des résultats montre « Origine, non
   * consolidée », que l'API ne fournit pas ici : rien de tel n'est affiché.
   * POURQUOI LE TAMPON, OPTIONNEL (R6). Le geste « tamponner » (A2 § 3.3) dit
   * qu'un statut se pose : seulement à la PREMIÈRE apparition de la ligne
   * (`animer`, que la page de recherche ne lève qu'à l'arrivée d'une nouvelle
   * requête), sur l'icône seule, pour rester discret. Les listes de textes ne
   * le demandent pas. En mouvement réduit, l'icône est simplement là.
   */
  import { phraseDuStatutEnBref } from "$lib/api-publique";
  import Icone from "$lib/components/Icone.svelte";
  import { tr } from "$lib/stores/language";
  import type { StatutEnBref } from "$lib/types";

  export let statut: StatutEnBref | null | undefined;
  /** L'icône se pose d'un coup de tampon (première apparition seulement). */
  export let animer = false;
  /** Délai du tampon, en millisecondes (src/lib/components/listes/arrivee.ts). */
  export let delai = 0;

  // `$tr` dans le bloc : la phrase se refait au changement de langue.
  $: phrase = phraseDuStatutEnBref(statut, $tr);
</script>

{#if phrase}
  <!-- La pastille de la refonte (A3 § 4, « Statut d'un texte ») : fond
       zinc-100 et texte zinc-700 (9,5:1), zinc-300 sur zinc-800 en sombre
       (10:1). Icône calée sur la première ligne : sur téléphone, la phrase
       passe parfois sur deux, d'où des coins de 12 px sous sm (une pilule
       entière y rognerait le début et la fin des deux lignes) et la pilule
       pleine au-delà, où elle tient sur une ligne. -->
  <p
    class="mt-2.5 inline-flex items-start gap-1.5 rounded-xl bg-zinc-100 py-1 pl-2 pr-2.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 sm:rounded-full"
  >
    <!-- Le tampon joue sur cette enveloppe : le composant Icone ne prend
         pas de style, et le délai passe par la variable --d. -->
    <span
      class="mt-px inline-flex shrink-0 {animer ? 'mv-tamponner' : ''}"
      style={animer ? `--d: ${delai}ms` : undefined}
    >
      <Icone nom="rotate-ccw-clock" class="text-sm" />
    </span>
    <span>{phrase} · {$tr("listes.voirHistorique")}</span>
  </p>
{/if}
