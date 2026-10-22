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
  $: retire = masque && !focalise;
</script>

<a
  href="/chat"
  data-testid="chat-fab"
  aria-label={$tr("mode.chat")}
  aria-hidden={retire ? "true" : undefined}
  tabindex={retire ? -1 : undefined}
  on:focus={() => (focalise = true)}
  on:blur={() => (focalise = false)}
  class="fixed right-4 sm:right-8 bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-[calc(2rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-2xl shadow-blue-500/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-blue-500/60 active:scale-95 motion-reduce:transition-none {retire
    ? 'pointer-events-none invisible translate-y-4 opacity-0'
    : ''}"
>
  <span class="material-icons text-2xl sm:text-3xl" aria-hidden="true">smart_toy</span>
</a>
