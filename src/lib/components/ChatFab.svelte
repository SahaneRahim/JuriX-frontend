<script lang="ts">
  /**
   * Bouton flottant « aller à l'assistant ».
   *
   * POURQUOI CE COMPOSANT. Le bouton existait en deux copies divergentes
   * (`src/routes/(main)/+layout.svelte` : 64 px en bas à 32 px du bord, z-50 ;
   * `src/routes/search/+page.svelte` : 56 px à 24 px, z-40). Sur téléphone, les
   * deux recouvraient le contenu qui défilait dessous (compteurs des cartes,
   * liens « Lire le texte complet », dernier bouton de pagination), et sur
   * l'iPhone ils se posaient sur la barre d'accueil.
   *
   * - Taille : 56 px sur téléphone, 64 px à partir de `sm`.
   * - Position : 16 px du bord sur téléphone, plus la zone sûre du bas
   *   (`env(safe-area-inset-bottom)`, 0 hors iPhone).
   * - z-40 : sous le panneau du menu mobile (z-50), qui doit le couvrir.
   *
   * Les pages qui le montent réservent de la place en bas (`SiteFooter
   * reserverBouton`, ou une marge basse sur <main>) pour que rien d'utile ne
   * reste dessous en fin de défilement.
   */
  import { onMount } from "svelte";
  import Icone from "$lib/components/Icone.svelte";
  import { tr } from "$lib/stores/language";

  /**
   * Retire le bouton de l'écran, de la tabulation et des lecteurs d'écran.
   *
   * Posé par l'accueil tant que son hero est visible (voir
   * `src/routes/(main)/+layout.svelte`). Faux par défaut : la recherche, qui
   * monte aussi ce bouton, le garde tel quel.
   *
   * `invisible` ne suffit pas : la visibilité ne bascule qu'à la FIN du
   * fondu. Pendant les 300 ms de la sortie, `pointer-events-none` laisse
   * déjà passer l'appui au bouton du dessous, et `tabindex=-1` et
   * `aria-hidden` sortent déjà le lien de la tabulation et des lecteurs
   * d'écran. Mouvement réduit : `motion-reduce:transition-none` supprime le
   * glissement, le bouton part et revient d'un coup.
   */
  export let masque = false;

  /**
   * Un bouton qui a le focus ne se retire pas. Remonter en haut de l'accueil
   * (touche Début) avec le focus dessus l'aurait rendu invisible, et le focus
   * avec lui. Il se retire à la perte du focus.
   */
  let focalise = false;

  /**
   * Contenu que le bouton ne doit pas couvrir, pour les pages qui n'ont pas
   * leur propre règle (l'accueil et la recherche ont la leur, `masque`) :
   * un sélecteur CSS (« [data-hors-du-bouton] »). Tant qu'une de ces zones
   * passe sous le bouton, il se retire ; il revient dès qu'on remonte la
   * page, le geste de qui cherche autre chose, ou quand la zone est finie
   * (le pied de page lui réserve sa place, `SiteFooter reserverBouton`).
   * C'est la règle de la recherche, appliquée à la boîte même du bouton :
   * sur un écran large, où la colonne de la page s'arrête avant lui, il
   * reste affiché.
   *
   * Sans elle, le bouton manquait aux pages des textes, des catégories et
   * de la comparaison : l'accès à l'assistant changeait d'une page à l'autre
   * de la même section. Posé sans retrait, il se serait assis sur la fin des
   * lignes et sur « Suivant », comme autrefois sur les résultats.
   */
  export let eviter: string | null = null;

  /** Marge autour du bouton dans laquelle une zone compte comme « dessous ». */
  const MARGE = 8;
  /** Défilement qui compte comme un geste : ni le rebond d'iOS ni un arrondi. */
  const SEUIL_DE_DEFILEMENT = 8;

  let lien: HTMLAnchorElement;
  // Retiré d'emblée, au rendu serveur comme avant la première mesure, comme
  // sur l'accueil et la recherche : affiché par défaut, il aurait glissé hors
  // de l'écran juste après l'hydratation, au-dessus d'un contenu.
  let masqueAuto = eviter !== null;

  onMount(() => {
    if (!eviter) return;
    const selecteur = eviter;
    let dernierDefilement = window.scrollY;
    let remonte = false;
    let imagePrevue = 0;

    function maj() {
      imagePrevue = 0;
      const y = window.scrollY;
      if (Math.abs(y - dernierDefilement) >= SEUIL_DE_DEFILEMENT) {
        remonte = y < dernierDefilement;
        dernierDefilement = y;
      }
      // La boîte du bouton, même retiré (`invisible` garde sa place ; le
      // glissement de 16 px tient dans la marge).
      const b = lien.getBoundingClientRect();
      const dessous = [...document.querySelectorAll(selecteur)].some((zone) => {
        const z = zone.getBoundingClientRect();
        return (
          z.width > 0 &&
          z.height > 0 &&
          z.left < b.right + MARGE &&
          z.right > b.left - MARGE &&
          z.top < b.bottom + MARGE &&
          z.bottom > b.top - MARGE
        );
      });
      masqueAuto = dessous && !remonte;
    }

    /** Une mesure par image au plus : le défilement émet bien plus d'événements. */
    function planifier() {
      if (!imagePrevue) imagePrevue = requestAnimationFrame(maj);
    }

    // La page change aussi sans défiler : un résultat de comparaison qui
    // s'affiche, un autre article du texte. La hauteur du document change
    // alors, et la mesure est refaite.
    const observateur = typeof ResizeObserver !== "undefined" ? new ResizeObserver(planifier) : null;
    observateur?.observe(document.body);

    maj();
    window.addEventListener("scroll", planifier, { passive: true });
    window.addEventListener("resize", planifier);
    return () => {
      observateur?.disconnect();
      window.removeEventListener("scroll", planifier);
      window.removeEventListener("resize", planifier);
      if (imagePrevue) cancelAnimationFrame(imagePrevue);
    };
  });

  $: retire = (masque || masqueAuto) && !focalise;
</script>

<a
  bind:this={lien}
  href="/chat"
  data-testid="chat-fab"
  aria-label={$tr("mode.chat")}
  aria-hidden={retire ? "true" : undefined}
  tabindex={retire ? -1 : undefined}
  on:focus={() => (focalise = true)}
  on:blur={() => (focalise = false)}
  class="fixed right-4 sm:right-8 bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-[calc(2rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border border-zinc-800 dark:border-zinc-200 shadow-2xl shadow-zinc-950/30 transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:active:scale-95 motion-reduce:transition-none {retire
    ? 'pointer-events-none invisible translate-y-4 opacity-0'
    : ''}"
>
  <Icone nom="bot" class="text-2xl sm:text-3xl" />
</a>
