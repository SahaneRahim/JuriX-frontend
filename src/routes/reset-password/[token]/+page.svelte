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
  import MetaSeo from "$lib/components/MetaSeo.svelte";
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

  onMount(() => {
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

<SiteHeader />

<main id="contenu">
  <div
    class="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-50 px-4 py-10 font-sans dark:bg-slate-900"
  >
    <div
      class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <h1
        class="mb-2 flex items-center justify-center gap-2 text-xl font-bold text-slate-900 dark:text-white"
      >
        <span class="text-3xl" aria-hidden="true">&#9878;</span>
        {$tr("reset.title")}
      </h1>
      <p class="mb-8 text-center text-sm text-slate-500 dark:text-slate-400">
        {$tr("reset.subtitle")}
      </p>

      {#if succes}
        <!-- Le formulaire disparaît : le jeton est consommé, le renvoyer
             donnerait un 400 sans rien apporter. -->
        <p
          role="status"
          data-testid="reset-success"
          class="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300"
        >
          {$tr("reset.success")}
        </p>
        <p class="mt-6 text-center text-sm">
          <a
            href="/login"
            data-testid="reset-to-login"
            class="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >{$tr("login.submit")}</a
          >
        </p>
      {:else if lienExpire}
        <!-- ÉTAT TERMINAL. Le jeton est refusé : réafficher le formulaire
             inviterait à recliquer « Changer mon mot de passe », ce qui ne peut
             produire qu'un second refus. La seule issue utile est d'en
             redemander un. Même parti que la page de vérification d'adresse. -->
        <p
          role="alert"
          data-testid="reset-error"
          class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
        >
          {error}
        </p>
        <!-- Les sorties sont HORS du conteneur `role="alert"` : une région live
             est annoncée comme un bloc de texte, et certaines technologies
             d'assistance n'y exposent pas les liens qu'elle contient. Placées
             après, elles restent atteignables et annoncées normalement. -->
        <a
          href="/forgot-password"
          data-testid="reset-ask-new-link"
          class="mt-6 inline-block w-full rounded-lg bg-blue-600 px-4 py-2 text-center font-medium text-white transition-colors hover:bg-blue-700"
        >
          {$tr("reset.askNewLink")}
        </a>
        <p class="mt-4 text-center text-xs">
          <a
            href="/login"
            data-testid="reset-to-login"
            class="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >{$tr("login.submit")}</a
          >
        </p>
      {:else}
        <form on:submit|preventDefault={handleSubmit} class="space-y-5" novalidate>
          <div>
            <label
              for="reset-password"
              class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {$tr("reset.password")}
            </label>
            <input
              id="reset-password"
              data-testid="reset-password"
              type="password"
              bind:value={motDePasse}
              required
              minlength="8"
              autocomplete="new-password"
              aria-describedby="reset-password-hint"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <!-- La règle est annoncée AVANT l'envoi : le serveur répond 422 sur
                 un mot de passe faible, autant ne pas le faire découvrir. -->
            <p
              id="reset-password-hint"
              class="mt-1 text-xs text-slate-500 dark:text-slate-400"
            >
              {$tr("signup.passwordHint")}
            </p>
          </div>

          <div>
            <label
              for="reset-confirm"
              class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {$tr("reset.confirm")}
            </label>
            <input
              id="reset-confirm"
              data-testid="reset-confirm"
              type="password"
              bind:value={confirmation}
              required
              minlength="8"
              autocomplete="new-password"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {#if error}
            <!-- Erreurs RÉCUPÉRABLES seulement : discordance des deux champs,
                 mot de passe trop faible, serveur injoignable. Le formulaire
                 reste donc monté, et réessayer a un sens. -->
            <p
              role="alert"
              data-testid="reset-error"
              class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
            >
              {error}
            </p>
          {/if}

          <button
            type="submit"
            disabled={loading}
            data-testid="reset-submit"
            class="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? $tr("reset.submitting") : $tr("reset.submit")}
          </button>
        </form>

        <!-- Sortie permanente, même sans erreur. -->
        <p class="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          <a
            href="/login"
            data-testid="reset-to-login"
            class="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >{$tr("login.submit")}</a
          >
        </p>
      {/if}
    </div>
  </div>
</main>
