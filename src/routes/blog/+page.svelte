<script lang="ts">
  import { fade } from "svelte/transition";
  import { page } from "$app/stores";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { urlCanonique } from "$lib/seo";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { BLOG_POSTS, type BlogPost } from "$lib/data/blog";

  let selectedCategory: string = "Tous";

  const categories = [
    "Tous",
    "Immobilier",
    "Travail",
    "Numérique",
  ];

  $: filteredPosts = selectedCategory === "Tous"
    ? BLOG_POSTS
    : BLOG_POSTS.filter((p) => p.category === selectedCategory);

  $: featuredPost = filteredPosts[0];
  $: otherPosts = filteredPosts.slice(1);
</script>

<MetaSeo
  titre="Actualités Juridiques & Décryptages IA — Blog"
  description="Chaque semaine, l'actualité juridique et économique décryptée en langage clair par l'intelligence artificielle avec citations des textes de lois."
  canonique={urlCanonique($page.url)}
/>

<SiteHeader />

<main id="contenu" class="px-zone-sure">
  <div
    class="min-h-app bg-slate-50 dark:bg-background-dark py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative"
    in:fade
  >
    <div class="max-w-6xl mx-auto space-y-10 sm:space-y-12 pt-4 sm:pt-8">
      <!-- En-tête / Hero du Blog -->
      <div class="text-center space-y-4 max-w-3xl mx-auto">
        <div
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-semibold mb-2"
        >
          <span class="w-2 h-2 rounded-full bg-blue-600 motion-safe:animate-pulse"></span>
          L'Actualité Décryptée par l'IA
        </div>
        <h1
          class="text-3xl font-extrabold text-slate-900 dark:text-white sm:text-5xl tracking-tight"
        >
          Le Droit face à l'Actualité
        </h1>
        <p class="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          Chaque semaine, un sujet chaud de l'actualité passé au crible des textes de lois en vigueur au Cameroun. Des explications claires, sans jargon inutile, avec les sources officielles.
        </p>

        <!-- Filtres thématiques -->
        <div class="flex flex-wrap items-center justify-center gap-2 pt-4">
          {#each categories as cat}
            <button
              on:click={() => (selectedCategory = cat)}
              class="px-4 py-2 rounded-xl text-sm font-medium transition-all {selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}"
            >
              {cat}
            </button>
          {/each}
        </div>
      </div>

      <!-- Article à la Une (Featured) -->
      {#if featuredPost}
        <section aria-label="Article à la une" class="mt-8">
          <a
            href="/blog/{featuredPost.slug}"
            class="group block relative bg-gradient-to-br from-blue-900 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-10 text-white overflow-hidden shadow-2xl transition-all duration-300 hover:shadow-blue-500/10 hover:scale-[1.01]"
          >
            <!-- Lueur décorative -->
            <div
              class="absolute -right-20 -top-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/30 transition-colors pointer-events-none"
            ></div>

            <div class="relative z-10 max-w-3xl space-y-4">
              <div class="flex flex-wrap items-center gap-3">
                <span
                  class="px-3 py-1 rounded-lg bg-blue-500/30 text-blue-200 text-xs font-bold uppercase tracking-wider border border-blue-400/30"
                >
                  {featuredPost.badge}
                </span>
                <span class="text-xs text-slate-300">
                  {featuredPost.formattedDate} • {featuredPost.readingTime} de lecture
                </span>
              </div>

              <h2 class="text-2xl sm:text-4xl font-extrabold leading-tight text-white group-hover:text-blue-300 transition-colors">
                {featuredPost.title}
              </h2>

              <p class="text-slate-300 text-base sm:text-lg leading-relaxed line-clamp-3">
                {featuredPost.excerpt}
              </p>

              <div class="pt-2 flex items-center gap-2 text-blue-400 font-semibold group-hover:translate-x-1 transition-transform">
                <span>Lire le décryptage complet</span>
                <span class="material-icons text-lg" aria-hidden="true">arrow_forward</span>
              </div>
            </div>
          </a>
        </section>
      {/if}

      <!-- Grille des autres articles -->
      {#if otherPosts.length > 0}
        <section aria-label="Autres décryptages" class="space-y-6 pt-6">
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white">
            Autres analyses récentes
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {#each otherPosts as post (post.slug)}
              <article
                class="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300 hover:border-blue-400 dark:hover:border-blue-500"
              >
                <div class="space-y-3">
                  <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span class="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-semibold">
                      {post.category}
                    </span>
                    <span>{post.readingTime}</span>
                  </div>

                  <h3 class="text-xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                    <a href="/blog/{post.slug}" class="focus:outline-none">
                      {post.title}
                    </a>
                  </h3>

                  <p class="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                    {post.excerpt}
                  </p>
                </div>

                <div class="pt-6 mt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <span class="text-xs text-slate-500 dark:text-slate-400">
                    {post.formattedDate}
                  </span>
                  <a
                    href="/blog/{post.slug}"
                    class="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform"
                  >
                    <span>Consulter</span>
                    <span class="material-icons text-base" aria-hidden="true">arrow_forward</span>
                  </a>
                </div>
              </article>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Bannière Appel à l'Action IA -->
      <div
        class="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-10 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl"
      >
        <div class="space-y-2 text-center md:text-left max-w-xl">
          <h3 class="text-2xl font-bold">
            Vous avez une question sur une actualité ou un litige ?
          </h3>
          <p class="text-blue-100 text-sm sm:text-base leading-relaxed">
            Notre assistant juridique intelligent analyse plus de 2 200 lois et 43 000 articles en temps réel pour vous donner une réponse sourcée et vulgarisée.
          </p>
        </div>
        <a
          href="/chat"
          class="shrink-0 px-6 py-3.5 bg-white text-blue-700 font-bold rounded-xl shadow-lg hover:bg-blue-50 transition-all hover:scale-105 inline-flex items-center gap-2"
        >
          <span class="material-icons text-lg" aria-hidden="true">smart_toy</span>
          <span>Interroger l'Assistant IA</span>
        </a>
      </div>
    </div>
  </div>
</main>

<SiteFooter />
