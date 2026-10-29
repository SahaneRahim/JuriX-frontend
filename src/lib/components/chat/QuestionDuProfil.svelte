<script lang="ts">
  /**
   * « Qui êtes-vous ? », posé DANS le fil, à la première question envoyée
   * sans profil (P5, variante A) : quatre boutons, et de quoi continuer sans
   * profil.
   *
   * La boîte « Qui êtes-vous ? » s'ouvrait à l'arrivée sur n'importe quelle
   * page, lien partagé compris : 678 px sur 800 couverts sur un téléphone,
   * d'autant plus tard que le réseau était lent, souvent quand la lecture
   * avait commencé. La question ne sert qu'au chat, puisque le profil change la
   * réponse : elle se pose ici, au moment où elle sert, et la question du
   * lecteur part dès qu'il a répondu.
   *
   * Une fois répondu, les boutons laissent place à la réponse choisie, et le
   * focus, s'il était sur un bouton qui disparaît, passe à cette ligne au lieu
   * de retomber au début de la page. Que la réponse vienne de ces boutons ou
   * d'ailleurs (voir `questionPosee`).
   */
  import Icone from "$lib/components/Icone.svelte";
  import { tr } from "$lib/stores/language";
  import { PERSONAS, PERSONA_ICONE, PERSONA_SLUG, type Persona } from "$lib/stores/persona";

  /** `undefined` : la question attend ; sinon le profil choisi (`null` : sans profil). */
  export let choix: Persona | null | undefined = undefined;
  /** Identifiant du message, pour des `id` uniques dans la conversation. */
  export let idMessage: number;
  export let surChoix: (persona: Persona | null) => void;

  $: t = $tr;

  let racine: HTMLElement;
  let reponse: HTMLElement | undefined;
  let rendreLeFocus = false;

  function choisir(persona: Persona | null) {
    const actif = document.activeElement;
    rendreLeFocus = !actif || actif === document.body || racine.contains(actif);
    surChoix(persona);
  }

  /**
   * La réponse peut venir d'ailleurs que de ces boutons : un profil choisi
   * dans un autre onglet, ou lu sur le compte, répond à la question sans
   * passer par `choisir` (abonnement au profil, page du chat). Le focus, que
   * l'envoi au clavier pose sur le premier profil, disparaissait alors avec
   * les boutons et retombait au début de la page.
   *
   * Noté AVANT la mise à jour du DOM, les boutons encore là : les `$:` passent
   * avant le rendu (mode legacy). Seulement s'il était dans la question : un
   * focus laissé ailleurs, ou au <body>, n'a rien perdu, et n'est pas déplacé.
   */
  let questionPosee = choix === undefined;
  $: if (questionPosee && choix !== undefined) {
    questionPosee = false;
    if (racine?.contains(document.activeElement)) rendreLeFocus = true;
  }

  $: if (choix !== undefined && rendreLeFocus && reponse) {
    rendreLeFocus = false;
    reponse.focus();
  }
</script>

<div bind:this={racine} class="flex gap-2 sm:gap-4" data-testid="chat-profile-question">
  <div class="hidden shrink-0 sm:block">
    <div
      class="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 sm:h-10 sm:w-10"
    >
      <Icone nom="bot" class="text-base sm:text-lg" />
    </div>
  </div>
  <div class="min-w-0 flex-1">
    <div
      class="rounded-2xl rounded-tl-sm border border-zinc-200 bg-white px-4 py-2.5 text-left text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 sm:px-5 sm:py-3"
    >
      <p id="question-profil-{idMessage}" class="leading-relaxed">{t("chat.profile.question")}</p>
    </div>

    {#if choix === undefined}
      <!-- À la recette des questions suggérées : même famille de boutons, qui
           s'inversent au survol et à l'appui. Deux colonnes à partir de sm. -->
      <div role="group" aria-labelledby="question-profil-{idMessage}" class="mt-3 grid gap-2 sm:grid-cols-2">
        {#each PERSONAS as persona (persona)}
          <button
            type="button"
            data-testid="chat-profile-{PERSONA_SLUG[persona]}"
            on:click={() => choisir(persona)}
            class="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 py-2 text-left text-sm font-medium leading-snug text-zinc-800 transition-colors hover:border-zinc-950 hover:bg-zinc-950 hover:text-white active:border-zinc-950 active:bg-zinc-950 active:text-white dark:border-zinc-700/60 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:border-white dark:hover:bg-white dark:hover:text-zinc-950 dark:active:border-white dark:active:bg-white dark:active:text-zinc-950"
          >
            <Icone nom={PERSONA_ICONE[persona]} class="shrink-0 text-lg" />
            <span class="min-w-0">{t(`persona.${PERSONA_SLUG[persona]}.nom`)}</span>
          </button>
        {/each}
      </div>
      <button
        type="button"
        data-testid="chat-profile-skip"
        on:click={() => choisir(null)}
        class="-ml-2 mt-1 inline-flex min-h-11 items-center px-2 text-left text-sm font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-950 dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:decoration-white"
      >
        {t("chat.profile.skip")}
      </button>
      <!-- La même mention que la boîte des profils : une profession est une
           donnée personnelle, gardée avec chaque conversation. -->
      <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("persona.dialogNotice")}</p>
    {:else}
      <p
        bind:this={reponse}
        tabindex="-1"
        data-testid="chat-profile-chosen"
        class="mt-2 text-sm text-zinc-600 outline-none dark:text-zinc-400"
      >
        {choix
          ? t("chat.profile.chosen").replace("{profil}", t(`persona.${PERSONA_SLUG[choix]}.nom`))
          : t("chat.profile.none")}
      </p>
    {/if}
  </div>
</div>
