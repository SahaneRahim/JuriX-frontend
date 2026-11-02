<script lang="ts">
  /**
   * Où en est un article pour le public, dans la liste comme dans la fenêtre.
   *
   * POURQUOI. « Publié » ne doit jamais se dire d'un article que le public ne
   * peut pas lire (la revue du tour 2 l'a relevé : la liste disait « Publié »
   * d'un article retiré). Depuis le contrat du 30/10, la route publique ne
   * sert que les articles publiés ET publiables. Un article publié dans la
   * base mais non publiable est donc :
   * - « À reprendre : publié avant la vérification » s'il n'a jamais été
   *   contrôlé ni relu (les trois articles du 26/10, cachés du public par
   *   décision du propriétaire) ;
   * - « Caché du public » sinon (un texte cité dépublié depuis, un contrôle
   *   relancé qui a trouvé une phrase contredite…).
   * Les deux reprennent le style des avertissements du site : tirets et
   * icône d'alerte, en noir et blanc.
   */
  import Icone from "$lib/components/Icone.svelte";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import { tr } from "$lib/stores/language";
  import { estAncien, visibleDuPublic, type ArticleAdmin } from "./relecture";

  export let article: ArticleAdmin;
</script>

{#if !article.isPublished}
  <StatusBadge status="draft" size="sm" />
{:else if visibleDuPublic(article)}
  <StatusBadge status="published" size="sm" />
{:else}
  <span
    class="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-500 px-2 py-0.5 text-xs font-semibold text-zinc-800 dark:border-zinc-400 dark:text-zinc-200"
    data-testid={estAncien(article) ? "blog-a-reprendre" : "blog-cache"}
  >
    <Icone nom="triangle-alert" class="shrink-0 text-sm" />
    {estAncien(article) ? $tr("admin.blog.legacy") : $tr("admin.blog.hidden")}
  </span>
{/if}
