<script lang="ts">
  export let status: 'draft' | 'active' | 'repealed' | 'processing' | 'completed' | 'failed';
  export let size: 'sm' | 'md' | 'lg' = 'md';

  const statusConfig = {
    draft: {
      label: 'Brouillon',
      color: 'gray',
      icon: '📝'
    },
    active: {
      label: 'Actif',
      color: 'green',
      icon: '✅'
    },
    repealed: {
      label: 'Abrogé',
      color: 'red',
      icon: '❌'
    },
    processing: {
      label: 'En traitement',
      color: 'blue',
      icon: '⏳'
    },
    completed: {
      label: 'Terminé',
      color: 'green',
      icon: '✓'
    },
    failed: {
      label: 'Échec',
      color: 'red',
      icon: '⚠️'
    }
  };

  $: config = statusConfig[status];
</script>

<span class="status-badge" class:sm={size === 'sm'} class:md={size === 'md'} class:lg={size === 'lg'} data-color={config.color}>
  <span class="icon">{config.icon}</span>
  <span class="label">{config.label}</span>
</span>

<style>
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    border-radius: 9999px;
    font-weight: 500;
    white-space: nowrap;
  }

  /* Sizes */
  .status-badge.sm {
    padding: 0.125rem 0.5rem;
    font-size: 0.75rem;
  }

  .status-badge.md {
    padding: 0.25rem 0.75rem;
    font-size: 0.875rem;
  }

  .status-badge.lg {
    padding: 0.375rem 1rem;
    font-size: 1rem;
  }

  /* Colors */
  .status-badge[data-color="gray"] {
    background-color: #f3f4f6;
    color: #6b7280;
  }

  .status-badge[data-color="green"] {
    background-color: #d1fae5;
    color: #065f46;
  }

  .status-badge[data-color="red"] {
    background-color: #fee2e2;
    color: #991b1b;
  }

  .status-badge[data-color="blue"] {
    background-color: #dbeafe;
    color: #1e40af;
  }

  .status-badge[data-color="yellow"] {
    background-color: #fef3c7;
    color: #92400e;
  }

  .icon {
    display: inline-flex;
    align-items: center;
  }

  .label {
    line-height: 1;
  }
</style>
