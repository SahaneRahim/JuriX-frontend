<script lang="ts">
  // Syntaxe Svelte 4 (export let / on: / $:) : c'est celle de tout le projet,
  // qui n'utilise aucune rune. Svelte 5 la supporte en mode legacy.
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { API_URL } from "$lib/api";
  // La page ne contenait aucun <a> : une fois arrivé dessus, il n'existait
  // aucun moyen de revenir au site autrement qu'en modifiant l'URL.
  import BoutonGoogle from "$lib/components/BoutonGoogle.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { authStore } from "$lib/stores/auth";
  import { tr } from "$lib/stores/language";
  import "../../app.css";

  let email = "";
  let password = "";
  let error = "";
  let loading = false;

  // Redirection post-connexion, transmise par la garde du layout admin.
  // `next` n'est renseigné que si la garde admin nous a envoyés ici.
  $: next = cheminInterne($page.url.searchParams.get("next"));

  /**
   * N'accepte qu'un chemin interne comme destination.
   *
   * `?next=` était suivi sans aucune validation : une adresse absolue
   * (`?next=https://ailleurs.example`) ou protocole-relative (`?next=//…`)
   * aurait fait de la page de connexion un tremplin de redirection, avec
   * l'autorité du domaine derrière elle.
   */
  function cheminInterne(valeur: string | null): string | null {
    if (!valeur) return null;
    if (!valeur.startsWith("/") || valeur.startsWith("//")) return null;
    return valeur;
  }

  /**
   * Où envoyer un compte après connexion.
   *
   * Le repli était `/admin` en dur. Un compte NON-admin se connectant depuis
   * /login était donc envoyé vers /admin, dont la garde le renvoyait vers
   * /login : boucle sans issue, sans message. Le repli dépend maintenant du
   * rôle réellement obtenu.
   */
  function destinationFor(role: string | undefined): string {
    if (next) return next;
    return ["admin", "superadmin"].includes(role ?? "") ? "/admin" : "/";
  }

  onMount(() => {
    // Déjà connecté : inutile de repasser par le formulaire.
    if ($authStore.isAuthenticated) {
      goto(destinationFor($authStore.user?.role), { replaceState: true });
    }
  });

  /** Session ouverte, puis redirection selon le rôle. Partagée avec Google. */
  async function ouvrirLaSession(data: {
    id: number;
    email: string;
    role: "user" | "admin" | "superadmin";
    full_name?: string | null;
    username?: string;
    access_token: string;
  }) {
    authStore.login(
      {
        id: data.id,
        email: data.email,
        role: data.role,
        name: data.full_name || data.username,
      },
      data.access_token,
    );
    await goto(destinationFor(data.role), { replaceState: true });
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
      // 503 = connexion Google non configurée, ou certificats Google
      // injoignables : ce n'est pas l'utilisateur qui a échoué.
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
        await ouvrirLaSession(await response.json());
        return;
      }

      if (response.status === 401) {
        error = $tr("login.errorCredentials");
      } else if (response.status === 403) {
        error = $tr("login.errorDisabled");
      } else {
        error = $tr("login.errorGeneric");
      }
    } catch (e) {
      // Distinguer « mauvais identifiants » de « serveur injoignable » évite de
      // faire chercher un mot de passe quand c'est le backend qui est éteint.
      error = $tr("login.errorNetwork");
    } finally {
      loading = false;
    }
  }
</script>

<!-- Hors index : un formulaire de connexion n'apporte rien a une recherche, et
     son apparition dans les resultats ne fait qu'exposer la porte d'entree. -->
<MetaSeo titre={$tr("login.title")} indexable={false} />

<SiteHeader />

<main id="contenu">
<div class="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-slate-50 px-4 font-sans">
  <div class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
    <!-- La marque etait composee de deux <span> : la page n'avait aucun titre,
         de h1 a h6. Un lecteur d'ecran arrivait sur un formulaire sans savoir
         de quoi il s'agissait. -->
    <h1 class="mb-8 flex items-center justify-center gap-2 font-bold text-slate-900">
      <span class="text-3xl" aria-hidden="true">&#9878;</span>
      <span class="text-xl">JuriX</span>
    </h1>

    <form on:submit|preventDefault={handleSubmit} class="space-y-5">
      <div>
        <label for="email" class="mb-1 block text-sm font-medium text-slate-700">
          {$tr("login.email")}
        </label>
        <input
          id="email"
          data-testid="login-email"
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
          {$tr("login.password")}
        </label>
        <input
          id="password"
          data-testid="login-password"
          type="password"
          bind:value={password}
          required
          autocomplete="current-password"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {#if error}
        <p role="alert" data-testid="login-error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      {/if}

      <button
        type="submit"
        disabled={loading}
        data-testid="login-submit"
        class="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? $tr("login.submitting") : $tr("login.submit")}
      </button>
    </form>

    <!-- Le lien n'existait pas, et c'était volontaire : sans envoi d'e-mail,
         il n'aurait mené nulle part, ce qui est pire que son absence. Il
         apparaît maintenant que la réinitialisation existe réellement. -->
    <p class="mt-4 text-center text-xs">
      <a
        href="/forgot-password"
        data-testid="login-to-forgot"
        class="font-medium text-blue-600 hover:underline">{$tr("login.forgotPassword")}</a
      >
    </p>

    <div class="mt-6">
      <BoutonGoogle on:credential={connexionGoogle} />
    </div>

    <p class="mt-6 text-center text-xs text-slate-500">
      {$tr("login.noAccount")}
      <a href="/signup" data-testid="login-to-signup" class="font-medium text-blue-600 hover:underline"
        >{$tr("signup.submit")}</a
      >
    </p>
  </div>
</div>
</main>
