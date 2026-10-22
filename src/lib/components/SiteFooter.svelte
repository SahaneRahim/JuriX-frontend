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

  /**
   * À poser sur les pages qui montent le bouton flottant de l'assistant
   * (`ChatFab`). En fin de défilement, il se posait sur le copyright au bureau
   * et sur les liens au téléphone. La réserve suit sa géométrie : en bas tant
   * que le pied de page est empilé (bouton de 56 px à 16 px du bord, puis
   * 64 px à 32 px à partir de sm), à droite à partir de lg, où il passe en
   * ligne et où le copyright occupe justement le coin du bouton.
   */
  export let reserverBouton = false;
</script>

<!-- Marge basse augmentée de la zone sûre : sur iPhone, le copyright tombait
     sous la barre d'accueil. -->
<footer
  data-testid="site-footer"
  class="border-t border-slate-200 dark:border-white/5 pt-8 pb-[calc(2rem+env(safe-area-inset-bottom))] bg-white dark:bg-[#0a1628]/80 backdrop-blur-md mt-auto"
>
  <!-- Empilé et centré sur téléphone et tablette, en ligne à partir de lg : à
       md, les trois blocs côte à côte repliaient les liens sur deux lignes et
       le copyright sur trois. -->
  <div
    class="max-w-7xl mx-auto flex flex-col items-center justify-between gap-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:flex-row lg:gap-6 {reserverBouton
      ? 'pb-16 sm:pb-20 lg:pb-0 lg:pr-28'
      : ''}"
  >
    <a href="/" class="inline-flex min-h-11 shrink-0 items-center gap-2">
      <div
        class="bg-gradient-to-br from-blue-500 to-blue-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20"
      >
        <span class="material-icons text-white text-sm" aria-hidden="true">balance</span>
      </div>
      <span class="font-bold text-slate-700 dark:text-white text-lg">JuriX</span>
    </a>

    <!-- Liens de 44 px de haut : à 20 px et serrés, ils se touchaient du doigt.
         `lg:shrink-0` : en ligne, c'est le copyright qui passe à la ligne, pas
         la navigation. -->
    <nav class="flex flex-wrap items-center justify-center gap-1 lg:shrink-0">
      {#each NAV_LINKS as lien (lien.href)}
        <a
          href={lien.href}
          class="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-secondary-text-light dark:text-secondary-text-dark/80 hover:text-primary transition-colors"
          >{$tr(lien.key)}</a
        >
      {/each}
    </nav>

    <!-- Centré sous les liens centrés : aligné à gauche, ce paragraphe de deux
         lignes avait l'air cassé sur téléphone. -->
    <p
      class="text-center text-xs text-secondary-text-light dark:text-secondary-text-dark/60 sm:text-sm lg:text-right"
    >
      {$tr("footer.rights")}
    </p>
  </div>
</footer>
