<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  
  const features = [
    {
      title: 'Base de données intelligente',
      description: 'Accédez à des milliers de documents juridiques classés et indexés en un éclair grâce à notre IA performante.',
      icon: 'manage_search',
      color: 'bg-emerald-500'
    },
    {
      title: 'Interface d\'administration',
      description: 'Gérez facilement vos utilisateurs, vos lois, et uploadez vos documents en lots avec OCR intégré.',
      icon: 'admin_panel_settings',
      color: 'bg-indigo-500'
    },
    {
      title: 'Support Multilingue',
      description: 'Recherchez et affichez la jurisprudence et les lois en plusieurs langues (français, anglais) avec JuriX.',
      icon: 'translate',
      color: 'bg-rose-500'
    }
  ];
</script>

<svelte:head>
  <title>JuriX - Intelligence Juridique Avancée</title>
</svelte:head>

<div class="relative min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-indigo-100 selection:text-indigo-900">
  
  <!-- Gradient Background Decoration -->
  <div class="absolute inset-0 z-0 overflow-hidden pointer-events-none">
    <div class="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-indigo-300/20 blur-3xl opacity-60"></div>
    <div class="absolute top-40 -left-20 w-[500px] h-[500px] rounded-full bg-rose-300/20 blur-3xl opacity-60"></div>
    <div class="absolute bottom-0 right-20 w-[700px] h-[700px] rounded-full bg-emerald-200/20 blur-3xl opacity-50"></div>
  </div>

  <!-- Navbar -->
  <nav class="relative z-10 container mx-auto px-6 py-6 flex items-center justify-between" in:fade={{ duration: 800 }}>
    <div class="flex items-center gap-3">
      <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-lg shadow-indigo-500/30">
        <span class="material-icons text-3xl">gavel</span>
      </div>
      <span class="text-2xl font-bold tracking-tight text-slate-900">JuriX</span>
    </div>
    
    <div class="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
      <a href="/admin" class="hover:text-indigo-600 transition-colors">Portail Administratif</a>
      <a href="/about" class="hover:text-indigo-600 transition-colors">À Propos</a>
      <a href="/admin" class="rounded-full bg-slate-900 px-5 py-2.5 text-white transition-all hover:bg-indigo-600 hover:shadow-md hover:shadow-indigo-500/25">
        Connexion
      </a>
    </div>
  </nav>

  <!-- Hero Section -->
  <main class="relative z-10 container mx-auto px-6 pt-20 pb-32">
    <div class="mx-auto max-w-4xl text-center" in:fly={{ y: 30, duration: 1000, delay: 200 }}>
      
      <div class="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-4 py-1.5 text-sm font-medium text-indigo-700 shadow-sm backdrop-blur-sm">
        <span class="relative flex h-2.5 w-2.5">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"></span>
          <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
        </span>
        Vercel Deployment Réussi
      </div>
      
      <h1 class="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl mb-8 leading-[1.1]">
        Le droit, <br />
        <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500">
          simplifié par l'intelligence.
        </span>
      </h1>
      
      <p class="mx-auto max-w-2xl text-lg text-slate-600 mb-12 leading-relaxed">
        JuriX est votre plateforme d'exploration juridique de nouvelle génération. Gérez vos bibliothèques de lois, analysez les documents OCR et bénéficiez d'un moteur de recherche propulsé par Meilisearch.
      </p>

      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <a href="/admin" class="group relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-500/30 w-full sm:w-auto">
          <span class="relative z-10 flex items-center gap-2">
            Accéder au Dashboard Admin
            <span class="material-icons text-sm transition-transform group-hover:translate-x-1">arrow_forward</span>
          </span>
        </a>
        
        <a href="/categories/1" class="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white/50 backdrop-blur-sm px-8 py-4 text-base font-semibold text-slate-700 transition-all hover:border-indigo-200 hover:bg-white hover:text-indigo-700 w-full sm:w-auto">
          Explorer les Catégories
          <span class="material-icons text-sm">category</span>
        </a>
      </div>
    </div>

    <!-- Feature Cards -->
    <div class="mt-32 grid gap-8 sm:grid-cols-2 lg:grid-cols-3" in:fly={{ y: 40, duration: 1000, delay: 400 }}>
      {#each features as feature}
        <div class="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/40 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/50 border border-slate-100">
          <div class="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl {feature.color} text-white shadow-inner">
            <span class="material-icons text-3xl">{feature.icon}</span>
          </div>
          <h3 class="mb-3 text-xl font-bold text-slate-900">{feature.title}</h3>
          <p class="text-slate-600 leading-relaxed">{feature.description}</p>
          
          <div class="absolute bottom-0 left-0 h-1 w-full scale-x-0 bg-gradient-to-r from-indigo-500 to-emerald-400 transition-transform duration-300 origin-left group-hover:scale-x-100"></div>
        </div>
      {/each}
    </div>
  </main>
</div>
