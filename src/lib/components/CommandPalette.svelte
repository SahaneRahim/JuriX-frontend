<script lang="ts">
  import { onMount, tick } from "svelte";
  import { goto } from "$app/navigation";
  import { fade, scale } from "svelte/transition";
  import { API_URL } from "$lib/api";
  import {
    commandPaletteOpen,
    closeCommandPalette,
  } from "$lib/stores/commandPalette";
  import { BLOG_POSTS } from "$lib/data/blog";

  let query = "";
  let inputElement: HTMLInputElement;
  let selectedIndex = 0;
  let loading = false;
  let debounceTimer: ReturnType<typeof setTimeout>;

  interface SuggestionItem {
    id?: number;
    title: string;
    subtitle?: string;
    icon: string;
    badge?: string;
    action: () => void;
  }

  let suggestions: SuggestionItem[] = [];

  const defaultActions: SuggestionItem[] = [
    {
      title: "Poser une question à l'Assistant IA",
      subtitle: "Réponses sourcées par notre IA sur l'ensemble du droit",
      icon: "smart_toy",
      badge: "Assistant",
      action: () => {
        close();
        goto("/chat");
      },
    },
    {
      title: "L'Actualité Décryptée (Blog)",
      subtitle: "Analyses hebdomadaires des sujets chauds par l'IA",
      icon: "article",
      badge: "Blog",
      action: () => {
        close();
        goto("/blog");
      },
    },
    {
      title: "Explorer tous les textes de lois",
      subtitle: "Codes, lois, décrets et arrêtés classés par catégories",
      icon: "description",
      badge: "Lois",
      action: () => {
        close();
        goto("/laws");
      },
    },
    {
      title: "Comparer deux régimes juridiques",
      subtitle: "Tableau comparatif dynamique article par article",
      icon: "balance",
      badge: "Outil",
      action: () => {
        close();
        goto("/compare");
      },
    },
  ];

  function close() {
    closeCommandPalette();
    query = "";
    selectedIndex = 0;
    suggestions = [];
  }

  async function chercherSuggestions(texte: string) {
    if (!texte.trim()) {
      suggestions = [];
      loading = false;
      return;
    }

    loading = true;
    const q = texte.trim();
    const resultats: SuggestionItem[] = [];

    // 1. Action directe de recherche globale
    resultats.push({
      title: `Rechercher « ${q} » dans toutes les lois`,
      subtitle: "Lancer la recherche plein texte et sémantique",
      icon: "search",
      badge: "Recherche",
      action: () => {
        close();
        goto(`/search?q=${encodeURIComponent(q)}`);
      },
    });

    // 2. Action directe de question IA
    resultats.push({
      title: `Demander à l'IA : « ${q} »`,
      subtitle: "Obtenir une réponse personnalisée et vulgarisée",
      icon: "smart_toy",
      badge: "Assistant",
      action: () => {
        close();
        goto(`/chat?q=${encodeURIComponent(q)}`);
      },
    });

    // 3. Articles du blog correspondants
    const blogMatches = BLOG_POSTS.filter(
      (b) =>
        b.title.toLowerCase().includes(q.toLowerCase()) ||
        b.category.toLowerCase().includes(q.toLowerCase()) ||
        b.tags.some((t) => t.toLowerCase().includes(q.toLowerCase()))
    );

    for (const b of blogMatches.slice(0, 2)) {
      resultats.push({
        title: b.title,
        subtitle: `Article de blog • ${b.category}`,
        icon: "article",
        badge: "Actualité",
        action: () => {
          close();
          goto(`/blog/${b.slug}`);
        },
      });
    }

    // 4. Suggestions de l'API backend
    try {
      const resp = await fetch(
        `${API_URL}/search/suggest?q=${encodeURIComponent(q)}&limit=4`
      );
      if (resp.ok) {
        const data = await resp.json();
        const apiSuggestions = data.suggestions || [];
        for (const item of apiSuggestions) {
          resultats.push({
            id: item.id,
            title: item.title,
            subtitle: item.reference || "Texte de loi officiel",
            icon: "description",
            badge: "Loi",
            action: () => {
              close();
              goto(`/laws/${item.id}`);
            },
          });
        }
      }
    } catch {
      // Ignorer les pannes réseau
    }

    suggestions = resultats;
    loading = false;
    selectedIndex = 0;
  }

  function onInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    query = val;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      chercherSuggestions(val);
    }, 200);
  }

  $: displayedItems = query.trim() ? suggestions : defaultActions;

  function onKeydown(e: KeyboardEvent) {
    // Raccourci global Ctrl+K ou Cmd+K
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if ($commandPaletteOpen) {
        close();
      } else {
        commandPaletteOpen.set(true);
      }
      return;
    }

    if (!$commandPaletteOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (displayedItems.length > 0) {
        selectedIndex = (selectedIndex + 1) % displayedItems.length;
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (displayedItems.length > 0) {
        selectedIndex =
          (selectedIndex - 1 + displayedItems.length) % displayedItems.length;
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (displayedItems[selectedIndex]) {
        displayedItems[selectedIndex].action();
      }
    }
  }

  $: if ($commandPaletteOpen) {
    tick().then(() => {
      inputElement?.focus();
    });
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if $commandPaletteOpen}
  <div
    class="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 sm:px-6"
    role="dialog"
    aria-modal="true"
    aria-label="Palette de commande"
  >
    <!-- Arrière-plan flouté avec fermeture au clic -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
      on:click={close}
      transition:fade={{ duration: 150 }}
    ></div>

    <!-- Boîte de dialogue flottante -->
    <div
      class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh] z-10"
      transition:scale={{ duration: 150, start: 0.95 }}
    >
      <!-- Barre de saisie -->
      <div class="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3">
        {#if loading}
          <svg class="w-6 h-6 animate-spin text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        {:else}
          <span class="material-icons text-slate-400 text-2xl shrink-0" aria-hidden="true">search</span>
        {/if}
        <input
          bind:this={inputElement}
          type="text"
          value={query}
          on:input={onInput}
          placeholder="Rechercher une loi, un sujet, ou poser une question…"
          class="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-base focus:outline-none"
        />
        {#if query}
          <button
            on:click={() => {
              query = "";
              suggestions = [];
              inputElement.focus();
            }}
            class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1.5 py-0.5 rounded"
          >
            Effacer
          </button>
        {/if}
        <kbd
          class="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm"
        >
          Échap
        </kbd>
      </div>

      <!-- Liste des résultats / actions -->
      <div class="overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-96">
        {#if displayedItems.length > 0}
          <div class="py-1">
            <div class="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {query.trim() ? "Résultats & Actions" : "Raccourcis & Navigation"}
            </div>
            {#each displayedItems as item, idx}
              <button
                type="button"
                on:click={item.action}
                on:mouseenter={() => (selectedIndex = idx)}
                class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors {selectedIndex === idx
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-900 dark:text-blue-100'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'}"
              >
                <div class="flex items-center gap-3 min-w-0 pr-2">
                  <span
                    class="material-icons text-xl shrink-0 {selectedIndex === idx
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-slate-400 dark:text-slate-500'}"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold truncate leading-tight">
                      {item.title}
                    </p>
                    {#if item.subtitle}
                      <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    {/if}
                  </div>
                </div>

                {#if item.badge}
                  <span
                    class="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border {selectedIndex === idx
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}"
                  >
                    {item.badge}
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        {:else}
          <div class="p-8 text-center space-y-2">
            <span class="material-icons text-slate-400 text-4xl">search_off</span>
            <p class="text-sm text-slate-600 dark:text-slate-300 font-medium">
              Aucun résultat pour « {query} »
            </p>
            <p class="text-xs text-slate-400">
              Essayez avec d'autres mots-clés ou posez directement votre question dans le chat.
            </p>
          </div>
        {/if}
      </div>

      <!-- Pied de la boîte de commande -->
      <div
        class="px-4 py-2 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400"
      >
        <div class="flex items-center gap-3">
          <span class="inline-flex items-center gap-1">
            <kbd class="px-1 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px]">↑</kbd>
            <kbd class="px-1 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px]">↓</kbd>
            <span>Naviguer</span>
          </span>
          <span class="inline-flex items-center gap-1">
            <kbd class="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px]">↵</kbd>
            <span>Ouvrir</span>
          </span>
        </div>
        <span class="text-[11px] font-medium text-slate-500">
          Palette universelle JuriX
        </span>
      </div>
    </div>
  </div>
{/if}
