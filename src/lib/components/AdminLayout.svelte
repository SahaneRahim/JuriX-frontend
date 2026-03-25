<script lang="ts">
  import { authStore } from '$lib/stores/auth';
  import { page } from '$app/stores';

  let sidebarOpen = false;

  const navItems = [
    { label: 'Dashboard', href: '/admin', icon: '📊' },
    { label: 'Lois', href: '/admin/laws', icon: '📜' },
    { label: 'Catégories', href: '/admin/categories', icon: '🏷️' },
    { label: 'Analytics', href: '/admin/analytics', icon: '📈' },
    { label: 'Utilisateurs', href: '/admin/users', icon: '👥' }
  ];

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  function handleLogout() {
    authStore.logout();
    window.location.href = '/admin/login';
  }

  $: currentPath = $page?.url?.pathname || '';
</script>

<div class="admin-layout">
  <!-- Sidebar -->
  <aside class="sidebar" class:open={sidebarOpen}>
    <div class="sidebar-header">
      <h1 class="logo">⚖️ JuriX Admin</h1>
      <button type="button" class="close-sidebar" on:click={toggleSidebar}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <nav class="sidebar-nav">
      {#each navItems as item}
        <a
          href={item.href}
          class="nav-item"
          class:active={currentPath === item.href}
        >
          <span class="nav-icon">{item.icon}</span>
          <span class="nav-label">{item.label}</span>
        </a>
      {/each}
    </nav>

    <div class="sidebar-footer">
      <div class="user-info">
        <div class="user-avatar">
          {$authStore.user?.name?.charAt(0) || 'A'}
        </div>
        <div class="user-details">
          <div class="user-name">{$authStore.user?.name || 'Admin'}</div>
          <div class="user-role">{$authStore.user?.role || 'Administrator'}</div>
        </div>
      </div>
      <button type="button" class="logout-btn" on:click={handleLogout}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
        </svg>
        Déconnexion
      </button>
    </div>
  </aside>

  <!-- Main Content -->
  <div class="main-content">
    <!-- Header -->
    <header class="header">
      <button type="button" class="menu-btn" on:click={toggleSidebar}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      <div class="breadcrumbs">
        <slot name="breadcrumbs">
          <span>Dashboard</span>
        </slot>
      </div>
    </header>

    <!-- Page Content -->
    <main class="content">
      <slot />
    </main>
  </div>

  <!-- Mobile Overlay -->
  {#if sidebarOpen}
    <div class="overlay" on:click={toggleSidebar} role="presentation"></div>
  {/if}
</div>

<style>
  .admin-layout {
    display: flex;
    min-height: 100vh;
    background-color: #f9fafb;
  }

  /* Sidebar */
  .sidebar {
    width: 16rem;
    background-color: #1f2937;
    color: white;
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 40;
    transition: transform 0.3s ease;
  }

  @media (max-width: 768px) {
    .sidebar {
      transform: translateX(-100%);
    }

    .sidebar.open {
      transform: translateX(0);
    }
  }

  .sidebar-header {
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
  }

  .close-sidebar {
    display: none;
    width: 2rem;
    height: 2rem;
    border: none;
    background: transparent;
    color: white;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .close-sidebar {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .close-sidebar svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .sidebar-nav {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    color: #d1d5db;
    text-decoration: none;
    transition: all 0.2s ease;
    margin-bottom: 0.25rem;
  }

  .nav-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .nav-item.active {
    background-color: #3b82f6;
    color: white;
  }

  .nav-icon {
    font-size: 1.25rem;
  }

  .nav-label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .sidebar-footer {
    padding: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .user-avatar {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background-color: #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
  }

  .user-details {
    flex: 1;
  }

  .user-name {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .user-role {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .logout-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem;
    border: none;
    border-radius: 0.5rem;
    background-color: rgba(239, 68, 68, 0.1);
    color: #fca5a5;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .logout-btn:hover {
    background-color: rgba(239, 68, 68, 0.2);
  }

  .logout-btn svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  /* Main Content */
  .main-content {
    flex: 1;
    margin-left: 16rem;
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 768px) {
    .main-content {
      margin-left: 0;
    }
  }

  .header {
    background-color: white;
    border-bottom: 1px solid #e5e7eb;
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    position: sticky;
    top: 0;
    z-index: 30;
  }

  .menu-btn {
    display: none;
    width: 2.5rem;
    height: 2.5rem;
    border: none;
    background: transparent;
    color: #374151;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .menu-btn {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .menu-btn svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .breadcrumbs {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .content {
    flex: 1;
    padding: 1.5rem;
  }

  /* Mobile Overlay */
  .overlay {
    display: none;
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 30;
  }

  @media (max-width: 768px) {
    .overlay {
      display: block;
    }
  }
</style>
