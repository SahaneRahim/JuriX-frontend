<script lang="ts">
  import { fade } from "svelte/transition";
  import { page } from "$app/stores";
  import Icone from "$lib/components/Icone.svelte";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { urlCanonique } from "$lib/seo";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import CategoryIcon from "$lib/components/CategoryIcon.svelte";
  import { BLOG_POSTS, nomRubrique, type BlogPost } from "$lib/data/blog";
  import { formatDate } from "$lib/format";
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
</script>

<MetaSeo
  titre={$tr("blog.metaTitle")}
  description={$tr("blog.metaDescription")}
  canonique={urlCanonique($page.url)}
/>

<SiteHeader />

<main id="contenu" class="px-zone-sure">
  <div
    class="min-h-app bg-background-light dark:bg-background-dark py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative"
    in:fade
  >
    <div class="max-w-6xl mx-auto space-y-10 sm:space-y-12 pt-4 sm:pt-8">
      <!-- En-tête / Hero du Blog. La pastille reprend celle de l'accueil, au
           même rôle : en Inter (font-mono est réservé aux nombres et aux
           méta). `text-balance` sur le titre et l'introduction, centrés : la
           dernière ligne ne garde plus un mot seul (« officielles. »).
           Titre de page du guide (§ 4.2), comme /about et l'article : il
           était en 48 px extra-gras, et l'échelle changeait d'une page à
           l'autre. Interligne posé avec la taille (`text-4xl/tight`) :
           `sm:text-5xl` apportait son interligne de 1, écrit après
           `leading-tight`. -->
      <div class="text-center space-y-4 max-w-3xl mx-auto">
        <div
          class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium tracking-wide mb-2"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white motion-safe:animate-pulse"></span>
          {$tr("blog.kicker")}
        </div>
        <h1
          class="text-3xl/tight sm:text-4xl/tight font-bold tracking-tight text-zinc-950 dark:text-white text-balance"
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

      <!-- Article à la Une (Featured). Le titre prend max-w-4xl : limité à
           max-w-3xl dans une carte de 1 152 px, il s'empilait sur trois
           lignes et laissait vide le tiers droit du bloc. Le résumé garde une
           mesure de lecture (34em, voir l'article) : élargi avec le titre, il
           aurait dépassé 100 caractères par ligne.
           À partir de lg, la tuile d'icône de la rubrique (la recette des
           tuiles du site, aux couleurs du bandeau sombre) occupe la droite de
           la carte : sans elle, un pavé vide de 270 à 480 px y restait, comme
           la place d'une illustration de l'ancien dessin. Décorative : le
           lien garde le même nom. Titre au gabarit des titres de section
           (§ 4.2) : en 36 px extra-gras, il criait plus fort que le titre de
           la page. -->
      {#if featuredPost}
        <section aria-label={$tr("blog.featured")} class="mt-8">
          <a
            href="/blog/{featuredPost.slug}"
            class="group block relative bg-zinc-950 dark:bg-zinc-900 rounded-2xl p-6 sm:p-10 text-white overflow-hidden border border-zinc-800 dark:border-zinc-700/60 transition duration-200 hover:border-zinc-500 motion-safe:hover:-translate-y-0.5 lg:flex lg:items-center lg:gap-12"
          >
            <div class="max-w-4xl space-y-4 lg:min-w-0 lg:flex-1">
              <div class="flex flex-wrap items-center gap-3">
                <!-- Badge du guide (Inter, casse d'origine), aux couleurs du
                     bandeau sombre : le même style que les rubriques des
                     cartes, et non plus des capitales en police mono. -->
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-white/10 text-zinc-200 border border-white/20"
                >
                  <!-- `badge` est une clé de traduction (voir $lib/data/blog). -->
                  {$tr(featuredPost.badge)}
                </span>
                <span class="text-xs text-zinc-400 font-mono tabular-nums">
                  {datePubliee(featuredPost, $language.current)} • {featuredPost.readingTime} {$tr("blog.reading")}
                </span>
              </div>

              <h2 class="text-2xl/tight sm:text-3xl/tight font-bold tracking-tight text-white group-hover:text-zinc-300 transition-colors">
                {insecables(featuredPost.title)}
              </h2>

              <p class="max-w-[34em] text-zinc-400 text-base sm:text-lg leading-relaxed line-clamp-3 font-normal">
                {insecables(featuredPost.excerpt)}
              </p>

              <div class="pt-2 flex items-center gap-2 text-zinc-200 font-semibold motion-safe:group-hover:translate-x-1 transition-transform text-sm">
                <span>{$tr("blog.readFull")}</span>
                <Icone nom="arrow-right" class="text-base" />
              </div>
            </div>

            <div
              class="hidden lg:flex h-40 w-40 xl:h-48 xl:w-48 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 transition-colors group-hover:border-white/20 group-hover:text-zinc-200"
            >
              <CategoryIcon category={featuredPost.category} class="h-16 w-16 xl:h-20 xl:w-20" />
            </div>
          </a>
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

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {#each otherPosts as post (post.slug)}
              <article
                class="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-7 flex flex-col justify-between shadow-sm dark:shadow-none transition-colors duration-200 hover:border-zinc-950 dark:hover:border-zinc-400"
              >
                <div class="space-y-3">
                  <!-- La rubrique est un badge du guide, en Inter, comme dans
                       l'article : la police mono, posée sur toute la ligne,
                       ne sert plus qu'à la durée de lecture (une méta). -->
                  <div class="flex items-center justify-between gap-3 text-xs">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {nomRubrique(post.category, $language.current)}
                    </span>
                    <span class="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">{post.readingTime}</span>
                  </div>

                  <!-- Sans `focus:outline-none` : il retirait le contour clavier
                       du lien sans rien dessiner à la place. -->
                  <h3 class="text-lg sm:text-xl font-bold text-zinc-950 dark:text-white leading-snug">
                    <a href="/blog/{post.slug}">
                      {insecables(post.title)}
                    </a>
                  </h3>

                  <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 line-clamp-3 leading-relaxed font-normal">
                    {insecables(post.excerpt)}
                  </p>
                </div>

                <div class="pt-6 mt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span class="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                    {datePubliee(post, $language.current)}
                  </span>
                  <!-- 44 px de haut à toutes les largeurs : le lien ne faisait
                       que la hauteur de son texte (16 px), et `sm:min-h-0` l'y
                       ramenait sur tablette, qui se touche aussi au doigt. À
                       partir de sm, la marge négative (14 px de chaque côté)
                       rend à la ligne la hauteur de son texte : la carte garde
                       son aspect compact, la zone d'appui déborde dans la
                       marge intérieure. -->
                  <a
                    href="/blog/{post.slug}"
                    class="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-zinc-950 dark:text-white motion-safe:group-hover:translate-x-1 transition-transform sm:-my-3.5"
                  >
                    <span>{$tr("blog.read")}</span>
                    <Icone nom="arrow-right" class="text-sm" />
                  </a>
                </div>
              </article>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Bannière Appel à l'Action IA. Contour clavier blanc sur le bouton :
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
