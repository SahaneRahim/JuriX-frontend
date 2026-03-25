<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let source: {
    law_id: number;
    law_reference: string;
    article_id: number;
    article_number: string;
    excerpt: string;
    relevance?: number;
  };

  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch('click', source);
  }

  $: relevancePercent = source.relevance ? Math.round(source.relevance * 100) : null;
</script>

<div class="source-card" on:click={handleClick} role="button" tabindex="0">
  <div class="source-header">
    <div class="source-ref">
      <span class="law-ref">{source.law_reference}</span>
      <span class="separator">•</span>
      <span class="article-ref">Article {source.article_number}</span>
    </div>
    {#if relevancePercent}
      <div class="relevance-badge" title="Score de pertinence">
        {relevancePercent}%
      </div>
    {/if}
  </div>

  <p class="excerpt">{source.excerpt}</p>

  <div class="source-footer">
    <button type="button" class="view-full-btn">
      Voir l'article complet
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    </button>
  </div>
</div>

<style>
  .source-card {
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .source-card:hover {
    background-color: #f3f4f6;
    border-color: #d1d5db;
  }

  .source-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .source-ref {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .law-ref {
    color: #3b82f6;
  }

  .separator {
    color: #d1d5db;
  }

  .article-ref {
    color: #6b7280;
  }

  .relevance-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background-color: #dbeafe;
    color: #1e40af;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .excerpt {
    color: #374151;
    font-size: 0.875rem;
    line-height: 1.6;
    margin: 0 0 0.75rem 0;
  }

  .source-footer {
    display: flex;
    justify-content: flex-end;
  }

  .view-full-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: 0.375rem;
    background-color: transparent;
    color: #3b82f6;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-full-btn:hover {
    background-color: #eff6ff;
  }

  .view-full-btn svg {
    width: 0.875rem;
    height: 0.875rem;
  }
</style>
