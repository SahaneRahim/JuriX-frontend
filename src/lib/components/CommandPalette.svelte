<script lang="ts">
  /**
   * Palette de commande : Ctrl+K (Cmd+K sur Mac) ou la loupe de l'en-tête.
   * Vide, elle propose les grandes pages ; à la saisie, la recherche, une
   * question à l'assistant, puis les articles du blog et les lois qui
   * correspondent.
   *
   * Ses libellés passent par `$tr` : écrits en dur en français, ils restaient
   * français dans l'interface anglaise. Les titres venus des données (lois de
   * l'API, articles du blog) s'affichent tels quels.
   */
  import { tick } from "svelte";
  import { goto } from "$app/navigation";
  import { fade, scale } from "svelte/transition";
  import { API_URL } from "$lib/api";
  import Icone from "$lib/components/Icone.svelte";
  import type { NomIcone } from "$lib/icones";
  import {
    commandPaletteOpen,
    closeCommandPalette,
  } from "$lib/stores/commandPalette";
  import { language, tr } from "$lib/stores/language";
  import { BLOG_POSTS, nomRubrique } from "$lib/data/blog";

  let query = "";
  let inputElement: HTMLInputElement;
  let selectedIndex = 0;
  let loading = false;
  let debounceTimer: ReturnType<typeof setTimeout>;

  interface SuggestionItem {
    id?: number;
    title: string;
    subtitle?: string;
    /** Nom Lucide : un nom absent de src/lib/icones.ts est une erreur de typage. */
    icon: NomIcone;
    badge?: string;
    action: () => void;
  }

  let suggestions: SuggestionItem[] = [];

  /** Le libellé traduit, son `{q}` remplacé par la saisie. */
  function avecSaisie(libelle: string, saisie: string): string {
    // Une fonction, et non la saisie elle-même : dans une chaîne de
    // remplacement, un `$&` ou un `$1` tapé par l'utilisateur serait
    // interprété par `replace`.
    return libelle.replace("{q}", () => saisie);
  }

  // Réactif : les raccourcis suivent la langue de l'interface.
  $: defaultActions = actionsParDefaut($tr);

  function actionsParDefaut(t: (cle: string) => string): SuggestionItem[] {
    return [
      {
        title: t("palette.askAi.title"),
        subtitle: t("palette.askAi.subtitle"),
        icon: "bot",
        badge: t("palette.badge.assistant"),
        action: () => {
          close();
          goto("/chat");
        },
      },
      {
        title: t("palette.blog.title"),
        subtitle: t("palette.blog.subtitle"),
        icon: "newspaper",
        badge: t("palette.badge.blog"),
        action: () => {
          close();
          goto("/blog");
        },
      },
      {
        title: t("palette.laws.title"),
        subtitle: t("palette.laws.subtitle"),
        icon: "file-text",
        badge: t("palette.badge.laws"),
        action: () => {
          close();
          goto("/laws");
        },
      },
      {
        title: t("palette.compare.title"),
        subtitle: t("palette.compare.subtitle"),
        icon: "scale",
        badge: t("palette.badge.tool"),
        action: () => {
          close();
          goto("/compare");
        },
      },
    ];
  }

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
      title: avecSaisie($tr("palette.searchAll.title"), q),
      subtitle: $tr("palette.searchAll.subtitle"),
      icon: "search",
      badge: $tr("palette.badge.search"),
      action: () => {
        close();
        goto(`/search?q=${encodeURIComponent(q)}`);
      },
    });

    // 2. Action directe de question IA
    resultats.push({
      title: avecSaisie($tr("palette.askAiQuery.title"), q),
      subtitle: $tr("palette.askAiQuery.subtitle"),
      icon: "bot",
      badge: $tr("palette.badge.assistant"),
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
        // Rubrique traduite, comme sur /blog : la valeur est en français.
        subtitle: `${$tr("palette.blogPost")} • ${nomRubrique(b.category, $language.current)}`,
        icon: "newspaper",
        badge: $tr("palette.badge.news"),
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
            subtitle: item.reference || $tr("palette.lawFallback"),
            icon: "file-text",
            badge: $tr("palette.badge.law"),
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
    aria-label={$tr("palette.label")}
  >
    <!-- Arrière-plan flouté avec fermeture au clic -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm transition-opacity"
      on:click={close}
      transition:fade={{ duration: 150 }}
    ></div>

    <!-- Boîte de dialogue flottante -->
    <div
      class="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-xl dark:shadow-none border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[80vh] z-10"
      transition:scale={{ duration: 150, start: 0.95 }}
    >
      <!-- Barre de saisie -->
      <div class="flex items-center px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 gap-3">
        {#if loading}
          <Icone nom="loader-circle" class="w-6 h-6 text-zinc-950 dark:text-white motion-safe:animate-spin" />
        {:else}
          <Icone nom="search" class="text-2xl text-zinc-400 dark:text-zinc-500" />
        {/if}
        <!-- Champ sans cadre (guide § 4.5) : toute la fenêtre tient lieu de
             champ, et le curseur, toujours là, montre où l'on écrit. Avec la
             base des champs (bordure zinc-500, noire au focus, anneau d'1 px,
             angles droits), un rectangle se dessinait en permanence dans la
             fenêtre arrondie, puisque le focus ne quitte jamais ce champ.
             `px-0` : le texte s'aligne sur l'écart qui suit la loupe. -->
        <input
          bind:this={inputElement}
          type="text"
          value={query}
          on:input={onInput}
          placeholder={$tr("palette.placeholder")}
          class="w-full border-none bg-transparent px-0 text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 text-base focus:outline-none focus:ring-0"
        />
        {#if query}
          <button
            type="button"
            on:click={() => {
              query = "";
              suggestions = [];
              inputElement.focus();
            }}
            class="text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white px-1.5 py-0.5 rounded-lg transition-colors"
          >
            {$tr("palette.clear")}
          </button>
        {/if}
        <!-- Touches : texte en zinc-600, le zinc-500 n'atteignant que 4,4:1
             sur le fond zinc-100 de la touche. -->
        <kbd
          class="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md font-mono"
        >
          {$tr("palette.escKey")}
        </kbd>
      </div>

      <!-- Liste des résultats / actions -->
      <div class="overflow-y-auto p-2 divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-96">
        {#if displayedItems.length > 0}
          <div class="py-1">
            <div class="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-mono">
              {query.trim() ? $tr("palette.sectionResults") : $tr("palette.sectionShortcuts")}
            </div>
            {#each displayedItems as item, idx}
              <!-- Sous-titre en zinc-600 : sur la ligne choisie (zinc-100), le
                   zinc-500 tombait à 4,4:1. -->
              <button
                type="button"
                on:click={item.action}
                on:mouseenter={() => (selectedIndex = idx)}
                class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors {selectedIndex === idx
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'}"
              >
                <div class="flex items-center gap-3 min-w-0 pr-2">
                  <Icone
                    nom={item.icon}
                    class="text-xl {selectedIndex === idx
                      ? 'text-zinc-950 dark:text-white'
                      : 'text-zinc-400 dark:text-zinc-500'}"
                  />
                  <div class="min-w-0">
                    <p class="text-sm font-semibold truncate leading-tight">
                      {item.title}
                    </p>
                    {#if item.subtitle}
                      <p class="text-xs text-zinc-600 dark:text-zinc-400 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    {/if}
                  </div>
                </div>

                {#if item.badge}
                  <span
                    class="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border font-mono {selectedIndex === idx
                      ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'}"
                  >
                    {item.badge}
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        {:else}
          <div class="p-8 text-center space-y-2">
            <Icone nom="search-x" class="text-4xl text-zinc-400 dark:text-zinc-500" />
            <p class="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
              {avecSaisie($tr("palette.noResults"), query)}
            </p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">
              {$tr("palette.noResultsHint")}
            </p>
          </div>
        {/if}
      </div>

      <!-- Pied de la boîte de commande -->
      <div
        class="px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400"
      >
        <div class="flex items-center gap-3">
          <span class="inline-flex items-center gap-1">
            <kbd class="px-1 py-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded font-mono text-[10px] text-zinc-600 dark:text-zinc-400">↑</kbd>
            <kbd class="px-1 py-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded font-mono text-[10px] text-zinc-600 dark:text-zinc-400">↓</kbd>
            <span>{$tr("palette.navigate")}</span>
          </span>
          <span class="inline-flex items-center gap-1">
            <kbd class="px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded font-mono text-[10px] text-zinc-600 dark:text-zinc-400">↵</kbd>
            <span>{$tr("palette.select")}</span>
          </span>
        </div>
        <span class="text-[11px] font-medium">
          {$tr("palette.footer")}
        </span>
      </div>
    </div>
  </div>
{/if}
