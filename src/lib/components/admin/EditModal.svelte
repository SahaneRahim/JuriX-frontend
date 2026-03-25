<script lang="ts">
  import { API_URL } from '$lib/api';
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let document: any = null;
  
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
      const response = await fetch(`${API_URL}/api/v1/categories?limit=20`);
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
  
  function initFields(doc: any) {
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
      const updatePayload: any = {
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
      
      const response = await fetch(`${API_URL}/api/v1/admin/laws/${document.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
      
      if (response.ok) {
        dispatch('refresh');
        close();
      } else {
        const error = await response.json();
        alert(`Erreur: ${error.detail || 'Erreur inconnue'}`);
      }
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Erreur réseau lors de la sauvegarde');
    } finally {
      isSaving = false;
    }
  }
  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      close();
    }
  }
</script>

{#if show}
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" 
    on:click={close}
    on:keydown={handleBackdropKeydown}
    role="button"
    tabindex="0"
    aria-label="Fermer la modale"
  >
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div 
      class="w-full max-w-4xl rounded-2xl bg-white shadow-2xl" 
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="document"
      tabindex="-1"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <h2 class="text-2xl font-bold text-slate-900">Éditer le Document</h2>
        <button on:click={close} class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fermer">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <!-- Body -->
      <div class="max-h-[70vh] overflow-y-auto p-6">
        <div class="space-y-4">
          <!-- Title -->
          <div>
            <label for="edit-title" class="mb-2 block text-sm font-semibold text-slate-700">Titre</label>
            <input
              id="edit-title"
              type="text"
              bind:value={title}
              class="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Titre du document"
            />
          </div>
          
          <!-- Reference and Category -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="edit-reference" class="mb-2 block text-sm font-semibold text-slate-700">Référence</label>
              <input
                id="edit-reference"
                type="text"
                bind:value={reference}
                class="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="LOI-2024-001"
              />
            </div>
            
            <div>
              <label for="edit-category" class="mb-2 block text-sm font-semibold text-slate-700">Catégorie</label>
              <select
                id="edit-category"
                bind:value={selectedCategoryId}
                class="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">-- Aucune catégorie --</option>
                {#each categories as cat}
                  <option value={String(cat.id)}>{cat.icon} {cat.name}</option>
                {/each}
              </select>
              {#if loadingCategories}
                <p class="mt-1 text-xs text-slate-500">Chargement...</p>
              {/if}
            </div>
          </div>
          
          <!-- Language -->
          <div>
            <label for="edit-language" class="mb-2 block text-sm font-semibold text-slate-700">Langue</label>
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
            <label for="edit-content" class="mb-2 block text-sm font-semibold text-slate-700">Contenu</label>
            <textarea
              id="edit-content"
              bind:value={content}
              rows="12"
              class="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Contenu du document..."
            />
            <p class="mt-1 text-xs text-slate-500">{content.length} caractères</p>
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
        <button
          on:click={close}
          class="rounded-lg px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-100"
        >
          Annuler
        </button>
        <button
          on:click={save}
          disabled={isSaving}
          class="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 disabled:opacity-50"
        >
          {#if isSaving}
            <svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            Enregistrement...
          {:else}
            Enregistrer
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
