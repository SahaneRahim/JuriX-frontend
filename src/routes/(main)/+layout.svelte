<script lang="ts">
  import { page } from "$app/stores";
  import { language, switchLanguage, tr } from "$lib/stores/language";
  import { themeStore } from "$lib/stores/theme";
  import { fade, fly } from "svelte/transition";
  import { cubicIn, cubicOut } from "svelte/easing";
  import { onMount } from "svelte";

  // Transition settings
  const transitionDuration = 300;
  const transitionDelay = 0;
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
  <!-- Header -->
  <header
    class="w-full py-4 px-6 md:px-12 flex items-center justify-between bg-transparent relative z-50"
  >
    <!-- Logo Section (Left) -->
    <a href="/" class="flex items-center gap-3 flex-1">
      <div
        class="bg-primary w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30"
      >
        <span class="material-icons text-white text-xl">balance</span>
      </div>
      <span
        class="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
        >JuriX</span
      >
    </a>

    <!-- Navigation (Center) -->
    <nav
      class="hidden md:flex items-center justify-center gap-8 text-sm font-medium text-secondary-text-light dark:text-secondary-text-dark flex-1"
    >
      <a
        class="hover:text-primary transition-colors whitespace-nowrap {$page.url
          .pathname === '/'
          ? 'text-primary'
          : ''}"
        href="/">{$tr("nav.home")}</a
      >
      <!-- Pointait /categories, qui n'existe pas : seule /categories/[id] est
           definie, donc ce lien de navigation repondait 404. Il mene desormais
           a la liste des documents. -->
      <a
        class="hover:text-primary transition-colors whitespace-nowrap {$page.url
          .pathname.startsWith('/laws')
          ? 'text-primary'
          : ''}"
        href="/laws">{$tr("nav.documents")}</a
      >
      <a
        class="hover:text-primary transition-colors whitespace-nowrap {$page.url
          .pathname === '/about'
          ? 'text-primary'
          : ''}"
        href="/about">{$tr("nav.about")}</a
      >
    </nav>

    <!-- Actions (Right) -->
    <div class="hidden md:flex items-center justify-end gap-3 flex-1">
      <div class="h-4 w-px bg-white/10 mx-2"></div>

      <div
        class="relative flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-lg"
      >
        <!-- Sliding Pill Background -->
        <div
          class="sliding-pill absolute top-1 bottom-1 w-10 rounded-md bg-white dark:bg-white/10 shadow-sm"
          class:translate-x-0={$language.current === "fr"}
          class:translate-x-full={$language.current === "en"}
        ></div>

        <button
          on:click={() => switchLanguage("fr")}
          class="relative z-10 w-10 py-1 rounded-md text-xs font-bold transition-colors duration-300 {$language.current ===
          'fr'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}"
          >FR</button
        >
        <button
          on:click={() => switchLanguage("en")}
          class="relative z-10 w-10 py-1 rounded-md text-xs font-bold transition-colors duration-300 {$language.current ===
          'en'
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}"
          >EN</button
        >
      </div>

      <!-- Dark Mode Toggle -->
      <button
        on:click={themeStore.toggle}
        class="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent dark:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        aria-label="Toggle Dark Mode"
      >
        {#if $themeStore === "dark"}
          <span class="material-icons text-lg">light_mode</span>
        {:else}
          <span class="material-icons text-lg">dark_mode</span>
        {/if}
      </button>

      <div class="flex items-center gap-3 ml-2">
        <a
          class="px-5 py-2 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap bg-white text-blue-600 hover:bg-gray-50 border border-transparent shadow-sm dark:bg-white/5 dark:border-white/10 dark:text-blue-400 dark:hover:bg-white/10"
          href="/login"
        >
          {$tr("nav.login")}
        </a>
        <a
          class="px-5 py-2 rounded-lg font-semibold text-sm transition-all shadow-lg whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
          href="/signup"
        >
          {$tr("nav.signup")}
        </a>
      </div>
    </div>

    <!-- Mobile Menu Button -->
    <div class="flex md:hidden flex-1 justify-end">
      <button class="p-2 text-slate-600 dark:text-slate-300">
        <span class="material-icons">menu</span>
      </button>
    </div>
  </header>

  <!-- Main Content -->
  <main
    class="flex-grow flex flex-col items-center justify-start pt-12 md:pt-20 px-4 md:px-6 relative overflow-hidden"
  >
    <!-- Background Gradient -->
    <div
      class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-blue-50/50 via-white to-transparent dark:from-slate-800/20 dark:via-background-dark dark:to-background-dark -z-10 pointer-events-none"
    ></div>

    <!-- Persistent Hero Section -->
    <div class="w-full flex flex-col items-center">
      <!-- Hero Section -->
      <div
        class="relative w-full flex flex-col items-center pt-20 md:pt-32 pb-12 px-4"
      >
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

  <!-- Footer -->
  <footer
    class="border-t border-slate-200 dark:border-white/5 py-8 bg-white dark:bg-[#0a1628]/80 backdrop-blur-md mt-auto"
  >
    <div
      class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4"
    >
      <div class="flex items-center gap-2">
        <div
          class="bg-gradient-to-br from-blue-500 to-blue-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20"
        >
          <span class="material-icons text-white text-sm">balance</span>
        </div>
        <span class="font-bold text-slate-700 dark:text-white text-lg"
          >JuriX</span
        >
      </div>
      <p
        class="text-sm text-secondary-text-light dark:text-secondary-text-dark/60"
      >
        {$tr("footer.rights")}
      </p>
    </div>
  </footer>

  <!-- Floating AI Button -->
  <a
    href="/chat"
    class="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-2xl shadow-blue-500/40 hover:-translate-y-1 hover:shadow-blue-500/60 transition-all duration-300 z-50 flex items-center justify-center"
  >
    <span class="material-icons text-3xl">smart_toy</span>
  </a>
</div>

<style>
  :global(body) {
    font-family: "Inter", sans-serif;
  }

  /* Smooth transitions for sliding pill */
  .sliding-pill {
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sliding-pill-tabs {
    transition:
      left 0.4s cubic-bezier(0.4, 0, 0.2, 1),
      right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
</style>
