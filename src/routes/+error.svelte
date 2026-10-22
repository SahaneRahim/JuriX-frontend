<script lang="ts">
  /**
   * Page d'erreur du site.
   *
   * Il n'en existait aucune : une URL inconnue affichait la page d'erreur brute
   * de SvelteKit. Comme `src/routes/+layout.svelte` ne rend qu'un `<slot />`,
   * cette page par défaut n'avait ni en-tête, ni pied de page, ni le moindre
   * lien — un cul-de-sac de plus, précisément ce qu'on cherche à supprimer.
   *
   * Elle sert de filet : toute cible qui échapperait encore au contrôle atterrit
   * ici avec un moyen de repartir, au lieu d'une impasse.
   */
  import { page } from "$app/stores";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { NAV_LINKS } from "$lib/nav";
  import { titreDePage } from "$lib/seo";
  import { tr } from "$lib/stores/language";

  // 503 : l'API ne répond pas pendant le rendu serveur d'une fiche ou d'une
  // liste (leurs `load`). Le message passé à error() est en français ; la page
  // affiche le sien, traduit, avec un moyen de réessayer.
  $: indisponible = $page.status === 503;
  $: titre =
    $page.status === 404
      ? $tr("error.notFoundTitle")
      : indisponible
        ? $tr("error.unavailableTitle")
        : $tr("error.genericTitle");
  $: corps =
    $page.status === 404
      ? $tr("error.notFoundBody")
      : indisponible
        ? $tr("error.unavailableBody")
        : ($page.error?.message ?? $tr("error.genericBody"));
</script>

<svelte:head>
  <title>{titreDePage(titre)}</title>
</svelte:head>

<!-- `min-h-app` (app.css : 100dvh, repli 100vh) : 100vh compte la barre du navigateur
     mobile comme repliée, et la page défilait d'autant sans raison. -->
<div class="min-h-app flex flex-col bg-background-light dark:bg-background-dark">
  <SiteHeader />

  <main
    id="contenu"
    class="flex-grow flex flex-col items-center justify-center pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] py-12 sm:py-20 text-center"
    data-testid="error-page"
  >
    <p class="text-6xl sm:text-7xl font-extrabold text-primary mb-4">{$page.status}</p>

    <h1 class="text-2xl font-bold text-slate-900 dark:text-white mb-3 coupe-mots">
      {titre}
    </h1>

    <!-- `coupe-mots` : un message d'erreur peut porter une adresse ou un
         identifiant sans espace, qui élargissait la page sur téléphone. -->
    <p
      class="text-secondary-text-light dark:text-secondary-text-dark/70 max-w-md mb-8 sm:mb-10 coupe-mots"
    >
      {corps}
    </p>

    {#if indisponible}
      <!-- Un lien et non un bouton : il marche avant le JavaScript, et
           data-sveltekit-reload redemande la page au serveur au lieu de
           rejouer le `load` dans le navigateur. -->
      <a
        href={$page.url.pathname + $page.url.search}
        data-sveltekit-reload
        data-testid="error-retry"
        class="mb-8 inline-flex min-h-11 items-center px-6 py-3 rounded-lg font-semibold text-sm bg-primary text-white hover:bg-blue-700 transition-colors"
        >{$tr("error.retry")}</a
      >
    {/if}

    <!-- Mêmes destinations que la navigation : une seule liste à maintenir. -->
    <nav class="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {#each NAV_LINKS as lien (lien.href)}
        <a
          href={lien.href}
          class="inline-flex min-h-11 items-center px-4 sm:px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary"
          >{$tr(lien.key)}</a
        >
      {/each}
    </nav>
  </main>

  <SiteFooter />
</div>
