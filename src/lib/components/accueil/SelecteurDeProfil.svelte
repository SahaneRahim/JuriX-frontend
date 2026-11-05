<script lang="ts">
  /**
   * « Je suis » : le choix du profil sur l'accueil (refonte A, E3b), quatre
   * boutons et « Sans profil ».
   *
   * LE MÊME PROFIL QUE LE CHAT. Ce n'est pas un second sélecteur : il lit et
   * écrit `personaStore`, la mémoire du profil de tout le site. Un clic sur un
   * profil passe par `changerPersona` (le navigateur, puis le compte d'un
   * utilisateur connecté), « Sans profil » par `refuserPourCetteSession` (la
   * visite seulement, jamais envoyé au compte : le même effet que « Continuer
   * sans profil » dans le fil du chat). Le chat ne repose donc plus la
   * question (P5) à qui a choisi ici.
   *
   * POURQUOI AUCUN PROFIL N'EST PRÉ-SÉLECTIONNÉ (décision H2 ⚑). La maquette
   * montre « Citoyen » choisi d'emblée ; marquer un profil que personne n'a
   * choisi serait trompeur (le chat le redemanderait). Sans choix, aucune
   * pastille, et l'accueil montre les exemples du profil général.
   *
   * POURQUOI LE PROFIL N'EST LU QU'APRÈS LE MONTAGE. Le serveur ne voit pas
   * la mémoire du navigateur (localStorage, cookie) et l'accueil est mis en
   * cache, le même pour tous : il rend « aucun profil ». Lire le profil dès
   * l'hydratation donnerait un HTML de client différent de celui du serveur ;
   * il arrive juste après, et la pastille apparaît alors à sa place.
   *
   * POURQUOI LA PASTILLE EST MESURÉE, ET GLISSE PAR `transform`. Les libellés
   * n'ont pas la même longueur (« Lawyer or legal professional » fait 174 px
   * en anglais, « Citizen » 44 : mesurés en Inter 13 px) : quatre colonnes
   * égales coupaient les plus longs, et le `translateX(rang × 100 %)` de la
   * maquette ne vaut que pour elles. Les boutons gardent leur largeur
   * naturelle, et la pastille d'encre est posée sur le bouton choisi, à sa
   * taille mesurée. Le glissement se rejoue ensuite de l'ancienne place à la
   * nouvelle, par `transform` seul (API Web Animations), en courbe commune,
   * sans dépassement (décision X2) : `left` et `width` changent d'un coup, et
   * ne s'animent jamais (A2 § 1).
   *
   * POURQUOI PAS UN `clip-path`. Une pastille de toute la piste, découpée au
   * bouton choisi, se dessinait de même et glissait en CSS seul ; mais axe ne
   * lit pas `clip-path` : il voyait le texte des autres boutons sur de l'encre
   * (2,57:1). La boîte réelle de la pastille est aussi celle de l'écran.
   *
   * Sous md, les boutons ne montrent que leur icône, en quatre colonnes
   * égales ; leur nom reste leur nom accessible.
   */
  import { onDestroy, onMount, tick } from "svelte";
  import Icone from "$lib/components/Icone.svelte";
  import { COURBE, duree } from "$lib/mouvement";
  import { changerPersona, refuserPourCetteSession } from "$lib/persona-compte";
  import { tr } from "$lib/stores/language";
  import { PERSONAS, PERSONA_ICONE, PERSONA_SLUG, personaStore, type Persona } from "$lib/stores/persona";

  let monte = false;
  let piste: HTMLDivElement | undefined;
  let pastille: HTMLSpanElement | undefined;
  let boutons: HTMLButtonElement[] = [];
  let observateur: ResizeObserver | null = null;

  /** Durée du glissement de la pastille (A2 § 4). */
  const GLISSEMENT = 500;

  /** La place du bouton choisi, dans la piste. */
  type Place = { gauche: number; haut: number; largeur: number; hauteur: number };

  /** La place de la pastille, mesurée ; nulle tant qu'aucun profil n'a été placé. */
  let place: Place | null = null;
  /** Le profil sous lequel la pastille est visible : elle ne glisse que depuis lui. */
  let profilPlace: Persona | null = null;

  // Après le montage seulement (voir l'en-tête) : au serveur, aucun profil.
  $: etat = monte ? $personaStore : null;
  $: choisi = etat?.persona ?? null;
  // « Sans profil » n'est actif que sur un refus de la visite : sans choix ni
  // refus, aucun des cinq boutons n'est pressé.
  $: sansProfil = etat !== null && etat.persona === null && etat.refuseCetteSession;

  /** « Je suis : Citoyen », la ligne du téléphone, coupée autour du nom. */
  $: [avantLeNom, apresLeNom] = $tr("accueil.champ.jeSuisProfil").split("{profil}");
  $: nomChoisi = choisi ? $tr(`persona.${PERSONA_SLUG[choisi]}.nom`) : "";

  /**
   * Pose la pastille sur le bouton choisi. Sans profil, elle reste où elle est,
   * et s'efface. `glisser` : elle vient d'une autre place, sous les yeux ; un
   * redimensionnement, lui, la pose d'un coup. L'animation part de l'ancienne
   * place et finit sur le style réel : rien ne reste à lever à la fin, et sans
   * `animate` (ou en mouvement réduit), elle est simplement à sa place.
   */
  function placer(glisser: boolean) {
    const index = choisi ? PERSONAS.indexOf(choisi) : -1;
    const bouton = index >= 0 ? boutons[index] : undefined;
    if (!bouton) return;
    const avant = place;
    const nouvelle: Place = {
      gauche: bouton.offsetLeft,
      haut: bouton.offsetTop,
      largeur: bouton.offsetWidth,
      hauteur: bouton.offsetHeight,
    };
    place = nouvelle;
    const duration = duree(GLISSEMENT);
    if (!glisser || !avant || duration === 0 || nouvelle.largeur === 0 || !pastille?.animate) return;
    pastille.animate(
      [
        { transform: `translateX(${avant.gauche - nouvelle.gauche}px) scaleX(${avant.largeur / nouvelle.largeur})` },
        { transform: "none" },
      ],
      { duration, easing: COURBE },
    );
  }

  /** La pastille suit le profil, une fois les libellés à jour dans la page. */
  function surProfil(profil: Persona | null) {
    const glisser = profilPlace !== null && profil !== null && profil !== profilPlace;
    profilPlace = profil;
    void tick().then(() => placer(glisser));
  }

  // Le profil change (clic, autre onglet, compte) : la pastille suit.
  $: if (monte) surProfil(choisi);

  onMount(() => {
    monte = true;
    // La largeur des boutons change avec la langue, la police qui arrive
    // tard et le point de rupture : la pastille se repose alors.
    if (typeof ResizeObserver !== "undefined") {
      observateur = new ResizeObserver(() => placer(false));
      if (piste) observateur.observe(piste);
      for (const bouton of boutons) if (bouton) observateur.observe(bouton);
    }
  });

  onDestroy(() => observateur?.disconnect());

  function choisir(persona: Persona) {
    if (choisi === persona) return;
    void changerPersona(persona);
  }

  function refuser() {
    if (sansProfil) return;
    refuserPourCetteSession();
  }

  const LIBELLE = "text-[13px] font-semibold";
  const ETEINT = "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white";
