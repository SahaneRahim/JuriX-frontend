<script lang="ts">
  /**
   * Une ligne d'attente : la silhouette d'un résultat de recherche, le temps
   * qu'une NOUVELLE requête revienne (refonte A, E4c ; maquette
   * RefonteRecherche, état « chargement »).
   *
   * POURQUOI SEULEMENT POUR UNE NOUVELLE REQUÊTE (décision R7). Un onglet, une
   * case, un tri ou une page changent les résultats de la même recherche : la
   * liste reste à l'écran, atténuée, et ne « clignote » pas à chaque filtre.
   * Une autre requête, elle, rend la liste précédente sans objet : ses lignes
   * cèdent la place à ces silhouettes (src/routes/search/+page.svelte).
   *
   * DÉCORATIVE. Les barres ne disent rien : le bloc qui les porte est
   * `aria-hidden`, et c'est la ligne d'état (`role="status"`, « Recherche en
   * cours… ») qui annonce l'attente ; aucune cote, aucun texte, aucun `title`.
   * Le reflet qui glisse (`mv-squelette`, src/lib/mouvement.css) n'existe
   * qu'en mouvement permis ; en mouvement réduit, les barres sont grises et
   * immobiles. L'indicateur d'attente reste la balance du champ, seule.
   *
   * Les largeurs sont celles de la maquette : repères, titre (barre haute),
   * deux lignes d'extrait ; sans extrait, repères et titre seulement.
   */

  /** La ligne porte un extrait (deux lignes de plus). */
  export let extrait = true;

  const BARRES: { largeur: string; haute: boolean }[] = [
    { largeur: "40%", haute: false },
    { largeur: "70%", haute: true },
    { largeur: "95%", haute: false },
    { largeur: "60%", haute: false },
  ];
  const SANS_EXTRAIT: { largeur: string; haute: boolean }[] = [
    { largeur: "50%", haute: false },
    { largeur: "85%", haute: true },
  ];

  $: barres = extrait ? BARRES : SANS_EXTRAIT;
</script>

<!-- Marges de la ligne de résultat (16 px sous sm, 24 au-delà) : la
     silhouette tient la place de la ligne qui viendra. -->
<div class="grid gap-2.5 px-4 py-5 sm:px-6">
  {#each barres as barre, i (i)}
    <span
      class="mv-squelette block rounded-md {barre.haute ? 'h-[18px]' : 'h-2.5'}"
      style="width: {barre.largeur}"
    ></span>
  {/each}
</div>
