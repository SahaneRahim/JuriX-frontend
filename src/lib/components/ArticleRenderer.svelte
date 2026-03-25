<script lang="ts">
  export let article: {
    article_number: string;
    article_title?: string;
    content_fr: string;
  };
  export let highlight: string = '';

  let showCopyFeedback = false;

  function highlightText(text: string, searchTerm: string): string {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(article.content_fr);
      showCopyFeedback = true;
      setTimeout(() => {
        showCopyFeedback = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  $: highlightedContent = highlightText(article.content_fr, highlight);
</script>

<article class="article-renderer">
  <div class="article-header">
    <div class="article-number">Article {article.article_number}</div>
    <button
      type="button"
      class="copy-btn"
      on:click={copyToClipboard}
      title="Copier l'article"
    >
      {#if showCopyFeedback}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
        </svg>
        <span>Copié!</span>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
        </svg>
        <span>Copier</span>
      {/if}
    </button>
  </div>

  {#if article.article_title}
    <h3 class="article-title">{article.article_title}</h3>
  {/if}

  <div class="article-content">
    {@html highlightedContent}
  </div>
</article>

<style>
  .article-renderer {
    background-color: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1.5rem;
  }

  .article-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #e5e7eb;
  }

  .article-number {
    font-size: 1rem;
    font-weight: 700;
    color: #3b82f6;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background-color: white;
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .copy-btn:hover {
    background-color: #f9fafb;
    border-color: #d1d5db;
  }

  .copy-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .article-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1rem 0;
    line-height: 1.5;
  }

  .article-content {
    color: #374151;
    font-size: 1rem;
    line-height: 1.8;
  }

  .article-content :global(mark) {
    background-color: #fef3c7;
    color: #92400e;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
  }

  .article-content :global(p) {
    margin: 0 0 1rem 0;
  }

  .article-content :global(p:last-child) {
    margin-bottom: 0;
  }
</style>
