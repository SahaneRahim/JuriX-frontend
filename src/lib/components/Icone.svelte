<script lang="ts">
  /**
   * Une icône du registre (src/lib/icones.ts), en SVG Lucide.
   *
   * POURQUOI. Elle a remplacé une police d'icônes, des SVG copiés à la main
   * et des émojis : une seule famille, en trait, monochrome (`currentColor`),
   * donc qui suit la couleur du texte autour, en clair comme en sombre.
   *
   * TAILLE : 1em, comme un caractère. L'icône prend la taille de texte posée
   * sur elle (`text-xl`) ou héritée de son parent ; `w-5 h-5` l'emportent
   * aussi. Pour 24 px, la taille de l'ancienne police, `class="text-2xl"`.
   *
   * Affichage et alignement viennent de la classe `icone`, dans la couche
   * `components` de src/app.css, donc AVANT les utilitaires : `hidden`,
   * `sm:hidden`, `block` ou `align-middle` posés sur l'icône l'emportent. Un
   * attribut `style` les aurait écrasés.
   *
   * ACCESSIBILITÉ. Décorative par défaut : `aria-hidden`, car le texte voisin ou
   * l'`aria-label` du bouton porte déjà le sens. Seule dans un bouton, c'est le
   * bouton qui porte l'`aria-label`, jamais l'icône. `titre` n'est utile que
   * pour une icône qui porte SEULE une information (un statut sans libellé) :
   * elle devient alors une image nommée (`role="img"` et `<title>`).
   *
   * DESSIN. Pas de {@html}, que ce dépôt s'interdit (eslint.config.js) : les
   * éléments de l'entrée du registre sont lus une fois (`elementsIcone`) puis
   * créés un à un. Placés dans le <svg>, ils naissent dans l'espace de noms
   * SVG, au rendu serveur comme à la navigation côté client (vérifié dans
   * Chromium : tracés mesurables, aucun élément HTML égaré).
   */
  import { elementsIcone, estNomIcone, type NomIcone } from "$lib/icones";

  /** Nom Lucide de l'icône, une clé de ICONES (src/lib/icones.ts). */
  export let nom: NomIcone;

  let className = "";
  /** Classes ajoutées : taille (`text-xl`, `w-5 h-5`), couleur, animation… */
  export { className as class };

  /**
   * Épaisseur du trait, en unités de la grille de 24. 1,75 et non le 2 de
   * Lucide : plus fin, plus précis, accordé au style noir et blanc du site.
   */
  export let epaisseur: number | string = 1.75;

  /** Nom accessible, pour une icône qui porte seule une information. */
  export let titre: string | undefined = undefined;

  // Un nom venu de l'exécution (donnée, paramètre) échappe au typage : l'icône
  // reste vide plutôt que de casser la page, et le développement le signale.
  $: connue = estNomIcone(nom);
  $: elements = connue ? elementsIcone(nom) : [];
  $: if (import.meta.env.DEV && !connue) {
    console.warn(`Icone : « ${String(nom)} » n'est pas dans src/lib/icones.ts`);
  }
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  width="1em"
  height="1em"
  fill="none"
  stroke="currentColor"
  stroke-width={epaisseur}
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className ? `icone ${className}` : "icone"}
  data-icone={nom}
  role={titre ? "img" : undefined}
  aria-hidden={titre ? undefined : "true"}
  focusable="false"
>
  {#if titre}<title>{titre}</title>{/if}
  {#each elements as element (element)}
    <svelte:element this={element.balise} {...element.attributs} />
  {/each}
</svg>
