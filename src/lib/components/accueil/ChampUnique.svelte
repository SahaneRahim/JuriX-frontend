<script lang="ts">
  /**
   * Le champ unique de l'accueil (refonte A, E3b) : le profil, la question ou
   * la recherche, le mode « Assistant IA | Recherche » et l'envoi, dans une
   * carte posée sur une pile de deux cartes.
   *
   * UN VRAI FORMULAIRE GET VERS /search, QUI MARCHE SANS JAVASCRIPT (P8,
   * décision H10). Sans script, avant l'hydratation, sur un téléphone lent ou
   * dans Opera Mini, le bouton d'envoi envoie le champ `q` à /search : il
   * s'appelle alors « Rechercher », ce qu'il fait. Monté, en mode « Assistant
   * IA », il s'appelle « Poser la question » et ouvre /chat?q=…&envoyer=1, où
   * la question part une seule fois (décision H1, page du chat) ; en mode
   * « Recherche », le formulaire GET part tel quel, et SvelteKit le traite
   * comme un lien (navigation sans rechargement). La bascule de mode est
   * dessinée sur « Assistant IA » dès le serveur : la pastille ne bouge pas
   * à l'hydratation ; seul le nom de l'envoi change.
   *
   * UNE ZONE DE TEXTE DE DEUX LIGNES (décision H12 ⚑). Avec JavaScript,
   * Entrée envoie (hors composition IME : un Entrée qui valide un mot d'un
   * clavier à suggestions ne doit pas partir) et Maj+Entrée va à la ligne.
   * Sans JavaScript, une <textarea> n'a pas d'envoi implicite : Entrée va à
   * la ligne et l'envoi passe par le bouton. Les sauts de ligne deviennent
   * des espaces avant l'envoi.
   *
   * LE CONTOUR DU CHAMP (décision X1 ⚑) : la carte reste discrète (filet
   * zinc-200, ombre douce), et la zone de saisie porte la recette des champs
   * du dépôt, une bordure zinc-500 (4,8:1 sur blanc, 3,7:1 en sombre sur
   * zinc-900) au repos, zinc-950 (zinc-200 en sombre) au focus (src/app.css).
   *
   * PREMIER <form> DE LA PAGE : `accueil.serveur.test.ts` le lit ainsi, et
   * `data-hero-recherche` le désigne au layout (main), qui retire le bouton
   * flottant de l'assistant tant qu'il est à l'écran.
   */
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import Icone from "$lib/components/Icone.svelte";
  import ExempleTape from "$lib/components/accueil/ExempleTape.svelte";
  import SelecteurDeProfil from "$lib/components/accueil/SelecteurDeProfil.svelte";
  import { language, tr } from "$lib/stores/language";
  import { personaStore } from "$lib/stores/persona";
  import { questionAffichee, suggestionsDeLAccueil } from "$lib/suggestions";

  type Mode = "assistant" | "recherche";

  /** Par défaut « Assistant IA », comme la maquette ; le choix n'est pas mémorisé. */
  let mode: Mode = "assistant";
  let valeur = "";
  let aLeFocus = false;
  let monte = false;
  let champ: HTMLTextAreaElement;
  let envoi: HTMLButtonElement;

  onMount(() => {
    monte = true;
  });

  // Le profil n'est lu qu'après le montage (voir SelecteurDeProfil.svelte) :
  // au serveur, les exemples du profil général.
  $: persona = monte ? $personaStore.persona : null;
  $: exemplesDeRecherche = [1, 2, 3, 4].map((n) => $tr(`accueil.exemples.recherche.${n}`));
  $: exemples =
    mode === "assistant"
      ? suggestionsDeLAccueil(persona, $language.current).map(questionAffichee)
      : exemplesDeRecherche;
  $: actif = !aLeFocus && valeur === "";
  $: nomDeLEnvoi =
    monte && mode === "assistant" ? $tr("accueil.champ.envoyerAssistant") : $tr("search.button");

  function changerDeMode(nouveau: Mode) {
    mode = nouveau;
  }

  /**
   * L'envoi. Une requête vide ne quitte pas la page : le champ reprend le
   * focus. Les espaces des bords et les sauts de ligne sont retirés DANS le
   * champ, avant que SvelteKit (mode « Recherche ») ne lise le formulaire,
   * dans le même événement.
   */
  function surEnvoi(event: SubmitEvent) {
    const requete = champ.value.replace(/\s+/g, " ").trim();
    if (!requete) {
      event.preventDefault();
      champ.focus();
      return;
    }
    champ.value = requete;
    valeur = requete;
    if (monte && mode === "assistant") {
      event.preventDefault();
      void goto(`/chat?q=${encodeURIComponent(requete)}&envoyer=1`);
    }
  }

  /**
   * Entrée envoie, Maj+Entrée va à la ligne. `isComposing` (et le code 229
   * de Safari) : un Entrée qui termine une composition (accents, clavier à
   * suggestions) appartient à la saisie. Le bouton d'envoi est cliqué, plutôt
   * que le formulaire soumis : même chemin que le doigt, nom compris.
   */
  function surTouche(event: KeyboardEvent) {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    envoi.click();
  }

  const BASCULE =
    "relative z-10 flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold motion-safe:transition-colors motion-safe:duration-200 sm:min-h-[34px] sm:min-w-[6.5rem] [@media(pointer:coarse)]:min-h-11";
  const BASCULE_ETEINTE = "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white";
  /*
   * POURQUOI `forced-colors:` (P6). Le mode actif se lit par l'inversion
   * (pastille zinc-950 sous un texte blanc : 18:1 contre la piste zinc-100).
   * En contraste élevé de Windows, la pastille, un fond, disparaît : le mode
   * actif y est souligné, à la couleur du texte gardée par le système.
   */
  const BASCULE_ALLUMEE =
    "text-white dark:text-zinc-950 forced-colors:underline forced-colors:decoration-2 forced-colors:underline-offset-4";
