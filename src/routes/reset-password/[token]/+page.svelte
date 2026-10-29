<script lang="ts">
  /**
   * Choix d'un nouveau mot de passe, depuis le lien reçu par courriel.
   *
   * Syntaxe Svelte 4 (`export let`, `on:`, `$:`) : celle de tout le projet.
   *
   * Le jeton est une capacité : quiconque le lit peut changer le mot de passe
   * du compte. Il voyage donc dans le chemin de l'URL, l'endroit le plus
   * bavard qui soit — d'où les deux mesures ci-dessous (méta `referrer` et
   * réécriture de l'historique), et le fait qu'il n'est JAMAIS affiché.
   *
   * Le corps envoyé porte EXACTEMENT `token` et `password` : le schéma du
   * serveur refuse toute clé inconnue.
   */
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { API_URL } from "$lib/api";
  import ChampMotDePasse from "$lib/components/ChampMotDePasse.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { tr } from "$lib/stores/language";
  import "../../../app.css";

  let motDePasse = "";
  let confirmation = "";
  let error = "";
  let succes = false;
  let loading = false;
  // Vrai après un 400 : le lien est mort, il faut en proposer un autre.
  let lienExpire = false;

  // Le jeton vient du segment dynamique de la route.
  $: jeton = $page.params.token ?? "";

  // Copie conservée pour l'envoi : après la réécriture de l'historique,
  // l'URL ne porte plus le segment, seule cette variable garde le jeton.
  let jetonEnvoye = "";

  // Envoi inactif jusqu'au montage : voir login/+page.svelte.
  let monte = false;

  onMount(() => {
    monte = true;
    jetonEnvoye = jeton;
    // Le jeton disparaît de la barre d'adresse et de l'historique du
    // navigateur : une capture d'écran, un partage d'écran ou un collègue
    // regardant l'onglet ne suffisent plus à reprendre le compte.
    // Lecture AVANT réécriture, sinon le jeton serait perdu.
    // API NATIVE, ET NON `replaceState` de $app/navigation — MESURE, PAS CHOIX
    // DE STYLE. La version de SvelteKit se termine par `root.$set(...)`, or
    // `root` n'est affecte qu'APRES le montage du composant racine : appelee
    // depuis `onMount`, elle leve. L'exception partait alors avant le `fetch`,
    // et la page restait indefiniment sur « verification en cours » — les
    // quatre tests de bout en bout de cette page l'ont attrape.
    //
    // La contrepartie connue : l'etat interne du routeur est ecrase, donc un
    // retour arriere provoque un rechargement complet de cette URL. C'est
    // pourquoi `/reset-password` et `/verify-email` ont chacune une page
    // d'atterrissage — sans elles, ce rechargement tombait sur une 404.
    //
    // Enveloppee : retirer le jeton de la barre d'adresse est une precaution,
    // et une precaution ne doit jamais pouvoir casser la fonction elle-meme.
    try {
      history.replaceState({}, "", "/reset-password");
    } catch {
      // Navigateur qui refuse la reecriture : sans consequence ici.
    }
  });

  /**
   * Politique du serveur, vérifiée ici pour ne pas la faire découvrir par un
   * 422 : 8 caractères minimum, une majuscule, une minuscule, un chiffre.
   */
  function motDePasseConforme(valeur: string): boolean {
    return (
      valeur.length >= 8 &&
      /[a-z]/.test(valeur) &&
      /[A-Z]/.test(valeur) &&
      /[0-9]/.test(valeur)
    );
  }

  async function handleSubmit() {
    error = "";
    lienExpire = false;

    // Validation CLIENT d'abord : deux champs discordants ne valent pas un
    // aller-retour réseau, et surtout pas une tentative consommant le jeton.
    if (motDePasse !== confirmation) {
      error = $tr("reset.mismatch");
      return;
    }
    if (!motDePasseConforme(motDePasse)) {
      error = $tr("signup.errorInvalid");
      return;
    }

    loading = true;
    try {
      const reponse = await fetch(`${API_URL}/auth/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Deux champs, et rien d'autre.
        body: JSON.stringify({ token: jetonEnvoye, password: motDePasse }),
      });

      if (reponse.ok) {
        succes = true;
        // Le mot de passe n'a plus à rester en mémoire dans la page.
        motDePasse = "";
        confirmation = "";
        return;
      }

      if (reponse.status === 400) {
        // Jeton inconnu, déjà utilisé ou expiré : la seule issue utile est
        // d'en redemander un, pas de réessayer le même.
        error = $tr("reset.errorToken");
        lienExpire = true;
      } else if (reponse.status === 422) {
        error = $tr("signup.errorInvalid");
      } else {
        error = $tr("reset.errorGeneric");
      }
    } catch {
      // Distinguer « lien refusé » de « serveur injoignable » évite de faire
      // redemander un courriel alors que le lien en main est encore bon.
      error = $tr("login.errorNetwork");
    } finally {
      loading = false;
    }
  }
</script>

<!-- Le chemin de l'URL porte le jeton et la page charge des polices tierces :
     sans cette méta, l'en-tête Referer l'enverrait à chaque domaine externe. -->
<svelte:head>
  <meta name="referrer" content="no-referrer" />
</svelte:head>

<!-- Hors index : une page à usage unique, atteinte par courriel, n'a rien à
     faire dans un moteur de recherche. -->
<MetaSeo titre={$tr("reset.title")} indexable={false} />

<!-- Même coquille que login/+page.svelte : colonne de la hauteur de l'écran
     visible, cibles de 44 px à toutes les tailles, champs en 16 px sous un
     pointeur tactile, tuile douce à l'icône de la tâche, règles d'écran
     court, pied du site. Sous sm, la carte n'est ancrée en haut que tant que
     le formulaire est affiché (le clavier : voir login/+page.svelte) ; le
     succès et le lien refusé n'ont plus de champ, la carte y est centrée,
     comme sur /forgot-password une fois la demande envoyée.

     Écran court : 12 px entre les champs, et carte élargie à max-w-lg à
     partir de sm, comme sur signup/+page.svelte (deux champs, l'aide et
     20 px d'écart mettaient le bouton d'envoi à 330-374 px, hors d'un écran
     de 360 ; calculé en 740x360, il finit à 358). La carte élargie garde
     l'aide sur une ligne en anglais. -->
<div class="flex min-h-app flex-col">
<SiteHeader />

<main id="contenu" class="flex flex-1 flex-col">
  <!-- À partir de sm, la carte est ancrée à 12 % de la hauteur de l'écran
       (`sm:pt-[12vh]`), la même ancre que les autres pages de compte :
       centrée selon sa propre hauteur, la tuile et le titre sautaient d'une
       page sœur à l'autre. De lg à xl, autant sous elle (`lg:pb-[12vh]`) : le
       pied empilé sous un écran bas la faisait paraître posée sur lui ; 40 px
       ailleurs (voir login/+page.svelte). Le dernier lien garde sa cible de
       44 px (`py-3`), son paragraphe rend la marge qu'elle ajoutait sous lui
       (`-mb-3`) : la carte paraissait lestée vers le bas. -->
  <div
    class="flex flex-1 justify-center bg-background-light px-4 py-6 font-sans dark:bg-background-dark sm:pb-10 sm:pt-[12vh] lg:pb-[12vh] xl:pb-10 court:items-start court:py-3 {succes || lienExpire
      ? 'items-center sm:items-start'
      : 'items-start'}"
  >
    <div
      class="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:p-8 court:p-4 sm:court:max-w-lg"
    >
      <h1
        class="mb-2 flex items-center justify-center gap-2 text-xl font-titre font-semibold text-zinc-950 dark:text-white sm:text-2xl court:mb-4 court:text-xl"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/70 bg-zinc-100 text-zinc-800 dark:border-zinc-700/60 dark:bg-zinc-800 dark:text-zinc-200 court:hidden"
        >
          <Icone nom="key-round" class="text-lg" />
        </span>
        {$tr("reset.title")}
      </h1>

      <!-- La consigne « Choisissez un mot de passe » n'accompagne que le
           formulaire : au-dessus d'un succès ou d'un lien refusé, elle disait
           le contraire de l'écran. -->
      {#if succes}
        <!-- Le formulaire disparaît : le jeton est consommé, le renvoyer
             donnerait un 400 sans rien apporter. En sombre, les couleurs d'un
             bloc DANS une carte (guide § 4.1) : celles de l'alerte posée sur
             la page (zinc-900, filet zinc-800) sont celles de la carte, et
             l'encadré s'y fondait (voir forgot-password/+page.svelte). -->
        <p
          role="status"
          data-testid="reset-success"
          class="mt-6 flex gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-700/60 dark:bg-zinc-800/50 dark:text-zinc-300"
        >
          <Icone nom="circle-check" class="mt-0.5 text-base text-zinc-950 dark:text-white" />
          <span>{$tr("reset.success")}</span>
        </p>
        <!-- La suite logique, en bouton principal et non en lien de texte :
             le mot de passe vient de changer, il ne reste qu'à s'en servir. -->
        <a
          href="/login"
          data-testid="reset-to-login"
          class="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200"
        >
          {$tr("login.submit")}
        </a>
      {:else if lienExpire}
        <!-- ÉTAT TERMINAL. Le jeton est refusé : réafficher le formulaire
             inviterait à recliquer « Changer mon mot de passe », ce qui ne peut
             produire qu'un second refus. La seule issue utile est d'en
             redemander un. Même parti que la page de vérification d'adresse. -->
        <p
          role="alert"
          data-testid="reset-error"
          class="mt-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <Icone nom="circle-alert" class="mt-0.5 text-base" />
          <span>{error}</span>
        </p>
        <!-- Les sorties sont HORS du conteneur `role="alert"` : une région live
             est annoncée comme un bloc de texte, et certaines technologies
             d'assistance n'y exposent pas les liens qu'elle contient. Placées
             après, elles restent atteignables et annoncées normalement. -->
        <a
          href="/forgot-password"
          data-testid="reset-ask-new-link"
          class="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200"
        >
          {$tr("reset.askNewLink")}
        </a>
        <p class="-mb-3 mt-3 text-center text-sm">
          <a
            href="/login"
            data-testid="reset-to-login"
            class="inline-block py-3 font-semibold text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white"
            >{$tr("login.submit")}</a
          >
        </p>
      {:else}
        <p class="mb-6 text-balance text-center text-sm text-zinc-500 dark:text-zinc-400 sm:mb-8 court:sr-only">
          {$tr("reset.subtitle")}
        </p>
        <form on:submit|preventDefault={handleSubmit} class="space-y-5 court:space-y-3" novalidate>
          <div>
            <label
              for="reset-password"
              class="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              {$tr("reset.password")}
            </label>
            <ChampMotDePasse
              id="reset-password"
              data-testid="reset-password"
              bind:value={motDePasse}
              required
              minlength="8"
              autocomplete="new-password"
              aria-describedby="reset-password-hint"
              class="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-950 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm"
            />
            <!-- La règle est annoncée AVANT l'envoi : le serveur répond 422 sur
                 un mot de passe faible, autant ne pas le faire découvrir. -->
            <p
              id="reset-password-hint"
              class="mt-1 text-pretty text-xs text-zinc-500 dark:text-zinc-400"
            >
              {$tr("signup.passwordHint")}
            </p>
          </div>

          <div>
            <label
              for="reset-confirm"
              class="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              {$tr("reset.confirm")}
            </label>
            <ChampMotDePasse
              id="reset-confirm"
              data-testid="reset-confirm"
              bind:value={confirmation}
              required
              minlength="8"
              autocomplete="new-password"
              class="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-950 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm"
            />
          </div>

          {#if error}
            <!-- Erreurs RÉCUPÉRABLES seulement : discordance des deux champs,
                 mot de passe trop faible, serveur injoignable. Le formulaire
                 reste donc monté, et réessayer a un sens. -->
            <p
              role="alert"
              data-testid="reset-error"
              class="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              <Icone nom="circle-alert" class="mt-0.5 text-base" />
              <span>{error}</span>
            </p>
          {/if}

          <button
            type="submit"
            disabled={loading || !monte}
            data-testid="reset-submit"
            class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200"
          >
            {loading ? $tr("reset.submitting") : $tr("reset.submit")}
          </button>
        </form>

        <!-- Sortie permanente, même sans erreur. -->
        <p class="-mb-3 mt-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <a
            href="/login"
            data-testid="reset-to-login"
            class="inline-block py-3 font-semibold text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white"
            >{$tr("login.submit")}</a
          >
        </p>
      {/if}
    </div>
  </div>
</main>

<SiteFooter />
</div>
