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
   * processing, refused. S'y ajoutent ceux d'un compte (/admin/users) :
   * active, inactive. La page des comptes dessinait les siens à la main, plus
   * hauts et plus gras (py-1, font-semibold) que les mêmes états sur les
   * documents et le blog. Et `uploading`, l'envoi d'un fichier dans l'import
   * en lot : sans entrée, le badge affichait le mot anglais brut avec un
   * point d'interrogation pendant tout l'envoi.
   *
   * PALETTE, tranchée une fois pour toutes, en noir et blanc comme le reste
   * du site. Le sens passe par le libellé traduit ET par l'icône, jamais par
   * la couleur seule :
   *   inversé (noir, blanc en sombre)  — c'est fait (published), ou en
   *                                      service (active)
   *   cerclé plein                     — on attend (pending) ; un travail est
   *                                      en cours (processing), seul état animé
   *   cerclé de pointillés, sans fond  — état inerte (draft, archived,
   *                                      inactive)
   *   rouge                            — ça a échoué (refused) : la seule
   *                                      teinte du site, réservée aux échecs
   *
   * Passé de CSS scopé à Tailwind : c'est la convention du reste du projet, et
   * cela apporte les variantes sombres que la version précédente n'avait pas.
   * Seule exception, le bloc de style du bas : l'amplitude de la pulsation,
   * que les classes de Tailwind ne savent pas régler.
   */
  import Icone from '$lib/components/Icone.svelte';
  import type { NomIcone } from '$lib/icones';
  import { tr } from '$lib/stores/language';

  export let status: string;
  export let size: 'sm' | 'md' | 'lg' = 'md';

  interface Config {
    /** Clé de traduction ; les libellés étaient écrits en dur en français. */
    key: string;
    classes: string;
    icone: NomIcone;
    anime?: boolean;
  }

  const FAIT = 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white';
  const EN_ATTENTE = 'bg-white text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-600';
  const INERTE = 'bg-transparent text-zinc-500 border-dashed border-zinc-300 dark:text-zinc-400 dark:border-zinc-600';

  const CONFIGS: Record<string, Config> = {
    draft: { key: 'admin.draft', classes: INERTE, icone: 'pen-line' },
    pending: { key: 'admin.pending', classes: EN_ATTENTE, icone: 'clock' },
    uploading: { key: 'admin.upload.statusUploading', classes: EN_ATTENTE, icone: 'upload' },
    processing: { key: 'admin.processing', classes: EN_ATTENTE, icone: 'loader-circle', anime: true },
    published: { key: 'admin.published', classes: FAIT, icone: 'check' },
    refused: {
      key: 'admin.refused',
      classes: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60',
      icone: 'circle-x',
    },
    archived: { key: 'admin.archived', classes: INERTE, icone: 'archive' },
    // Comptes : un compte désactivé n'est pas une erreur, il ne prend pas le
    // rouge des échecs.
    active: { key: 'admin.users.activeOne', classes: FAIT, icone: 'check' },
    inactive: { key: 'admin.users.inactiveOne', classes: INERTE, icone: 'circle-dashed' },
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

<!-- Le statut inconnu garde la recette du badge neutre, avec un point
     d'interrogation : l'anomalie se voit sans passer pour un état réel.
     L'animation ne joue que si le système l'autorise (motion-safe).
     `pulsation-lisible` borne la pulsation de « processing » (voir le style
     plus bas) : `motion-safe:animate-pulse` reste sur le badge, comme le
     veulent le guide (§ 4.9) et StatusBadge.test.ts. -->
<span
  data-testid="status-badge"
  data-status={status}
  class="inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap {TAILLES[
    size
  ]} {config?.classes ??
    'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'} {config?.anime
    ? 'motion-safe:animate-pulse pulsation-lisible'
    : ''}"
>
  <Icone nom={config?.icone ?? 'circle-question-mark'} />
  {libelle}
</span>

<style>
  /* Pulsation du badge « processing », bornée à 75 % d'opacité.
     `animate-pulse` de Tailwind descend à 50 % : au creux, le texte de 12 px
     du badge tombait à 2,6:1 sur la carte blanche (zinc-700 estompé) et à
     3,9:1 sur la carte zinc-900, sous les 4,5:1 exigés (axe, « serious »,
     sur /admin/documents et l'import en lot). À 75 %, il garde 5,0:1 en
     clair et 7,2:1 en sombre ; à 70 %, le clair repasserait sous le seuil
     (4,4:1). Seul le nom de l'animation change ici : sa durée, son rythme et
     sa garde `motion-safe` restent ceux de `motion-safe:animate-pulse`, que
     ce sélecteur (plus spécifique, classe de portée de Svelte comprise)
     remplace sans dépendre de l'ordre des feuilles. Les images clés de
     Tailwind ne changent pas : les squelettes de chargement, sans texte,
     gardent leur pulsation à 50 %. */
  @media (prefers-reduced-motion: no-preference) {
    .pulsation-lisible {
      animation-name: pulsation-lisible;
    }
  }

  @keyframes pulsation-lisible {
    50% {
      opacity: 0.75;
    }
  }
</style>
