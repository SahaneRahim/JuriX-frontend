<script lang="ts">
  /**
   * Badge de statut, unique pour toute l'application.
   *
   * POURQUOI. Cinq implémentations concurrentes coexistaient, avec des couleurs
   * CONTRADICTOIRES pour le même statut : `pending` était bleu sur
   * /admin/documents et jaune sur /admin/documents/batch-upload, `published`
   * était emerald ici et green là. Une même donnée changeait de sens visuel
   * selon l'écran. Et batch-upload affichait l'énumération anglaise brute
   * (`pending`, `refused`) alors que les libellés traduits existaient déjà.
   *
   * Ce composant portait de son côté un SIXIÈME vocabulaire — `repealed`,
   * `completed`, `failed` — qui ne correspond à rien de ce que renvoie l'API.
   * Il est réaligné sur les statuts réels du modèle `Law`
   * (`app/models/law.py:163`) : draft, published, archived, pending,
   * processing, refused.
   *
   * PALETTE, tranchée une fois pour toutes. Elle suit une logique et non les
   * habitudes de chaque page :
   *   amber   — on attend quelque chose (pending)
   *   blue    — un travail est en cours (processing), seul état animé
   *   emerald — c'est fait (published)
   *   red     — ça a échoué (refused)
   *   slate   — état inerte (draft, archived)
   *
   * Passé de CSS scopé à Tailwind : c'est la convention du reste du projet, et
   * cela apporte les variantes sombres que la version précédente n'avait pas.
   */
  import { tr } from '$lib/stores/language';

  export let status: string;
  export let size: 'sm' | 'md' | 'lg' = 'md';

  interface Config {
    /** Clé de traduction ; les libellés étaient écrits en dur en français. */
    key: string;
    classes: string;
    anime?: boolean;
  }

  const CONFIGS: Record<string, Config> = {
    draft: { key: 'admin.draft', classes: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
    pending: { key: 'admin.pending', classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
    processing: { key: 'admin.processing', classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200', anime: true },
    published: { key: 'admin.published', classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
    refused: { key: 'admin.refused', classes: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
    archived: { key: 'admin.archived', classes: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  };

  const TAILLES = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  // Un statut inconnu ne doit pas faire disparaître le badge : on affiche la
  // valeur brute, ce qui rend l'anomalie visible au lieu de la masquer.
  $: config = CONFIGS[status];
  $: libelle = config ? $tr(config.key) : status;
</script>

<span
  data-testid="status-badge"
  data-status={status}
  class="inline-flex items-center rounded-full font-medium whitespace-nowrap {TAILLES[
    size
  ]} {config?.classes ?? 'bg-slate-100 text-slate-700'} {config?.anime
    ? 'animate-pulse'
    : ''}"
>
  {libelle}
</span>
