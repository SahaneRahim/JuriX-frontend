<script lang="ts">
  /**
   * Le texte entier (P10, variante A) : divisions en h2, articles en h3
   * (h2 quand le texte n'a pas de division) avec leur ancre `#art-N` et un
   * lien direct, comme la maquette loi-p10a. Tout le texte de la base, y
   * compris les visas d'ouverture et les lignes que le découpage n'a pas su
   * ranger dans un article : rien n'en est perdu.
   *
   * GROS TEXTES. Le Code civil compte 2 041 articles reconnus. Deux mesures :
   * - rendu PAR LOTS : 120 articles d'abord, puis 250 à chaque moment libre
   *   du navigateur (`requestIdleCallback`), sans bloquer le défilement ni la
   *   saisie sur un Android d'entrée de gamme ; un saut vers un article pas
   *   encore rendu le rend d'abord ;
   * - `content-visibility: auto` sur chaque article : hors de l'écran, il
   *   n'est ni mis en page ni peint. Il reste dans l'arbre d'accessibilité et
   *   dans la recherche du navigateur (Ctrl+F).
   *
   * L'article lu est suivi au défilement (`courant`, -1 avant le premier
   * article) : la page en fait la barre du sommaire et la fin du fil d'Ariane.
   *
   * AUCUNE ENTRÉE D'HISTORIQUE NATIVE. Suivi par le navigateur, un lien
   * `#art-N` ou `#contenu` ajoutait une entrée que la page ne connaissait
   * pas : « Retour », qui compte les entrées de la lecture pour revenir à la
   * page d'avant, n'y revenait plus, et le retour arrière sur cette entrée,
   * sans état, rouvrait la lecture article par article. Le lien direct passe
   * donc par la page (`choisir`, comme le sommaire), et « Haut de page » ne
   * fait que défiler. Clic du milieu ou avec Ctrl : le lien garde son
   * comportement.
   *
   * MESURE. Tout le texte tient dans la mesure du corps des articles (36em
   * en 18 px, 40,5rem) : titres de division, filets, lien direct. Le lien
   * direct ferme ainsi la ligne du titre au bord du texte, comme sur la
   * maquette, au lieu de rester au bord de la carte, à 900 px du titre
   * (vérification r1 du 29/10/2026).
   */
  import { createEventDispatcher, onDestroy, onMount, tick } from "svelte";
  import Icone from "$lib/components/Icone.svelte";
  import { language, tr } from "$lib/stores/language";
  import StatutDeLArticle from "./StatutDeLArticle.svelte";
  import { intituleDeLArticle, libelleDeDivision, paragraphesDeLArticle, type TexteDecoupe } from "./decoupage";
  import { ancreDeLArticle, numeroDArticleEcrit } from "./reference";
  import type { ChangementsDeLArticle } from "./statut";
  import { LIEN_DANS_LE_TEXTE, POLICE_DES_TITRES, POLICE_DU_TEXTE_OFFICIEL } from "./typographie";

  export let decoupe: TexteDecoupe;
  export let changements: Map<number, ChangementsDeLArticle>;
  /** L'onglet « Historique » existe : les encadrés d'article y mènent. */
  export let historique = false;
  /** Le document en base est une version consolidée (`statut.version_en_base`), pour les encadrés d'article. */
  export let consolide = false;
  /** Langue du document (attribut `lang` du texte officiel), pas de l'interface. */
  export let langueDuTexte: "fr" | "en" = "fr";
  /**
   * L'ouverture s'affiche dépliée. La page le demande quand l'article de
   * l'adresse n'a pas été retrouvé : l'avis promet le texte « affiché en
   * entier », et l'OCR range souvent dans l'ouverture les articles qu'il n'a
   * pas su lire (décret 2017/398, /laws/197 : les articles 1 et 2, sous un
   * résumé qui ne promettait qu'« intitulé, visas et préambule »). Et quand
   * le texte n'a ni article ni division : l'ouverture est alors le texte
   * entier (circulaires budgétaires, /laws/2091 : 260 lignes repliées). Et
   * pour un texte d'un seul article : elle est tout ce que sa lecture
   * article par article ne montre pas (/laws/1797, le tableau des promus).
   *
   * Elle ne fait que déplier. L'avis s'efface au premier saut du sommaire :
   * replier l'ouverture à ce moment ferait remonter le texte sous le
   * lecteur. Et celui-ci la replie s'il le veut (`bind:open`).
   */
  export let deplierLOuverture = false;
  let ouvertureDepliee = false;
  $: if (deplierLOuverture) ouvertureDepliee = true;

  const dispatch = createEventDispatcher<{
    courant: number;
    historique: null;
    choisir: { rang: number; evenement: MouseEvent };
  }>();

  /** Un clic qui ouvre ailleurs (milieu, Ctrl, Cmd, Maj, Alt) : le lien garde son comportement. */
  function clicSimple(evenement: MouseEvent): boolean {
    return (
      evenement.button === 0 && !evenement.metaKey && !evenement.ctrlKey && !evenement.shiftKey && !evenement.altKey
    );
  }

  /**
   * « Haut de page » : le début du contenu, sans entrée d'historique. Le
   * focus y va aussi, comme le navigateur l'aurait fait de l'ancre : la
   * touche Tab repart du haut, pas du pied de page. `tabindex` le temps du
   * focus seulement : posé à demeure, un clic n'importe où dans le texte
   * donnerait le focus au contenu entier.
   */
  function allerEnHaut(evenement: MouseEvent) {
    const contenu = document.getElementById("contenu");
    if (!contenu || !clicSimple(evenement)) return;
    evenement.preventDefault();
    const moinsDeMouvement = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    contenu.scrollIntoView({ block: "start", behavior: moinsDeMouvement ? "auto" : "smooth" });
    if (!contenu.hasAttribute("tabindex")) {
      contenu.setAttribute("tabindex", "-1");
      contenu.addEventListener("blur", () => contenu.removeAttribute("tabindex"), { once: true });
    }
    contenu.focus({ preventScroll: true });
  }

  const PREMIER_LOT = 120;
  const LOT = 250;

  /**
   * Texte officiel hors des articles (ouverture, lignes d'une division) : la
   * taille et la police du corps des articles. L'ouverture était en 16 px
   * sous des articles en 18 (vérification r1 du 29/10/2026).
   */
  const TEXTE_OFFICIEL = `max-w-[36em] space-y-3 text-base leading-relaxed text-zinc-700 coupe-mots dark:text-zinc-300 sm:text-lg ${POLICE_DU_TEXTE_OFFICIEL}`;

  $: langue = $language.current;
  $: total = decoupe.articles.length;
  $: niveau = decoupe.structure ? "h3" : "h2";
  // Composant recréé pour chaque texte (bloc `{#key}` de la page) : la
  // limite se fixe une fois.
  let limite = Math.min(decoupe.articles.length, PREMIER_LOT);

  /**
   * Rang du premier article de chaque division, ou du suivant pour une
   * division sans article : elle s'affiche avec lui, pas avant les lots qui
   * la précèdent.
   */
  $: debuts = calculerDebuts(decoupe);
  function calculerDebuts(texte: TexteDecoupe): number[] {
    const resultat: number[] = new Array(texte.divisions.length);
    let suivant = texte.articles.length;
    for (let i = texte.divisions.length - 1; i >= 0; i--) {
      if (texte.divisions[i].articles.length) suivant = texte.divisions[i].articles[0].rang;
      resultat[i] = suivant;
    }
    return resultat;
  }

  let racine: HTMLDivElement | undefined;
  let elements: HTMLElement[] = [];
  /** Le dernier article lu annoncé à la page ; `null` avant la première mesure, qui l'annonce toujours. */
  let courant: number | null = null;
  let detruit = false;
  let image = 0;
  let tache: { annuler: () => void } | null = null;

  /** Le lot suivant, au prochain moment libre du navigateur. */
  function programmer() {
    if (detruit || limite >= total) return;
    const suite = () => {
      tache = null;
      limite = Math.min(total, limite + LOT);
      programmer();
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(suite, { timeout: 500 });
      tache = { annuler: () => window.cancelIdleCallback(id) };
    } else {
      const id = setTimeout(suite, 50);
      tache = { annuler: () => clearTimeout(id) };
    }
  }

  /**
   * L'article vers lequel la page vient de sauter (sommaire, bascule de
   * lecture), gardé comme article lu jusqu'à ce que le lecteur reprenne la
   * main. Sans elle, le défilement doux du saut traversait les articles
   * d'avant, `mesurer` les désignait tour à tour, et une bascule vers
   * « Article par article » partie pendant le défilement ouvrait l'article
   * traversé : #art-2 donnait l'article 1er (vérification r1 du 29/10/2026).
   *
   * Elle tombe au premier geste de défilement du lecteur (molette, doigt qui
   * glisse, touche de défilement), ou au premier défilement qui suit la FIN
   * du saut : `scrollend`, ou, sans lui (Safari avant la version 26), 200 ms
   * sans défilement. Un saut qui ne fait rien défiler finit au bout de
   * 300 ms. Un clic ou un toucher sur la bascule ne la fait PAS tomber : le
   * défilement doux, encore en cours, désignerait l'article traversé avant
   * que le clic n'arrive.
   */
  let cible: number | null = null;
  let sautEnCours = false;
  let minuterieDuSaut: ReturnType<typeof setTimeout> | undefined;

  function finirLeSaut() {
    sautEnCours = false;
    clearTimeout(minuterieDuSaut);
  }

  /** Le lecteur reprend la main : l'article lu se mesure de nouveau, au prochain défilement. */
  function lacherLaCible() {
    cible = null;
    finirLeSaut();
  }

  /**
   * L'article lu : le dernier dont le haut a passé une ligne au tiers haut de
   * l'écran (sous le fil d'Ariane collant). Recherche par dichotomie, les
   * articles se suivant de haut en bas : un saut au bout du Code civil ne lit
   * qu'une douzaine de positions. Aucun (-1) tant que le premier article n'a
   * pas atteint cette ligne : on lit les visas ou l'en-tête du document, et
   * le fil d'Ariane ne désigne pas encore l'article 1er.
   */
  function mesurer() {
    const n = Math.min(limite, total);
    // Texte masqué (onglet « Historique ») : ses positions sont nulles, et
    // l'article « lu » serait le dernier rendu.
    if (!n || !racine || racine.getClientRects().length === 0 || cible !== null) return;
    const ligne = Math.min(window.innerHeight * 0.3, 200);
    let bas = 0;
    let haut = n - 1;
    let trouve = -1;
    while (bas <= haut) {
      const milieu = (bas + haut) >> 1;
      const element = elements[milieu];
      if (!element) {
        haut = milieu - 1;
        continue;
      }
      if (element.getBoundingClientRect().top <= ligne) {
        trouve = milieu;
        bas = milieu + 1;
      } else {
        haut = milieu - 1;
      }
    }
    if (trouve !== courant) {
      courant = trouve;
      dispatch("courant", trouve);
    }
  }

  function surDefilement() {
    if (cible !== null) {
      if (sautEnCours) {
        // Repli de `scrollend` : le saut est fini après 200 ms sans défilement.
        clearTimeout(minuterieDuSaut);
        minuterieDuSaut = setTimeout(finirLeSaut, 200);
        return;
      }
      // Un défilement après la fin du saut : le lecteur reprend la main.
      cible = null;
    }
    if (image) return;
    image = requestAnimationFrame(() => {
      image = 0;
      mesurer();
    });
  }

  /**
   * Amène un article en haut de l'écran (sous le fil d'Ariane, `scroll-mt-*`),
   * en le rendant d'abord s'il ne l'est pas encore. Défilement doux sur une
   * courte distance seulement, et jamais pour qui a demandé moins de
   * mouvement. `focus` : le titre de l'article reçoit le focus (choix au
   * clavier dans le sommaire), sans nouveau défilement.
   */
  export async function allerA(rang: number, { focus = false, immediat = false } = {}) {
    if (rang < 0 || rang >= total) return;
    if (rang >= limite) {
      limite = Math.min(total, rang + LOT);
      await tick();
    }
    const element = elements[rang];
    if (!element) return;
    cible = rang;
    sautEnCours = true;
    clearTimeout(minuterieDuSaut);
    minuterieDuSaut = setTimeout(finirLeSaut, 300);
    const loin = Math.abs(element.getBoundingClientRect().top) > window.innerHeight * 3;
    const moinsDeMouvement = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ block: "start", behavior: immediat || loin || moinsDeMouvement ? "auto" : "smooth" });
    if (focus) element.querySelector<HTMLElement>("[data-titre-article]")?.focus({ preventScroll: true });
    courant = rang;
    dispatch("courant", rang);
  }

  /** Gestes du lecteur qui font défiler la page (capture : avant tout autre). */
  const GESTES = ["wheel", "touchmove", "keydown"] as const;
  const TOUCHES_DE_DEFILEMENT = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

  function surGeste(event: Event) {
    if (cible === null) return;
    if (event instanceof KeyboardEvent) {
      if (!TOUCHES_DE_DEFILEMENT.has(event.key)) return;
      // L'espace sur un bouton l'active (la bascule) : ce n'est pas un défilement.
      const controle = event.target instanceof Element && event.target.closest("button, a, input, textarea, select, summary");
      if (event.key === " " && controle) return;
    }
    lacherLaCible();
  }

  function surFinDeDefilement() {
    if (cible !== null) finirLeSaut();
  }

  onMount(() => {
    window.addEventListener("scroll", surDefilement, { passive: true });
    window.addEventListener("resize", surDefilement, { passive: true });
    window.addEventListener("scrollend", surFinDeDefilement, { passive: true });
    for (const geste of GESTES) window.addEventListener(geste, surGeste, { passive: true, capture: true });
    programmer();
    void tick().then(mesurer);
  });

  onDestroy(() => {
    detruit = true;
    tache?.annuler();
    clearTimeout(minuterieDuSaut);
    if (typeof window !== "undefined") {
      window.removeEventListener("scroll", surDefilement);
      window.removeEventListener("resize", surDefilement);
      window.removeEventListener("scrollend", surFinDeDefilement);
      for (const geste of GESTES) window.removeEventListener(geste, surGeste, { capture: true });
      if (image) cancelAnimationFrame(image);
    }
  });
