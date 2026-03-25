<script lang="ts">
  import { language, toggleShowAll } from '$lib/stores/language';
</script>

<div class="toggle-container">
  <label class="toggle-label">
    <input
      type="checkbox"
      checked={$language.showAllLanguages}
      on:change={toggleShowAll}
      class="toggle-checkbox"
    />
    <span class="toggle-slider"></span>
    <span class="toggle-text">
      {#if $language.showAllLanguages}
        Showing all languages
      {:else}
        Filtering by {$language.current.toUpperCase()}
      {/if}
    </span>
  </label>
</div>

<style>
  .toggle-container {
    display: inline-block;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
  }

  .toggle-checkbox {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: relative;
    display: inline-block;
    width: 3rem;
    height: 1.5rem;
    background-color: #cbd5e1;
    border-radius: 9999px;
    transition: background-color 0.2s ease;
  }

  .toggle-slider::before {
    content: '';
    position: absolute;
    top: 0.125rem;
    left: 0.125rem;
    width: 1.25rem;
    height: 1.25rem;
    background-color: white;
    border-radius: 50%;
    transition: transform 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .toggle-checkbox:checked + .toggle-slider {
    background-color: #3b82f6;
  }

  .toggle-checkbox:checked + .toggle-slider::before {
    transform: translateX(1.5rem);
  }

  .toggle-checkbox:focus + .toggle-slider {
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .toggle-text {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .toggle-checkbox:checked ~ .toggle-text {
    color: #3b82f6;
  }
</style>
