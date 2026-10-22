<script lang="ts">
  import { tr } from "$lib/stores/language";
  import { onDestroy, onMount, tick } from "svelte";

  // Expects the base URL to the law (e.g., /api/v1/laws/123)
  export let url: string;
  export let initialPage = 1; // Optional: start at specific page (for article navigation)

  let pageNum = 1;
  let totalPages = 0;
  // Annotees explicitement : initialisees a `null`, elles etaient inferees
  // `null` tout court, et toute affectation d'une chaine plus loin devenait une
  // erreur sous `strict`.
  let error: string | null = null;
  let loading = true;
  let pageLoading = false;
  let currentImageUrl: string | null = null;

  /**
   * Zoom d'AFFICHAGE, distinct de la resolution demandee au serveur.
   *
   * Les boutons +/- changeaient le DPI demande (72 a 200), puis l'image etait
   * ramenee a la largeur du cadre par `max-width: 100%` : rien ne grossissait a
   * l'ecran, et chaque appui retelechargeait une image plus lourde. Sur un
   * telephone de 360 px, une page A4 tenait sur environ 244 px (un texte de
   * 10 points y mesurait 4 px) et le seul recours etait de zoomer toute la
   * page au doigt, ce qui cassait la mise en page.
   *
   * L'image prend maintenant `zoom × 100 %` de la largeur du cadre, qui defile
   * dans les deux sens. 1 = page ajustee a la largeur.
   */
  const NIVEAUX_ZOOM = [1, 1.5, 2, 3];
  let zoom = 1;

  /**
   * Resolution demandee au serveur, par paliers.
   *
   * Calculee sur les pixels reellement affiches (largeur du cadre × zoom ×
   * densite de l'ecran) au lieu d'un 120 fixe : un telephone recoit une image
   * plus legere au zoom 1, un grand ecran une image nette. Des paliers plutot
   * qu'une valeur au pixel pres : /page/{n} est mis en cache 24 h PAR ADRESSE
   * (`Cache-Control`), et des DPI tous differents ne se resserviraient jamais
   * d'un zoom ou d'un ecran a l'autre. Bornes de l'API : 72 a 200.
   */
  const PALIERS_DPI = [72, 96, 120, 150, 200];
  /** L'ancienne valeur fixe, tant que la largeur du cadre est inconnue. */
  const DPI_PAR_DEFAUT = 120;
  /** DPI de l'image affichee ; 0 tant qu'aucune ne l'est. */
  let dpiImage = 0;
  /** Page de l'image affichee : elle reste visible pendant que la suivante charge. */
  let pageAffichee = 0;
  /**
   * Largeur de la page, en pouces. A4 portrait (8,27) faute de mieux :
   * /pdf-info ne donne pas les dimensions. Corrigee des la premiere image
   * recue, dont la largeur en pixels divisee par son DPI donne la vraie.
   */
  let poucesDeLargeur = 8.27;
  /** Jeton anti-course : seule la derniere page demandee s'affiche. */
  let derniereDemande = 0;

  /** Cadre qui defile ; sa largeur fixe la resolution demandee. */
  let cadre: HTMLDivElement | undefined;

  // Extract law ID from URL

  // Get the base API URL
  function getBaseUrl(lawUrl: string): string {
    // Convert download URL to base law URL
    return lawUrl.replace("/download", "");
  }

  // Keyboard navigation handler
  function handleKeydown(event: KeyboardEvent) {
    if (
      totalPages === 0 ||
      // `activeElement` est nul quand aucun element n'a le focus — au premier
      // rendu, ou apres un clic dans le vide. Le lire sans garde levait alors
      // une exception qui avalait toute la navigation au clavier.
      document.activeElement?.tagName === "INPUT" ||
      document.activeElement?.tagName === "TEXTAREA"
    ) {
      return;
    }

    // Page agrandie et cadre sous le focus : les fleches le font defiler,
    // comme toute zone qui defile. Sans cela, la partie hors cadre d'une page
    // agrandie restait hors d'atteinte au clavier ; tourner la page reste aux
    // boutons.
    if (zoom > 1 && cadre?.contains(document.activeElement)) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onPrevPage();
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onNextPage();
    }
  }

  onMount(async () => {
    window.addEventListener("keydown", handleKeydown);

    try {
      const baseUrl = getBaseUrl(url);
      console.log("Fetching PDF info from:", `${baseUrl}/pdf-info`);

      // Get PDF info (page count)
      const infoResponse = await fetch(`${baseUrl}/pdf-info`);
      if (!infoResponse.ok) {
        throw new Error(
          `HTTP ${infoResponse.status}: ${infoResponse.statusText}`,
        );
      }

      const pdfInfo = await infoResponse.json();
      totalPages = pdfInfo.page_count;
      console.log(`PDF has ${totalPages} pages`);

      loading = false;
      // Le cadre doit exister pour etre mesure : c'est sa largeur qui fixe la
      // resolution de la premiere page.
      await tick();

      // Load initial page (use initialPage prop if valid, otherwise page 1)
      const startPage =
        initialPage > 0 && initialPage <= totalPages ? initialPage : 1;
      await loadPage(startPage);
    } catch (err) {
      console.error("Error loading PDF info:", err);
      // `err` est typé `unknown` : c'est le type réel de ce qu'un `throw` peut
      // produire. Le contrôle explicite remplace l'accès direct à `.message`,
      // qui échouait sur tout ce qui n'est pas une Error.
      error =
        $tr("pdf.errorLoad") + " " +
        (err instanceof Error ? err.message : $tr("pdf.errorUnknown"));
      loading = false;
    }
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", handleKeydown);
    }
    clearTimeout(minuterieRedimensionnement);
    revoquerImage();
  });

  /** Le plus petit palier qui couvre les pixels affiches, densite comprise. */
  function dpiNecessaire(): number {
    const largeur = cadre?.clientWidth ?? 0;
    if (!largeur) return DPI_PAR_DEFAUT;
    const pixels = largeur * zoom * (window.devicePixelRatio || 1);
    const besoin = pixels / poucesDeLargeur;
    return PALIERS_DPI.find((palier) => palier >= besoin) ?? PALIERS_DPI[PALIERS_DPI.length - 1];
  }

  async function loadPage(num: number) {
    if (num < 1 || num > totalPages) return;

    const jeton = ++derniereDemande;
    const dpi = dpiNecessaire();
    pageLoading = true;
    pageNum = num;

    try {
      const baseUrl = getBaseUrl(url);
      const pageUrl = `${baseUrl}/page/${num}?dpi=${dpi}`;
      console.log(`Loading page ${num}:`, pageUrl);

      // Preload image
      const response = await fetch(pageUrl);
      if (!response.ok) {
        throw new Error(`Failed to load page ${num}`);
      }

      const blob = await response.blob();
      // Une demande plus recente est partie entre-temps (fleches tenues au
      // clavier, zoom pendant le chargement) : celle-ci ne correspond plus a
      // l'ecran. L'afficher pouvait montrer la page 3 sous le numero 5.
      if (jeton !== derniereDemande) return;
      // Libérer l'URL précédente AVANT d'en créer une nouvelle. Sans ce
      // révocation, chaque tourne-page laissait un blob vivant en mémoire
      // jusqu'au rechargement de l'onglet : sur un code de 200 pages, deux
      // cents images retenues pour une seule affichée.
      revoquerImage();
      currentImageUrl = URL.createObjectURL(blob);
      dpiImage = dpi;
      // Nouvelle page : on la reprend en haut, en gardant le decalage
      // horizontal (la colonne en cours de lecture sur une page agrandie).
      if (pageAffichee !== num && cadre) cadre.scrollTop = 0;
      pageAffichee = num;
      pageLoading = false;
      // Le cadre ou le zoom ont pu changer pendant le chargement.
      verifierResolution();
    } catch (err) {
      if (jeton !== derniereDemande) return;
      console.error(`Error loading page ${num}:`, err);
      pageLoading = false;
      // Echec d'une simple montee en resolution (zoom sur une connexion
      // mobile faible) : la page affichee reste lisible, la remplacer par un
      // message d'erreur ferait tout perdre au lecteur.
      if (num === pageAffichee && currentImageUrl) return;
      error = $tr("pdf.errorPage").replace("{n}", String(num));
    }
  }

  /**
   * Recharge la page affichee si l'ecran demande plus de pixels qu'elle n'en
   * a : zoom augmente, telephone tourne, fenetre elargie. Jamais dans l'autre
   * sens — reduire ne retelecharge rien, l'image deja la suffit.
   */
  function verifierResolution(_zoom?: number) {
    if (!currentImageUrl || pageLoading) return;
    if (dpiNecessaire() > dpiImage) void loadPage(pageNum);
  }

  $: verifierResolution(zoom);

  // La largeur du cadre ne change qu'avec celle de la fenetre (rotation,
  // redimensionnement) : l'evenement `resize` suffit, sans ResizeObserver.
  // Regroupe sur 200 ms : tirer une fenetre au bureau en emet des dizaines,
  // et chaque palier franchi aurait demande un rendu au serveur.
  let minuterieRedimensionnement: ReturnType<typeof setTimeout> | undefined;

  function surRedimensionnement() {
    clearTimeout(minuterieRedimensionnement);
    minuterieRedimensionnement = setTimeout(() => verifierResolution(), 200);
  }

  /** Corrige la largeur de page supposee (A4) sur l'image reellement recue. */
  function surImageChargee(event: Event) {
    const image = event.currentTarget as HTMLImageElement;
    if (image.naturalWidth && dpiImage) poucesDeLargeur = image.naturalWidth / dpiImage;
    verifierResolution();
  }

  /** Libère le blob de la page affichée, s'il y en a un. */
  function revoquerImage() {
    if (currentImageUrl) {
      URL.revokeObjectURL(currentImageUrl);
      currentImageUrl = "";
    }
  }

  function onPrevPage() {
    if (pageNum <= 1) return;
    loadPage(pageNum - 1);
  }

  function onNextPage() {
    if (pageNum >= totalPages) return;
    loadPage(pageNum + 1);
  }

  function goToPage(num: string | number) {
    const targetPage = parseInt(String(num), 10);
    if (targetPage >= 1 && targetPage <= totalPages) {
      loadPage(targetPage);
    }
  }

  /**
   * Change le zoom en gardant sous les yeux le meme point de la page : sans
   * cela, chaque agrandissement ramenait au coin haut-gauche.
   */
  async function changerZoom(niveau: number) {
    if (niveau === zoom) return;
    const zone = cadre;
    const centreX = zone?.scrollWidth
      ? (zone.scrollLeft + zone.clientWidth / 2) / zone.scrollWidth
      : 0;
    const centreY = zone?.scrollHeight
      ? (zone.scrollTop + zone.clientHeight / 2) / zone.scrollHeight
      : 0;
    zoom = niveau;
    await tick();
    if (zone) {
      zone.scrollLeft = centreX * zone.scrollWidth - zone.clientWidth / 2;
      zone.scrollTop = centreY * zone.scrollHeight - zone.clientHeight / 2;
    }
  }

  function zoomIn() {
    const suivant = NIVEAUX_ZOOM.find((niveau) => niveau > zoom);
    if (suivant !== undefined) void changerZoom(suivant);
  }

  function zoomOut() {
    const precedent = NIVEAUX_ZOOM.filter((niveau) => niveau < zoom).pop();
    if (precedent !== undefined) void changerZoom(precedent);
  }

  function ajusterALaLargeur() {
    void changerZoom(NIVEAUX_ZOOM[0]);
  }

  // Une image de la page precedente reste affichee, estompee, pendant que la
  // suivante charge. Une simple amelioration de resolution, elle, ne l'estompe
  // pas : c'est la meme page.
  $: estompee = pageLoading && pageAffichee !== pageNum;
