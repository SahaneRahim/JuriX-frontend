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
  import { tr } from "$lib/stores/language";
</script>

<svelte:head>
  <title>JuriX — {$page.status}</title>
</svelte:head>

<div class="min-h-screen flex flex-col bg-background-light dark:bg-background-dark">
  <SiteHeader />

  <main
    class="flex-grow flex flex-col items-center justify-center px-6 py-20 text-center"
    data-testid="error-page"
  >
    <p class="text-7xl font-extrabold text-primary mb-4">{$page.status}</p>

    <h1 class="text-2xl font-bold text-slate-900 dark:text-white mb-3">
      {$page.status === 404
        ? $tr("error.notFoundTitle")
        : $tr("error.genericTitle")}
    </h1>

    <p
      class="text-secondary-text-light dark:text-secondary-text-dark/70 max-w-md mb-10"
    >
      {$page.status === 404
        ? $tr("error.notFoundBody")
        : ($page.error?.message ?? $tr("error.genericBody"))}
    </p>

    <!-- Mêmes destinations que la navigation : une seule liste à maintenir. -->
    <nav class="flex flex-wrap items-center justify-center gap-3">
      {#each NAV_LINKS as lien (lien.href)}
        <a
          href={lien.href}
          class="px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary"
          >{$tr(lien.key)}</a
        >
      {/each}
    </nav>
  </main>

  <SiteFooter />
</div>
