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
  import ChampMotDePasse from "$lib/components/ChampMotDePasse.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { GOOGLE_CLIENT_ID } from "$lib/google";
  import { authStore } from "$lib/stores/auth";
  import { reconcilierPersonaALaConnexion } from "$lib/persona-compte";
  import { tr } from "$lib/stores/language";
  import "../../app.css";

  let fullName = "";
  let email = "";
  let password = "";
  let error = "";
  let loading = false;
  // Vrai après un 409 : l'adresse a déjà un compte, dont on a peut-être
  // oublié le mot de passe. L'erreur s'accompagne de la sortie vers la
  // réinitialisation.
  let adressePrise = false;

  // Envoi inactif jusqu'au montage : voir login/+page.svelte.
  let monte = false;

  onMount(() => {
    monte = true;
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
    persona?: string | null;
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
    // Le profil enregistré sur le compte l'emporte sur celui du navigateur.
    reconcilierPersonaALaConnexion(donnees);
    await goto("/", { replaceState: true });
  }

  async function handleSubmit() {
    error = "";
    adressePrise = false;
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
      if (reponse.status === 409) {
        error = $tr("signup.errorEmailTaken");
        adressePrise = true;
      } else if (reponse.status === 422) error = $tr("signup.errorInvalid");
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
    adressePrise = false;
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

<!-- Même coquille que login/+page.svelte : colonne de la hauteur de l'écran
     visible, carte ancrée en haut sous sm, cibles de 44 px à toutes les
     tailles, champs en 16 px sous un pointeur tactile, tuile douce à l'icône
     de la tâche, règles d'écran court, pied du site. `text-balance` sur la
     phrase centrée : à 390 px, « l'autre. » restait seul sur sa ligne.

     Écran court ET large (téléphone en paysage, `sm:court:`) : nom et
     adresse côte à côte, dans une carte élargie à max-w-lg ; et 12 px entre
     les champs sur tout écran court (`court:`). Empilés, les trois champs et
     l'aide mettaient le bouton « Créer mon compte » à 418-462 px, sous le bas
     d'un écran de 360 px ; il finit maintenant à 358 px (calculé en 740x360,
     /login finit à 354). La carte élargie garde l'aide du mot de passe sur
     une ligne, en anglais aussi (431 px en Inter 12 px, pour 414 px de
     texte dans max-w-md, 478 dans max-w-lg) : sur deux lignes, le bouton
     redescendait de 16 px, hors de l'écran. Côte à côte à partir de sm
     seulement, jamais en portrait : sur Android, le clavier réduit la page
     (interactive-widget=resizes-content, app.html) au point de la faire
     passer en écran court, et les champs ne doivent pas changer de place
     sous les doigts. -->
<div class="flex min-h-app flex-col">
<SiteHeader />

<main id="contenu" class="flex flex-1 flex-col">
  <!-- À partir de sm, la carte est ancrée à 12 % de la hauteur de l'écran
       (`sm:pt-[12vh]`), la même ancre que les autres pages de compte :
       centrée selon sa propre hauteur, la tuile et le titre sautaient d'une
       page sœur à l'autre. De lg à xl, autant sous elle (`lg:pb-[12vh]`) : le
       pied empilé sous un écran bas la faisait paraître posée sur lui ; 40 px
       ailleurs, où une marge égale ferait défiler cette page, la plus haute,
       pour couper le pied au bas de l'écran (voir login/+page.svelte). Le
       dernier lien garde sa cible de 44 px (`py-3`), son paragraphe rend la
       marge qu'elle ajoutait sous lui (`-mb-3`) : la carte paraissait lestée
       vers le bas. -->
  <div
    class="flex flex-1 items-start justify-center bg-background-light px-4 py-6 font-sans dark:bg-background-dark sm:pb-10 sm:pt-[12vh] lg:pb-[12vh] xl:pb-10 court:items-start court:py-3"
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
          <Icone nom="user-round-plus" class="text-lg" />
        </span>
        {$tr("signup.title")}
      </h1>
      <p class="mb-6 text-balance text-center text-sm text-zinc-500 dark:text-zinc-400 sm:mb-8 court:sr-only">
        {$tr("signup.subtitle")}
      </p>

      <form on:submit|preventDefault={handleSubmit} class="space-y-5 court:space-y-3" novalidate>
        <!-- Nom et adresse : une colonne, deux en écran court et large (voir
             plus haut). Une grille plutôt que space-y : le même écart sert
             entre les lignes et entre les colonnes. `grid-cols-1`
             (minmax(0, 1fr)) : la colonne garde la largeur de la carte, quel
             que soit son contenu. -->
        <div class="grid grid-cols-1 gap-5 court:gap-3 sm:court:grid-cols-2">
          <div>
            <label
              for="signup-name"
              class="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
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
              class="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-950 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm"
            />
          </div>

          <div>
            <label
              for="signup-email"
              class="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
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
              placeholder={$tr("auth.emailPlaceholder")}
              class="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-950 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm"
            />
          </div>
        </div>

        <div>
          <label
            for="signup-password"
            class="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
          >
            {$tr("signup.password")}
          </label>
          <ChampMotDePasse
            id="signup-password"
            data-testid="signup-password"
            bind:value={password}
            required
            minlength="8"
            autocomplete="new-password"
            aria-describedby="signup-password-hint"
            class="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-950 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm"
          />
          <!-- La règle est annoncée AVANT l'envoi : le serveur répond 422 sur
               un mot de passe faible, autant ne pas le faire découvrir.
               `text-pretty` : dès 740 px, « chiffre. » finissait seul sur la
               seconde ligne. -->
          <p
            id="signup-password-hint"
            class="mt-1 text-pretty text-xs text-zinc-500 dark:text-zinc-400"
          >
            {$tr("signup.passwordHint")}
          </p>
        </div>

        {#if error}
          <div class="space-y-2">
            <p
              role="alert"
              data-testid="signup-error"
              class="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              <Icone nom="circle-alert" class="mt-0.5 text-base" />
              <span>{error}</span>
            </p>
            <!-- Hors de l'alerte, comme sur la page de connexion. Le texte ne dit
                 rien du compte (mot de passe ou Google) : seulement la sortie.
                 Même recette que login/+page.svelte : la question dans le gris
                 secondaire des autres phrases de la carte, et le lien porté à
                 44 px par un pseudo-élément, sans bouger la ligne (12 px
                 au-dessus et au-dessous ; en écran court, l'écart avec le
                 bouton d'envoi est de 12 px : la cible s'arrête à son bord). -->
            {#if adressePrise}
              <p data-testid="signup-reset-hint" class="text-sm text-zinc-500 dark:text-zinc-400">
                {$tr("login.resetHint")}
                <a
                  href="/forgot-password"
                  data-testid="signup-to-forgot"
                  class="relative inline-block font-semibold text-zinc-950 underline decoration-zinc-300 underline-offset-4 after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white"
                  >{$tr("login.resetLink")}</a
                >
              </p>
            {/if}
          </div>
        {/if}

        <button
          type="submit"
          disabled={loading || !monte}
          data-testid="signup-submit"
          class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200"
        >
          {loading ? $tr("signup.submitting") : $tr("signup.submit")}
        </button>
      </form>

      <!-- Conteneur posé seulement si le bouton Google peut s'afficher : voir
           login/+page.svelte (même écart de 12 px entre le bouton et le pied
           de carte sur les deux pages). -->
      {#if GOOGLE_CLIENT_ID}
        <div class="mt-6">
          <BoutonGoogle on:credential={connexionGoogle} />
        </div>
      {/if}

      <p class="-mb-3 mt-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
        {$tr("signup.haveAccount")}
        <a href="/login" class="inline-block py-3 font-semibold text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white"
          >{$tr("login.submit")}</a
        >
      </p>
    </div>
  </div>
</main>

<SiteFooter />
</div>
