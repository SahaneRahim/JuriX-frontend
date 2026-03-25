<script lang="ts">
  import { personaStore, getPersonaName, type Persona } from '$lib/stores/persona';
  import { createEventDispatcher } from 'svelte';

  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher();

  const personas: Array<{ value: Persona; icon: string; description: string }> = [
    {
      value: 'lawyer',
      icon: '👨‍⚖️',
      description: 'Professionnel du droit recherchant des références juridiques précises'
    },
    {
      value: 'entrepreneur',
      icon: '💼',
      description: 'Chef d\'entreprise cherchant des informations pratiques et actionnables'
    },
    {
      value: 'citizen',
      icon: '🙋',
      description: 'Citoyen recherchant des explications simples sur ses droits'
    },
    {
      value: 'student',
      icon: '📚',
      description: 'Étudiant en droit cherchant du contenu pédagogique approfondi'
    }
  ];

  function selectPersona(persona: Persona) {
    personaStore.setPersona(persona);
    dispatch('select', persona);
    close();
  }

  function close() {
    isOpen = false;
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" on:click={handleBackdropClick} role="presentation">
    <div class="modal-content" role="dialog" aria-labelledby="modal-title" aria-modal="true">
      <div class="modal-header">
        <h2 id="modal-title" class="modal-title">Sélectionnez votre profil</h2>
        <button
          type="button"
          class="close-btn"
          on:click={close}
          aria-label="Fermer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <p class="modal-description">
          Choisissez votre profil pour adapter les réponses à vos besoins
        </p>

        <div class="personas-grid">
          {#each personas as persona}
            <button
              type="button"
              class="persona-card"
              class:selected={$personaStore === persona.value}
              on:click={() => selectPersona(persona.value)}
            >
              <div class="persona-icon">{persona.icon}</div>
              <div class="persona-info">
                <h3 class="persona-name">{getPersonaName(persona.value, 'fr')}</h3>
                <p class="persona-description">{persona.description}</p>
              </div>
              {#if $personaStore === persona.value}
                <div class="selected-indicator">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
                  </svg>
                </div>
              {/if}
            </button>
          {/each}
        </div>

        <button
          type="button"
          class="skip-btn"
          on:click={() => selectPersona(null)}
        >
          Continuer sans sélectionner
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    padding: 1rem;
  }

  .modal-content {
    background-color: white;
    border-radius: 1rem;
    max-width: 48rem;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .close-btn {
    width: 2.5rem;
    height: 2.5rem;
    border: none;
    background-color: transparent;
    border-radius: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background-color: #f3f4f6;
    color: #111827;
  }

  .close-btn svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-description {
    color: #6b7280;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .personas-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .persona-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.75rem;
    background-color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
  }

  .persona-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  .persona-card.selected {
    border-color: #3b82f6;
    background-color: #eff6ff;
  }

  .persona-icon {
    font-size: 3rem;
  }

  .persona-info {
    flex: 1;
  }

  .persona-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.5rem 0;
  }

  .persona-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
    line-height: 1.5;
  }

  .selected-indicator {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    width: 1.5rem;
    height: 1.5rem;
    color: #3b82f6;
  }

  .skip-btn {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background-color: white;
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .skip-btn:hover {
    background-color: #f9fafb;
    border-color: #d1d5db;
  }
</style>
