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
  import ChampMotDePasse from "$lib/components/ChampMotDePasse.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { GOOGLE_CLIENT_ID } from "$lib/google";
  import { authStore } from "$lib/stores/auth";
  import { reconcilierPersonaALaConnexion } from "$lib/persona-compte";
  import { tr } from "$lib/stores/language";
  import "../../app.css";

  let email = "";
  let password = "";
  let error = "";
  let loading = false;
  // Vrai après un 401 : l'erreur s'accompagne alors de l'invitation à
  // réinitialiser le mot de passe. Pas après un 403 (compte désactivé, un
  // nouveau mot de passe n'y changerait rien) ni après une panne.
  let identifiantsRefuses = false;

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
    identifiantsRefuses = false;
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
    identifiantsRefuses = false;
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
        identifiantsRefuses = true;
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

  Sous sm, la carte est ancrée en haut (items-start) tant qu'un champ est à
  l'écran : centrée, elle sautait vers le haut à l'ouverture du clavier, qui
  réduit la page sur Android. Les écrans SANS champ (atterrissages de
  /reset-password et /verify-email, confirmations, succès) la centrent :
  aucun clavier à prévoir, et ancrée en haut la carte courte laissait une
  bande vide jusqu'au pied. Et p-5 au lieu de p-8 : à 320 px, il ne restait
  que 222 px pour les champs.

  À partir de sm, la carte est ancrée à 12 % de la hauteur de l'écran
  (`sm:pt-[12vh]`), la même ancre sur les sept pages de compte. Centrée
  chacune selon sa propre hauteur, la tuile et le titre sautaient d'une page
  sœur à l'autre (y ≈ 253 px sur /login, 191 sur /signup, 287 sur
  /forgot-password, 335 sur /reset-password en 1 440 × 900).

  De lg à xl (tablette en paysage), autant SOUS la carte (`lg:pb-[12vh]`) :
  le pied y est empilé (233 px de haut) sous un écran bas, la page défile de
  toute façon, et avec 40 px dessous la carte paraissait posée sur lui
  (1 024 × 768 : 92 px au-dessus d'elle, 40 au-dessous, et la rangée de
  liens du pied coupée par le bas de l'écran). Ailleurs, 40 px
  (`sm:pb-10`, `xl:pb-10`) : la même marge partout faisait défiler /signup,
  la plus haute des cartes, de 60 px en 1 440 × 900 et de 82 en 768 × 1 024,
  pour couper cette fois la rangée de liens du pied en deux au bas de
  l'écran (mesuré le 2026-10-28) ; à 40 px, tout y tient. Quand la carte
  tient, l'espace en trop reste dessous (`flex-1`, `items-start`).

  Le dernier lien de la carte garde sa cible de 44 px (`py-3`), mais son
  paragraphe rend la marge de 12 px qu'elle ajoutait sous lui (`-mb-3`) : la
  carte paraissait lestée vers le bas, 45 px de blanc sous le soulignement
  contre 33 au-dessus de la tuile.

  Cibles de 44 px à TOUTES les tailles : champs, bouton (guide § 4.4) et
  liens texte (py-3, text-sm). Elles retombaient à 16, 28 ou 40 px dès sm,
  or 740 px de large est un téléphone en paysage, et 768 ou 1 024 une
  tablette : la taille suivait la largeur, pas le doigt. Les liens texte
  restent en text-sm : en text-xs dès sm, le lien vers l'inscription
  devenait le plus petit texte de la carte. Soulignés en permanence : sans
  le bleu, sorti du site, c'est le trait qui les distingue du texte qui les
  entoure.

  Texte des champs en 16 px (text-base) sous un pointeur tactile, à toutes
  les largeurs ; 14 px seulement à partir de sm ET sous un pointeur fin
  (souris, pavé : `sm:[@media(pointer:fine)]:text-sm`). Safari sur iPhone
  agrandit la page au focus d'un champ de moins de 16 px, et la laisse
  agrandie : elle glisse alors de côté. `sm:text-sm` passait à 14 px dès
  640 px de large, or un téléphone en paysage en fait 740 : la règle ne
  protégeait que le portrait. Même règle pour la tablette, tactile elle
  aussi. Les autres pages de compte reprennent cette recette.

  En tête de carte, une tuile douce (guide § 7) à l'icône de la tâche, puis
  le titre et une phrase, comme les autres pages de compte. La tuile de la
  balance, inversée, répétait le logo de l'en-tête à 60 px de lui (deux
  carrés blancs en sombre), et la connexion était la seule page de compte
  sans titre de tâche : son h1 était la marque.

  Écran court (`court:`, téléphone en paysage, 360 px de haut) : marges
  resserrées, tuile retirée et phrase d'accroche gardée pour les seuls
  lecteurs d'écran (en-tête resserré aussi : SiteHeader). Le bouton d'envoi
  commençait 30 px sous le bas de l'écran ; il finit maintenant à 354 px
  (mesuré en 740x360). Les 20 px entre les deux champs restent : la cible
  du lien « Mot de passe oublié ? » s'y étend.

  Pied du site (SiteFooter) sous la carte, comme sur les autres pages
  publiques, 404 comprise : contact, à propos et navigation restent à portée.
-->
<div class="flex min-h-app flex-col">
<SiteHeader />

