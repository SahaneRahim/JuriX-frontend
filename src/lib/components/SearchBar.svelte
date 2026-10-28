<script lang="ts">
  import { API_URL } from '$lib/api';
  import { createEventDispatcher, tick } from 'svelte';
  import { tr } from '$lib/stores/language';
  import { goto } from '$app/navigation';
  import Icone from '$lib/components/Icone.svelte';

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

<!-- Aligné à gauche, sans mx-auto : centré dans le conteneur de la page
     (max-w-3xl, lui-même calé à gauche), le champ commençait 48 px plus loin
     que le titre et les onglets à 1 440 px. La page décide de l'alignement. -->
<div class="relative w-full transition-all duration-300 {size === 'large' ? 'max-w-2xl' : 'max-w-xl'}">
  <div class="relative flex items-center">
    <div class="pointer-events-none absolute left-0 flex h-full items-center text-zinc-500 dark:text-zinc-400 {size === 'large' ? 'pl-3.5' : 'pl-4'}">
      <Icone nom="search" class="h-5 w-5" />
    </div>

    <!--
      Combobox complet, et non un simple champ texte.

      La navigation au clavier fonctionnait deja (fleches, Entree, Echap dans
      handleKeydown), mais rien ne l'ANNONCAIT : aucun aria-expanded, aucun
      role="listbox", aucun aria-activedescendant. Un lecteur d'ecran ne savait
      ni qu'une liste s'etait ouverte, ni quelle entree etait selectionnee — la
      fonction existait sans etre perceptible.

      Marge droite = place réelle des boutons posés par-dessus le champ, à
      chaque palier : sous sm, 6 + effacer (44) + 4 + rechercher (44) = 98 px ;
      de sm à md, 8 + 44 + 8 + 44 = 104 px ; à partir de md, le bouton porte
      son libellé et l'ensemble mesure environ 180 px. Avec un pr-28 unique, la
      fin d'une longue requête passait sous ces boutons.

      Recette des champs (rounded-xl, ombre légère) et non plus celle de la
      barre du hero (rounded-2xl, shadow-xl, 70 px de haut à partir de sm) :
      sur la page des résultats, le champ pesait plus que tout autre champ du
      site. 54 px de haut à toute taille : les deux boutons de 44 px y
      tiennent avec 5 px d'air au-dessus et au-dessous.
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
      class="w-full rounded-xl border border-zinc-200 bg-white text-zinc-950 shadow-sm placeholder-zinc-400 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:shadow-none dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 transition-all outline-none {size === 'large'
        ? 'py-3.5 pl-11 pr-[6.5rem] text-base sm:pr-28 md:pr-48'
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
        <!-- Pas de rouge au survol : effacer la saisie ne détruit rien, et le
             rouge est réservé aux erreurs et aux suppressions. 44 px à toute
             taille : réduit à 36 px dès sm, il l'était aussi sur un téléphone
             en paysage et sur une tablette, des écrans tactiles. -->
        <button
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center rounded-xl text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
          on:click={clearSearch}
          aria-label={$tr("search.clearSearch")}
        >
          <Icone nom="x" class="h-5 w-5" />
        </button>
      {/if}

      <!--
        aria-label permanent : le libelle visible vit dans un
        <span class="hidden md:inline">, donc absent sous md, et il disparait
        entierement pendant le chargement au profit d'un rond animé. Le bouton
        principal de la recherche n'avait alors AUCUN nom.
        Libellé en text-sm, comme les autres boutons principaux du site
        (guide, § 4.4) : en 16 px et md:px-8, il gardait la taille du hero.
      -->
      <button
        type="button"
        aria-label={$tr('search.button')}
        class="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-zinc-950 px-3 sm:px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-black motion-safe:hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 dark:bg-white dark:text-zinc-950 dark:shadow-none dark:hover:bg-zinc-200 {size === 'large' ? 'md:px-5' : 'md:px-6'}"
        on:click={handleSubmit}
        disabled={loading || !value.trim()}
      >
        {#if loading}
          <Icone nom="loader-circle" class="h-5 w-5 motion-safe:animate-spin" />
        {:else}
          <span class="hidden md:inline">{$tr('search.button')}</span>
          <Icone nom="search" class="h-5 w-5 md:hidden" />
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
      class="absolute z-50 mt-2 w-full max-h-80 supports-[height:100dvh]:max-h-[min(20rem,45dvh)] overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border border-zinc-200 bg-white shadow-lg shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none"
      on:mousedown={garderLeFocus}
    >
      {#each suggestions as suggestion, index (suggestion.id)}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div
          id="suggestion-{index}"
          role="option"
          aria-selected={index === selectedIndex}
          class="min-h-11 px-4 py-3 cursor-pointer transition-colors border-b border-zinc-200 dark:border-zinc-800 last:border-b-0 {index === selectedIndex ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
          on:click={() => selectSuggestion(suggestion)}
          on:mouseenter={() => selectedIndex = index}
        >
          <!-- Etait rendu avec {@html} : GET /search/suggest renvoie `row.title`
               brut, sans le moindre balisage. Le rendu HTML n'apportait donc
               rien et exposait le titre de chaque loi comme vecteur.
               Deux lignes au plus : la liste doit montrer plusieurs choix.
               La cote en zinc-600 et non 500 : sur le fond zinc-100 de
               l'entrée choisie, zinc-500 tombe à 4,4:1, sous le seuil AA. -->
          <div class="line-clamp-2 font-medium text-zinc-800 dark:text-zinc-200">{suggestion.title}</div>
          <div class="coupe-mots text-sm text-zinc-600 dark:text-zinc-400">{suggestion.reference}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>
