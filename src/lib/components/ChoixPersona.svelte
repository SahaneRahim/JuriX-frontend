<script lang="ts">
  /**
   * La question « Qui êtes-vous ? », et le changement de profil.
   *
   * Deux modes :
   * - `accueil` : première visite. « Ne pas répondre » et Échap donnent le
   *   profil général pour la visite (la question reviendra à la suivante). Le
   *   clic sur le fond ne fait rien : un refus doit être voulu.
   * - `changement` : ouverte depuis l'en-tête ou le chat. Échap, la croix et
   *   le fond ferment sans rien changer.
   *
   * Un h2 et non un h1 : chaque page en a déjà exactement un. Le focus va au
   * titre à l'ouverture en accueil, pour qu'aucune carte n'ait l'air
   * présélectionnée.
   */
  import { fade } from "svelte/transition";
  import { piegerFocus } from "$lib/actions/pieger-focus";
  import Icone from "$lib/components/Icone.svelte";
  import { changerPersona, refuserPourCetteSession } from "$lib/persona-compte";
  import { authStore } from "$lib/stores/auth";
  import { language, switchLanguage, tr } from "$lib/stores/language";
  import {
    PERSONAS,
    PERSONA_ICONE,
    PERSONA_SLUG,
    fermerChoixPersona,
    personaStore,
    profilDuChoix,
    type Persona,
  } from "$lib/stores/persona";

  export let mode: "accueil" | "changement" = "accueil";

  $: t = $tr;
  $: actuel = $profilDuChoix !== undefined ? $profilDuChoix : $personaStore.persona;

  function choisir(persona: Persona) {
    fermerChoixPersona();
    void changerPersona(persona);
  }

  function sansProfil() {
    if (mode === "accueil") {
      refuserPourCetteSession();
    } else {
      fermerChoixPersona();
      void changerPersona(null);
    }
  }

  function fermer() {
    if (mode === "accueil") refuserPourCetteSession();
    else fermerChoixPersona();
  }

  // En capture, et Échap seulement : l'en-tête ferme aussi son panneau mobile
  // sur Échap. Tab et la saisie ne sont jamais interceptés.
  function surTouche(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    event.preventDefault();
    fermer();
  }

  // Le fond ne ferme que sur un clic simple, commencé ET fini sur lui. Un
  // double-clic sur le bouton d'ouverture tombait au second clic sur le fond
  // déjà affiché : la boîte s'ouvrait et se refermait. Un glisser depuis une
  // carte, relâché sur le fond, fermait aussi.
  let pressionSurLeFond = false;

  function surLeFond(event: MouseEvent) {
    const ferme = pressionSurLeFond && event.detail <= 1 && event.target === event.currentTarget;
    pressionSurLeFond = false;
    if (ferme && mode === "changement") fermerChoixPersona();
  }
</script>

<svelte:window on:keydown|capture={surTouche} />

<!--
  Ancree en haut, et non centree : centree, la boite se deplacait en entier a
  chaque nouvelle mesure de son contenu (arrivee des polices ; et, du temps
  ou les icones etaient une police, le mot « gavel » qui devenait
  pictogramme). Lighthouse comptait ce deplacement : 0,15 de decalage de mise
  en page sur chaque premiere visite.

  C'est le FOND qui defile, et non la boite : avec `pt-[8vh]` et
  `max-h-[90vh]`, unites qui ignorent la barre du navigateur mobile, le bas
  de la boite (fin de la mention, « Ne pas repondre ») restait sous cette
  barre, hors d'atteinte puisque la page derriere est bloquee. La boite garde
  sa hauteur naturelle et le fond defile si elle depasse l'ecran visible,
  telephone en paysage compris, sans dependre d'aucune unite de hauteur.
  `overscroll-contain` : le defilement ne passe pas a la page. Marges hautes
  et basses d'au moins la zone sure (encoche, barre d'accueil). `court:!pt-3`
  (telephone en paysage) : Tailwind emet la variante `court` AVANT sm, dont
  le `pt-[8vh]` l'emporterait sinon.
-->
<div
  class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto overscroll-contain bg-zinc-950/40 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:px-4 sm:pt-[8vh] court:!pt-3"
  role="presentation"
  on:pointerdown={(e) => (pressionSurLeFond = e.target === e.currentTarget)}
  on:click={surLeFond}
  in:fade={{ duration: 120 }}
