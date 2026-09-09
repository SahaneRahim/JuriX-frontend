<script lang="ts">
  /**
   * Demande de réinitialisation du mot de passe.
   *
   * Syntaxe Svelte 4 (`export let`, `on:`, `$:`) : celle de tout le projet.
   *
   * Le serveur répond 202 dans TOUS les cas — adresse inconnue, compte
   * désactivé, étranglement, envoi réel — pour qu'on ne puisse pas se servir
   * de ce formulaire comme d'un annuaire des comptes existants. Le front tient
   * la même ligne : un seul écran de confirmation, identique quelle que soit
   * l'adresse saisie. Rien ici ne doit dépendre de la réponse, ni de ce que
   * l'utilisateur a tapé — pas même un rappel de l'adresse, qui suffirait à
   * différencier les deux rendus.
   */
  import { API_URL } from "$lib/api";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { tr } from "$lib/stores/language";
  import "../../app.css";

  let email = "";
  let error = "";
  let loading = false;
  // Bascule vers l'écran de confirmation : le formulaire disparaît alors, pour
  // qu'un second envoi ne soit pas la réaction réflexe à l'absence d'e-mail.
  let envoye = false;

  async function handleSubmit() {
    error = "";
    loading = true;
    try {
      const reponse = await fetch(`${API_URL}/auth/password/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Une seule clé : le schéma du serveur refuse toute clé inconnue.
        body: JSON.stringify({ email: email.trim() }),
      });

      // Aucune lecture du corps : la réponse ne dit rien qu'on puisse afficher
      // sans trahir l'existence du compte.
      if (reponse.ok) {
        envoye = true;
        return;
      }
      error = $tr("forgot.errorGeneric");
    } catch {
      // Distinguer « serveur injoignable » du reste évite de faire attendre un
      // e-mail que personne n'a jamais été chargé d'envoyer.
      error = $tr("login.errorNetwork");
    } finally {
      loading = false;
    }
  }
</script>

<!-- Hors index : cette page n'apporte rien à une recherche. -->
<MetaSeo titre={$tr("forgot.title")} indexable={false} />

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
        {$tr("forgot.title")}
      </h1>

      {#if envoye}
        <!-- Écran de confirmation : strictement le même texte pour une adresse
             connue et pour une adresse inconnue. -->
        <div data-testid="forgot-sent" role="status" class="mt-6">
          <h2 class="mb-2 text-center text-base font-semibold text-slate-900 dark:text-white">
            {$tr("forgot.sent")}
          </h2>
          <p class="text-center text-sm text-slate-600 dark:text-slate-300">
            {$tr("forgot.sentDetail")}
          </p>
          <!-- L'expéditeur peut porter un nom que l'utilisateur ne reconnaît
               pas : le dire ici évite d'en conclure que le service est cassé. -->
          <p class="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
            {$tr("forgot.spamHint")}
          </p>
        </div>
      {:else}
        <p class="mb-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {$tr("forgot.subtitle")}
        </p>

        <form on:submit|preventDefault={handleSubmit} class="space-y-5" novalidate>
          <div>
            <label
              for="forgot-email"
              class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {$tr("forgot.email")}
            </label>
            <input
              id="forgot-email"
              data-testid="forgot-email"
              type="email"
              bind:value={email}
              required
              autocomplete="email"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {#if error}
            <p
              role="alert"
              data-testid="forgot-error"
              class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
            >
              {error}
            </p>
          {/if}

          <button
            type="submit"
            disabled={loading}
            data-testid="forgot-submit"
            class="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? $tr("forgot.submitting") : $tr("forgot.submit")}
          </button>
        </form>
      {/if}

      <!-- Hors du {#if} : quel que soit l'état — formulaire, erreur réseau ou
           confirmation — il reste une sortie vers la connexion. -->
      <p class="mt-6 text-center text-xs">
        <a
          href="/login"
          data-testid="forgot-to-login"
          class="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >{$tr("forgot.backToLogin")}</a
        >
      </p>
    </div>
  </div>
</main>
