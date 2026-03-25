<script lang="ts">
  import '$lib/components/admin/AdminSidebar.svelte';
  import AdminSidebar from '$lib/components/admin/AdminSidebar.svelte';
  import '../../app.css';
</script>

<div class="min-h-screen bg-slate-50 font-sans text-slate-900">
  <AdminSidebar />
  
  <main class="ml-64 min-h-screen p-8 transition-all">
    <div class="mx-auto max-w-6xl">
       <slot />
    </div>
  </main>
</div>