</script>

<!--
  Un seul groupe, deux mises en page. Sous md (téléphone, petite tablette) :
  « Je suis : Citoyen » et « Sans profil » sur la première ligne, les quatre
  icônes en dessous, sur toute la largeur (maquette mobile). À partir de md :
  une rangée, « Je suis » (dès lg), la piste à libellés, « Sans profil ».
  L'ordre visuel (`order-*`) place « Sans profil » en haut à droite au
  téléphone ; l'ordre du clavier reste celui du DOM : les profils, puis
  « Sans profil ».
-->
<div
  role="group"
  aria-label={$tr("accueil.champ.jeSuis")}
  data-testid="accueil-profil"
  class="flex flex-wrap items-center gap-x-3 gap-y-1.5 md:flex-nowrap"
>
  <p class="order-1 mx-1 min-w-0 flex-1 truncate text-[13px] leading-5 text-zinc-600 dark:text-zinc-400 md:hidden">
    {#if choisi}{avantLeNom}<strong class="font-semibold text-zinc-950 dark:text-white">{nomChoisi}</strong
      >{apresLeNom}{:else}{$tr("accueil.champ.jeSuis")}{/if}
  </p>
  <span aria-hidden="true" class="order-1 hidden shrink-0 pl-1 {LIBELLE} text-zinc-600 dark:text-zinc-400 lg:inline"
    >{$tr("accueil.champ.jeSuis")}</span
  >

  <div
    bind:this={piste}
    class="relative order-3 grid w-full grid-cols-4 rounded-xl bg-zinc-100 p-[3px] dark:bg-zinc-800 md:order-2 md:flex md:w-auto md:min-w-0 md:flex-1"
  >
    <!-- La pastille d'encre, sous les boutons, sur le bouton choisi. Elle
         s'efface sans profil : seule son opacité est une transition. -->
    <span
      bind:this={pastille}
      aria-hidden="true"
      data-testid="accueil-profil-pastille"
      class="pointer-events-none absolute origin-left rounded-lg bg-zinc-950 dark:bg-white motion-safe:transition-opacity motion-safe:duration-500 motion-safe:ease-jx {choisi &&
      place
        ? 'opacity-100'
        : 'opacity-0'}"
      style:left={place ? `${place.gauche}px` : null}
      style:top={place ? `${place.haut}px` : null}
      style:width={place ? `${place.largeur}px` : null}
      style:height={place ? `${place.hauteur}px` : null}
    ></span>
    {#each PERSONAS as persona, index (persona)}
      <button
        bind:this={boutons[index]}
        type="button"
        aria-pressed={choisi === persona}
        data-testid="accueil-profil-{PERSONA_SLUG[persona]}"
        on:click={() => choisir(persona)}
        class="relative z-10 flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 {LIBELLE} motion-safe:transition-colors motion-safe:duration-200 md:min-h-[34px] md:flex-auto [@media(pointer:coarse)]:min-h-11 {choisi ===
        persona
          ? 'text-white dark:text-zinc-950'
          : ETEINT}"
      >
        <Icone nom={PERSONA_ICONE[persona]} class="text-xl md:text-[15px]" />
        <span class="sr-only md:not-sr-only md:whitespace-nowrap">{$tr(`persona.${PERSONA_SLUG[persona]}.nom`)}</span>
      </button>
    {/each}
  </div>

  <!-- « Sans profil » : le profil général, pour cette visite (`title` : la
       phrase du chat, « Continuer sans profil »). Souligné quand il est
       choisi : un mot, pas seulement une couleur. -->
  <button
    type="button"
    aria-pressed={sansProfil}
    title={$tr("chat.profile.skip")}
    data-testid="accueil-profil-sans"
    on:click={refuser}
    class="order-2 min-h-11 shrink-0 rounded-lg px-1.5 {LIBELLE} underline-offset-4 motion-safe:transition-colors motion-safe:duration-200 md:order-3 md:min-h-[34px] [@media(pointer:coarse)]:min-h-11 {sansProfil
      ? 'text-zinc-950 underline dark:text-white'
      : ETEINT}"
  >
    {$tr("accueil.champ.sansProfil")}
  </button>
</div>
