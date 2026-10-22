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
  import { reconcilierPersonaALaConnexion } from "$lib/persona-compte";
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

  // Envoi inactif jusqu'au montage. La page arrive rendue par le serveur : un
  // Entrée avant l'hydratation (fréquent sur un mobile lent) enverrait le
  // formulaire en GET, rechargeant la page et perdant la saisie. Un bouton
  // d'envoi inactif bloque aussi l'envoi implicite par Entrée. Sans JavaScript,
  // l'opération est de toute façon impossible. Pour la même raison, jamais
  // d'attribut `name` sur ces champs sans method="post" : en GET, le mot de
  // passe partirait dans l'URL.
  let monte = false;

  onMount(() => {
    monte = true;
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
    persona?: string | null;
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
    // Le profil enregistré sur le compte l'emporte sur celui du navigateur.
    reconcilierPersonaALaConnexion(data);
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

<!--
  Coquille commune aux pages de compte (inscription, mot de passe oublié,
  réinitialisation, vérification d'adresse) : une colonne de la hauteur de
  l'écran visible (min-h-app : 100dvh, repli 100vh, dans app.css), dont
  <main> prend tout ce que l'en-tête laisse, quelle que soit sa hauteur.
  L'ancien `min-h-[calc(100vh-5rem)]` supposait un en-tête de 80 px exactement
  (il en faisait 72), et 100vh compte la barre d'adresse mobile comme
  repliée : la page défilait d'une hauteur de barre, même quand la carte
  tenait dans l'écran.

  Sous sm, la carte est ancrée en haut (items-start) : centrée, elle sautait
  vers le haut à l'ouverture du clavier, qui réduit la page sur Android. Et
  p-5 au lieu de p-8 : à 320 px, il ne restait que 222 px pour les champs.

  Liens texte : bloc de 44 px de haut sous sm (py-3, text-sm), pour le doigt ;
  les marges qui les entourent sont réduites d'autant, pour garder le même
  espacement visible. Ils retrouvent leur taille d'origine à partir de sm.
-->
<div class="flex min-h-app flex-col">
<SiteHeader />

<main id="contenu" class="flex flex-1 flex-col">
<div class="flex flex-1 items-start justify-center bg-slate-50 px-4 py-6 font-sans dark:bg-slate-900 sm:items-center sm:py-10">
  <div class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8">
    <!-- La marque etait composee de deux <span> : la page n'avait aucun titre,
         de h1 a h6. Un lecteur d'ecran arrivait sur un formulaire sans savoir
         de quoi il s'agissait. -->
    <h1 class="mb-6 flex items-center justify-center gap-2 font-bold text-slate-900 dark:text-white sm:mb-8">
      <span class="text-3xl" aria-hidden="true">&#9878;</span>
      <span class="text-xl">JuriX</span>
    </h1>

    <form on:submit|preventDefault={handleSubmit} class="space-y-5">
      <div>
        <label for="email" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
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
          class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white sm:py-2"
        />
      </div>

      <div>
        <label for="password" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {$tr("login.password")}
        </label>
        <input
          id="password"
          data-testid="login-password"
          type="password"
          bind:value={password}
          required
          autocomplete="current-password"
          class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white sm:py-2"
        />
      </div>

      {#if error}
        <p role="alert" data-testid="login-error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      {/if}

      <button
        type="submit"
        disabled={loading || !monte}
        data-testid="login-submit"
        class="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2"
      >
        {loading ? $tr("login.submitting") : $tr("login.submit")}
      </button>
    </form>

    <!-- Le lien n'existait pas, et c'était volontaire : sans envoi d'e-mail,
         il n'aurait mené nulle part, ce qui est pire que son absence. Il
         apparaît maintenant que la réinitialisation existe réellement. -->
    <p class="mt-1 text-center text-sm sm:mt-4 sm:text-xs">
      <a
        href="/forgot-password"
        data-testid="login-to-forgot"
        class="inline-block py-3 font-medium text-blue-600 hover:underline dark:text-blue-400 sm:py-0">{$tr("login.forgotPassword")}</a
      >
    </p>

    <div class="mt-3 sm:mt-6">
      <BoutonGoogle on:credential={connexionGoogle} />
    </div>

    <p class="mt-3 text-center text-sm text-slate-500 dark:text-slate-400 sm:mt-6 sm:text-xs">
      {$tr("login.noAccount")}
      <a href="/signup" data-testid="login-to-signup" class="inline-block py-3 font-medium text-blue-600 hover:underline dark:text-blue-400 sm:py-0"
        >{$tr("signup.submit")}</a
      >
    </p>
  </div>
</div>
</main>
</div>
