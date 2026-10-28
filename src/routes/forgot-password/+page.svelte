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
  import { onMount } from "svelte";
  import { API_URL } from "$lib/api";
  import Icone from "$lib/components/Icone.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { tr } from "$lib/stores/language";
  import "../../app.css";

  let email = "";
  let error = "";
  let loading = false;
  // Vrai quand l'adresse est refusée pour sa FORME (vide, mal écrite) : le
  // champ passe alors en erreur. Une panne, elle, ne vise pas le champ.
  let adresseInvalide = false;
  // Envoi inactif jusqu'au montage : voir login/+page.svelte.
  let monte = false;
  onMount(() => (monte = true));
  // Bascule vers l'écran de confirmation : le formulaire disparaît alors, pour
  // qu'un second envoi ne soit pas la réaction réflexe à l'absence d'e-mail.
  let envoye = false;

  /**
   * Forme d'une adresse, vérifiée avant l'envoi : le serveur (EmailStr)
   * répond 422 sur une adresse mal écrite, que la page affichait comme
   * « Envoi impossible. Réessayez dans un instant. » — réessayer n'y
   * changeait rien. Le contrôle ne dit rien de l'existence d'un compte : il
   * ne regarde que l'écriture.
   */
  function adresseBienFormee(valeur: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur);
  }

  async function handleSubmit() {
    error = "";
    adresseInvalide = false;
    if (!adresseBienFormee(email.trim())) {
      error = $tr("forgot.errorInvalid");
      adresseInvalide = true;
      return;
    }
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
      // 422 : la forme de l'adresse, que la vérification ci-dessus n'a pas
      // vue (le serveur est plus strict sur le domaine). Le reste : réessayer.
      if (reponse.status === 422) {
        error = $tr("forgot.errorInvalid");
        adresseInvalide = true;
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

<!-- Même coquille que login/+page.svelte : colonne de la hauteur de l'écran
     visible, cibles de 44 px à toutes les tailles, champ en 16 px sous un
     pointeur tactile, tuile douce à l'icône de la tâche, règles d'écran
     court, pied du site.

     Sous sm, la carte n'est ancrée en haut que tant que le formulaire est
     affiché : centrée, elle sauterait vers le haut à l'ouverture du clavier
     (voir login/+page.svelte). L'écran de confirmation n'a plus de champ :
     la carte y est centrée, au lieu de laisser une bande vide entre elle et
     le pied du site. -->
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
    class="flex flex-1 justify-center bg-background-light px-4 py-6 font-sans dark:bg-background-dark sm:pb-10 sm:pt-[12vh] lg:pb-[12vh] xl:pb-10 court:items-start court:py-3 {envoye
      ? 'items-center sm:items-start'
      : 'items-start'}"
  >
    <div
      class="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:p-8 court:p-4"
    >
      <!-- Sans `court:mb-4` ici, contrairement aux pages sœurs : la consigne
           reste affichée en écran court (plus bas), à 8 px du titre comme aux
           autres tailles. Devant l'encadré de confirmation, la marge du titre
           se fond dans celle de l'encadré (mt-6) : rien n'y change. -->
      <h1
        class="mb-2 flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-2xl court:text-xl"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/70 bg-zinc-100 text-zinc-800 dark:border-zinc-700/60 dark:bg-zinc-800 dark:text-zinc-200 court:hidden"
        >
          <Icone nom="key-round" class="text-lg" />
        </span>
        {$tr("forgot.title")}
      </h1>

      {#if envoye}
        <!-- Écran de confirmation : strictement le même texte pour une adresse
             connue et pour une adresse inconnue. Dans un encadré de succès
             (guide § 4.10), comme après la réinitialisation : un titre centré
             seul se lisait comme une consigne de plus, pas comme « c'est
             fait ».

             En sombre, les couleurs d'un bloc DANS une carte (guide § 4.1),
             et non celles de l'alerte posée sur la page (zinc-900, filet
             zinc-800) : ce sont celles de la carte elle-même, et l'encadré
             s'y fondait (filet à 1,2:1), réduit à du texte et une icône. -->
        <div data-testid="forgot-sent" role="status" class="mt-6">
          <div
            class="flex gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-700/60 dark:bg-zinc-800/50 dark:text-zinc-300"
          >
            <Icone nom="circle-check" class="mt-0.5 text-base text-zinc-950 dark:text-white" />
            <div>
              <h2 class="mb-1 font-semibold text-zinc-950 dark:text-white">
                {$tr("forgot.sent")}
              </h2>
              <p>{$tr("forgot.sentDetail")}</p>
            </div>
          </div>
          <!-- L'expéditeur peut porter un nom que l'utilisateur ne reconnaît
               pas : le dire ici évite d'en conclure que le service est cassé. -->
          <p class="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
            {$tr("forgot.spamHint")}
          </p>
        </div>
      {:else}
        <!-- Affichée en écran court aussi (`court:mb-4` au lieu de
             `court:sr-only`, encore là sur les pages sœurs) : c'est la seule
             phrase qui dise ce que fait le formulaire. Masquée, l'écran ne
             montrait plus que « Mot de passe oublié », un champ et « Envoyer
             le lien ». Ses deux lignes ne coûtent que 48 px (titre à 8 px au
             lieu de 16, consigne à 16 px du champ) : en 740 × 360, le bouton
             d'envoi finit à 314 px, dans l'écran, au lieu de 266 (mesuré le
             2026-10-28 ; 314 aussi en 568 × 320). -->
        <p class="mb-6 text-balance text-center text-sm text-zinc-500 dark:text-zinc-400 sm:mb-8 court:mb-4">
          {$tr("forgot.subtitle")}
        </p>

        <form on:submit|preventDefault={handleSubmit} class="space-y-5" novalidate>
          <div>
            <label
              for="forgot-email"
              class="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              {$tr("forgot.email")}
            </label>
            <!-- En erreur de forme : bordure rouge, `aria-invalid` et le
                 message relié (guide § 4.5). Une panne ne vise pas le champ. -->
            <input
              id="forgot-email"
              data-testid="forgot-email"
              type="email"
              bind:value={email}
              required
              autocomplete="email"
              placeholder={$tr("auth.emailPlaceholder")}
              aria-invalid={adresseInvalide ? "true" : undefined}
              aria-describedby={error ? "forgot-erreur" : undefined}
              class="min-h-11 w-full rounded-xl border bg-white px-3 py-2 text-base text-zinc-950 placeholder-zinc-400 outline-none transition-colors focus:ring-1 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 sm:[@media(pointer:fine)]:text-sm {adresseInvalide
                ? 'border-red-600 focus:border-red-600 focus:ring-red-600 dark:border-red-400 dark:focus:border-red-400 dark:focus:ring-red-400'
                : 'border-zinc-200 focus:border-zinc-950 focus:ring-zinc-950 dark:border-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200'}"
            />
            <!-- Erreur de FORME : message en ligne, juste sous le champ qu'il
                 vise, dans le rouge de sa bordure (guide § 4.5). L'alerte
                 encadrée, 20 px plus bas, doublait d'un second cadre rouge la
                 bordure du champ pour une seule faute, et le sombre empilait
                 trois rouges (bordure du champ, bordure et texte de l'alerte).
                 `role="alert"` reste : rien ne porte le focus sur le message,
                 il doit être annoncé de lui-même. -->
            {#if adresseInvalide}
              <p
                id="forgot-erreur"
                role="alert"
                data-testid="forgot-error"
                class="mt-1.5 text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </p>
            {/if}
          </div>

          <!-- Panne ou refus du serveur : l'alerte du guide (§ 4.10), qui ne
               vise aucun champ. Même id et même data-testid que le message en
               ligne : un seul des deux existe à la fois. -->
          {#if error && !adresseInvalide}
            <p
              id="forgot-erreur"
              role="alert"
              data-testid="forgot-error"
              class="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              <Icone nom="circle-alert" class="mt-0.5 text-base" />
              <span>{error}</span>
            </p>
          {/if}

          <button
            type="submit"
            disabled={loading || !monte}
            data-testid="forgot-submit"
            class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200"
          >
            {loading ? $tr("forgot.submitting") : $tr("forgot.submit")}
          </button>
        </form>
      {/if}

      <!-- Hors du {#if} : quel que soit l'état — formulaire, erreur réseau ou
           confirmation — il reste une sortie vers la connexion. -->
      <p class="-mb-3 mt-3 text-center text-sm">
        <a
          href="/login"
          data-testid="forgot-to-login"
          class="inline-block py-3 font-semibold text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white"
          >{$tr("forgot.backToLogin")}</a
        >
      </p>
    </div>
  </div>
</main>

<SiteFooter />
</div>
