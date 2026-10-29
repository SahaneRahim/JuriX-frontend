<script lang="ts">
  /**
   * « Partager » (P2) : la feuille de partage du système quand le navigateur
   * l'a (Android, iOS, Windows, macOS), sinon un lien WhatsApp avec le
   * message prêt. Au Cameroun, WhatsApp a remplacé le SMS ; l'ancien bouton
   * copiait l'adresse, qu'il fallait ensuite coller dans l'application.
   *
   * UN LIEN, ET NON UN BOUTON : sans JavaScript, ou sans partage natif
   * (Firefox de bureau, Linux), il mène à WhatsApp ; avec, le clic est
   * intercepté. Un clic du milieu ou avec Ctrl garde le lien. L'adresse
   * partagée ne porte jamais la cote interne.
   */
  import { createEventDispatcher } from "svelte";
  import Icone from "$lib/components/Icone.svelte";
  import { lienWhatsApp } from "./reference";
  import { partageNatifPossible, partagerNativement, type Partage } from "./presse-papiers";
  import { BOUTON_SECONDAIRE } from "./typographie";

  export let partage: Partage;
  /** Nom accessible complet (« Partager l'article 6 ») : deux « Partager » sur la page. */
  export let etiquette: string;
  /** Classes en plus du bouton secondaire (largeur, marges). */
  export let classe = "";
  export let testid: string | undefined = undefined;

  const dispatch = createEventDispatcher<{ echec: null }>();

  function partager(event: MouseEvent) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!partageNatifPossible(partage)) return;
    event.preventDefault();
    // Appelé dans le geste du lecteur, comme l'exige le navigateur.
    void partagerNativement(partage).then((resultat) => {
      if (resultat === "echec") dispatch("echec", null);
    });
  }
</script>

<a
  href={lienWhatsApp(partage.text, partage.url)}
  target="_blank"
  rel="noopener noreferrer"
  class="{BOUTON_SECONDAIRE} {classe}"
  aria-label={etiquette}
  data-testid={testid}
  on:click={partager}
>
  <Icone nom="share-2" class="h-5 w-5 shrink-0" />
  <slot />
</a>
