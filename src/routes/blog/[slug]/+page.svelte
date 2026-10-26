<script lang="ts">
  import { page } from "$app/stores";
  import MetaSeo from "$lib/components/MetaSeo.svelte";
  import { urlCanonique } from "$lib/seo";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import type { PageData } from "./$types";

  export let data: PageData;
  $: post = data.post;

  let lienCopie = false;
  let minuterieCopie: ReturnType<typeof setTimeout>;

  function copierLien() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      lienCopie = true;
      clearTimeout(minuterieCopie);
      minuterieCopie = setTimeout(() => {
        lienCopie = false;
      }, 3000);
    }
  }

  $: urlActuelle = typeof window !== "undefined" ? window.location.href : `https://jurix.cm/blog/${post.slug}`;
  $: messagePartage = encodeURIComponent(`${post.title}\n\nDécryptage juridique par l'IA :\n${urlActuelle}`);
  $: urlWhatsApp = `https://api.whatsapp.com/send?text=${messagePartage}`;
  $: urlTwitter = `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(urlActuelle)}`;
  $: urlLinkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(urlActuelle)}`;
  $: urlChatAvecQuestion = `/chat?q=${encodeURIComponent(post.suggestedChatQuestion)}`;
</script>

<MetaSeo
  titre={`${post.title} — Décryptage Juridique`}
  description={post.excerpt}
  canonique={urlCanonique($page.url)}
/>

<SiteHeader />

<main id="contenu" class="px-zone-sure">
  <div class="min-h-app bg-slate-50 dark:bg-background-dark py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto space-y-10 sm:space-y-12">
      <!-- Fil d'Ariane -->
      <nav aria-label="Fil d'Ariane" class="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
        <a href="/" class="hover:text-blue-600 dark:hover:text-blue-400">Accueil</a>
        <span>/</span>
        <a href="/blog" class="hover:text-blue-600 dark:hover:text-blue-400">Blog</a>
        <span>/</span>
        <span class="text-slate-800 dark:text-slate-200 truncate font-medium">{post.category}</span>
      </nav>

      <!-- En-tête de l'article -->
      <header class="space-y-4">
        <div class="flex flex-wrap items-center gap-3">
          <span
            class="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs font-bold uppercase tracking-wider border border-blue-200 dark:border-blue-800"
          >
            {post.category}
          </span>
          <span class="text-xs text-slate-500 dark:text-slate-400">
            {post.formattedDate} • {post.readingTime} de lecture
          </span>
        </div>

        <h1 class="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white leading-tight tracking-tight">
          {post.title}
        </h1>

        <p class="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          {post.excerpt}
        </p>

        <!-- Barre de partage rapide -->
        <div class="pt-2 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span class="material-icons text-base text-blue-600 dark:text-blue-400">smart_toy</span>
            <span>Rédigé avec l'assistance de <strong>JuriX IA</strong></span>
          </div>

          <div class="flex items-center gap-2">
            <a
              href={urlWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              class="p-2 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors inline-flex items-center gap-1.5 text-xs font-semibold"
              title="Partager sur WhatsApp"
            >
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.04-1.077-.077-.24-.074-.537-.183-1.002-.384-1.98-.857-3.266-2.868-3.364-3.001-.099-.134-.805-1.071-.805-2.043 0-.972.51-1.448.691-1.644.182-.196.398-.246.531-.246.133 0 .266.002.383.007.123.006.287-.046.45.344.167.399.571 1.393.621 1.496.051.103.085.224.017.359-.068.134-.102.218-.203.336-.101.118-.212.264-.303.355-.102.102-.208.213-.089.417.119.204.529.873 1.135 1.413.782.696 1.441.911 1.645 1.013.204.102.324.085.443-.051.12-.136.512-.596.649-.8.136-.204.273-.17.458-.102.186.068 1.178.556 1.381.658.204.102.34.153.39.238.051.085.051.491-.093.896z"/></svg>
              <span class="hidden sm:inline">WhatsApp</span>
            </a>
            <a
              href={urlLinkedIn}
              target="_blank"
              rel="noopener noreferrer"
              class="p-2 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600/20 transition-colors inline-flex items-center gap-1.5 text-xs font-semibold"
              title="Partager sur LinkedIn"
            >
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              <span class="hidden sm:inline">LinkedIn</span>
            </a>
            <a
              href={urlTwitter}
              target="_blank"
              rel="noopener noreferrer"
              class="p-2 rounded-lg bg-slate-900/10 dark:bg-white/10 text-slate-800 dark:text-slate-200 hover:bg-slate-900/20 transition-colors inline-flex items-center gap-1.5 text-xs font-semibold"
              title="Partager sur X (Twitter)"
            >
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              <span class="hidden sm:inline">X</span>
            </a>
            <button
              on:click={copierLien}
              class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 text-xs font-semibold relative"
              title="Copier le lien"
            >
              <span class="material-icons text-base">{lienCopie ? "check" : "link"}</span>
              <span>{lienCopie ? "Copié !" : "Copier le lien"}</span>
            </button>
          </div>
        </div>
      </header>

      <!-- BLOC 1 : L'Actualité en 2 minutes (Le contexte) -->
      <section class="bg-amber-500/10 border-l-4 border-amber-500 rounded-r-2xl p-5 sm:p-7 space-y-3">
        <div class="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm uppercase tracking-wider">
          <span class="material-icons text-xl">article</span>
          <span>1. L'Actualité en 2 minutes (Le contexte)</span>
        </div>
        <p class="text-base sm:text-lg text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
          {post.context}
        </p>
      </section>

      <!-- BLOC 2 : Ce que dit la loi — L'Analyse du Bot -->
      <section class="space-y-8">
        <div class="space-y-3">
          <div class="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm uppercase tracking-wider">
            <span class="material-icons text-xl">gavel</span>
            <span>2. Ce que dit la loi — L'Analyse de l'IA</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Explication juridique simplifiée
          </h2>
          <p class="text-base sm:text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
            {post.botAnalysis.summary}
          </p>
        </div>

        <!-- Points clés à retenir -->
        <div class="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span class="material-icons text-green-500">check</span>
            <span>Les 4 règles essentielles à retenir</span>
          </h3>
          <ul class="space-y-3">
            {#each post.botAnalysis.keyPoints as point}
              <li class="flex items-start gap-3 text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
                <span class="text-blue-500 font-bold mt-0.5">•</span>
                <span>{point}</span>
              </li>
            {/each}
          </ul>
        </div>

        <!-- Textes et articles de lois cités -->
        {#if post.botAnalysis.citations.length > 0}
          <div class="space-y-4">
            <h3 class="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="material-icons text-blue-600 dark:text-blue-400">description</span>
              <span>Textes de loi officiels applicables</span>
            </h3>

            <div class="grid grid-cols-1 gap-4">
              {#each post.botAnalysis.citations as citation}
                <div
                  class="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 sm:p-6 space-y-3 relative hover:border-blue-500 transition-colors shadow-sm"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 font-bold text-xs uppercase tracking-wide">
                      {citation.articleNumber ? `Article ${citation.articleNumber}` : 'Extrait légal'}
                    </span>
                    <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {citation.reference}
                    </span>
                  </div>

                  <h4 class="font-bold text-slate-900 dark:text-white text-base">
                    {citation.title}
                  </h4>

                  <blockquote class="italic text-sm text-slate-600 dark:text-slate-300 pl-4 border-l-2 border-blue-500 leading-relaxed">
                    « {citation.excerpt} »
                  </blockquote>

                  <div class="pt-2">
                    <a
                      href="/laws/{citation.lawId}"
                      class="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <span>Consulter le texte complet de la loi</span>
                      <span class="material-icons text-sm" aria-hidden="true">arrow_forward</span>
                    </a>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Ce que cela change pour vous -->
        <div class="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl p-6 sm:p-8 space-y-2">
          <h3 class="text-lg font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
            <span class="material-icons text-blue-600 dark:text-blue-400">auto_awesome</span>
            <span>Ce que cela change concrètement pour vous</span>
          </h3>
          <p class="text-sm sm:text-base text-blue-950 dark:text-blue-100 leading-relaxed font-medium">
            {post.botAnalysis.citizenImpact}
          </p>
        </div>
      </section>

      <!-- BLOC 3 : Action Virale & Assistant IA -->
      <section
        class="bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl space-y-6"
      >
        <div class="space-y-2">
          <span class="px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider text-blue-100">
            Assistance juridique sur mesure
          </span>
          <h3 class="text-2xl sm:text-3xl font-extrabold leading-tight">
            Vous traversez une situation similaire ?
          </h3>
          <p class="text-blue-100 text-sm sm:text-base leading-relaxed max-w-2xl">
            Ne restez pas dans le doute. Posez directement votre question à notre assistant IA, qui analysera les spécificités de votre cas à la lumière des textes officiels.
          </p>
        </div>

        <div class="pt-2 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
          <a
            href={urlChatAvecQuestion}
            class="px-6 py-3.5 bg-white text-blue-800 font-bold rounded-xl shadow-lg hover:bg-blue-50 transition-all hover:scale-105 inline-flex items-center justify-center gap-2 text-center"
          >
            <span class="material-icons text-xl" aria-hidden="true">smart_toy</span>
            <span>Poser cette question à l'Assistant</span>
          </a>

          <a
            href="/blog"
            class="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2 text-center text-sm"
          >
            <span class="material-icons text-base" aria-hidden="true">arrow_back</span>
            <span>Tous les décryptages</span>
          </a>
        </div>
      </section>
    </div>
  </div>
</main>

<SiteFooter />
