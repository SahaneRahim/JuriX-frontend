<script lang="ts">
  import { API_URL } from '$lib/api';
  import { createEventDispatcher, onMount } from 'svelte';
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
      const response = await fetch(`${API_URL}/api/v1/search/suggest?q=${encodeURIComponent(query)}&limit=5`);
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
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
    } else if (event.key === 'Escape') {
      showSuggestions = false;
    }
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
    <div class="pointer-events-none absolute left-0 flex h-full items-center pl-4 text-slate-400">
      <svg
        class="{size === 'large' ? 'h-6 w-6' : 'h-5 w-5'}"
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

    <input
      type="text"
      class="w-full rounded-2xl border-none bg-white/90 py-4 pl-12 pr-28 text-slate-800 shadow-xl ring-1 ring-slate-900/5 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:shadow-2xl transition-all outline-none {size === 'large' ? 'text-lg py-5 pl-14' : 'text-base'}"
      {placeholder}
      {value}
      on:input={handleInput}
      on:keydown={handleKeydown}
      on:blur={handleBlur}
      on:focus={() => { if (suggestions.length > 0) showSuggestions = true; }}
      disabled={loading}
      autocomplete="off"
    />

    <div class="absolute right-2 flex items-center gap-2">
      {#if value}
        <button
          type="button"
          class="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-red-500 transition-colors"
          on:click={clearSearch}
          aria-label="Clear search"
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

      <button
        type="button"
        class="flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 md:px-6 py-2.5 font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-blue-500/30 disabled:opacity-70 disabled:hover:scale-100 {size === 'large' ? 'md:px-8 md:py-3' : ''}"
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
    <div class="absolute z-50 mt-2 w-full rounded-xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
      {#each suggestions as suggestion, index}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="px-4 py-3 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0 {index === selectedIndex ? 'bg-blue-50' : 'hover:bg-slate-50'}"
          on:click={() => selectSuggestion(suggestion)}
          on:mouseenter={() => selectedIndex = index}
        >
          <div class="font-medium text-slate-800" >{@html suggestion.title}</div>
          <div class="text-sm text-slate-500">{suggestion.reference}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>
