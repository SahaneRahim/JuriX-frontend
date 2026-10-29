<script lang="ts">
  /**
   * L'encadré sous un article touché par un autre texte (P1, étape 2) :
   * « Article modifié par la loi n° 2026/002 du 14 avril 2026 : réécrit en
   * entier. Le texte ci-dessous est la version d'origine, sans cette
   * modification. » (maquette constitution-p1a). Même aplat zinc-100 sans
   * bordure que l'encadré en tête, icône et mot, jamais de rouge.
   *
   * Trois sortes de lignes : les changements actuels, les changements
   * dépassés depuis (en gris, avec le texte qui les a dépassés), et ce que
   * l'article fait lui-même à d'autres textes (une loi modificative, un Acte
   * uniforme qui abroge une partie du Code civil). Rien quand l'article
   * n'apparaît pas dans le relevé : ce n'est pas « intact », c'est inconnu,
   * et l'encadré en tête le dit déjà.
   *
   * La phrase sur le texte affiché suit `mentionDuTexteAffiche` (statut.ts) :
   * « version d'origine » seulement quand rien ne dit le contraire.
   */
  import { createEventDispatcher } from "svelte";
  import Icone from "$lib/components/Icone.svelte";
  import { language, tr } from "$lib/stores/language";
  import NomDuTexteLie from "./NomDuTexteLie.svelte";
  import { cibleDuChangement, mentionDuTexteAffiche, participe, type ChangementsDeLArticle } from "./statut";
  import { LIEN_DANS_LE_TEXTE } from "./typographie";

  export let changements: ChangementsDeLArticle | undefined;
  /** L'onglet « Historique » existe : un lien y mène. */
  export let historique = false;
  /** Texte entier : marges resserrées entre les articles. */
  export let compact = false;
  /** Le document en base est une version consolidée (`statut.version_en_base`) : jamais « version d'origine ». */
  export let consolide = false;

  const dispatch = createEventDispatcher<{ historique: null }>();

  $: langue = $language.current;
  $: deuxPoints = langue === "fr" ? "\u00a0:" : ":";
  $: actuels = changements?.actuels ?? [];
  $: anciens = changements?.anciens ?? [];
  $: portes = changements?.portes ?? [];
  $: cleDeLaMention = mentionDuTexteAffiche(actuels, consolide);
  // Les uns intégrés au document, les autres non : chaque ligne intégrée le
  // dit, et la phrase de fin ne parle que des autres.
  $: marquerLesIntegres = actuels.some((c) => c.integre_au_texte) && actuels.some((c) => !c.integre_au_texte);
</script>

{#if actuels.length || anciens.length || portes.length}
  <div
    class="{compact
      ? 'mb-4'
      : 'mb-6'} space-y-1.5 rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
    data-testid="law-article-status"
  >
    {#each actuels as c (c.id)}
      <p class="flex items-start gap-2.5">
        <span class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white"><Icone nom="rotate-ccw-clock" /></span>
        <span>
          <span class="font-semibold text-zinc-950 dark:text-white">{$tr(`loi.article.${c.type}`)}</span>
          <!-- Espaces des blocs `{#if}` dans des expressions : Svelte retire
               ceux qui bordent un bloc. La section, seule dans son élément,
               reste mot pour mot. -->
          {$tr("loi.mot.par")} <NomDuTexteLie texte={c.texte} />{#if c.nature_modification === "reecrit_en_entier"}{`${deuxPoints} ${participe(c, false, $tr)}`}{/if}{#if c.section}{` (${$tr("loi.historique.dans")} `}<span
              >{c.section}</span
            >){/if}.{#if marquerLesIntegres && c.integre_au_texte}{` ${$tr("loi.historique.integre")}`}{/if}
        </span>
      </p>
    {/each}
    {#if cleDeLaMention}
      <!-- Aligné sur le texte des lignes, après l'icône (16 px et 10 px d'écart). -->
      <p class="pl-[1.625rem]">{$tr(cleDeLaMention)}</p>
    {/if}
    {#each anciens as c (c.id)}
      <p class="pl-[1.625rem] text-zinc-600 dark:text-zinc-400">
        {$tr("loi.article.anterieure")}{deuxPoints}
        {$tr("loi.mot.par")} <NomDuTexteLie texte={c.texte} />{#if c.depasse_par},
          {$tr("loi.historique.depasse_par")} <NomDuTexteLie texte={c.depasse_par} />{/if}.
      </p>
    {/each}
    {#each portes as c (c.id)}
      <p class="flex items-start gap-2.5">
        <span class="mt-0.5 shrink-0 text-base text-zinc-950 dark:text-white"><Icone nom="file-pen-line" /></span>
        <span>
          {$tr("loi.article.cet_article")}
          {$tr(`loi.porte.${c.type}`)} <NomDuTexteLie texte={c.texte} />
          ({cibleDuChangement(c, langue, $tr)}{#if c.section}, {$tr("loi.historique.dans")}
            <span>{c.section}</span>{/if}).
        </span>
      </p>
    {/each}
    {#if historique}
      <!-- Un bouton et non un lien : il change d'onglet sur la page. 44 px
           au doigt, comme les autres cibles de la page. -->
      <p class="pl-[1.625rem]">
        <button
          type="button"
          class="{LIEN_DANS_LE_TEXTE} inline-flex min-h-11 items-center lg:[@media(pointer:fine)]:min-h-0"
          on:click={() => dispatch("historique", null)}
          data-testid="law-article-history"
        >
          {$tr("loi.article.voir_historique")}
        </button>
      </p>
    {/if}
  </div>
{/if}
