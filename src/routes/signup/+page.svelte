<script lang="ts">
  /**
   * Inscription publique.
   *
   * Syntaxe Svelte 4 (`export let`, `on:`, `$:`) : celle de tout le projet.
   *
   * Le corps envoyé porte EXACTEMENT `full_name`, `email`, `password`. Le
   * serveur écrit `role: "user"` lui-même, et son schéma refuse toute clé
   * inconnue : envoyer `role` ici produirait un 422, pas une escalade.
   */
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { API_URL } from "$lib/api";
  import BoutonGoogle from "$lib/components/BoutonGoogle.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { authStore } from "$lib/stores/auth";
  import { tr } from "$lib/stores/language";
  import "../../app.css";

  let fullName = "";
  let email = "";
  let password = "";
  let error = "";
  let loading = false;

  onMount(() => {
    if ($authStore.isAuthenticated) goto("/", { replaceState: true });
  });

  /** Session ouverte, puis retour à l'accueil. */
  async function ouvrirLaSession(donnees: {
    id: number;
    email: string;
    role: "user" | "admin" | "superadmin";
    full_name?: string | null;
    username?: string;
    access_token: string;
  }) {
    authStore.login(
      {
        id: donnees.id,
        email: donnees.email,
        role: donnees.role,
        name: donnees.full_name || donnees.username,
      },
      donnees.access_token,
    );
    await goto("/", { replaceState: true });
  }

  async function handleSubmit() {
    error = "";
    loading = true;
    try {
      const reponse = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Trois champs, et rien d'autre.
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
        }),
      });

      if (reponse.ok) {
        await ouvrirLaSession(await reponse.json());
        return;
      }
      if (reponse.status === 409) error = $tr("signup.errorEmailTaken");
      else if (reponse.status === 422) error = $tr("signup.errorInvalid");
      else error = $tr("signup.errorGeneric");
    } catch {
      // Distinguer « données refusées » de « serveur injoignable » évite de
      // faire corriger un formulaire qui n'a rien d'invalide.
      error = $tr("login.errorNetwork");
    } finally {
      loading = false;
    }
  }

  async function connexionGoogle(evenement: CustomEvent<string>) {
    error = "";
    loading = true;
    try {
      const reponse = await fetch(`${API_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: evenement.detail }),
      });
      if (reponse.ok) {
        await ouvrirLaSession(await reponse.json());
        return;
      }
      error =
        reponse.status === 503
          ? $tr("auth.googleUnavailable")
          : $tr("auth.googleError");
    } catch {
      error = $tr("login.errorNetwork");
    } finally {
      loading = false;
    }
  }
</script>

<!-- Hors index : une page d'inscription n'apporte rien à une recherche. -->
<MetaSeo titre={$tr("signup.title")} indexable={false} />

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
        {$tr("signup.title")}
      </h1>
      <p class="mb-8 text-center text-sm text-slate-500 dark:text-slate-400">
        {$tr("signup.subtitle")}
      </p>

      <form on:submit|preventDefault={handleSubmit} class="space-y-5" novalidate>
        <div>
          <label
            for="signup-name"
            class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {$tr("signup.name")}
          </label>
          <input
            id="signup-name"
            data-testid="signup-name"
            bind:value={fullName}
            required
            minlength="2"
            maxlength="255"
            autocomplete="name"
            placeholder={$tr("signup.namePlaceholder")}
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label
            for="signup-email"
            class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {$tr("signup.email")}
          </label>
          <input
            id="signup-email"
            data-testid="signup-email"
            type="email"
            bind:value={email}
            required
            autocomplete="email"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label
            for="signup-password"
            class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {$tr("signup.password")}
          </label>
          <input
            id="signup-password"
            data-testid="signup-password"
            type="password"
            bind:value={password}
            required
            minlength="8"
            autocomplete="new-password"
            aria-describedby="signup-password-hint"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          <!-- La règle est annoncée AVANT l'envoi : le serveur répond 422 sur
               un mot de passe faible, autant ne pas le faire découvrir. -->
          <p
            id="signup-password-hint"
            class="mt-1 text-xs text-slate-500 dark:text-slate-400"
          >
            {$tr("signup.passwordHint")}
          </p>
        </div>

        {#if error}
          <p
            role="alert"
            data-testid="signup-error"
            class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
          >
            {error}
          </p>
        {/if}

        <button
          type="submit"
          disabled={loading}
          data-testid="signup-submit"
          class="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? $tr("signup.submitting") : $tr("signup.submit")}
        </button>
      </form>

      <div class="mt-6">
        <BoutonGoogle on:credential={connexionGoogle} />
      </div>

      <p class="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
        {$tr("signup.haveAccount")}
        <a href="/login" class="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >{$tr("login.submit")}</a
        >
      </p>
    </div>
  </div>
</main>
