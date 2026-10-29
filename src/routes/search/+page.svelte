<script lang="ts">
  /**
   * Recherche (P7 A et P8 A).
   *
   * RENDUE PAR LE SERVEUR (+page.server.ts) à partir de l'adresse : requête,
   * nature, domaines, période, tri et page sont des paramètres d'URL
   * (./parametres.ts). Onglets, cases, tri et numéros de page sont des liens
   * ou des formulaires GET : tout marche sans JavaScript, et avec lui ce sont
   * des navigations sans rechargement (SvelteKit relit le `load`). La page ne
   * charge plus rien dans `onMount`.
   *
   * FILTRES ET TRI CALCULÉS PAR LE SERVEUR (P7). Ils ne portaient que sur la
   * page affichée : dès la page 2, effectifs et ordre étaient faux. La
   * nouvelle API les applique à tout l'ensemble trouvé et rend l'effectif de
   * chaque nature et de chaque domaine ; l'ancienne ne sait pas le faire, et la
   * page n'en montre alors rien plutôt que d'afficher des chiffres faux
   * (contrat §8).
   *
   * Une ligne par résultat (SearchResultCard), « Poser cette question à
   * l'assistant » en tête quand il y a des résultats, et un état « aucun
   * résultat » qui propose des pistes au lieu d'une impasse (dont la même
   * question à l'assistant).
   */
  import { onDestroy, onMount, tick } from "svelte";
  import { afterNavigate, goto, invalidateAll, replaceState } from "$app/navigation";
  import { navigating, page } from "$app/stores";
  import ChatFab from "$lib/components/ChatFab.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import SearchResultCard from "$lib/components/SearchResultCard.svelte";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { nomCourtDuDomaine } from "$lib/components/listes/domaines";
  import { cleSelonNombre, formatNombre, remplir } from "$lib/components/listes/reperes";
  import { nombreDePages, pagesVisibles, TAILLE_PAGE_RECHERCHE } from "$lib/pagination";
  import { urlCanonique } from "$lib/seo";
  import { language, tr } from "$lib/stores/language";
  import { collanteSiElleTient } from "./colonne";
  import { ongletActifEnVue } from "./onglets";
  import {
    adresseDeRecherche,
    aDesFiltres,
    filtresDuPanneau,
    lireParametres,
    NATURES,
    PAGE_MAX,
    type NatureDuFiltre,
    type ParametresDeRecherche,
    type PeriodeDuFiltre,
  } from "./parametres";

  export let data;

  /** Les onglets de nature, dans l'ordre de la maquette ; `null` : tous. */
  const ONGLETS: { nature: NatureDuFiltre | null; cle: string }[] = [
    { nature: null, cle: "search.nature.all" },
    { nature: "decret", cle: "search.decrees" },
    { nature: "loi", cle: "search.laws" },
    { nature: "arrete", cle: "search.nature.arretes" },
    { nature: "acte-uniforme", cle: "search.nature.actesUniformes" },
    { nature: "autres", cle: "search.nature.autres" },
  ];

  const PERIODES_AFFICHEES: { periode: PeriodeDuFiltre | null; cle: string }[] = [
    { periode: null, cle: "search.allTime" },
    { periode: "annee", cle: "search.thisYear" },
    { periode: "5ans", cle: "search.last5Years" },
  ];

  /**
   * « Aucun décret ne contient « … » » : le genre change d'une nature à
   * l'autre. Pour l'onglet « Autres », « Aucun AUTRE texte ne contient… » se
   * lisait « aucun texte de plus », juste au-dessus de « Textes trouvés :
   * 12 décrets, 7 lois… » : le titre nomme donc la nature, exemples à
   * l'appui (« Aucun texte d'une autre nature (ordonnance, circulaire,
   * décision…) ne contient… »), ceux que l'onglet regroupe
   * (TYPES_DES_NATURES, ./parametres.ts).
   */
  const AUCUN_PAR_NATURE: Record<NatureDuFiltre, string> = {
    decret: "search.empty.nature.decret",
    loi: "search.empty.nature.loi",
    arrete: "search.empty.nature.arrete",
    "acte-uniforme": "search.empty.nature.acteUniforme",
    autres: "search.empty.nature.autresNatures",
  };

  /** « 4 actes uniformes », « 1 loi » : la nature et son nombre, au singulier ou au pluriel. */
  const COMPTE_PAR_NATURE: Record<NatureDuFiltre, string> = {
    decret: "search.natureCount.decret",
    loi: "search.natureCount.loi",
    arrete: "search.natureCount.arrete",
    "acte-uniforme": "search.natureCount.acteUniforme",
    autres: "search.natureCount.autres",
  };

  /**
   * Classes d'un onglet (maquette recherche-p7a) : la recette « filtre à
   * bascule » du guide (§ 4.7). 16 px de côté tant que la bande défile (sous
   * lg), 20 à partir de lg comme la maquette en 1440 : à 768 px, les six
   * onglets tiennent alors sur la rangée, sans défiler.
   */
  const ONGLET =
    "flex min-h-11 shrink-0 snap-start items-center gap-2 px-4 lg:px-5 py-2.5 rounded-full border text-sm font-medium whitespace-nowrap transition-colors";
  const ONGLET_ACTIF = "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950";
  const ONGLET_INACTIF =
    "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-400 dark:hover:text-white";

  const LIEN =
    "font-medium text-zinc-950 underline decoration-zinc-400 underline-offset-4 hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-500 dark:hover:decoration-white";

  $: p = data.parametres;
  $: langue = $language.current;

  /**
   * Le titre « Résultats pour « … » », en Literata. Le sous-ensemble
   * auto-hébergé de Literata n'a pas l'espace fine insécable (U+202F) des
   * guillemets français : la police de repli la dessinait presque sans
   * largeur, et les guillemets collaient à la requête (« «travail» »).
   * L'espace insécable ordinaire (U+00A0), présente dans le sous-ensemble, la
   * remplace dans ce seul titre ; les textes en Inter gardent l'espace fine.
   */
  const ESPACE_FINE_INSECABLE = /\u202f/g;
  $: titreDeLaRecherche = remplir($tr("search.resultsForQuery").replace(ESPACE_FINE_INSECABLE, "\u00a0"), { q: p.q });

  /**
   * Une navigation vers /search est en cours, avec ou sans requête : son
   * départ est noté pour le champ (`noterLeDepart`, plus bas). Un booléen et
   * non `$navigating` : une navigation qui en remplace une autre encore en
   * cours (une seconde case cochée) le laisse vrai, et ne reprend pas pour
   * départ ce que le lecteur a écrit entre les deux.
   */
  $: versLaRecherche = Boolean($navigating && $navigating.to?.url.pathname === "/search");

  /**
   * Une recherche est en cours (nouvelle requête, filtre, page). Vers /search
   * sans requête (le lien « Recherche » de l'en-tête), rien n'est cherché : ni
   * « Recherche en cours… » ni roue.
   */
  $: enCours = versLaRecherche && Boolean(($navigating?.to?.url.searchParams.get("q") ?? "").trim());

  /**
   * Le texte du champ : la requête cherchée, posée à chaque navigation, SAUF
   * si le lecteur a écrit dans le champ pendant qu'elle se faisait. On peut
   * corriger sa requête pendant qu'elle part (le champ n'est plus désactivé) :
   * la remettre à l'ancienne à l'arrivée des résultats, sous ses doigts,
   * effaçait la correction. `saisieAuDepart` est le texte du champ au départ
   * de la navigation (ou à la dernière requête posée) : s'il n'a pas changé
   * depuis, rien de ce que le lecteur a écrit ne se perd.
   *
   * Le départ est noté pour TOUTE navigation vers /search, requête ou non.
   * Noté seulement quand une recherche partait (`enCours`), il manquait vers
   * la page sans requête (lien « Recherche » de l'en-tête, retour arrière) :
   * un texte écrit avant, jamais envoyé, passait pour une retouche faite en
   * route, et restait dans le champ de « Commencez votre recherche ».
   *
   * Les deux blocs ne dépendent, l'un que de `versLaRecherche`, l'autre que
   * de `data` : les fonctions lisent et écrivent la saisie sans en dépendre.
   */
  let saisie = data.parametres.q;
  let saisieAuDepart = saisie;

  function noterLeDepart() {
    saisieAuDepart = saisie;
  }

  function poserLaRequete(q: string) {
    if (saisie === saisieAuDepart) saisie = q;
    saisieAuDepart = q;
  }

  $: if (versLaRecherche) noterLeDepart();
  $: poserLaRequete(data.parametres.q);

  /**
   * Onglets à effectifs, colonne de filtres et tri : seulement quand le
   * serveur les a calculés (nouvelle API) et que la recherche a trouvé
   * quelque chose, filtres mis à part.
   */
  $: affiner = data.etat === "resultats" && data.affinee && (data.candidats ?? 0) > 0;
  $: natures = data.natures ?? { tous: 0, decret: 0, loi: 0, arrete: 0, "acte-uniforme": 0, autres: 0 };
  $: nombreDeFiltres = filtresDuPanneau(p);

  /**
   * Les filtres en cours, qu'une nouvelle requête garde (champs cachés du
   * formulaire) : le périmètre d'une page de domaine aussi, une nouvelle
   * requête y cherche encore.
   */
  $: champsCaches = [
    ...p.perimetre.map((id) => ["perimetre", String(id)]),
    ...(p.nature ? [["nature", p.nature]] : []),
    ...p.categories.map((id) => ["categorie", String(id)]),
    ...(p.periode ? [["periode", p.periode]] : []),
    ...(p.tri ? [["tri", p.tri]] : []),
  ] as [string, string][];

  /** Une recherche sans aucun filtre, périmètre compris, ni tri : « Réinitialiser », « sans filtre ». */
  function sansFiltre(q: string, tri: ParametresDeRecherche["tri"] = null): ParametresDeRecherche {
    return { q, perimetre: [], nature: null, categories: [], periode: null, tri, page: 1 };
  }

  /* ---------------------------------------------------------------------- */
  /* Ligne d'état                                                            */
  /* ---------------------------------------------------------------------- */

  $: premierRang = (p.page - 1) * TAILLE_PAGE_RECHERCHE + 1;
  $: dernierRang = premierRang + data.resultats.length - 1;

  /**
   * L'ANNONCE D'UNE PAGE NEUVE. Une région `role="status"` n'est lue que si
   * elle existe AVANT que son texte change : arrivée avec son texte, elle se
   * tait. Une recherche partie d'une autre page (l'accueil, l'en-tête, un
   * retour arrière) crée cette page avec ses résultats, et le nombre de
   * résultats n'était jamais dit. La région garde alors « Recherche en
   * cours… » un instant de plus, le temps que les lecteurs d'écran la
   * connaissent, puis prend le nombre : un changement, qu'ils annoncent.
   * Au premier chargement (`enter`, rendu du serveur), rien n'est différé :
   * la page se lit en entier.
   *
   * SEULE L'ANNONCE ATTEND, l'écran non. La ligne affichée disait « Recherche
   * en cours… » pendant ce délai, à chaque arrivée, sans roue ni liste
   * atténuée, à côté de résultats déjà là : rien ne se cherchait. Elle montre
   * donc le nombre aussitôt (`statutAffiche`), et la région, hors de l'écran,
   * attend (`statutAnnonce`).
   *
   * 300 ms : la liste à l'écran est déjà la bonne, seul le texte de la région
   * attend. Les annonceurs éprouvés attendent 100 ms dans une région déjà
   * présente (LiveAnnouncer d'Angular CDK) ; celle-ci vient d'être créée.
   */
  const DELAI_D_ANNONCE_MS = 300;
  let annonceDifferee = false;
  let premiereNavigation = true;
  let minuterieDAnnonce: ReturnType<typeof setTimeout> | undefined;

  afterNavigate(({ type }) => {
    if (!premiereNavigation) return;
    premiereNavigation = false;
    if (type === "enter") return;
    annonceDifferee = true;
    minuterieDAnnonce = setTimeout(() => (annonceDifferee = false), DELAI_D_ANNONCE_MS);
  });

  onDestroy(() => clearTimeout(minuterieDAnnonce));

  /**
   * « Résultats 1 à 20 sur 100 », « 7 résultats », ou ce qui se passe. Le
   * nombre est celui que le serveur a compté, filtres compris. La durée de la
   * recherche est partie : elle ne disait rien d'utile au lecteur. Vide sans
   * requête : la région existe déjà, et une recherche lancée d'ici la change
   * (« Recherche en cours… », puis le nombre), ce qui s'entend.
   */
  $: bilan =
    data.etat === "debut"
      ? ""
      : data.etat === "erreur"
        ? $tr(data.erreur)
        : data.total === 0
          ? $tr("search.noResultsTitle")
          : data.resultats.length > 0 && (p.page > 1 || data.total > data.resultats.length)
            ? remplir($tr("search.range"), {
                debut: formatNombre(premierRang, langue),
                fin: formatNombre(dernierRang, langue),
                total: formatNombre(data.total, langue),
              })
            : remplir($tr(cleSelonNombre("search.count", data.total, langue)), {
                n: formatNombre(data.total, langue),
              });

  /** Ce que montre la ligne : « Recherche en cours… » seulement quand une recherche part. */
  $: statutAffiche = enCours ? $tr("search.searching") : bilan;
  /** Ce que dit sa région : la même chose, une fois l'annonce d'une page neuve passée. */
  $: statutAnnonce = enCours || (annonceDifferee && data.etat !== "debut") ? $tr("search.searching") : bilan;

  /**
   * Aucun résultat, filtres compris : la carte de l'état vide le dit déjà en
   * titre (« Aucun texte ne contient « … » »), juste dessous. La ligne d'état
   * ne le répète plus à l'écran, et le tri, sans rien à trier, disparaît :
   * sur téléphone, « Filtres | Aucun résultat trouvé » puis « Trier par »
   * ajoutaient deux rangées, environ 100 px, avant la carte ; la maquette de
   * l'état vide (recherche-vide-p7a) commence directement par elle. La ligne
   * reste annoncée aux lecteurs d'écran (`role="status"`, en sr-only).
   */
  $: rienATrier = data.etat === "resultats" && data.total === 0;

  /**
   * En panne, de même : la carte d'erreur, juste dessous, dit la panne en
   * titre (« Erreur de recherche. Veuillez réessayer. »), et la ligne d'état
   * la répétait en rouge, mot pour mot. Elle n'est plus qu'annoncée, comme
   * pour l'état vide ; la carte a son `role="alert"`. Sans colonne de filtres
   * (pas de résultats, donc pas d'`affiner`), toute la ligne sort du flux.
   * Sans requête non plus : rien à y lire, mais la région est là pour la
   * recherche que l'on va lancer.
   */
  $: etatSeulementAnnonce = rienATrier || data.etat === "erreur" || data.etat === "debut";

  /** Le libellé de chaque tri, celui de son <option> ; `""` : la pertinence. */
  const LIBELLE_DU_TRI: Record<string, string> = {
    "": "search.relevance",
    recent: "search.recentDate",
    ancien: "search.oldestDate",
  };

  /**
   * Le tri affiché dans la liste. Remis au tri de l'adresse à chaque
   * navigation (le bloc ne dépend que de `data`) ; entre deux, celui que l'on
   * vient de choisir : la largeur de la liste le suit aussitôt, sans attendre
   * la nouvelle recherche.
   */
  let triChoisi: string = data.parametres.tri ?? "";
  $: triChoisi = data.parametres.tri ?? "";
  $: libelleDuTri = $tr(LIBELLE_DU_TRI[triChoisi] ?? LIBELLE_DU_TRI[""]);

  function changerDeTri(event: Event) {
    triChoisi = (event.currentTarget as HTMLSelectElement).value;
    appliquerFormulaire();
  }

  /* ---------------------------------------------------------------------- */
  /* Colonne de filtres                                                      */
  /* ---------------------------------------------------------------------- */

  /**
   * Repliée sous lg : dépliée d'office, avec trois dates et quatorze domaines,
   * elle occupait environ 650 px AU-DESSUS des résultats. À partir de lg, la
   * colonne latérale la montre toujours.
   *
   * Sans JavaScript, le bouton « Filtres » est un lien vers son ancre
   * (#filtres-recherche) : la colonne s'ouvre alors par `:target` (classe
   * `target:block`), et son bouton « Voir les résultats » envoie le
   * formulaire.
   *
   * HYDRATÉE, ELLE NE SUIT PLUS QUE `filtresOuverts`. Ouverte par l'ancre
   * avant l'hydratation, elle ne se refermait plus : retirer l'ancre de
   * l'adresse (`replaceState`, l'History API) ne change pas l'élément ciblé,
   * seule une navigation vers une autre ancre le fait, et `target:block`
   * l'emportait sur `hidden`. « Filtres » et « Voir les résultats » la
   * disaient fermée, chevron compris, et elle restait à l'écran, 650 px
   * au-dessus des résultats.
   */
  let filtresOuverts = false;
  let hydratee = false;
  let formulaire: HTMLFormElement | undefined;

  onMount(() => {
    // Ouverte avant l'hydratation par l'ancre : l'état la reprend, dans la
    // même mise à jour que `hydratee`, sans qu'elle se ferme un instant.
    // L'ancre quitte l'adresse : une page rechargée ou partagée ne s'ouvre
    // pas d'office sur la colonne.
    hydratee = true;
    if (location.hash === "#filtres-recherche") {
      filtresOuverts = true;
      try {
        replaceState(new URL(`${location.pathname}${location.search}`, location.href), $page.state);
      } catch {
        // Routeur pas encore prêt (en développement) : l'ancre reste, sans
        // autre effet, la classe ne lisant plus `:target`.
      }
    }
  });

  function basculerFiltres(event: MouseEvent) {
    event.preventDefault();
    filtresOuverts = !filtresOuverts;
  }

  /**
   * Une case, une date ou le tri changent : la recherche repart aussitôt, au
   * premier rang, depuis CE QUE MONTRE le formulaire (cases cochées, date,
   * tri) et non depuis l'adresse : deux cases cochées coup sur coup, avant le
   * retour de la première recherche, comptent toutes les deux. `keepFocus` :
   * le focus reste sur la case ; `noScroll` : la page ne remonte pas.
   */
  function appliquerFormulaire() {
    if (!formulaire) return;
    const parametres = new URLSearchParams();
    for (const [nom, valeur] of new FormData(formulaire)) {
      if (typeof valeur === "string") parametres.append(nom, valeur);
    }
    const suivant = lireParametres(parametres);
    goto(adresseDeRecherche({ ...suivant, page: 1 }), { keepFocus: true, noScroll: true });
  }

  /** Début des résultats, où ramène « Voir les résultats ». */
  function allerAuxResultats() {
    // Passé en JavaScript, `behavior: "smooth"` ignore la préférence
    // « réduire les animations » : elle est donc lue ici.
    const sansAnimation = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("resultats")?.scrollIntoView?.({
      block: "start",
      behavior: sansAnimation ? "auto" : "smooth",
    });
  }

  /**
   * Sous lg, la colonne dépliée s'intercale AU-DESSUS des résultats : chaque
   * case relance la recherche, mais le résultat arrive hors de la vue. Avec
   * JavaScript, « Voir les résultats » referme la colonne et y ramène ; sans
   * lui, c'est le bouton d'envoi du formulaire.
   */
  async function voirLesResultats(event: MouseEvent) {
    event.preventDefault();
    filtresOuverts = false;
    await tick();
    allerAuxResultats();
  }

  /* ---------------------------------------------------------------------- */
  /* Résultats, pages, états vides                                           */
  /* ---------------------------------------------------------------------- */

  $: totalPages = Math.min(nombreDePages(data.total, TAILLE_PAGE_RECHERCHE), PAGE_MAX);
  /**
   * Fenêtre de pagination : au plus 5 numéros centrés sur la page courante,
   * 3 sous sm (les deux autres masqués en CSS : la fenêtre de 3 est toujours
   * incluse dans celle de 5). Des LIENS, vers `#resultats` : sans JavaScript,
   * et sans remonter au titre et aux filtres à chaque page.
   */
  $: visiblePages = pagesVisibles(p.page, totalPages);
  $: pagesTelephone = pagesVisibles(p.page, totalPages, 3);
  $: lienPagePrecedente = adresseDeRecherche({ ...p, page: p.page - 1 }, "resultats");
  $: lienPageSuivante = adresseDeRecherche({ ...p, page: p.page + 1 }, "resultats");
  $: numerosDePage = visiblePages.map((n) => ({ n, href: adresseDeRecherche({ ...p, page: n }, "resultats") }));

  /** Avec JavaScript, « Réessayer » relance le `load` ; sans lui, le lien recharge la page. */
  function reessayer(event: MouseEvent) {
    event.preventDefault();
    invalidateAll();
  }

  $: assistant = `/chat?q=${encodeURIComponent(p.q)}`;
  /**
   * La recherche a trouvé des textes (même sur une page au-delà de la
   * dernière, dont la carte ne propose pas l'assistant) : le lien vers
   * l'assistant sous le champ ne s'affiche qu'alors. Sinon, la carte de
   * l'état vide le porte.
   */
  $: avecResultats = data.etat === "resultats" && data.total > 0;

  /** « a, b et c ». */
  function joindre(morceaux: string[], et: string): string {
    if (morceaux.length < 2) return morceaux.join("");
    return `${morceaux.slice(0, -1).join(", ")} ${et} ${morceaux[morceaux.length - 1]}`;
  }

  // Les états vides (P7) : l'API a trouvé des textes, que les filtres
  // excluent tous ; ou elle n'a rien trouvé du tout ; ou la page demandée est
  // au-delà de la dernière.
  $: pageAuDela = data.etat === "resultats" && data.total > 0 && data.resultats.length === 0;
  /**
   * « Aucun décret ne contient « … » », seulement quand la nature est le SEUL
   * filtre. Les effectifs des onglets gardent les autres filtres (domaines,
   * période, périmètre) : avec l'onglet « Décrets » et un domaine coché, « 2
   * lois » ailleurs ne prouvait pas qu'aucun décret ne contient la requête,
   * seulement qu'aucun n'est dans ce domaine, et le bouton « Voir les 2
   * textes, toutes natures » gardait le domaine. Avec d'autres filtres, c'est
   * l'état « Aucun texte ne correspond à ces filtres », juste.
   */
  $: videParNature =
    data.etat === "resultats" &&
    data.total === 0 &&
    data.affinee &&
    p.nature !== null &&
    filtresDuPanneau(p) === 0 &&
    natures.tous > 0;
  /**
   * Des filtres, et rien qui les passe. Dans un périmètre (page d'un domaine),
   * aussi quand l'API n'y trouve rien du tout (`candidats` nul) : rien dans un
   * domaine ne veut pas dire rien dans le corpus.
   */
  $: videParFiltres =
    data.etat === "resultats" &&
    data.total === 0 &&
    !videParNature &&
    aDesFiltres(p) &&
    (!data.affinee || (data.candidats ?? 0) > 0 || p.perimetre.length > 0);
  /**
   * Ce que trouve la recherche sans filtre (« Voir les 25 textes, sans
   * filtre »), quand l'API le dit : `candidats`, l'ensemble avant `refine`.
   * Pas dans un périmètre : l'ensemble y est celui du domaine, et le bouton
   * cherche dans tout le corpus. 0 : pas de nombre, « Rechercher sans
   * filtre ».
   */
  $: trouvesSansFiltre = data.affinee && p.perimetre.length === 0 ? (data.candidats ?? 0) : 0;
  $: trouvees = joindre(
    NATURES.filter((n) => natures[n] > 0).map((n) =>
      remplir($tr(cleSelonNombre(COMPTE_PAR_NATURE[n], natures[n], langue)), { n: formatNombre(natures[n], langue) }),
    ),
    $tr("listes.et"),
  );

  /**
   * Ancienne API, filtres dans l'adresse (une recherche lancée depuis la page
   * d'un domaine) : ils sont appliqués, sans colonne ni onglets pour les
   * montrer. Ces rappels le disent, et chacun se retire d'un lien. De même
   * pour un périmètre où la nouvelle API ne trouve rien : sans résultat, pas
   * de colonne, et « Aucun texte ne correspond à ces filtres » doit dire
   * lesquels.
   */
  $: rappels =
    data.etat === "resultats" && aDesFiltres(p) && !affiner && (!data.affinee || p.perimetre.length > 0)
      ? [
          ...p.perimetre.map((id) => ({
            cle: `perimetre-${id}`,
            libelle: nomCourtDuDomaine(data.nomsDesDomaines[id], langue) || `${$tr("search.domain")} ${id}`,
            adresse: adresseDeRecherche({ ...p, perimetre: p.perimetre.filter((c) => c !== id), page: 1 }),
          })),
          ...(p.nature
            ? [
                {
                  cle: `nature-${p.nature}`,
                  libelle: $tr(ONGLETS.find((o) => o.nature === p.nature)?.cle ?? ""),
                  adresse: adresseDeRecherche({ ...p, nature: null, page: 1 }),
                },
              ]
            : []),
          ...p.categories.map((id) => ({
            cle: `categorie-${id}`,
            libelle: nomCourtDuDomaine(data.nomsDesDomaines[id], langue) || `${$tr("search.domain")} ${id}`,
            adresse: adresseDeRecherche({ ...p, categories: p.categories.filter((c) => c !== id), page: 1 }),
          })),
          ...(p.periode
            ? [
                {
                  cle: `periode-${p.periode}`,
                  libelle: $tr(PERIODES_AFFICHEES.find((d) => d.periode === p.periode)?.cle ?? ""),
                  adresse: adresseDeRecherche({ ...p, periode: null, page: 1 }),
                },
              ]
            : []),
        ]
      : [];
