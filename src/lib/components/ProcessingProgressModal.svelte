<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen: boolean = false;
  export let progress: number = 0;
  export let status: string = 'En cours...';
  export let error: string | null = null;

  const dispatch = createEventDispatcher();

  /**
   * Annuler doit AUSSI fermer.
   *
   * Le bouton n'émettait que `cancel` : la modale restait affichée après le
   * clic. Combiné à l'absence de croix, de fond cliquable et de touche Échap,
   * l'utilisateur n'avait plus AUCUNE sortie pendant tout le traitement.
   */
  function handleCancel() {
    dispatch('cancel');
    handleClose();
  }

  function onBackdropClick(event: MouseEvent) {
    // Un clic dans la boîte ne doit pas la fermer.
    if (event.target === event.currentTarget) handleClose();
  }

  function onKeydown(event: KeyboardEvent) {
    if (isOpen && event.key === 'Escape') handleClose();
  }

  function handleClose() {
    isOpen = false;
    dispatch('close');
  }

  $: progressPercent = Math.min(Math.max(progress, 0), 100);
  $: isComplete = progressPercent >= 100 && !error;
  $: hasFailed = !!error;
</script>

<svelte:window on:keydown={onKeydown} />

{#if isOpen}
  <div
    class="modal-backdrop"
    role="presentation"
    data-testid="processing-modal"
    on:click={onBackdropClick}
  >
    <div class="modal-content" role="dialog" aria-labelledby="modal-title" aria-modal="true">
      <div class="modal-header">
        <h2 id="modal-title" class="modal-title">
          {#if hasFailed}
            ❌ Échec du traitement
          {:else if isComplete}
            ✅ Traitement terminé
          {:else}
            ⏳ Traitement en cours
          {/if}
        </h2>
        <button
          type="button"
          class="modal-close"
          data-testid="processing-modal-close"
          aria-label="Fermer"
          on:click={handleClose}>&times;</button
        >
      </div>

      <div class="modal-body">
        {#if !hasFailed}
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {progressPercent}%"></div>
            </div>
            <div class="progress-text">{progressPercent}%</div>
          </div>
        {/if}

        <div class="status-message" class:error={hasFailed}>
          {#if hasFailed}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="status-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p>{error}</p>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="status-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <p>{status}</p>
          {/if}
        </div>

        {#if isComplete}
          <div class="success-message">
            <p>Le document a été traité avec succès et est maintenant disponible.</p>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        {#if hasFailed || isComplete}
          <button type="button" class="btn btn-primary" on:click={handleClose}>
            Fermer
          </button>
        {:else}
          <button type="button" class="btn btn-secondary" on:click={handleCancel}>
            Annuler
          </button>
        {/if}
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
    max-width: 32rem;
    width: 100%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.75rem;
    line-height: 1;
    cursor: pointer;
    color: #64748b;
    padding: 0 0.25rem;
  }

  .modal-close:hover {
    color: #0f172a;
  }

  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    /* La croix vient d'être ajoutée : sans flex elle passerait sous le titre. */
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .progress-container {
    margin-bottom: 1.5rem;
  }

  .progress-bar {
    width: 100%;
    height: 1.5rem;
    background-color: #e5e7eb;
    border-radius: 9999px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #2563eb);
    transition: width 0.3s ease;
    border-radius: 9999px;
  }

  .progress-text {
    text-align: center;
    margin-top: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b7280;
  }

  .status-message {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background-color: #eff6ff;
    border-radius: 0.5rem;
  }

  .status-message.error {
    background-color: #fef2f2;
  }

  .status-icon {
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
    color: #3b82f6;
  }

  .status-message.error .status-icon {
    color: #dc2626;
  }

  .status-message p {
    margin: 0;
    color: #1e40af;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .status-message.error p {
    color: #991b1b;
  }

  .success-message {
    margin-top: 1rem;
    padding: 1rem;
    background-color: #d1fae5;
    border-radius: 0.5rem;
  }

  .success-message p {
    margin: 0;
    color: #065f46;
    font-size: 0.875rem;
  }

  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .btn {
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background-color: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background-color: #2563eb;
  }

  .btn-secondary {
    background-color: #f3f4f6;
    color: #374151;
  }

  .btn-secondary:hover {
    background-color: #e5e7eb;
  }
</style>
