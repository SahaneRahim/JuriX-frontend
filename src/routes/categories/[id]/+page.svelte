<script lang="ts">
  import { onMount } from "svelte";
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import { language, tr } from "$lib/stores/language";
  import { descriptionCategorie, nomCategorie } from "$lib/categories";
  import { formatDate } from "$lib/format";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { descriptionDepuis, urlCanonique } from "$lib/seo";
  import type { FiltreLangue } from "$lib/types";
  import { prefersReducedMotion } from "svelte/motion";
  import { fly } from "svelte/transition";

  /** Rempli par `+page.server.ts`. Une catégorie absente n'arrive plus ici : 404. */
  export let data;

  // L'identifiant vient de la BASE, plus d'un slug devine.
  //
  // L'ancienne version recevait un slug (« lois », « decrets ») et cherchait
  // une categorie dont le nom le CONTIENNE. Quand rien ne correspondait — et
  // rien ne correspondait jamais pour les types de texte — elle basculait sur
  // une recherche plein texte du mot « loi », qui remonte tous les decrets :
  // d'ou des decrets affiches dans « Lois ». Ce repli est supprime, et la
  // validation de l'identifiant a rejoint `+page.server.ts` : une categorie
  // introuvable repond desormais 404 au lieu de rendre une page vide en 200.

  /** Filtre de texte, purement client : il n'y a pas d'endpoint pour cela. */
  let searchQuery = "";

  /**
   * Exemple du champ : la phrase complète (« Rechercher une loi, un décret,
   * un article... », 317 px en Inter) à partir de sm, une phrase courte en
   * dessous. Le champ n'y laisse que 274 px de texte à 390 px de large, 204
   * à 320 : l'exemple s'arrêtait sur « un art ». Le rendu serveur pose la
   * phrase courte, qui tient partout ; la longue la remplace après
   * l'hydratation sur un écran assez large.
   */
  const REQUETE_CHAMP_LARGE = "(min-width: 640px)";
  let champLarge = false;

  onMount(() => {
    const requete = window.matchMedia(REQUETE_CHAMP_LARGE);
    const suivre = () => (champLarge = requete.matches);
    suivre();
    requete.addEventListener("change", suivre);
    return () => requete.removeEventListener("change", suivre);
  });

  // Tout vient du `load` et se re-derive a chaque navigation : sans `$:`, passer
  // de /categories/3 a /categories/7 laisserait le titre et la liste de la
  // categorie precedente a l'ecran, SvelteKit reutilisant le composant.
  $: documents = data.documents;
  $: categoryTitle = nomCategorie(data.categorie?.name, $language.current);
  $: categoryDesc = descriptionCategorie(
    data.categorie?.name,
    data.categorie?.description,
    $language.current,
  );
  // Pas d'icône lue dans la base : sa colonne `icon` est un émoji, souvent
  // vide, dont le dessin change d'un système à l'autre. CategoryIcon choisit
  // l'icône Lucide du domaine d'après son nom français (`data.categorie.name`).
  $: error = data.erreur ? $tr(data.erreur) : "";

  /**
   * Langue du filtre : les deux langues du site, plus « toutes ».
   *
   * Le type était inféré depuis `$language.current`, donc `Language` — alors
   * que le troisième bouton assigne `"all"`. Le type mentait ; `FiltreLangue`
   * du module de types partagés dit exactement ce que la valeur peut valoir.
   *
   * La valeur vit désormais dans l'URL : une catégorie filtrée en anglais
   * n'était pas partageable, les trois vues partageant la même adresse.
   */
  $: selectedLanguage = data.lang as FiltreLangue;

  function choisirLangue(valeur: FiltreLangue) {
    const params = new URLSearchParams($page.url.searchParams);
    // « toutes » est l'etat par defaut : ne pas l'ecrire garde l'URL propre, et
    // c'est celle-la que la canonique designe.
    if (valeur === "all") params.delete("lang");
    else params.set("lang", valeur);
    const requete = params.toString();
    goto(requete ? `?${requete}` : "?", { keepFocus: true, noScroll: true });
  }

  /**
   * Filtre de langue en liste déroulante, la même que celle de /laws.
   *
   * Il était fait de trois boutons « FR / EN / Tout » à pastille NOIRE,
   * précédés d'un « LANGUE : » à chasse fixe : un troisième dessin pour un
   * choix de langue, après la liste de /laws et la bascule de l'interface
   * (pastille blanche) de l'en-tête, avec laquelle il se confondait. Les
   * deux pages filtrent la même chose, de la même façon.
   */
  function surChoixDeLangue(event: Event) {
    const valeur = (event.currentTarget as HTMLSelectElement).value;
    choisirLangue(valeur === "fr" || valeur === "en" ? valeur : "all");
  }


  /**
   * Filtre local sur le titre et l'EXTRAIT (300 caractères) : le texte intégral
   * ne quitte plus le serveur (+page.server.ts). Un mot qui n'apparaît que plus
   * loin dans le texte ne fait donc plus remonter le document ; chercher DANS
   * les textes est le rôle de la recherche du site.
   */
  $: filteredDocuments = documents.filter(
    (doc) =>
      searchQuery === "" ||
      doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  /**
   * Nombre de documents que le `load` demande à l'API (`limit: '50'` dans
   * +page.server.ts, qui ne peut exporter que ce que SvelteKit connaît) :
   * les deux valeurs doivent rester égales.
   */
  const TAILLE_DE_LA_LISTE = 50;

  /**
   * La liste s'arrête aux 50 premiers textes : le `load` ne lit aucune page.
   * Le compteur affichait ce nombre (« 50 document(s) dans cette
   * catégorie »), la limite de la requête, et la page finissait net sur la
   * 50e carte : le lecteur croyait tout voir, quand la fonction publique en
   * compte plus de 1 200.
   *
   * Le compteur dit désormais le vrai total, `law_count`, qui compte TOUS les
   * textes de la catégorie (le même que la grille de l'accueil) : il ne vaut
   * que sans filtre de langue, l'API ne rendant pas de total par langue. Une
   * liste incomplète mène à la liste entière, paginée : /laws filtrée sur la
   * catégorie (et la langue).
   *
   * Incomplète = la limite est atteinte, et le total, s'il est connu, la
   * dépasse. Une liste plus courte que la limite est entière, même sous un
   * `law_count` plus grand : il compte aussi les brouillons, que la liste
   * (textes publiés) ne montre jamais.
   */
  $: total = data.lang === "all" ? (data.categorie?.law_count ?? null) : null;
  $: partielle = documents.length >= TAILLE_DE_LA_LISTE && (total === null || documents.length < total);
  $: lienListeComplete = `/laws?category=${data.categorie?.id}${data.lang === "all" ? "" : `&lang=${data.lang}`}`;

  /** « texte » ou « textes » : « 50 document(s) » faisait le pluriel entre parenthèses. */
  function cleTextes(n: number): string {
    return n === 1 ? "categories.textCount.one" : "categories.textCount.other";
  }

  /**
   * « 3 sur 50 textes » pendant un filtre (il ne cherche que dans les textes
   * affichés), « 50 sur 1 277 textes » pour une liste incomplète dont on
   * connaît le total, « 12 textes » sinon. `$tr` écrit dans le bloc même :
   * c'est ce qui le fait recalculer au changement de langue.
   */
  $: compteur = searchQuery
    ? `${filteredDocuments.length} ${$tr("pdf.of")} ${documents.length} ${$tr(cleTextes(documents.length))}`
    : partielle && total !== null
      ? `${documents.length} ${$tr("pdf.of")} ${total.toLocaleString($language.current === "fr" ? "fr-FR" : "en-US")} ${$tr(cleTextes(total))}`
      : `${documents.length} ${$tr(cleTextes(documents.length))}`;

  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import CategoryIcon from "$lib/components/CategoryIcon.svelte";
  import ChatFab from "$lib/components/ChatFab.svelte";
  import Icone from "$lib/components/Icone.svelte";
</script>

<!--
  Description : celle de la catégorie quand elle existe, sinon une phrase
  construite depuis son nom et son volume. Une `meta description` vide serait
  indexée telle quelle, et la plupart des catégories du corpus n'ont pas de
  description saisie.
-->
<MetaSeo
  titre={categoryTitle}
  description={descriptionDepuis(categoryDesc) ||
    (data.categorie
      ? `${data.categorie.law_count} ${$tr("categories.documentsShort")} — ${categoryTitle}`
      : "")}
  canonique={urlCanonique($page.url)}
/>

<SiteHeader />

<main id="contenu">
<!-- `min-h-app` (app.css : 100dvh, repli 100vh) : 100vh compte la barre du navigateur
     mobile comme repliée. -->
<div class="min-h-app bg-background-light dark:bg-background-dark pb-20">
  <!-- Bandeau inversé : sombre dans les deux thèmes (zinc-900 en sombre, pour
       se détacher du fond de page), d'où ses textes sans variante `dark:`.
       Marges latérales d'au moins la zone sûre (encoche d'un iPhone en
       paysage) ; le bandeau, lui, reste bord à bord.

       Son bas = l'espace au-dessus de la carte de recherche (32 px sur
       téléphone, 48 au-delà, 16 sur écran court) + les 32 px de la carte
       posés sur lui (`-mt-8` du contenu). Ce chevauchement est désormais
       FIXE, quelle que soit la hauteur de la carte : il valait 80 px pour
       une carte de 140 px empilée (téléphone) mais de 64 px en ligne
       (bureau), qui s'arrêtait alors AU-DESSUS du bord, laissant une bande
       noire de 10 px sous elle. Plus court sur écran court (`court:`) :
       à 740×360, en-tête et bandeau prenaient tout le premier écran.
       Plus de halo flou en haut à gauche : reste du « blob » de l'ancien
       dessin, il formait en sombre des anneaux concentriques visibles (un
       dégradé en paliers, sur le fond zinc-900) et ne se voyait pas en
       clair ; le guide (§ 4.16) ne garde que la lueur du hero. -->
  <div
    class="bg-zinc-950 dark:bg-zinc-900 text-white pb-16 sm:pb-20 pt-8 sm:pt-10 court:pt-4 court:pb-12 relative overflow-hidden border-b border-zinc-800"
  >
    <!-- La colonne de la liste, plus bas, et des autres pages de la section
         (/laws, /search, /compare) : marges de l'en-tête (16, 24 puis 48 px,
         zone sûre comprise), puis 1 152 px au plus, centrés. Le bandeau
         posait sa marge HORS de sa colonne, la liste DEDANS : la tuile et le
         titre commençaient 16 px à gauche des cartes en 1 440. -->
    <div class="max-w-[78rem] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-12 relative z-10">
      <!-- Back Link. Contour clavier blanc : celui du site (zinc-950 en
           clair) disparaîtrait sur ce fond toujours sombre. -->
      <a
        href="/"
        class="inline-flex min-h-11 items-center gap-2 text-zinc-400 hover:text-white focus-visible:outline-white transition-colors mb-2 sm:mb-4 court:mb-1 font-medium text-sm"
      >
        <Icone nom="arrow-left" class="text-sm" />
        {$tr("categories.backHome")}
      </a>

      <!-- Icon & Title. Sur téléphone, le titre de 30 px tenait dans 200 à
           240 px à côté d'une icône de 64 px, et un mot comme
           « constitutionnel » était rogné par le bandeau. `min-w-0` laisse
           la colonne de texte rétrécir, `hyphens-auto` coupe les mots longs
           (la langue du document suit celle de l'interface).
           La tuile reste un cran au-dessus du bandeau (zinc-900 sur
           zinc-950, zinc-800 sur zinc-900 en sombre) pour ne pas s'y
           fondre. -->
      <div class="flex items-start sm:items-center gap-4 sm:gap-6">
        <div
          class="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-2xl bg-zinc-900 dark:bg-zinc-800 border border-zinc-800 dark:border-zinc-700 flex items-center justify-center text-white"
        >
          <CategoryIcon category={data.categorie?.name} class="w-6 h-6 sm:w-8 sm:h-8" />
        </div>
        <!-- Titre de page du guide (§ 4.2), 30 puis 36 px, comme les autres
             pages ; 24 px sur écran court. -->
        <div class="min-w-0">
          <h1
            class="text-3xl sm:text-4xl court:text-2xl font-bold text-white mb-2 court:mb-1 tracking-tight break-words hyphens-auto"
          >
            {categoryTitle}
          </h1>
          <p class="text-zinc-400 text-sm sm:text-base max-w-2xl leading-relaxed">
            {categoryDesc}
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content overlap. Chevauchement fixe de 32 px (voir le bandeau).
       Même colonne que le bandeau (voir plus haut). -->
  <div class="max-w-[78rem] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-12 -mt-8 relative z-20">
    <!-- Search Bar Card. En sombre, bord zinc-700 : la carte (zinc-900) se
         posait sur le bandeau (zinc-900) avec un bord zinc-800 à 1,2:1 ; elle
         y disparaissait, et sur téléphone, à cheval sur le bandeau et la
         page, il n'en restait qu'une encoche. Sur une ligne dès sm (deux
         champs, plus de boutons) : 62 px de haut (deux champs de 44 px)
         au lieu de 140 jusqu'à 768 px. -->
    <div
      data-hors-du-bouton
      class="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm dark:shadow-none border border-zinc-200 dark:border-zinc-700 p-2 mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center gap-2"
    >
      <!-- Input. Champ plein dans la carte qui le cadre, désormais bordé : sans
           bordure, son fond (zinc-50 sur blanc, zinc-950 à 60 % sur zinc-900)
           était la seule limite du champ, à peine 1,1:1. La recette des champs
           (guide § 4.5) : bordure zinc-200, zinc-500 en sombre sur un fond
           zinc-950, focus en bordure et anneau, 2 px en tout comme ailleurs.
           Hauteur et loupe des autres champs du site : 44 px à partir de sm
           (`min-h-11`, `py-2.5`), 46 en dessous où le texte passe à 16 px,
           comme les listes de /laws et les champs de /compare ; loupe de
           20 px, celle de la barre de recherche. En `py-3`, le champ faisait
           46 px à 1 440 px de large, autour d'une loupe de 24 px. Graisse
           normale, comme ailleurs : `font-medium` épaississait aussi
           l'exemple du champ, seul du site à l'être. -->
      <div class="flex-1 relative w-full min-w-0">
        <Icone
          nom="search"
          class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
        />
        <input
          type="text"
          bind:value={searchQuery}
          aria-label={$tr("a11y.searchField")}
          placeholder={$tr(champLarge ? "categories.searchPlaceholder" : "categories.searchPlaceholderShort")}
          class="min-h-11 w-full pl-12 pr-4 py-2.5 text-base sm:text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-500 rounded-xl focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 transition-colors"
        />
      </div>

      <!-- Language Filter : la liste de /laws (voir `surChoixDeLangue`), au
           fond zinc-50 du champ voisin, à sa hauteur et en graisse normale
           comme sur /laws. `value=` et non `bind:value=` : la langue vit
           dans l'URL. -->
      <select
        value={selectedLanguage}
        aria-label={$tr("a11y.filterLanguage")}
        on:change={surChoixDeLangue}
        class="min-h-11 w-full min-w-0 truncate rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-4 pr-10 text-base text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:w-auto sm:shrink-0 sm:text-sm"
      >
        <option value="all">{$tr("laws.allLanguages")}</option>
        <option value="fr">Français</option>
        <option value="en">English</option>
      </select>
    </div>

    <!-- Results Section. `data-hors-du-bouton` (ici et sur la carte de
         recherche) : le bouton flottant de l'assistant se retire quand ils
         passent dessous (ChatFab, `eviter`). -->
    <div data-hors-du-bouton>
      <!--
        L'indicateur de chargement a disparu avec le bloc reactif qui chargeait :
        la page n'est plus rendue avant que ses donnees soient la.

        La reprise passe par `invalidateAll()`, qui rejoue le `load`. Le bouton
        appelait auparavant `fetchCategoryDocuments`, une fonction qui n'a jamais
        existe dans ce fichier : le SEUL moyen de recuperation de la page levait
        une ReferenceError. Ne pas reintroduire d'appel a une fonction locale ici.
      -->
      {#if error}
        <!-- Texte red-700 (red-300 en sombre) : red-600 n'atteint que 4,4:1
             sur red-50. « Réessayer » n'est pas destructeur : bouton neutre,
             comme sur l'accueil et la liste des documents. -->
        <div
          role="alert"
          class="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 p-8 rounded-2xl text-center border border-red-200 dark:border-red-900/60"
        >
          <Icone nom="circle-alert" class="text-4xl mb-2" />
          <p class="font-medium mb-4">{error}</p>
          <button
            class="min-h-11 px-6 py-2 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-200 dark:hover:text-white transition-colors"
            on:click={() => invalidateAll()}
            data-testid="category-retry"
          >
            {$tr("categories.retry")}
          </button>
        </div>
      {:else if filteredDocuments.length === 0}
        <div
          class="text-center py-12 sm:py-20 px-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm dark:shadow-none border border-zinc-200 dark:border-zinc-800"
        >
          <div
            class="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <Icone nom="search-x" class="text-3xl text-zinc-600 dark:text-zinc-400" />
          </div>
          <p class="text-zinc-950 dark:text-white font-medium mb-1">
            {$tr("categories.noDocsTitle")}
          </p>
          <p class="text-zinc-500 dark:text-zinc-400 text-sm">{$tr("categories.noDocsDesc")}</p>
        </div>
      {:else}
        <!-- Le vrai total, et le chemin vers la liste entière quand celle-ci
             n'en montre qu'une partie (voir `partielle`). -->
        <div class="mb-4 flex flex-wrap items-center justify-between gap-x-4 pl-1">
          <p class="text-sm font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
            {compteur}
          </p>
          {#if partielle}
            <!-- 44 px de haut, sauf à partir de lg sous un pointeur fin, la
                 règle de /search et de /compare : réduit dès sm, le lien ne
                 faisait que 20 px sur un téléphone en paysage ou une
                 tablette, tactiles. -->
            <a
              href={lienListeComplete}
              class="inline-flex min-h-11 items-center text-sm font-medium text-zinc-950 dark:text-white underline decoration-zinc-300 dark:decoration-zinc-600 underline-offset-4 hover:decoration-zinc-950 dark:hover:decoration-white lg:[@media(pointer:fine)]:min-h-0"
              >{$tr("admin.viewAll")}</a
            >
          {/if}
        </div>

        <div class="grid gap-4">
          <!--
            Les replis `doc.law_id ?? doc.id` et `doc.date || doc.publication_date`
            ont ete retires : cet endpoint rend des LawResponse, qui n'ont ni
            `law_id` ni `date`. Les deux branches gauches etaient donc toujours
            indefinies — du code defensif contre une forme qui n'existe pas, que
            le typage a rendu visible.

            Aucun delai par rang a l'apparition : avec 50 documents, le dernier
            n'arrivait qu'apres 2,9 s en navigation dans le navigateur. Et
            aucun glissement du tout quand le systeme demande moins de
            mouvement.

            Sur téléphone, la carte laissait 126 px (à 320) ou 166 px (à 360)
            au titre et à l'extrait, d'où des cartes très hautes à un ou deux
            mots par ligne : marges et écarts réduits, chevron masqué sous
            sm. `coupe-mots` : les cotes de texte sans espace
            (« N°2018/9387/CAB/PM ») élargissaient la carte.

            Plus de tuile d'icône dans les cartes : la même icône du domaine
            sur les 50 cartes ne distinguait rien, alourdissait chacune et
            prenait 52 px à la colonne du texte sur téléphone. Elle reste
            dans le bandeau. Plus de pastille « FR » non plus : écrite en dur,
            quelle que soit la langue du texte (que le `load` ne transmet
            pas), elle aurait menti sur un texte anglais.

            Plus d'extrait affiché non plus : c'était le début brut de l'OCR
            (« 1 0 DEC 2018 DECRETN° 2018/763 DU portant… », « REPUBLIQUE DU
            CAMEROUN PAIX-TRAVAIL-PATRIE… »), répété sur 50 cartes, et la
            page paraissait cassée ; il ne sert plus qu'au filtre. Restent le
            titre et la date. Titre sur trois lignes au plus au téléphone,
            deux ensuite, comme sur /laws : il en prenait jusqu'à sept, et la
            page 11 850 px à 390 de large.
          -->
          {#each filteredDocuments as doc (doc.id)}
            <a
              href="/laws/{doc.id}"
              class="group block bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none hover:border-zinc-950 dark:hover:border-zinc-400 motion-safe:hover:-translate-y-0.5 active:bg-zinc-50 dark:active:bg-zinc-800/60 transition-all duration-300 overflow-hidden"
              in:fly={{ y: 20, duration: prefersReducedMotion.current ? 0 : 400 }}
            >
              <div class="p-4 sm:p-5 flex gap-3 sm:gap-5 items-start">
                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <h3
                    class="text-base sm:text-lg font-bold text-zinc-950 dark:text-white leading-tight coupe-mots tracking-tight line-clamp-3 sm:line-clamp-2"
                  >
                    {doc.title || $tr("search.noTitle")}
                  </h3>

                  <!-- Date, à la recette « Méta » du guide (§ 4.2) : chasse
                       fixe et chiffres tabulaires, comme les dates de
                       /search et de /laws ; calendrier de 16 px, celui de
                       /search. Elle était en sans-serif mi-gras, sous une
                       icône de 14 px. -->
                  {#if doc.publication_date}
                    <p
                      class="mt-2 flex items-center gap-1.5 font-mono tabular-nums text-xs text-zinc-500 dark:text-zinc-400"
                    >
                      <Icone nom="calendar" class="text-base" />
                      {formatDate(doc.publication_date, $language.current)}
                    </p>
                  {/if}
                </div>

                <!-- Chevron -->
                <div class="hidden sm:block self-center pl-2">
                  <Icone
                    nom="chevron-right"
                    class="text-2xl text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors"
                  />
                </div>
              </div>
            </a>
          {/each}
        </div>

        <!-- Fin d'une liste incomplète : la page s'arrêtait net sur la 50e
             carte. Le compteur, et la suite dans la liste paginée. -->
        {#if partielle}
          <div class="mt-8 flex flex-col items-center gap-3 text-center">
            <p class="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">{compteur}</p>
            <a
              href={lienListeComplete}
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:border-zinc-950 hover:text-zinc-950 dark:hover:border-zinc-200 dark:hover:text-white"
            >
              {$tr("admin.viewAll")}
              <Icone nom="arrow-right" class="text-base" />
            </a>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

</main>

<!-- Le bouton de l'assistant, comme sur la recherche et l'accueil : il
     manquait ici, et l'accès au chat changeait d'une page à l'autre de la
     section. Le pied de page lui réserve sa place en fin de défilement. -->
<ChatFab eviter="[data-hors-du-bouton]" />
<SiteFooter reserverBouton />
