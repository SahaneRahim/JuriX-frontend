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
  chaque nouvelle mesure de son contenu (arrivee des polices, icones qui
  passent du mot « gavel » au pictogramme). Lighthouse comptait ce
  deplacement : 0,15 de decalage de mise en page sur chaque premiere visite.
-->
<div
  class="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/60 p-4 pt-[8vh] backdrop-blur-sm"
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
    class="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800"
  >
    <div class="flex items-start justify-between gap-4">
      <h2
        id="persona-titre"
        tabindex="-1"
        class="text-xl font-bold text-slate-900 outline-none dark:text-white"
      >
        {mode === "accueil" ? t("persona.dialogTitle") : t("persona.dialogTitleChange")}
      </h2>
      <div class="flex shrink-0 items-center gap-1">
        <!-- La langue se choisit aussi ici : l'en-tête est inerte tant que la
             question est ouverte. -->
        <button
          type="button"
          data-testid="persona-lang-fr"
          aria-label="{t('a11y.switchTo')} français"
          aria-pressed={$language.current === "fr"}
          on:click={() => switchLanguage("fr")}
          class="rounded-md px-2 py-1 text-xs font-bold {$language.current === 'fr'
            ? 'bg-blue-50 text-blue-700 dark:bg-white/10 dark:text-blue-300'
            : 'text-slate-600 dark:text-slate-300'}">FR</button
        >
        <button
          type="button"
          data-testid="persona-lang-en"
          aria-label="{t('a11y.switchTo')} English"
          aria-pressed={$language.current === "en"}
          on:click={() => switchLanguage("en")}
          class="rounded-md px-2 py-1 text-xs font-bold {$language.current === 'en'
            ? 'bg-blue-50 text-blue-700 dark:bg-white/10 dark:text-blue-300'
            : 'text-slate-600 dark:text-slate-300'}">EN</button
        >
        {#if mode === "changement"}
          <button
            type="button"
            data-testid="persona-dialog-close"
            aria-label={t("common.close")}
            on:click={fermerChoixPersona}
            class="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <span class="material-icons text-lg" aria-hidden="true">close</span>
          </button>
        {/if}
      </div>
    </div>

    <p id="persona-intro" class="mt-2 text-sm text-slate-600 dark:text-slate-300">
      {t("persona.dialogIntro")}
    </p>

    <div class="mt-5 grid gap-3 sm:grid-cols-2">
      {#each PERSONAS as persona (persona)}
        <button
          type="button"
          data-testid="persona-choice-{PERSONA_SLUG[persona]}"
          aria-current={mode === "changement" && actuel === persona ? "true" : undefined}
          on:click={() => choisir(persona)}
          class="flex items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-700 {mode ===
            'changement' && actuel === persona
            ? 'border-blue-500 bg-blue-50 dark:bg-slate-700'
            : 'border-slate-200 dark:border-slate-600'}"
        >
          <!-- Taille fixe : avant la police, le mot de la ligature est plus large. -->
          <span
            class="material-icons inline-block h-6 w-6 shrink-0 overflow-hidden text-2xl leading-6 text-blue-600 dark:text-blue-400"
            aria-hidden="true">{PERSONA_ICONE[persona]}</span
          >
          <span class="min-w-0">
            <span class="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              {t(`persona.${PERSONA_SLUG[persona]}.nom`)}
              {#if mode === "changement" && actuel === persona}
                <span
                  class="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                  >{t("persona.current")}</span
                >
              {/if}
            </span>
            <span class="mt-1 block text-xs text-slate-600 dark:text-slate-300">
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
      class="mt-4 w-full rounded-xl border px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700 {mode ===
        'changement' && actuel === null
        ? 'border-blue-500 bg-blue-50 dark:bg-slate-700'
        : 'border-slate-200 dark:border-slate-600'}"
    >
      {mode === "accueil"
        ? t("persona.skip")
        : $authStore.isAuthenticated
          ? t("persona.generalChoiceAccount")
          : t("persona.generalChoice")}
    </button>

    <p class="mt-3 text-xs text-slate-600 dark:text-slate-400">{t("persona.dialogNotice")}</p>
  </div>
</div>
