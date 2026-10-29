<script lang="ts">
  /**
   * L'attente d'une réponse, en texte (P4, maquette chat-attente-p4a) :
   * « Recherche dans les textes… », puis « 6 articles trouvés : Code du
   * travail, … », puis « Rédaction de la réponse… ». Les étapes passées
   * portent une coche, l'étape en cours le seul indicateur animé (guide
   * § 4.12), figé quand le système demande moins de mouvement.
   *
   * Trois points qui sautaient ne disaient rien pendant les dix secondes
   * d'une réponse, ni de ce qui se passait ni de ce qui allait venir. Sans
   * étape du serveur (ancienne API, salutation), une seule ligne,
   * « Préparation de la réponse… », vraie dans tous les cas.
   *
   * Rien n'est annoncé d'ici : la page porte une seule région d'annonce, hors
   * du fil (aria-busy) ; cette liste reste lisible en parcourant le fil.
   */
  import Icone from "$lib/components/Icone.svelte";
  import { tr } from "$lib/stores/language";

  /** Les étapes reçues, dans l'ordre ; la dernière est en cours. */
  export let etapes: { libelle: string; faite: boolean }[];

  $: t = $tr;
</script>

<!-- Même avatar (masqué sous sm, comme celui des réponses) et même bulle que
     les réponses : la réponse prendra sa place, au même endroit. -->
<div class="flex gap-2 sm:gap-4" data-testid="chat-progress">
  <div
    class="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 sm:flex sm:h-10 sm:w-10"
  >
    <Icone nom="bot" class="text-base sm:text-lg" />
  </div>
  <div class="min-w-0 flex-1">
    <div
      class="rounded-2xl rounded-tl-sm border border-zinc-200 bg-white px-4 py-2.5 text-left dark:border-zinc-800 dark:bg-zinc-900 sm:px-5 sm:py-3"
    >
      <ol class="space-y-2 text-sm">
        {#each etapes as etape, i (i)}
          <!-- Étape faite en zinc-600 (7,7:1 sur blanc), en cours en noir et
               demi-gras : la différence ne tient pas à la seule couleur. -->
          <li
            class="flex items-start gap-2 {etape.faite
              ? 'text-zinc-600 dark:text-zinc-400'
              : 'font-medium text-zinc-950 dark:text-white'}"
          >
            <Icone
              nom={etape.faite ? "check" : "loader-circle"}
              class="mt-0.5 shrink-0 text-base {etape.faite ? 'text-zinc-950 dark:text-white' : 'motion-safe:animate-spin'}"
            />
            <!-- Le suffixe en expression : Svelte 5 retire les blancs du bord
                 d'une balise, et l'on entendait « textes…(terminé) ». -->
            <span class="coupe-mots min-w-0"
              >{etape.libelle}{#if etape.faite}<span class="sr-only">{` (${t("chat.progress.doneSr")})`}</span>{/if}</span
            >
          </li>
        {/each}
      </ol>
    </div>
  </div>
</div>
