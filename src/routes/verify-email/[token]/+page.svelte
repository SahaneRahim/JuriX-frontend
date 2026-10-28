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
  import Icone from "$lib/components/Icone.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
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

<!-- Même coquille que login/+page.svelte : colonne de la hauteur de l'écran
     visible, cibles de 44 px à toutes les tailles, tuile douce à l'icône de
     la tâche, règles d'écran court, pied du site. Carte centrée sous sm,
     comme sur verify-email/+page.svelte : aucun des trois états n'a de
     champ, donc aucun clavier à prévoir, et ancrée en haut la carte courte
     laissait une bande vide jusqu'au pied. -->
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
    class="flex flex-1 items-center justify-center bg-background-light px-4 py-6 font-sans dark:bg-background-dark sm:items-start sm:pb-10 sm:pt-[12vh] lg:pb-[12vh] xl:pb-10 court:items-start court:py-3"
  >
    <div
      class="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:p-8 court:p-4"
    >
      <!-- Un seul titre de niveau 1, commun aux trois états : il décrit la page
           et non son issue, pour garder le même repère du début à la fin. -->
      <h1
        class="mb-6 flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-2xl court:mb-4 court:text-xl"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/70 bg-zinc-100 text-zinc-800 dark:border-zinc-700/60 dark:bg-zinc-800 dark:text-zinc-200 court:hidden"
        >
          <Icone nom="mail-check" class="text-lg" />
        </span>
        {$tr("verify.title")}
      </h1>

      {#if etat === "encours"}
        <p
          role="status"
          data-testid="verify-pending"
          class="text-sm text-zinc-600 dark:text-zinc-300"
        >
          {$tr("verify.pending")}
        </p>
      {:else if etat === "reussi"}
        <!-- Messages alignés à gauche dans la carte centrée : sur deux lignes,
             un texte centré se détachait de l'icône posée à sa gauche. En
             sombre, les couleurs d'un bloc DANS une carte (guide § 4.1) :
             celles de l'alerte posée sur la page (zinc-900, filet zinc-800)
             sont celles de la carte, et l'encadré s'y fondait (voir
             forgot-password/+page.svelte). -->
        <p
          role="status"
          data-testid="verify-success"
          class="flex gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left text-sm text-zinc-700 dark:border-zinc-700/60 dark:bg-zinc-800/50 dark:text-zinc-300"
        >
          <Icone nom="circle-check" class="mt-0.5 text-base text-zinc-950 dark:text-white" />
          <span>{$tr("verify.success")}</span>
        </p>
        <a
          href="/"
          data-testid="verify-to-home"
          class="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200"
        >
          {$tr("verify.goHome")}
        </a>
      {:else}
        <p
          role="alert"
          data-testid="verify-error"
          class="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <Icone nom="circle-alert" class="mt-0.5 text-base" />
          <span>{error}</span>
        </p>
        <!-- Un écran d'échec sans lien serait un cul-de-sac : la confirmation a
             échoué, mais le compte existe peut-être déjà et le site reste
             accessible. Deux sorties, donc, jamais zéro. -->
        <a
          href="/login"
          data-testid="verify-to-login"
          class="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200"
        >
          {$tr("login.submit")}
        </a>
        <p class="-mb-3 mt-3 text-sm">
          <a
            href="/"
            data-testid="verify-to-home"
            class="inline-block py-3 font-semibold text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white"
          >
            {$tr("verify.goHome")}
          </a>
        </p>
      {/if}
    </div>
  </div>
</main>

<SiteFooter />
</div>