<main id="contenu" class="flex flex-1 flex-col">
<div class="flex flex-1 items-start justify-center bg-background-light px-4 py-6 font-sans dark:bg-background-dark sm:pb-10 sm:pt-[12vh] lg:pb-[12vh] xl:pb-10 court:items-start court:py-3">
  <div class="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:p-8 court:p-4">
    <!-- La marque etait composee de deux <span> : la page n'avait aucun titre,
         de h1 a h6. Un lecteur d'ecran arrivait sur un formulaire sans savoir
         de quoi il s'agissait. Le titre dit maintenant la tâche, en 24 px dès
         sm : au-dessus des libellés de 14 px et du bouton, sans égaler le h1
         d'une page (guide § 4.2). -->
    <h1 class="mb-2 flex items-center justify-center gap-2 text-xl font-titre font-semibold text-zinc-950 dark:text-white sm:text-2xl court:mb-4 court:text-xl">
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/70 bg-zinc-100 text-zinc-800 dark:border-zinc-700/60 dark:bg-zinc-800 dark:text-zinc-200 court:hidden"
      >
        <Icone nom="log-in" class="text-lg" />
      </span>
      {$tr("login.title")}
    </h1>
    <p class="mb-6 text-balance text-center text-sm text-zinc-500 dark:text-zinc-400 sm:mb-8 court:sr-only">
      {$tr("login.subtitle")}
    </p>

    <form on:submit|preventDefault={handleSubmit} class="space-y-5">
      <div>
        <label for="email" class="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {$tr("login.email")}
        </label>
        <input
          id="email"
          data-testid="login-email"
          type="email"
          bind:value={email}
          required
          autocomplete="username"
          placeholder={$tr("auth.emailPlaceholder")}
          class="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-950 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm"
        />
      </div>

      <div>
        <!--
          « Mot de passe oublié ? » sur la ligne du libellé, là où on le cherche
          au moment de taper le mot de passe. Placé sous le bouton d'envoi, en
          petit, il passait inaperçu (le propriétaire lui-même ne l'a pas
          trouvé). Le lien garde la taille du libellé ; un pseudo-élément
          étend sa cible à 44 px de haut sans décaler la ligne, à toutes les
          tailles (28 px dès sm, auparavant : trop peu sur une tablette) :
          20 px au-dessus (l'écart avec le champ de l'adresse, sans le
          chevaucher), 4 px dessous (jusqu'au champ du mot de passe).
        -->
        <div class="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <label for="password" class="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {$tr("login.password")}
          </label>
          <a
            href="/forgot-password"
            data-testid="login-to-forgot"
            class="relative text-sm font-semibold text-zinc-950 underline decoration-zinc-300 underline-offset-4 after:absolute after:-inset-x-2 after:-bottom-1 after:-top-5 after:content-[''] hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white"
            >{$tr("login.forgotPassword")}</a
          >
        </div>
        <ChampMotDePasse
          id="password"
          data-testid="login-password"
          bind:value={password}
          required
          autocomplete="current-password"
          class="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-950 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm"
        />
      </div>

      {#if error}
        <div class="space-y-2">
          <p
            role="alert"
            data-testid="login-error"
            class="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            <Icone nom="circle-alert" class="mt-0.5 text-base" />
            <span>{error}</span>
          </p>
          <!-- Après un refus des identifiants, la sortie la plus probable : un
               nouveau mot de passe. HORS de l'alerte, comme sur la page de
               réinitialisation : une région `role="alert"` est lue d'un bloc,
               et certaines aides techniques n'y exposent pas les liens.

               La question est en gris secondaire (guide § 4.2), celui des
               autres phrases secondaires de la carte (sous-titre, « Pas
               encore de compte ? ») : en zinc-600 (zinc-300 en sombre), elle
               faisait un second gris pour le même rôle.

               Le lien a la cible de 44 px des autres liens de la carte, par
               un pseudo-élément étendu de 12 px au-dessus et au-dessous de sa
               ligne de 20 px, comme « Mot de passe oublié ? » : la ligne ne
               bouge pas, et la cible s'arrête à 8 px du bouton d'envoi (20 px
               d'écart) ; au-dessus, elle ne couvre que la question ou le bas
               de l'alerte, rien qui se touche. Il ne faisait
               que 20 px de haut, sous le pouce, juste au-dessus du bouton.
               `inline-block` : le lien passe d'un bloc à la ligne suivante au
               lieu de se couper en deux morceaux, dont le pseudo-élément ne
               saurait couvrir que la boîte englobante. -->
          {#if identifiantsRefuses}
            <p data-testid="login-reset-hint" class="text-sm text-zinc-500 dark:text-zinc-400">
              {$tr("login.resetHint")}
              <a
                href="/forgot-password"
                data-testid="login-error-to-forgot"
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
        data-testid="login-submit"
        class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200"
      >
        {loading ? $tr("login.submitting") : $tr("login.submit")}
      </button>
    </form>

    <!-- Le lien « Mot de passe oublié ? », jadis ici, est sur la ligne du
         libellé du mot de passe (plus haut).

         Le conteneur du bouton Google n'existe que si ce bouton peut
         s'afficher. Vide, sa marge se confondait avec celle du paragraphe
         suivant (fusion des marges) : sur téléphone, le pied de carte était
         à 26 px du bouton ici et à 38 px sur /signup. Sans Google, le pied
         suit le bouton à 12 px, comme sur les autres cartes. -->
    {#if GOOGLE_CLIENT_ID}
      <div class="mt-6">
        <BoutonGoogle on:credential={connexionGoogle} />
      </div>
    {/if}

    <p class="-mb-3 mt-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
      {$tr("login.noAccount")}
      <a href="/signup" data-testid="login-to-signup" class="inline-block py-3 font-semibold text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white"
        >{$tr("signup.submit")}</a
      >
    </p>
  </div>
</div>
</main>

<SiteFooter />
</div>
