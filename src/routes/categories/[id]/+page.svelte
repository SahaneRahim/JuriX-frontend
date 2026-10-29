<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { language, tr } from "$lib/stores/language";
  import { descriptionCategorie, nomCategorie, nomCompletCategorie } from "$lib/categories";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { descriptionDepuis, urlCanonique } from "$lib/seo";
  import type { FiltreLangue } from "$lib/types";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import CategoryIcon from "$lib/components/CategoryIcon.svelte";
  import ChatFab from "$lib/components/ChatFab.svelte";
  import Icone from "$lib/components/Icone.svelte";
  import ListeDeTextes from "$lib/components/listes/ListeDeTextes.svelte";
  import { adresseDuLot, type EtatDeLaListe } from "$lib/components/listes/lots";
  import { remplir } from "$lib/components/listes/reperes";
  import type { Snapshot } from "@sveltejs/kit";

  /** Rempli par `+page.server.ts`. Une catégorie absente n'arrive plus ici : 404. */
  export let data;

  /**
   * Les lots affichés et la position de défilement, gardés dans l'historique,
   * comme sur /laws : au retour d'un texte, la liste revient entière, à la
   * ligne quittée (ListeDeTextes, `capturer`).
   */
  let liste: ListeDeTextes | undefined;
  export const snapshot: Snapshot<EtatDeLaListe | null> = {
    capture: () => liste?.capturer() ?? null,
    restore: (etat) => liste?.restaurer(etat),
  };

  // L'identifiant vient de la BASE, plus d'un slug devine. Une categorie
  // introuvable repond 404 (+page.server.ts) au lieu de rendre une page vide
  // en 200.

  // Tout vient du `load` et se re-derive a chaque navigation : sans `$:`, passer
  // de /categories/3 a /categories/7 laisserait le titre et la liste de la
  // categorie precedente a l'ecran, SvelteKit reutilisant le composant.
  // Le nom court (Q2) à l'écran, celui de l'accueil ; le nom complet de la
  // classification dans le titre de l'onglet et des moteurs, où « Droit du
  // travail et sécurité sociale » se cherche mieux que son abrégé.
  $: categoryTitle = nomCategorie(data.categorie?.name, $language.current);
  $: titreComplet = nomCompletCategorie(data.categorie?.name, $language.current);
  $: categoryDesc = descriptionCategorie(
    data.categorie?.name,
    data.categorie?.description,
    $language.current,
  );

  /**
   * Langue du filtre : les deux langues du site, plus « toutes ». La valeur
   * vit dans l'URL (`?lang=`) : une catégorie filtrée en anglais se partage.
   */
  $: selectedLanguage = data.lang as FiltreLangue;

  /**
   * Le filtre de langue dans l'adresse. « toutes » et le premier lot sont
   * l'état par défaut : ne pas les écrire garde l'URL propre, celle que la
   * canonique désigne, et une seule version en cache (ISR).
   *
   * Une fonction au type de retour écrit, comme `filtresDe` de /laws : écrite
   * en ligne dans le `$:`, l'expression était typée `{ lang?: undefined } |
   * { lang: … }`, que la prop `filtres` de ListeDeTextes
   * (Record<string, string>) refuse.
   */
  function filtresDeLangue(lang: string): Record<string, string> {
    return lang === "all" ? {} : { lang };
  }
  $: filtres = filtresDeLangue(data.lang);
  $: chemin = `/categories/${data.categorie.id}`;

  /**
   * Filtre de langue en liste déroulante, la même que celle de /laws. Avec
   * JavaScript, il navigue dès qu'il change (la liste repart du premier lot) ;
   * sans lui, le bouton du <noscript> envoie son formulaire GET.
   */
  function surChoixDeLangue(event: Event) {
    const valeur = (event.currentTarget as HTMLSelectElement).value;
    const langue: FiltreLangue = valeur === "fr" || valeur === "en" ? valeur : "all";
    goto(adresseDuLot(chemin, langue === "all" ? {} : { lang: langue }, 1), { keepFocus: true, noScroll: true });
  }

  // Une langue filtrée ou un lot suivant n'entre pas dans l'index, comme sur
  // /laws : la canonique désigne déjà la page nue, et les liens restent suivis.
  $: indexable = data.lang === "all" && data.page === 1;
</script>

