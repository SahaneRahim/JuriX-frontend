<script lang="ts">
  /**
   * Pied de page du site public.
   *
   * Le pied de page d'origine ne contenait AUCUN lien — seulement le logo et la
   * mention de droits. Il porte désormais la même liste `NAV_LINKS` que le
   * header : sur les pages longues (`/laws`, `/laws/[id]`, `/categories/[id]`),
   * c'est le seul retour disponible une fois le header défilé hors de l'écran.
   */
  import Icone from "$lib/components/Icone.svelte";
  import { NAV_LINKS } from "$lib/nav";
  import { tr } from "$lib/stores/language";

  /**
   * À poser sur les pages qui montent le bouton flottant de l'assistant
   * (`ChatFab`). En fin de défilement, il se posait sur le copyright au bureau
   * et sur les liens au téléphone. La réserve est une marge basse, à toutes
   * les tailles : le bouton (56 px à 16 px du bord, puis 64 px à 32 px à
   * partir de sm) se pose dessous. Elle était à droite en ligne (`lg:pr-28`) :
   * le copyright s'y repliait sur deux lignes, et la navigation du pied de
   * page sautait de 44 px entre l'accueil et les autres pages.
   */
  export let reserverBouton = false;

  /**
   * Faux sur la page d'erreur, qui pose déjà ces liens sous sa recherche :
   * sur téléphone, les deux listes se suivaient à 100 px d'écart, et la
   * navigation paraissait trois fois (menu, page, pied) sur une page presque
   * vide. Le logo et la mention de droits restent.
   */
  export let navigation = true;

  /**
   * Année du copyright, calculée au rendu : écrite en dur dans les textes, elle
   * affichait encore « © 2025 » en 2026. Une page servie par le cache ISR
   * garde l'année de sa génération, ce qui ne compte que dans les heures qui
   * suivent le 1er janvier.
   */
  const annee = new Date().getFullYear();
</script>

<!-- Marge basse augmentée de la zone sûre : sur iPhone, le copyright tombait
     sous la barre d'accueil. -->
<footer
  data-testid="site-footer"
  class="border-t border-zinc-200 dark:border-zinc-800 pt-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] bg-white dark:bg-zinc-950 mt-auto"
>
  <!-- Empilé et centré jusqu'à xl, en ligne au-delà : à md, les trois blocs
       côte à côte repliaient les liens sur deux lignes et le copyright sur
       trois ; à lg (1 024 px), le copyright laissait encore « pour tous. »
       seul sur sa seconde ligne. Mêmes marges latérales que l'en-tête
       (16 px, 24 px à partir de sm, 48 px à partir de lg, zone sûre comprise),
       sur toute la largeur : borné à 1 280 px, le logo du pied de page
       tombait à 104 px du bord en 1 440, celui de l'en-tête à 48.
       En ligne, une grille `1fr auto 1fr` et non `justify-between` : les
       liens étaient centrés entre le logo (85 px) et le copyright (350 px),
       donc vers 586 px en 1 440, et non sous la carte des pages de compte,
       centrée à 720. Deux colonnes égales autour d'eux les posent sur l'axe
       de la page ; le copyright, calé à droite, passe sur deux lignes
       équilibrées quand sa moitié ne lui suffit plus (de 1 280 à 1 375 px
       environ, en français). Sans les liens (page d'erreur), la colonne du
       milieu est vide : le logo et le copyright restent aux deux bords. -->
  <div
    class="flex flex-col items-center gap-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-12 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:gap-8 {reserverBouton
      ? 'pb-16 sm:pb-20'
      : ''}"
  >
    <!-- `xl:justify-self-start` : étiré sur toute sa colonne de grille, le
         lien aurait ramené à l'accueil d'un appui à côté du logo. Balance de
         16 px dans la tuile de 32 : la moitié de la tuile, comme celle de
         l'en-tête (18 px dans 36). En 14 px, elle n'était qu'une petite tache
         au centre du carré. -->
    <a href="/" class="inline-flex min-h-11 shrink-0 items-center gap-2.5 group xl:justify-self-start">
      <div
        class="bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm dark:shadow-none motion-safe:group-hover:scale-105 transition-transform"
      >
        <Icone nom="scale" class="text-base" />
      </div>
      <span class="font-extrabold text-zinc-950 dark:text-white text-base tracking-tight">JuriX</span>
    </a>

    <!-- Liens de 44 px de haut : à 20 px et serrés, ils se touchaient du doigt.
         Sur téléphone, une grille de trois colonnes : deux rangées égales,
         quand le retour à la ligne laissait un lien seul sur la seconde
         (« About », en anglais). Une seule ligne à partir de sm. En ligne,
         la colonne du milieu prend la largeur des liens : c'est le
         copyright qui passe à la ligne, pas la navigation. -->
    {#if navigation}
      <nav class="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:items-center sm:justify-center xl:col-start-2">
        {#each NAV_LINKS as lien (lien.href)}
          <a
            href={lien.href}
            class="inline-flex min-h-11 items-center justify-center rounded-lg px-2 sm:px-3 text-xs sm:text-sm text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors"
            >{$tr(lien.key)}</a
          >
        {/each}
      </nav>
    {/if}

    <!-- Centré sous les liens centrés : aligné à gauche, ce paragraphe de deux
         lignes avait l'air cassé sur téléphone. `text-balance` : replié, il
         se coupe en deux lignes égales, sans mot isolé. zinc-500 et non 400 :
         sur le blanc du pied de page, le zinc-400 ne fait que 2,6:1.
         `xl:col-start-3` : sans les liens, il serait venu au milieu. -->
    <p
      class="text-center text-balance text-xs text-zinc-500 dark:text-zinc-400 xl:col-start-3 xl:text-right font-normal"
    >
      {$tr("footer.rights").replace("{annee}", String(annee))}
    </p>
  </div>
</footer>
