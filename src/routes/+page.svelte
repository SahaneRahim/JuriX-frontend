<script lang="ts">
  import { onMount } from 'svelte';
  
  onMount(() => {
    // Redirection automatique vers /admin pour éviter l'erreur 404 de la racine
    window.location.replace('/admin');
  });
</script>

<div class="h-screen w-full flex items-center justify-center bg-slate-50">
  <div class="animate-pulse flex flex-col items-center gap-4">
    <span class="material-icons text-4xl text-indigo-500">sync</span>
    <p class="text-slate-500 font-medium tracking-wide">Chargement de JuriX...</p>
  </div>
</div>
