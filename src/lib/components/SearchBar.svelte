<script lang="ts">
  import { API_URL } from '$lib/api';
  import { createEventDispatcher, tick } from 'svelte';
  import { tr } from '$lib/stores/language';
  import { goto } from '$app/navigation';

  export let placeholder: string = '';
  export let value: string = '';
  export let loading: boolean = false;
  export let size: 'normal' | 'large' = 'normal';

  const dispatch = createEventDispatcher();
let suggestions: Array<{id: number, title: string, reference: string}> = [];
  let showSuggestions = false;
  let selectedIndex = -1;
  let debounceTimer: ReturnType<typeof setTimeout>;
  let liste: HTMLDivElement | undefined;

  function handleSubmit() {
    if (value.trim()) {
      showSuggestions = false;
      dispatch('search', { query: value });
    }
  }

  async function fetchSuggestions(query: string) {
    if (query.length < 2) {
      suggestions = [];
      showSuggestions = false;
      return;
    }

    try {
      const response = await fetch(`${API_URL}/search/suggest?q=${encodeURIComponent(query)}&limit=5`);
      if (response.ok) {
        const data = await response.json();
        suggestions = data.suggestions || [];
        showSuggestions = suggestions.length > 0;
      }
    } catch (e) {
      console.error('Suggestions error:', e);
      suggestions = [];
    }
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    selectedIndex = -1;

    // Debounce suggestions fetch (300ms)
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        selectSuggestion(suggestions[selectedIndex]);
      } else {
        handleSubmit();
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
      montrerLaSelection();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      montrerLaSelection();
    } else if (event.key === 'Escape') {
      showSuggestions = false;
    }
  }

  /**
   * Garde la suggestion choisie au clavier dans la partie visible de la liste.
   *
   * La liste a désormais une hauteur maximale et défile : sans cela, les
   * flèches pouvaient sélectionner une entrée cachée sous le bas de la liste.
   * Pas au survol de la souris : la liste défilerait sous le pointeur.
   * `?.()` : jsdom, qui fait tourner les tests, n'implémente pas scrollIntoView.
   */
  async function montrerLaSelection() {
    await tick();
    liste
      ?.querySelector(`#suggestion-${selectedIndex}`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }

  /**
   * Un appui dans la liste ne retire pas le focus au champ.
   *
   * La liste défile désormais : saisir sa barre de défilement à la souris
   * faisait perdre le focus au champ, et `handleBlur` la refermait 200 ms plus
   * tard, en plein geste. Le clic sur une suggestion arrive comme avant, et sur
   * un écran tactile un geste de défilement n'émet aucun `mousedown`.
   */
  function garderLeFocus(event: MouseEvent) {
    event.preventDefault();
  }

  function selectSuggestion(suggestion: {id: number, title: string, reference: string}) {
    showSuggestions = false;
    goto(`/laws/${suggestion.id}`);
  }

  function clearSearch() {
    value = '';
    suggestions = [];
    showSuggestions = false;
    dispatch('clear');
  }

  function handleBlur() {
    // Delay to allow click on suggestions
    setTimeout(() => {
      showSuggestions = false;
    }, 200);
  }
</script>

<div class="relative w-full mx-auto transition-all duration-300 {size === 'large' ? 'max-w-2xl' : 'max-w-xl'}">
  <div class="relative flex items-center">
    <div class="pointer-events-none absolute left-0 flex h-full items-center text-slate-500 {size === 'large' ? 'pl-3.5 sm:pl-4' : 'pl-4'}">
      <svg
        class="{size === 'large' ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-5 w-5'}"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
    </div>

    <!--
      Combobox complet, et non un simple champ texte.

      La navigation au clavier fonctionnait deja (fleches, Entree, Echap dans
      handleKeydown), mais rien ne l'ANNONCAIT : aucun aria-expanded, aucun
      role="listbox", aucun aria-activedescendant. Un lecteur d'ecran ne savait
      ni qu'une liste s'etait ouverte, ni quelle entree etait selectionnee — la
      fonction existait sans etre perceptible.

      Marge droite = place réelle des boutons posés par-dessus le champ, à
      chaque palier : sous sm, effacer (44 px) + rechercher (44 px) ; à partir
      de md, le bouton porte son libellé et mesure environ 150 px. Avec un pr-28
      unique, la fin d'une longue requête passait sous ces boutons. En grande
      taille sur téléphone (py-5 et text-lg), il ne restait que 120 à 160 px
      pour taper, et le texte indicatif était coupé.
    -->
    <input
      type="text"
      role="combobox"
      aria-label={$tr("a11y.searchField")}
      aria-expanded={showSuggestions && suggestions.length > 0}
      aria-controls="suggestions-liste"
      aria-autocomplete="list"
      aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
      enterkeyhint="search"
      class="w-full rounded-2xl border-none bg-white/90 text-slate-800 shadow-xl ring-1 ring-slate-900/5 placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:shadow-2xl transition-all outline-none {size === 'large'
        ? 'py-3.5 pl-11 pr-24 text-base sm:py-5 sm:pl-14 sm:pr-28 sm:text-lg md:pr-52'
        : 'py-4 pl-12 pr-28 text-base md:pr-48'}"
      {placeholder}
      {value}
      on:input={handleInput}
      on:keydown={handleKeydown}
      on:blur={handleBlur}
      on:focus={() => { if (suggestions.length > 0) showSuggestions = true; }}
      disabled={loading}
      autocomplete="off"
    />

    <div class="absolute right-1.5 flex items-center gap-1 sm:right-2 sm:gap-2">
      {#if value}
        <button
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-red-500 transition-colors sm:h-9 sm:w-9"
          on:click={clearSearch}
          aria-label={$tr("search.clearSearch")}
        >
          <svg
            class="h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      {/if}

      <!--
        aria-label permanent : le libelle visible vit dans un
        <span class="hidden md:inline">, donc absent sous md, et il disparait
        entierement pendant le chargement au profit d'un rond animé. Le bouton
        principal de la recherche n'avait alors AUCUN nom.
      -->
      <button
        type="button"
        aria-label={$tr('search.button')}
        class="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 sm:px-4 py-2.5 font-semibold text-white shadow-lg transition-all motion-safe:hover:scale-105 hover:shadow-blue-500/30 disabled:opacity-70 disabled:hover:scale-100 {size === 'large' ? 'md:px-8 md:py-3' : 'md:px-6'}"
        on:click={handleSubmit}
        disabled={loading || !value.trim()}
      >
        {#if loading}
          <div class="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
        {:else}
          <span class="hidden md:inline">{$tr('search.button')}</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-5 w-5 md:hidden">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        {/if}
      </button>
    </div>
  </div>

  <!-- Autocomplete Suggestions Dropdown -->
  {#if showSuggestions && suggestions.length > 0}
    <!--
      Hauteur bornée, et défilement interne : avec le clavier ouvert, cinq
      titres de loi sur plusieurs lignes descendaient sous le bas de l'écran
      visible, hors d'atteinte. max-h-80 est le repli des navigateurs sans
      unité dvh ; la variante supports- passe après lui quoi qu'il arrive,
      alors que deux max-h-[…] simples sortent du CSS dans l'ordre
      alphabétique, et le repli en vh l'emporterait.

      Le focus reste dans le champ (aria-activedescendant) : ni la liste ni ses
      options ne sont focalisables, volontairement, d'où l'exception, qui vaut
      pour tout ce bloc. `garderLeFocus` n'y sert qu'à ne pas perdre le focus.
    -->
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
      bind:this={liste}
      id="suggestions-liste"
      role="listbox"
      aria-label={$tr("a11y.searchField")}
      class="absolute z-50 mt-2 w-full max-h-80 supports-[height:100dvh]:max-h-[min(20rem,45dvh)] overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl bg-white shadow-2xl ring-1 ring-slate-200"
      on:mousedown={garderLeFocus}
    >
      {#each suggestions as suggestion, index (suggestion.id)}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div
          id="suggestion-{index}"
          role="option"
          aria-selected={index === selectedIndex}
          class="min-h-11 px-4 py-3 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0 {index === selectedIndex ? 'bg-blue-50' : 'hover:bg-slate-50'}"
          on:click={() => selectSuggestion(suggestion)}
          on:mouseenter={() => selectedIndex = index}
        >
          <!-- Etait rendu avec {@html} : GET /search/suggest renvoie `row.title`
               brut, sans le moindre balisage. Le rendu HTML n'apportait donc
               rien et exposait le titre de chaque loi comme vecteur.
               Deux lignes au plus : la liste doit montrer plusieurs choix. -->
          <div class="line-clamp-2 font-medium text-slate-800">{suggestion.title}</div>
          <div class="coupe-mots text-sm text-slate-500">{suggestion.reference}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>