</script>

<div bind:this={racine} class="max-w-[40.5rem]" data-testid="law-full-text">
  {#each decoupe.divisions as division, i (division.rang)}
    {#if debuts[i] < limite || limite >= total}
      <section class={i > 0 ? "mt-10" : ""} aria-labelledby={division.entetes.length ? `division-${division.rang}` : undefined}>
        {#if division.introduction.length}
          <!--
            L'ouverture (intitulé, visas, préambule), repliée : le texte
            s'ouvre sur son premier chapitre, comme la maquette loi-p10a,
            et non sur des lignes que l'OCR a lues dans le désordre
            (« 2021/745 », « DECRET N° », « DU 28 DEC 2021 »). Un clic la
            déplie ; elle reste dans la page, et dans la recherche du
            navigateur. Dépliée d'office quand la page le demande
            (`deplierLOuverture`).
          -->
          <details
            bind:open={ouvertureDepliee}
            class="group mb-8 border-b border-zinc-200 pb-4 dark:border-zinc-800"
            data-testid="law-opening"
          >
            <summary
              class="-mx-2 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white [&::-webkit-details-marker]:hidden"
            >
              <Icone nom="chevron-right" class="shrink-0 text-base transition-transform group-open:rotate-90 motion-reduce:transition-none" />
              <span>
                <span class="font-semibold text-zinc-950 dark:text-white">{$tr("loi.texte_entier.ouverture")}</span>
                <span class="text-zinc-500 dark:text-zinc-400">· {$tr("loi.texte_entier.ouverture_detail")}</span>
              </span>
            </summary>
            <div class="mt-3 {TEXTE_OFFICIEL}" lang={langueDuTexte}>
              {#each division.introduction as ligne, j (j)}
                <p>{ligne}</p>
              {/each}
            </div>
          </details>
        {/if}
        {#each division.entetes as entete, j (j)}
          <!-- Toute la chaîne (« Titre II » puis « Chapitre 1 »), chaque
               en-tête en h2 : la page ne saute aucun niveau de titre. -->
          <h2
            id={j === division.entetes.length - 1 ? `division-${division.rang}` : undefined}
            class="mb-3 scroll-mt-16 border-b border-zinc-200 pb-2 dark:border-zinc-800 sm:mb-4 sm:scroll-mt-20 sm:pb-3 sm:court:scroll-mt-14 lg:scroll-mt-[4.5rem] {j
              ? 'mt-6'
              : ''}"
          >
            <span class="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">{libelleDeDivision(entete, $tr)}</span>
            {#if entete.intitule}
              <span
                class="mt-0.5 block text-base font-semibold leading-snug text-zinc-950 coupe-mots dark:text-white sm:text-lg"
                lang={langueDuTexte}>{entete.intitule}</span
              >
            {/if}
          </h2>
          {#if entete.lignes.length}
            <div class="mb-4 {TEXTE_OFFICIEL}" lang={langueDuTexte}>
              {#each entete.lignes as ligne, k (k)}
                <p>{ligne}</p>
              {/each}
            </div>
          {/if}
        {/each}
        {#each division.articles as article (article.rang)}
          {#if article.rang < limite}
            {@const ancre = ancreDeLArticle(article)}
            {@const intitule = intituleDeLArticle(article)}
            <!-- `lg:scroll-mt-[4.5rem]` : sous le fil d'Ariane de 53 px, la
                 marge haute de l'article (20 px) cache la fin du précédent. -->
            <article
              id={ancre}
              bind:this={elements[article.rang]}
              aria-labelledby="titre-{ancre}"
              class="article-entier scroll-mt-16 border-b border-zinc-100 py-4 last:border-0 dark:border-zinc-800/80 sm:scroll-mt-20 sm:py-5 sm:court:scroll-mt-14 lg:scroll-mt-[4.5rem]"
            >
              <div class="mb-2 flex items-center justify-between gap-3 sm:mb-3">
                <!-- Focusable par le script seulement (choix au clavier dans
                     le sommaire) : le lecteur d'écran y annonce l'article. -->
                <svelte:element
                  this={niveau}
                  id="titre-{ancre}"
                  tabindex="-1"
                  data-titre-article
                  class="text-lg text-zinc-950 dark:text-white sm:text-xl {POLICE_DES_TITRES}"
                >
                  {$tr("loi.article")}
                  {article.numero}{#if langue === "fr" && article.numero === "1"}<sup>er</sup>{/if}
                </svelte:element>
                <!-- Le lien direct (P10) : l'adresse de l'article, à copier
                     ou à ouvrir ailleurs. 44 px au doigt. Le clic simple
                     passe par la page, comme un saut du sommaire. -->
                <a
                  href="#{ancre}"
                  class="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white lg:[@media(pointer:fine)]:h-9 lg:[@media(pointer:fine)]:w-9"
                  aria-label={$tr("loi.lien_direct").replace("{n}", numeroDArticleEcrit(article.numero, langue))}
                  on:click={(evenement) => dispatch("choisir", { rang: article.rang, evenement })}
                >
                  <Icone nom="link" class="text-lg" />
                </a>
              </div>
              {#if intitule}
                <p class="mb-2 text-base font-semibold text-zinc-800 coupe-mots dark:text-zinc-200" lang={langueDuTexte}>
                  {intitule}
                </p>
              {/if}
              <StatutDeLArticle changements={changements.get(article.rang)} {historique} {consolide} compact on:historique />
              <div
                class="max-w-[36em] space-y-4 text-base leading-relaxed text-zinc-700 coupe-mots dark:text-zinc-300 sm:text-lg {POLICE_DU_TEXTE_OFFICIEL}"
                lang={langueDuTexte}
              >
                {#each paragraphesDeLArticle(article) as paragraphe, k (k)}
                  <p>{paragraphe}</p>
                {/each}
              </div>
            </article>
          {/if}
        {/each}
      </section>
    {/if}
  {/each}

  {#if limite < total}
    <p class="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{$tr("loi.texte_entier.suite")}</p>
  {:else}
    <!-- « Haut de page » en fin de texte (P10) : vers le début du contenu
         (`allerEnHaut`, sans entrée d'historique). -->
    <p class="mt-10">
      <a href="#contenu" class="{LIEN_DANS_LE_TEXTE} inline-flex min-h-11 items-center gap-1.5" on:click={allerEnHaut}>
        <Icone nom="arrow-up" class="text-base" />
        {$tr("loi.haut_de_page")}
      </a>
    </p>
  {/if}
</div>

<style>
  /*
   * Hors de l'écran, un article n'est ni mis en page ni peint. La hauteur
   * d'attente (12rem, environ un article court) est remplacée par la vraie
   * dès son premier rendu (`auto`) : la barre de défilement ne saute plus
   * quand on revient en arrière.
   */
  .article-entier {
    content-visibility: auto;
    contain-intrinsic-size: auto 12rem;
  }
</style>
