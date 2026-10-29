<script lang="ts">
  /**
   * Les sources d'une réponse, sur la nouvelle API (P3, maquette chat-p3a) :
   * « Articles cités » (`articles_cites`), chacun avec son statut, puis
   * « Textes consultés, non cités » (`textes_consultes_non_cites`), repliés.
   *
   * L'ancienne liste « Sources » mêlait les deux : un texte remis au modèle et
   * dont aucune phrase ne vient (la « source de repli ») s'y présentait comme
   * une citation. Les séparer dit au lecteur ce qui fonde la réponse.
   *
   * Un article cité ouvre son aperçu, comme la citation dans la phrase (son
   * adresse reste celle du texte intégral, pour un clic du milieu). Un texte
   * consulté s'ouvre dans un nouvel onglet : de retour sur /chat, la page ne
   * réaffiche pas la conversation.
   */
  import { adresseDeLArticle } from "$lib/api-publique";
  import Icone from "$lib/components/Icone.svelte";
  import { language, tr } from "$lib/stores/language";
  import type { SourceCitee, TexteConsulte } from "$lib/types";
  import { designationDuTexteCite, libelleDeLaCitation, mentionDuStatut } from "./libelles";

  /** Identifiant du message, pour des `id` uniques dans la conversation. */
  export let idMessage: number;
  export let articles: SourceCitee[] = [];
  export let consultes: TexteConsulte[] = [];
  /** Date du relevé des liens (`GET /corpus`), pour « aucune modification relevée par JuriX au … ». */
  export let releveLe: string | null = null;
  /** L'article dont l'aperçu est ouvert, mis en évidence. */
  export let articleActif: number | null = null;
  export let surArticle: (index: number, declencheur: HTMLElement) => void = () => {};

  $: t = $tr;
  $: langue = $language.current;

  /**
   * Repliés par défaut (maquette) : ces textes n'appuient aucune phrase, et
   * trois cartes de plus sous chaque réponse repoussaient la question
   * suivante d'un écran sur un téléphone.
   */
  let consultesDeplies = false;

  /**
   * « Loi n° 92/007 du 14 août 1992 · aucune modification relevée par JuriX » :
   * jamais tronquée, le statut ne doit pas disparaître. Les repères ne
   * répètent pas le nom de la ligne du dessus : sous « Art. 120 — Statut
   * Général de la Fonction Publique de l'État », « Décret n° 94/199 du
   * 7 octobre 1994 » ; sous « Art. 3 — Décret n° 2018/9387/CAB/PM », la date
   * seule (voir `designationDuTexteCite`).
   */
  function ligneDeLArticle(source: SourceCitee): string {
    return [
      designationDuTexteCite(source.law_title, source.law_reference).reperes,
      mentionDuStatut(source.statut, t, langue, releveLe),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function ligneDuTexte(texte: TexteConsulte): string {
    const lus = (Array.isArray(texte.articles) ? texte.articles : []).filter(Boolean);
    return [
      designationDuTexteCite(texte.law_title, texte.law_reference).reperes,
      lus.length ? t("chat.consulted.read").replace("{articles}", lus.join(", ")) : "",
      mentionDuStatut(texte.statut, t, langue, releveLe),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function cliquer(event: MouseEvent, index: number) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    surArticle(index, event.currentTarget as HTMLElement);
  }
</script>

{#if articles.length || consultes.length}
  <div class="space-y-3 border-t border-zinc-200 pt-3 text-left dark:border-zinc-800">
    {#if articles.length}
      <div>
        <p id="articles-cites-{idMessage}" class="mb-2 text-xs font-semibold text-zinc-950 dark:text-white">
          {t("chat.cited.title").replace("{n}", String(articles.length))}
        </p>
        <!-- Lignes sans fond au repos et zinc-50 pour l'article ouvert, comme
             au survol : sur zinc-100, la ligne secondaire en zinc-500 tombait
             sous 4,5:1 (guide § 3, règle 1). -->
        <ul
          aria-labelledby="articles-cites-{idMessage}"
          class="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
        >
          {#each articles as source, i (i)}
            <li>
              <a
                href={adresseDeLArticle(source.law_id, source.article_number)}
                aria-haspopup="dialog"
                data-testid="chat-article-cite"
                on:click={(event) => cliquer(event, i)}
                class="flex min-h-11 items-center gap-3 px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 {articleActif ===
                i
                  ? 'bg-zinc-50 dark:bg-zinc-800/60'
                  : ''}"
              >
                <span class="min-w-0 flex-1">
                  <span class="coupe-mots block text-sm font-medium text-zinc-950 dark:text-white"
                    >{libelleDeLaCitation(source.article_number, source.law_title, source.law_reference, t)}</span
                  >
                  {#if ligneDeLArticle(source)}
                    <span class="coupe-mots block text-xs text-zinc-500 dark:text-zinc-400">{ligneDeLArticle(source)}</span>
                  {/if}
                </span>
                <Icone nom="chevron-right" class="shrink-0 text-base text-zinc-400 dark:text-zinc-500" />
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if consultes.length}
      <div>
        <button
          type="button"
          data-testid="chat-consultes-toggle"
          aria-expanded={consultesDeplies}
          aria-controls="textes-consultes-{idMessage}"
          on:click={() => (consultesDeplies = !consultesDeplies)}
          class="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-left text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          <Icone nom={consultesDeplies ? "chevron-up" : "chevron-down"} class="shrink-0 text-base" />
          {t("chat.consulted.title").replace("{n}", String(consultes.length))}
        </button>
        <ul
          id="textes-consultes-{idMessage}"
          class="mt-1 divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800 {consultesDeplies
            ? ''
            : 'hidden'}"
        >
          {#each consultes as texte, i (i)}
            <li>
              <a
                href={adresseDeLArticle(texte.law_id, texte.articles?.length === 1 ? texte.articles[0] : null)}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="chat-texte-consulte"
                class="flex min-h-11 items-center gap-3 px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <span class="min-w-0 flex-1">
                  <!-- Sans intitulé en base, « Texte sans intitulé », jamais la
                       cote interne (P2, P11 ; $lib/sources). -->
                  <span class="coupe-mots block text-sm font-medium text-zinc-950 dark:text-white"
                    >{designationDuTexteCite(texte.law_title, texte.law_reference).nom ||
                      t("chat.citation.sansIntitule")}</span
                  >
                  {#if ligneDuTexte(texte)}
                    <span class="coupe-mots block text-xs text-zinc-500 dark:text-zinc-400">{ligneDuTexte(texte)}</span>
                  {/if}
                  <span class="sr-only">{t("chat.preview.newTab")}</span>
                </span>
                <Icone nom="external-link" class="shrink-0 text-base text-zinc-400 dark:text-zinc-500" />
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}
