<script lang="ts">
  /**
   * Une ligne de texte d'une réponse : son texte, ses adresses (liens http(s),
   * $lib/texte.morceauxDuTexte), son gras et, sur la nouvelle API, ses
   * citations (P3).
   *
   * - Citation retrouvée : un lien DANS la phrase, souligné zinc-400 qui fonce
   *   au survol, précédé de l'icône § de 14 px ; pas de numéro [1] (maquette
   *   chat-p3a). Son adresse est celle de l'article dans le texte intégral :
   *   un clic simple ouvre l'aperçu à la place (`surCitation`), un clic du
   *   milieu ou avec Ctrl ouvre la page, comme tout lien. Le lien commence au
   *   mot élidé qui précède la citation (« § l’article 35… » et non
   *   « l’ § article 35… », voir `rattacherLesElisions`).
   * - Citation introuvable : soulignée en tirets, du mot élidé à la fin du
   *   passage comme le lien (« l’article 312 du Code pénal »), et nommée comme
   *   telle pour les lecteurs d'écran ; l'alerte en toutes lettres suit le
   *   bloc (TexteDeReponse). Jamais de rouge : ce n'est pas une erreur du site.
   * - Gras : « **Réponse directe** : selon … » garde son gras dans la phrase
   *   (marques de `blocsDeReponse` en mode `gras`, lues par
   *   `segmentsDuTexte`) ; il était retiré, et la maquette chat-p3a le montre.
   * - Espaces insécables : « n° 92/007 », « art. 35 » et « l’article 312 » ne
   *   se coupent plus en fin de ligne ($lib/texte, `insecablesDuTexte`), dans
   *   la phrase comme dans les citations.
   *
   * Tout est rendu en nœuds de texte : le dépôt s'interdit `{@html}`
   * ($lib/texte). Les morceaux s'écrivent bout à bout, sans blanc entre les
   * balises : une espace glissée entre un lien et la parenthèse qui le suit se
   * verrait. Le suffixe des lecteurs d'écran (« (citation non retrouvée) »)
   * est une expression : Svelte 5 retire les blancs du bord d'une balise, et
   * il se collait au dernier mot de la citation.
   */
  import { adresseDeLArticle } from "$lib/api-publique";
  import Icone from "$lib/components/Icone.svelte";
  import { tr } from "$lib/stores/language";
  import { insecablesDuTexte, morceauxDuTexte } from "$lib/texte";
  import type { CitationPositionnee } from "$lib/types";
  import { rattacherLesElisions, segmentsDuTexte, type Segment } from "./citations";

  /** Le texte du bloc, avec ses marques de citation s'il en porte. */
  export let texte: string;
  /** Le texte porte des marques de citation (`marquerLesCitations`). */
  export let marque = false;
  /** Les citations retrouvées, à l'indice de leur marque. */
  export let citations: CitationPositionnee[] = [];
  /** La citation dont l'aperçu est ouvert, mise en évidence. */
  export let citationActive: number | null = null;
  /** Les adresses deviennent des liens (pas dans un titre, qui se lit tel quel). */
  export let liens = true;
  /** Ouvre l'aperçu d'une citation ; `declencheur` reprendra le focus à sa fermeture. */
  export let surCitation: (index: number, declencheur: HTMLElement) => void = () => {};

  $: t = $tr;

  /**
   * Sans marques de citation (ancienne API, conversation rouverte), le texte
   * peut porter celles du gras : il est découpé aussi, et un morceau qui se
   * donnerait pour une citation reste du texte.
   */
  function segmentsSansCitation(texte: string): Segment[] {
    return segmentsDuTexte(texte).map((s) =>
      s.genre === "texte" ? s : { genre: "texte", texte: s.texte, ...(s.gras ? { gras: true } : {}) },
    );
  }

  $: texteAffiche = insecablesDuTexte(texte);
  $: segments = marque ? rattacherLesElisions(segmentsDuTexte(texteAffiche)) : segmentsSansCitation(texteAffiche);

  /**
   * Lien d'une adresse, au style des liens du site (guide § 4.3). Il s'ouvre
   * dans un nouvel onglet : de retour sur /chat, la page ne réaffiche pas la
   * conversation, et la suivre dans le même onglet la faisait disparaître.
   */
  const CLASSE_LIEN =
    "text-zinc-950 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-600 dark:hover:decoration-white";

  /**
   * Recette de la maquette chat-p3a, et l'état « aperçu ouvert » de
   * chat-p3a-apercu. La graisse est posée à part : demi-gras dans un gras de
   * la réponse, medium ailleurs.
   */
  const CLASSE_CITATION =
    "rounded-sm text-zinc-950 underline decoration-zinc-400 decoration-1 underline-offset-[3px] transition-colors hover:decoration-zinc-950 dark:text-white dark:decoration-zinc-500 dark:hover:decoration-white";
  const CLASSE_CITATION_ACTIVE = "bg-zinc-100 decoration-zinc-950 dark:bg-zinc-800 dark:decoration-white";

  /** Le gras d'une réponse : la vraie graisse 600 d'Inter, en noir comme les titres de la bulle. */
  const CLASSE_GRAS = "font-semibold text-zinc-950 dark:text-white";

  /**
   * L'icône et le premier mot ne se séparent jamais : en fin de ligne, l'icône
   * seule restait au bout et la citation commençait à la ligne suivante. Le
   * premier mot porte son élision (« l’article ») : l'icône ne s'y glisse plus.
   * L'espace insécable (« n° 92/007 », « l’article 35 ») ne compte pas comme
   * une coupure : l'icône, « l’article » et son numéro restent ensemble.
   */
  function premierMot(texte: string): string {
    const espace = texte.search(/[^\S\u00A0]/);
    return espace === -1 ? texte : texte.slice(0, espace);
  }
  function suite(texte: string): string {
    const espace = texte.search(/[^\S\u00A0]/);
    return espace === -1 ? "" : texte.slice(espace);
  }

  /** Un clic simple ouvre l'aperçu ; un clic avec modificateur garde son effet de lien. */
  function cliquer(event: MouseEvent, index: number) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    surCitation(index, event.currentTarget as HTMLElement);
  }
