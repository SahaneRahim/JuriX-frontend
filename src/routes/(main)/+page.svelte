<script lang="ts">
  import { goto } from "$app/navigation";
  import { tr } from "$lib/stores/language";
  import { fade, fly } from "svelte/transition";

  let searchQuery = "";

  function handleSearch() {
    if (searchQuery.trim()) {
      goto(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleSearch();
    }
  }

  // Full 14 categories configuration
  $: categories = [
    {
      id: "constitutionnel",
      filter: "constitution",
      icon: "account_balance",
      color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
      labelKey: "cat.constitutionnel",
      descKey: "catdesc.constitutionnel",
    },
    {
      id: "international",
      filter: "international",
      icon: "public",
      color: "text-blue-800 bg-blue-50 dark:bg-blue-900/10",
      labelKey: "cat.international",
      descKey: "catdesc.international",
    },
    {
      id: "civil",
      filter: "civil",
      icon: "groups",
      color: "text-purple-600 bg-purple-50 dark:bg-purple-500/10",
      labelKey: "cat.civil",
      descKey: "catdesc.civil",
    },
    {
      id: "penal",
      filter: "penal",
      icon: "lock",
      color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-500/10",
      labelKey: "cat.penal",
      descKey: "catdesc.penal",
    },
    {
      id: "travail",
      filter: "travail",
      icon: "work",
      color: "text-sky-600 bg-sky-50 dark:bg-sky-500/10",
      labelKey: "cat.travail",
      descKey: "catdesc.travail",
    },
    {
      id: "fiscal",
      filter: "fiscal",
      icon: "attach_money",
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
      labelKey: "cat.fiscal",
      descKey: "catdesc.fiscal",
    },
    {
      id: "affaires",
      filter: "affaires",
      icon: "business_center",
      color: "text-red-600 bg-red-50 dark:bg-red-500/10",
      labelKey: "cat.affaires",
      descKey: "catdesc.affaires",
    },
    {
      id: "lois",
      filter: "loi",
      icon: "menu_book",
      color: "text-rose-600 bg-rose-50 dark:bg-rose-500/10",
      labelKey: "cat.lois",
      descKey: "catdesc.lois",
    },
    {
      id: "ordonnances",
      filter: "ordonnance",
      icon: "assignment_late",
      color: "text-orange-600 bg-orange-50 dark:bg-orange-500/10",
      labelKey: "cat.ordonnances",
      descKey: "catdesc.ordonnances",
    },
    {
      id: "decrets",
      filter: "decret",
      icon: "description",
      color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10",
      labelKey: "cat.decrets",
      descKey: "catdesc.decrets",
    },
    {
      id: "arretes",
      filter: "arrete",
      icon: "rule",
      color: "text-teal-600 bg-teal-50 dark:bg-teal-500/10",
      labelKey: "cat.arretes",
      descKey: "catdesc.arretes",
    },
    {
      id: "circulaires",
      filter: "circulaire",
      icon: "campaign",
      color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-500/10",
      labelKey: "cat.circulaires",
      descKey: "catdesc.circulaires",
    },
    {
      id: "decisions",
      filter: "decision",
      icon: "fact_check",
      color: "text-blue-600 bg-blue-50 dark:bg-blue-500/10",
      labelKey: "cat.decisions",
      descKey: "catdesc.decisions",
    },
    {
      id: "autres",
      filter: "autre",
      icon: "category",
      color: "text-slate-600 bg-slate-50 dark:bg-slate-500/10",
      labelKey: "cat.autres",
      descKey: "catdesc.autres",
    },
  ];
</script>

<svelte:head>
  <title>JuriX - {$tr("title.home")}</title>
</svelte:head>

<div
  class="w-full max-w-7xl flex flex-col items-center pb-20"
  in:fade={{ duration: 300, delay: 150 }}
>
  <!-- Search Bar -->
  <div class="w-full max-w-3xl relative group z-20 mb-16">
    <div
      class="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity duration-300"
    ></div>
    <div
      class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex items-center p-2 border border-slate-100 dark:border-slate-700/50"
    >
      <div class="pl-4 text-slate-400">
        <span class="material-icons text-2xl">search</span>
      </div>
      <input
        type="text"
        bind:value={searchQuery}
        on:keydown={handleKeydown}
        placeholder={$tr("search.placeholder")}
        class="w-full bg-transparent border-none text-lg text-slate-800 dark:text-white placeholder-slate-400 focus:ring-0 px-4 py-3"
        autofocus
      />
      <button
        on:click={handleSearch}
        class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 active:scale-95"
      >
        {$tr("search.button")}
      </button>
    </div>
  </div>

  <!-- Section Title -->
  <div class="text-center mb-10 w-full">
    <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">
      {$tr("categories.title")}
    </h2>
    <p class="text-slate-500 dark:text-slate-400">
      {$tr("categories.subtitle")}
    </p>
  </div>

  <!-- Categories Grid -->
  <div
    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full px-4"
  >
    {#each categories as cat, i}
      <a
        href="/categories/{cat.id}"
        class="group relative flex flex-col p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
      >
        <!-- Icon -->
        <div class="mb-3 flex items-center justify-between">
          <div
            class="w-10 h-10 rounded-xl {cat.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
          >
            <span class="material-icons text-xl">{cat.icon}</span>
          </div>

          <!-- Small arrow on hover -->
          <span
            class="material-icons text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-1 group-hover:translate-x-0 text-sm"
            >arrow_forward</span
          >
        </div>

        <!-- Content -->
        <div>
          <h3
            class="text-base font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
          >
            {$tr(cat.labelKey)}
          </h3>
          <p
            class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2"
          >
            {$tr(cat.descKey)}
          </p>
        </div>
      </a>
    {/each}
  </div>
</div>
