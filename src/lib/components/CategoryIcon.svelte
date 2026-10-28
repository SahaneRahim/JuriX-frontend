<script lang="ts">
  /**
   * Icône d'un des 14 domaines juridiques du corpus.
   *
   * POURQUOI. Elle dessinait ses propres SVG, des approximations à la main ; les
   * icônes viennent maintenant de Lucide, comme le reste du site (composant
   * Icone), et le choix se fait dans `iconeCategorie` (src/lib/categories.ts) :
   * une table de mots ordonnée, insensible aux accents et à la casse, qui
   * reconnaît le nom français de l'API comme sa traduction anglaise.
   *
   * Taille par défaut inchangée (24 px) ; `class` la remplace (`w-5 h-5`).
   */
  import Icone from "$lib/components/Icone.svelte";
  import { iconeCategorie } from "$lib/categories";

  /** Nom de la catégorie : en français, tel que le sert l'API. */
  export let category: string = "";

  let className: string = "w-6 h-6";
  export { className as class };

  $: nom = iconeCategorie(category);
</script>

<Icone {nom} class={className} />
