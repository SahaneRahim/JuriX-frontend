<script lang="ts">
  import { piegerFocus } from '$lib/actions/pieger-focus';
  import { apiFetch } from '$lib/api';
  import { createEventDispatcher } from 'svelte';
  import { tr, language as langueInterface } from '$lib/stores/language';
  import { nomCategorie } from '$lib/categories';
  import type { Law, LawUpdatePayload } from '$lib/types';
  
  export let show = false;
  export let document: Law | null = null;
  
  const dispatch = createEventDispatcher();
let title = '';
  let content = '';
  let reference = '';
  let language = 'fr';
  let selectedCategoryId = '';  // Use string for select binding
  let isSaving = false;
  
  // Categories from API
  let categories: Array<{id: number, name: string, icon: string}> = [];
  let loadingCategories = false;
  
  // Reload categories each time modal opens
  $: if (show) {
    fetchCategories();
  }
  
  async function fetchCategories() {
    loadingCategories = true;
    try {
      const response = await apiFetch(`/categories?limit=20`);
      if (response.ok) {
        categories = await response.json();
        console.log('Loaded categories:', categories.length);
      }
    } catch (e) {
      console.error('Error fetching categories:', e);
    } finally {
      loadingCategories = false;
    }
  }
  
  // Track initialization to avoid resetting user edits
  let initializedDocId: number | null = null;

  // Initialize fields when modal opens or document ID changes
  $: if (show && document && document.id !== initializedDocId) {
    initFields(document);
  }

  // Reset tracker when modal closes
  $: if (!show) {
    initializedDocId = null;
  }
  
  // `Law` et non `Law | null` : l'appelant garde deja sur `document?.id`. Le
  // signer nullable obligeait a re-tester a l'interieur, ou — ce qui s'est
  // passe — a ne pas tester du tout et a lire `doc.id` sur un possible null.
  function initFields(doc: Law) {
    console.log('Initializing fields for doc:', doc.id);
    initializedDocId = doc.id;
    title = doc.title || '';
    content = doc.content || '';
    reference = doc.reference || '';
    language = doc.language || 'fr';
    // Convert to string, ensuring we handle 0 correctly
    selectedCategoryId = (doc.category_id !== null && doc.category_id !== undefined) ? String(doc.category_id) : '';
    console.log('Initialized selectedCategoryId:', selectedCategoryId);
  }
  
  function close() {
    show = false;
    dispatch('close');
  }
  
  async function save() {
    if (!document?.id) return;
    
    isSaving = true;
    try {
      const updatePayload: LawUpdatePayload = {
        title,
        content,
        reference,
        language
      };
      
      // Convert string to number for API and include if selected
      if (selectedCategoryId) {
        updatePayload.category_id = parseInt(selectedCategoryId, 10);
      }
      
      console.log('Saving with payload:', updatePayload);
      
      const response = await apiFetch(`/laws/admin/${document.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
      
      if (response.ok) {
        dispatch('refresh');
        close();
      } else {
        const error = await response.json();
        alert($tr('admin.doc.saveError').replace('{detail}', error.detail || $tr('admin.doc.unknownError')));
      }
    } catch (error) {
      console.error('Error saving document:', error);
      alert($tr('common.errorNetwork'));
    } finally {
      isSaving = false;
    }
  }

  // Le keydown du fond ne réagissait qu'à Entrée et Espace, et n'est atteint
  // que si le fond a le focus. Échap doit fermer depuis n'importe où.
  function onKeydown(e: KeyboardEvent) {
    if (show && e.key === 'Escape') close();
  }

  // Ouverte, la modale fige la page derrière elle, comme le choix du profil
  // (src/routes/+layout.svelte) : sur téléphone, un glisser sur le fond ou sur
  // l'en-tête du panneau faisait défiler la liste des documents dessous.
  // `window.document` : la prop `document` (le texte édité) masque ici le
  // document du navigateur.
  function bloquerDefilement(_noeud: HTMLElement) {
    const corps = window.document.body;
    const avant = corps.style.overflow;
    corps.style.overflow = 'hidden';
    return {
      destroy() {
        corps.style.overflow = avant;
      },
    };
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if show}
  <!--
    Panneau collé en bas sur téléphone, boîte centrée à partir de sm.

    Centrée et sans hauteur bornée, la boîte dépassait les écrans courts
    (paysage, iPhone SE, clavier ouvert) : la croix et « Enregistrer » sortaient
    de l'écran, hors d'atteinte. Désormais seul le corps défile, en-tête et pied
    restent visibles. La hauteur maximale se rapporte au voile, fixe en inset-0,
    qui suit déjà l'écran réellement visible (barre d'adresse, clavier Android)
    sans dépendre de l'unité dvh, absente des navigateurs Android anciens.
  -->
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
    on:click={close}
    role="presentation"
    data-testid="edit-modal"
    use:bloquerDefilement
  >
    <div
      use:piegerFocus
      class="flex max-h-[calc(100%-1rem)] w-full max-w-4xl flex-col rounded-t-2xl bg-white shadow-2xl sm:max-h-[90%] sm:rounded-2xl"
      on:click|stopPropagation
      role="dialog"
      aria-modal="true"
      aria-label={$tr("admin.doc.editTitle")}
    >
      <!-- Header -->
      <div class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 sm:px-6 sm:py-4">
        <h2 class="min-w-0 text-xl font-bold text-slate-900 sm:text-2xl">{$tr("admin.doc.editTitle")}</h2>
        <button on:click={close} class="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-600" aria-label={$tr("common.close")}>
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Body : overscroll-contain, pour qu'arrivé au bout le défilement ne
           passe pas à la page derrière. -->
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
        <div class="space-y-4">
          <!-- Title -->
          <div>
            <label for="edit-title" class="mb-2 block text-sm font-semibold text-slate-700">{$tr("admin.doc.title")}</label>
            <input
              id="edit-title"
              type="text"
              bind:value={title}
              class="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder={$tr("admin.doc.titlePlaceholder")}
            />
          </div>
          
          <!-- Reference and Category : une colonne sur téléphone, où deux
               colonnes ne laissaient qu'environ 115 px à chaque champ. -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label for="edit-reference" class="mb-2 block text-sm font-semibold text-slate-700">{$tr("admin.reference")}</label>
              <input
                id="edit-reference"
                type="text"
                bind:value={reference}
                class="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="LOI-2024-001"
              />
            </div>
            
            <div>
              <label for="edit-category" class="mb-2 block text-sm font-semibold text-slate-700">{$tr("admin.doc.category")}</label>
              <select
                id="edit-category"
                bind:value={selectedCategoryId}
                class="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">{$tr("admin.doc.noCategory")}</option>
                {#each categories as cat (cat.id)}
                  <option value={String(cat.id)}>{cat.icon} {nomCategorie(cat.name, $langueInterface.current)}</option>
                {/each}
              </select>
              {#if loadingCategories}
                <p class="mt-1 text-xs text-slate-500">{$tr("admin.loading")}</p>
              {/if}
            </div>
          </div>
          
          <!-- Language -->
          <div>
            <label for="edit-language" class="mb-2 block text-sm font-semibold text-slate-700">{$tr("admin.language")}</label>
            <select
              id="edit-language"
              bind:value={language}
              class="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
          
          <!-- Content -->
          <div>
            <label for="edit-content" class="mb-2 block text-sm font-semibold text-slate-700">{$tr("admin.doc.content")}</label>
            <!-- 16 px sur téléphone (text-base) : en 14 px, iOS zoomait au
                 focus. Sur écran court (paysage), la zone de texte est
                 plafonnée pour tenir dans le corps défilant au lieu d'y
                 ajouter un second défilement à rallonge. -->
            <textarea
              id="edit-content"
              bind:value={content}
              rows="12"
              class="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-mono text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:text-sm court:max-h-40"
              placeholder={$tr("admin.doc.contentPlaceholder")}
            ></textarea>
            <p class="mt-1 text-xs text-slate-500">{content.length} {$tr("admin.doc.chars")}</p>
          </div>
        </div>
      </div>

      <!-- Footer : la zone sûre garde les boutons au-dessus de la barre
           d'accueil de l'iPhone ; sur téléphone, deux boutons de 44 px à
           parts égales. -->
      <div class="shrink-0 border-t border-slate-200 pb-zone-sure">
        <div class="flex items-center justify-end gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <button
            on:click={close}
            class="inline-flex h-11 flex-1 items-center justify-center rounded-lg px-5 font-semibold text-slate-700 hover:bg-slate-100 sm:flex-none"
          >
            {$tr("common.cancel")}
          </button>
          <button
            on:click={save}
            disabled={isSaving}
            class="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 disabled:opacity-50 sm:flex-none"
          >
            {#if isSaving}
              <svg class="h-5 w-5 motion-safe:animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              {$tr("common.saving")}
            {:else}
              {$tr("common.save")}
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