</script>

<form
  method="get"
  action="/search"
  role="search"
  data-hero-recherche
  data-testid="accueil-champ"
  on:submit={surEnvoi}
  class="w-full max-w-[47.5rem]"
>
  <!--
    La pile : deux cartes fantômes sous la carte, qui s'écartent un peu au
    focus. Elles sont des éléments, et non des pseudo-éléments de la carte :
    un ::before en z-index négatif passerait AU-DESSUS du fond de sa propre
    carte (PASSATION § 8, piège 3). Le conteneur `isolate` les garde sous
    elle sans les faire passer sous la page. Décoratives, elles arrivent en
    fondu après le champ, qui, lui, n'attend rien (LCP : A2 § 2.4).
  -->
  <div class="group/pile relative isolate">
    <span
      aria-hidden="true"
      class="mv-fondre absolute inset-0 -z-10 translate-y-[7px] scale-[0.97] rounded-3xl border border-zinc-200 bg-white opacity-[0.85] dark:border-zinc-800 dark:bg-zinc-900 sm:translate-y-[9px] sm:scale-[0.972] motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-jx group-focus-within/pile:translate-y-[10px] sm:group-focus-within/pile:translate-y-[12px]"
      style="--d: 300ms; --mv-duree: 0.8s"
    ></span>
    <span
      aria-hidden="true"
      class="mv-fondre absolute inset-0 -z-20 translate-y-[14px] scale-[0.94] rounded-3xl border border-zinc-200 bg-white opacity-[0.55] dark:border-zinc-800 dark:bg-zinc-900 sm:translate-y-[18px] sm:scale-[0.944] motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-jx group-focus-within/pile:translate-y-[20px] sm:group-focus-within/pile:translate-y-[24px]"
      style="--d: 450ms; --mv-duree: 0.8s"
    ></span>

    <div
      class="relative rounded-3xl border border-zinc-200 bg-white p-2.5 text-left shadow-feuille dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-feuille-sombre sm:p-3.5"
    >
      <SelecteurDeProfil />

      <!-- La zone de saisie et l'exemple tapé, superposé. `placeholder=" "` :
           sans texte indicatif visible, il sert seulement à savoir en CSS si
           le champ est vide (`peer-placeholder-shown`), avec ou sans
           JavaScript. 16 px au téléphone : en dessous, iOS zoome. -->
      <div class="relative mt-2 sm:mt-2.5">
        <textarea
          bind:this={champ}
          bind:value={valeur}
          name="q"
          rows="2"
          placeholder=" "
          autocomplete="off"
          enterkeyhint={monte ? (mode === "recherche" ? "search" : "send") : undefined}
          aria-label={$tr("accueil.champ.etiquette")}
          data-testid="accueil-saisie"
          on:focus={() => (aLeFocus = true)}
          on:blur={() => (aLeFocus = false)}
          on:keydown={surTouche}
          class="peer block h-[76px] w-full resize-none rounded-xl border border-zinc-500 bg-white px-2.5 py-2 text-base/[26px] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100 sm:h-[84px] sm:px-3 sm:text-xl/8"
        ></textarea>
        <ExempleTape
          {exemples}
          {actif}
          libelle={$tr("accueil.champ.exemple")}
          class="pointer-events-none absolute left-[11px] right-[11px] top-[9px] line-clamp-2 text-base/[26px] text-zinc-500 opacity-0 peer-placeholder-shown:opacity-100 peer-focus:opacity-0 dark:text-zinc-400 sm:left-[13px] sm:right-[13px] sm:text-xl/8 motion-safe:transition-opacity motion-safe:duration-150"
        />
      </div>

      <div class="mt-2 flex items-center gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-800 sm:gap-2.5">
        <!-- La mention de confidentialité (la phrase du chat) : dans la
             barre à partir de sm, sous la carte au téléphone. -->
        <p class="hidden min-w-0 flex-1 pl-1 text-xs text-zinc-600 dark:text-zinc-400 sm:block">
          {$tr("chat.welcome.privacy")}
        </p>

        <!-- Le mode : deux boutons à `aria-pressed` et une pastille qui
             glisse, en courbe commune (X2). Les deux colonnes sont égales :
             la pastille se déplace d'une largeur, par `transform` seul. Au
             téléphone, la bascule prend la largeur libre ; sous 360 px, les
             icônes s'effacent et les libellés restent. -->
        <div
          role="group"
          aria-label={$tr("accueil.champ.mode")}
          class="relative grid flex-1 grid-cols-2 rounded-xl bg-zinc-100 p-[3px] dark:bg-zinc-800 sm:flex-none"
        >
          <span
            aria-hidden="true"
            class="pointer-events-none absolute bottom-[3px] left-[3px] top-[3px] w-[calc((100%-6px)/2)] rounded-lg bg-zinc-950 dark:bg-white motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-jx {mode ===
            'recherche'
              ? 'translate-x-full'
              : ''}"
          ></span>
          <button
            type="button"
            aria-pressed={mode === "assistant"}
            data-testid="accueil-mode-assistant"
            on:click={() => changerDeMode("assistant")}
            class="{BASCULE} {mode === 'assistant' ? BASCULE_ALLUMEE : BASCULE_ETEINTE}"
          >
            <Icone nom="sparkle" class="text-[15px] max-[359px]:hidden" />
            <span class="truncate">{$tr("mode.chat")}</span>
          </button>
          <button
            type="button"
            aria-pressed={mode === "recherche"}
            data-testid="accueil-mode-recherche"
            on:click={() => changerDeMode("recherche")}
            class="{BASCULE} {mode === 'recherche' ? BASCULE_ALLUMEE : BASCULE_ETEINTE}"
          >
            <Icone nom="search" class="text-[15px] max-[359px]:hidden" />
            <span class="truncate">{$tr("mode.search")}</span>
          </button>
        </div>

        <!-- L'envoi : un carré de 44 px, la flèche monte de 2 px au survol.
             Nommé « Rechercher » au serveur, « Poser la question » une fois
             monté en mode « Assistant IA » (décision H10). -->
        <button
          bind:this={envoi}
          type="submit"
          aria-label={nomDeLEnvoi}
          data-testid="accueil-envoyer"
          class="group/envoi inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 motion-safe:transition-[background-color,transform] motion-safe:duration-150 motion-safe:ease-jx motion-safe:active:scale-[0.92]"
        >
          <Icone
            nom="arrow-up"
            class="text-xl motion-safe:transition-transform motion-safe:duration-[350ms] motion-safe:ease-jx motion-safe:group-hover/envoi:-translate-y-0.5"
          />
        </button>
      </div>
    </div>
  </div>

  <p class="mx-1 mt-5 text-xs text-zinc-600 dark:text-zinc-400 sm:hidden">{$tr("chat.welcome.privacy")}</p>
</form>
