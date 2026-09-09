<script lang="ts">
  /**
   * Confirmation d'une adresse électronique, atteinte depuis le lien du courriel.
   *
   * Syntaxe Svelte 4 (`export let`, `on:`, `$:`) : celle de tout le projet, que
   * Svelte 5 continue d'accepter en mode legacy. Aucune rune ici.
   *
   * POURQUOI CETTE PAGE POSTE, AU LIEU QUE LE COURRIEL POINTE SUR UN GET.
   * Un lien `GET …/verify-email?token=…` n'est pas ouvert que par un humain :
   * les analyseurs de liens des messageries le suivent avant lui — Outlook Safe
   * Links, les passerelles de filtrage d'entreprise, les générateurs d'aperçu.
   * Le jeton étant à usage unique, c'est l'analyseur qui le consomme, et la
   * personne trouve « lien déjà utilisé » sur un lien qu'elle n'a jamais
   * ouvert. Le courriel pointe donc vers CETTE page, et c'est le navigateur de
   * la personne qui poste, au montage. Un analyseur qui charge la page ne
   * l'exécute pas, et le jeton survit jusqu'au vrai clic.
   */
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { API_URL } from "$lib/api";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { tr } from "$lib/stores/language";
  import "../../../app.css";

  /** Les trois écrans s'excluent : un seul est monté à la fois. */
  let etat: "encours" | "reussi" | "echoue" = "encours";
  let error = "";

  onMount(async () => {
    // Lu AVANT la réécriture de l'URL : après `replaceState`, le paramètre de
    // route a disparu de la barre d'adresse, et avec lui la seule copie du jeton.
    const token = $page.params.token;

    // Mêmes précautions que la réinitialisation de mot de passe. Le jeton quitte
    // la barre d'adresse dès qu'il est en mémoire : sinon il reste dans
    // l'historique, dans les signets, et dans tout partage d'écran ou d'onglet.
    // Il n'est affiché nulle part sur cette page, dans aucun état.
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
      history.replaceState({}, "", "/verify-email");
    } catch {
      // Navigateur qui refuse la reecriture : sans consequence ici.
    }

    if (!token) {
      etat = "echoue";
      error = $tr("verify.errorToken");
      return;
    }

    try {
      const reponse = await fetch(`${API_URL}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Le corps porte le jeton, et rien d'autre.
        body: JSON.stringify({ token }),
      });

      if (reponse.ok) {
        etat = "reussi";
        return;
      }

      // 400 = jeton refusé (expiré, déjà consommé, inconnu). Le dire ainsi évite
      // de faire attendre une réparation côté serveur qui ne viendra pas.
      etat = "echoue";
      error =
        reponse.status === 400
          ? $tr("verify.errorToken")
          : $tr("verify.errorGeneric");
    } catch {
      // Sans cette branche, une API injoignable laissait la page sur
      // « vérification en cours » indéfiniment : une attente sans fin, sans
      // explication et sans issue. Un échec réseau est un état terminal, au
      // même titre qu'un jeton refusé.
      etat = "echoue";
      error = $tr("login.errorNetwork");
    }
  });
</script>

<!-- Hors index : une page de confirmation n'a de sens que pour le porteur d'un
     jeton, et son URL ne mène nulle part sans lui. -->
<MetaSeo titre={$tr("verify.title")} indexable={false} />

<svelte:head>
  <!-- Tant que `replaceState` n'a pas eu lieu, le jeton est dans l'URL : sans
       cela, il partirait dans l'en-tête `Referer` de la moindre ressource
       tierce chargée par la page. -->
  <meta name="referrer" content="no-referrer" />
</svelte:head>

<SiteHeader />

<main id="contenu">
  <div
    class="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-50 px-4 py-10 font-sans dark:bg-slate-900"
  >
    <div
      class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <!-- Un seul titre de niveau 1, commun aux trois états : il décrit la page
           et non son issue, pour garder le même repère du début à la fin. -->
      <h1
        class="mb-6 flex items-center justify-center gap-2 text-xl font-bold text-slate-900 dark:text-white"
      >
        <span class="text-3xl" aria-hidden="true">&#9878;</span>
        {$tr("verify.title")}
      </h1>

      {#if etat === "encours"}
        <p
          role="status"
          data-testid="verify-pending"
          class="text-sm text-slate-600 dark:text-slate-300"
        >
          {$tr("verify.pending")}
        </p>
      {:else if etat === "reussi"}
        <p
          role="status"
          data-testid="verify-success"
          class="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300"
        >
          {$tr("verify.success")}
        </p>
        <a
          href="/"
          data-testid="verify-to-home"
          class="mt-6 inline-block w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
          {$tr("verify.goHome")}
        </a>
      {:else}
        <p
          role="alert"
          data-testid="verify-error"
          class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
        >
          {error}
        </p>
        <!-- Un écran d'échec sans lien serait un cul-de-sac : la confirmation a
             échoué, mais le compte existe peut-être déjà et le site reste
             accessible. Deux sorties, donc, jamais zéro. -->
        <a
          href="/login"
          data-testid="verify-to-login"
          class="mt-6 inline-block w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
          {$tr("login.submit")}
        </a>
        <p class="mt-4 text-xs">
          <a
            href="/"
            data-testid="verify-to-home"
            class="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {$tr("verify.goHome")}
          </a>
        </p>
      {/if}
    </div>
  </div>
</main>