</script>

<!-- Hors index : chaque requete produit une URL differente, donc une infinite
     de pages au contenu quasi identique. `follow` reste actif : la page doit
     continuer a transmettre l'autorite de ses liens vers les fiches. -->
<MetaSeo
  titre={$tr("title.search")}
  canonique={urlCanonique($page.url)}
  indexable={false}
/>

<!-- min-h-app (100dvh, repli 100vh, dans app.css) et non `min-h-screen
     min-h-dvh` : Tailwind range ces deux classes par ordre alphabétique, si bien
     que min-h-screen passait APRÈS et que la valeur en dvh n'était jamais
     appliquée. -->
<div
  class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-body min-h-app flex flex-col transition-colors duration-300"
>
  <SiteHeader />

  <!-- Colonne commune aux pages de la section (Documents, catégorie,
       Recherche, Comparer) : marges de l'en-tête (16, 24 puis 48 px), puis
       1 152 px de contenu au plus, centrés. -->
  <main id="contenu" class="flex-grow w-full max-w-[78rem] mx-auto px-4 sm:px-6 lg:px-12 pt-6 pb-8 sm:pt-8 court:pt-2">
    <div class="mb-6 sm:mb-10 court:mb-2">
      <!-- Titre de page en Literata (Q5 A : la serif des titres de page), 600,
           interlettrage nul, équilibré sur ses lignes ; 24 puis 30 px comme la
           maquette. `coupe-mots` : la requête est recopiée telle quelle, et
           une suite sans espace (référence, URL collée) débordait de l'écran.
           Écran court : pour les lecteurs d'écran seulement, la requête est
           dans le champ juste dessous, et chaque ligne compte en 740×360. -->
      <h1
        class="text-2xl sm:text-3xl font-titre font-semibold leading-[1.2] text-balance coupe-mots text-zinc-950 dark:text-white mb-4 sm:mb-6 court:sr-only"
      >
        {#if p.q}
          {titreDeLaRecherche}
        {:else}
          {$tr("nav.search")}
        {/if}
      </h1>

      <!-- Un vrai formulaire GET vers /search (P8) : la requête part sans
           JavaScript, et le serveur rend les résultats. Il garde les filtres en
           cours (champs cachés). SearchBar porte aussi les suggestions.
           Texte indicatif court sous sm, celui de la page d'un domaine : la
           phrase entière était coupée net sous la loupe à 390 px. -->
      <div class="lg:max-w-3xl">
        <SearchBar
          size="large"
          bind:value={saisie}
          loading={enCours}
          placeholder={$tr("search.searchLaw")}
          placeholderCourt={$tr("categories.searchPlaceholderShort")}
          champs={champsCaches}
        />
      </div>

      <!-- La passerelle vers l'assistant, avec la question déjà écrite (/chat
           la pré-remplit sans l'envoyer). Lien de la maquette : souligné,
           44 px de haut au doigt. SEULEMENT AVEC DES RÉSULTATS : dans un état
           vide, la carte propose déjà « Poser la question à l'assistant »
           (même adresse), 200 px plus bas ; les deux appels se répétaient, et
           la maquette de l'état vide (recherche-vide-p7a) n'a que celui de la
           carte. En panne, l'assistant passe par la même API. -->
      {#if avecResultats}
        <p class="mt-3 court:mt-1">
          <a href={assistant} class="inline-flex min-h-11 items-center gap-2 text-sm {LIEN}">
            <Icone nom="sparkles" class="text-base" />
            {$tr("search.askAssistant")}
          </a>
        </p>
      {/if}

      <!-- Onglets de nature, avec l'effectif que le serveur a compté sur
           TOUT l'ensemble trouvé (et non sur la page affichée). Des liens :
           sans JavaScript aussi. `keepfocus` et `noscroll` : avec JavaScript,
           on reste sur l'onglet choisi.

           Sous lg (téléphone, tablette) et sur écran court (téléphone en
           paysage), UNE rangée qui défile, jusqu'aux bords de l'écran
           (-mx-4 pl-4, puis -mx-6 pl-6 à partir de sm) : en 768, les six
           onglets passaient sur deux rangées, le dernier seul sur la seconde,
           soit 52 px de commandes de plus avant le premier résultat. À partir
           de lg, les 928 px de contenu au moins les tiennent sur une rangée ;
           s'il le fallait, ils y passeraient à la ligne, comme dans la
           maquette, plutôt que de défiler sous une souris.

           Là où elle défile, son bord droit s'estompe sur 40 px, et 40 px de
           marge en fin de bande (pr-10) laissent le dernier onglet sortir de
           ce fondu : une bande coupée net au bord de l'écran ne disait pas
           qu'il restait des onglets à droite. Le bord gauche s'estompe de même,
           dès qu'un onglet y est coupé (`data-defilee`, posé par l'action) :
           ouverte sur « Autres », elle tranchait net « Tous » ou « Arrêtés ».
           Le masque (`--fondus`) ne dessine rien : il rend transparents les
           deux bords, en clair comme en sombre. La bande s'ouvre sur
           l'onglet ACTIF et non sur son début (`ongletActifEnVue`,
           ./onglets.ts) : « Autres » choisi, il était hors de l'écran à
           390 px, et rien ne disait quelle nature filtrait la liste. Les
           marges de début (scroll-pl-10) et de fin (pr-10) mesurent les deux
           fondus : l'action les lit pour sortir l'onglet de l'un et de
           l'autre.

           `preload-data="tap"` (ici, sur les numéros de page, les liens de
           l'état vide, les rappels de filtre et la colonne) : chaque adresse
           de /search relance une recherche à l'API, et le parcours classique
           fait vectoriser la question. Préchargées au simple survol (réglage
           du site, app.html), six onglets survolés lanceraient six
           recherches ; au toucher ou à l'appui, le préchargement ne part
           qu'avec le clic. Les lignes de résultat, vers /laws/<id> en cache,
           gardent le survol. -->
      {#if affiner}
        <div
          role="group"
          aria-label={$tr("search.natureGroup")}
          use:ongletActifEnVue={{ nature: p.nature, natures }}
          data-sveltekit-keepfocus
          data-sveltekit-noscroll
          data-sveltekit-preload-data="tap"
          class="-mx-4 mt-4 flex snap-x scroll-pl-10 gap-2 overflow-x-auto overscroll-x-contain pb-2 pl-4 pr-10 [--fondu-gauche:0px] data-[defilee]:[--fondu-gauche:2.5rem] [--fondus:linear-gradient(to_right,transparent,#000_var(--fondu-gauche),#000_calc(100%_-_2.5rem),transparent)] [-webkit-mask-image:var(--fondus)] [mask-image:var(--fondus)] sm:-mx-6 sm:mt-6 sm:pl-6 lg:mx-0 lg:flex-wrap lg:scroll-pl-0 lg:px-0 lg:[-webkit-mask-image:none] lg:[mask-image:none] court:mt-1 court:flex-nowrap court:scroll-pl-10 court:pr-10 court:[-webkit-mask-image:var(--fondus)] court:[mask-image:var(--fondus)]"
        >
          {#each ONGLETS as onglet (onglet.cle)}
            {@const actif = p.nature === onglet.nature}
            {@const effectif = onglet.nature ? natures[onglet.nature] : natures.tous}
            {#if effectif === 0 && !actif}
              <!-- Rien de cette nature : l'onglet reste à sa place, inactif,
                   et le dit (`aria-disabled`). -->
              <span role="link" aria-disabled="true" class="{ONGLET} cursor-not-allowed border-zinc-200 text-zinc-700 opacity-60 dark:border-zinc-800 dark:text-zinc-300">
                {$tr(onglet.cle)}
                <span class="tabular-nums text-zinc-500 dark:text-zinc-400">{formatNombre(effectif, langue)}</span>
              </span>
            {:else}
              <a
                href={adresseDeRecherche({ ...p, nature: onglet.nature, page: 1 })}
                aria-current={actif ? "true" : undefined}
                class="{ONGLET} {actif ? ONGLET_ACTIF : ONGLET_INACTIF}"
              >
                {$tr(onglet.cle)}
                <span class="tabular-nums {actif ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}"
                  >{formatNombre(effectif, langue)}</span
                >
              </a>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <!-- Trois blocs : la ligne d'état, la colonne de filtres, les résultats.
         Sous lg, dans cet ordre, l'un sous l'autre : la colonne dépliée
         s'intercale entre son bouton et les résultats. À partir de lg, une
         grille : la colonne à gauche sur toute la hauteur, la ligne d'état et
         les résultats à droite (`grid-rows-[auto_1fr]` : la grande colonne
         allonge la ligne des résultats, jamais celle de l'état). -->
    <div
      class="grid grid-cols-1 gap-y-3 {affiner
        ? 'lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:gap-y-4'
        : ''}"
    >
      <!-- Ligne d'état. Sous lg, le bouton « Filtres » y prend place, à côté
           du nombre de résultats : en 768, il occupait seul une ligne
           entre les onglets et l'état, quatre rangées de commandes avant le
           premier résultat. `id="resultats"` : là où mènent les numéros de
           page.

           Sans résultat (`rienATrier`), il n'y reste à voir que le bouton
           « Filtres », sous lg : la ligne entière passe en sr-only là où il
           n'est pas (à partir de lg, ou sans colonne de filtres). Sortie du
           flux de la grille, elle n'y laisse ni rangée vide ni écart, et la
           carte de l'état vide monte au niveau de la colonne de filtres. En
           panne aussi (`etatSeulementAnnonce`), sans colonne de filtres : la
           carte d'erreur prend sa place.

           TOUJOURS LÀ, même sans requête (vide et sr-only) : elle n'était
           créée qu'avec une requête, déjà remplie du nombre de résultats, et
           une région qui arrive avec son texte n'est pas annoncée. Une
           recherche lancée de la page vide n'était donc jamais dite. -->
      <div
        id="resultats"
        class="flex scroll-mt-4 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400 {affiner
          ? 'lg:col-start-2 lg:row-start-1'
          : ''} {etatSeulementAnnonce ? (affiner ? 'lg:sr-only' : 'sr-only') : ''}"
      >
        {#if affiner}
          <!-- Un lien vers la colonne (son ancre), et non un bouton : sans
               JavaScript, il l'ouvre par `:target`. Avec JavaScript, il la
               replie et la déplie (`aria-expanded`). Avant l'hydratation, ni
               `aria-expanded` ni `aria-controls` : un simple lien vers une
               ancre, qui disait sinon « réduit » la colonne ouverte par
               `:target`. L'aria-label complète le libellé par le nombre de
               filtres actifs, que la pastille ne montre qu'en chiffre. -->
          <a
            href="#filtres-recherche"
            on:click={basculerFiltres}
            aria-expanded={hydratee ? filtresOuverts : undefined}
            aria-controls={hydratee ? "filtres-recherche" : undefined}
            aria-label={nombreDeFiltres > 0 ? `${$tr("search.filters")} (${nombreDeFiltres})` : undefined}
            data-testid="search-filters-toggle"
            class="lg:hidden inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200 shadow-sm dark:shadow-none hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-200 dark:hover:text-white transition-colors"
          >
            <Icone nom="sliders-horizontal" class="text-lg" />
            {$tr("search.filters")}
            {#if nombreDeFiltres > 0}
              <span
                class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-950 px-1.5 text-xs font-semibold tabular-nums text-white dark:bg-white dark:text-zinc-950"
                >{nombreDeFiltres}</span
              >
            {/if}
            <Icone
              nom="chevron-down"
              class="text-lg transition-transform motion-reduce:transition-none {filtresOuverts ? 'rotate-180' : ''}"
            />
          </a>
        {/if}

        <!--
          role="status" (donc aria-live="polite") : apres une recherche, un
          lecteur d'ecran n'apprenait NI que la requete etait partie, NI
          combien de resultats revenaient. L'annonce est posee ici, sur la
          ligne d'etat, et non sur la liste de resultats : annoncer les deux
          ferait entendre l'information deux fois. Montée avant toute requête,
          la région change quand une recherche part puis aboutit, et ces
          changements sont annoncés ; voir aussi `annonceDifferee`.

          DEUX ÉLÉMENTS, pour que seule l'annonce attende : la région, hors de
          l'écran (sr-only), et ce que voit l'écran, une copie cachée aux
          lecteurs d'écran (la ligne n'est lue qu'une fois), qui montre le
          nombre sans attendre. 136 px au moins : plus étroite, la phrase
          débordait sur le tri (« No results found » en anglais) ; le tri passe
          alors à la ligne. Le bouton « Filtres » et elle tiennent encore côte
          à côte à 320 px. Sans résultat ou en panne, pas de copie (voir
          `etatSeulementAnnonce`) : la carte de l'état vide ou celle de
          l'erreur le dit à l'écran. Elle n'a donc plus de rouge : affichée,
          elle ne dit jamais une panne.
        -->
        {#if !etatSeulementAnnonce}
          <span aria-hidden="true" class="min-w-[8.5rem] flex-1">{statutAffiche}</span>
        {/if}
        <span role="status" aria-live="polite" data-testid="search-status" class="sr-only">
          {statutAnnonce}
        </span>

        {#if affiner && !rienATrier}
          <!-- Le tri, calculé par le serveur sur tout l'ensemble trouvé. Il
               appartient au formulaire de la colonne (`form=`) : sans
               JavaScript, son bouton du <noscript> l'envoie avec les filtres.
               text-base sous sm : sous 16 px, iOS zoome au focus.

               La flèche suit le mot, comme dans la maquette (« Pertinence ⌄ »).
               Une liste native prend la largeur de sa plus LONGUE option
               (« Date ancienne ») : la flèche restait à 40 px de
               « Pertinence ». Sa largeur vient donc d'une copie invisible du
               libellé CHOISI (mêmes police, graisse et marges ; 4 px de plus
               à droite, pour qu'aucun navigateur ne rogne le mot), et la
               liste s'étend sur elle (`absolute inset-0`). La copie, rendue
               au serveur, ne bouge pas à l'hydratation ; elle est cachée aux
               lecteurs d'écran, qui lisent la liste. La copie porte aussi
               la hauteur : 44 px au doigt, compactée sous un pointeur fin à
               partir de lg. -->
          <div class="flex items-center gap-2">
            <span>{$tr("search.sortBy")}</span>
            <span class="relative inline-flex">
              <span
                aria-hidden="true"
                class="invisible inline-flex min-h-11 items-center whitespace-nowrap py-2 pl-3 pr-9 text-base font-medium sm:text-sm lg:[@media(pointer:fine)]:min-h-0"
                >{libelleDuTri}</span
              >
              <select
                name="tri"
                form="filtres-recherche"
                value={p.tri ?? ""}
                aria-label={$tr("a11y.sortBy")}
                data-testid="search-sort"
                on:change={changerDeTri}
                class="absolute inset-0 h-full w-full bg-transparent border-none text-zinc-950 dark:text-white font-medium focus:ring-0 focus-visible:ring-2 focus-visible:ring-zinc-950 dark:focus-visible:ring-white focus-visible:rounded cursor-pointer pl-3 pr-8 text-base sm:text-sm"
              >
                <option value="">{$tr("search.relevance")}</option>
                <option value="recent">{$tr("search.recentDate")}</option>
                <option value="ancien">{$tr("search.oldestDate")}</option>
              </select>
            </span>
            <noscript>
              <button
                type="submit"
                form="filtres-recherche"
                class="inline-flex min-h-11 items-center rounded-xl border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                >{$tr("search.applySort")}</button
              >
            </noscript>
          </div>
        {/if}
      </div>

      {#if affiner}
        <!-- Colonne de filtres : UN formulaire GET, celui du tri aussi. Avec
             JavaScript, chaque changement relance la recherche
             (`appliquerFormulaire`) ; sans lui, « Voir les résultats »
             l'envoie. Lignes de 44 px, compactées à partir de lg sous un
             pointeur fin seulement (souris, pavé).

             Elle suit le flux de la page et se lit en entier en descendant,
             sans hauteur bornée ni défilement à elle : bornée à la fenêtre,
             elle coupait sa dernière case en 1440×900 et cachait quatre
             domaines en 1024×768 derrière un défilement dans le défilement.
             Elle ne colle (à 16 px du haut) que là où elle tient entière
             dans la fenêtre : `collanteSiElleTient` (./colonne.ts) le mesure
             et pose `data-collante`. Sans JavaScript, elle ne colle pas. -->
        <aside class="lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <form
            id="filtres-recherche"
            bind:this={formulaire}
            use:collanteSiElleTient
            method="get"
            action="/search"
            data-hors-du-bouton
            data-sveltekit-preload-data="tap"
            class="{filtresOuverts
              ? 'block'
              : hydratee
                ? 'hidden'
                : 'hidden target:block'} lg:block bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-sm dark:shadow-none lg:data-[collante]:sticky lg:data-[collante]:top-4"
          >
            <input type="hidden" name="q" value={p.q} />
            {#if p.nature}<input type="hidden" name="nature" value={p.nature} />{/if}
            <!-- Sans résultat, la liste du tri n'est plus affichée : c'est elle
                 qui portait `tri` dans ce formulaire (`form=`). Le tri choisi
                 reste donc ici, et une case cochée ou décochée le garde. -->
            {#if rienATrier && p.tri}<input type="hidden" name="tri" value={p.tri} />{/if}

            <div class="flex items-center justify-between mb-2 lg:mb-4">
              <h2 class="font-bold text-zinc-950 dark:text-white">{$tr("search.filters")}</h2>
              <!-- Retire filtres et tri, garde la requête : un lien. -->
              <a
                href={adresseDeRecherche(sansFiltre(p.q))}
                data-testid="search-reset"
                data-sveltekit-keepfocus
                data-sveltekit-noscroll
                class="-mr-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-zinc-950 dark:text-white underline decoration-zinc-300 dark:decoration-zinc-600 underline-offset-4 hover:decoration-zinc-950 dark:hover:decoration-white transition-colors lg:py-1 lg:[@media(pointer:fine)]:min-h-0"
                >{$tr("search.reset")}</a
              >
            </div>

            <!-- Date de l'ACTE (« Date du texte ») : l'année de signature,
                 et non une date de publication que la base n'a pas. -->
            <fieldset class="mb-4 lg:mb-6">
              <legend class="mb-1 text-sm font-semibold text-zinc-950 dark:text-white lg:mb-3">
                {$tr("search.dateOfText")}
              </legend>
              <div class="grid sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-1 lg:gap-y-2">
                {#each PERIODES_AFFICHEES as choix (choix.cle)}
                  <label class="flex min-h-11 items-center gap-3 lg:gap-2 lg:[@media(pointer:fine)]:min-h-0 cursor-pointer group">
                    <input
                      type="radio"
                      name="periode"
                      value={choix.periode ?? ""}
                      checked={p.periode === choix.periode}
                      on:change={appliquerFormulaire}
                      class="text-zinc-900 dark:text-white focus:ring-zinc-950 dark:focus:ring-white h-5 w-5 shrink-0 lg:h-4 lg:w-4"
                    />
                    <span
                      class="min-w-0 text-sm text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors"
                      >{$tr(choix.cle)}</span
                    >
                  </label>
                {/each}
              </div>
            </fieldset>

            <!-- Domaines, en noms courts (Q2), avec l'effectif que le serveur
                 a compté : disjonctif, il montre d'avance ce qu'une case
                 ajoute. Une case à zéro est inactive, sauf cochée (on doit
                 pouvoir la décocher). Ordre fixe, celui de la liste des
                 domaines de l'accueil (ORDRE_DES_DOMAINES) : une case ne
                 saute pas d'une ligne à l'autre quand les effectifs changent,
                 et un domaine a le même rang ici et là.

                 Le PÉRIMÈTRE d'une page de domaine y est coché, sous son nom
                 (`perimetre`) : décoché, il quitte l'adresse, et la recherche
                 porte sur tout le corpus. Les autres domaines y sont à zéro,
                 l'ensemble trouvé n'ayant que ses textes. -->
            <fieldset class="mb-6">
              <legend class="mb-1 text-sm font-semibold text-zinc-950 dark:text-white lg:mb-3">
                {$tr("search.domain")}
              </legend>
              <div class="grid sm:grid-cols-2 sm:gap-x-4 lg:grid-cols-1 lg:gap-y-2">
                {#each data.domaines as domaine (domaine.id ?? domaine.nom)}
                  {@const inactif = domaine.id === null || (domaine.n === 0 && !domaine.coche)}
                  {@const duPerimetre = domaine.id !== null && p.perimetre.includes(domaine.id)}
                  <label
                    class="flex min-h-11 items-center gap-3 lg:gap-2 lg:[@media(pointer:fine)]:min-h-0 group {inactif
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer'}"
                  >
                    <input
                      type="checkbox"
                      name={duPerimetre ? "perimetre" : "categorie"}
                      value={domaine.id ?? ""}
                      checked={domaine.coche}
                      disabled={inactif}
                      on:change={appliquerFormulaire}
                      class="rounded text-zinc-900 dark:text-white focus:ring-zinc-950 dark:focus:ring-white h-5 w-5 shrink-0 lg:h-4 lg:w-4"
                    />
                    <span
                      class="min-w-0 flex-1 text-sm text-zinc-600 dark:text-zinc-400 transition-colors {inactif
                        ? ''
                        : 'group-hover:text-zinc-950 dark:group-hover:text-white'}"
                      >{nomCourtDuDomaine(domaine.nom, langue) || `${$tr("search.domain")} ${domaine.id ?? ""}`}</span
                    >
                    <span class="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{formatNombre(domaine.n, langue)}</span>
                  </label>
                {/each}
              </div>
            </fieldset>

            <!-- Sous lg, avec JavaScript : referme la colonne et ramène aux
                 résultats. Sans JavaScript, à toute taille, il ENVOIE le
                 formulaire (à partir de lg, son double du <noscript>). -->
            <button
              type="submit"
              on:click={voirLesResultats}
              data-testid="search-filters-done"
              class="lg:hidden flex min-h-11 w-full items-center justify-center rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-4 text-sm font-semibold hover:bg-black dark:hover:bg-zinc-200 transition-colors shadow-sm dark:shadow-none"
            >
              {$tr("search.showResults")}
            </button>
            <noscript>
              <button
                type="submit"
                class="hidden lg:flex min-h-11 w-full items-center justify-center rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-4 text-sm font-semibold"
              >
                {$tr("search.applyFilters")}
              </button>
            </noscript>
          </form>
        </aside>
      {/if}

      <!-- Résultats. min-w-0 : élément de grille, la colonne ne descendait pas
           sous la largeur de son contenu, et une ligne au titre insécable
           l'élargissait au-delà de l'écran. Atténués pendant une recherche.
           Sans résultat, la ligne d'état est hors de la grille à partir de lg
           (sr-only) : la carte prend sa rangée, en haut, à côté de la colonne
           de filtres, au lieu de laisser 16 px d'écart au-dessus d'elle. -->
      <div
        class="min-w-0 transition-opacity motion-reduce:transition-none {enCours ? 'opacity-60' : ''} {affiner
          ? `lg:col-start-2 ${rienATrier ? 'lg:row-start-1' : 'lg:row-start-2'}`
          : ''}"
        aria-busy={enCours ? "true" : undefined}
      >
        {#if rappels.length}
          <div
            class="mb-3 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"
            data-sveltekit-preload-data="tap"
          >
            <span>{$tr("search.activeFilters")}</span>
            {#each rappels as rappel (rappel.cle)}
              <a
                href={rappel.adresse}
                aria-label={remplir($tr("search.removeFilter"), { f: rappel.libelle })}
                class="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
              >
                {rappel.libelle}
                <Icone nom="x" class="text-sm" />
              </a>
            {/each}
          </div>
        {/if}

        {#if data.etat === "debut"}
          <!-- `data-hors-du-bouton`, comme les autres blocs de la colonne : en
               740×360, le bouton flottant de l'assistant couvrait la fin de
               la phrase (« … des textes juridiq[ues.] ») ; il se retire
               désormais devant la carte. -->
          <div
            data-hors-du-bouton
            class="bg-white dark:bg-zinc-900 p-8 sm:p-12 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none text-center"
          >
            <Icone nom="search" class="text-6xl text-zinc-300 dark:text-zinc-600 mb-4" />
            <h2 class="text-xl font-semibold text-zinc-950 dark:text-white mb-2">
              {$tr("search.startTitle")}
            </h2>
            <p class="text-zinc-600 dark:text-zinc-400">
              {$tr("search.startDesc")}
            </p>
          </div>

          <!-- Erreur : avant « aucun résultat ». Une panne affichée en grand
               comme « Aucun résultat trouvé » faisait reformuler la requête
               pour un problème de réseau. -->
        {:else if data.etat === "erreur"}
          <div
            role="alert"
            data-testid="search-error"
            data-hors-du-bouton
            class="bg-white dark:bg-zinc-900 p-8 sm:p-12 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none text-center"
          >
            <Icone nom="cloud-off" class="text-6xl text-zinc-400 dark:text-zinc-500 mb-4" />
            <h2 class="text-xl font-semibold text-zinc-950 dark:text-white mb-2">
              {$tr(data.erreur)}
            </h2>
            <a
              href={adresseDeRecherche(p)}
              on:click={reessayer}
              data-testid="search-retry"
              class="mt-4 inline-flex min-h-11 items-center justify-center px-6 py-2 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold rounded-xl hover:bg-black dark:hover:bg-zinc-200 transition-colors shadow-sm dark:shadow-none"
              >{$tr("common.retry")}</a
            >
          </div>
        {:else if pageAuDela}
          <div
            data-hors-du-bouton
            class="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:shadow-none sm:p-10"
          >
            <p>{$tr("search.beyondEnd")}</p>
            <a href={adresseDeRecherche({ ...p, page: 1 })} class="mt-3 inline-flex min-h-11 items-center text-sm {LIEN}"
              >{$tr("search.firstPage")}</a
            >
          </div>
        {:else if data.resultats.length === 0}
          <!-- Aucun résultat (P7) : jamais une impasse. Les textes trouvés
               ailleurs (autres natures, sans filtre), l'assistant avec la
               question déjà écrite, et la liste des domaines. -->
          <div
            data-hors-du-bouton
            data-sveltekit-preload-data="tap"
            class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:p-10"
          >
            <Icone nom="search-x" class="text-4xl text-zinc-500 dark:text-zinc-400 mb-3" />
            {#if videParNature && p.nature}
              <h2 class="text-lg sm:text-xl font-semibold text-zinc-950 dark:text-white">
                {remplir($tr(AUCUN_PAR_NATURE[p.nature]), { q: p.q })}
              </h2>
              <p class="mt-2 text-zinc-600 dark:text-zinc-400">{remplir($tr("search.empty.found"), { liste: trouvees })}</p>
            {:else if videParFiltres}
              <h2 class="text-lg sm:text-xl font-semibold text-zinc-950 dark:text-white">
                {$tr("search.empty.filtersTitle")}
              </h2>
              {#if trouvesSansFiltre}
                <p class="mt-2 text-zinc-600 dark:text-zinc-400">
                  {remplir($tr(cleSelonNombre("search.empty.withoutFilters", trouvesSansFiltre, langue)), {
                    n: formatNombre(trouvesSansFiltre, langue),
                  })}
                </p>
              {/if}
            {:else}
              <h2 class="text-lg sm:text-xl font-semibold text-zinc-950 dark:text-white">
                {remplir($tr("search.empty.nothingTitle"), { q: p.q })}
              </h2>
              <p class="mt-2 text-zinc-600 dark:text-zinc-400">
                {#if data.corpus}
                  {remplir($tr("search.empty.corpus"), {
                    n: formatNombre(data.corpus.textes, langue),
                    sources: data.corpus.sources[langue] ?? data.corpus.sources.fr,
                  })}
                {:else}
                  {$tr("search.empty.tips")}
                {/if}
              </p>
            {/if}

            <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {#if videParNature}
                <a
                  href={adresseDeRecherche({ ...p, nature: null, page: 1 })}
                  class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white shadow-sm hover:bg-black dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200"
                >
                  {remplir($tr(cleSelonNombre("search.empty.allNatures", natures.tous, langue)), {
                    n: formatNombre(natures.tous, langue),
                  })}
                </a>
              {:else if videParFiltres}
                <a
                  href={adresseDeRecherche(sansFiltre(p.q, p.tri))}
                  class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white shadow-sm hover:bg-black dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200"
                >
                  {#if trouvesSansFiltre}
                    {remplir($tr(cleSelonNombre("search.empty.seeWithoutFilters", trouvesSansFiltre, langue)), {
                      n: formatNombre(trouvesSansFiltre, langue),
                    })}
                  {:else}
                    {$tr("search.empty.removeFilters")}
                  {/if}
                </a>
              {/if}
              <!-- L'assistant : bouton secondaire quand des textes existent
                   ailleurs, principal quand la recherche n'a rien trouvé. -->
              <a
                href={assistant}
                class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold {videParNature ||
                videParFiltres
                  ? 'border border-zinc-500 text-zinc-950 hover:border-zinc-950 dark:border-zinc-400 dark:text-white dark:hover:border-white'
                  : 'bg-zinc-950 text-white shadow-sm hover:bg-black dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200'}"
              >
                <Icone nom="sparkles" class="text-base" />
                {$tr("search.askAssistantEmpty")}
              </a>
            </div>
            <!-- La liste des domaines de l'accueil (son ancre `domaines`). -->
            <p class="mt-5 text-sm">
              <a href="/#domaines" class="inline-flex min-h-11 items-center {LIEN}">{$tr("search.browseDomains")}</a>
            </p>
          </div>
        {:else}
          <!-- Une liste bordée à filets, une ligne par résultat (P7).
               `role="list"` : Safari ne lit plus comme une liste un <ul> sans
               puces. Le bouton flottant de l'assistant se retire quand elle
               passe dessous. -->
          <ul
            role="list"
            data-hors-du-bouton
            class="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
          >
            {#each data.resultats as resultat (resultat.id)}
              <SearchResultCard {resultat} />
            {/each}
          </ul>

          <!-- Pagination : des liens (sans JavaScript aussi), vers le haut des
               résultats. Carrés de 44 px à toute taille ; trois numéros sous
               sm, la rangée tient dans 288 px. Une flèche sans page où aller
               reste à sa place, inactive (`aria-disabled`). -->
          {#if totalPages > 1}
            <nav
              class="mt-8 flex flex-wrap items-center justify-center gap-1 pt-4 sm:gap-2"
              aria-label={$tr("pagination.page")}
              data-hors-du-bouton
              data-sveltekit-preload-data="tap"
            >
              {#if p.page > 1}
                <a
                  href={lienPagePrecedente}
                  data-testid="search-page-prev"
                  aria-label={$tr("pagination.prev")}
                  class="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  <Icone nom="chevron-left" class="text-2xl" />
                </a>
              {:else}
                <span
                  role="link"
                  aria-disabled="true"
                  aria-label={$tr("pagination.prev")}
                  data-testid="search-page-prev"
                  class="flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 opacity-50 dark:border-zinc-800 dark:text-zinc-400"
                >
                  <Icone nom="chevron-left" class="text-2xl" />
                </span>
              {/if}

              {#each numerosDePage as { n, href } (n)}
                <a
                  {href}
                  data-testid="search-page-{n}"
                  aria-current={n === p.page ? "page" : undefined}
                  class="{pagesTelephone.includes(n)
                    ? 'flex'
                    : 'hidden sm:flex'} h-11 min-w-11 items-center justify-center rounded-xl px-2 font-medium tabular-nums transition-colors {n ===
                  p.page
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm dark:shadow-none'
                    : 'border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-white'}"
                  >{n}</a
                >
              {/each}

              {#if p.page < totalPages}
                <a
                  href={lienPageSuivante}
                  data-testid="search-page-next"
                  aria-label={$tr("pagination.next")}
                  class="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  <Icone nom="chevron-right" class="text-2xl" />
                </a>
              {:else}
                <span
                  role="link"
                  aria-disabled="true"
                  aria-label={$tr("pagination.next")}
                  data-testid="search-page-next"
                  class="flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 opacity-50 dark:border-zinc-800 dark:text-zinc-400"
                >
                  <Icone nom="chevron-right" class="text-2xl" />
                </span>
              {/if}
            </nav>
          {/if}
        {/if}
      </div>
    </div>
  </main>

  <!-- Bouton flottant de l'assistant, commun au site : il se retire quand la
       liste, la colonne de filtres, la pagination ou un état vide passent
       dessous (`eviter`), et revient dès qu'on remonte la page ou en fin de
       liste, où le pied de page lui réserve sa place (reserverBouton). -->
  <ChatFab eviter="[data-hors-du-bouton]" />
  <SiteFooter reserverBouton />
</div>
