<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let articles: Array<{
    id: number;
    article_number: string;
    article_title?: string;
  }>;
  export let activeArticle: number | null = null;

  const dispatch = createEventDispatcher();

  function scrollToArticle(articleId: number) {
    dispatch('navigate', articleId);
  }
</script>

<nav class="table-of-contents" aria-label="Table des matières">
  <h2 class="toc-title">Table des matières</h2>
  
  <ul class="toc-list">
    {#each articles as article}
      <li class="toc-item">
        <button
          type="button"
          class="toc-link"
          class:active={activeArticle === article.id}
          on:click={() => scrollToArticle(article.id)}
        >
          <span class="article-num">Art. {article.article_number}</span>
          {#if article.article_title}
            <span class="article-title">{article.article_title}</span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .table-of-contents {
    background-color: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1.5rem;
    max-height: 600px;
    overflow-y: auto;
  }

  .toc-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 1rem 0;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid #e5e7eb;
  }

  .toc-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .toc-item {
    margin-bottom: 0.25rem;
  }

  .toc-link {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    padding: 0.75rem;
    border: none;
    border-left: 3px solid transparent;
    border-radius: 0.375rem;
    background-color: transparent;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toc-link:hover {
    background-color: #f9fafb;
    border-left-color: #d1d5db;
  }

  .toc-link.active {
    background-color: #eff6ff;
    border-left-color: #3b82f6;
  }

  .article-num {
    font-size: 0.875rem;
    font-weight: 600;
    color: #3b82f6;
    margin-bottom: 0.25rem;
  }

  .article-title {
    font-size: 0.875rem;
    color: #6b7280;
    line-height: 1.4;
  }

  .toc-link.active .article-title {
    color: #374151;
  }

  /* Scrollbar styling */
  .table-of-contents::-webkit-scrollbar {
    width: 0.5rem;
  }

  .table-of-contents::-webkit-scrollbar-track {
    background-color: #f3f4f6;
    border-radius: 0.25rem;
  }

  .table-of-contents::-webkit-scrollbar-thumb {
    background-color: #d1d5db;
    border-radius: 0.25rem;
  }

  .table-of-contents::-webkit-scrollbar-thumb:hover {
    background-color: #9ca3af;
  }
</style>