>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="persona-titre"
    aria-describedby="persona-intro"
    data-testid="persona-dialog"
    data-mode={mode}
    use:piegerFocus={{ initial: mode === "accueil" ? "#persona-titre" : '[aria-current="true"]' }}
    class="mb-[max(0.75rem,env(safe-area-inset-bottom))] w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:mb-8 sm:p-6"
  >
    <div class="flex items-start justify-between gap-4">
      <h2
        id="persona-titre"
        tabindex="-1"
        class="text-xl font-bold text-zinc-950 outline-none dark:text-white"
      >
        {mode === "accueil" ? t("persona.dialogTitle") : t("persona.dialogTitleChange")}
      </h2>
      <div class="flex shrink-0 items-center gap-1">
        <!-- La langue se choisit aussi ici : l'en-tête est inerte tant que la
             question est ouverte. 44 px sur écran tactile (24 px auparavant),
             l'aspect compact d'origine à partir de lg. -->
        <button
          type="button"
          data-testid="persona-lang-fr"
          aria-label="{t('a11y.switchTo')} français"
          aria-pressed={$language.current === "fr"}
          on:click={() => switchLanguage("fr")}
          class="inline-flex h-11 min-w-11 items-center justify-center rounded-md px-2 text-xs font-bold transition-colors lg:h-auto lg:min-w-0 lg:py-1 {$language.current === 'fr'
            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white'}">FR</button
        >
        <button
          type="button"
          data-testid="persona-lang-en"
          aria-label="{t('a11y.switchTo')} English"
          aria-pressed={$language.current === "en"}
          on:click={() => switchLanguage("en")}
          class="inline-flex h-11 min-w-11 items-center justify-center rounded-md px-2 text-xs font-bold transition-colors lg:h-auto lg:min-w-0 lg:py-1 {$language.current === 'en'
            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white'}">EN</button
        >
        {#if mode === "changement"}
          <button
            type="button"
            data-testid="persona-dialog-close"
            aria-label={t("common.close")}
            on:click={fermerChoixPersona}
            class="ml-1 flex h-11 w-11 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white lg:h-8 lg:w-8"
          >
            <Icone nom="x" class="text-lg" />
          </button>
        {/if}
      </div>
    </div>

    <p id="persona-intro" class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
      {t("persona.dialogIntro")}
    </p>

    <div class="mt-5 grid gap-3 sm:grid-cols-2">
      {#each PERSONAS as persona (persona)}
        <button
          type="button"
          data-testid="persona-choice-{PERSONA_SLUG[persona]}"
          aria-current={mode === "changement" && actuel === persona ? "true" : undefined}
          on:click={() => choisir(persona)}
          class="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors sm:p-4 hover:border-zinc-950 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 dark:hover:border-zinc-400 dark:hover:bg-zinc-800/60 dark:focus-visible:ring-white dark:focus-visible:ring-offset-zinc-900 {mode ===
            'changement' && actuel === persona
            ? 'border-zinc-950 bg-zinc-100 dark:border-white dark:bg-zinc-800'
            : 'border-zinc-200 dark:border-zinc-700'}"
        >
          <Icone nom={PERSONA_ICONE[persona]} class="text-2xl text-zinc-900 dark:text-zinc-100" />
          <span class="min-w-0">
            <span class="flex items-center gap-2 font-semibold text-zinc-950 dark:text-white">
              {t(`persona.${PERSONA_SLUG[persona]}.nom`)}
              {#if mode === "changement" && actuel === persona}
                <span
                  class="rounded-full bg-zinc-950 dark:bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-white dark:text-zinc-950"
                  >{t("persona.current")}</span
                >
              {/if}
            </span>
            <span class="mt-1 block text-xs text-zinc-600 dark:text-zinc-300">
              {t(`persona.${PERSONA_SLUG[persona]}.description`)}
            </span>
          </span>
        </button>
      {/each}
    </div>

    <!-- En changement, le profil général est un choix comme les autres : il
         porte « actuel », et reçoit le focus à l'ouverture. -->
    <button
      type="button"
      data-testid="persona-skip"
      aria-current={mode === "changement" && actuel === null ? "true" : undefined}
      on:click={sansProfil}
      class="mt-4 min-h-11 w-full rounded-xl border px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/60 {mode ===
        'changement' && actuel === null
        ? 'border-zinc-950 bg-zinc-100 dark:border-white dark:bg-zinc-800'
        : 'border-zinc-200 dark:border-zinc-700'}"
    >
      {mode === "accueil"
        ? t("persona.skip")
        : $authStore.isAuthenticated
          ? t("persona.generalChoiceAccount")
          : t("persona.generalChoice")}
    </button>

    <p class="mt-3 text-xs text-zinc-600 dark:text-zinc-400">{t("persona.dialogNotice")}</p>
  </div>
</div>
