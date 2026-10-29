<script lang="ts">
  import { fade } from "svelte/transition";
  import { page } from "$app/stores";
  import Icone from "$lib/components/Icone.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { urlCanonique } from "$lib/seo";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { ICONE_DOMAINE_INCONNU, iconeCategorie } from "$lib/categories";
  import { BLOG_POSTS, cleRubrique, nomRubrique, type BlogPost } from "$lib/data/blog";
  import { formatDate } from "$lib/format";
  import type { NomIcone } from "$lib/icones";
  import { language, tr, type Language } from "$lib/stores/language";

  export let data: { posts?: BlogPost[] } = {};
  $: posts = data?.posts && data.posts.length > 0 ? data.posts : BLOG_POSTS;

  // « Toutes les rubriques » vaut `null`, et non la chaîne « Tous » : ce
  // libellé est maintenant traduit, et une rubrique de l'API qui
  // s'appellerait « Tous » aurait désactivé le filtre.
  let selectedCategory: string | null = null;

  $: dynamicCategories = [
    null,
    ...Array.from(new Set(posts.map((p: BlogPost) => String(p.category || "")))).filter(Boolean)
  ] as (string | null)[];

  $: filteredPosts = selectedCategory === null
    ? posts
    : posts.filter((p: BlogPost) => p.category === selectedCategory);

  $: featuredPost = filteredPosts[0];
  $: otherPosts = filteredPosts.slice(1);

  // La date suit la langue de l'interface, par la mise en forme commune du
  // site ($lib/format) : `formattedDate`, préparée par +page.ts, est écrite en
  // français (« fr-FR » en dur) et le restait dans l'interface anglaise.
  function datePubliee(post: BlogPost, lang: Language): string {
    return post.date ? formatDate(post.date, lang) : $tr("blog.recently");
  }

  /**
   * Les rubriques du blog qui ne sont pas l'un des 14 domaines juridiques :
   * `iconeCategorie` ne les connaît pas, et la tuile de la carte à la une
   * montrait pour « Immobilier » ou « Numérique » l'icône d'un domaine
   * inconnu (scroll-text). Les mots sont ceux des clés `blog.rubrique.*`,
   * les rubriques que l'interface sait traduire, sans accents ni casse
   * (`cleRubrique`). Les autres rubriques de ces clés sont des domaines
   * (« Travail », « Fiscalité », « Droit pénal », « Famille », « Santé »…).
   */
  const ICONES_DES_RUBRIQUES: ReadonlyArray<{ mots: readonly string[]; icone: NomIcone }> = [
    // La maison : bail, loyer, achat d'un logement.
    { mots: ["immobilier", "logement"], icone: "house" },
    // L'écran et le téléphone : Mobile Money, cybercriminalité, commerce en ligne.
    { mots: ["numerique"], icone: "monitor-smartphone" },
    // Les icônes des domaines voisins : l'emploi relève du droit du travail,
    // l'économie des finances publiques.
    { mots: ["emploi"], icone: "hard-hat" },
    { mots: ["economie"], icone: "coins" },
    // Le chariot : prix, garanties, protection du consommateur.
    { mots: ["consommation"], icone: "shopping-cart" },
    // Le journal : « Actualité juridique », la rubrique de repli du
    // générateur d'articles quand sa réponse ne se lit pas.
    { mots: ["actualite"], icone: "newspaper" },
  ];

  /** L'icône de la rubrique : celle de son domaine juridique, sinon celle de la rubrique. */
  function iconeDeRubrique(rubrique: string | null | undefined): NomIcone {
    const domaine = iconeCategorie(rubrique);
    if (domaine !== ICONE_DOMAINE_INCONNU) return domaine;
    const mots = cleRubrique(rubrique ?? "").replace(/^blog\.rubrique\./, "").split("-");
    return ICONES_DES_RUBRIQUES.find((r) => r.mots.some((mot) => mots.includes(mot)))?.icone ?? ICONE_DOMAINE_INCONNU;
  }

  // Typographie française, posée à l'affichage. Les articles viennent de
  // l'API, et les chaînes de l'interface, avec des espaces ordinaires devant
  // « ? ! : ; », autour des guillemets et dans les nombres : le navigateur
  // pouvait couper la ligne entre un mot et sa ponctuation (le « ? » du titre
  // à la une tombait seul sur une troisième ligne) ou au milieu d'un nombre
  // (« 43 / 000 »). L'espace fine insécable (U+202F) les soude. Seules les
  // espaces déjà présentes changent : une phrase anglaise (« dispute? ») reste
  // telle quelle. Les métadonnées (MetaSeo) gardent le texte d'origine. Même
  // fonction dans blog/[slug] : sa place serait $lib/format.ts.
  function insecables(texte: string | null | undefined): string {
    return (texte ?? "")
      .replace(/[ \u00A0]+(?=[?!:;»])/g, "\u202F")
      .replace(/«[ \u00A0]+/g, "«\u202F")
      .replace(/(\d)[ \u00A0](?=\d{3}(?!\d))/g, "$1\u202F")
      // Inversion du sujet (« a-t-il », « peut-on ») : trait d'union
      // insécable (U+2011). Le navigateur coupait la ligne après « a- », et
      // « t-il » ouvrait la ligne suivante (titre de l'article à 1 440 px,
      // dans sa colonne de 768 px).
      .replace(/-t-(il|elle|on|ils|elles)(?![\p{L}])/gu, "\u2011t\u2011$1")
      .replace(/(\p{L})-(il|elle|on|ils|elles|je|tu|nous|vous)(?![\p{L}])/gu, "$1\u2011$2");
  }

  /**
   * Le lien d'une carte (Q3 A, comme la liste des domaines de l'accueil) :
   * posé sur le TITRE seul (h2 > a, h3 > a), son `::after` couvre toute la
   * carte, son bloc conteneur étant la carte (`relative`). Plus de pied
   * « Consulter → » : il menait à la même adresse que le titre, soit deux
   * arrêts de tabulation par carte ; et la carte à la une, tout entière dans
   * un <a>, avait pour nom accessible badge, date, titre, résumé et « Lire le
   * décryptage complet » à la suite. La flèche, décorative, dit l'action.
   *
   * Le contour de focus est dessiné par le `::after`, autour de toute la
   * carte, 2 px à l'extérieur de ses bords arrondis : posé sur le titre, il
   * n'entourait qu'une ligne de texte. Un `outline` et non une ombre : il
   * reste visible en contraste élevé (Windows), qui efface les ombres.
   */
  const LIEN_ETENDU =
    "after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-zinc-950 dark:focus-visible:after:outline-white";
