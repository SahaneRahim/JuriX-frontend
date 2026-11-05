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
   *
   * REFONTE A (E6, étape 1 de cartes/assistant-preuves.md § 5 ; maquette
   * RefonteAssistant, A2 § 3.1 et § 4 « Étapes de la réponse »). L'IA pèse :
   * l'étape en cours porte la balance qui oscille (BalanceAnimee, `attente`)
   * à la place de la roue ; une étape finie, sa coche qui se trace
   * (`mv-dessiner`), une fois, au moment où l'étape se termine (la coche naît
   * alors, à la place de la balance). Plus de bulle : l'étiquette « JuriX »
   * (sa balance au repos, son nom) annonce les étapes. Mouvement réduit : la
   * balance reste droite et la coche est pleine (mouvement.css, tout sous
   * `no-preference`).
   *
   * POURQUOI AUCUN role="status" NI aria-live. Le texte d'étape suffit, et la
   * page en annonce déjà chaque changement par SA région (`chat-announce`,
   * `annoncer`) : une seconde région dirait tout deux fois (PASSATION § 8,
   * piège 12). La balance est décorative (aria-hidden), comme la coche.
   */
  import BalanceAnimee from "$lib/components/BalanceAnimee.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import { tr } from "$lib/stores/language";

  /** Les étapes reçues, dans l'ordre ; la dernière est en cours. */
  export let etapes: { libelle: string; faite: boolean }[];

  $: t = $tr;
</script>

<!--
  POURQUOI LA PLACE DE L'AVATAR RESTE, VIDE (à partir de sm). La réponse
  prendra la place de l'attente, au même endroit : elle garde, jusqu'à
  l'étape 6 de la refonte (seconde partie d'E6 : fil sans avatar ni bulle),
  son avatar et sa bulle bordée. Les étapes s'alignent donc sur le TEXTE de
  la réponse à venir : la colonne de l'avatar (40 px et l'écart de 16 px,
  comme les messages de l'accueil sans avatar), puis la marge intérieure de
  la bulle (16, puis 20 px). Sous sm, ni avatar ni colonne, comme la réponse.
-->
<div class="flex gap-2 sm:gap-4" data-testid="chat-progress">
  <div class="hidden h-10 w-10 shrink-0 sm:block" aria-hidden="true"></div>
  <div class="min-w-0 flex-1 px-4 text-left sm:px-5">
    <!-- L'étiquette de la maquette : la balance au repos, le nom propre
         (invariable, sans clé de traduction : A4 § 1). -->
    <p class="mb-2 flex items-center gap-2 text-[13px] font-bold leading-[18px] text-zinc-950 dark:text-white">
      <BalanceAnimee etat="repos" class="shrink-0 text-lg" />JuriX
    </p>
    <ol class="space-y-2 text-sm">
      {#each etapes as etape, i (i)}
        <!-- Étape faite en zinc-600 (7,7:1 sur blanc), en cours en noir et
             demi-gras : la différence ne tient pas à la seule couleur. -->
        <li
          class="flex items-start gap-2 {etape.faite
            ? 'text-zinc-600 dark:text-zinc-400'
            : 'font-medium text-zinc-950 dark:text-white'}"
        >
          <!-- Le pointillé de `mv-dessiner` (24 unités) couvre la coche de
               Lucide : posé sur le <svg>, il passe à son tracé (propriété
               héritée). La coche se trace en 0,45 s, la courbe commune. -->
          {#if etape.faite}
            <Icone nom="check" class="mv-dessiner mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white" />
          {:else}
            <BalanceAnimee etat="attente" class="mt-0.5 shrink-0 text-base" />
          {/if}
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
