<script context="module" lang="ts">
  /**
   * L'introduction du logo a-t-elle déjà joué dans ce document ?
   *
   * POURQUOI UNE VARIABLE DE MODULE. L'introduction (1,9 s) ne joue qu'une fois
   * par chargement du document (A1 § 1, PASSATION E2), pas à chaque navigation
   * interne. Or SiteHeader est monté par chaque page (seize pages, plus le
   * layout (main), commun à / et à /chat) : il est recréé à chaque navigation,
   * sauf entre / et /chat, et un état d'instance renaîtrait avec lui. L'état
   * du module, lui, vit autant que le document. Entre / et /chat, l'instance
   * survit, mais masquée sous lg : c'est `introTerminee`, plus bas, qui l'y
   * garde au repos.
   *
   * POURQUOI DANS LE NAVIGATEUR SEULEMENT. Sur le serveur, un module est chargé
   * une fois pour toutes les requêtes : écrit là, ce drapeau priverait
   * d'introduction tous les visiteurs suivants. Il n'est donc lu que si
   * `browser` est vrai, et écrit dans `onMount`, qui ne tourne jamais sur le
   * serveur.
   */
  let introDejaJouee = false;
</script>

<script lang="ts">
  /**
   * La balance de JuriX, animée : elle pèse.
   *
   * - `intro` : le logo, une fois par chargement du document (1,9 s, après
   *   0,35 s) ; aux montages suivants, et dès que l'introduction est finie ou
   *   coupée, la balance est droite (`repos`) ;
   * - `attente` : l'IA pèse pendant une attente RÉELLE (recherche,
   *   comparaison, explication, réponse du chat), en boucle tant qu'elle dure ;
   * - `repos` : droite, immobile.
   *
   * POURQUOI UN COMPOSANT, ET NON <Icone nom="scale">. `Icone` rend les cinq
   * tracés à plat. Pour que le fléau pivote pendant que les plateaux
   * contre-pivotent (ils restent à l'horizontale, comme une vraie balance),
   * les tracés doivent être regroupés : le mât et la base restent fixes, le
   * fléau porte les deux plateaux (A2 § 3.1). Les tracés viennent du registre
   * (`elementsIcone('scale')`) : aucun SVG recopié à la main, et la balance
   * suit le registre s'il change de version (BalanceAnimee.test.ts vérifie la
   * répartition des tracés).
   *
   * POURQUOI RIEN NE BOUGE ICI. Le composant n'écrit que le balisage et la
   * classe d'état ; les @keyframes vivent dans src/lib/mouvement.css, sous
   * prefers-reduced-motion: no-preference. En mouvement réduit, sans
   * JavaScript ou avant l'hydratation, la balance est droite et lisible.
   *
   * ACCESSIBILITÉ. Toujours décorative (`aria-hidden`), jamais de `role` :
   * l'attente est dite par le texte d'étape de l'appelant (région
   * `role="status"` de la page ; dans le chat, la seule région d'annonce est
   * `chat-announce` : n'en ajouter aucune).
   */
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { elementsIcone, type ElementIcone } from "$lib/icones";

  /** L'état de la balance. */
  export let etat: "repos" | "intro" | "attente" = "repos";

  let className = "";
  /** Classes ajoutées : taille (`text-xl`, `w-5 h-5`), couleur. */
  export { className as class };

  /**
   * L'introduction est-elle encore permise à cette instance ? Lu une fois, à
   * sa création. Au rendu serveur et à l'hydratation du premier chargement,
   * oui : la classe d'introduction arrive dans le HTML, l'animation CSS part
   * sans attendre le JavaScript, et l'hydratation ne change rien à la classe
   * (l'animation n'est ni coupée ni relancée). À tout montage suivant, non.
   */
  const introPermise = !browser || !introDejaJouee;

  /**
   * L'introduction de CETTE instance est-elle finie, ou interrompue ?
   *
   * POURQUOI, EN PLUS DU DRAPEAU DE MODULE. Le drapeau ne vaut que pour les
   * montages suivants. Or l'en-tête du layout (main) n'est pas recréé entre /
   * et /chat : sur /chat, sous lg, il est seulement masqué (`hidden lg:block`
   * autour de lui, (main)/+layout.svelte), et sa balance gardait la classe
   * d'introduction. Une animation CSS repart de zéro chaque fois que son
   * élément sort de `display: none` : au retour sur l'accueil, la balance
   * pesait de nouveau, à chaque aller-retour entre l'accueil et l'assistant
   * sur un téléphone ou une tablette, et à chaque passage de 1 024 px d'une
   * tablette qu'on tourne sur /chat. Finie (`animationend`) ou coupée par le
   * masquage (`animationcancel`), l'introduction laisse donc l'instance au
   * repos, pour toujours. Sa dernière image est le repos : rien ne saute.
   * Premier chargement sur /chat sous lg : l'en-tête est masqué d'emblée,
   * l'introduction n'y a jamais joué ; elle joue une fois, au premier passage
   * sur l'accueil.
   */
  let introTerminee = false;

  /** L'état dessiné : une introduction déjà jouée, ou finie, retombe au repos. */
  $: etatDessine = etat === "intro" && (!introPermise || introTerminee) ? "repos" : etat;

  /** Le dessin, pour y écouter la fin de l'introduction. */
  let dessin: SVGSVGElement;

  onMount(() => {
    if (etat === "intro") introDejaJouee = true;
    const element = dessin;
    // Une attente qui s'arrête (`attente` → `repos`) coupe aussi son
    // animation : seule une introduction est concernée.
    const finirLIntroduction = () => {
      if (etat === "intro") introTerminee = true;
    };

    // POURQUOI CE CONSTAT AU MONTAGE. Sur un réseau lent, le JavaScript arrive
    // après la fin de l'introduction (2,25 s), partie sans lui avec le HTML du
    // serveur : son `animationend` est passé avant que l'écouteur n'existe,
    // et le premier aller-retour par /chat la rejouait. Une balance affichée
    // dont le fléau n'a aucune animation en cours a donc fini son
    // introduction (ou ne la jouera pas : mouvement réduit). Pendant le délai
    // de 0,35 s, l'animation compte déjà parmi celles en cours. Masquée
    // (premier chargement sur /chat sous lg, aucune boîte), elle n'a pas
    // encore joué : on attend qu'elle se montre. Sans `getAnimations` (jsdom,
    // navigateur ancien), les écouteurs seuls font le travail.
    const groupeDuFleau = element.querySelector(".mv-balance__fleau");
    if (
      etat === "intro" &&
      introPermise &&
      element.getClientRects().length > 0 &&
      typeof groupeDuFleau?.getAnimations === "function" &&
      groupeDuFleau.getAnimations().length === 0
    ) {
      finirLIntroduction();
    }

    // POURQUOI addEventListener, ET NON on:animationend / on:animationcancel :
    // svelte/elements ne type pas `animationcancel`, et svelte-check refuse
    // la directive ; les deux événements passent donc par le même chemin.
    // Ils remontent des <g> animés (le fléau, les plateaux) jusqu'au <svg>.
    element.addEventListener("animationend", finirLIntroduction);
    element.addEventListener("animationcancel", finirLIntroduction);
    return () => {
      element.removeEventListener("animationend", finirLIntroduction);
      element.removeEventListener("animationcancel", finirLIntroduction);
    };
  });

  /**
   * Les cinq tracés de `scale`, dans l'ordre du registre (Lucide) : le mât,
   * le plateau droit, le fléau, le plateau gauche, la base. Un tracé
   * manquant (registre changé) laisserait la balance incomplète : le test
   * le signale.
   */
  const [mat, plateauDroit, fleau, plateauGauche, base]: readonly (ElementIcone | undefined)[] =
    elementsIcone("scale");
</script>

<svg
  bind:this={dessin}
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  width="1em"
  height="1em"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  class="icone mv-balance mv-balance--{etatDessine}{className ? ` ${className}` : ''}"
  data-icone="scale"
  data-etat={etatDessine}
  aria-hidden="true"
  focusable="false"
>
  {#if mat}<svelte:element this={mat.balise} {...mat.attributs} />{/if}
  {#if base}<svelte:element this={base.balise} {...base.attributs} />{/if}
  <g class="mv-balance__fleau">
    {#if fleau}<svelte:element this={fleau.balise} {...fleau.attributs} />{/if}
    <g class="mv-balance__plateau-g">
      {#if plateauGauche}<svelte:element this={plateauGauche.balise} {...plateauGauche.attributs} />{/if}
    </g>
    <g class="mv-balance__plateau-d">
      {#if plateauDroit}<svelte:element this={plateauDroit.balise} {...plateauDroit.attributs} />{/if}
    </g>
  </g>
</svg>
