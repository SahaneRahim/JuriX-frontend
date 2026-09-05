/**
 * Découpe un extrait surligné par PostgreSQL en segments sûrs.
 *
 * POURQUOI. `src/routes/search/+page.svelte` rendait `result.highlights.content`
 * avec `{@html}`. Ce champ vient de `ts_headline` (voir
 * `app/services/postgres_search_service.py:324-331`, option
 * `StartSel=<mark>,StopSel=</mark>`) — mais **`ts_headline` n'échappe pas le
 * texte source**. Le contenu des lois provient de l'ingestion PDF/OCR, chemin
 * sur lequel le front n'a aucune garantie : toute balise présente dans un
 * document ingéré s'exécutait dans la page. Combiné au jeton d'authentification
 * stocké en clair dans `localStorage` (`src/lib/stores/auth.ts`), un seul
 * document piégé suffisait à exfiltrer une session d'administrateur.
 *
 * Plutôt que d'ajouter un désinfectant — une dépendance de plus et une
 * politique à maintenir — on exploite le fait que le contrat backend est
 * étroit : la SEULE balise volontairement émise est `<mark>`. On la reconnaît,
 * on rend le reste en nœuds de texte, et Svelte échappe tout le reste. Le
 * risque disparaît par construction, pas par filtrage.
 */

export interface HighlightSegment {
  text: string;
  /** Ce segment était-il entouré de `<mark>` par ts_headline ? */
  marked: boolean;
}

/** Les deux seuls marqueurs attendus, produits par l'option `StartSel`/`StopSel`. */
const MARK = /<\/?mark>/i;

/**
 * Rend une chaîne `ts_headline` sous forme de segments.
 *
 * Toute autre balise éventuellement présente reste du texte littéral : elle
 * s'affichera telle quelle plutôt que de s'exécuter, ce qui est le comportement
 * voulu — un `<script>` dans le corps d'une loi est une anomalie d'ingestion, et
 * la voir à l'écran vaut mieux que de la laisser passer en silence.
 */
export function highlightSegments(raw: string | null | undefined): HighlightSegment[] {
  if (!raw) return [];

  const segments: HighlightSegment[] = [];
  let marked = false;

  for (const part of raw.split(MARK)) {
    // `split` sur une expression sans groupe capturant retire les marqueurs et
    // fait alterner les segments : hors surlignage, dedans, hors, etc.
    if (part) segments.push({ text: part, marked });
    marked = !marked;
  }

  return segments;
}
