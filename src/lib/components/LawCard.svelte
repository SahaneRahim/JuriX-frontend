<script lang="ts">
  import StatusBadge from './StatusBadge.svelte';
  import { createEventDispatcher } from 'svelte';

  export let law: {
    id: number;
    reference: string;
    title_fr: string;
    title_en?: string;
    type: string;
    category?: string;
    status: 'draft' | 'active' | 'repealed';
    article_count?: number;
  };
  export let compact: boolean = false;

  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch('click', law);
  }

  const typeLabels: Record<string, string> = {
    law: 'Loi',
    organic_law: 'Loi organique',
    decree: 'Décret',
    order: 'Arrêté',
    code: 'Code'
  };
</script>

<div class="law-card" class:compact on:click={handleClick} role="button" tabindex="0">
  <div class="card-header">
    <div class="reference">{law.reference}</div>
    <StatusBadge status={law.status} size="sm" />
  </div>

  <h3 class="title">{law.title_fr}</h3>

  {#if !compact}
    <div class="metadata">
      <div class="meta-item">
        <span class="meta-label">Type:</span>
        <span class="meta-value">{typeLabels[law.type] || law.type}</span>
      </div>

      {#if law.category}
        <div class="meta-item">
          <span class="meta-label">Catégorie:</span>
          <span class="meta-value">{law.category}</span>
        </div>
      {/if}

      {#if law.article_count}
        <div class="meta-item">
          <span class="meta-label">Articles:</span>
          <span class="meta-value">{law.article_count}</span>
        </div>
      {/if}
    </div>
  {/if}

  <div class="card-footer">
    <button type="button" class="view-btn">
      Voir les détails
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </button>
  </div>
</div>

<style>
  .law-card {
    background-color: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .law-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  .law-card.compact {
    padding: 1rem;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .reference {
    font-size: 0.875rem;
    font-weight: 600;
    color: #3b82f6;
  }

  .title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1rem 0;
    line-height: 1.5;
  }

  .law-card.compact .title {
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }

  .metadata {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .meta-item {
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .meta-label {
    color: #6b7280;
    font-weight: 500;
  }

  .meta-value {
    color: #111827;
  }

  .card-footer {
    display: flex;
    justify-content: flex-end;
  }

  .view-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.5rem;
    background-color: #3b82f6;
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-btn:hover {
    background-color: #2563eb;
  }

  .view-btn svg {
    width: 1rem;
    height: 1rem;
  }
</style>
