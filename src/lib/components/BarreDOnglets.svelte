<script lang="ts">
  /**
   * La barre d'onglets du bas, au téléphone (refonte A, E3d, décision H6) :
   * Accueil · Assistant IA · Parcourir, à portée du pouce.
   *
   * OÙ ELLE PARAÎT. Sous md seulement, sur toutes les pages publiques, page
   * d'erreur comprise ; jamais sur /chat (sa saisie occupe le bas de l'écran),
   * dans l'administration ni sur les pages de compte (`barreDuBasSur`,
   * src/lib/nav.ts, que le pied de page lit aussi pour lui réserver sa
   * place). Montée par le layout racine, DANS l'enveloppe rendue inerte
   * derrière la palette (Ctrl K) et la boîte du profil : sinon elle resterait
   * focalisable sous leur fond.
   *
   * MASQUÉE SUR ÉCRAN COURT ET PENDANT LA SAISIE. Téléphone en paysage, ou
   * clavier ouvert sur Android (la fenêtre rétrécit sous 500 px de haut :
   * variante `court`), 64 px fixes prendraient un cinquième de l'écran et
   * couvriraient l'action de la page ; le bouton flottant de l'assistant y
   * revient (ChatFab.svelte). Sur un écran tactile, un champ qui a le focus
   * la masque aussi : sur iOS, le clavier la ferait flotter au milieu de
   * l'écran (style ci-dessous).
   *
   * POURQUOI `print:hidden`. Une barre fixe se répète sur chaque feuille, par
   * dessus le texte : une page imprimée, celle d'une loi d'abord, sort à la
   * largeur d'un téléphone (sous md), où elle paraîtrait.
   *
   * L'ONGLET COURANT porte `aria-current="page"` (et non la seule couleur) :
   * texte d'encre, icône agrandie, et un trait de 2 px au-dessus qui glisse
   * vers lui, en courbe commune (décision X2). Aucun onglet courant (/about,
   * /blog) : pas de trait.
   *
   * 64 px, plus la zone sûre d'un iPhone (barre d'accueil) : chaque onglet
   * fait le tiers de l'écran sur 64 px, bien au-delà des 44 px d'une cible.
   */
  import { page } from "$app/stores";
  import Icone from "$lib/components/Icone.svelte";
  import type { NomIcone } from "$lib/icones";
  import { ONGLETS_DU_BAS, barreDuBasSur } from "$lib/nav";
  import { tr } from "$lib/stores/language";

  /** L'icône de chaque onglet, par sa cible. */
  const ICONES: Record<string, NomIcone> = {
    "/": "house",
    "/chat": "sparkles",
    "/laws": "table-of-contents",
  };

  /** Les identifiants de test, par cible. */
  const NOMS: Record<string, string> = { "/": "accueil", "/chat": "chat", "/laws": "parcourir" };

  $: chemin = $page.url?.pathname ?? "/";
  $: visible = barreDuBasSur(chemin);
  $: courant = ONGLETS_DU_BAS.findIndex((onglet) => onglet.isActive(chemin));
</script>

{#if visible}
  <nav
    aria-label={$tr("entete.navigationMobile")}
    data-testid="barre-onglets"
    data-barre-du-bas
    class="barre fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] dark:border-zinc-800 dark:bg-background-dark md:hidden court:hidden print:hidden"
  >
    <div class="relative grid h-16 grid-cols-3 pb-1.5">
      <!-- Le trait de l'onglet courant : un tiers de la largeur, qui glisse
           par `transform` seul. -->
      <span
        aria-hidden="true"
        class="pointer-events-none absolute -top-px left-0 h-0.5 w-1/3 bg-zinc-950 dark:bg-white motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-jx {courant <
        0
          ? 'opacity-0'
          : ''}"
        style:transform="translateX({Math.max(courant, 0) * 100}%)"
      ></span>
      {#each ONGLETS_DU_BAS as onglet, rang (onglet.href)}
        <a
          href={onglet.href}
          aria-current={rang === courant ? "page" : undefined}
          data-testid="onglet-{NOMS[onglet.href]}"
          class="group flex min-h-11 flex-col items-center justify-center gap-[3px] text-[11px]/[14px] font-semibold motion-safe:transition-colors {rang ===
          courant
            ? 'text-zinc-950 dark:text-white'
            : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'}"
        >
          <Icone
            nom={ICONES[onglet.href]}
            class="text-[22px] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-jx motion-safe:group-active:scale-[0.88] {rang ===
            courant
              ? '-translate-y-px scale-110'
              : ''}"
          />
          {$tr(onglet.key)}
        </a>
      {/each}
    </div>
  </nav>
{/if}

<style>
  /*
   * POURQUOI CES RÈGLES GLOBALES. Elles disent ce que la barre change au
   * reste du document, là où elle paraît (sous md, hors écran court) :
   * - les ancres (`/#domaines`) et le focus clavier ne s'arrêtent pas sous
   *   elle (`scroll-padding-bottom`) ;
   * - sur un écran tactile, un champ de saisie qui a le focus la masque : le
   *   clavier virtuel est ouvert, et sur iOS une barre fixe en bas flotterait
   *   au-dessus de lui, sur le texte saisi.
   */
  @media (max-width: 767.98px) and (min-height: 500.02px) {
    :global(html:has([data-barre-du-bas])) {
      scroll-padding-bottom: calc(4rem + env(safe-area-inset-bottom));
    }
  }

  @media (pointer: coarse) {
    :global(
        html:has(
            :is(input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"]), textarea, select, [contenteditable="true"]):focus
          )
      )
      .barre {
      display: none;
    }
  }
</style>
