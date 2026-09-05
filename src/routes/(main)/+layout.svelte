<script lang="ts">
  import { page } from "$app/stores";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { language, tr } from "$lib/stores/language";
  import { fade, fly } from "svelte/transition";
  import { cubicIn, cubicOut } from "svelte/easing";

  /**
   * Le hero, les onglets et le bouton flottant sont propres à l'accueil.
   *
   * Ils étaient rendus par ce layout, donc aussi sur /chat : le titre marketing
   * s'affichait au-dessus de la fenêtre de conversation, et le bouton flottant
   * « aller à l'assistant » était visible depuis l'assistant lui-même.
   *
   * `route.id` plutôt que `pathname` : insensible à une éventuelle barre
   * oblique finale.
   */
  $: isChat = $page.route.id === "/(main)/chat";
</script>

<svelte:head>
  <title>JuriX - {$tr("title.assistant")}</title>
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
    rel="stylesheet"
  />
  <link
    href="https://fonts.googleapis.com/icon?family=Material+Icons"
    rel="stylesheet"
  />
</svelte:head>

<div
  class="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark transition-colors duration-300 min-h-screen flex flex-col font-body"
>
  <SiteHeader variant="transparent" />

  <!-- Main Content -->
  <main
    class="flex-grow flex flex-col items-center justify-start px-4 md:px-6 relative overflow-hidden {isChat
      ? 'pt-6'
      : 'pt-12 md:pt-20'}"
  >
    <!-- Background Gradient -->
    <div
      class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-blue-50/50 via-white to-transparent dark:from-slate-800/20 dark:via-background-dark dark:to-background-dark -z-10 pointer-events-none"
    ></div>

    <!-- Persistent Hero Section -->
    <div class="w-full flex flex-col items-center">
      <!-- Hero Section -->
      <div
        class="relative w-full flex flex-col items-center px-4 {isChat
          ? 'pt-2'
          : 'pt-20 md:pt-32 pb-12'}"
      >
        {#if !isChat}
          <!-- Translatable Hero Content -->
          {#key $language.current}
            <div
              class="flex flex-col items-center w-full"
              in:fade={{ duration: 250, delay: 250 }}
              out:fade={{ duration: 200 }}
            >
              <!-- Badge -->
              <div
                class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-semibold mb-8 backdrop-blur-sm"
              >
                <span class="w-2 h-2 rounded-full bg-primary animate-pulse"
                ></span>
                {$tr("hero.badge")}
              </div>

              <!-- Title -->
              <h1
                class="text-5xl md:text-7xl font-extrabold text-center text-slate-900 dark:text-white leading-tight mb-6 max-w-4xl tracking-tight"
              >
                {$tr("hero.title").replace("IA", "")}<br />
                <span
                  class="bg-gradient-to-r from-blue-500 to-blue-400 bg-clip-text text-transparent"
                  >IA</span
                >
              </h1>

              <!-- Subtitle -->
              <p
                class="text-center text-secondary-text-light dark:text-secondary-text-dark/70 text-lg md:text-xl max-w-2xl mb-12 leading-relaxed"
              >
                {$tr("hero.subtitle")}
              </p>
            </div>
          {/key}

          <!-- Search Tabs -->
          <div
            class="relative inline-grid grid-cols-2 bg-white border border-gray-100 dark:bg-white/5 p-1 rounded-xl dark:backdrop-blur-md dark:border-white/10 mb-8 shadow-sm dark:shadow-none"
          >
            <!-- Sliding Background -->
            <div
              class="sliding-pill-tabs absolute top-1 bottom-1 rounded-lg bg-blue-50 dark:bg-blue-500/20 shadow-sm"
              class:left-1={$page.url.pathname === "/"}
              class:right-1={$page.url.pathname === "/chat"}
              style="width: calc(50% - 4px);"
            ></div>

            <a
              href="/"
              class="relative z-10 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors duration-300 min-w-[140px] {$page
                .url.pathname === '/'
                ? 'text-blue-600 dark:text-blue-100'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}"
            >
              <span class="material-icons text-sm">search</span>
              {$tr("mode.search")}
            </a>
            <a
              href="/chat"
              class="relative z-10 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors duration-300 min-w-[140px] {$page
                .url.pathname === '/chat'
                ? 'text-blue-600 dark:text-blue-100'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}"
            >
              <span class="material-icons text-sm">auto_awesome</span>
              {$tr("mode.chat")}
            </a>
          </div>

        {/if}

        <!-- Dynamic Content Slot (Search Bar or Chat) -->
        <!-- Using key to trigger transition when path changes -->
        {#key $page.url.pathname}
          <div
            class="w-full flex flex-col items-center justify-center"
            in:fly={{ y: 30, duration: 500, delay: 100, easing: cubicOut }}
            out:fly={{ y: -20, duration: 300, easing: cubicIn }}
          >
            <slot />
          </div>
        {/key}
      </div>
    </div>
  </main>

  <SiteFooter />

  <!-- Bouton flottant : masque sur /chat, ou il pointerait sur la page courante -->
  {#if !isChat}
  <a
    href="/chat"
    class="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-2xl shadow-blue-500/40 hover:-translate-y-1 hover:shadow-blue-500/60 transition-all duration-300 z-50 flex items-center justify-center"
  >
    <span class="material-icons text-3xl">smart_toy</span>
  </a>
  {/if}
</div>

<style>
  :global(body) {
    font-family: "Inter", sans-serif;
  }

  .sliding-pill-tabs {
    transition:
      left 0.4s cubic-bezier(0.4, 0, 0.2, 1),
      right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
</style>
