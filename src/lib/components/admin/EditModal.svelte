<script lang="ts">
  import { piegerFocus } from '$lib/actions/pieger-focus';
  import { apiFetch } from '$lib/api';
  import { createEventDispatcher } from 'svelte';
  import Icone from '$lib/components/Icone.svelte';
  import { tr, language as langueInterface } from '$lib/stores/language';
  import { nomCategorie } from '$lib/categories';
  import type { Law, LawUpdatePayload } from '$lib/types';
  
  export let show = false;
  export let document: Law | null = null;
  
  const dispatch = createEventDispatcher();

  // Une seule recette pour les champs et leurs libellés, celle de tout le site
  // (noir et blanc, mode sombre compris) et de UserFormModal : recopiée champ
  // par champ, elle finissait par diverger. Une seule taille aussi, dans les
  // quatre fenêtres de l'administration et les pages de compte : 44 px de
  // haut au moins, `px-3 py-2`, libellé 4 px au-dessus. Celle-ci avait des
  // champs de 42 px en `px-4` et ses libellés à 8 px, les autres 38 px :
  // côte à côte, les formulaires ne se ressemblaient pas. 16 px de texte sauf
  // à partir de sm sous un pointeur fin (règle de login/+page.svelte) : iOS
  // zoome au focus d'un champ de moins de 16 px, téléphone en paysage
  // compris. Le retrait horizontal reste à chaque champ : une liste garde la
  // place de son chevron à droite.
  const CHAMP =
    'min-h-11 w-full rounded-xl border border-zinc-200 bg-white py-2 text-base text-zinc-950 placeholder-zinc-400 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:border-zinc-500 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-200 dark:focus:ring-zinc-200 sm:[@media(pointer:fine)]:text-sm';
  const LIBELLE = 'mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200';

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

    Deux largeurs pour les quatre fenêtres de l'administration : 768 px
    (max-w-3xl) pour les éditeurs de texte long, celle-ci et « Modifier
    l'article » ; 512 px (max-w-lg) pour les formulaires courts (compte,
    ajout de documents). Elle faisait 896 px, une troisième largeur. Même
    construction partout : en-tête et pied séparés du corps par un trait.
  -->
  <div
    class="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 backdrop-blur-sm sm:items-center sm:p-4"
    on:click={close}
    role="presentation"
    data-testid="edit-modal"
    use:bloquerDefilement
  >
    <div
      use:piegerFocus
      class="flex max-h-[calc(100%-1rem)] w-full max-w-3xl flex-col rounded-t-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none sm:max-h-[90%] sm:rounded-2xl"
      on:click|stopPropagation
      role="dialog"
      aria-modal="true"
      aria-label={$tr("admin.doc.editTitle")}
    >
      <!-- Header -->
      <div class="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800 sm:px-6 sm:py-4">
        <h2 class="min-w-0 text-xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-2xl">{$tr("admin.doc.editTitle")}</h2>
        <button on:click={close} class="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white" aria-label={$tr("common.close")}>
          <Icone nom="x" class="h-6 w-6" />
        </button>
      </div>

      <!-- Body : overscroll-contain, pour qu'arrivé au bout le défilement ne
           passe pas à la page derrière. -->
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
        <div class="space-y-4">
          <!-- Title -->
          <div>
            <label for="edit-title" class={LIBELLE}>{$tr("admin.doc.title")}</label>
            <input
              id="edit-title"
              type="text"
              bind:value={title}
              class="{CHAMP} px-3"
              placeholder={$tr("admin.doc.titlePlaceholder")}
            />
          </div>
          
          <!-- Reference and Category : une colonne sur téléphone, où deux
               colonnes ne laissaient qu'environ 115 px à chaque champ. -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label for="edit-reference" class={LIBELLE}>{$tr("admin.reference")}</label>
              <input
                id="edit-reference"
                type="text"
                bind:value={reference}
                class="{CHAMP} px-3"
                placeholder="LOI-2024-001"
              />
            </div>
            
            <div>
              <label for="edit-category" class={LIBELLE}>{$tr("admin.doc.category")}</label>
              <!-- Les options portent le nom seul : l'icône de la base est un
                   émoji, et une <option> ne peut contenir que du texte, donc
                   pas l'icône Lucide du domaine. -->
              <select
                id="edit-category"
                bind:value={selectedCategoryId}
                class="{CHAMP} pl-3 pr-10"
              >
                <option value="">{$tr("admin.doc.noCategory")}</option>
                {#each categories as cat (cat.id)}
                  <option value={String(cat.id)}>{nomCategorie(cat.name, $langueInterface.current)}</option>
                {/each}
              </select>
              {#if loadingCategories}
                <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{$tr("admin.loading")}</p>
              {/if}
            </div>
          </div>
          
          <!-- Language -->
          <div>
            <label for="edit-language" class={LIBELLE}>{$tr("admin.language")}</label>
            <select
              id="edit-language"
              bind:value={language}
              class="{CHAMP} pl-3 pr-10"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
          
          <!-- Content -->
          <div>
            <label for="edit-content" class={LIBELLE}>{$tr("admin.doc.content")}</label>
            <!-- 16 px sur téléphone (text-base) : en 14 px, iOS zoomait au
                 focus. Sur écran court (paysage), la zone de texte est
                 plafonnée pour tenir dans le corps défilant au lieu d'y
                 ajouter un second défilement à rallonge. Dans la police du
                 texte, et non en chasse fixe : le guide garde celle-ci aux
                 métadonnées (dates, cotes), et le texte entier d'une loi en
                 chasse fixe fatiguait la lecture, sans ressembler au texte
                 publié. -->
            <textarea
              id="edit-content"
              bind:value={content}
              rows="12"
              class="{CHAMP} px-3 court:max-h-40"
              placeholder={$tr("admin.doc.contentPlaceholder")}
            ></textarea>
            <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{content.length} {$tr("admin.doc.chars")}</p>
          </div>
        </div>
      </div>

      <!-- Footer : la zone sûre garde les boutons au-dessus de la barre
           d'accueil de l'iPhone ; sur téléphone, deux boutons de 44 px à
           parts égales.
           Boutons du pied à la base du guide (§ 4.4 : 14 px, semi-gras,
           `px-5`), dans les quatre fenêtres de l'administration : Annuler
           et Enregistrer étaient en 16 px ici et dans la fenêtre des
           comptes, en 14 px dans les deux autres, et « Annuler » changeait
           de graisse d'une fenêtre à l'autre. -->
      <div class="shrink-0 border-t border-zinc-200 pb-zone-sure dark:border-zinc-800">
        <div class="flex items-center justify-end gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <button
            on:click={close}
            class="inline-flex h-11 flex-1 items-center justify-center rounded-xl px-5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white sm:flex-none"
          >
            {$tr("common.cancel")}
          </button>
          <button
            on:click={save}
            disabled={isSaving}
            class="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 sm:flex-none"
          >
            {#if isSaving}
              <Icone nom="loader-circle" class="h-5 w-5 motion-safe:animate-spin" />
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
