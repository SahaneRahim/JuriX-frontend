<script lang="ts">
  // Syntaxe Svelte 4 (export let / on: / $:) : c'est celle de tout le projet,
  // qui n'utilise aucune rune. Svelte 5 la supporte en mode legacy.
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { API_URL } from "$lib/api";
  import { authStore } from "$lib/stores/auth";
  import "../../app.css";

  let email = "";
  let password = "";
  let error = "";
  let loading = false;

  // Redirection post-connexion, transmise par la garde du layout admin.
  $: next = $page.url.searchParams.get("next") || "/admin";

  onMount(() => {
    // Déjà connecté : inutile de repasser par le formulaire.
    if ($authStore.isAuthenticated) goto(next, { replaceState: true });
  });

  async function handleSubmit() {
    error = "";
    loading = true;
    try {
      const response = await fetch(`${API_URL}/auth/login/json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        authStore.login(
          {
            id: data.id,
            email: data.email,
            role: data.role,
            name: data.full_name || data.username,
          },
          data.access_token,
        );
        await goto(next, { replaceState: true });
        return;
      }

      if (response.status === 401) {
        error = "Identifiants invalides.";
      } else if (response.status === 403) {
        error = "Ce compte est désactivé.";
      } else {
        error = "Connexion impossible. Réessayez dans un instant.";
      }
    } catch (e) {
      // Distinguer « mauvais identifiants » de « serveur injoignable » évite de
      // faire chercher un mot de passe quand c'est le backend qui est éteint.
      error = "Impossible de joindre le serveur.";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Connexion — JuriX Admin</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 font-sans">
  <div class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
    <div class="mb-8 flex items-center justify-center gap-2 font-bold text-slate-900">
      <span class="text-3xl">⚖️</span>
      <span class="text-xl">JuriX Admin</span>
    </div>

    <form on:submit|preventDefault={handleSubmit} class="space-y-5">
      <div>
        <label for="email" class="mb-1 block text-sm font-medium text-slate-700">
          Adresse email
        </label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          autocomplete="username"
          placeholder="admin@jurix.cm"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label for="password" class="mb-1 block text-sm font-medium text-slate-700">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          autocomplete="current-password"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {#if error}
        <p role="alert" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      {/if}

      <button
        type="submit"
        disabled={loading}
        class="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Connexion…" : "Se connecter"}
      </button>
    </form>

    <p class="mt-6 text-center text-xs text-slate-500">
      Les comptes sont créés par un administrateur.
    </p>
  </div>
</div>