<!--
  Description : celle de la catégorie quand elle existe, sinon une phrase
  construite depuis son nom et son volume. Une `meta description` vide serait
  indexée telle quelle, et la plupart des catégories du corpus n'ont pas de
  description saisie.
-->
<MetaSeo
  titre={titreComplet}
  description={descriptionDepuis(categoryDesc) ||
    (data.categorie
      ? `${data.categorie.law_count} ${$tr("categories.documentsShort")} — ${titreComplet}`
      : "")}
  canonique={urlCanonique($page.url)}
  {indexable}
/>

<SiteHeader />

<main id="contenu">
<!-- `min-h-app` (app.css : 100dvh, repli 100vh) : 100vh compte la barre du navigateur
     mobile comme repliée. -->
<div class="min-h-app bg-background-light dark:bg-background-dark pb-20">
  <!-- Bandeau inversé : sombre dans les deux thèmes (zinc-900 en sombre, pour
       se détacher du fond de page), d'où ses textes sans variante `dark:`.

       Son bas = l'espace au-dessus de la carte de recherche + les 32 px de la
       carte posés sur lui (`-mt-8` du contenu) : un chevauchement FIXE.

       Écran court (`court:`, téléphone en paysage) : en 740×360, l'en-tête,
       le bandeau, le panneau de recherche et la ligne du total remplissaient
       tout le premier écran, et la première ligne de la liste commençait au
       pli (y ≈ 360). La tuile et la description s'effacent, le titre passe à
       24 px et le bandeau se resserre : la liste commence vers y ≈ 260. -->
  <div
    class="bg-zinc-950 dark:bg-zinc-900 text-white pb-16 sm:pb-20 pt-8 sm:pt-10 court:pt-2 court:pb-10 relative overflow-hidden border-b border-zinc-800"
  >
    <!-- La colonne des autres pages de la section (/laws, /search,
         /compare) : marges de l'en-tête (16, 24 puis 48 px, zone sûre
         comprise), puis 1 152 px au plus, centrés. -->
    <div class="max-w-[78rem] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-12 relative z-10">
      <!-- Back Link. Contour clavier blanc : celui du site (zinc-950 en
           clair) disparaîtrait sur ce fond toujours sombre. -->
      <a
        href="/"
        class="inline-flex min-h-11 items-center gap-2 text-zinc-400 hover:text-white focus-visible:outline-white transition-colors mb-2 sm:mb-4 court:mb-0 font-medium text-sm"
      >
        <Icone nom="arrow-left" class="text-sm" />
        {$tr("categories.backHome")}
      </a>

      <!-- Icon & Title. `min-w-0` laisse la colonne de texte rétrécir,
           `hyphens-auto` coupe les mots longs. La tuile reste un cran
           au-dessus du bandeau (zinc-900 sur zinc-950, zinc-800 sur zinc-900
           en sombre) pour ne pas s'y fondre. -->
      <div class="flex items-start sm:items-center gap-4 sm:gap-6">
        <div
          class="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-2xl bg-zinc-900 dark:bg-zinc-800 border border-zinc-800 dark:border-zinc-700 flex items-center justify-center text-white court:hidden"
        >
          <CategoryIcon category={data.categorie?.name} class="w-6 h-6 sm:w-8 sm:h-8" />
        </div>
        <!-- Titre de page en Literata (Q5 A), 600, interlettrage nul (la
             serif ne prend jamais tracking-tight), équilibré sur ses lignes ;
             30 puis 36 px, 24 sur écran court. -->
        <div class="min-w-0">
          <h1
            class="text-3xl sm:text-4xl court:text-2xl font-titre font-semibold leading-[1.2] text-balance text-white mb-2 court:mb-0 break-words hyphens-auto"
          >
            {categoryTitle}
          </h1>
          <p class="text-zinc-400 text-sm sm:text-base max-w-2xl leading-relaxed court:hidden">
            {categoryDesc}
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content overlap. Chevauchement fixe de 32 px (voir le bandeau).
       Même colonne que le bandeau (voir plus haut). -->
  <div class="max-w-[78rem] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-12 -mt-8 relative z-20">
    <!-- Carte de recherche, à cheval sur le bandeau. En sombre, un cran
         AU-DESSUS du bandeau (zinc-800 sur zinc-900) : de la couleur du
         bandeau, sa moitié haute s'y fondait et l'on ne voyait qu'une
         encoche bordée d'un filet. Sur une ligne dès sm. -->
    <div
      data-hors-du-bouton
      class="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm dark:shadow-none border border-zinc-200 dark:border-zinc-700 p-2 mb-6 sm:mb-8 court:mb-3 flex flex-col sm:flex-row sm:items-center gap-2"
    >
      <!-- Le champ CHERCHE DANS LE DOMAINE (P8) : un vrai formulaire GET vers
           /search, avec le domaine en champ caché. Il filtrait auparavant les
           seules cartes affichées, sur le titre et un extrait de 300
           caractères : un mot plus loin dans le texte ne trouvait rien. Il
           part même sans JavaScript, et /search rend ses résultats au serveur.

           `perimetre`, et non `categorie` (le nom d'une case de la colonne
           de filtres) : la recherche se fait DANS le domaine, l'API ne
           calcule ses résultats que parmi ses textes. Une case cochée ne
           garde, elle, que les textes du domaine parmi ceux trouvés dans tout
           le corpus, et en perdait la plupart (src/routes/search/parametres.ts).
           Après le champ : l'adresse envoyée, `?q=…&perimetre=13`, est déjà
           celle que réécrivent les liens de /search.

           La loupe EST le bouton d'envoi (« Rechercher », P8 : une loupe
           plutôt qu'une flèche) : à sa place de la maquette, à gauche du
           champ, mais après lui dans l'ordre du clavier. Entrée et la touche
           « Rechercher » du clavier d'un téléphone envoient aussi.

           Recette des champs (guide § 4.5) : bordure zinc-200, zinc-500 en
           sombre sur un fond zinc-950, focus en bordure et anneau. -->
      <form method="get" action="/search" role="search" class="relative w-full min-w-0 flex-1">
        <input
          type="text"
          name="q"
          enterkeyhint="search"
          autocomplete="off"
          aria-label={remplir($tr("categories.searchInDomain"), { domaine: categoryTitle })}
          placeholder={$tr("categories.searchPlaceholderShort")}
          class="min-h-11 w-full pl-12 pr-4 py-2.5 text-base sm:text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-500 rounded-xl focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 transition-colors"
        />
        <input type="hidden" name="perimetre" value={String(data.categorie.id)} />
        <button
          type="submit"
          aria-label={$tr("search.button")}
          class="absolute left-0.5 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
        >
          <Icone nom="search" class="h-5 w-5" />
        </button>
      </form>

      <!-- Language Filter : la liste de /laws, au fond zinc-50 du champ
           voisin, à sa hauteur et en graisse normale. Un formulaire GET vers
           cette même page : sans JavaScript, le bouton du <noscript> l'envoie
           (il n'existe pas quand le JavaScript tourne, et ne bouge donc rien à
           l'hydratation). `value=` et non `bind:value=` : la langue vit dans
           l'URL. -->
      <form method="get" class="flex min-w-0 gap-2 sm:shrink-0">
        <select
          name="lang"
          value={selectedLanguage}
          aria-label={$tr("a11y.filterLanguage")}
          on:change={surChoixDeLangue}
          class="min-h-11 w-full min-w-0 truncate rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-4 pr-10 text-base text-zinc-950 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:w-auto sm:text-sm"
        >
          <option value="all">{$tr("laws.allLanguages")}</option>
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
        <noscript>
          <button
            type="submit"
            class="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-white"
          >
            {$tr("listes.filtrer")}
          </button>
        </noscript>
      </form>
    </div>

    <!-- La liste par lots (P11) : repères et objet en clair, du plus récent
         au plus ancien, « Afficher 20 de plus ». Ni extrait de l'OCR, ni
         icône du domaine répétée sur chaque ligne (elle reste dans le
         bandeau), ni cote. Une panne de l'API ne passe plus par ici : le
         `load` lève un 503, et la page d'erreur du site offre « Réessayer ». -->
    <ListeDeTextes
      bind:this={liste}
      lignes={data.lignes}
      page={data.page}
      parPage={data.parPage}
      total={data.total}
      suivante={data.suivante}
      tri={data.tri}
      {chemin}
      {filtres}
      vide={$tr("categories.noDocsTitle")}
    />
  </div>
</div>

</main>

<!-- Le bouton de l'assistant, comme sur la recherche et l'accueil. Il se
     retire quand la liste passe dessous (`eviter`), et le pied de page lui
     réserve sa place en fin de défilement. -->
<ChatFab eviter="[data-hors-du-bouton]" />
<SiteFooter reserverBouton />