</script>

{#each segments as segment, i (i)}{#if segment.genre === "citation" && citations[segment.index]}<a
      href={adresseDeLArticle(citations[segment.index].law_id, citations[segment.index].article)}
      aria-haspopup="dialog"
      data-testid="chat-citation"
      on:click={(event) => cliquer(event, segment.index)}
      class="{CLASSE_CITATION} {segment.gras ? 'font-semibold' : 'font-medium'} {citationActive === segment.index
        ? CLASSE_CITATION_ACTIVE
        : ''}"
      ><span class="whitespace-nowrap"
        ><Icone nom="section" class="mr-0.5 text-[14px] text-zinc-500 dark:text-zinc-400" />{premierMot(segment.texte)}</span
      >{suite(segment.texte)}</a
    >{:else if segment.genre === "introuvable"}<span
      class="underline decoration-zinc-500 decoration-dashed underline-offset-4 {segment.gras ? CLASSE_GRAS : ''}"
      data-testid="chat-citation-introuvable">{segment.texte}</span
    ><span class="sr-only">{` (${t("chat.citation.unfoundShort")})`}</span>{:else if segment.gras}<strong
      class={CLASSE_GRAS}
      >{#if liens}{#each morceauxDuTexte(segment.texte) as morceau, m (m)}{#if morceau.lien}<a
            href={morceau.lien}
            target="_blank"
            rel="noopener noreferrer"
            class={CLASSE_LIEN}>{morceau.texte}</a
          >{:else}{morceau.texte}{/if}{/each}{:else}{segment.texte}{/if}</strong
    >{:else if liens}{#each morceauxDuTexte(segment.texte) as morceau, m (m)}{#if morceau.lien}<a
          href={morceau.lien}
          target="_blank"
          rel="noopener noreferrer"
          class={CLASSE_LIEN}>{morceau.texte}</a
        >{:else}{morceau.texte}{/if}{/each}{:else}{segment.texte}{/if}{/each}
