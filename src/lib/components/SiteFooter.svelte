<script lang="ts">
  /**
   * Pied de page du site public.
   *
   * Le pied de page d'origine ne contenait AUCUN lien — seulement le logo et la
   * mention de droits. Il porte désormais la même liste `NAV_LINKS` que le
   * header : sur les pages longues (`/laws`, `/laws/[id]`, `/categories/[id]`),
   * c'est le seul retour disponible une fois le header défilé hors de l'écran.
   */
  import { NAV_LINKS } from "$lib/nav";
  import { tr } from "$lib/stores/language";
</script>

<footer
  data-testid="site-footer"
  class="border-t border-slate-200 dark:border-white/5 py-8 bg-white dark:bg-[#0a1628]/80 backdrop-blur-md mt-auto"
>
  <div
    class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6"
  >
    <a href="/" class="flex items-center gap-2">
      <div
        class="bg-gradient-to-br from-blue-500 to-blue-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20"
      >
        <span class="material-icons text-white text-sm">balance</span>
      </div>
      <span class="font-bold text-slate-700 dark:text-white text-lg">JuriX</span>
    </a>

    <nav class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
      {#each NAV_LINKS as lien (lien.href)}
        <a
          href={lien.href}
          class="text-sm text-secondary-text-light dark:text-secondary-text-dark/80 hover:text-primary transition-colors"
          >{$tr(lien.key)}</a
        >
      {/each}
    </nav>

    <p class="text-sm text-secondary-text-light dark:text-secondary-text-dark/60">
      {$tr("footer.rights")}
    </p>
  </div>
</footer>