</script>

<MetaSeo
  titre={$tr("blog.metaTitle")}
  description={$tr("blog.metaDescription")}
  canonique={urlCanonique($page.url)}
/>

<SiteHeader />

<main id="contenu" class="px-zone-sure">
  <!-- Écran court (`court:`, téléphone en paysage) : 24 px entre l'en-tête et
       le surtitre, au lieu de 80 (`sm:py-12` puis `sm:pt-8`), et des blocs
       plus serrés. Le premier écran de 740 × 360 s'arrêtait sur les filtres ;
       l'accueil, la connexion et la page d'erreur se resserrent déjà ainsi. -->
  <div
    class="min-h-app bg-background-light dark:bg-background-dark py-8 sm:py-12 court:pt-4 px-4 sm:px-6 lg:px-8 relative"
    in:fade
  >
    <div class="max-w-6xl mx-auto space-y-10 sm:space-y-12 court:space-y-8 pt-4 sm:pt-8 court:pt-2">
      <!-- En-tête / Hero du Blog. Le surtitre dit, en texte, que les analyses
           sont rédigées avec l'IA : il remplace une pastille au point qui
           pulsait, retirée de l'accueil (Q1 A) parce qu'un point qui pulse
           suggère un service « en direct ». En Inter (Q5 A : deux voix au
           plus), zinc-500 sur le fond de page (4,6:1).
           `text-balance` sur le titre et l'introduction, centrés : la
           dernière ligne ne garde plus un mot seul (« officielles. »).
           Titre de page du guide (§ 4.2), comme /about et l'article : il
           était en 48 px extra-gras, et l'échelle changeait d'une page à
           l'autre. Interligne posé avec la taille (`text-4xl/tight`) :
           `sm:text-5xl` apportait son interligne de 1, écrit après
           `leading-tight`. -->
      <div class="text-center space-y-4 max-w-3xl mx-auto">
        <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400 text-balance">
          {$tr("blog.kicker")}
        </p>
        <h1
          class="text-3xl/tight sm:text-4xl/tight font-titre font-semibold text-zinc-950 dark:text-white text-balance"
        >
          {$tr("blog.title")}
        </h1>
        <p class="text-base sm:text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal text-balance">
          {$tr("blog.subtitle")}
        </p>

        <!-- Filtres thématiques. `aria-pressed` : sans lui, seule l'inversion
             des couleurs disait quel filtre est actif, et un lecteur d'écran
             ne l'annonçait pas. 44 px de haut à toutes les largeurs (34
             auparavant) : une tablette, de 768 ou 1 024 px de large, se touche
             aussi au doigt, et `sm:min-h-0` y ramenait les puces à 38 px.
             Rubriques traduites (`nomRubrique`) : l'API les donne en
             français, et seul « Tous » suivait l'interface anglaise. -->
        <div class="flex flex-wrap items-center justify-center gap-2 pt-4">
          {#each dynamicCategories as cat (cat ?? "")}
            <button
              type="button"
              aria-pressed={selectedCategory === cat}
              on:click={() => (selectedCategory = cat)}
              class="min-h-11 px-4 py-2 rounded-full border text-xs sm:text-sm font-semibold transition-colors {selectedCategory === cat
                ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-950 dark:hover:border-zinc-400'}"
            >
              {cat === null ? $tr("blog.all") : nomRubrique(cat, $language.current)}
            </button>
          {/each}
        </div>
      </div>

      <!-- Article à la Une (Featured). Lien étendu depuis le titre (Q3 A,
           `LIEN_ETENDU`) ; la carte n'est plus un <a>. Plus d'`overflow-hidden` :
           rien n'en déborde, et il aurait rogné le contour de focus, dessiné
           à l'extérieur de la carte. Le titre prend max-w-4xl : limité à
           max-w-3xl dans une carte de 1 152 px, il s'empilait sur trois
           lignes et laissait vide le tiers droit du bloc. Le résumé garde une
           mesure de lecture (34em, voir l'article) : élargi avec le titre, il
           aurait dépassé 100 caractères par ligne.
           À partir de lg, la tuile d'icône de la rubrique (la recette des
           tuiles du site, aux couleurs du bandeau sombre) occupe la droite de
           la carte : sans elle, un pavé vide de 270 à 480 px y restait, comme
           la place d'une illustration de l'ancien dessin. Décorative, son
           trait est affiné (`epaisseur`) : à 64-80 px, le trait de 1,75 sur
           24 en faisait 5, bien plus lourd que toutes les icônes du site.
           L'icône est celle de la rubrique, domaine juridique ou non
           (`iconeDeRubrique`).
           Titre au gabarit des titres de section (§ 4.2) : en 36 px
           extra-gras, il criait plus fort que le titre de la page. -->
      {#if featuredPost}
        <section aria-label={$tr("blog.featured")} class="mt-8">
          <article
            class="group relative bg-zinc-950 dark:bg-zinc-900 rounded-2xl p-6 sm:p-10 text-white border border-zinc-800 dark:border-zinc-700/60 transition duration-200 hover:border-zinc-500 motion-safe:hover:-translate-y-0.5 lg:flex lg:items-center lg:gap-12"
          >
            <div class="max-w-4xl space-y-4 lg:min-w-0 lg:flex-1">
              <div class="flex flex-wrap items-center gap-3">
                <!-- Badge du guide (Inter, casse d'origine), aux couleurs du
                     bandeau sombre : le même style que les rubriques des
                     cartes, et non plus des capitales en police mono.
                     La rubrique, comme les filtres, les autres cartes, le fil
                     d'Ariane et le badge de l'article : la carte à la une
                     disait « Bail et logement » d'un article que le filtre
                     « Immobilier » affichait. -->
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-white/10 text-zinc-200 border border-white/20"
                >
                  {nomRubrique(featuredPost.category, $language.current)}
                </span>
                <!-- L'étiquette d'un article écrit par le modèle, comme sur sa
                     page : bordée, sans fond, pour se distinguer de la
                     rubrique. -->
                {#if featuredPost.genereParIA}
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-zinc-200 border border-white/30"
                  >
                    <Icone nom="bot" class="text-sm" />{$tr("blog.badge.ai")}
                  </span>
                {/if}
                <!-- Date et durée en Inter, chiffres alignés (Q5 A : la
                     chasse fixe ne garde que les touches). Séparées par le
                     point médian des repères des listes (P11) et de
                     l'accueil, et non plus par une puce « • » ; l'espace
                     insécable qui le précède le garde en fin de ligne. -->
                <span class="text-xs text-zinc-400 tabular-nums">
                  {datePubliee(featuredPost, $language.current)}&nbsp;· {featuredPost.readingTime} {$tr("blog.reading")}
                </span>
              </div>

              <div class="flex items-start justify-between gap-4">
                <h2 class="text-2xl/tight sm:text-3xl/tight font-bold tracking-tight text-white group-hover:text-zinc-300 transition-colors">
                  <a href="/blog/{featuredPost.slug}" class={LIEN_ETENDU}>{insecables(featuredPost.title)}</a>
                </h2>
                <Icone
                  nom="arrow-right"
                  class="mt-1 sm:mt-1.5 shrink-0 text-2xl text-zinc-400 transition group-hover:text-white motion-safe:group-hover:translate-x-1"
                />
              </div>

              <p class="max-w-[34em] text-zinc-400 text-base sm:text-lg leading-relaxed line-clamp-3 font-normal">
                {insecables(featuredPost.excerpt)}
              </p>
            </div>

            <div
              class="hidden lg:flex h-40 w-40 xl:h-48 xl:w-48 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 transition-colors group-hover:border-white/20 group-hover:text-zinc-200"
            >
              <Icone nom={iconeDeRubrique(featuredPost.category)} epaisseur={0.75} class="h-16 w-16 xl:h-20 xl:w-20" />
            </div>
          </article>
        </section>
      {/if}

      <!-- Grille des autres articles -->
      {#if otherPosts.length > 0}
        <section aria-label={$tr("blog.others")} class="space-y-6 pt-6">
          <!-- Titre de section du guide (§ 4.2) : 30 px à partir de sm, comme
               les h2 de l'accueil, de /about et de l'article ; il restait à
               24 px à toutes les tailles. -->
          <h2 class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
            {$tr("blog.othersTitle")}
          </h2>

          <!-- Une liste (Q3 A) : chaque carte est un <li>, son lien est
               le titre, étendu à la carte (`LIEN_ETENDU`). La carte entière
               fait la cible au doigt (plus de 44 px).
               Chaque carte est une sous-grille de trois rangées (repères,
               titre, extrait), prises dans la grille de la liste, comme les
               chiffres clés de l'administration (StatsCard) : des repères
               sur deux lignes abaissent le titre de TOUTES les cartes de la
               rangée. En flex, chaque carte posait son titre sous ses propres
               repères : à 768 px, dans des colonnes de 290 px, la date de la
               carte « Numérique » passait sous sa rubrique, celle de
               « Travail » non, et les deux titres voisins commençaient à
               24 px l'un de l'autre. Un navigateur sans sous-grille ignore
               `grid-rows-subgrid` : la carte y reste une grille ordinaire,
               comme la colonne flex d'avant. `gap-y-0` : sans lui, la
               sous-grille reprendrait l'écart de la liste (24 ou 32 px) entre
               ses rangées ; les marges des blocs (`mt-3`) font l'écart. -->
          <ul class="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {#each otherPosts as post (post.slug)}
              <li
                class="group relative bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-7 row-span-3 grid grid-rows-subgrid gap-y-0 shadow-sm dark:shadow-none transition-colors duration-200 hover:border-zinc-950 dark:hover:border-zinc-400"
              >
                <!-- La rubrique est un badge du guide, en Inter. La date et la
                     durée, en Inter aussi (Q5 A), ont pris la place du pied de
                     carte et de son « Consulter → ». Les mêmes repères que la
                     carte à la une et la page de l'article : « Généré par IA »
                     pour un article du modèle, et « 5 min de lecture » et non
                     « 5 min » seul, d'une carte à l'autre. `self-start` : dans
                     une rangée plus haute que lui (la carte voisine a ses
                     repères sur deux lignes), le bloc reste en haut, contre la
                     marge de la carte, au lieu d'y être centré. -->
                <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 self-start text-xs">
                  <span class="flex flex-wrap items-center gap-2">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {nomRubrique(post.category, $language.current)}
                    </span>
                    {#if post.genereParIA}
                      <span
                        class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600"
                      >
                        <Icone nom="bot" class="text-sm" />{$tr("blog.badge.ai")}
                      </span>
                    {/if}
                  </span>
                  <span class="tabular-nums text-zinc-500 dark:text-zinc-400">
                    {datePubliee(post, $language.current)}&nbsp;· {post.readingTime} {$tr("blog.reading")}
                  </span>
                </div>

                <div class="mt-3 flex items-start justify-between gap-3">
                  <h3 class="text-lg sm:text-xl font-bold text-zinc-950 dark:text-white leading-snug">
                    <a href="/blog/{post.slug}" class={LIEN_ETENDU}>{insecables(post.title)}</a>
                  </h3>
                  <Icone
                    nom="arrow-right"
                    class="mt-1 shrink-0 text-lg text-zinc-500 dark:text-zinc-400 transition-colors group-hover:text-zinc-950 dark:group-hover:text-white"
                  />
                </div>

                <!-- 14 px à toutes les largeurs : le texte courant passait à
                     12 px sur téléphone, l'écran où il se lit le moins bien. -->
                <p class="mt-3 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-3 leading-relaxed font-normal">
                  {insecables(post.excerpt)}
                </p>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <!-- Bannière Appel à l'Action IA. Son texte dit ce que fait l'assistant
           sans chiffre écrit en dur (« plus de 2 200 lois et 43 000
           articles ») : le total du corpus vient de GET /corpus, et le chat
           l'affiche lui-même à l'accueil (P4). Contour clavier blanc sur le bouton :
           celui du site (zinc-950) se perdait sur ce bandeau noir. Rayon des
           cartes (rounded-2xl, guide § 4.1), comme ses voisines. Titre et
           texte équilibrés (`text-balance`) : ils finissaient sur un mot seul
           (« litige ? » au bureau, « vulgarisée. » au téléphone).
           Bouton principal du guide (§ 4.4 : `px-5 py-2.5`, semi-gras,
           44 px) aux couleurs du mode sombre, comme ceux du hero, de la page
           d'erreur et du bandeau de l'article ; il était plus haut (52 px) et
           plus gras. -->
      <div
        class="bg-zinc-950 dark:bg-zinc-900 rounded-2xl p-6 sm:p-10 text-white flex flex-col md:flex-row items-center justify-between gap-6 border border-zinc-800"
      >
        <div class="space-y-2 text-center md:text-left max-w-xl">
          <h3 class="text-2xl font-bold tracking-tight text-balance">
            {insecables($tr("blog.ctaTitle"))}
          </h3>
          <p class="text-zinc-400 text-sm sm:text-base leading-relaxed font-normal text-balance">
            {insecables($tr("blog.ctaText"))}
          </p>
        </div>
        <a
          href="/chat"
          class="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 focus-visible:outline-white"
        >
          <Icone nom="bot" class="text-base" />
          <span>{$tr("blog.ctaButton")}</span>
        </a>
      </div>
    </div>
  </div>
</main>

<SiteFooter />
