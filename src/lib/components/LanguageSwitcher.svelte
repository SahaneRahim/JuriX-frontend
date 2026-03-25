<script lang="ts">
  import { language, switchLanguage } from '$lib/stores/language';

  const languages = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' }
  ] as const;

  function handleSwitch(langCode: 'fr' | 'en') {
    console.log('Switching language to:', langCode);
    switchLanguage(langCode);
  }
</script>

<div class="language-switcher">
  <div class="flex items-center gap-2">
    {#each languages as lang}
      <button
        on:click={() => handleSwitch(lang.code)}
        class="language-btn"
        class:active={$language.current === lang.code}
        aria-label="Switch to {lang.name}"
      >
        <span class="lang-code">{lang.code.toUpperCase()}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .language-switcher {
    display: flex;
    align-items: center;
  }

  .language-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 2px solid transparent;
    border-radius: 0.5rem;
    background-color: transparent;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .language-btn:hover {
    background-color: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .language-btn.active {
    background-color: rgba(59, 130, 246, 0.2);
    border-color: rgb(59, 130, 246);
    font-weight: 600;
  }



  .lang-code {
    font-size: 0.875rem;
    font-weight: 500;
  }
</style>
