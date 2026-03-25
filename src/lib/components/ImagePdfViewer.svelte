<script>
  import { onMount, onDestroy } from "svelte";

  // Expects the base URL to the law (e.g., /api/v1/laws/123)
  export let url;
  export let initialPage = 1; // Optional: start at specific page (for article navigation)

  let pageNum = 1;
  let totalPages = 0;
  let error = null;
  let loading = true;
  let pageLoading = false;
  let currentImageUrl = null;
  let dpi = 120; // Default DPI (120 = good balance of quality/speed)

  // Extract law ID from URL
  function getLawId(lawUrl) {
    const match = lawUrl.match(/\/laws\/(\d+)/);
    return match ? match[1] : null;
  }

  // Get the base API URL
  function getBaseUrl(lawUrl) {
    // Convert download URL to base law URL
    return lawUrl.replace("/download", "");
  }

  // Keyboard navigation handler
  function handleKeydown(event) {
    if (
      totalPages === 0 ||
      document.activeElement.tagName === "INPUT" ||
      document.activeElement.tagName === "TEXTAREA"
    ) {
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onPrevPage();
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onNextPage();
    }
  }

  onMount(async () => {
    window.addEventListener("keydown", handleKeydown);

    try {
      const baseUrl = getBaseUrl(url);
      console.log("Fetching PDF info from:", `${baseUrl}/pdf-info`);

      // Get PDF info (page count)
      const infoResponse = await fetch(`${baseUrl}/pdf-info`);
      if (!infoResponse.ok) {
        throw new Error(
          `HTTP ${infoResponse.status}: ${infoResponse.statusText}`,
        );
      }

      const pdfInfo = await infoResponse.json();
      totalPages = pdfInfo.page_count;
      console.log(`PDF has ${totalPages} pages`);

      loading = false;

      // Load initial page (use initialPage prop if valid, otherwise page 1)
      const startPage =
        initialPage > 0 && initialPage <= totalPages ? initialPage : 1;
      await loadPage(startPage);
    } catch (err) {
      console.error("Error loading PDF info:", err);
      error =
        "Impossible de charger le document. " +
        (err.message || "Erreur inconnue");
      loading = false;
    }
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", handleKeydown);
    }
  });

  async function loadPage(num) {
    if (num < 1 || num > totalPages) return;

    pageLoading = true;
    pageNum = num;

    try {
      const baseUrl = getBaseUrl(url);
      const pageUrl = `${baseUrl}/page/${num}?dpi=${dpi}`;
      console.log(`Loading page ${num}:`, pageUrl);

      // Preload image
      const response = await fetch(pageUrl);
      if (!response.ok) {
        throw new Error(`Failed to load page ${num}`);
      }

      const blob = await response.blob();
      currentImageUrl = URL.createObjectURL(blob);
      pageLoading = false;
    } catch (err) {
      console.error(`Error loading page ${num}:`, err);
      pageLoading = false;
      error = `Erreur lors du chargement de la page ${num}`;
    }
  }

  function onPrevPage() {
    if (pageNum <= 1) return;
    loadPage(pageNum - 1);
  }

  function onNextPage() {
    if (pageNum >= totalPages) return;
    loadPage(pageNum + 1);
  }

  function goToPage(num) {
    const targetPage = parseInt(num, 10);
    if (targetPage >= 1 && targetPage <= totalPages) {
      loadPage(targetPage);
    }
  }

  function zoomIn() {
    if (dpi < 200) {
      dpi = Math.min(200, dpi + 20);
      loadPage(pageNum);
    }
  }

  function zoomOut() {
    if (dpi > 72) {
      dpi = Math.max(72, dpi - 20);
      loadPage(pageNum);
    }
  }
</script>

<div class="pdf-viewer">
  {#if loading}
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Chargement du document...</p>
    </div>
  {:else if error}
    <div class="error-container">
      <p class="error-message">{error}</p>
      <p class="error-hint">
        Essayez de rafraîchir la page ou contactez l'administrateur.
      </p>
    </div>
  {:else}
    <div class="controls">
      <button on:click={onPrevPage} disabled={pageNum <= 1 || pageLoading}>
        ← Précédent
      </button>
      <span class="page-info">
        Page
        <input
          type="number"
          min="1"
          max={totalPages}
          value={pageNum}
          on:change={(e) => goToPage(e.target.value)}
          disabled={pageLoading}
        />
        sur {totalPages}
      </span>
      <button
        on:click={onNextPage}
        disabled={pageNum >= totalPages || pageLoading}
      >
        Suivant →
      </button>
      <span class="zoom-controls">
        <button
          on:click={zoomOut}
          disabled={dpi <= 72 || pageLoading}
          title="Réduire"
        >
          −
        </button>
        <span class="zoom-level">{Math.round((dpi / 120) * 100)}%</span>
        <button
          on:click={zoomIn}
          disabled={dpi >= 200 || pageLoading}
          title="Agrandir"
        >
          +
        </button>
      </span>
    </div>

    <div class="canvas-container">
      {#if pageLoading}
        <div class="page-loading">
          <div class="spinner small"></div>
        </div>
      {/if}
      {#if currentImageUrl}
        <img
          src={currentImageUrl}
          alt={`Page ${pageNum}`}
          class:loading={pageLoading}
        />
      {/if}
    </div>

    <div class="keyboard-hint">Utilisez les flèches ← → pour naviguer</div>
  {/if}
</div>

<style>
  .pdf-viewer {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-height: 500px;
    background: #f8f9fa;
    border-radius: 8px;
    padding: 1rem;
  }

  .loading-container,
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    text-align: center;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e0e0e0;
    border-top-color: #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner.small {
    width: 24px;
    height: 24px;
    border-width: 3px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-message {
    color: #e74c3c;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .error-hint {
    color: #7f8c8d;
    font-size: 0.9rem;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .controls button {
    padding: 0.5rem 1rem;
    border: none;
    background: #3498db;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s;
  }

  .controls button:hover:not(:disabled) {
    background: #2980b9;
  }

  .controls button:disabled {
    background: #bdc3c7;
    cursor: not-allowed;
  }

  .page-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .page-info input {
    width: 50px;
    padding: 0.25rem 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    text-align: center;
  }

  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: 1rem;
    padding-left: 1rem;
    border-left: 1px solid #ddd;
  }

  .zoom-controls button {
    padding: 0.25rem 0.75rem;
    font-size: 1.2rem;
    font-weight: bold;
  }

  .zoom-level {
    min-width: 50px;
    text-align: center;
    font-size: 0.85rem;
    color: #666;
  }

  .canvas-container {
    position: relative;
    background: white;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 100%;
    overflow: auto;
  }

  .canvas-container img {
    display: block;
    max-width: 100%;
    height: auto;
    transition: opacity 0.2s;
  }

  .canvas-container img.loading {
    opacity: 0.5;
  }

  .page-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
  }

  .keyboard-hint {
    margin-top: 1rem;
    color: #7f8c8d;
    font-size: 0.85rem;
  }
</style>