</script>

<svelte:window on:resize={surRedimensionnement} />

<!--
  Plus de hauteur minimale de 500 px (plus haute qu'un telephone en paysage), ni
  de marge de 1rem dans la carte deja marginee : la page gagne la largeur. Les
  couleurs ont leur pendant sombre ; la visionneuse restait blanche en mode
  sombre.
-->
<div
  class="pdf-viewer flex w-full flex-col items-center gap-2 bg-slate-50 p-2 sm:gap-3 sm:p-4 dark:bg-slate-900"
>
  {#if loading}
    <div
      class="loading-container flex min-h-64 w-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-600 dark:text-slate-300"
      role="status"
    >
      <div
        class="h-12 w-12 rounded-full border-4 border-slate-200 border-t-blue-600 motion-safe:animate-spin dark:border-slate-700 dark:border-t-blue-400"
        aria-hidden="true"
      ></div>
      <p>{$tr("pdf.loading")}</p>
    </div>
  {:else if error}
    <div
      class="error-container flex min-h-64 w-full flex-col items-center justify-center gap-2 px-4 text-center"
      role="alert"
    >
      <p class="error-message coupe-mots font-semibold text-red-600 dark:text-red-400">{error}</p>
      <p class="error-hint text-sm text-slate-500 dark:text-slate-400">{$tr("pdf.errorHint")}</p>
    </div>
  {:else}
    <!--
      Deux groupes qui passent a la ligne en bloc, centres : les pages, puis le
      zoom. L'ancien separateur (bordure et marge a gauche du zoom) restait
      accroche en debut de ligne une fois le groupe renvoye dessous. Boutons de
      44 px sous `sm` ; Precedent / Suivant n'y sont plus que des fleches,
      nommees par aria-label.
    -->
    <div
      class="controls flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-lg bg-white p-2 text-sm text-slate-700 shadow-sm sm:w-auto sm:px-4 dark:bg-slate-800 dark:text-slate-200"
    >
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex h-11 min-w-11 items-center justify-center rounded-md bg-blue-600 px-2 font-medium text-white transition-colors enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 sm:h-9 sm:px-4 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          on:click={onPrevPage}
          disabled={pageNum <= 1 || pageLoading}
          aria-label={$tr("pdf.previousPage")}
        >
          <span class="material-icons sm:hidden" aria-hidden="true">chevron_left</span>
          <span class="hidden sm:inline">{$tr("pdf.previous")}</span>
        </button>
        <span class="page-info flex items-center gap-1.5 whitespace-nowrap">
          {$tr("pdf.page")}
          <!-- 16 px sous `sm` : en dessous, iOS zoome sur la page au focus. -->
          <input
            type="number"
            inputmode="numeric"
            aria-label={$tr("a11y.pageNumber")}
            min="1"
            max={totalPages}
            value={pageNum}
            on:change={(e) => goToPage((e.currentTarget as HTMLInputElement).value)}
            disabled={pageLoading}
            class="h-11 w-14 rounded-md border-slate-300 bg-white px-1 text-center text-base text-slate-900 sm:h-9 sm:w-16 sm:text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
          {$tr("pdf.of")} {totalPages}
        </span>
        <button
          type="button"
          class="inline-flex h-11 min-w-11 items-center justify-center rounded-md bg-blue-600 px-2 font-medium text-white transition-colors enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 sm:h-9 sm:px-4 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          on:click={onNextPage}
          disabled={pageNum >= totalPages || pageLoading}
          aria-label={$tr("pdf.nextPage")}
        >
          <span class="material-icons sm:hidden" aria-hidden="true">chevron_right</span>
          <span class="hidden sm:inline">{$tr("pdf.next")}</span>
        </button>
      </div>

      <!-- Le zoom ne retelecharge rien quand l'image deja recue suffit : ses
           boutons restent actifs pendant un chargement. -->
      <div class="zoom-controls flex items-center gap-1">
        <button
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-slate-700 transition-colors enabled:hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9 dark:bg-slate-700 dark:text-slate-100 dark:enabled:hover:bg-slate-600"
          on:click={zoomOut}
          disabled={zoom <= NIVEAUX_ZOOM[0]}
          aria-label={$tr("pdf.zoomOut")}
          title={$tr("pdf.zoomOut")}
        >
          <span class="material-icons" aria-hidden="true">zoom_out</span>
        </button>
        <span
          class="zoom-level min-w-[3.25rem] text-center tabular-nums text-slate-600 dark:text-slate-300"
          aria-live="polite">{Math.round(zoom * 100)}%</span
        >
        <button
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-slate-700 transition-colors enabled:hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9 dark:bg-slate-700 dark:text-slate-100 dark:enabled:hover:bg-slate-600"
          on:click={zoomIn}
          disabled={zoom >= NIVEAUX_ZOOM[NIVEAUX_ZOOM.length - 1]}
          aria-label={$tr("pdf.zoomIn")}
          title={$tr("pdf.zoomIn")}
        >
          <span class="material-icons" aria-hidden="true">zoom_in</span>
        </button>
        <button
          type="button"
          class="ml-1 inline-flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-slate-700 transition-colors enabled:hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9 dark:bg-slate-700 dark:text-slate-100 dark:enabled:hover:bg-slate-600"
          on:click={ajusterALaLargeur}
          disabled={zoom === NIVEAUX_ZOOM[0]}
          aria-label={$tr("pdf.fitWidth")}
          title={$tr("pdf.fitWidth")}
        >
          <span class="material-icons" aria-hidden="true">fit_screen</span>
        </button>
      </div>
    </div>

    <!--
      Le cadre defile dans les deux sens une fois la page agrandie, sans
      entrainer la page autour (`overscroll-contain`) ; le zoom au doigt de la
      page reste permis (`touch-manipulation` garde pan et pincement). Il prend
      le focus clavier pour que les fleches puissent le parcourir.
    -->
    <div class="relative w-full">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        bind:this={cadre}
        class="canvas-container w-full overflow-auto overscroll-contain touch-manipulation rounded bg-white shadow-md dark:bg-slate-800 {currentImageUrl
          ? ''
          : 'min-h-64'}"
        tabindex="0"
        role="region"
        aria-label={$tr("pdf.viewer")}
      >
        {#if currentImageUrl}
          <img
            src={currentImageUrl}
            alt={$tr("pdf.pageAlt").replace("{n}", String(pageAffichee || pageNum))}
            class="block h-auto max-w-none transition-opacity duration-200 motion-reduce:transition-none {estompee
              ? 'opacity-50'
              : ''}"
            style="width: {zoom * 100}%"
            on:load={surImageChargee}
          />
        {/if}
      </div>
      <!-- Hors du cadre qui defile : centre sur la partie visible, et non au
           milieu d'une page agrandie trois fois. -->
      {#if pageLoading}
        <div
          class="page-loading pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <div
            class="h-6 w-6 rounded-full border-[3px] border-slate-200 border-t-blue-600 motion-safe:animate-spin dark:border-slate-600 dark:border-t-blue-400"
          ></div>
        </div>
      {/if}
    </div>

    <div class="keyboard-hint text-xs text-slate-500 sm:text-sm dark:text-slate-400">
      {$tr("pdf.keyboardHint")}
    </div>
  {/if}
</div>

<style>
  /*
   * Hauteur du cadre. Repli en vh pour les navigateurs sans unite dvh : une
   * classe Tailwind `max-h-[75dvh]` n'ecrirait que la seconde valeur. Borne,
   * le cadre garde la barre d'outils a portee et la page agrandie defile
   * dedans, au lieu de repousser la suite de l'article de plusieurs ecrans.
   */
  .canvas-container {
    max-height: 75vh;
    max-height: 75dvh;
  }

  /* Ecran tactile, sans souris : l'aide sur les fleches du clavier n'y sert a rien. */
  @media (hover: none), (pointer: coarse) {
    .keyboard-hint {
      display: none;
    }
  }
</style>
