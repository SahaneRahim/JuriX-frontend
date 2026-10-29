<script lang="ts">
  /**
   * Le nom d'un texte nommé par le relevé des liens (« la loi n° 2008/001 du
   * 14 avril 2008 ») : un lien vers sa page s'il est publié dans JuriX, son
   * intitulé officiel en infobulle. Le déterminant reste hors du lien, comme
   * sur les maquettes P1 (« par la loi n° … »).
   *
   * Écrit sur une ligne : un retour à la ligne entre le déterminant et le
   * lien deviendrait une espace (« l’ ordonnance »).
   */
  import { language, tr } from "$lib/stores/language";
  import type { TexteLie } from "$lib/types";
  import { capitaliser, lienDuTexteLie, nomDuTexteLie } from "./statut";
  import { LIEN_DANS_LE_TEXTE } from "./typographie";

  export let texte: TexteLie;
  /** Faux en tête d'une ligne d'historique : « Loi n° … », sans « la ». */
  export let avecDeterminant = true;

  $: nom = nomDuTexteLie(texte, $language.current, $tr);
  $: lien = lienDuTexteLie(texte);
  $: debut = avecDeterminant ? `${nom.determinant}${nom.avant}` : capitaliser(nom.avant);
  $: libelle = avecDeterminant || nom.avant ? nom.nom : capitaliser(nom.nom);
</script>

{debut}{#if lien}<a href={lien} class={LIEN_DANS_LE_TEXTE} title={texte.titre}>{libelle}</a>{:else}<span class="font-medium text-zinc-950 dark:text-white" title={texte.titre}>{libelle}</span>{/if}{nom.apres}
