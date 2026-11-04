<script lang="ts">
  /**
   * La balance de JuriX, animée : elle pèse.
   *
   * - `intro` : le logo, une fois au chargement (1,9 s, après 0,35 s) ;
   * - `attente` : l'IA pèse pendant une attente RÉELLE (recherche,
   *   comparaison, explication, réponse du chat), en boucle tant qu'elle dure ;
   * - `repos` : droite, immobile.
   *
   * POURQUOI UN COMPOSANT, ET NON <Icone nom="scale">. `Icone` rend les cinq
   * tracés à plat. Pour que le fléau pivote pendant que les plateaux
   * contre-pivotent (ils restent à l'horizontale, comme une vraie balance),
   * les tracés doivent être regroupés : le mât et la base restent fixes, le
   * fléau porte les deux plateaux (A2 § 3.1). Les tracés viennent du registre
   * (`elementsIcone('scale')`) : aucun SVG recopié à la main, et la balance
   * suit le registre s'il change de version (BalanceAnimee.test.ts vérifie la
   * répartition des tracés).
   *
   * POURQUOI RIEN NE BOUGE ICI. Le composant n'écrit que le balisage et la
   * classe d'état ; les @keyframes vivent dans src/lib/mouvement.css, sous
   * prefers-reduced-motion: no-preference. En mouvement réduit, sans
   * JavaScript ou avant l'hydratation, la balance est droite et lisible.
   *
   * ACCESSIBILITÉ. Toujours décorative (`aria-hidden`), jamais de `role` :
   * l'attente est dite par le texte d'étape de l'appelant (région
   * `role="status"` de la page ; dans le chat, la seule région d'annonce est
   * `chat-announce` : n'en ajouter aucune).
   */
  import { elementsIcone, type ElementIcone } from "$lib/icones";

  /** L'état de la balance. */
  export let etat: "repos" | "intro" | "attente" = "repos";

  let className = "";
  /** Classes ajoutées : taille (`text-xl`, `w-5 h-5`), couleur. */
  export { className as class };

  /**
   * Les cinq tracés de `scale`, dans l'ordre du registre (Lucide) : le mât,
   * le plateau droit, le fléau, le plateau gauche, la base. Un tracé
   * manquant (registre changé) laisserait la balance incomplète : le test
   * le signale.
   */
  const [mat, plateauDroit, fleau, plateauGauche, base]: readonly (ElementIcone | undefined)[] =
    elementsIcone("scale");
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  width="1em"
  height="1em"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  class="icone mv-balance mv-balance--{etat}{className ? ` ${className}` : ''}"
  data-icone="scale"
  data-etat={etat}
  aria-hidden="true"
  focusable="false"
>
  {#if mat}<svelte:element this={mat.balise} {...mat.attributs} />{/if}
  {#if base}<svelte:element this={base.balise} {...base.attributs} />{/if}
  <g class="mv-balance__fleau">
    {#if fleau}<svelte:element this={fleau.balise} {...fleau.attributs} />{/if}
    <g class="mv-balance__plateau-g">
      {#if plateauGauche}<svelte:element this={plateauGauche.balise} {...plateauGauche.attributs} />{/if}
    </g>
    <g class="mv-balance__plateau-d">
      {#if plateauDroit}<svelte:element this={plateauDroit.balise} {...plateauDroit.attributs} />{/if}
    </g>
  </g>
</svg>
